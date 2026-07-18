import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, RotateCcw, CheckCircle2, Sparkles, Loader2 } from "lucide-react";

const ROLES = ["default", "parent", "teacher", "director", "admin"] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  default: "Default (ยังไม่ผูกบัญชี)",
  parent: "Parent (นักเรียน/ผู้ปกครอง)",
  teacher: "Teacher (ครู)",
  director: "Director (ผู้อำนวยการ)",
  admin: "Admin (แอดมิน)",
};

// Preset: 4×2 grid = 8 cells, image 2500×1686. Actions match SVG defaults.
const PRESET_AREAS: Record<Role, any[]> = {
  default: [
    ["เชื่อม"], ["ข่าว"], ["ปฏิทิน"], ["ตารางสอน"],
    ["ติดต่อ"], ["ฉุกเฉิน"], ["เมนู"], ["เมนู"],
  ].map((v, i) => grid(i, "message", v[0])),
  parent: [
    "ผลการเรียน", "การเข้าเรียน", "การบ้าน", "พฤติกรรม",
    "สุขภาพ", "ลา", "ตารางสอน", "เมนู",
  ].map((t, i) => grid(i, "message", t)),
  teacher: [
    "เช็คเข้าแถว", "เช็ครายคาบ", "วิชาฉัน", "สรุปห้อง",
    "การบ้านฉัน", "สอนแทน", "ลา", "เมนู",
  ].map((t, i) => grid(i, "message", t)),
  director: [
    "ภาพรวม", "ลารออนุมัติ", "ข่าวรอเผยแพร่", "ผู้ใช้",
    "ประกาศ", "ปฏิทิน", "สรุปวันนี้", "เมนู",
  ].map((t, i) => grid(i, "message", t)),
  admin: [
    "ภาพรวม", "ผู้ใช้", "ลารออนุมัติ", "ข่าวรอเผยแพร่",
    "ประกาศ", "ปฏิทิน", "ติดต่อ", "เมนู",
  ].map((t, i) => grid(i, "message", t)),
};

function grid(i: number, kind: "message" | "uri", value: string) {
  const cellW = 2500 / 4, cellH = 1686 / 2;
  return {
    bounds: {
      x: Math.round((i % 4) * cellW),
      y: Math.round(Math.floor(i / 4) * cellH),
      width: Math.round(cellW),
      height: Math.round(cellH),
    },
    action: kind === "uri" ? { type: "uri", uri: value } : { type: "message", text: value },
  };
}

type State = {
  role: string;
  richmenu_id: string | null;
  content_hash: string;
  source: "auto-svg" | "upload";
  image_path: string | null;
  updated_at: string;
};

