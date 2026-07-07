import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
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

  /**
   * 'site_total' (default) counts as sales; 'individual' is a personal 採算
   * record excluded from revenue (顧客要望: 複数人拠点のリーダー集計分離).
   */
  @IsOptional() @IsIn(["site_total", "individual"])
  report_kind?: "site_total" | "individual";
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

  @IsOptional() @IsIn(["site_total", "individual"])
  report_kind?: "site_total" | "individual";
}

/**
 * Draft (一時保存) payload. Deliberately permissive: a draft is incomplete by
 * definition, so beyond the staff/day/business_line key we accept the raw form
 * state as an opaque object and persist it verbatim. No business_reports rows
 * are created, so a draft never reaches analytics. The strict validation runs
 * only on final submit (CreateSessionDto / UpdateSessionDto).
 */
export class SaveDraftDto {
  @IsString() @Matches(ISO_DATE)
  work_date!: string;

  @IsUUID()
  business_line_id!: string;

  /** Opaque snapshot of the form (customer blocks, memo, etc.). */
  @IsObject()
  payload!: Record<string, unknown>;

  /** Admin only — draft on behalf of another staff member. */
  @IsOptional() @IsUUID()
  staff_id?: string;
}

/** One external (派遣) staff labour-cost line attached to a session. */
export class DispatchLaborCostDto {
  @IsString() @MaxLength(100)
  name!: string;

  @Type(() => Number) @Min(0) @Max(48)
  hours!: number;

  @Type(() => Number) @Min(0) @Max(10_000_000)
  labor_cost!: number;
}

/** Replace the full set of dispatch labour costs for a session. */
export class ReplaceDispatchLaborDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchLaborCostDto)
  items!: DispatchLaborCostDto[];
}

export class ListSessionsQueryDto {
  @IsOptional() @IsString() @Matches(ISO_DATE)
  work_date?: string;

  @IsOptional() @IsUUID()
  business_line_id?: string;
}
