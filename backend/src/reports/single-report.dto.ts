import {
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
