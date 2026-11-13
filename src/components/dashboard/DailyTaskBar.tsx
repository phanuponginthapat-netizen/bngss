import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { priorityTasks } from "@/lib/navigation/taskEntry";
import { Calendar, BookOpenCheck, ClipboardList, Heart, FileText, Inbox, ChevronDown } from "lucide-react";
import { getModuleKeyForPath } from "@/lib/moduleRegistry";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const SuperAppShortcuts = lazy(() => import("@/components/dashboard/SuperAppShortcuts"));
const BrowserShortcutsGrid = lazy(() => import("@/components/browser/BrowserShortcutsGrid"));

export default function DailyTaskBar() {
  const { role } = useUserRole();
  const { lang } = useLanguage();
  const { isModuleEnabled } = useModuleToggles();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = role === "parent" ? [
    { title: "การมาเรียนของลูก", url: "/dashboard/student/attendance", icon: ClipboardList },
    { title: "การบ้าน", url: "/dashboard/homework", icon: BookOpenCheck },
    { title: "ตารางเรียน", url: "/dashboard/academic/schedule", icon: Calendar },
    { title: "ยื่นใบลา", url: "/dashboard/student/leave", icon: FileText },
    { title: "สุขภาพ", url: "/dashboard/student/health-trend", icon: Heart },
    { title: "กล่องข้อความ", url: "/dashboard/inbox", icon: Inbox },
  ].filter(item => isModuleEnabled(getModuleKeyForPath(item.url))) : priorityTasks(role, lang, isModuleEnabled);
  if (!items.length) return null;
  return <section data-tour="taskbar" className="border-b border-border pb-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{lang === "th" ? role === "parent" ? "ลูกของฉัน" : "งานของฉัน" : "My work"}</h2>
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" aria-controls="dashboard-extra-shortcuts">
            {lang === "th" ? "เพิ่มเติม" : "More"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
    </div>
    <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
      {items.map(item => <Button key={item.url} asChild variant="outline" className="h-auto min-h-24 flex-col justify-start gap-2 whitespace-normal rounded-md px-2 py-3 text-center text-xs sm:min-h-14 sm:flex-row sm:items-center sm:justify-start sm:px-3 sm:text-left">
        <Link to={item.url}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:h-6 sm:w-6"><item.icon className="h-5 w-5 text-primary sm:h-4 sm:w-4" /></span><span className="min-w-0 break-words leading-5">{item.title}</span></Link>
      </Button>)}
    </div>
    <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
      <CollapsibleContent id="dashboard-extra-shortcuts" className="space-y-4 pt-4">
        {moreOpen && <Suspense fallback={<p className="text-xs text-muted-foreground">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</p>}>
          <SuperAppShortcuts unframed excludeUrls={items.map(item => item.url)} />
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-medium text-muted-foreground">{lang === "th" ? "เว็บไซต์และบริการ" : "Websites & services"}</h3>
            <BrowserShortcutsGrid />
          </div>
        </Suspense>}
      </CollapsibleContent>
    </Collapsible>
  </section>;
}