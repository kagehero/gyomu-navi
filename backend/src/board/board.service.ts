import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { AuthedUser } from "../auth/types";
import type {
  CreateBoardPostDto,
  ListBoardQueryDto,
  PatchBoardPostDto,
} from "./dto";
import { visibleSitesClause } from "./site-visibility";

/** Port of Phase1 `/api/board(/[id])?`. */
@Injectable()
export class BoardService {
  private readonly SELECT_BOARD = `
    SELECT bp.id, bp.site_id, st.name AS site_name,
           bp.author_user_id, au.display_name AS author_display_name,
           bp.title, bp.body, bp.pinned,
           bp.created_at, bp.updated_at
      FROM board_posts bp
      JOIN sites st ON st.id = bp.site_id
      JOIN users au ON au.id = bp.author_user_id
  `;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(user: AuthedUser, q: ListBoardQueryDto) {
    const params: unknown[] = [];
    const conds: string[] = [];
    if (q.site_id) {
      params.push(q.site_id);
      conds.push(`bp.site_id = $${params.length}`);
    }
    const scope = visibleSitesClause(user, "bp.site_id", params.length);
    params.push(...scope.params);

    const where = [conds.join(" AND "), scope.sql.replace(/^ AND /, "")]
      .filter(Boolean)
      .join(" AND ");

    const items = await this.ds.query(
      `${this.SELECT_BOARD}
        ${where ? "WHERE " + where : ""}
        ORDER BY bp.pinned DESC, bp.created_at DESC
        LIMIT 500`,
      params,
    );
    return { items };
  }

  async create(user: AuthedUser, body: CreateBoardPostDto) {
    if (user.role !== "admin") {
      const scope = visibleSitesClause(user, "id", 1);
      const rows: Array<{ exists: boolean }> = await this.ds.query(
        `SELECT EXISTS (
           SELECT 1 FROM sites WHERE id = $1 AND deleted_at IS NULL ${scope.sql}
         ) AS exists`,
        [body.site_id, ...scope.params],
      );
      if (!rows[0]?.exists) {
        throw new ForbiddenException("この現場には投稿できません");
      }
    }

    const inserted: Array<{ id: string }> = await this.ds.query(
      `INSERT INTO board_posts (site_id, author_user_id, title, body, pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [body.site_id, user.id, body.title, body.body, body.pinned ?? false],
    );
    const rows = await this.ds.query(
      `${this.SELECT_BOARD} WHERE bp.id = $1`,
      [inserted[0]!.id],
    );
    return { item: rows[0] };
  }

  async patch(user: AuthedUser, id: string, body: PatchBoardPostDto) {
    const meta = await this.loadMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");
    if (user.role !== "admin" && meta.author_user_id !== user.id) {
      throw new ForbiddenException("編集権限がありません");
    }
    if (
      body.title === undefined &&
      body.body === undefined &&
      body.pinned === undefined
    ) {
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
    if (body.pinned !== undefined) add("pinned", body.pinned);
    params.push(id);
    await this.ds.query(
      `UPDATE board_posts SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    const rows = await this.ds.query(
      `${this.SELECT_BOARD} WHERE bp.id = $1`,
      [id],
    );
    return { item: rows[0] };
  }

  async remove(user: AuthedUser, id: string) {
    const meta = await this.loadMeta(id);
    if (!meta) throw new NotFoundException("対象が見つかりません");
    if (user.role !== "admin" && meta.author_user_id !== user.id) {
      throw new ForbiddenException("削除権限がありません");
    }
    await this.ds.query(`DELETE FROM board_posts WHERE id = $1`, [id]);
  }

  private async loadMeta(id: string) {
    const rows: Array<{ id: string; author_user_id: string }> =
      await this.ds.query(
        `SELECT id, author_user_id FROM board_posts WHERE id = $1`,
        [id],
      );
    return rows[0] ?? null;
  }
}
