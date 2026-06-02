import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

/**
 * Reporting departments ("業務部門") — flat list with a sort_order.
 * Direct port of Phase1 `/api/master/business-lines`.
 */
@Injectable()
export class BusinessLinesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list() {
    const items = await this.ds.query(
      `SELECT id, name, sort_order
         FROM business_lines
        WHERE deleted_at IS NULL
        ORDER BY sort_order, name`,
    );
    return { items };
  }

  async create(name: string, sortOrder?: number) {
    const rows = await this.ds.query(
      `INSERT INTO business_lines (name, sort_order)
       VALUES ($1, COALESCE($2, 0))
       RETURNING id, name, sort_order`,
      [name, sortOrder ?? 0],
    );
    return { item: rows[0] };
  }

  async patch(id: string, name?: string, sortOrder?: number) {
    if (name === undefined && sortOrder === undefined) {
      throw new BadRequestException("更新する項目を指定してください");
    }
    const rows = await this.ds.query(
      `UPDATE business_lines
          SET name = COALESCE($1, name),
              sort_order = COALESCE($2, sort_order)
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, name, sort_order`,
      [name ?? null, sortOrder ?? null, id],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
    return { item: rows[0] };
  }

  async softDelete(id: string) {
    const rows = await this.ds.query(
      `UPDATE business_lines SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
  }
}
