import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type {
  CreateBusinessTypeDto,
  ListBusinessTypesQueryDto,
  PatchBusinessTypeDto,
} from "./dto";

/**
 * Business types ("業務内容") — per client, with optional site / line scope.
 * The PATCH SQL keeps Phase1's `CASE WHEN $n::boolean THEN $m ELSE col END`
 * trick so a `null` payload value explicitly clears the column, while an
 * omitted key leaves it untouched.
 */
@Injectable()
export class BusinessTypesService {
  private readonly SELECT_BT = `
    SELECT bt.id, bt.client_id, c.name AS client_name,
           bt.site_id, si.name AS site_name,
           bt.business_line_id, bl.name AS business_line_name,
           bt.name,
           bt.unit_price_excl::float8 AS unit_price_excl,
           bt.unit_price_incl::float8 AS unit_price_incl,
           bt.created_at, bt.updated_at
      FROM business_types bt
      JOIN client_companies c ON c.id = bt.client_id
      LEFT JOIN sites si ON si.id = bt.site_id
      LEFT JOIN business_lines bl ON bl.id = bt.business_line_id
  `;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(q: ListBusinessTypesQueryDto) {
    const params: unknown[] = [];
    let where = `bt.deleted_at IS NULL`;
    if (q.client_id) {
      params.push(q.client_id);
      where += ` AND bt.client_id = $${params.length}`;
    }
    const items = await this.ds.query(
      `${this.SELECT_BT}
        WHERE ${where}
        ORDER BY c.name, si.name NULLS FIRST, bt.name`,
      params,
    );
    return { items };
  }

  async create(body: CreateBusinessTypeDto) {
    const rows = await this.ds.query(
      `WITH inserted AS (
         INSERT INTO business_types
           (client_id, site_id, business_line_id, name, unit_price_excl, unit_price_incl)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id
       )
       ${this.SELECT_BT}
       JOIN inserted i ON i.id = bt.id`,
      [
        body.client_id,
        body.site_id ?? null,
        body.business_line_id ?? null,
        body.name,
        body.unit_price_excl ?? null,
        body.unit_price_incl ?? null,
      ],
    );
    return { item: rows[0] };
  }

  async patch(id: string, body: PatchBusinessTypeDto) {
    const provided = (k: keyof PatchBusinessTypeDto) =>
      Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;

    if (!Object.keys(body).length) {
      throw new BadRequestException("更新する項目を指定してください");
    }

    const rows = await this.ds.query(
      `WITH updated AS (
         UPDATE business_types
            SET client_id = COALESCE($1, client_id),
                name = COALESCE($2, name),
                site_id = CASE WHEN $3::boolean THEN $4 ELSE site_id END,
                business_line_id = CASE WHEN $5::boolean THEN $6 ELSE business_line_id END,
                unit_price_excl = CASE WHEN $7::boolean THEN $8 ELSE unit_price_excl END,
                unit_price_incl = CASE WHEN $9::boolean THEN $10 ELSE unit_price_incl END
          WHERE id = $11 AND deleted_at IS NULL
          RETURNING id
       )
       ${this.SELECT_BT}
       JOIN updated u ON u.id = bt.id`,
      [
        body.client_id ?? null,
        body.name ?? null,
        provided("site_id"),
        body.site_id ?? null,
        provided("business_line_id"),
        body.business_line_id ?? null,
        provided("unit_price_excl"),
        body.unit_price_excl ?? null,
        provided("unit_price_incl"),
        body.unit_price_incl ?? null,
        id,
      ],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
    return { item: rows[0] };
  }

  async softDelete(id: string) {
    const rows = await this.ds.query(
      `UPDATE business_types SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
  }
}
