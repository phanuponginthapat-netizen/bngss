import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Sparkles, Trash2, Loader2, Pencil, FileSearch, Star, BookOpen } from "lucide-react";

export default function DocumentTemplatesPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", category: "", file: null as File | null });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["pdf-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_templates")
        .select("id, name, code, category, source_pdf_path, source_pdf_pages, field_map, analyze_status, analyze_error, analyzed_at, fill_count, last_used_at, updated_at, is_system_master, is_default_for_category, published_at")
        .not("source_pdf_path", "is", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async () => {
    if (!form.file || !form.name) {
      toast.error("กรอกชื่อและเลือกไฟล์ PDF");
      return;
    }
    setUploading(true);
    try {
      const code = form.code || `tpl_${Date.now()}`;
      const path = `source/${code}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("print-templates")
        .upload(path, form.file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("print_templates")
        .insert({
          name: form.name,
          code,
          category: form.category || null,
          source_pdf_path: path,
          analyze_status: "idle",
          field_map: [],
          is_active: true,
          paper: "A4",
          orientation: "portrait",
        } as any)
        .select()
        .single();
      if (insErr) throw insErr;

      toast.success("อัปโหลดแล้ว — กำลังตรวจช่องใน PDF...");
      setUploadOpen(false);
      setForm({ name: "", code: "", category: "", file: null });
      qc.invalidateQueries({ queryKey: ["pdf-templates"] });

      await analyze(row.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const analyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-pdf-template", { body: { template_id: id } });
      if (error) {
        const context = (error as any).context;
        const payload = context?.json ? await context.clone().json().catch(() => null) : null;
        throw new Error(payload?.error || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.source === "manual_fallback") {
        toast.warning("ยังตรวจช่องอัตโนมัติไม่ได้ — เปิดโหมดเพิ่มช่องเองแล้ว");
      } else {
        toast.success(`พบช่องกรอก ${(data as any)?.fields_count ?? 0} ช่อง`);
      }
      qc.invalidateQueries({ queryKey: ["pdf-templates"] });
    } catch (e: any) {
      const message = String(e?.message || e);
      toast.error("วิเคราะห์ไม่สำเร็จ", { description: message });
      qc.invalidateQueries({ queryKey: ["pdf-templates"] });
    } finally {
      setAnalyzingId(null);
    }
  };

  const remove = async (id: string, path: string | null) => {
    if (!confirm("ลบเทมเพลตนี้?")) return;
    if (path) await supabase.storage.from("print-templates").remove([path]);
    await supabase.from("print_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["pdf-templates"] });
    toast.success("ลบแล้ว");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">เทมเพลตเอกสาร PDF (AI Smart Fill)</h1>
          <p className="text-sm text-muted-foreground">
            อัปโหลด PDF ฟอร์มต้นแบบ → ระบบตรวจช่องอัตโนมัติ หรือกำหนดช่องเองบน PDF → เติมข้อมูลลงตำแหน่งเดิม
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => nav("/dashboard/documents/masters")}>
            <BookOpen className="w-4 h-4 mr-2" />คลังต้นแบบระบบ
          </Button>
          <Button onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4 mr-2" />อัปโหลด PDF ใหม่</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          ยังไม่มีเทมเพลต — อัปโหลด PDF ฟอร์มราชการ (กสศ.01, ปพ.1-8, ใบลา ฯลฯ) เพื่อเริ่มใช้งาน
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <Card key={t.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-1">
                    {t.is_default_for_category && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                    {t.name}
                  </CardTitle>
                  {t.analyze_status === "done" && <Badge variant="default">{(t.field_map || []).length} ช่อง</Badge>}
                  {t.analyze_status === "running" && <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />วิเคราะห์</Badge>}
                  {t.analyze_status === "error" && <Badge variant="destructive">ผิดพลาด</Badge>}
                  {t.analyze_status === "idle" && <Badge variant="outline">ยังไม่วิเคราะห์</Badge>}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-xs text-muted-foreground">{t.code} {t.category ? `• ${t.category}` : ""}</p>
                  {t.is_system_master && t.published_at && <Badge className="bg-emerald-600 text-[10px]">ต้นแบบระบบ</Badge>}
                  {t.is_system_master && !t.published_at && <Badge variant="outline" className="text-[10px]">ต้นแบบ · ยังไม่เผยแพร่</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.analyze_error && <p className="text-xs text-destructive">{t.analyze_error}</p>}
                <div className="text-xs text-muted-foreground">
                  ใช้ไปแล้ว {t.fill_count || 0} ครั้ง
                  {t.last_used_at && ` • ล่าสุด ${new Date(t.last_used_at).toLocaleDateString("th-TH")}`}
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                  <Button size="sm" onClick={() => nav(`/dashboard/documents/fill/${t.id}`)} disabled={t.analyze_status !== "done"}>
                    <FileText className="w-4 h-4 mr-1" />กรอก
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => nav(`/dashboard/admin/document-templates/${t.id}`)}>
                    <Pencil className="w-4 h-4 mr-1" />แก้ฟิลด์
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => analyze(t.id)} disabled={analyzingId === t.id || t.analyze_status === "running"}>
                    {analyzingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {analyzingId === t.id ? "" : "วิเคราะห์ซ้ำ"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id, t.source_pdf_path)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>อัปโหลดเทมเพลต PDF</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อฟอร์ม *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น แบบ นร./กสศ.01" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>รหัส (อังกฤษ)</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="kosor_01" />
              </div>
              <div>
                <Label>หมวด</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ทุน/นักเรียน" />
              </div>
            </div>
            <div>
              <Label>ไฟล์ PDF *</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
                <p className="text-xs text-muted-foreground mt-1">หลังอัปโหลด ระบบจะตรวจช่องใน PDF ก่อน ถ้าไม่มีช่องให้เพิ่มเองบนหน้าแก้ฟิลด์ได้ทันที</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}อัปโหลดและวิเคราะห์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
