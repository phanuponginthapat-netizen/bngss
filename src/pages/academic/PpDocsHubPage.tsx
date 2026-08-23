import { lazy, Suspense, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Award, FileText, BookOpen, FolderOpen } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const CertificatePage = lazy(() => import("./CertificatePage"));
const Pp3Page = lazy(() => import("./Pp3Page"));
const Pp4Page = lazy(() => import("./Pp4Page"));
const Pp7Page = lazy(() => import("./Pp7Page"));
const Pp8Page = lazy(() => import("./Pp8Page"));

const TABS = [
  { key: "pp2", label: "ปพ.2 วุฒิ", icon: Award, roles: ["admin", "director"], El: CertificatePage },
  { key: "pp3", label: "ปพ.3 ผู้จบ", icon: FileText, roles: ["admin", "director"], El: Pp3Page },
  { key: "pp4", label: "ปพ.4 พัฒนา", icon: BookOpen, roles: ["admin", "director", "teacher"], El: Pp4Page },
  { key: "pp7", label: "ปพ.7 ใบรับรอง", icon: FileText, roles: ["admin", "director"], El: Pp7Page },
  { key: "pp8", label: "ปพ.8 ระเบียนสะสม", icon: FolderOpen, roles: ["admin", "director", "teacher"], El: Pp8Page },
] as const;

export default function PpDocsHubPage() {
  const { role } = useUserRole();
  const [params, setParams] = useSearchParams();
  const allowed = TABS.filter((t) => !role || (t.roles as readonly string[]).includes(role));
  const initial = params.get("tab") || allowed[0]?.key || "pp2";
  const [tab, setTab] = useState(initial);

  // sync state → URL
  useEffect(() => {
    if (params.get("tab") !== tab) {
      const p = new URLSearchParams(params);
      p.set("tab", tab);
      setParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // sync URL → state (back/forward button)
  useEffect(() => {
    const urlTab = params.get("tab");
    if (urlTab && urlTab !== tab && allowed.some((t) => t.key === urlTab)) {
      setTab(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            เอกสารจบการศึกษา (ปพ.2 / 3 / 4 / 7 / 8)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex flex-wrap h-auto">
              {allowed.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  <t.icon className="w-4 h-4" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {allowed.map((t) => (
              <TabsContent key={t.key} value={t.key} className="mt-4">
                <ErrorBoundary label={`PpDocsHub:${t.key}`}>
                  <Suspense fallback={<div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>}>
                    <t.El />
                  </Suspense>
                </ErrorBoundary>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
