import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { staffScopeWhere } from "../auth/scope";
import type { AuthedUser } from "../auth/types";
import type { ReportsListQueryDto } from "./dto";
import type { PatchReportDto } from "./single-report.dto";

/**
 * Port of Phase1 `/api/reports` (list) and `/api/reports/[id]` (GET/PATCH/DELETE).
 * SQL is byte-for-byte identical with the legacy route. The session-related
 * routes live in their own module (reports/sessions) once ported.
 */
@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private selectReport(userIsAdmin: boolean): string {
    const priceCols = userIsAdmin
      ? `, bt.unit_price_excl::float8 AS unit_price_excl
         , bt.unit_price_incl::float8 AS unit_price_incl
         , (r.count * bt.unit_price_excl)::float8 AS line_amount_excl
         , (r.count * bt.unit_price_incl)::float8 AS line_amount_incl`
      : `, NULL::float8 AS unit_price_excl
         , NULL::float8 AS unit_price_incl
         , NULL::float8 AS line_amount_excl
         , NULL::float8 AS line_amount_incl`;

    return `
    SELECT r.id,
           r.staff_id, s.name AS staff_name,
           r.site_id,  st.name AS site_name,
           r.client_id, c.name  AS client_name,
           r.business_type_id, bt.name AS business_type_name,
           bl.name AS business_line_name,
           r.count, r.image_url, r.memo,
           rs.memo AS session_memo,
           rs.submitted_at AS session_submitted_at,
           rs.work_date::text AS work_date
           ${priceCols},
           r.reported_at, r.created_at, r.updated_at
      FROM business_reports r
      JOIN staffs           s  ON s.id  = r.staff_id
      JOIN sites            st ON st.id = r.site_id
      JOIN client_companies c  ON c.id  = r.client_id
      JOIN business_types   bt ON bt.id = r.business_type_id
      LEFT JOIN report_sessions rs ON rs.id = r.session_id
      LEFT JOIN business_lines bl ON bl.id = rs.business_line_id OR bl.id = bt.business_line_id
  `;
  }

  private async simpleReport(): Promise<string> {
    // Used by /:id GET when admin-aware price columns aren't needed yet;
    // we still go through selectReport() for shape parity.
    return this.selectReport(false);
  }

  async list(user: AuthedUser, q: ReportsListQueryDto) {
    const params: unknown[] = [];
    const conds: string[] = [];
    if (q.date) {
      params.push(q.date);
      conds.push(
        `COALESCE(rs.work_date, (r.reported_at AT TIME ZONE 'Asia/Tokyo')::date) = $${params.length}::date`,
      );
    } else {
      if (q.from) {
        params.push(q.from);
        conds.push(
          `COALESCE(rs.work_date, (r.reported_at AT TIME ZONE 'Asia/Tokyo')::date) >= $${params.length}::date`,
        );
      }
      if (q.to) {
        params.push(q.to);
        conds.push(
          `COALESCE(rs.work_date, (r.reported_at AT TIME ZONE 'Asia/Tokyo')::date) <= $${params.length}::date`,
        );
      }
    }
    if (q.staff_id) {
      params.push(q.staff_id);
      conds.push(`r.staff_id = $${params.length}`);
    }
    if (q.site_id) {
      params.push(q.site_id);
      conds.push(`r.site_id = $${params.length}`);
    }
    if (q.client_id) {
      params.push(q.client_id);
      conds.push(`r.client_id = $${params.length}`);
    }
    const scope = staffScopeWhere(user, "r.staff_id", params.length);
    params.push(...scope.params);

    const where = [conds.join(" AND "), scope.sql.replace(/^ AND /, "")]
      .filter(Boolean)
      .join(" AND ");

    const items = await this.ds.query(
      `${this.selectReport(user.role === "admin")}
        ${where ? "WHERE " + where : ""}
        ORDER BY r.reported_at DESC
        LIMIT 500`,
      params,
    );
    return { items };
  }

  async detail(user: AuthedUser, id: string) {
    const meta = await this.loadReportMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");
    if (!(await this.canAccessStaff(user, meta.staff_id))) {
      throw new ForbiddenException("閲覧権限がありません");
    }
    const rows = await this.ds.query(
      `${this.selectReport(user.role === "admin")} WHERE r.id = $1`,
      [id],
    );
    return { item: rows[0] };
  }

  async patch(user: AuthedUser, id: string, body: PatchReportDto) {
    const meta = await this.loadReportMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");

    if (user.role !== "admin") {
      if (user.role !== "employee" || user.staffId !== meta.staff_id) {
        throw new ForbiddenException("編集権限がありません");
      }
    }

    const provided = (k: keyof PatchReportDto) =>
      Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;
    if (!Object.keys(body).length) {
      throw new BadRequestException("更新する項目を指定してください");
    }

    // If site_id changes, re-resolve client_id and validate the business_type
    // belongs to that client (denormalised business_reports.client_id must
    // stay in sync with sites.client_id).
    let newClientId: string | undefined;
    if (provided("site_id") || provided("business_type_id")) {
      const siteRows: Array<{ client_id: string }> = await this.ds.query(
        `SELECT s.client_id
           FROM sites s
           JOIN business_reports r ON r.id = $1
          WHERE s.id = COALESCE($2, r.site_id) AND s.deleted_at IS NULL`,
        [id, body.site_id ?? null],
      );
      if (!siteRows[0]) throw new NotFoundException("現場が見つかりません");
      newClientId = siteRows[0].client_id;

      if (body.business_type_id) {
        const btRows: Array<{ client_id: string }> = await this.ds.query(
          `SELECT client_id FROM business_types WHERE id = $1 AND deleted_at IS NULL`,
          [body.business_type_id],
        );
        if (!btRows[0]) throw new NotFoundException("業務内容が見つかりません");
        if (btRows[0].client_id !== newClientId) {
          throw new BadRequestException(
            "選択した業務内容はこの現場の顧客では使えません",
          );
        }
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (provided("site_id")) {
      add("site_id", body.site_id);
      add("client_id", newClientId!); // keep denormalised client_id in sync
    }
    if (provided("business_type_id")) add("business_type_id", body.business_type_id);
    if (provided("count")) add("count", body.count);
    if (provided("memo")) add("memo", body.memo);
    if (provided("image_url")) add("image_url", body.image_url);

    params.push(id);
    await this.ds.query(
      `UPDATE business_reports SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    const rows = await this.ds.query(
      `${this.selectReport(user.role === "admin")} WHERE r.id = $1`,
      [id],
    );
    return { item: rows[0] };
  }

  async delete(user: AuthedUser, id: string) {
    const meta = await this.loadReportMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");

    if (user.role === "employee") {
      if (user.staffId !== meta.staff_id) {
        throw new ForbiddenException("削除権限がありません");
      }
    } else if (user.role !== "admin") {
      throw new ForbiddenException("削除権限がありません");
    }

    // We intentionally don't delete the linked image — the storage layer
    // (Vercel Blob in Phase1, S3 in the post-migration target) is decoupled
    // from the DB. An orphaned object is an acceptable loss; a stuck row is
    // not. The Phase1 implementation does try to call `blob.del()` here, but
    // requires the BLOB_READ_WRITE_TOKEN; this backend isn't configured for
    // Vercel Blob, so we skip that side-effect.
    await this.ds.query(`DELETE FROM business_reports WHERE id = $1`, [id]);
  }

  // ----- helpers -----

  private async loadReportMeta(id: string) {
    const rows: Array<{ id: string; staff_id: string; reported_at: Date }> =
      await this.ds.query(
        `SELECT id, staff_id, reported_at FROM business_reports WHERE id = $1`,
        [id],
      );
    return rows[0] ?? null;
  }

  /** Inline port of Phase1 `canAccessStaff`. */
  private async canAccessStaff(user: AuthedUser, staffId: string): Promise<boolean> {
    if (user.role === "admin") return true;
    if (user.role === "employee") return user.staffId === staffId;
    // manager: target staff must be in user's department
    const rows: Array<{ exists: boolean }> = await this.ds.query(
      `SELECT EXISTS (
         SELECT 1 FROM staffs
          WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL
       ) AS exists`,
      [staffId, user.departmentId],
    );
    return rows[0]?.exists ?? false;
  }

  /**
   * Resolve the image-proxy access check. Throws 404 / 403 — on success
   * returns a row whose `image_url` is guaranteed non-null.
   */
  async loadImageMeta(
    user: AuthedUser,
    id: string,
  ): Promise<{ staff_id: string; image_url: string }> {
    const rows: Array<{ staff_id: string; image_url: string | null }> =
      await this.ds.query(
        `SELECT staff_id, image_url FROM business_reports WHERE id = $1`,
        [id],
      );
    const row = rows[0];
    if (!row) throw new NotFoundException("対象が見つかりません");
    if (!row.image_url) throw new NotFoundException("画像がありません");
    if (!(await this.canAccessStaff(user, row.staff_id))) {
      throw new ForbiddenException("閲覧権限がありません");
    }
    return { staff_id: row.staff_id, image_url: row.image_url };
  }
}
