"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { DateQuickPicker } from "@/components/ui/date-quick-picker";
import { useAuth } from "@/features/auth/useAuth";
import { useReports, type BusinessReport } from "@/features/reports/api";
import { ReportRowActions } from "@/features/reports/ReportRowActions";
import { ReportSessionForm } from "@/features/reports/ReportSessionForm";
import { ReportSessionHistory } from "@/features/reports/ReportSessionHistory";
import {
  ReportImageLightbox,
  useReportLightbox,
  imageLightboxItem,
  legacyLightboxItem,
} from "@/features/reports/ReportImageLightbox";
import { useClients, useStaffs } from "@/features/master/api";
import { CsvExportMenu } from "@/features/analytics/CsvExportMenu";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { filtersToParams, type AnalyticsFilterState } from "@/features/analytics/utils";
import {
  Search,
  Filter,
  ClipboardList,
  Hash,
  Inbox,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { todayJST } from "@/lib/dates";
import {
  formatReportDateTime,
  reportDisplayTimestamp,
  reportImageByIdSrc,
  reportImageSrc,
} from "@/lib/reports/format";

export default function ReportsPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canManageReports = isAdmin || isManager;

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [searchDate, setSearchDate] = useState<string>(todayJST());

  const csvParams = useMemo(() => {
    const f: AnalyticsFilterState = {
      from: searchDate,
      to: searchDate,
      staff_id: filterStaff,
      client_id: filterClient,
      site_id: "all",
    };
    return filtersToParams(f);
  }, [searchDate, filterStaff, filterClient]);

  const listParams = useMemo(() => {
    return {
      date: searchDate || undefined,
      staff_id: !isEmployee && filterStaff !== "all" ? filterStaff : undefined,
      client_id: !isEmployee && filterClient !== "all" ? filterClient : undefined,
    };
  }, [searchDate, filterStaff, filterClient, isEmployee]);

  const reportsQ = useReports(listParams);
  const clientsQ = useClients({ enabled: isAdmin });
  const staffsQ = useStaffs({ enabled: isAdmin });
  const clients = clientsQ.data?.items ?? [];
  const staffs = staffsQ.data?.items ?? [];
  const items = useMemo(() => reportsQ.data?.items ?? [], [reportsQ.data?.items]);

  const adminTotal = isAdmin
    ? items.reduce((sum, r) => sum + (r.line_amount_incl ?? 0), 0)
    : 0;
  const adminCountTotal = isAdmin
    ? items.reduce((sum, r) => sum + (r.count ?? 0), 0)
    : 0;

  // Flat list of every viewable image (admin lightbox). New multi-images
  // (report_images) expand per-image; legacy rows fall back to image_url.
  const imageItems = useMemo(
    () =>
      items.flatMap((r) => {
        const meta = {
          client_name: r.client_name,
          staff_name: r.staff_name,
          reported_at: reportDisplayTimestamp(r),
        };
        if (r.images && r.images.length > 0) {
          return r.images.map((img) => imageLightboxItem(r.id, img.imageId, meta));
        }
        if (r.image_url) {
          return [legacyLightboxItem({ id: r.id, ...meta })];
        }
        return [];
      }),
    [items],
  );
  const lightbox = useReportLightbox();

  // First viewable image key for a report (to open the lightbox at it).
  const firstImageKey = useCallback(
    (r: BusinessReport): string | null => {
      if (r.images && r.images.length > 0) return r.images[0]!.imageId;
      if (r.image_url) return r.id;
      return null;
    },
    [],
  );
  // Total image count for a report (multi or legacy single).
  const imageCountOf = (r: BusinessReport): number =>
    r.images && r.images.length > 0 ? r.images.length : r.image_url ? 1 : 0;

  const hasActiveFilters =
    !isEmployee && (filterStaff !== "all" || filterClient !== "all");
  const resetFilters = () => {
    setFilterStaff("all");
    setFilterClient("all");
    setSearchDate(todayJST());
  };

  // Column count for placeholder rows.
  const imageColumn = isAdmin;
  const colSpan =
    (isEmployee ? 7 : 8) +
    (isAdmin ? 2 : 0) +
    (imageColumn ? 1 : 0) +
    (canManageReports ? 1 : 0);

  const listSection = (
    <>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">表示条件</span>
          </div>
          {isEmployee ? (
            <DateQuickPicker
              value={searchDate}
              onChange={setSearchDate}
              variant="employee"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DateQuickPicker
                value={searchDate}
                onChange={setSearchDate}
                variant="admin"
                className="sm:col-span-3"
              />
              {isAdmin && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">顧客</Label>
                    <Select value={filterClient} onValueChange={setFilterClient}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">スタッフ</Label>
                    <Select value={filterStaff} onValueChange={setFilterStaff}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        {staffs.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryCard
            icon={ClipboardList}
            label="報告件数"
            value={`${items.length}件`}
            tone="default"
          />
          <SummaryCard
            icon={Hash}
            label="台数合計"
            value={`${adminCountTotal.toLocaleString()}台`}
            tone="default"
          />
          <SummaryCard
            icon={TrendingUp}
            label="税込売上"
            value={`¥${Math.round(adminTotal).toLocaleString()}`}
            tone="success"
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" />
            {isEmployee ? "報告履歴" : "検索結果"} ({items.length}件)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile card list (admin/manager only — employees use the history tab) */}
          {!isEmployee && (
            <div className="space-y-2 px-3 pb-3 md:hidden">
              {reportsQ.isLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {reportsQ.isError && (
                <p className="px-3 py-4 text-center text-sm text-destructive">
                  {reportsQ.error instanceof Error
                    ? reportsQ.error.message
                    : "読み込みに失敗しました"}
                </p>
              )}
              {!reportsQ.isLoading && items.length === 0 && (
                <EmptyState
                  icon={Inbox}
                  title={`${searchDate} の報告は 0 件です`}
                  description={
                    hasActiveFilters
                      ? "条件を変えて再度お試しください"
                      : "この日の報告はまだ提出されていません"
                  }
                  actionLabel={hasActiveFilters ? "条件をリセット" : undefined}
                  onAction={hasActiveFilters ? resetFilters : undefined}
                />
              )}
              {items.map((r) => (
                <MobileReportCard
                  key={r.id}
                  row={r}
                  showStaff
                  showPrice={isAdmin}
                  canManage={canManageReports}
                  canEdit={isAdmin}
                  onOpenImage={
                    firstImageKey(r) ? () => lightbox.open(firstImageKey(r)!) : undefined
                  }
                  imageCount={imageCountOf(r)}
                />
              ))}
            </div>
          )}

          {/* Table (employees: always; admin/manager: md and up) */}
          <div className={`overflow-x-auto ${!isEmployee ? "hidden md:block" : ""}`}>
            <table className="data-table min-w-[800px] text-xs sm:text-sm">
              <thead>
                <tr>
                  <th>報告日時</th>
                  {!isEmployee && <th>スタッフ</th>}
                  <th>部門</th>
                  <th>顧客</th>
                  <th>拠点</th>
                  <th>業務内容</th>
                  <th className="text-right">台数</th>
                  {isAdmin && (
                    <>
                      <th className="text-right">単価(税込)</th>
                      <th className="text-right">金額(税込)</th>
                    </>
                  )}
                  <th>日次メモ</th>
                  {imageColumn && <th className="text-center">画像</th>}
                  {canManageReports && <th className="text-right">操作</th>}
                </tr>
              </thead>
              <tbody>
                {reportsQ.isLoading && <TableSkeletonRows colSpan={colSpan} />}
                {reportsQ.isError && (
                  <tr>
                    <td colSpan={colSpan} className="py-6 text-center text-sm text-destructive">
                      {reportsQ.error instanceof Error
                        ? reportsQ.error.message
                        : "読み込みに失敗しました"}
                    </td>
                  </tr>
                )}
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {formatReportDateTime(reportDisplayTimestamp(r))}
                    </td>
                    {!isEmployee && <td className="font-medium">{r.staff_name}</td>}
                    <td className="text-muted-foreground">{r.business_line_name ?? "—"}</td>
                    <td>{r.client_name}</td>
                    <td className="text-muted-foreground">{r.site_name}</td>
                    <td>
                      <span className="status-badge bg-primary/10 text-primary">
                        {r.business_type_name}
                      </span>
                    </td>
                    <td className="text-right font-medium">{r.count}</td>
                    {isAdmin && (
                      <>
                        <td className="text-right text-muted-foreground">
                          {r.unit_price_incl != null
                            ? `¥${Math.round(r.unit_price_incl).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="text-right font-medium">
                          {r.line_amount_incl != null
                            ? `¥${Math.round(r.line_amount_incl).toLocaleString()}`
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="max-w-[160px] truncate text-muted-foreground">
                      {r.session_memo || "—"}
                    </td>
                    {imageColumn && (
                      <td className="text-center">
                        {firstImageKey(r) ? (
                          <button
                            type="button"
                            className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border bg-muted transition-shadow hover:shadow-md"
                            onClick={() => lightbox.open(firstImageKey(r)!)}
                            aria-label={`画像を拡大表示（${imageCountOf(r)}枚）`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- backend image proxy */}
                            <img
                              src={
                                r.images && r.images.length > 0
                                  ? reportImageByIdSrc(r.id, r.images[0]!.imageId)
                                  : reportImageSrc(r.id)
                              }
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {imageCountOf(r) > 1 && (
                              <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[10px] font-medium leading-tight text-white">
                                +{imageCountOf(r) - 1}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {canManageReports && (
                      <td className="text-right">
                        <ReportRowActions row={r} canEdit={isAdmin} />
                      </td>
                    )}
                  </tr>
                ))}
                {!reportsQ.isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="py-2">
                      <EmptyState
                        icon={Inbox}
                        title={`${searchDate} の報告は 0 件です`}
                        description={
                          hasActiveFilters
                            ? "条件を変えて再度お試しください"
                            : isEmployee
                              ? "報告入力タブから登録できます"
                              : "この日の報告はまだ提出されていません"
                        }
                        actionLabel={hasActiveFilters ? "条件をリセット" : undefined}
                        onAction={hasActiveFilters ? resetFilters : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {lightbox.currentId && (
        <ReportImageLightbox
          items={imageItems}
          currentId={lightbox.currentId}
          onClose={lightbox.close}
          onNavigate={lightbox.setCurrentId}
        />
      )}
    </>
  );

  return (
    <PageContainer>
      <PageHeader
        title="業務報告"
        description={
          isEmployee ? "日付・部門・顧客を選んで業務実績を報告" : "業務報告の一覧・売上集計"
        }
        actions={isAdmin ? <CsvExportMenu params={csvParams} /> : undefined}
      />

      {isEmployee ? (
        <Tabs defaultValue="submit">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit">報告入力</TabsTrigger>
            <TabsTrigger value="history">履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="submit" className="mt-4">
            <ReportSessionForm />
          </TabsContent>
          <TabsContent value="history" className="mt-4 space-y-4">
            <ReportSessionHistory searchDate={searchDate} onDateChange={setSearchDate} />
          </TabsContent>
        </Tabs>
      ) : (
        listSection
      )}
    </PageContainer>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "default" | "success";
}) {
  const accent = tone === "success" ? "text-success" : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`rounded-md bg-muted p-1.5 ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        </div>
        <span className={`whitespace-nowrap text-base font-bold sm:text-lg ${accent}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function MobileReportCard({
  row,
  showStaff,
  showPrice,
  canManage,
  canEdit,
  onOpenImage,
  imageCount = 0,
}: {
  row: BusinessReport;
  showStaff: boolean;
  showPrice: boolean;
  canManage: boolean;
  canEdit: boolean;
  onOpenImage?: () => void;
  imageCount?: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.client_name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.site_name}</p>
          </div>
          <span className="status-badge shrink-0 bg-primary/10 text-primary">
            {row.business_type_name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {showStaff && <span className="font-medium text-foreground">{row.staff_name}</span>}
          <span>{formatReportDateTime(reportDisplayTimestamp(row))}</span>
          {row.business_line_name && <span>{row.business_line_name}</span>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">台数</p>
            <p className="text-lg font-bold leading-none">{row.count}</p>
          </div>
          {showPrice && row.line_amount_incl != null && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">金額(税込)</p>
              <p className="text-base font-bold leading-none text-success">
                ¥{Math.round(row.line_amount_incl).toLocaleString()}
              </p>
            </div>
          )}
          {onOpenImage && (
            <button
              type="button"
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted"
              onClick={onOpenImage}
              aria-label={`画像を拡大表示（${imageCount}枚）`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- backend image proxy */}
              <img
                src={
                  row.images && row.images.length > 0
                    ? reportImageByIdSrc(row.id, row.images[0]!.imageId)
                    : reportImageSrc(row.id)
                }
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {imageCount > 1 && (
                <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[10px] font-medium leading-tight text-white">
                  +{imageCount - 1}
                </span>
              )}
            </button>
          )}
        </div>
        {(row.session_memo || row.memo) && (
          <p className="border-t pt-1.5 text-xs text-muted-foreground">
            {row.session_memo || row.memo}
          </p>
        )}
        {canManage && (
          <div className="flex justify-end border-t pt-1">
            <ReportRowActions row={row} canEdit={canEdit} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
