import { Controller, Get, Header, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsRangeQueryDto, CsvExportQueryDto, DashboardQueryDto } from "./dto";

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

  /** 顧客別集計 */
  @Get("by-client")
  byClient(@Query() q: AnalyticsRangeQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.byClient(user, q);
  }

  /** 従業員別集計 */
  @Get("by-staff")
  byStaff(@Query() q: AnalyticsRangeQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.byStaff(user, q);
  }

  /** 現場別集計 */
  @Get("by-site")
  bySite(@Query() q: AnalyticsRangeQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.bySite(user, q);
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
