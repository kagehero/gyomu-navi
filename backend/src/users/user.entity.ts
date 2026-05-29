import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type AppRole = "admin" | "manager" | "employee";

/**
 * Mirrors the Phase1 `users` table after migration 005:
 *   - app_role: 'admin' | 'manager' | 'employee'
 *   - role/FK consistency CHECK is enforced at the DB level; we do not
 *     re-validate here. See 005_users_link_to_staff.sql.
 *   - staff_id / department_id are nullable FKs to staffs / departments
 *     (entities to be added during full module port).
 */
@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "password_hash", type: "text" })
  passwordHash!: string;

  @Column({ name: "display_name", type: "varchar", length: 255, default: "" })
  displayName!: string;

  @Column({ name: "app_role", type: "varchar", length: 20 })
  appRole!: AppRole;

  @Column({ name: "staff_id", type: "uuid", nullable: true })
  staffId!: string | null;

  @Column({ name: "department_id", type: "uuid", nullable: true })
  departmentId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;
}
