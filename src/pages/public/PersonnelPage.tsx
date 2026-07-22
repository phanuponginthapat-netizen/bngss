import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface P {
  id: string; prefix?: string | null; first_name?: string | null; last_name?: string | null;
  position_title?: string | null; position_level?: string | null; department?: string | null;
  subject_group?: string | null; academic_standing?: string | null; avatar_url?: string | null;
}

export default function PersonnelPage() {
  const [rows, setRows] = useState<P[]>([]);
  const [q, setQ] = useState("");
  const [sp] = useSearchParams();
  const group = sp.get("group");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name, position_title, position_level, department, subject_group, academic_standing, avatar_url")
        .order("sort_rank", { ascending: true, nullsFirst: false })
        .order("last_name");
      setRows((data ?? []) as P[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (group === "admin") r = r.filter((x) => (x.position_level || "").match(/ผอ|ผู้อำนวยการ|รอง|บริหาร/));
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) =>
        [x.first_name, x.last_name, x.position_title, x.department, x.subject_group].join(" ").toLowerCase().includes(s)
      );
    }
    return r;
  }, [rows, q, group]);

  const grouped = useMemo(() => {
    const g: Record<string, P[]> = {};
    filtered.forEach((p) => {
      const key = p.subject_group || p.department || "อื่นๆ";
      (g[key] ||= []).push(p);
    });
    return g;
  }, [filtered]);

  return (
    <PublicPageLayout
      title={group === "admin" ? "ทำเนียบผู้บริหาร" : "บุคลากรของโรงเรียน"}
      subtitle={`ทั้งหมด ${rows.length} คน`}
      breadcrumbs={[{ label: "บุคลากร" }]}
    >
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่อ / กลุ่มสาระ / ตำแหน่ง" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {Object.entries(grouped).map(([key, list]) => (
        <section key={key} className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-primary">{key} <span className="text-sm text-muted-foreground">({list.length})</span></h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => (
              <div key={p.id} className="group rounded-2xl border border-border/50 bg-background/80 p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md backdrop-blur">
                <Avatar className="mx-auto h-24 w-24 ring-4 ring-primary/10">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback>{(p.first_name?.[0] || "?") + (p.last_name?.[0] || "")}</AvatarFallback>
                </Avatar>
                <div className="mt-3 font-semibold text-foreground">
                  {p.prefix}{p.first_name} {p.last_name}
                </div>
                <div className="text-xs text-muted-foreground">{p.position_title || "—"}</div>
                {p.academic_standing && <Badge variant="secondary" className="mt-2">{p.academic_standing}</Badge>}
              </div>
            ))}
          </div>
        </section>
      ))}
      {filtered.length === 0 && <div className="py-20 text-center text-muted-foreground">ไม่พบข้อมูล</div>}
    </PublicPageLayout>
  );
}
