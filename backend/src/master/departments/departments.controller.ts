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
import { DepartmentMutationDto } from "./dto";
import { DepartmentsService } from "./departments.service";

/**
 * Phase1 surface: `/api/master/departments(/[id])?`.
 * Admin-only on every method, matching `requireAdmin()` in the Next.js
 * route handlers.
 *
 * Response shape is preserved for the frontend port: { items: [...] } on
 * list, { item: {...} } on single, { ok: true } on delete.
 */
@Controller("master/departments")
@UseGuards(JwtAuthGuard, AdminGuard)
export class DepartmentsController {
  constructor(private readonly svc: DepartmentsService) {}

  @Get()
  async list() {
    const items = await this.svc.list();
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: DepartmentMutationDto) {
    const item = await this.svc.create(body.name);
    return { item };
  }

  @Patch(":id")
  async rename(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: DepartmentMutationDto,
  ) {
    const item = await this.svc.rename(id, body.name);
    return { item };
  }

  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.softDelete(id);
    return { ok: true };
  }
}
