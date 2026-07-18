import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Star, Sparkles, Loader2 } from "lucide-react";

export default function MasterTemplatesPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("_all");

  const { data: masters = [], isLoading } = useQuery({
    queryKey: ["master-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_templates")
        .select("id, name, code, category, is_default_for_category, published_at, fill_count, last_used_at, field_map, source_pdf_path")
        .eq("is_system_master", true)
        .not("published_at", "is", null)
        .not("source_pdf_path", "is", null)
        .order("is_default_for_category", { ascending: false })
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const categories = useMemo(() => {
    const s = new Set<string>();
    masters.forEach((m: any) => m.category && s.add(m.category));
    return Array.from(s).sort();
  }, [masters]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return masters.filter((m: any) => {
      if (category !== "_all" && m.category !== category) return false;
      if (!term) return true;
      return (m.name?.toLowerCase().includes(term) || m.code?.toLowerCase().includes(term));
    });
  }, [masters, q, category]);

  const grouped = useMemo(() => {
    const m: Record<string, any[]> = {};
    filtered.forEach((t: any) => {
      const key = t.category || "ไม่ระบุหมวด";
      (m[key] = m[key] || []).push(t);
    });
    return m;
  }, [filtered]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          ต้นแบบเอกสาร (ระบบ)
        </h1>
        <p className="text-sm text-muted-foreground">
          เลือกต้นแบบทางการที่ผู้ดูแลระบบเผยแพร่ไว้ → กรอกข้อมูล → พิมพ์/ส่งได้ทันที
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัสฟอร์ม" className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56"><SelectValue placeholder="ทุกหมวด" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">ทุกหมวด</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            ยังไม่มีต้นแบบที่เผยแพร่ — ให้ผู้ดูแลระบบตั้งฟอร์มเป็น "ต้นแบบระบบ" แล้วกด "เผยแพร่สู่ระบบ"
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{cat} · {list.length} รายการ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((t: any) => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-1">
                        {t.is_default_for_category && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        {t.name}
                      </CardTitle>
                      <Badge variant="secondary">{(t.field_map || []).length} ช่อง</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.code}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      ใช้ไปแล้ว {t.fill_count || 0} ครั้ง
                      {t.last_used_at && ` · ล่าสุด ${new Date(t.last_used_at).toLocaleDateString("th-TH")}`}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => nav(`/dashboard/documents/fill/${t.id}`)}>
                      <FileText className="w-4 h-4 mr-1" /> ใช้ต้นแบบนี้
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
