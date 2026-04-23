"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Bell, Shield, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-header">設定</h1>
        <p className="text-sm text-muted-foreground -mt-2">システム設定の管理</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            一般設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">会社名</Label>
            <Input defaultValue="株式会社サンプル" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GPS判定距離（デフォルト）</Label>
            <Input type="number" defaultValue="100" className="h-9" />
            <p className="text-[10px] text-muted-foreground">現場からの許容距離（メートル）</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            通知設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">未出勤アラート</p>
              <p className="text-xs text-muted-foreground">予定時刻を過ぎても打刻がない場合に通知</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">業務報告リマインダー</p>
              <p className="text-xs text-muted-foreground">退勤後30分以内に報告がない場合に通知</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            データ管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">画像保存期間</p>
              <p className="text-xs text-muted-foreground">報告画像の自動削除期間</p>
            </div>
            <span className="text-sm text-muted-foreground">12ヶ月</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">バックアップ</p>
              <p className="text-xs text-muted-foreground">最終バックアップ: 2026/04/08 03:00</p>
            </div>
            <Button variant="outline" size="sm">手動実行</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
