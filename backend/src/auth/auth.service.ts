import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import type { AuthedUser, JwtPayload } from "./types";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly cs: ConfigService,
  ) {}

  /**
   * Verify credentials. Returns the resolved AuthedUser, or throws 401.
   * We deliberately use the same error message for "user not found" and
   * "wrong password" so attackers can't enumerate accounts.
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
}
