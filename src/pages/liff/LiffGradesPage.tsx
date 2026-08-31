import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LiffShell from "./LiffShell";

function GradeView({ lineUserId }: { lineUserId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: students } = await supabase.from("students").select("id,prefix,first_name,last_name")
        .or(`line_user_id.eq.${lineUserId},line_user_id_2.eq.${lineUserId},line_user_id_3.eq.${lineUserId}`);
      const s = students?.[0];
      if (!s) { setLoading(false); return; }
      const { data } = await supabase.from("student_scores")
        .select("total_score,grade,subjects(name_th,code)")
        .eq("student_id", s.id).order("created_at", { ascending: false }).limit(30);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [lineUserId]);

  if (loading) return <p>กำลังโหลด...</p>;
  if (!rows.length) return <p className="text-muted-foreground">ยังไม่มีคะแนน</p>;

  return (
    <div className="space-y-2 max-w-md mx-auto">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl border bg-card p-3 flex justify-between">
          <div>
            <p className="font-medium">{r.subjects?.name_th}</p>
            <p className="text-xs text-muted-foreground">{r.subjects?.code}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{r.total_score ?? "-"}</p>
            <p className="text-sm text-primary">เกรด {r.grade ?? "-"}</p>
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full" onClick={() => (window as any).liff?.closeWindow?.()}>ปิด</Button>
    </div>
  );
}

export default function LiffGradesPage() {
  return <LiffShell title="📊 คะแนนของฉัน">{(uid) => <GradeView lineUserId={uid} />}</LiffShell>;
}
