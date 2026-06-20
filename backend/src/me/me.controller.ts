import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import {
  ChangePasswordDto,
  MeBusinessTypesQueryDto,
  MeClientsQueryDto,
  MeSitesQueryDto,
  MeVehiclesQueryDto,
} from "./dto";
import { MeService } from "./me.service";

/**
 * Mirrors Phase1 `/api/me/*`:
 *   - GET   /api/me/sites           [?client_id]
 *   - GET   /api/me/business-lines
 *   - GET   /api/me/clients         ?business_line_id
 *   - GET   /api/me/business-types  ?business_line_id&client_id[&site_id]
 *   - GET   /api/me/vehicles        ?client_id[&business_line_id]
 *   - PATCH /api/me/password        self-service password change
 */
@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly svc: MeService) {}

  @Get("sites")
  sites(@Query() q: MeSitesQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.sites(user, q);
  }

  @Get("business-lines")
  businessLines(@CurrentUser() user: AuthedUser) {
    return this.svc.businessLines(user);
  }

  @Get("clients")
  clients(@Query() q: MeClientsQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.clients(user, q);
  }

  @Get("business-types")
  businessTypes(
    @Query() q: MeBusinessTypesQueryDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.businessTypes(user, q);
  }

  @Get("vehicles")
  vehicles(@Query() q: MeVehiclesQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.vehicles(user, q);
  }

  @Patch("password")
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.changePassword(user, body);
  }
}
