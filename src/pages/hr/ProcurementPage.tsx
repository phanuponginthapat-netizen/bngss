import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, LayoutDashboard, Wallet, FileText, Coins, FolderKanban } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import WorkflowOverview from "@/components/procurement/WorkflowOverview";
import AdvanceLoanTab from "@/components/procurement/AdvanceLoanTab";
import ProcurementListTab from "@/components/procurement/ProcurementListTab";
import ClearingTab from "@/components/procurement/ClearingTab";
import HubProjectsPage from "@/pages/projects/HubProjectsPage";

const ProcurementPage = () => {
  const { isAdmin, isDirector } = useUserRole();
  const canManage = isAdmin || isDirector;
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";

  const { data: records = [] } = useQuery({
    queryKey: ["procurement_records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("procurement_records")
        .select("*")
        .order("procurement_date", { ascending: false });
      return data || [];
    },
  });

  const { data: advances = [] } = useQuery({
    queryKey: ["procurement_advances"],
    queryFn: async () => {
      const { data } = await supabase
        .from("procurement_advances")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-primary" />
          งานงบประมาณ &amp; พัสดุ (e-GP)
        </h1>
        <p className="text-sm text-muted-foreground">ตั้งโครงการตามปีงบประมาณ → ยืม/อนุมัติ → จัดซื้อ → ล้างหนี้</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="w-4 h-4" />ภาพรวม</TabsTrigger>
          <TabsTrigger value="projects" className="gap-2"><FolderKanban className="w-4 h-4" />โครงการพิเศษ / ตามปีงบ</TabsTrigger>
          <TabsTrigger value="advance" className="gap-2"><Wallet className="w-4 h-4" />ยืมเงินรองราชการ</TabsTrigger>
          <TabsTrigger value="purchase" className="gap-2"><FileText className="w-4 h-4" />จัดซื้อ/จ้าง</TabsTrigger>
          <TabsTrigger value="clearing" className="gap-2"><Coins className="w-4 h-4" />ล้างหนี้ EGPEASY</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><WorkflowOverview records={records} advances={advances} /></TabsContent>
        <TabsContent value="projects"><HubProjectsPage /></TabsContent>
        <TabsContent value="advance"><AdvanceLoanTab canManage={canManage} /></TabsContent>
        <TabsContent value="purchase"><ProcurementListTab records={records} advances={advances} canManage={canManage} /></TabsContent>
        <TabsContent value="clearing"><ClearingTab records={records} canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcurementPage;
