import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { AuthedUser } from "../../auth/types";
import {
  assertWorkDateNotFuture,
  insertReportSession,
  replaceReportSession,
  resolveSubmitStaffId,
  validateAndExpandSession,
  type CreateSessionInput,
} from "../../lib/reports/session";
import type {
  CreateSessionDto,
  ListSessionsQueryDto,
  SaveDraftDto,
  UpdateSessionDto,
} from "./dto";

/**
 * Port of Phase1 `/api/reports/sessions(/[id])?`. Heavy: the create/update
 * paths run inside a TypeORM transaction, validate + auto-bill via shared
 * helpers in `lib/reports/`, and then re-load aggregated rows for the response.
 */
@Injectable()
export class ReportSessionsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(user: AuthedUser, q: ListSessionsQueryDto) {
    const params: unknown[] = [];
    // Drafts (一時保存) are work-in-progress and must not appear in the
    // submitted-report history.
    const conds: string[] = [`rs.status = 'submitted'`];

    if (user.role === "employee") {
      if (!user.staffId) return { items: [] };
      params.push(user.staffId);
      conds.push(`rs.staff_id = $${params.length}`);
    } else if (user.role === "manager") {
      params.push(user.departmentId);
      conds.push(`rs.staff_id IN (
        SELECT id FROM staffs WHERE department_id = $${params.length} AND deleted_at IS NULL
      )`);
    }

    if (q.work_date) {
      params.push(q.work_date);
      conds.push(`rs.work_date = $${params.length}::date`);
    }
    if (q.business_line_id) {
      params.push(q.business_line_id);
      conds.push(`rs.business_line_id = $${params.length}`);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const items = await this.ds.query(
      `SELECT rs.id, rs.staff_id, st.name AS staff_name,
              rs.work_date::text, rs.business_line_id, bl.name AS business_line_name,
              rs.memo, rs.report_kind, rs.submitted_at,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', r.id,
                  'client_id', r.client_id,
                  'client_name', cc.name,
                  'site_id', r.site_id,
                  'site_name', si.name,
                  'business_type_id', r.business_type_id,
                  'business_type_name', bt.name,
                  'count', r.count,
                  'image_url', r.image_url
                ) ORDER BY cc.name, si.name, bt.name)
                 FROM business_reports r
                 JOIN client_companies cc ON cc.id = r.client_id
                 JOIN sites si ON si.id = r.site_id
                 JOIN business_types bt ON bt.id = r.business_type_id
                WHERE r.session_id = rs.id),
                '[]'::json
              ) AS entries
         FROM report_sessions rs
         JOIN business_lines bl ON bl.id = rs.business_line_id
         JOIN staffs st ON st.id = rs.staff_id
        ${where}
        ORDER BY rs.work_date DESC, rs.submitted_at DESC
        LIMIT 100`,
      params,
    );
    return { items };
  }

