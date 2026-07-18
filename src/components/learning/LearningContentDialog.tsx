import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { uploadSingleHtml, uploadZipPackage, uploadPdf, uploadSwfAsRuffle, deleteContentFiles } from "@/lib/learningUpload";
import { toast } from "sonner";
import { Loader2, Upload, Youtube, FileText, Gamepad2, Globe, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: any | null;
  onSaved?: () => void;
}

const KIND_OPTIONS = [
  { value: "html_single", label: "HTML เดี่ยว (1 ไฟล์)", icon: FileText },
  { value: "html_zip", label: "เกม HTML (ZIP / RAR / 7z / TAR)", icon: Gamepad2 },
  { value: "flash_swf", label: "Flash (.swf) — เล่นผ่าน Ruffle", icon: Zap },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "vimeo", label: "Vimeo", icon: Youtube },
  { value: "pdf", label: "PDF อัปโหลด", icon: FileText },
  { value: "embed", label: "ฝัง URL (Google Slides, Canva)", icon: Globe },
];


const GRADE_LEVELS = ["all","ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];
const SUBJECT_GROUPS = ["ปฐมวัย","ภาษาไทย","คณิตศาสตร์","วิทยาศาสตร์และเทคโนโลยี","สังคมศึกษา ศาสนาและวัฒนธรรม","สุขศึกษาและพลศึกษา","ศิลปะ","การงานอาชีพ","ภาษาต่างประเทศ","อื่นๆ"];

function genSlug() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export default function LearningContentDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "html_zip",
    external_url: "",
    grade_level: "all",
    subject_group: "อื่นๆ",
    visibility: "school" as "school" | "parent" | "public",
    tracking_enabled: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || "",
        description: editing.description || "",
        kind: editing.kind || "html_zip",
        external_url: editing.external_url || "",
        grade_level: editing.grade_level || "all",
        subject_group: editing.subject_group || "อื่นๆ",
        visibility: editing.visibility || "school",
        tracking_enabled: editing.tracking_enabled !== false,
      });
    } else {
      setForm({
        title: "", description: "", kind: "html_zip", external_url: "",
        grade_level: "all", subject_group: "อื่นๆ", visibility: "school", tracking_enabled: true,
      });
    }
    setFile(null);
    setProgress(0);
  }, [editing, open]);

  const isFileKind = ["html_single","html_zip","pdf","flash_swf"].includes(form.kind);
  const isUrlKind = ["youtube","vimeo","embed"].includes(form.kind);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("ใส่ชื่อสื่อก่อน"); return; }
    if (isFileKind && !editing && !file) { toast.error("เลือกไฟล์ก่อน"); return; }
    if (isUrlKind && !form.external_url.trim()) { toast.error("วาง URL ก่อน"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
      let { data: prof } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      if (!prof?.school_id) {
        // fallback: ใช้โรงเรียนเดียวในระบบ + auto-assign กลับเข้า profile
        const { data: schools } = await supabase.from("schools").select("id").eq("is_active", true).limit(2);
        if (schools && schools.length === 1) {
          await supabase.from("profiles").update({ school_id: schools[0].id }).eq("id", user.id);
          prof = { school_id: schools[0].id };
        } else {
          throw new Error("ไม่พบข้อมูลโรงเรียน — กรุณาตั้งค่าโรงเรียนของบัญชีก่อน");
        }
      }

      let contentId = editing?.id;
      let storagePath = editing?.storage_path || null;
      let entryFile = editing?.entry_file || null;
      let sizeBytes = editing?.size_bytes || 0;

      if (!editing) {
        // create row first
        const slug = form.visibility === "public" ? genSlug() : null;
        const { data: created, error: insErr } = await supabase
          .from("learning_contents")
          .insert({
            school_id: prof.school_id,
            owner_id: user.id,
            title: form.title.trim(),
            description: form.description.trim() || null,
            kind: form.kind,
            external_url: isUrlKind ? form.external_url.trim() : null,
            grade_level: form.grade_level,
            subject_group: form.subject_group,
            visibility: form.visibility,
            tracking_enabled: form.tracking_enabled,
            public_slug: slug,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        contentId = created.id;
      }

      // Upload file if needed
      if (isFileKind && file) {
        let r: { path: string; entryFile: string; size: number };
        if (form.kind === "html_single") r = await uploadSingleHtml(contentId, file);
        else if (form.kind === "pdf") r = await uploadPdf(contentId, file);
        else if (form.kind === "flash_swf") r = await uploadSwfAsRuffle(contentId, file);
        else r = await uploadZipPackage(contentId, file, (l, t) => setProgress(Math.floor((l / Math.max(1,t)) * 100)));
        storagePath = r.path;
        entryFile = r.entryFile;
        sizeBytes = r.size;
      }

      // Update row
      const slugUpdate: any = {};
      if (form.visibility === "public" && !editing?.public_slug) slugUpdate.public_slug = genSlug();
      if (form.visibility !== "public") slugUpdate.public_slug = null;

      const { error: upErr } = await supabase
        .from("learning_contents")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          kind: form.kind,
          external_url: isUrlKind ? form.external_url.trim() : null,
          storage_path: storagePath,
          entry_file: entryFile,
          size_bytes: sizeBytes,
          grade_level: form.grade_level,
          subject_group: form.subject_group,
          visibility: form.visibility,
          tracking_enabled: form.tracking_enabled,
          ...slugUpdate,
        })
        .eq("id", contentId);
      if (upErr) throw upErr;

      toast.success(editing ? "อัปเดตแล้ว" : "เพิ่มสื่อสำเร็จ");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      // ถ้าสร้าง row แล้วแต่อัปไฟล์ fail → ลบ row ทิ้ง
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "แก้ไขสื่อการเรียนรู้" : "เพิ่มสื่อการเรียนรู้"}</DialogTitle>
          <DialogDescription>
            แขวนสื่อ HTML / เกม / วิดีโอ / PDF ให้นักเรียนเข้าถึงได้ผ่านเว็บ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>ชื่อสื่อ *</Label>
            <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="เช่น เกมฝึกบวกเลข ป.1" />
          </div>

          <div>
            <Label>คำอธิบาย</Label>
            <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="อธิบายว่าสื่อนี้ใช้ทำอะไร" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ประเภทสื่อ *</Label>
              <Select value={form.kind} onValueChange={v => setForm({...form, kind: v})} disabled={!!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex items-center gap-2">
                        <o.icon className="w-4 h-4" /> {o.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && <p className="text-xs text-muted-foreground mt-1">ลบและสร้างใหม่หากต้องการเปลี่ยนประเภท</p>}
            </div>
            <div>
              <Label>การมองเห็น *</Label>
              <Select value={form.visibility} onValueChange={(v: any) => setForm({...form, visibility: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">🔒 เฉพาะในโรงเรียน</SelectItem>
                  <SelectItem value="parent">👨‍👩‍👧 รวมผู้ปกครอง</SelectItem>
                  <SelectItem value="public">🌐 สาธารณะ (ลิงก์)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ระดับชั้น</Label>
              <Select value={form.grade_level} onValueChange={v => setForm({...form, grade_level: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g === "all" ? "ทุกระดับชั้น" : g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>กลุ่มสาระ</Label>
              <Select value={form.subject_group} onValueChange={v => setForm({...form, subject_group: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECT_GROUPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFileKind && (
            <div>
              <Label>
                {form.kind === "html_zip" ? "อัปไฟล์ archive — ZIP / RAR / 7z / TAR / TAR.GZ (≤ 100 MB ต้องมี index.html)" :
                 form.kind === "pdf" ? "อัปไฟล์ PDF (≤ 50 MB)" :
                 form.kind === "flash_swf" ? "อัปไฟล์ Flash .swf (≤ 50 MB)" :
                 "อัปไฟล์ HTML (≤ 25 MB)"}
              </Label>
              <Input type="file"
                accept={form.kind === "html_zip" ? ".zip,.rar,.7z,.tar,.tar.gz,.tgz,.tar.bz2,.tbz2,.tar.xz,.txz" :
                        form.kind === "pdf" ? ".pdf" :
                        form.kind === "flash_swf" ? ".swf" :
                        ".html,.htm"}
                onChange={e => setFile(e.target.files?.[0] || null)} />

              {file && <p className="text-xs text-muted-foreground mt-1">📁 {file.name} ({(file.size/1024/1024).toFixed(2)} MB)</p>}
              {form.kind === "flash_swf" && (
                <p className="text-xs text-warning mt-1">
                  ⚡ ระบบจะห่อด้วย <b>Ruffle</b> ให้อัตโนมัติ เล่นได้บนเว็บ/มือถือเหมือน Y8 — ถ้ามีเฉพาะไฟล์ .exe ให้แตกเอา .swf ออกมาก่อน
                </p>
              )}
              {editing?.storage_path && !file && (
                <p className="text-xs text-success mt-1">✓ มีไฟล์อยู่แล้ว — ไม่จำเป็นต้องอัปใหม่</p>
              )}
            </div>
          )}

          {isUrlKind && (
            <div>
              <Label>URL *</Label>
              <Input value={form.external_url} onChange={e => setForm({...form, external_url: e.target.value})}
                placeholder={
                  form.kind === "youtube" ? "https://youtube.com/watch?v=..." :
                  form.kind === "vimeo" ? "https://vimeo.com/..." :
                  "URL embed (Google Slides, Canva, ฯลฯ)"
                } />
              {form.kind === "embed" && <p className="text-xs text-muted-foreground mt-1">ใช้ "Embed URL" จากบริการนั้นๆ ไม่ใช่ลิงก์แชร์ปกติ</p>}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div>
              <Label className="cursor-pointer">เปิดการบันทึกสถิติการเข้าใช้</Label>
              <p className="text-xs text-muted-foreground">บันทึกว่าใครเปิด/กี่ครั้ง/รวมเวลาเท่าไหร่</p>
            </div>
            <Switch checked={form.tracking_enabled} onCheckedChange={v => setForm({...form, tracking_enabled: v})} />
          </div>

          {saving && progress > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">กำลังอัปโหลด... {progress}%</p>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก</> : <><Upload className="w-4 h-4 mr-2" /> บันทึก</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
