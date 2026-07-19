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
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import {
  GraduationCap,
  Users,
  FileText,
  LayoutDashboard,
} from "lucide-react";

interface Result {
  id: string;
  label: string;
  sub?: string;
  to: string;
  group: "student" | "personnel" | "document" | "menu";
}

// เมนูด่วน + สิทธิ์ที่มองเห็นได้
type MenuItem = { id: string; label: string; to: string; roles: AppRole[] };
const ALL: AppRole[] = ["admin", "director", "teacher", "student", "parent", "alumni"];

const MENU: MenuItem[] = [
  { id: "m-dash", label: "Dashboard", to: "/dashboard", roles: ALL },
  { id: "m-inbox", label: "กล่องข้อความ / Inbox", to: "/dashboard/inbox", roles: ALL },
  { id: "m-news", label: "ข่าวสาร", to: "/dashboard/admin/news", roles: ["admin", "director", "teacher"] },
  { id: "m-doc", label: "หนังสือราชการ / เอกสาร", to: "/dashboard/admin/documents", roles: ["admin", "director", "teacher"] },
  { id: "m-cal", label: "ปฏิทินวิชาการ", to: "/dashboard/academic/calendar", roles: ALL },
  { id: "m-stu", label: "นักเรียนทั้งหมด", to: "/dashboard/academic/all-students", roles: ["admin", "director", "teacher"] },
  { id: "m-att", label: "เช็คชื่อนักเรียน", to: "/dashboard/student/attendance", roles: ["admin", "director", "teacher"] },
  { id: "m-beh", label: "บันทึกพฤติกรรม", to: "/dashboard/student/behavior", roles: ["admin", "director", "teacher"] },
  { id: "m-users", label: "จัดการผู้ใช้", to: "/dashboard/admin/users", roles: ["admin"] },
  { id: "m-settings", label: "ตั้งค่าระบบ", to: "/dashboard/admin/settings", roles: ["admin", "director"] },
  { id: "m-me", label: "โปรไฟล์ของฉัน", to: "/dashboard/profile", roles: ALL },
];

// สิทธิ์การค้นหาข้อมูลแต่ละหมวด
function canSearch(role: AppRole | null) {
  const r = role ?? "student";
  return {
    students: ["admin", "director", "teacher", "parent"].includes(r),
    personnel: ["admin", "director", "teacher"].includes(r),
    documents: ["admin", "director", "teacher"].includes(r),
  };
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  const perms = useMemo(() => canSearch(role), [role]);

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

      const tasks: Promise<any>[] = [];
      const kinds: ("student" | "personnel" | "document")[] = [];

      if (perms.students) {
        kinds.push("student");
        tasks.push(
          supabase
            .from("students")
            .select("id,prefix,first_name,last_name,student_code,classroom_id,classrooms!students_classroom_id_fkey(name)")
            .or(`first_name.ilike.${like},last_name.ilike.${like},student_code.ilike.${like}`)
            .limit(8)
        );
      }
      if (perms.personnel) {
        kinds.push("personnel");
        tasks.push(
          supabase
            .from("personnel")
            .select("id,prefix,first_name,last_name,department")
            .or(`first_name.ilike.${like},last_name.ilike.${like}`)
            .limit(8)
        );
      }
      if (perms.documents) {
        kinds.push("document");
        tasks.push(
          supabase
            .from("documents")
            .select("id,title,doc_number,doc_type")
            .or(`title.ilike.${like},doc_number.ilike.${like}`)
            .limit(8)
        );
      }

      const settled = await Promise.all(tasks);
      if (cancelled) return;

      const out: Result[] = [];
      settled.forEach((res, i) => {
        const kind = kinds[i];
        const rows = res?.data ?? [];
        if (kind === "student") {
          rows.forEach((s: any) =>
            out.push({
              id: `s-${s.id}`,
              label: `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
              sub: `${s.student_code ?? ""} • ${s.classrooms?.name ?? ""}`,
              to: `/dashboard/academic/students/${s.id}`,
              group: "student",
            })
          );
        } else if (kind === "personnel") {
          rows.forEach((p: any) =>
            out.push({
              id: `p-${p.id}`,
              label: `${p.prefix ?? ""}${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
              sub: p.department ?? "",
              to: `/dashboard/profile/${p.id}`,
              group: "personnel",
            })
          );
        } else if (kind === "document") {
          rows.forEach((d: any) =>
            out.push({
              id: `d-${d.id}`,
              label: d.title ?? "(ไม่มีชื่อ)",
              sub: `${d.doc_number ?? ""} • ${d.doc_type ?? ""}`,
              to: `/dashboard/admin/documents`,
              group: "document",
            })
          );
        }
      });
      setResults(out);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, perms.students, perms.personnel, perms.documents]);

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate(to);
  };

  const allowedMenu = useMemo(
    () => MENU.filter((m) => !role || m.roles.includes(role)),
    [role]
  );
  const menuFiltered = query
    ? allowedMenu.filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
    : allowedMenu;

  const placeholder = (() => {
    const bits: string[] = [];
    if (perms.students) bits.push("นักเรียน");
    if (perms.personnel) bits.push("บุคลากร");
    if (perms.documents) bits.push("เอกสาร");
    bits.push("เมนู");
    return `ค้นหา${bits.join(" · ")}… (Ctrl/⌘K)`;
  })();

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder={placeholder}
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

        {perms.students && results.filter((r) => r.group === "student").length > 0 && (
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

        {perms.personnel && results.filter((r) => r.group === "personnel").length > 0 && (
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

        {perms.documents && results.filter((r) => r.group === "document").length > 0 && (
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
