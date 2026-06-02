import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthedUser } from "../auth/types";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  /**
   * Minimal "who am I" handler — distinct from /auth/me which is what the
   * SPA calls on bootstrap. This endpoint exists for consistency with the
   * Phase1 surface and can grow into /users/:id, etc. during the port.
   */
  @Get("me")
  me(@CurrentUser() user: AuthedUser) {
    return { user };
  }
}
