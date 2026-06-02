import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto, RegisterDto, RegisterEmployeeDto } from "./dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthedUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cs: ConfigService,
  ) {}

  /**
   * Cookie attributes shared by login, register, and logout. Centralised so
   * unset uses byte-identical options — browsers won't clear a cookie that
   * was set with a different Path/Domain/Secure/SameSite combination.
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

  private cookieName(): string {
    return this.cs.get<string>("SESSION_COOKIE_NAME") ?? "gyomu_session";
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateCredentials(body.email, body.password);
    const token = this.auth.signSessionToken(user);
    res.cookie(this.cookieName(), token, this.cookieOptions());
    return { user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName(), this.cookieOptions());
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
   * Admin self-registration (`POST /api/auth/register`). Gated by
   * ALLOW_REGISTER=true. On success the new user is auto-logged-in via the
   * same httpOnly cookie the login endpoint sets.
   */
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.registerAdmin(body);
    const token = this.auth.signSessionToken(user);
    res.cookie(this.cookieName(), token, this.cookieOptions());
    return { user };
  }

  /**
   * Employee self-registration (`POST /api/auth/register/employee`).
   * Creates a staffs row + an unapproved users row in one transaction.
   * Returns the same "管理者の承認待ち" message as Phase1 — does NOT
   * auto-login (the user can't log in until an admin approves).
   */
  @Post("register/employee")
  @HttpCode(HttpStatus.CREATED)
  async registerEmployee(@Body() body: RegisterEmployeeDto) {
    await this.auth.registerEmployee(body);
    return {
      message:
        "登録を受け付けました。管理者が担当部署・顧客を設定して承認するまで、ログインはできません。",
    };
  }
}
