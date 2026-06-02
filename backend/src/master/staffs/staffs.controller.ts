import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../../auth/admin.guard";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CreateStaffDto, PatchStaffDto } from "./dto";
import { StaffsService } from "./staffs.service";

@Controller("master/staffs")
@UseGuards(JwtAuthGuard, AdminGuard)
export class StaffsController {
  constructor(private readonly svc: StaffsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  /**
   * Phase1 returns 400 here regardless of body. Use /register flows instead.
   */
  @Post()
  create(@Body() _body: CreateStaffDto) {
    return this.svc.rejectCreate();
  }

  @Patch(":id")
  patch(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: PatchStaffDto) {
    return this.svc.patch(id, body);
  }

  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.softDelete(id);
    return { ok: true };
  }
}
