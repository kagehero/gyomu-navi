import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared date-range filters for analytics endpoints. */
export class AnalyticsRangeQueryDto {
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
  client_id?: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;
}

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  date?: string;
}

export class CsvExportQueryDto extends AnalyticsRangeQueryDto {
  @IsOptional()
  @IsIn(["detail", "daily", "weekly", "monthly", "client", "staff", "site"])
  group_by?: "detail" | "daily" | "weekly" | "monthly" | "client" | "staff" | "site";
}
