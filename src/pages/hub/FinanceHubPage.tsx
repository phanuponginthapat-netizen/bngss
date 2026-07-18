import { lazy } from "react";
import { DollarSign, ShoppingCart, Package, Heart, ClipboardCheck } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const BudgetAccountingPage = lazy(() => import("@/pages/hr/BudgetAccountingPage"));
const ProcurementPage = lazy(() => import("@/pages/hr/ProcurementPage"));
const AssetManagementPage = lazy(() => import("@/pages/hr/AssetManagementPage"));
const SubsidyPage = lazy(() => import("@/pages/hr/SubsidyPage"));
const HubProjectsPage = lazy(() => import("@/pages/projects/HubProjectsPage"));

export default function FinanceHubPage() {
  return (
    <TabHubPage
      title="งานการเงินและพัสดุ"
      subtitle="งบประมาณ จัดซื้อจัดจ้าง ทะเบียนทรัพย์สิน เงินอุดหนุน และโครงการฮับ — รวมในหน้าเดียว"
      icon={DollarSign}
      tabs={[
        { key: "budget", label: "งบประมาณและบัญชี", icon: DollarSign, Component: BudgetAccountingPage },
        { key: "procurement", label: "จัดซื้อจัดจ้าง", icon: ShoppingCart, Component: ProcurementPage },
        { key: "assets", label: "ทะเบียนทรัพย์สิน", icon: Package, Component: AssetManagementPage },
        { key: "subsidy", label: "เงินอุดหนุน", icon: Heart, Component: SubsidyPage },
        { key: "projects", label: "โครงการฮับ", icon: ClipboardCheck, Component: HubProjectsPage },
      ]}
    />
  );
}
