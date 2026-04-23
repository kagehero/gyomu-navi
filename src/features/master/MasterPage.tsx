"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  staffs,
  clientCompanies,
  sites,
  departments,
  businessTypes,
  getDepartmentName,
  getClientName,
} from "@/lib/mockData";
import { Users, Building2, MapPin, Briefcase } from "lucide-react";

export default function MasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">マスタ管理</h1>
        <p className="text-sm text-muted-foreground -mt-2">各種マスタデータの管理</p>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff" className="gap-1.5"><Users className="h-3.5 w-3.5" />スタッフ</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />顧客</TabsTrigger>
          <TabsTrigger value="sites" className="gap-1.5"><MapPin className="h-3.5 w-3.5" />現場</TabsTrigger>
          <TabsTrigger value="business" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" />業務内容</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">スタッフ一覧（{staffs.length}名）</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>名前</th><th>権限</th><th>部門</th><th className="text-right">時給</th></tr>
                  </thead>
                  <tbody>
                    {staffs.map(s => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="font-medium text-sm">{s.name}</td>
                        <td>
                          <span className={`status-badge ${s.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {s.role === "admin" ? "管理者" : "スタッフ"}
                          </span>
                        </td>
                        <td className="text-sm">{getDepartmentName(s.departmentId)}</td>
                        <td className="text-right text-sm">¥{s.hourlyRate.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">顧客企業一覧</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="data-table">
                <thead><tr><th>企業名</th><th>コード</th></tr></thead>
                <tbody>
                  {clientCompanies.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="font-medium text-sm">{c.name}</td>
                      <td className="text-sm text-muted-foreground">{c.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">現場拠点一覧</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>現場名</th><th>顧客</th><th className="text-right">判定半径</th></tr></thead>
                  <tbody>
                    {sites.map(s => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="font-medium text-sm">{s.name}</td>
                        <td className="text-sm">{getClientName(s.clientId)}</td>
                        <td className="text-right text-sm">{s.radiusM}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">業務内容一覧</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="data-table">
                <thead><tr><th>業務名</th><th>顧客</th></tr></thead>
                <tbody>
                  {businessTypes.map(b => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="font-medium text-sm">{b.name}</td>
                      <td className="text-sm">{getClientName(b.clientId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
