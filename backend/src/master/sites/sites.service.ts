import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { CreateSiteDto, PatchSiteDto } from "./dto";

/** Site master (1 client → N sites). Port of Phase1 `/api/master/sites`. */
@Injectable()
export class SitesService {
  private readonly SELECT_SITE = `
    SELECT s.id, s.client_id, c.name AS client_name,
           s.name,
           s.latitude::float8  AS latitude,
           s.longitude::float8 AS longitude,
           s.radius_m,
           s.is_billing_branch,
           s.created_at, s.updated_at
      FROM sites s
      JOIN client_companies c ON c.id = s.client_id
  `;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list() {
    const items = await this.ds.query(
      `${this.SELECT_SITE} WHERE s.deleted_at IS NULL ORDER BY c.name, s.name`,
    );
    return { items };
  }

  async create(body: CreateSiteDto) {
    const rows = await this.ds.query(
      `WITH inserted AS (
         INSERT INTO sites
           (client_id, name, latitude, longitude, radius_m, is_billing_branch)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
         RETURNING id
       )
       ${this.SELECT_SITE}
       JOIN inserted i ON i.id = s.id`,
      [
        body.client_id,
        body.name,
        body.latitude,
        body.longitude,
        body.radius_m,
        body.is_billing_branch ?? true,
      ],
    );
    return { item: rows[0] };
  }

  async patch(id: string, body: PatchSiteDto) {
    if (Object.values(body).every((v) => v === undefined)) {
      throw new BadRequestException("更新する項目を指定してください");
    }
    const rows = await this.ds.query(
      `WITH updated AS (
         UPDATE sites
            SET client_id = COALESCE($1, client_id),
                name = COALESCE($2, name),
                latitude = COALESCE($3, latitude),
                longitude = COALESCE($4, longitude),
                radius_m = COALESCE($5, radius_m),
                is_billing_branch = COALESCE($6, is_billing_branch)
          WHERE id = $7 AND deleted_at IS NULL
          RETURNING id
       )
       ${this.SELECT_SITE}
       JOIN updated u ON u.id = s.id`,
      [
        body.client_id ?? null,
        body.name ?? null,
        body.latitude ?? null,
        body.longitude ?? null,
        body.radius_m ?? null,
        body.is_billing_branch ?? null,
        id,
      ],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
    return { item: rows[0] };
  }

  async softDelete(id: string) {
    const rows = await this.ds.query(
      `UPDATE sites SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
  }
}
