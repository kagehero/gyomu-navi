import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { DepartmentEntity } from "./department.entity";

/**
 * Phase1 parity:
 *   GET    /api/master/departments       → list active, ordered by name
 *   POST   /api/master/departments       → create
 *   PATCH  /api/master/departments/[id]  → rename
 *   DELETE /api/master/departments/[id]  → soft delete (sets deleted_at)
 *
 * Soft-delete semantics use the `deleted_at` column directly via SQL (`now()`)
 * so the partial unique index defined in 004_master_data.sql does its job:
 * `UNIQUE (name) WHERE deleted_at IS NULL`. Once deleted, the same name can be
 * created fresh — that's intentional Phase1 behavior.
 */
@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly repo: Repository<DepartmentEntity>,
  ) {}

  list(): Promise<DepartmentEntity[]> {
    return this.repo.find({
      where: { deletedAt: IsNull() },
      order: { name: "ASC" },
    });
  }

  async create(name: string): Promise<DepartmentEntity> {
    const row = this.repo.create({ name });
    return this.repo.save(row);
  }

  async rename(id: string, name: string): Promise<DepartmentEntity> {
    const row = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException("対象が見つかりません");
    row.name = name;
    return this.repo.save(row);
  }

  /**
   * Sets deleted_at = now(). We don't use TypeORM's softRemove() so the
   * update goes through one statement and the row count is reliable for
   * "not found" detection.
   */
  async softDelete(id: string): Promise<void> {
    const result = await this.repo
      .createQueryBuilder()
      .update(DepartmentEntity)
      .set({ deletedAt: () => "now()" })
      .where("id = :id AND deleted_at IS NULL", { id })
      .execute();
    if (!result.affected) {
      throw new NotFoundException("対象が見つかりません");
    }
  }
}
