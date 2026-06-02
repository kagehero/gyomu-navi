import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import type { AuthedUser } from "../../auth/types";
import {
  CreateSessionDto,
  ListSessionsQueryDto,
  UpdateSessionDto,
} from "./dto";
import { ReportSessionsService } from "./sessions.service";

/**
 * Phase1 `/api/reports/sessions(/[id])?` mirror.
 *  - GET    /api/reports/sessions             list (scoped)
 *  - POST   /api/reports/sessions             create
 *  - GET    /api/reports/sessions/:id         detail (with entries)
 *  - PATCH  /api/reports/sessions/:id         replace contents
 *  - DELETE /api/reports/sessions/:id         destroy session + entries
 */
@Controller("reports/sessions")
@UseGuards(JwtAuthGuard)
export class ReportSessionsController {
  constructor(private readonly svc: ReportSessionsService) {}

  @Get()
  list(@Query() q: ListSessionsQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.list(user, q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateSessionDto, @CurrentUser() user: AuthedUser) {
    return this.svc.create(user, body);
  }

  @Get(":id")
  detail(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.detail(user, id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSessionDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.update(user, id, body);
  }

  @Delete(":id")
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    await this.svc.remove(user, id);
    return { ok: true };
  }
}
