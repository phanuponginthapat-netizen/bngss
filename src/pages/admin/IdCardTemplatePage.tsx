import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdCard, Printer } from "lucide-react";
import IdCardTemplateEditor from "@/components/admin/IdCardTemplateEditor";
import PrintCenterPage from "./PrintCenterPage";

const IdCardTemplatePage = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "print" ? "print" : "template";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <IdCard className="w-6 h-6 text-primary" />
          บัตรประจำตัว
        </h1>
        <p className="text-sm text-muted-foreground">
          ออกแบบเทมเพลตและพิมพ์บัตรประจำตัวนักเรียน
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          if (v === "print") next.set("tab", "print");
          else next.delete("tab");
          setParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="template" className="gap-2">
            <IdCard className="w-4 h-4" /> ออกแบบเทมเพลต
          </TabsTrigger>
          <TabsTrigger value="print" className="gap-2">
            <Printer className="w-4 h-4" /> พิมพ์บัตร
          </TabsTrigger>
        </TabsList>
        <TabsContent value="template" className="mt-4">
          <IdCardTemplateEditor />
        </TabsContent>
        <TabsContent value="print" className="mt-4">
          <PrintCenterPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IdCardTemplatePage;
