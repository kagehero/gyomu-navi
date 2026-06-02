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
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { CreateNoticeDto, PatchNoticeDto } from "./dto";
import { NoticesService } from "./notices.service";

@Controller("notices")
@UseGuards(JwtAuthGuard)
export class NoticesController {
  constructor(private readonly svc: NoticesService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.svc.list(user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateNoticeDto, @CurrentUser() user: AuthedUser) {
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
  patch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: PatchNoticeDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.patch(user, id, body);
  }

  @Delete(":id")
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    await this.svc.remove(user, id);
    return { ok: true };
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    await this.svc.markRead(user, id);
    return { ok: true };
  }
}
