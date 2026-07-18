import { lazy } from "react";
import { Heart, Syringe, Activity, Home } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const HealthTrendPage = lazy(() => import("@/pages/student/HealthTrendPage"));
const VaccinePage = lazy(() => import("@/pages/admin/VaccinePage"));
const ScreeningPage = lazy(() => import("@/pages/student/ScreeningPage"));
const SDQPage = lazy(() => import("@/pages/student/SDQPage"));
const HomeVisitPage = lazy(() => import("@/pages/student/HomeVisitPage"));

export default function StudentHealthHubPage() {
  return (
    <TabHubPage
      title="งานอนามัยและคัดกรองนักเรียน"
      subtitle="น้ำหนัก-ส่วนสูง บันทึกวัคซีน คัดกรองสุขภาพ แบบประเมิน SDQ และเยี่ยมบ้าน — รวมในหน้าเดียว"
      icon={Heart}
      tabs={[
        { key: "health", label: "น้ำหนัก-ส่วนสูง", icon: Heart, Component: HealthTrendPage },
        { key: "vaccine", label: "บันทึกวัคซีน", icon: Syringe, Component: VaccinePage },
        { key: "screening", label: "คัดกรองสุขภาพ", icon: Activity, Component: ScreeningPage },
        { key: "sdq", label: "แบบประเมิน SDQ", icon: Activity, Component: SDQPage },
        { key: "home-visit", label: "เยี่ยมบ้านนักเรียน", icon: Home, Component: HomeVisitPage },
      ]}
    />
  );
}
