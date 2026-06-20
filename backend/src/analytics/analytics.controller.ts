import { Controller, Get, Header, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { AnalyticsService, type SortKey } from "./analytics.service";
import {
  AnalyticsRangeQueryDto,
  CsvExportQueryDto,
  DashboardQueryDto,
  RankQueryDto,
} from "./dto";

/** Pull an optional ranking sort out of a dimension query. */
function sortFrom(q: RankQueryDto): { key: SortKey; dir: "asc" | "desc" } | undefined {
  if (!q.sort_by) return undefined;
  return { key: q.sort_by, dir: q.sort_dir ?? "desc" };
}

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  /** 日次集計 — 作業日ごとの報告件数・数量・売上 */
  @Get("daily")
  daily(@Query() q: AnalyticsRangeQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.daily(user, q);
  }

  /** 週次集計 — ISO週ごと */
  @Get("weekly")
  weekly(@Query() q: AnalyticsRangeQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.weekly(user, q);
  }

  /** 月次集計 — YYYY-MM ごと */
  @Get("monthly")
  monthly(@Query() q: AnalyticsRangeQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.monthly(user, q);
  }

  /** 顧客別集計（ランキング: sort_by/sort_dir） */
  @Get("by-client")
  byClient(@Query() q: RankQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.byClient(user, q, sortFrom(q));
  }

  /** 従業員別集計（売上/台数/時間当たり台数などでランキング） */
  @Get("by-staff")
  byStaff(@Query() q: RankQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.byStaff(user, q, sortFrom(q));
  }

  /** 現場別集計（ランキング） */
  @Get("by-site")
  bySite(@Query() q: RankQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.bySite(user, q, sortFrom(q));
  }

  /** 部門別集計（ランキング） */
  @Get("by-business-line")
  byBusinessLine(@Query() q: RankQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.byBusinessLine(user, q, sortFrom(q));
  }

  /** ダッシュボード用まとめ（本日KPI + 週間推移 + 顧客別） */
  @Get("dashboard")
  dashboard(@Query() q: DashboardQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.dashboard(user, q.date);
  }

  /** CSVエクスポート — group_by=detail|daily|weekly|monthly|client|staff|site */
  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportCsv(
    @Query() q: CsvExportQueryDto,
    @CurrentUser() user: AuthedUser,
    @Res() res: Response,
  ) {
    const { body, filename } = await this.svc.exportCsv(user, q);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  }
}
