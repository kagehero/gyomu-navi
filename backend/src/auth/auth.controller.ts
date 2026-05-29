import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
  Get,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto, RegisterDto } from "./dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthedUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cs: ConfigService,
  ) {}

  /**
   * Cookie attributes shared by login and logout. Centralised so the unset
   * call uses byte-identical options — browsers won't clear a cookie set
   * with mismatched Path/Domain/Secure.
   */
  private cookieOptions(): CookieOptions {
    const sameSite = (this.cs.get<string>("COOKIE_SAME_SITE") ?? "lax") as
      | "lax"
      | "strict"
      | "none";
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite,
      domain: this.cs.get<string>("COOKIE_DOMAIN") || undefined,
      path: "/",
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateCredentials(body.email, body.password);
    const token = this.auth.signSessionToken(user);
    const cookieName = this.cs.get<string>("SESSION_COOKIE_NAME") ?? "gyomu_session";
    res.cookie(cookieName, token, this.cookieOptions());
    return { user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieName = this.cs.get<string>("SESSION_COOKIE_NAME") ?? "gyomu_session";
    res.clearCookie(cookieName, this.cookieOptions());
    return { ok: true };
  }

  /**
   * Bootstrap endpoint for the SPA `useAuth` hook. Returns the resolved
   * user or 401 — never returns null with 200, so the client can rely on
   * status code alone.
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthedUser) {
    return { user };
  }

  /**
   * TODO(phase-port): registration was Phase1's `/api/auth/register` and
   * `/api/auth/register/employee`. Port both flows here when the master/me
   * modules are ready — they depend on staffs / departments lookups that
   * don't exist yet in this scaffold.
   */
  @Post("register")
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  register(@Body() _body: RegisterDto) {
    throw new NotImplementedException(
      "register flow will be ported alongside the master + me modules",
    );
  }
}
