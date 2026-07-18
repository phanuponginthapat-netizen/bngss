import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap,
  Users,
  FileText,
  LayoutDashboard,
  Calendar,
  Settings,
  Inbox,
  Newspaper,
  ClipboardList,
  Building2,
  FileSignature,
  Clock,
  Plus,
  CheckCircle2,
  History,
  Zap,
} from "lucide-react";

interface Result {
  id: string;
  label: string;
  sub?: string;
  to: string;
  group:
    | "student"
    | "personnel"
    | "document"
    | "classroom"
    | "eform"
    | "news"
    | "menu"
    | "action";
}

const MENU: Result[] = [
  { id: "m-dash", label: "Dashboard", to: "/dashboard", group: "menu" },
  { id: "m-inbox", label: "กล่องข้อความ / Inbox", to: "/dashboard/inbox", group: "menu" },
  { id: "m-eform-inbox", label: "E-Form Inbox", to: "/dashboard/eform/inbox", group: "menu" },
  { id: "m-news", label: "ข่าวสาร", to: "/dashboard/admin/news", group: "menu" },
  { id: "m-doc", label: "หนังสือราชการ / เอกสาร", to: "/dashboard/admin/document", group: "menu" },
  { id: "m-cal", label: "ปฏิทินวิชาการ", to: "/dashboard/academic/calendar", group: "menu" },
  { id: "m-stu", label: "นักเรียนทั้งหมด", to: "/dashboard/academic/all-students", group: "menu" },
  { id: "m-att", label: "เช็คชื่อนักเรียน", to: "/dashboard/student/attendance", group: "menu" },
  { id: "m-beh", label: "บันทึกพฤติกรรม", to: "/dashboard/student/behavior", group: "menu" },
  { id: "m-hw", label: "การบ้าน", to: "/dashboard/homework", group: "menu" },
  { id: "m-hr", label: "บุคลากร / HR", to: "/dashboard/hr/personnel", group: "menu" },
  { id: "m-leave", label: "ใบลา", to: "/dashboard/hr/leave", group: "menu" },
  { id: "m-assets", label: "ครุภัณฑ์/สินทรัพย์", to: "/dashboard/finance/assets", group: "menu" },
  { id: "m-hub", label: "Spider Hub / Live Ops", to: "/dashboard/spider-hub", group: "menu" },
  { id: "m-users", label: "จัดการผู้ใช้", to: "/dashboard/admin/users", group: "menu" },
  { id: "m-settings", label: "ตั้งค่าระบบ", to: "/dashboard/admin/settings", group: "menu" },
];

const QUICK_ACTIONS: Result[] = [
  { id: "qa-att", label: "เช็คชื่อวันนี้", sub: "บันทึกการเข้าเรียนห้องของฉัน", to: "/dashboard/student/attendance", group: "action" },
  { id: "qa-news", label: "เขียนข่าวใหม่", sub: "สร้างประกาศ/ข่าวสาร", to: "/dashboard/admin/news?new=1", group: "action" },
  { id: "qa-eform", label: "ส่งเอกสาร E-Form", sub: "สร้าง E-Form ส่งผู้รับ", to: "/dashboard/admin/eforms?new=1", group: "action" },
  { id: "qa-leave", label: "ขอลา", sub: "ยื่นใบลาบุคลากร", to: "/dashboard/hr/leave?new=1", group: "action" },
  { id: "qa-hw", label: "มอบหมายการบ้าน", sub: "สร้างการบ้านใหม่", to: "/dashboard/homework?new=1", group: "action" },
];

const RECENT_KEY = "cmdk_recent_v1";
const RECENT_MAX = 8;

