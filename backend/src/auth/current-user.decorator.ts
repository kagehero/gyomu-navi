import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { AuthedUser } from "./types";

/**
 * Resolves `request.user` set by JwtStrategy.validate(). Use in
 * controllers as `@CurrentUser() user: AuthedUser`.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthedUser;
  },
);
