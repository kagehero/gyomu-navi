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
import { ClientsService } from "./clients.service";
import { CreateClientDto, PatchClientDto } from "./dto";

@Controller("master/clients")
@UseGuards(JwtAuthGuard, AdminGuard)
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateClientDto) {
    return this.svc.create(body.name, body.code, body.business_line_ids ?? []);
  }

  @Patch(":id")
  patch(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: PatchClientDto) {
    return this.svc.patch(id, body.name, body.code, body.business_line_ids);
  }

  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.svc.softDelete(id);
    return { ok: true };
  }
}
