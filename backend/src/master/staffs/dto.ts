import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

/**
 * POST schema kept for shape parity with Phase1, but the legacy route always
 * 400s — staff records are created via employee self-registration.
 */
export class CreateStaffDto {
  @IsOptional() @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @IsUUID()
  department_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000)
  hourly_rate?: number;

  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  client_ids?: string[];

  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  business_line_ids?: string[];
}

export class PatchStaffDto {
  @IsOptional() @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @IsUUID()
  department_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000)
  hourly_rate?: number;

  @IsOptional() @IsArray() @ArrayMinSize(1) @IsUUID(undefined, { each: true })
  client_ids?: string[];

  @IsOptional() @IsArray() @ArrayMinSize(1) @IsUUID(undefined, { each: true })
  business_line_ids?: string[];

  @IsOptional() @IsBoolean()
  approve?: boolean;
}

/** Bulk-approve a set of pending employee logins by staff id. */
export class BulkApproveStaffDto {
  @IsArray() @ArrayMinSize(1) @IsUUID(undefined, { each: true })
  ids!: string[];
}
