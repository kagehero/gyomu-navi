import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class CreateSiteDto {
  @IsUUID(undefined, { message: "顧客を選択してください" })
  client_id!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1, { message: "拠点名を入力してください" })
  @MaxLength(255)
  name!: string;

  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  latitude!: number;

  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  longitude!: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  radius_m!: number;

  @IsOptional() @IsBoolean()
  is_billing_branch?: boolean;
}

export class PatchSiteDto {
  @IsOptional() @IsUUID()
  client_id?: string;

  @IsOptional() @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1) @MaxLength(255)
  name?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  latitude?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  longitude?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  radius_m?: number;

  @IsOptional() @IsBoolean()
  is_billing_branch?: boolean;
}
