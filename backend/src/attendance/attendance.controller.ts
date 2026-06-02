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
import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { AttendanceService } from "./attendance.service";
import {
  AttendanceCreateDto,
  AttendanceListQueryDto,
  AttendancePatchDto,
  AttendanceStatsQueryDto,
  PunchInDto,
  PunchOutDto,
} from "./dto";

/**
 * Mirrors Phase1 `/api/attendance/*` surface 1:1.
 *  - GET    /api/attendance            list (scoped)
 *  - GET    /api/attendance/stats      KPI snapshot
 *  - GET    /api/attendance/today      employee's row for today
 *  - POST   /api/attendance/punch-in   employee (GPS-checked)
 *  - POST   /api/attendance/punch-out  employee
 *  - POST   /api/attendance            admin manual insert
 *  - PATCH  /api/attendance/:id        admin patch
 *  - DELETE /api/attendance/:id        admin delete
 */
@Controller("attendance")
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Get()
  list(@Query() q: AttendanceListQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.list(user, q);
  }

  @Get("stats")
  stats(@Query() q: AttendanceStatsQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.stats(user, q);
  }

  @Get("today")
  today(@CurrentUser() user: AuthedUser) {
    return this.svc.today(user);
  }

  @Post("punch-in")
  @HttpCode(HttpStatus.CREATED)
  punchIn(@Body() body: PunchInDto, @CurrentUser() user: AuthedUser) {
    return this.svc.punchIn(user, body);
  }

  @Post("punch-out")
  @HttpCode(HttpStatus.OK)
  punchOut(@Body() body: PunchOutDto, @CurrentUser() user: AuthedUser) {
    return this.svc.punchOut(user, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AdminGuard)
  create(@Body() body: AttendanceCreateDto) {
    return this.svc.createByAdmin(body);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  patch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: AttendancePatchDto,
  ) {
    return this.svc.patchByAdmin(id, body);
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.deleteByAdmin(id);
    return { ok: true };
  }
}
