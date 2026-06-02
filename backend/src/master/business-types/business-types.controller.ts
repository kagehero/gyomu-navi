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
import { AdminGuard } from "../../auth/admin.guard";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { BusinessTypesService } from "./business-types.service";
import {
  CreateBusinessTypeDto,
  ListBusinessTypesQueryDto,
  PatchBusinessTypeDto,
} from "./dto";

@Controller("master/business-types")
@UseGuards(JwtAuthGuard, AdminGuard)
export class BusinessTypesController {
  constructor(private readonly svc: BusinessTypesService) {}

  @Get()
  list(@Query() q: ListBusinessTypesQueryDto) {
    return this.svc.list(q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateBusinessTypeDto) {
    return this.svc.create(body);
  }

  @Patch(":id")
  patch(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: PatchBusinessTypeDto) {
    return this.svc.patch(id, body);
  }

  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.softDelete(id);
    return { ok: true };
  }
}
