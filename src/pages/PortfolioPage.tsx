import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Upload, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import PortfolioGrid from "@/components/social/PortfolioGrid";
import { detectMediaTypeFromUrl, detectTypeFromFile, type MediaType } from "@/lib/media";

const CATEGORIES = [
  "ผลงานวิชาการ",
  "รางวัล/เกียรติบัตร",
  "กิจกรรม/โครงการ",
  "สื่อการสอน",
  "งานวิจัย",
  "ผลงานนักเรียน",
  "อื่นๆ",
];

const MAX_FILE_MB = 50;

export default function PortfolioPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [url, setUrl] = useState("");
  const [displayMode, setDisplayMode] = useState<"preview" | "download" | "embed">("preview");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const reset = () => {
    setTitle(""); setDescription(""); setUrl(""); setFile(null);
    setFileInputKey((k) => k + 1);
    setProgress("");
  };

  const submit = async () => {
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    if (!title.trim()) return toast.error("กรอกชื่อผลงาน");
    setSaving(true);
    try {
      let mediaUrl = "";
      let mediaType: MediaType = "link";
      let fileName: string | null = null;
      let fileSize: number | null = null;

      if (mode === "upload") {
        if (!file) { toast.error("เลือกไฟล์"); setSaving(false); return; }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          toast.error(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB}MB — กรุณาบีบอัดหรือใช้โหมดลิงก์ (YouTube/Drive)`);
          setSaving(false); return;
        }
        if (file.size === 0) {
          toast.error("ไฟล์ว่างเปล่าหรืออ่านไม่ได้");
          setSaving(false); return;
        }
        setProgress("กำลังอัปโหลดไฟล์...");
        const path = sanitizeStorageKey(`${userId}/${Date.now()}-${file.name}`);
        const { error: upErr } = await supabase.storage
          .from("portfolio")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) {
          console.error("[portfolio upload]", upErr);
          throw new Error(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);
        }
        // เก็บ path แทน signed URL (กันลิงก์หมดอายุ) — resolve ตอนแสดง
        mediaUrl = `portfolio://${path}`;
        mediaType = detectTypeFromFile(file);
        fileName = file.name;
        fileSize = file.size;
      } else {
        if (!url.trim()) { toast.error("ใส่ลิงก์"); setSaving(false); return; }
        mediaUrl = url.trim();
        mediaType = detectMediaTypeFromUrl(mediaUrl);
      }

      setProgress("กำลังบันทึก...");
      const { error } = await supabase.from("portfolio_items").insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        category,
        media_type: mediaType,
        media_url: mediaUrl,
        display_mode: displayMode,
        file_name: fileName,
        file_size: fileSize,
      });
      if (error) throw error;
      toast.success("เพิ่มผลงานเรียบร้อย");
      reset();
    } catch (e: any) {
      console.error("[portfolio submit]", e);
      toast.error(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
      setProgress("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Award className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">ผลงานของฉัน</h1>
          <p className="text-sm text-muted-foreground">แขวนผลงาน เอกสาร วิดีโอ หรือลิงก์ที่ต้องการแสดงในโปรไฟล์สาธารณะ</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" />เพิ่มผลงานใหม่</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}>
              <Upload className="w-4 h-4 mr-1" />อัปโหลดไฟล์
            </Button>
            <Button size="sm" variant={mode === "link" ? "default" : "outline"} onClick={() => setMode("link")}>
              <Link2 className="w-4 h-4 mr-1" />ลิงก์ (YouTube / Drive / เว็บ)
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>ชื่อผลงาน *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น โครงการ STEM 2568" />
            </div>
            <div>
              <Label>หมวด</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>คำอธิบาย</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {mode === "upload" ? (
            <div>
              <Label>เลือกไฟล์ (PDF / รูป / วิดีโอ — สูงสุด {MAX_FILE_MB}MB)</Label>
              <Input
                key={fileInputKey}
                type="file"
                accept=".pdf,image/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
            </div>
          ) : (
            <div>
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... หรือ https://drive.google.com/..."
              />
            </div>
          )}

          <div>
            <Label>วิธีแสดงผล</Label>
            <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preview">แสดงเนื้อหา (พรีวิวในหน้า)</SelectItem>
                <SelectItem value="download">แสดงเป็นไฟล์แนบให้ดาวน์โหลด</SelectItem>
                <SelectItem value="embed">ฝัง (iframe เต็ม)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={saving}>{saving ? "กำลังบันทึก..." : "เพิ่มผลงาน"}</Button>
            {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
          </div>
        </CardContent>
      </Card>

      {userId && (
        <div>
          <h2 className="text-lg font-semibold mb-3">ผลงานที่แขวนไว้</h2>
          <PortfolioGrid userId={userId} ownerView />
        </div>
      )}
    </div>
  );
}
