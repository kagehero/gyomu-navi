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
import { BusinessLinesService } from "./business-lines.service";
import { CreateBusinessLineDto, PatchBusinessLineDto } from "./dto";

@Controller("master/business-lines")
@UseGuards(JwtAuthGuard, AdminGuard)
export class BusinessLinesController {
  constructor(private readonly svc: BusinessLinesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateBusinessLineDto) {
    return this.svc.create(body.name, body.sort_order);
  }

  @Patch(":id")
  patch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: PatchBusinessLineDto,
  ) {
    return this.svc.patch(id, body.name, body.sort_order);
  }

  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.softDelete(id);
    return { ok: true };
  }
}
