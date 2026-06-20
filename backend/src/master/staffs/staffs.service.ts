import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryRunner } from "typeorm";
import { firstQueryRow, queryRows } from "../../database/query-rows";
import type { PatchStaffDto } from "./dto";

/**
 * Staff master with M:N to clients (`staff_client_assigns`) and
 * business_lines (`staff_business_line_assigns`), plus a 1:1 link to
 * `users.staff_id` for employee login state.
 *
 * Heavy port of Phase1 `/api/master/staffs(/[id])?` — kept SQL byte-equal
 * because the approval flow depends on the exact aggregate counts and the
 * "list only staff that have an employee user" filter.
 */
@Injectable()
export class StaffsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list() {
    const items = await this.ds.query(
      `SELECT s.id, s.name, s.hourly_rate,
              s.department_id, d.name AS department_name,
              COALESCE(
                ARRAY_AGG(DISTINCT sca.client_id) FILTER (WHERE sca.client_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS client_ids,
              COALESCE(
                ARRAY_AGG(DISTINCT sbla.business_line_id) FILTER (WHERE sbla.business_line_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS business_line_ids,
              MAX(u.email) AS login_email,
              MAX(u.login_approved_at) AS login_approved_at
         FROM staffs s
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN staff_client_assigns sca ON sca.staff_id = s.id
    LEFT JOIN staff_business_line_assigns sbla ON sbla.staff_id = s.id
    LEFT JOIN users u ON u.staff_id = s.id
                      AND u.app_role = 'employee'
                      AND u.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM users u2
             WHERE u2.staff_id = s.id
               AND u2.app_role = 'employee'
               AND u2.deleted_at IS NULL
          )
     GROUP BY s.id, d.name
     ORDER BY (MAX(u.login_approved_at) IS NULL) DESC, s.name`,
    );
    return { items };
  }

  /**
   * Phase1 returns 400 on POST — staff rows are created via employee
   * self-registration only. We keep the same behavior for parity.
   */
  rejectCreate(): never {
    throw new BadRequestException(
      "従業員は「従業員アカウント登録」ページからログイン情報を登録してください。承認はスタッフ一覧から行います。",
    );
  }

  async patch(id: string, body: PatchStaffDto) {
    if (Object.values(body).every((v) => v === undefined)) {
      throw new BadRequestException("更新する項目を指定してください");
    }
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const before = await this.loadApprovalState(qr, id);
      if (!before) {
        await qr.rollbackTransaction();
        throw new NotFoundException("対象が見つかりません");
      }

      const staffRows = await qr.query(
        `UPDATE staffs
            SET name          = COALESCE($1, name),
                department_id = COALESCE($2, department_id),
                hourly_rate   = COALESCE($3, hourly_rate)
          WHERE id = $4 AND deleted_at IS NULL
          RETURNING id, name, department_id, hourly_rate`,
        [body.name ?? null, body.department_id ?? null, body.hourly_rate ?? null, id],
      );
      const staff = firstQueryRow<{
        id: string;
        name: string;
        department_id: string | null;
        hourly_rate: number;
      }>(staffRows);
      if (!staff) {
        await qr.rollbackTransaction();
        throw new NotFoundException("対象が見つかりません");
      }
      const displayName = body.name ?? staff.name;

      if (body.name !== undefined) {
        await qr.query(
          `UPDATE users SET display_name = $1
            WHERE staff_id = $2 AND app_role = 'employee' AND deleted_at IS NULL`,
          [displayName, id],
        );
      }

      if (body.client_ids !== undefined) {
        await qr.query(`DELETE FROM staff_client_assigns WHERE staff_id = $1`, [id]);
        if (body.client_ids.length > 0) {
          await qr.query(
            `INSERT INTO staff_client_assigns (staff_id, client_id)
             SELECT $1, client_id FROM UNNEST($2::uuid[]) AS client_id`,
            [id, body.client_ids],
          );
        }
      }
      if (body.business_line_ids !== undefined) {
        await qr.query(`DELETE FROM staff_business_line_assigns WHERE staff_id = $1`, [id]);
        if (body.business_line_ids.length > 0) {
          await qr.query(
            `INSERT INTO staff_business_line_assigns (staff_id, business_line_id)
             SELECT $1, bl_id FROM UNNEST($2::uuid[]) AS bl_id`,
            [id, body.business_line_ids],
          );
        }
      }

      if (body.approve) {
        const after = await this.loadApprovalState(qr, id);
        if (!after) {
          await qr.rollbackTransaction();
          throw new NotFoundException("対象が見つかりません");
        }
        if (after.login_approved_at) {
          await qr.rollbackTransaction();
          throw new BadRequestException("すでに承認済みです");
        }
        if (!staff.department_id) {
          await qr.rollbackTransaction();
          throw new BadRequestException("社内部門を設定してください");
        }
        if (Number(after.client_count) < 1) {
          await qr.rollbackTransaction();
          throw new BadRequestException("担当顧客を1件以上設定してください");
        }
        if (Number(after.business_line_count) < 1) {
          await qr.rollbackTransaction();
          throw new BadRequestException("担当部門を1件以上設定してください");
        }
        await qr.query(
          `UPDATE users SET login_approved_at = now()
            WHERE staff_id = $1 AND app_role = 'employee' AND deleted_at IS NULL`,
          [id],
        );
      }

      const aggRows = queryRows<{
        department_name: string | null;
        client_ids: string[];
        business_line_ids: string[];
        login_email: string | null;
        login_approved_at: string | null;
      }>(await qr.query(
        `SELECT d.name AS department_name,
                COALESCE(
                  ARRAY_AGG(DISTINCT sca.client_id) FILTER (WHERE sca.client_id IS NOT NULL),
                  ARRAY[]::uuid[]
                ) AS client_ids,
                COALESCE(
                  ARRAY_AGG(DISTINCT sbla.business_line_id) FILTER (WHERE sbla.business_line_id IS NOT NULL),
                  ARRAY[]::uuid[]
                ) AS business_line_ids,
                MAX(u.email) AS login_email,
                MAX(u.login_approved_at) AS login_approved_at
           FROM staffs s
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN staff_client_assigns sca ON sca.staff_id = s.id
      LEFT JOIN staff_business_line_assigns sbla ON sbla.staff_id = s.id
      LEFT JOIN users u ON u.staff_id = s.id
                        AND u.app_role = 'employee'
                        AND u.deleted_at IS NULL
          WHERE s.id = $1
       GROUP BY d.name`,
        [id],
      ));

      await qr.commitTransaction();
      return { item: { ...staff, ...aggRows[0] } };
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Bulk-approve employee logins (顧客要望: 一名ずつの承認は手間がかかる).
   *
   * Approval has the same prerequisites as the single-staff path: a department,
   * at least one assigned client, and at least one assigned business line. We
   * approve only the rows that already satisfy them and report the rest as
   * `skipped` with a reason, so the admin can tell which still need setup
   * rather than the whole batch failing. The whole pass runs in one
   * transaction.
   */
  async bulkApprove(ids: string[]) {
    const approved: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const id of ids) {
        const state = await this.loadApprovalState(qr, id);
        if (!state) {
          skipped.push({ id, reason: "対象が見つかりません" });
          continue;
        }
        if (state.login_approved_at) {
          skipped.push({ id, reason: "すでに承認済みです" });
          continue;
        }
        if (!state.department_id) {
          skipped.push({ id, reason: "社内部門が未設定です" });
          continue;
        }
        if (Number(state.client_count) < 1) {
          skipped.push({ id, reason: "担当顧客が未設定です" });
          continue;
        }
        if (Number(state.business_line_count) < 1) {
          skipped.push({ id, reason: "担当部門が未設定です" });
          continue;
        }
        await qr.query(
          `UPDATE users SET login_approved_at = now()
            WHERE staff_id = $1 AND app_role = 'employee' AND deleted_at IS NULL`,
          [id],
        );
        approved.push(id);
      }
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return { approved, skipped };
  }

  async softDelete(id: string) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const rows = await qr.query(
        `UPDATE staffs SET deleted_at = now()
          WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [id],
      );
      if (!firstQueryRow<{ id: string }>(rows)) {
        await qr.rollbackTransaction();
        throw new NotFoundException("対象が見つかりません");
      }
      await qr.query(
        `UPDATE users SET deleted_at = now()
          WHERE staff_id = $1 AND app_role = 'employee' AND deleted_at IS NULL`,
        [id],
      );
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async loadApprovalState(qr: QueryRunner, id: string) {
    const rows: Array<{
      login_approved_at: string | null;
      login_email: string | null;
      department_id: string | null;
      client_count: number | string;
      business_line_count: number | string;
    }> = await qr.query(
      `SELECT u.login_approved_at,
              u.email AS login_email,
              s.department_id,
              (SELECT count(*)::int FROM staff_client_assigns sca WHERE sca.staff_id = s.id) AS client_count,
              (SELECT count(*)::int FROM staff_business_line_assigns sbla WHERE sbla.staff_id = s.id) AS business_line_count
         FROM staffs s
         JOIN users u ON u.staff_id = s.id
                      AND u.app_role = 'employee'
                      AND u.deleted_at IS NULL
        WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }
}
