import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, FileSpreadsheet, Presentation, FileType, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./office.css";

const apps = { docs: { title: "เอกสาร", icon: FileText }, sheets: { title: "ตารางคำนวณ", icon: FileSpreadsheet }, slides: { title: "นำเสนอ", icon: Presentation }, pdf: { title: "PDF", icon: FileType } };

export function OfficeWorkspace({ app, name, onNameChange, actions, children, status, ribbon }: { app: keyof typeof apps; name: string; onNameChange: (v: string) => void; actions: ReactNode; children: ReactNode; status?: string; ribbon?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = apps[app].icon;
  useEffect(() => {
    if (!expanded) return;
    const old = document.body.style.overflow; document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = old; window.removeEventListener("keydown", escape); };
  }, [expanded]);
  return <section className={`office-workspace office-app-${app} ${expanded ? "office-expanded" : ""}`}>
    <header className="office-titlebar bg-background border-b shrink-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="กลับ Office Suite" aria-label="กลับ Office Suite" asChild><Link to="/dashboard/office"><ArrowLeft /></Link></Button>
        <span className="office-app-icon rounded p-2 shrink-0"><Icon className="h-5 w-5" /></span>
        <Input aria-label="ชื่อไฟล์" value={name} onChange={e => onNameChange(e.target.value)} className="office-filename h-9 min-w-0 flex-1 sm:max-w-72 border-transparent bg-transparent font-medium focus-visible:bg-background" />
        <div className="ml-auto"> <Button variant="ghost" size="icon" title={expanded ? "ย่อพื้นที่ทำงาน" : "เต็มจอ"} aria-label={expanded ? "ย่อพื้นที่ทำงาน" : "เต็มจอ"} onClick={() => setExpanded(v => !v)}>{expanded ? <Minimize /> : <Maximize />}</Button></div>
      </div>
      <div className="office-ribbon flex flex-wrap items-center gap-2 px-3 py-2">{actions}</div>
      {ribbon}
    </header>
    <div className="flex-1 min-h-0 min-w-0 overflow-auto flex flex-col">{children}</div>
    <footer className="shrink-0 border-t bg-background px-3 py-1.5 text-xs text-muted-foreground flex justify-between gap-2"><span>{apps[app].title}</span><span>{status || "ไฟล์ในพื้นที่ทำงาน"}</span></footer>
  </section>;
}