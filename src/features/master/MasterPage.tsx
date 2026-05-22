"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useClients,
  useSites,
  useStaffs,
  useBusinessTypes,
} from "@/features/master/api";
import { Users, Building2, MapPin, Briefcase, Loader2 } from "lucide-react";

function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
      </td>
    </tr>
  );
}

function ErrorRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-sm text-destructive">
        {message}
      </td>
    </tr>
  );
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "読み込みに失敗しました";
}

export default function MasterPage() {
  const staffsQ = useStaffs();
  const clientsQ = useClients();
  const sitesQ = useSites();
  const btQ = useBusinessTypes();

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
              <CardTitle className="text-sm font-medium">
                スタッフ一覧（{staffsQ.data?.items.length ?? 0}名）
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>名前</th><th>部門</th><th>配属現場数</th><th className="text-right">時給</th></tr>
                  </thead>
                  <tbody>
                    {staffsQ.isLoading && <LoadingRow colSpan={4} />}
                    {staffsQ.isError && <ErrorRow colSpan={4} message={errorMessage(staffsQ.error)} />}
                    {staffsQ.data?.items.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="font-medium text-sm">{s.name}</td>
                        <td className="text-sm">{s.department_name}</td>
                        <td className="text-sm text-muted-foreground">{s.site_ids.length}</td>
                        <td className="text-right text-sm">¥{s.hourly_rate.toLocaleString()}</td>
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
                  {clientsQ.isLoading && <LoadingRow colSpan={2} />}
                  {clientsQ.isError && <ErrorRow colSpan={2} message={errorMessage(clientsQ.error)} />}
                  {clientsQ.data?.items.map((c) => (
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
                    {sitesQ.isLoading && <LoadingRow colSpan={3} />}
                    {sitesQ.isError && <ErrorRow colSpan={3} message={errorMessage(sitesQ.error)} />}
                    {sitesQ.data?.items.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="font-medium text-sm">{s.name}</td>
                        <td className="text-sm">{s.client_name}</td>
                        <td className="text-right text-sm">{s.radius_m}m</td>
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
                  {btQ.isLoading && <LoadingRow colSpan={2} />}
                  {btQ.isError && <ErrorRow colSpan={2} message={errorMessage(btQ.error)} />}
                  {btQ.data?.items.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="font-medium text-sm">{b.name}</td>
                      <td className="text-sm">{b.client_name}</td>
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
