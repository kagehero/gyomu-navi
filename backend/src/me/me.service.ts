import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import {
  visibleBusinessLineIds,
  visibleClientIdsForLine,
  visibleSiteIdsForClient,
} from "../lib/reports/scoping";
import type { AuthedUser } from "../auth/types";
import type {
  ChangePasswordDto,
  MeBusinessTypesQueryDto,
  MeClientsQueryDto,
  MeSitesQueryDto,
  MeVehiclesQueryDto,
} from "./dto";

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Port of Phase1 `/api/me/*` endpoints — per-user filtered views for the
 * reporting/punch flows. Scoping helpers are reused from
 * `lib/reports/scoping.ts` so admin/manager/employee see exactly what the
 * legacy stack served.
 */
@Injectable()
export class MeService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async sites(user: AuthedUser, q: MeSitesQueryDto) {
    if (q.client_id) {
      const allowed = await visibleSiteIdsForClient(this.ds, user, q.client_id);
      if (allowed !== null && allowed.length === 0) {
        return { items: [] };
      }
      const params: unknown[] = [q.client_id];
      let filter = "";
      if (allowed !== null) {
        params.push(allowed);
        filter = ` AND s.id = ANY($${params.length}::uuid[])`;
      }
      const items = await this.ds.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.is_billing_branch
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
          WHERE s.client_id = $1 AND s.deleted_at IS NULL ${filter}
          ORDER BY s.name`,
        params,
      );
      return { items };
    }

    if (user.role === "admin") {
      const items = await this.ds.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
                s.radius_m, s.is_billing_branch
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
          WHERE s.deleted_at IS NULL
          ORDER BY c.code, s.name`,
      );
      return { items };
    }

    if (user.role === "employee") {
      const items = await this.ds.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
                s.radius_m, s.is_billing_branch
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
           JOIN staff_client_assigns sca ON sca.client_id = s.client_id
          WHERE s.deleted_at IS NULL AND sca.staff_id = $1
          ORDER BY c.code, s.name`,
        [user.staffId],
      );
      return { items };
    }

    // manager
    const items = await this.ds.query(
      `SELECT s.id, s.client_id, c.name AS client_name, s.name,
              s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
              s.radius_m, s.is_billing_branch
         FROM sites s
         JOIN client_companies c ON c.id = s.client_id
        WHERE s.deleted_at IS NULL
          AND s.client_id IN (
            SELECT sca.client_id
              FROM staff_client_assigns sca
              JOIN staffs st ON st.id = sca.staff_id
             WHERE st.department_id = $1 AND st.deleted_at IS NULL
          )
        ORDER BY c.code, s.name`,
      [user.departmentId],
    );
    return { items };
  }

  async businessLines(user: AuthedUser) {
    const allowed = await visibleBusinessLineIds(this.ds, user);

    const params: unknown[] = [];
    let where = `bl.deleted_at IS NULL`;
    if (allowed !== null) {
      if (allowed.length === 0) return { items: [] };
      params.push(allowed);
      where += ` AND bl.id = ANY($${params.length}::uuid[])`;
    }

    const clientCountSql =
      user.role === "employee" && user.staffId
        ? `, (
             SELECT COUNT(DISTINCT sca.client_id)::int
               FROM staff_client_assigns sca
               JOIN client_business_lines cbl
                 ON cbl.client_id = sca.client_id AND cbl.business_line_id = bl.id
              WHERE sca.staff_id = $${params.length + 1}
           ) AS client_count`
        : "";

    if (user.role === "employee" && user.staffId) {
      params.push(user.staffId);
    }

    const items = await this.ds.query(
      `SELECT bl.id, bl.name, bl.sort_order${clientCountSql}
         FROM business_lines bl
        WHERE ${where}
        ORDER BY bl.sort_order, bl.name`,
      params,
    );
    return { items };
  }

  async clients(user: AuthedUser, q: MeClientsQueryDto) {
    const allowed = await visibleClientIdsForLine(this.ds, user, q.business_line_id);

    const params: unknown[] = [q.business_line_id];
    let clientFilter = "";
    if (allowed !== null) {
      if (allowed.length === 0) return { items: [] };
      params.push(allowed);
      clientFilter = ` AND c.id = ANY($${params.length}::uuid[])`;
    }

    const items = await this.ds.query(
      `SELECT c.id, c.name, c.code,
              (SELECT COUNT(*)::int FROM sites s
                WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS site_count
         FROM client_companies c
         JOIN client_business_lines cbl ON cbl.client_id = c.id
        WHERE cbl.business_line_id = $1
          AND c.deleted_at IS NULL
          ${clientFilter}
        ORDER BY c.name`,
      params,
    );
    return { items };
  }

  async businessTypes(user: AuthedUser, q: MeBusinessTypesQueryDto) {
    const allowedClients = await visibleClientIdsForLine(
      this.ds,
      user,
      q.business_line_id,
    );
    if (allowedClients !== null && !allowedClients.includes(q.client_id)) {
      return { items: [] };
    }

    const params: unknown[] = [q.client_id, q.business_line_id];
    let siteFilter: string;
    if (q.site_id) {
      params.push(q.site_id);
      siteFilter = ` AND (bt.site_id IS NULL OR bt.site_id = $3)`;
    } else {
      siteFilter = ` AND bt.site_id IS NULL`;
    }

    const priceCols =
      user.role === "admin"
        ? `, bt.unit_price_excl::float8 AS unit_price_excl
           , bt.unit_price_incl::float8 AS unit_price_incl`
        : "";

    const staffFilter =
      user.role === "employee" ? ` AND bt.staff_enterable = true` : "";

    const items = await this.ds.query(
      `SELECT bt.id, bt.client_id, c.name AS client_name, bt.site_id, bt.name,
              bt.input_unit, bt.vehicle_select_mode, bt.line_memo_fields
              ${priceCols}
         FROM business_types bt
         JOIN client_companies c ON c.id = bt.client_id
        WHERE bt.deleted_at IS NULL
          AND bt.client_id = $1
          AND (bt.business_line_id IS NULL OR bt.business_line_id = $2)
          ${siteFilter}
          ${staffFilter}
        ORDER BY bt.name`,
      params,
    );
    return { items };
  }

  async vehicles(user: AuthedUser, q: MeVehiclesQueryDto) {
    if (q.business_line_id) {
      const allowedClients = await visibleClientIdsForLine(
        this.ds,
        user,
        q.business_line_id,
      );
      if (allowedClients !== null && !allowedClients.includes(q.client_id)) {
        return { items: [] };
      }
    }

    const items = await this.ds.query(
      `SELECT v.id, v.station_name, v.vehicle_label, v.surcharge_label,
              vl.id AS vehicle_list_id, vl.name AS vehicle_list_name
         FROM vehicles v
         JOIN vehicle_lists vl ON vl.id = v.vehicle_list_id
        WHERE vl.client_id = $1
        ORDER BY vl.name, v.sort_order, v.vehicle_label`,
      [q.client_id],
    );
    return { items };
  }

  /**
   * Self-service password change for any logged-in user. Verifies the
   * supplied current password against the stored hash before writing the
   * new one, so a stolen session alone can't silently rotate credentials.
   */
  async changePassword(user: AuthedUser, body: ChangePasswordDto) {
    const rows = await this.ds.query(
      `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [user.id],
    );
    const row = rows[0] as { password_hash: string } | undefined;
    if (!row) {
      throw new UnauthorizedException("ユーザーが見つかりません");
    }

    const ok = await bcrypt.compare(body.current_password, row.password_hash);
    if (!ok) {
      throw new BadRequestException("現在のパスワードが正しくありません");
    }

    const samePassword = await bcrypt.compare(body.new_password, row.password_hash);
    if (samePassword) {
      throw new BadRequestException("新しいパスワードは現在のパスワードと異なるものにしてください");
    }

    const newHash = await bcrypt.hash(body.new_password, BCRYPT_SALT_ROUNDS);
    await this.ds.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [newHash, user.id],
    );
    return { ok: true };
  }
}
