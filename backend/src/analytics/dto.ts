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

/**
 * Dimension (顧客/スタッフ/拠点/部門) aggregation with optional ranking sort.
 * `sort_by` is whitelisted in the service; `sort_dir` defaults to desc.
 */
export class RankQueryDto extends AnalyticsRangeQueryDto {
  @IsOptional()
  @IsIn([
    "total_count",
    "revenue_excl",
    "report_count",
    "count_per_hour",
    "revenue_excl_per_hour",
    "dimension_name",
  ])
  sort_by?:
    | "total_count"
    | "revenue_excl"
    | "report_count"
    | "count_per_hour"
    | "revenue_excl_per_hour"
    | "dimension_name";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sort_dir?: "asc" | "desc";
}

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: "YYYY-MM-DD 形式で指定してください" })
  date?: string;
}

export class CsvExportQueryDto extends AnalyticsRangeQueryDto {
  @IsOptional()
  @IsIn(["detail", "daily", "weekly", "monthly", "client", "staff", "site", "business_line"])
  group_by?:
    | "detail"
    | "daily"
    | "weekly"
    | "monthly"
    | "client"
    | "staff"
    | "site"
    | "business_line";
}
