import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../users/users.service";
import type { AuthedUser, JwtPayload } from "./types";

const cookieExtractor = (cookieName: string) => (req: Request): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (req as any)?.cookies?.[cookieName];
  return typeof c === "string" ? c : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(cs: ConfigService, private readonly users: UsersService) {
    const cookieName = cs.get<string>("SESSION_COOKIE_NAME") ?? "gyomu_session";
    super({
      // Cookie first, then Bearer for tooling (e.g. integration tests).
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor(cookieName),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: cs.getOrThrow<string>("JWT_SECRET"),
    });
  }

  /**
   * Re-fetch the user on every request — soft-deleted or role-changed users
   * must lose access without waiting for the token to expire. The DB round
   * trip is one indexed lookup per request; revisit with a short-lived
   * cache only if it shows up in profiling.
   */
  async validate(payload: JwtPayload): Promise<AuthedUser> {
    const row = await this.users.findById(payload.sub);
    if (!row) throw new UnauthorizedException("認証が必要です");
    return {
      id: row.id,
      email: row.email,
      role: row.appRole,
      staffId: row.staffId,
      departmentId: row.departmentId,
    };
  }
}
