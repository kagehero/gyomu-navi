import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";

export class PatchReportDto {
  @IsOptional() @IsUUID()
  site_id?: string;

  @IsOptional() @IsUUID()
  business_type_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000)
  count?: number;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(2000)
  memo?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(2000)
  image_url?: string | null;
}

/** Body for POST /api/reports/:id/images — attach uploaded object keys. */
export class AddReportImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  objectKeys!: string[];
}
