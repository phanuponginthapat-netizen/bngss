import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
} from "lucide-react";

interface Result {
  id: string;
  label: string;
  sub?: string;
  to: string;
  group: "student" | "personnel" | "document" | "menu";
}

const MENU: Result[] = [
  { id: "m-dash", label: "Dashboard", to: "/dashboard", group: "menu" },
  { id: "m-inbox", label: "กล่องข้อความ / Inbox", to: "/dashboard/inbox", group: "menu" },
  { id: "m-news", label: "ข่าวสาร", to: "/dashboard/admin/news", group: "menu" },
  { id: "m-doc", label: "หนังสือราชการ / เอกสาร", to: "/dashboard/admin/documents", group: "menu" },
  { id: "m-cal", label: "ปฏิทินวิชาการ", to: "/dashboard/academic/calendar", group: "menu" },
  { id: "m-stu", label: "นักเรียนทั้งหมด", to: "/dashboard/academic/all-students", group: "menu" },
  { id: "m-att", label: "เช็คชื่อนักเรียน", to: "/dashboard/student/attendance", group: "menu" },
  { id: "m-beh", label: "บันทึกพฤติกรรม", to: "/dashboard/student/behavior", group: "menu" },
  { id: "m-users", label: "จัดการผู้ใช้", to: "/dashboard/admin/users", group: "menu" },
  { id: "m-settings", label: "ตั้งค่าระบบ", to: "/dashboard/admin/settings", group: "menu" },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);

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
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const [students, personnel, documents] = await Promise.all([
        supabase
          .from("students")
          .select("id,prefix,first_name,last_name,student_code,classroom_id,classrooms!students_classroom_id_fkey(name)")
          .or(
            `first_name.ilike.${like},last_name.ilike.${like},student_code.ilike.${like}`
          )
          .limit(8),
        supabase
          .from("personnel")
          .select("id,prefix,first_name,last_name,department")
          .or(`first_name.ilike.${like},last_name.ilike.${like}`)
          .limit(8),
        supabase
          .from("documents")
          .select("id,title,doc_number,doc_type")
          .or(`title.ilike.${like},doc_number.ilike.${like}`)
          .limit(8),
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
      (documents.data ?? []).forEach((d: any) =>
        out.push({
          id: `d-${d.id}`,
          label: d.title ?? "(ไม่มีชื่อ)",
          sub: `${d.doc_number ?? ""} • ${d.doc_type ?? ""}`,
          to: `/dashboard/admin/documents`,
          group: "document",
        })
      );
      setResults(out);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate(to);
  };

  const menuFiltered = query
    ? MENU.filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
    : MENU;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="ค้นหานักเรียน บุคลากร เอกสาร หรือเมนู... (Ctrl/⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>ไม่พบผลลัพธ์</CommandEmpty>

        {menuFiltered.length > 0 && (
          <CommandGroup heading="เมนูด่วน">
            {menuFiltered.map((m) => (
              <CommandItem key={m.id} value={`menu-${m.label}`} onSelect={() => go(m.to)}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {m.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.filter((r) => r.group === "student").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="นักเรียน">
              {results
                .filter((r) => r.group === "student")
                .map((r) => (
                  <CommandItem key={r.id} value={r.id + r.label} onSelect={() => go(r.to)}>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        {results.filter((r) => r.group === "personnel").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="บุคลากร">
              {results
                .filter((r) => r.group === "personnel")
                .map((r) => (
                  <CommandItem key={r.id} value={r.id + r.label} onSelect={() => go(r.to)}>
                    <Users className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        {results.filter((r) => r.group === "document").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="เอกสาร">
              {results
                .filter((r) => r.group === "document")
                .map((r) => (
                  <CommandItem key={r.id} value={r.id + r.label} onSelect={() => go(r.to)}>
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
