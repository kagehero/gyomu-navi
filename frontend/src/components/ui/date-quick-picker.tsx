"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayJST, jstDateNDaysAgo } from "@/lib/dates";

type Preset = { label: string; date: string };

const baseDate = (offsetDays: number): string =>
  jstDateNDaysAgo(offsetDays);

/**
 * Date picker with quick presets ("今日" / "昨日" / "先週") sized for
 * one-tap mobile use. Variant 'employee' shows only 今日 / 昨日; 'admin'
 * adds 先週/今月/先月.
 */
export function DateQuickPicker({
  value,
  onChange,
  variant = "employee",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  variant?: "employee" | "admin";
  className?: string;
}) {
  const today = todayJST();
  const presets: Preset[] = [
    { label: "今日", date: today },
    { label: "昨日", date: baseDate(1) },
    ...(variant === "admin"
      ? [
          { label: "1週間前", date: baseDate(7) },
          { label: "1ヶ月前", date: baseDate(30) },
        ]
      : []),
  ];

  return (
    <div className={className}>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">報告日</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={value}
            max={today}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-auto min-w-[140px] text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant={value === p.date ? "default" : "outline"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => onChange(p.date)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
