import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SessionEntryDto {
  @IsUUID()
  business_type_id!: string;

  @Type(() => Number)
  @Min(0)
  @Max(100_000)
  count!: number;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  vehicle_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  line_memo?: Record<string, string> | null;
}

export class CustomerBlockDto {
  @IsUUID()
  client_id!: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  site_id?: string | null;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessionEntryDto)
  entries!: SessionEntryDto[];
}

export class CreateSessionDto {
  @IsString() @Matches(ISO_DATE)
  work_date!: string;

  @IsUUID()
  business_line_id!: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(4000)
  memo?: string | null;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerBlockDto)
  customer_blocks!: CustomerBlockDto[];

  /** Admin only — submit on behalf of another staff member. */
  @IsOptional() @IsUUID()
  staff_id?: string;
}

export class UpdateSessionDto {
  @IsString() @Matches(ISO_DATE)
  work_date!: string;

  @IsUUID()
  business_line_id!: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(4000)
  memo?: string | null;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerBlockDto)
  customer_blocks!: CustomerBlockDto[];
}

export class ListSessionsQueryDto {
  @IsOptional() @IsString() @Matches(ISO_DATE)
  work_date?: string;

  @IsOptional() @IsUUID()
  business_line_id?: string;
}
