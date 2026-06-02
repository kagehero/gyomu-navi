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
import { AdminGuard } from "../../auth/admin.guard";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { SitesService } from "./sites.service";
import { CreateSiteDto, PatchSiteDto } from "./dto";

@Controller("master/sites")
@UseGuards(JwtAuthGuard, AdminGuard)
export class SitesController {
  constructor(private readonly svc: SitesService) {}

  @Get() list() { return this.svc.list(); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateSiteDto) { return this.svc.create(body); }

  @Patch(":id")
  patch(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: PatchSiteDto) {
    return this.svc.patch(id, body);
  }

  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.softDelete(id);
    return { ok: true };
  }
}