function loadRecent(): Result[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Result[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: Result) {
  try {
    const list = loadRecent().filter((r) => r.id !== item.id);
    list.unshift(item);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // ignore
  }
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [recent, setRecent] = useState<Result[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const [students, personnel, documents, classrooms, eforms, news] = await Promise.all([
        supabase
          .from("students")
          .select("id,prefix,first_name,last_name,student_code,classroom_id,classrooms!students_classroom_id_fkey(name)")
          .or(`first_name.ilike.${like},last_name.ilike.${like},student_code.ilike.${like}`)
          .limit(6),
        supabase
          .from("personnel")
          .select("id,prefix,first_name,last_name,department")
          .or(`first_name.ilike.${like},last_name.ilike.${like}`)
          .limit(6),
        supabase
          .from("documents")
          .select("id,title,doc_number,doc_type")
          .or(`title.ilike.${like},doc_number.ilike.${like}`)
          .limit(5),
        supabase
          .from("classrooms")
          .select("id,name,grade_level")
          .ilike("name", like)
          .limit(5),
        supabase
          .from("eforms")
          .select("id,title,form_type,status")
          .ilike("title", like)
          .limit(5),
        supabase
          .from("news_posts")
          .select("id,title,published_at")
          .ilike("title", like)
          .limit(5),
      ]);

      if (cancelled) return;
      const out: Result[] = [];
      (students.data ?? []).forEach((s: any) =>
        out.push({
          id: `s-${s.id}`,
          label: `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
          sub: `${s.student_code ?? ""} • ${s.classrooms?.name ?? ""}`,
          to: `/dashboard/academic/students/${s.id}`,
          group: "student",
        })
      );
      (personnel.data ?? []).forEach((p: any) =>
        out.push({
          id: `p-${p.id}`,
          label: `${p.prefix ?? ""}${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
          sub: p.department ?? "",
          to: `/dashboard/profile/${p.id}`,
          group: "personnel",
        })
      );
      (classrooms.data ?? []).forEach((c: any) =>
        out.push({
          id: `c-${c.id}`,
          label: c.name,
          sub: c.grade_level ?? "",
          to: `/dashboard/academic/classrooms`,
          group: "classroom",
        })
      );
      (documents.data ?? []).forEach((d: any) =>
        out.push({
          id: `d-${d.id}`,
          label: d.title ?? "(ไม่มีชื่อ)",
          sub: `${d.doc_number ?? ""} • ${d.doc_type ?? ""}`,
          to: `/dashboard/admin/document`,
          group: "document",
        })
      );
      (eforms.data ?? []).forEach((e: any) =>
        out.push({
          id: `e-${e.id}`,
          label: e.title ?? "(ไม่มีชื่อ)",
          sub: `${e.form_type ?? ""} • ${e.status ?? ""}`,
          to: `/dashboard/eform/inbox`,
          group: "eform",
        })
      );
      (news.data ?? []).forEach((n: any) =>
        out.push({
          id: `n-${n.id}`,
          label: n.title ?? "(ไม่มีชื่อ)",
          sub: n.published_at ? new Date(n.published_at).toLocaleDateString("th-TH") : "",
          to: `/dashboard/news/${n.id}`,
          group: "news",
        })
      );
      setResults(out);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (item: Result) => {
    saveRecent(item);
    setOpen(false);
    setQuery("");
    navigate(item.to);
  };

  const menuFiltered = useMemo(
    () =>
      query
        ? MENU.filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
        : MENU.slice(0, 6),
    [query]
  );

  const actionsFiltered = useMemo(
    () =>
      query
        ? QUICK_ACTIONS.filter(
            (a) =>
              a.label.toLowerCase().includes(query.toLowerCase()) ||
              (a.sub ?? "").toLowerCase().includes(query.toLowerCase())
          )
        : QUICK_ACTIONS,
    [query]
  );

  const iconFor = (g: Result["group"]) => {
    switch (g) {
      case "student": return GraduationCap;
      case "personnel": return Users;
      case "document": return FileText;
      case "classroom": return Building2;
      case "eform": return FileSignature;
      case "news": return Newspaper;
      case "action": return Zap;
      default: return LayoutDashboard;
    }
  };

  const renderItems = (list: Result[]) =>
    list.map((r) => {
      const Icon = iconFor(r.group);
      return (
        <CommandItem key={r.id} value={r.id + r.label} onSelect={() => go(r)}>
          <Icon className="mr-2 h-4 w-4 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="truncate">{r.label}</span>
            {r.sub && <span className="text-xs text-muted-foreground truncate">{r.sub}</span>}
          </div>
        </CommandItem>
      );
    });

  const grouped = (g: Result["group"]) => results.filter((r) => r.group === g);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="ค้นหานักเรียน บุคลากร เอกสาร ห้องเรียน E-Form ข่าว หรือเมนู..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>ไม่พบผลลัพธ์</CommandEmpty>

        {!query && recent.length > 0 && (
          <CommandGroup heading="ล่าสุด">
            {recent.map((r) => {
              const Icon = iconFor(r.group);
              return (
                <CommandItem key={`rc-${r.id}`} value={`recent-${r.id}`} onSelect={() => go(r)}>
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{r.label}</span>
                    {r.sub && <span className="text-xs text-muted-foreground truncate">{r.sub}</span>}
                  </div>
                  <Icon className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {actionsFiltered.length > 0 && (
          <>
            {!query && recent.length > 0 && <CommandSeparator />}
            <CommandGroup heading="ทางลัด">{renderItems(actionsFiltered)}</CommandGroup>
          </>
        )}

        {menuFiltered.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="เมนู">{renderItems(menuFiltered)}</CommandGroup>
          </>
        )}

        {grouped("student").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="นักเรียน">{renderItems(grouped("student"))}</CommandGroup>
          </>
        )}
        {grouped("personnel").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="บุคลากร">{renderItems(grouped("personnel"))}</CommandGroup>
          </>
        )}
        {grouped("classroom").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="ห้องเรียน">{renderItems(grouped("classroom"))}</CommandGroup>
          </>
        )}
        {grouped("eform").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="E-Form">{renderItems(grouped("eform"))}</CommandGroup>
          </>
        )}
        {grouped("document").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="เอกสาร">{renderItems(grouped("document"))}</CommandGroup>
          </>
        )}
        {grouped("news").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="ข่าวสาร">{renderItems(grouped("news"))}</CommandGroup>
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          ค้นหาอย่างรวดเร็วทุกที่
        </span>
        <span className="flex items-center gap-2">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
          เลือก
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
          เปิด
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
          ปิด
        </span>
      </div>
    </CommandDialog>
  );
}
