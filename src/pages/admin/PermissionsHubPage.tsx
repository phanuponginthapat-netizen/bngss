import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Bell, Power, Users, KeyRound } from "lucide-react";
import NotificationMatrixPage from "./NotificationMatrixPage";
import ModuleTogglesPage from "./ModuleTogglesPage";
import DepartmentManagementPage from "./DepartmentManagementPage";

export default function PermissionsHubPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "notifications";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          ศูนย์จัดการสิทธิ์และการแจ้งเตือน
        </h1>
        <p className="text-sm text-muted-foreground">
          รวมทุกการตั้งค่าสิทธิ์ผู้ใช้ · โมดูล · แผนก · matrix การแจ้งเตือน ไว้ที่เดียว
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(sp);
          next.set("tab", v);
          setSp(next, { replace: true });
        }}
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="notifications" className="gap-1">
            <Bell className="w-4 h-4" /> Matrix การแจ้งเตือน
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1">
            <Power className="w-4 h-4" /> โมดูล
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1">
            <Users className="w-4 h-4" /> แผนก / ฝ่าย
          </TabsTrigger>
          <TabsTrigger value="grants" className="gap-1">
            <KeyRound className="w-4 h-4" /> สิทธิ์เพิ่มเติม
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notifications" className="mt-4">
          <NotificationMatrixPage />
        </TabsContent>
        <TabsContent value="modules" className="mt-4">
          <ModuleTogglesPage />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentManagementPage />
        </TabsContent>
        <TabsContent value="grants" className="mt-4">
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            การให้สิทธิ์เพิ่มเติมรายบุคคล (admin_permission_grants) จะเปิดในเวอร์ชันถัดไป
            ตอนนี้ใช้การกำหนดบทบาทหลักผ่านหน้า
            <a href="/user-management" className="text-primary underline mx-1">จัดการผู้ใช้</a>
            หรือแผนกผ่านแท็บด้านบน
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