  async create(user: AuthedUser, body: CreateSessionDto) {
    const staffId = resolveSubmitStaffId(user, body.staff_id);

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const entries = await validateAndExpandSession(qr, user, staffId, body);
      const sessionId = await insertReportSession(qr, staffId, body, entries);
      await qr.commitTransaction();

      const rows = await this.ds.query(
        `SELECT rs.id, rs.work_date::text, rs.memo, rs.submitted_at,
                (SELECT COUNT(*)::int FROM business_reports WHERE session_id = rs.id) AS entry_count
           FROM report_sessions rs WHERE rs.id = $1`,
        [sessionId],
      );
      return { item: rows[0] };
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async detail(user: AuthedUser, id: string) {
    const session = await this.loadSession(id);
    if (!session) throw new NotFoundException("対象が見つかりません");
    if (!(await this.canAccessStaff(user, session.staff_id))) {
      throw new ForbiddenException("閲覧権限がありません");
    }

    const entries = await this.ds.query(
      `SELECT r.id, r.client_id, cc.name AS client_name,
              r.site_id, si.name AS site_name,
              r.business_type_id, bt.name AS business_type_name, r.count,
              r.vehicle_id, v.vehicle_label AS vehicle_label,
              r.line_memo, r.auto_generated
         FROM business_reports r
         JOIN client_companies cc ON cc.id = r.client_id
         JOIN sites si ON si.id = r.site_id
         JOIN business_types bt ON bt.id = r.business_type_id
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
        WHERE r.session_id = $1
          AND (r.auto_generated = false OR $2 = 'admin')
        ORDER BY cc.name, si.name, bt.name`,
      [id, user.role],
    );

    return { item: { ...session, entries } };
  }

  async update(user: AuthedUser, id: string, body: UpdateSessionDto) {
    const session = await this.loadSession(id);
    if (!session) throw new NotFoundException("対象が見つかりません");

    if (user.role === "employee") {
      if (user.staffId !== session.staff_id) {
        throw new ForbiddenException("編集権限がありません");
      }
    } else if (user.role === "manager") {
      if (!(await this.canAccessStaff(user, session.staff_id))) {
        throw new ForbiddenException("編集権限がありません");
      }
    }

    const input: CreateSessionInput = {
      work_date: body.work_date,
      business_line_id: body.business_line_id,
      memo: body.memo,
      customer_blocks: body.customer_blocks,
      staff_id: session.staff_id,
      session_id: id,
      report_kind: body.report_kind,
    };

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const entries = await validateAndExpandSession(qr, user, session.staff_id, input);
      await replaceReportSession(qr, id, session.staff_id, input, entries);
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const updated = await this.loadSession(id);
    return { item: updated };
  }

  async remove(user: AuthedUser, id: string) {
    const session = await this.loadSession(id);
    if (!session) throw new NotFoundException("対象が見つかりません");

    if (user.role === "employee") {
      if (user.staffId !== session.staff_id) {
        throw new ForbiddenException("削除権限がありません");
      }
    } else if (user.role === "manager") {
      throw new ForbiddenException("削除権限がありません");
    } else if (user.role !== "admin") {
      throw new ForbiddenException("削除権限がありません");
    }

    await this.ds.query(`DELETE FROM business_reports WHERE session_id = $1`, [id]);
    await this.ds.query(`DELETE FROM report_sessions WHERE id = $1`, [id]);
  }

  // ----- drafts (一時保存) -----

  /**
   * Upsert the single draft for this staff/day/business_line. Stores the raw
   * form snapshot as JSONB and creates NO business_reports rows, so drafts stay
   * out of analytics. Relies on the partial unique index from migration 016.
   */
  async saveDraft(user: AuthedUser, body: SaveDraftDto) {
    const staffId = resolveSubmitStaffId(user, body.staff_id);
    assertWorkDateNotFuture(body.work_date);

    const rows: Array<{ id: string }> = await this.ds.query(
      `INSERT INTO report_sessions
         (staff_id, work_date, business_line_id, status, draft_payload, submitted_at)
       VALUES ($1, $2::date, $3, 'draft', $4::jsonb, now())
       ON CONFLICT (staff_id, work_date, business_line_id) WHERE status = 'draft'
       DO UPDATE SET draft_payload = EXCLUDED.draft_payload, updated_at = now()
       RETURNING id`,
      [staffId, body.work_date, body.business_line_id, JSON.stringify(body.payload)],
    );
    return { item: { id: rows[0]!.id, saved_at: new Date().toISOString() } };
  }

  /** Fetch the current draft for staff/day/business_line, or null. */
  async getDraft(user: AuthedUser, workDate: string, businessLineId: string) {
    const staffId = resolveSubmitStaffId(user);
    const rows: Array<{ id: string; draft_payload: Record<string, unknown> }> =
      await this.ds.query(
        `SELECT id, draft_payload
           FROM report_sessions
          WHERE staff_id = $1 AND work_date = $2::date
            AND business_line_id = $3 AND status = 'draft'
          LIMIT 1`,
        [staffId, workDate, businessLineId],
      );
    const row = rows[0];
    return { item: row ? { id: row.id, payload: row.draft_payload } : null };
  }

  /** Discard the draft for staff/day/business_line (e.g. after submit). */
  async deleteDraft(user: AuthedUser, workDate: string, businessLineId: string) {
    const staffId = resolveSubmitStaffId(user);
    await this.ds.query(
      `DELETE FROM report_sessions
        WHERE staff_id = $1 AND work_date = $2::date
          AND business_line_id = $3 AND status = 'draft'`,
      [staffId, workDate, businessLineId],
    );
    return { ok: true };
  }

  // ----- dispatch labour costs (派遣人件費) -----

  /** List dispatch labour costs for a session (access-checked). */
  async listDispatchLabor(user: AuthedUser, sessionId: string) {
    const session = await this.loadSession(sessionId);
    if (!session) throw new NotFoundException("対象が見つかりません");
    if (!(await this.canAccessStaff(user, session.staff_id))) {
      throw new ForbiddenException("閲覧権限がありません");
    }
    const items = await this.ds.query(
      `SELECT id, name, hours::float8 AS hours, labor_cost::float8 AS labor_cost
         FROM dispatch_labor_costs
        WHERE session_id = $1
        ORDER BY created_at`,
      [sessionId],
    );
    return { items };
  }

  /**
   * Replace the full set of dispatch labour costs for a session. The leader
   * enters social派遣 staff (name + hours + cost); these never touch revenue but
   * the analytics P&L subtracts them. Edit follows the same access rules as the
   * session itself.
   */
  async replaceDispatchLabor(
    user: AuthedUser,
    sessionId: string,
    items: Array<{ name: string; hours: number; labor_cost: number }>,
  ) {
    const session = await this.loadSession(sessionId);
    if (!session) throw new NotFoundException("対象が見つかりません");

    if (user.role === "employee") {
      if (user.staffId !== session.staff_id) {
        throw new ForbiddenException("編集権限がありません");
      }
    } else if (user.role === "manager") {
      if (!(await this.canAccessStaff(user, session.staff_id))) {
        throw new ForbiddenException("編集権限がありません");
      }
    } else if (user.role !== "admin") {
      throw new ForbiddenException("編集権限がありません");
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`DELETE FROM dispatch_labor_costs WHERE session_id = $1`, [sessionId]);
      for (const it of items) {
        const name = it.name.trim();
        if (!name) continue;
        await qr.query(
          `INSERT INTO dispatch_labor_costs (session_id, name, hours, labor_cost)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, name, it.hours, it.labor_cost],
        );
      }
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return this.listDispatchLabor(user, sessionId);
  }

  // ----- helpers -----

  private async loadSession(id: string) {
    const rows: Array<{
      id: string;
      staff_id: string;
      work_date: string;
      business_line_id: string;
      business_line_name: string;
      memo: string | null;
      report_kind: "site_total" | "individual";
      submitted_at: Date;
    }> = await this.ds.query(
      `SELECT rs.id, rs.staff_id, rs.work_date::text, rs.business_line_id,
              bl.name AS business_line_name, rs.memo, rs.report_kind, rs.submitted_at
         FROM report_sessions rs
         JOIN business_lines bl ON bl.id = rs.business_line_id
        WHERE rs.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async canAccessStaff(user: AuthedUser, staffId: string): Promise<boolean> {
    if (user.role === "admin") return true;
    if (user.role === "employee") return user.staffId === staffId;
    const rows: Array<{ exists: boolean }> = await this.ds.query(
      `SELECT EXISTS (
         SELECT 1 FROM staffs
          WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL
       ) AS exists`,
      [staffId, user.departmentId],
    );
    return rows[0]?.exists ?? false;
  }
}
