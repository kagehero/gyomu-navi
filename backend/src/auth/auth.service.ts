import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import type {
  RegisterDto,
  RegisterEmployeeDto,
} from "./dto";
import type { AuthedUser, JwtPayload } from "./types";

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly cs: ConfigService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /**
   * Verify credentials. Returns the resolved AuthedUser or throws 401.
   * Uses one error message for both "user not found" and "wrong password"
   * so attackers can't enumerate accounts.
   */
  async validateCredentials(email: string, password: string): Promise<AuthedUser> {
    const row = await this.users.findByEmail(email);
    if (!row) throw new UnauthorizedException("メールアドレスまたはパスワードが正しくありません");
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) throw new UnauthorizedException("メールアドレスまたはパスワードが正しくありません");
    return {
      id: row.id,
      email: row.email,
      role: row.appRole,
      staffId: row.staffId,
      departmentId: row.departmentId,
    };
  }

  signSessionToken(user: Pick<AuthedUser, "id" | "email" | "role">): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.sign(payload, {
      expiresIn: this.cs.get<string>("JWT_EXPIRES_IN") ?? "12h",
    });
  }

  /**
   * Admin self-registration. Gated by `ALLOW_REGISTER=true` env var to keep
   * accidental opens off prod. The legacy route returned a Set-Cookie
   * directly; we return the created user and let the controller mint+set
   * the cookie so the flow matches the existing login path.
   */
  async registerAdmin(body: RegisterDto): Promise<AuthedUser> {
    if (this.cs.get<string>("ALLOW_REGISTER") !== "true") {
      throw new ForbiddenException("新規登録は無効です");
    }
    const hash = await bcrypt.hash(body.password, BCRYPT_SALT_ROUNDS);
    try {
      const rows: Array<{
        id: string;
        email: string;
        app_role: "admin";
        staff_id: string | null;
        department_id: string | null;
      }> = await this.ds.query(
        `INSERT INTO users (email, password_hash, display_name, app_role, staff_id, department_id)
         VALUES ($1, $2, $3, 'admin', NULL, NULL)
         RETURNING id, email, app_role, staff_id, department_id`,
        [body.email, hash, body.displayName?.trim() ?? ""],
      );
      const u = rows[0]!;
      return {
        id: u.id,
        email: u.email,
        role: u.app_role,
        staffId: u.staff_id,
        departmentId: u.department_id,
      };
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException("このメールアドレスは登録済みです");
      }
      throw e;
    }
  }

  /**
   * Employee self-registration — creates a staffs row + users row in one
   * transaction. The user starts with `login_approved_at = NULL` so they
   * can't log in until an admin approves them from the staff list.
   *
   * Gated by `ALLOW_EMPLOYEE_REGISTER` env var (default ON, only "false" disables).
   */
  async registerEmployee(body: RegisterEmployeeDto): Promise<void> {
    if (this.cs.get<string>("ALLOW_EMPLOYEE_REGISTER") === "false") {
      throw new ForbiddenException("従業員登録は現在受け付けていません");
    }
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_SALT_ROUNDS);

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Let Postgres assign UUIDs via DEFAULT gen_random_uuid(); RETURNING
      // pulls the new staff id back so we can link it on the users insert.
      const staffRows: Array<{ id: string }> = await qr.query(
        `INSERT INTO staffs (name, hourly_rate, department_id)
         VALUES ($1, 0, NULL)
         RETURNING id`,
        [body.name],
      );
      const staffId = staffRows[0]!.id;

      await qr.query(
        `INSERT INTO users
           (email, password_hash, display_name, app_role, staff_id, department_id, login_approved_at)
         VALUES ($1, $2, $3, 'employee', $4, NULL, NULL)`,
        [body.email, passwordHash, body.name, staffId],
      );

      await qr.commitTransaction();
    } catch (e) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      if (this.isUniqueViolation(e)) {
        throw new ConflictException("このメールアドレスは既に登録されています");
      }
      throw e;
    } finally {
      await qr.release();
    }
  }

  private isUniqueViolation(e: unknown): boolean {
    return (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "23505"
    );
  }
}
