import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class CreateBusinessTypeDto {
  @IsUUID(undefined, { message: "顧客を選択してください" })
  client_id!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1, { message: "業務名を入力してください" })
  @MaxLength(100)
  name!: string;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsUUID()
  site_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsUUID()
  business_line_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(0)
  unit_price_excl?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(0)
  unit_price_incl?: number | null;
}

export class PatchBusinessTypeDto {
  @IsOptional() @IsUUID()
  client_id?: string;

  @IsOptional() @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  site_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  business_line_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(0)
  unit_price_excl?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(0)
  unit_price_incl?: number | null;
}

export class ListBusinessTypesQueryDto {
  @IsOptional() @IsUUID()
  client_id?: string;
}
