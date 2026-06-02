import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query params for `/api/attendance` list and stats. Field names mirror
 * the Phase1 zod schema in `frontend/src/app/api/attendance/route.ts`.
 */
export class AttendanceListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  to?: string;

  @IsOptional()
  @IsUUID()
  staff_id?: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;
}

export class AttendanceStatsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  date?: string;
}

/** Punch-in body: GPS coords required so the haversine check can run. */
export class PunchInDto {
  @IsUUID(undefined, { message: "現場を選択してください" })
  site_id!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

/** Punch-out body: coords optional (we still record what we have). */
export class PunchOutDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

/**
 * Admin-only manual insert. Used for correcting missed punches.
 * Matches Phase1's POST /api/attendance schema.
 */
export class AttendanceCreateDto {
  @IsUUID()
  staff_id!: string;

  @IsUUID()
  site_id!: string;

  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  work_date!: string;

  @IsISO8601()
  punch_in_at!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  punch_out_at?: string | null;

  @IsIn(["working", "done", "absent"])
  status!: "working" | "done" | "absent";

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  punch_in_lat?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  punch_in_lng?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  punch_out_lat?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  punch_out_lng?: number | null;
}

/**
 * Admin-only patch. All fields optional but at least one is required
 * (enforced in the service so the validator stays simple).
 */
export class AttendancePatchDto {
  @IsOptional() @IsUUID() site_id?: string;
  @IsOptional() @IsISO8601() punch_in_at?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601()
  punch_out_at?: string | null;

  @IsOptional() @IsIn(["working", "done", "absent"])
  status?: "working" | "done" | "absent";

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  punch_in_lat?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  punch_in_lng?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  punch_out_lat?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  punch_out_lng?: number | null;
}
