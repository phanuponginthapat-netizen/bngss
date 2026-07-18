import { lazy } from "react";
import { Server, BarChart3, Activity, ShieldCheck, Settings } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const SystemUpdatePage = lazy(() => import("@/pages/admin/SystemUpdatePage"));
const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage"));
const TestScoresPage = lazy(() => import("@/pages/admin/TestScoresPage"));
const SmscCenterPage = lazy(() => import("@/pages/admin/SmscCenterPage"));

export default function AdminReportsHubPage() {
  return (
    <TabHubPage
      title="ระบบและรายงานผู้ดูแล"
      subtitle="อัปเดต บันทึกการใช้งาน คะแนน และมาตรฐาน สมศ./สพฐ. — รวมในหน้าเดียว"
      icon={Settings}
      tabs={[
        { key: "system-update", label: "อัปเดต สำรอง และซิงค์", icon: Server, Component: SystemUpdatePage },
        { key: "audit", label: "บันทึกการใช้งานระบบ", icon: Activity, Component: AuditLogPage },
        { key: "test-scores", label: "คะแนน O-NET / NT / PISA", icon: BarChart3, Component: TestScoresPage },
        { key: "smsc", label: "มาตรฐาน สมศ./สพฐ.", icon: ShieldCheck, Component: SmscCenterPage },
      ]}
    />

  );
}
