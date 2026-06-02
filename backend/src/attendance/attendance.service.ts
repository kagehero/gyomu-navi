import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { jstWorkDate, staffScopeWhere } from "../auth/scope";
import type { AuthedUser } from "../auth/types";
import { haversineMeters } from "../lib/geo";
import type {
  AttendanceCreateDto,
  AttendanceListQueryDto,
  AttendancePatchDto,
  AttendanceStatsQueryDto,
  PunchInDto,
  PunchOutDto,
} from "./dto";

/**
 * Port of Phase1's `/api/attendance(/punch-in|/punch-out|/stats|/today|/[id])?`
 * route handlers. SQL is preserved verbatim — response shape, ordering and
 * role scoping match the legacy implementation.
 */
@Injectable()
export class AttendanceService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(user: AuthedUser, q: AttendanceListQueryDto) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (q.date) {
      params.push(q.date);
      conditions.push(`al.work_date = $${params.length}`);
    } else {
      if (q.from) {
        params.push(q.from);
        conditions.push(`al.work_date >= $${params.length}`);
      }
      if (q.to) {
        params.push(q.to);
        conditions.push(`al.work_date <= $${params.length}`);
      }
    }
    if (q.staff_id) {
      params.push(q.staff_id);
      conditions.push(`al.staff_id = $${params.length}`);
    }
    if (q.site_id) {
      params.push(q.site_id);
      conditions.push(`al.site_id = $${params.length}`);
    }

    const scope = staffScopeWhere(user, "al.staff_id", params.length);
    params.push(...scope.params);

    const where = [conditions.join(" AND "), scope.sql.replace(/^ AND /, "")]
      .filter(Boolean)
      .join(" AND ");

    const items = await this.ds.query(
      `SELECT al.id, al.staff_id, s.name AS staff_name,
              al.site_id, st.name AS site_name,
              al.work_date, al.punch_in_at, al.punch_out_at, al.status,
              al.punch_in_lat::float8  AS punch_in_lat,
              al.punch_in_lng::float8  AS punch_in_lng,
              al.punch_out_lat::float8 AS punch_out_lat,
              al.punch_out_lng::float8 AS punch_out_lng
         FROM attendance_logs al
         JOIN staffs s  ON s.id  = al.staff_id
         JOIN sites  st ON st.id = al.site_id
        ${where ? "WHERE " + where : ""}
        ORDER BY al.work_date DESC, al.punch_in_at DESC
        LIMIT 500`,
      params,
    );
    return { items };
  }

  async stats(user: AuthedUser, q: AttendanceStatsQueryDto) {
    const workDate = q.date ?? jstWorkDate();

    const totalScope = staffScopeWhere(user, "s.id", 0);
    const totalRows: Array<{ total: string | number }> = await this.ds.query(
      `SELECT count(*)::int AS total
         FROM staffs s
        WHERE s.deleted_at IS NULL
        ${totalScope.sql}`,
      totalScope.params,
    );
    const total = Number(totalRows[0]?.total ?? 0);

    const attScope = staffScopeWhere(user, "al.staff_id", 1);
    const params: unknown[] = [workDate, ...attScope.params];
    const rows: Array<{ status: "working" | "done" | "absent"; c: string | number }> =
      await this.ds.query(
        `SELECT al.status, count(*)::int AS c
           FROM attendance_logs al
          WHERE al.work_date = $1
          ${attScope.sql}
          GROUP BY al.status`,
        params,
      );
    const counts = { working: 0, done: 0, absent: 0 };
    for (const r of rows) counts[r.status] = Number(r.c);
    const present = counts.working + counts.done;
    const absent = Math.max(0, total - present);

    return {
      work_date: workDate,
      total,
      present,
      working: counts.working,
      done: counts.done,
      late: 0, // Phase1: no late detection
      absent,
    };
  }

  async today(user: AuthedUser) {
    if (user.role !== "employee" || !user.staffId) {
      throw new ForbiddenException("従業員アカウントでのみ参照できます");
    }
    const workDate = jstWorkDate();
    const rows = await this.ds.query(
      `SELECT al.id, al.staff_id, al.site_id, st.name AS site_name,
              al.work_date, al.punch_in_at, al.punch_out_at, al.status,
              al.punch_in_lat::float8  AS punch_in_lat,
              al.punch_in_lng::float8  AS punch_in_lng,
              al.punch_out_lat::float8 AS punch_out_lat,
              al.punch_out_lng::float8 AS punch_out_lng
         FROM attendance_logs al
         JOIN sites st ON st.id = al.site_id
        WHERE al.staff_id = $1 AND al.work_date = $2`,
      [user.staffId, workDate],
    );
    return { item: rows[0] ?? null, work_date: workDate };
  }

  async punchIn(user: AuthedUser, body: PunchInDto) {
    if (user.role !== "employee" || !user.staffId) {
      throw new ForbiddenException("従業員アカウントでのみ打刻できます");
    }

    // 1) Site must exist and be one of the user's assigned sites.
    const siteRows: Array<{
      latitude: number;
      longitude: number;
      radius_m: number;
      assigned: boolean;
    }> = await this.ds.query(
      `SELECT s.latitude::float8  AS latitude,
              s.longitude::float8 AS longitude,
              s.radius_m,
              EXISTS (
                SELECT 1 FROM staff_client_assigns sca
                 WHERE sca.client_id = s.client_id AND sca.staff_id = $2
              ) AS assigned
         FROM sites s
        WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [body.site_id, user.staffId],
    );
    const site = siteRows[0];
    if (!site) throw new NotFoundException("現場が見つかりません");
    if (!site.assigned) {
      throw new ForbiddenException("この現場には配属されていません");
    }

    // 2) GPS distance check against the configured radius.
    const distanceM = haversineMeters(
      site.latitude,
      site.longitude,
      body.latitude,
      body.longitude,
    );
    if (distanceM > site.radius_m) {
      throw new BadRequestException({
        error: `現場から ${Math.round(distanceM)}m 離れています（許容: ${site.radius_m}m）`,
        code: "out_of_range",
      });
    }

    // 3) Insert. UNIQUE(staff_id, work_date) catches double punch-in.
    const workDate = jstWorkDate();
    const now = new Date().toISOString();
    try {
      const rows = await this.ds.query(
        `INSERT INTO attendance_logs
           (staff_id, site_id, work_date, punch_in_at, status,
            punch_in_lat, punch_in_lng)
         VALUES ($1, $2, $3, $4, 'working', $5, $6)
         RETURNING id, staff_id, site_id, work_date, punch_in_at,
                   punch_out_at, status,
                   punch_in_lat::float8  AS punch_in_lat,
                   punch_in_lng::float8  AS punch_in_lng,
                   punch_out_lat::float8 AS punch_out_lat,
                   punch_out_lng::float8 AS punch_out_lng`,
        [user.staffId, body.site_id, workDate, now, body.latitude, body.longitude],
      );
      return { item: rows[0] };
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException("本日は既に出勤打刻されています");
      }
      throw err;
    }
  }

  async punchOut(user: AuthedUser, body: PunchOutDto) {
    if (user.role !== "employee" || !user.staffId) {
      throw new ForbiddenException("従業員アカウントでのみ打刻できます");
    }
    const workDate = jstWorkDate();
    const now = new Date().toISOString();
    const rows = await this.ds.query(
      `UPDATE attendance_logs
          SET punch_out_at  = $1,
              status        = 'done',
              punch_out_lat = $2,
              punch_out_lng = $3
        WHERE staff_id = $4
          AND work_date = $5
          AND punch_out_at IS NULL
        RETURNING id, staff_id, site_id, work_date, punch_in_at, punch_out_at,
                  status,
                  punch_in_lat::float8  AS punch_in_lat,
                  punch_in_lng::float8  AS punch_in_lng,
                  punch_out_lat::float8 AS punch_out_lat,
                  punch_out_lng::float8 AS punch_out_lng`,
      [now, body.latitude ?? null, body.longitude ?? null, user.staffId, workDate],
    );
    if (!rows[0]) {
      throw new NotFoundException("本日の未退勤の出勤打刻が見つかりません");
    }
    return { item: rows[0] };
  }

  async createByAdmin(body: AttendanceCreateDto) {
    const rows = await this.ds.query(
      `WITH inserted AS (
         INSERT INTO attendance_logs
           (staff_id, site_id, work_date, punch_in_at, punch_out_at, status,
            punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, staff_id, site_id, work_date, punch_in_at, punch_out_at,
                   status, punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng
       )
       SELECT i.id, i.staff_id, s.name AS staff_name,
              i.site_id, st.name AS site_name,
              i.work_date, i.punch_in_at, i.punch_out_at, i.status,
              i.punch_in_lat::float8  AS punch_in_lat,
              i.punch_in_lng::float8  AS punch_in_lng,
              i.punch_out_lat::float8 AS punch_out_lat,
              i.punch_out_lng::float8 AS punch_out_lng
         FROM inserted i
         JOIN staffs s  ON s.id  = i.staff_id
         JOIN sites  st ON st.id = i.site_id`,
      [
        body.staff_id, body.site_id, body.work_date,
        body.punch_in_at, body.punch_out_at ?? null, body.status,
        body.punch_in_lat ?? null, body.punch_in_lng ?? null,
        body.punch_out_lat ?? null, body.punch_out_lng ?? null,
      ],
    );
    return { item: rows[0] };
  }

  async patchByAdmin(id: string, body: AttendancePatchDto) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (body.site_id !== undefined) add("site_id", body.site_id);
    if (body.punch_in_at !== undefined) add("punch_in_at", body.punch_in_at);
    if (body.punch_out_at !== undefined) add("punch_out_at", body.punch_out_at);
    if (body.status !== undefined) add("status", body.status);
    if (body.punch_in_lat !== undefined) add("punch_in_lat", body.punch_in_lat);
    if (body.punch_in_lng !== undefined) add("punch_in_lng", body.punch_in_lng);
    if (body.punch_out_lat !== undefined) add("punch_out_lat", body.punch_out_lat);
    if (body.punch_out_lng !== undefined) add("punch_out_lng", body.punch_out_lng);
    if (!sets.length) {
      throw new BadRequestException("更新する項目を指定してください");
    }
    params.push(id);

    const rows = await this.ds.query(
      `WITH updated AS (
         UPDATE attendance_logs
            SET ${sets.join(", ")}
          WHERE id = $${params.length}
          RETURNING id, staff_id, site_id, work_date, punch_in_at, punch_out_at,
                    status, punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng
       )
       SELECT u.id, u.staff_id, s.name AS staff_name,
              u.site_id, st.name AS site_name,
              u.work_date, u.punch_in_at, u.punch_out_at, u.status,
              u.punch_in_lat::float8  AS punch_in_lat,
              u.punch_in_lng::float8  AS punch_in_lng,
              u.punch_out_lat::float8 AS punch_out_lat,
              u.punch_out_lng::float8 AS punch_out_lng
         FROM updated u
         JOIN staffs s  ON s.id  = u.staff_id
         JOIN sites  st ON st.id = u.site_id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
    return { item: rows[0] };
  }

  async deleteByAdmin(id: string): Promise<void> {
    // RETURNING lets us tell "deleted 0 rows" from "deleted 1" without
    // relying on driver-specific rowCount handling.
    const rows = await this.ds.query(
      `DELETE FROM attendance_logs WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new NotFoundException("対象が見つかりません");
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    );
  }
}
