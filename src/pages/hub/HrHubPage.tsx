import { lazy } from "react";
import { Users, Network, BarChart3, FileText, UserCog, Star, Banknote, BookOpenCheck } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const PersonnelPage = lazy(() => import("@/pages/hr/PersonnelPage"));
const OrgChartPage = lazy(() => import("@/pages/hr/OrgChartPage"));
const AttendanceDashboardPage = lazy(() => import("@/pages/hr/AttendanceDashboardPage"));
const StaffLeavePage = lazy(() => import("@/pages/hr/StaffLeavePage"));
const SubstitutePage = lazy(() => import("@/pages/hr/SubstitutePage"));
const EvaluationPage = lazy(() => import("@/pages/hr/EvaluationPage"));
const SalaryPage = lazy(() => import("@/pages/hr/SalaryPage"));
const IdPlanPage = lazy(() => import("@/pages/hr/IdPlanPage"));

export default function HrHubPage() {
  return (
    <TabHubPage
      title="บุคลากร (HR)"
      subtitle="ทะเบียน · โครงสร้าง · เวลา · ลา · สอนแทน · ประเมิน · เงินเดือน · ID Plan — รวมในหน้าเดียว"
      icon={Users}
      tabs={[
        { key: "personnel", label: "ทะเบียนบุคลากร (P-OBEC)", icon: Users, Component: PersonnelPage },
        { key: "org", label: "โครงสร้างองค์กร", icon: Network, Component: OrgChartPage },
        { key: "attendance", label: "สรุปการมาทำงาน", icon: BarChart3, Component: AttendanceDashboardPage },
        { key: "leave", label: "ใบลาบุคลากร", icon: FileText, Component: StaffLeavePage },
        { key: "substitute", label: "สอนแทน", icon: UserCog, Component: SubstitutePage },
        { key: "evaluation", label: "ประเมิน วPA/DPA", icon: Star, Component: EvaluationPage },
        { key: "salary", label: "เงินเดือน/สวัสดิการ", icon: Banknote, Component: SalaryPage },
        { key: "id-plan", label: "ID Plan", icon: BookOpenCheck, Component: IdPlanPage },
      ]}
    />
  );
}
