import { Suspense, ComponentType, LazyExoticComponent } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LucideIcon } from "lucide-react";

export type HubTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  Component: LazyExoticComponent<ComponentType<any>> | ComponentType<any>;
};

type Props = {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tabs: HubTab[];
};

export default function TabHubPage({ title, subtitle, icon: Icon, tabs }: Props) {
  const [sp, setSp] = useSearchParams();
  const active = sp.get("tab") || tabs[0]?.key;
  const setTab = (v: string) => {
    const next = new URLSearchParams(sp);
    next.set("tab", v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Icon className="w-6 h-6 text-primary" />
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <Tabs value={active} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => {
          const C = t.Component;
          return (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <Suspense
                fallback={
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    กำลังโหลด...
                  </div>
                }
              >
                <C />
              </Suspense>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
