"use client";

import { useState } from "react";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  downloadReportsCsv,
  type AnalyticsRangeParams,
  type CsvExportParams,
} from "@/features/analytics/api";

const EXPORT_OPTIONS: {
  group_by: CsvExportParams["group_by"];
  label: string;
}[] = [
  { group_by: "detail", label: "明細（1行=1報告）" },
  { group_by: "daily", label: "日次集計" },
  { group_by: "weekly", label: "週次集計" },
  { group_by: "monthly", label: "月次集計" },
  { group_by: "client", label: "顧客別集計" },
  { group_by: "staff", label: "従業員別集計" },
  { group_by: "site", label: "現場別集計" },
];

type Props = {
  params: AnalyticsRangeParams;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  className?: string;
};

export function CsvExportMenu({
  params,
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (group_by: CsvExportParams["group_by"]) => {
    setExporting(true);
    try {
      await downloadReportsCsv({ ...params, group_by });
      toast.success("CSVをダウンロードしました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CSV出力に失敗しました");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          CSV出力
          <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>出力形式</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXPORT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.group_by}
            disabled={exporting}
            onClick={() => void handleExport(opt.group_by)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
