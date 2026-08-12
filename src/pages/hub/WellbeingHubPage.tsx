import { lazy } from "react";
import { HeartPulse, Compass, BarChart3, Sparkles } from "lucide-react";
import TabHubPage, { type HubTab } from "@/components/hub/TabHubPage";
import { useUserRole } from "@/hooks/useUserRole";

const MentalHealthPage = lazy(() => import("@/pages/student/MentalHealthPage"));
const CareerAptitudePage = lazy(() => import("@/pages/student/CareerAptitudePage"));
const WellbeingDashboard = lazy(() => import("@/components/wellbeing/WellbeingDashboard"));

export default function WellbeingHubPage() {
  const { role } = useUserRole();
  const isStaff = role === "admin" || role === "director" || role === "teacher";

  const tabs: HubTab[] = [
    { key: "mental", label: "เช็คใจ (สุขภาพจิต)", icon: HeartPulse, Component: MentalHealthPage },
    { key: "career", label: "ค้นหาแววอาชีพ", icon: Compass, Component: CareerAptitudePage },
  ];
  if (isStaff) {
    tabs.push({ key: "dashboard", label: "แดชบอร์ดติดตาม", icon: BarChart3, Component: WellbeingDashboard });
  }

  return (
    <TabHubPage
      title="สุขภาพใจและแววอาชีพนักเรียน"
      subtitle="แบบประเมินสุขภาพจิตตามมาตรฐานกรมสุขภาพจิต และแบบวัดแววความสามารถ 8 ด้านตามแนวทางกระทรวงศึกษาธิการ"
      icon={Sparkles}
      tabs={tabs}
    />
  );
}
