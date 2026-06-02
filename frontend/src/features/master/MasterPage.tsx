"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, MapPin, Briefcase, Boxes, Layers } from "lucide-react";
import MasterStaffsCrud from "@/features/master/MasterStaffsCrud";
import MasterClientsCrud from "@/features/master/MasterClientsCrud";
import MasterSitesCrud from "@/features/master/MasterSitesCrud";
import MasterBusinessTypesCrud from "@/features/master/MasterBusinessTypesCrud";
import MasterDepartmentsCrud from "@/features/master/MasterDepartmentsCrud";
import MasterBusinessLinesCrud from "@/features/master/MasterBusinessLinesCrud";

export default function MasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">マスタ管理</h1>
        <p className="text-sm text-muted-foreground -mt-2">各種マスタデータの管理</p>
      </div>

      <Tabs defaultValue="staff">
        <TabsList className="flex-wrap">
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            スタッフ
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5">
            <Boxes className="h-3.5 w-3.5" />
            社内部門
          </TabsTrigger>
          <TabsTrigger value="business-lines" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            報告部門
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            顧客
          </TabsTrigger>
          <TabsTrigger value="sites" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            拠点
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            業務内容
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <MasterStaffsCrud />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <MasterDepartmentsCrud />
        </TabsContent>
        <TabsContent value="business-lines" className="mt-4">
          <MasterBusinessLinesCrud />
        </TabsContent>
        <TabsContent value="clients" className="mt-4">
          <MasterClientsCrud />
        </TabsContent>
        <TabsContent value="sites" className="mt-4">
          <MasterSitesCrud />
        </TabsContent>
        <TabsContent value="business" className="mt-4">
          <MasterBusinessTypesCrud />
        </TabsContent>
      </Tabs>
    </div>
  );
}