export default function RichMenuUploader() {
  const [role, setRole] = useState<Role>("parent");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [areasJson, setAreasJson] = useState<string>(JSON.stringify(PRESET_AREAS.parent, null, 2));
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStates = async () => {
    const { data } = await supabase.from("line_richmenu_state").select("*");
    setStates((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadStates(); }, []);
  useEffect(() => {
    setAreasJson(JSON.stringify(PRESET_AREAS[role], null, 2));
  }, [role]);

  const onFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const fileToBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(f);
  });

  const upload = async () => {
    if (!file) { toast.error("กรุณาเลือกรูปภาพ"); return; }
    if (file.size > 1024 * 1024) { toast.error("ขนาดไฟล์ต้อง ≤ 1MB (LINE requirement)"); return; }

    let areas: any[];
    try { areas = JSON.parse(areasJson); }
    catch { toast.error("Areas JSON ไม่ถูกต้อง"); return; }

    setBusy(true);
    try {
      const img = new Image();
      img.src = preview!;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const height = img.height === 843 ? 843 : 1686;
      if (img.width !== 2500 || ![843, 1686].includes(img.height)) {
        toast.warning(`ขนาดรูปควรเป็น 2500×1686 หรือ 2500×843 (ปัจจุบัน ${img.width}×${img.height})`);
      }

      const b64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("upload-line-richmenu", {
        body: { role, image_base64: b64, areas, height },
      });
      if (error) throw error;
      if ((data as any)?.skipped) {
        toast.info("ข้ามการอัปโหลด — รูปและปุ่มเดิมกับที่มีอยู่แล้ว");
      } else {
        toast.success(`อัปโหลด Rich Menu สำหรับ ${role} สำเร็จ`);
      }
      await loadStates();
    } catch (e: any) {
      toast.error(e.message || "อัปโหลดล้มเหลว");
    }
    setBusy(false);
  };

  const revertToAuto = async (r: Role) => {
    if (!confirm(`คืนค่า Rich Menu ของ ${r} เป็นแบบ SVG อัตโนมัติ? (ต้องกด "สร้าง/อัปเดต Rich Menu" อีกครั้งเพื่อให้ generate ใหม่)`)) return;
    setBusy(true);
    try {
      // Just delete the state row — next setup run will re-create as auto-svg.
      await supabase.from("line_richmenu_state").delete().eq("role", r);
      toast.success(`คืนค่า ${r} เป็นแบบอัตโนมัติแล้ว — กดปุ่ม 'สร้าง/อัปเดต Rich Menu' เพื่อ generate ใหม่`);
      await loadStates();
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(areasJson);
    toast.success("คัดลอก Areas JSON แล้ว");
  };

  const stateOf = (r: string) => states.find(s => s.role === r);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          Rich Menu — อัปโหลดรูปเอง (Optional)
        </CardTitle>
        <CardDescription>
          อัปโหลดรูป PNG/JPEG ที่ออกแบบเอง (จาก Canva/Figma) เพื่อให้ Rich Menu สวยตามที่ต้องการ — จะ override เมนู SVG อัตโนมัติสำหรับ role นั้น
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status per role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLES.map(r => {
            const s = stateOf(r);
            return (
              <div key={r} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                <div className="text-xs">
                  <p className="font-medium">{ROLE_LABEL[r]}</p>
                  {loading ? (
                    <span className="text-muted-foreground">กำลังโหลด...</span>
                  ) : s ? (
                    <span className="text-muted-foreground">
                      {s.source === "upload" ? "🖼️ รูปที่อัปโหลด" : "🎨 SVG อัตโนมัติ"} · {new Date(s.updated_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">ยังไม่ได้สร้าง</span>
                  )}
                </div>
                {s?.source === "upload" && (
                  <Button size="sm" variant="ghost" onClick={() => revertToAuto(r)} disabled={busy} title="คืนค่าเป็น SVG อัตโนมัติ">
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label>เลือกบทบาท (Role)</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>รูปภาพ Rich Menu</Label>
          <Input type="file" accept="image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0] || null)} />
          <p className="text-xs text-muted-foreground">
            ขนาด <strong>2500×1686</strong> (full) หรือ <strong>2500×843</strong> (compact), PNG/JPEG, ≤ 1MB
          </p>
          {preview && (
            <div className="rounded-lg overflow-hidden border bg-muted/30">
              <img src={preview} alt="preview" className="w-full max-h-64 object-contain" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Areas JSON (พิกัดปุ่ม)</Label>
            <Button size="sm" variant="ghost" onClick={copyTemplate} className="h-7 text-xs">คัดลอก</Button>
          </div>
          <Textarea
            value={areasJson}
            onChange={(e) => setAreasJson(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Preset ใช้ Grid 4×2 (8 ปุ่ม) ตรงกับ layout SVG อัตโนมัติ — แก้ไข <code>bounds</code> / <code>action.text</code> ได้ตามต้องการ
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={upload} disabled={busy || !file} className="flex-1">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            อัปโหลด Rich Menu ({role})
          </Button>
        </div>

        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs space-y-1">
          <p className="font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" /> เคล็ดลับ</p>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            <li>ออกแบบใน <a href="https://www.canva.com/th_th/create/rich-menu/" target="_blank" rel="noreferrer" className="text-primary underline">Canva</a> — มีเทมเพลต Rich Menu สำเร็จรูป</li>
            <li>Export เป็น PNG ขนาด 2500×1686 → บีบอัดที่ <a href="https://tinypng.com" target="_blank" rel="noreferrer" className="text-primary underline">TinyPNG</a> ให้ ≤ 1MB</li>
            <li>ระบบมี <CheckCircle2 className="w-3 h-3 inline text-emerald-500" /> Dedup — อัปเดตซ้ำด้วยรูป/พิกัดเดิมจะข้ามการยิง LINE API</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
