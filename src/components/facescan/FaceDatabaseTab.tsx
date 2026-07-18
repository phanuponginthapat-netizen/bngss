import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { swal } from "@/lib/swal";
import { useResolvedImageUrl } from "@/lib/storageUrl";

const StudentPhoto = ({ src, fallback }: { src?: string | null; fallback?: string }) => {
  const resolved = useResolvedImageUrl(src);
  if (!resolved) {
    return (
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs">
        {fallback}
      </div>
    );
  }
  return <img src={resolved} alt="" className="w-12 h-12 rounded-full object-cover border" />;
};

const FaceDatabaseTab = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["face-db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_face_descriptors")
        .select("id, student_id, sample_index, source, created_at, students!inner(id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))");
      if (error) throw error;
      // Group by student
      const map = new Map<string, any>();
      for (const r of data as any[]) {
        const id = r.student_id;
        if (!map.has(id)) {
          map.set(id, { ...r.students, sample_count: 0, latest: r.created_at });
        }
        const g = map.get(id);
        g.sample_count++;
        if (r.created_at > g.latest) g.latest = r.created_at;
      }
      return Array.from(map.values()).sort((a, b) => a.first_name.localeCompare(b.first_name, "th"));
    },
  });

  const filtered = data.filter((s: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [s.first_name, s.last_name, s.student_code].some((v) => String(v || "").toLowerCase().includes(q));
  });

  const deleteFor = async (studentId: string, name: string) => {
    if (!(await swal.confirm({ title: `ลบใบหน้าของ ${name} ทั้งหมด?`, danger: true }))) return;
    const { error } = await supabase.from("student_face_descriptors").delete().eq("student_id", studentId);
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    qc.invalidateQueries({ queryKey: ["face-db"] });
    qc.invalidateQueries({ queryKey: ["face-known"] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><Database className="w-4 h-4" />ฐานข้อมูลใบหน้า</h3>
          <Badge variant="outline">{data.length} คน</Badge>
        </div>
        <Input placeholder="ค้นหาชื่อ/รหัส..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">ยังไม่มีใบหน้าในระบบ</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s: any) => (
              <div key={s.id} className="p-3 rounded-lg border bg-card flex items-center gap-3">
                <StudentPhoto src={s.photo_url} fallback={s.first_name?.[0]} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{s.prefix}{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-muted-foreground">{s.student_code} • ชั้น {s.classrooms?.grade_level || "-"}/{s.classrooms?.name || "-"}</p>
                  <Badge variant="secondary" className="mt-1 text-xs">{s.sample_count} ภาพ</Badge>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteFor(s.id, `${s.first_name} ${s.last_name}`)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FaceDatabaseTab;
