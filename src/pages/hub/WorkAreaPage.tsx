import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { buildWorkAreas, visibleWorkAreas } from "@/lib/navigation/workAreas";
import ModuleLoader from "@/components/ModuleLoader";

export default function WorkAreaPage() {
  const { area } = useParams();
  const { lang } = useLanguage();
  const { role, loading } = useUserRole();
  const { isModuleEnabled } = useModuleToggles();
  const [search, setSearch] = useState("");
  const current = visibleWorkAreas(buildWorkAreas(lang), role, isModuleEnabled).find(a => a.key === area);
  if (loading) return <ModuleLoader />;
  if (!current) return <div className="py-12 text-center"><h1 className="text-xl font-semibold">ไม่พบงานที่เปิดใช้งานสำหรับบัญชีนี้</h1><Button asChild variant="link"><Link to="/dashboard">กลับหน้าหลัก</Link></Button></div>;
  const query = search.trim().toLowerCase();
  const groups = current.groups.map(g => ({ ...g, items: g.items.filter(i => `${g.label} ${i.title} ${i.desc ?? ""}`.toLowerCase().includes(query)) })).filter(g => g.items.length);
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><current.icon className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">{current.label}</h1></div>
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="ค้นหางานในฝ่าย" placeholder="ค้นหางาน…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      </header>
      {groups.map(g => (
        <section key={g.key} className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><g.icon className="h-4 w-4 text-muted-foreground" />{g.label}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map(i => <Button key={i.url} variant="outline" asChild className="h-auto min-h-24 justify-start whitespace-normal rounded-lg bg-card px-4 py-4 text-left hover:scale-100">
              <Link to={i.url} className="group"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><i.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block break-words font-semibold">{i.title}</span>{i.desc && <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{i.desc}</span>}</span><ArrowUpRight className="shrink-0 text-muted-foreground group-hover:text-primary" /></Link>
            </Button>)}
          </div>
        </section>
      ))}
      {!groups.length && <p className="py-10 text-center text-muted-foreground">ไม่พบงานที่ตรงกับคำค้น</p>}
    </div>
  );
}