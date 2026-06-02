import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { AuthedUser } from "../auth/types";
import type { CreateNoticeDto, PatchNoticeDto } from "./dto";
import { SELECT_NOTICE_PREFIX, visibilityClause } from "./notice-visibility";

/**
 * Direct port of Phase1 `/api/notices*` route handlers. Visibility scoping,
 * manager restrictions, and read-tracking semantics are all preserved.
 */
@Injectable()
export class NoticesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(user: AuthedUser) {
    const vis = visibilityClause(user, 1);
    const params: unknown[] = [user.id, ...vis.params];
    const items = await this.ds.query(
      `${SELECT_NOTICE_PREFIX}
        WHERE ${vis.sql}
        ORDER BY n.created_at DESC
        LIMIT 500`,
      params,
    );
    return { items };
  }

  async create(user: AuthedUser, body: CreateNoticeDto) {
    if (user.role === "employee") {
      throw new ForbiddenException("通知を作成する権限がありません");
    }

    // Cross-check the target shape; mirrors the legacy zod .refine().
    const ok =
      (body.target_type === "all" &&
        !body.target_department_id &&
        !body.target_user_id) ||
      (body.target_type === "department" &&
        !!body.target_department_id &&
        !body.target_user_id) ||
      (body.target_type === "individual" &&
        !!body.target_user_id &&
        !body.target_department_id);
    if (!ok) {
      throw new BadRequestException("target_type と対象IDが整合していません");
    }

    if (user.role === "manager") {
      if (body.target_type === "all") {
        throw new ForbiddenException("全社向けはマネージャから送信できません");
      }
      if (
        body.target_type === "department" &&
        body.target_department_id !== user.departmentId
      ) {
        throw new ForbiddenException("自部門以外への通知は送信できません");
      }
      if (body.target_type === "individual" && body.target_user_id) {
        const rows: Array<{ in_dept: boolean }> = await this.ds.query(
          `SELECT EXISTS (
             SELECT 1 FROM users u
              LEFT JOIN staffs st ON st.id = u.staff_id
             WHERE u.id = $1
               AND COALESCE(u.department_id, st.department_id) = $2
           ) AS in_dept`,
          [body.target_user_id, user.departmentId],
        );
        if (!rows[0]?.in_dept) {
          throw new ForbiddenException("自部門以外のユーザーには送信できません");
        }
      }
    }

    const inserted: Array<{ id: string }> = await this.ds.query(
      `INSERT INTO notices
         (from_user_id, target_type, target_department_id, target_user_id,
          client_id, title, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        user.id,
        body.target_type,
        body.target_department_id ?? null,
        body.target_user_id ?? null,
        body.client_id ?? null,
        body.title,
        body.body,
      ],
    );
    const newId = inserted[0]!.id;

    const rows = await this.ds.query(
      `${SELECT_NOTICE_PREFIX} WHERE n.id = $2`,
      [user.id, newId],
    );
    return { item: rows[0] };
  }

  async detail(user: AuthedUser, id: string) {
    const vis = visibilityClause(user, 2);
    const params: unknown[] = [user.id, id, ...vis.params];
    const rows = await this.ds.query(
      `${SELECT_NOTICE_PREFIX} WHERE n.id = $2 AND ${vis.sql}`,
      params,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException("対象が見つかりません");

    // Idempotent — primary key (notice_id, user_id) blocks dupes.
    await this.ds.query(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [id, user.id],
    );

    return { item: { ...row, is_read: true } };
  }

  async patch(user: AuthedUser, id: string, body: PatchNoticeDto) {
    const meta = await this.loadMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");
    if (user.role !== "admin" && meta.from_user_id !== user.id) {
      throw new ForbiddenException("編集権限がありません");
    }
    if (body.title === undefined && body.body === undefined) {
      throw new BadRequestException("更新する項目を指定してください");
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (body.title !== undefined) add("title", body.title);
    if (body.body !== undefined) add("body", body.body);
    params.push(id);
    await this.ds.query(
      `UPDATE notices SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    const rows = await this.ds.query(
      `${SELECT_NOTICE_PREFIX} WHERE n.id = $2`,
      [user.id, id],
    );
    return { item: rows[0] };
  }

  async remove(user: AuthedUser, id: string) {
    const meta = await this.loadMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");
    if (user.role !== "admin" && meta.from_user_id !== user.id) {
      throw new ForbiddenException("削除権限がありません");
    }
    await this.ds.query(`DELETE FROM notices WHERE id = $1`, [id]);
  }

  async markRead(user: AuthedUser, id: string) {
    // Only allow if the user can actually see the notice.
    const vis = visibilityClause(user, 1);
    const params: unknown[] = [id, ...vis.params];
    const rows: Array<{ exists: boolean }> = await this.ds.query(
      `SELECT EXISTS (
         SELECT 1 FROM notices n WHERE n.id = $1 AND ${vis.sql}
       ) AS exists`,
      params,
    );
    if (!rows[0]?.exists) throw new NotFoundException("対象が見つかりません");

    await this.ds.query(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [id, user.id],
    );
  }

  private async loadMeta(id: string) {
    const rows: Array<{ id: string; from_user_id: string }> = await this.ds.query(
      `SELECT id, from_user_id FROM notices WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }
}
