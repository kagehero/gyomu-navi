import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthedUser } from "./types";

/**
 * Allows the request only when the resolved user is an `admin`.
 * Use **after** JwtAuthGuard so `request.user` is populated:
 *
 *     @UseGuards(JwtAuthGuard, AdminGuard)
 *
 * Matches the Phase1 `requireAdmin()` helper's semantics: 403 with the
 * Japanese error message used across the API surface.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthedUser | undefined;
    if (!user) throw new ForbiddenException("認証が必要です");
    if (user.role !== "admin") {
      throw new ForbiddenException("この操作には管理者権限が必要です");
    }
    return true;
  }
}
