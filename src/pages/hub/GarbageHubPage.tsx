import { lazy } from "react";
import { Recycle, BarChart3, Coins, ClipboardCheck, Package, History, TrendingUp, Trophy } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const GarbageDashboardPage = lazy(() => import("@/pages/garbage/GarbageDashboardPage"));
const GarbageMyPage = lazy(() => import("@/pages/garbage/GarbageMyPage"));
const GarbageCounterPage = lazy(() => import("@/pages/garbage/GarbageCounterPage"));
const GarbageItemsPage = lazy(() => import("@/pages/garbage/GarbageItemsPage"));
const GarbageHistoryPage = lazy(() => import("@/pages/garbage/GarbageHistoryPage"));
const GarbageReportsPage = lazy(() => import("@/pages/garbage/GarbageReportsPage"));
const GarbageAchievementsPage = lazy(() => import("@/pages/garbage/GarbageAchievementsPage"));

export default function GarbageHubPage() {
  return (
    <TabHubPage
      title="ธนาคารขยะโรงเรียน"
      subtitle="ภาพรวม จุดรับ-ฝาก รายการขยะ ประวัติ รายงาน และเหรียญตรา — รวมในหน้าเดียว"
      icon={Recycle}
      tabs={[
        { key: "dashboard", label: "ภาพรวม", icon: BarChart3, Component: GarbageDashboardPage },
        { key: "my", label: "แต้มของฉัน", icon: Coins, Component: GarbageMyPage },
        { key: "counter", label: "จุดรับ-ฝากขยะ", icon: ClipboardCheck, Component: GarbageCounterPage },
        { key: "items", label: "รายการขยะและรางวัล", icon: Package, Component: GarbageItemsPage },
        { key: "history", label: "ประวัติ", icon: History, Component: GarbageHistoryPage },
        { key: "reports", label: "รายงาน", icon: TrendingUp, Component: GarbageReportsPage },
        { key: "achievements", label: "เหรียญตรา", icon: Trophy, Component: GarbageAchievementsPage },
      ]}
    />
  );
}
