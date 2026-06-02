import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryRunner } from "typeorm";

/**
 * Customer-company master with a M:N to business_lines.
 * Direct port of Phase1 `/api/master/clients(/[id])?`.
 */
@Injectable()
export class ClientsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list() {
    const items = await this.ds.query(
      `SELECT c.id, c.name, c.code, c.created_at, c.updated_at,
              COALESCE(
                ARRAY_AGG(cbl.business_line_id) FILTER (WHERE cbl.business_line_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS business_line_ids
         FROM client_companies c
         LEFT JOIN client_business_lines cbl ON cbl.client_id = c.id
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.code`,
    );
    return { items };
  }

  async create(name: string, code: string, businessLineIds: string[]) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const rows = await qr.query(
        `INSERT INTO client_companies (name, code)
         VALUES ($1, $2)
         RETURNING id, name, code, created_at, updated_at`,
        [name, code],
      );
      const item = rows[0];
      await this.syncBusinessLines(qr, item.id, businessLineIds);
      await qr.commitTransaction();
      return { item: { ...item, business_line_ids: businessLineIds } };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async patch(
    id: string,
    name?: string,
    code?: string,
    businessLineIds?: string[],
  ) {
    if (name === undefined && code === undefined && businessLineIds === undefined) {
      throw new BadRequestException("更新する項目を指定してください");
    }
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const rows = await qr.query(
        `UPDATE client_companies
            SET name = COALESCE($1, name),
                code = COALESCE($2, code)
          WHERE id = $3 AND deleted_at IS NULL
          RETURNING id, name, code, created_at, updated_at`,
        [name ?? null, code ?? null, id],
      );
      if (!rows[0]) {
        await qr.rollbackTransaction();
        throw new NotFoundException("対象が見つかりません");
      }
      let finalIds: string[];
      if (businessLineIds !== undefined) {
        await this.syncBusinessLines(qr, id, businessLineIds);
        finalIds = businessLineIds;
      } else {
        const cur: Array<{ business_line_id: string }> = await qr.query(
          `SELECT business_line_id FROM client_business_lines WHERE client_id = $1`,
          [id],
        );
        finalIds = cur.map((r) => r.business_line_id);
      }
      await qr.commitTransaction();
      return { item: { ...rows[0], business_line_ids: finalIds } };
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async softDelete(id: string) {
    const rows = await this.ds.query(
      `UPDATE client_companies SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("対象が見つかりません");
  }

  private async syncBusinessLines(
    qr: QueryRunner,
    clientId: string,
    ids: string[],
  ) {
    await qr.query(
      `DELETE FROM client_business_lines WHERE client_id = $1`,
      [clientId],
    );
    if (ids.length > 0) {
      await qr.query(
        `INSERT INTO client_business_lines (client_id, business_line_id)
         SELECT $1, bl_id FROM UNNEST($2::uuid[]) AS bl_id`,
        [clientId, ids],
      );
    }
  }
}
