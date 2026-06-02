import { IsOptional, IsUUID } from "class-validator";

export class MeSitesQueryDto {
  @IsOptional() @IsUUID()
  client_id?: string;
}

export class MeBusinessTypesQueryDto {
  @IsUUID()
  business_line_id!: string;

  @IsUUID()
  client_id!: string;

  @IsOptional() @IsUUID()
  site_id?: string;
}

export class MeClientsQueryDto {
  @IsUUID(undefined, { message: "部門を選択してください" })
  business_line_id!: string;
}

export class MeVehiclesQueryDto {
  @IsUUID()
  client_id!: string;

  @IsOptional() @IsUUID()
  business_line_id?: string;
}
