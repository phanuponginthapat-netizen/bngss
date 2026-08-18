import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Time24Input } from "@/components/ui/time24-input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Save, Clock, Monitor, Sparkles, ScanFace, Eye, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearAdaptiveFlagCache } from "@/lib/faceLearning";
import { saveErrorMessage, safeNum, safeInt } from "@/lib/saveError";

type Win = { start: string; end: string };
const DEFAULT_ENTRY: Win = { start: "06:00", end: "10:00" };
const DEFAULT_EXIT: Win = { start: "14:00", end: "18:00" };

function parseWindow(raw: string | null): Win | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})$/);
  if (!m) return null;
  return { start: m[1], end: m[2] };
}
function fmtWindow(w: Win): string { return `${w.start.slice(0,5)}-${w.end.slice(0,5)}`; }
function toMin(s: string) { const [h, m] = s.split(":").map(Number); return (h||0)*60+(m||0); }

const FaceSettingsTab = () => {
  const [threshold, setThreshold] = useState("0.5");
  const [cutoffTime, setCutoffTime] = useState("08:00");
  const [modeCutoff, setModeCutoff] = useState("12:00");
  const [entryEnabled, setEntryEnabled] = useState(false);
  const [exitEnabled, setExitEnabled] = useState(false);
  const [entryWin, setEntryWin] = useState<Win>(DEFAULT_ENTRY);
  const [exitWin, setExitWin] = useState<Win>(DEFAULT_EXIT);
  const [idleTimeout, setIdleTimeout] = useState("60"); // วินาที
  const [helloAiEnabled, setHelloAiEnabled] = useState(true);
  const [powerSave, setPowerSave] = useState(true); // ปิดกล้อง/AI นอกเวลาสแกน (โน๊ตบุ๊คเก่า)
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false); // ปลุกด้วยเสียง "สวัสดี AI"
  const [adaptiveLearning, setAdaptiveLearning] = useState(true); // เรียนรู้ใบหน้าอัตโนมัติทุกครั้งที่สแกน
  const [livenessEnabled, setLivenessEnabled] = useState(true); // ตรวจใบหน้าสด (กะพริบตา/ขยับหัว) กันรูปถ่าย-จอภาพ
  const [textureGate, setTextureGate] = useState(true); // ตรวจพื้นผิวใบหน้า (LBP) กันคนหน้าคล้าย-รูปถ่าย
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "face_scan_threshold", "face_scan_cutoff_time", "face_scan_mode_cutoff",
          "face_scan_entry_window", "face_scan_exit_window",
          "kiosk_idle_timeout_sec", "kiosk_hello_ai_enabled", "kiosk_power_save", "kiosk_wake_word_enabled",
          "face_adaptive_learning",
          "face_liveness_enabled", "face_texture_gate",
        ]);
      for (const r of data || []) {
        if (r.setting_key === "face_scan_threshold") setThreshold(r.setting_value || "0.5");
        if (r.setting_key === "face_scan_cutoff_time") setCutoffTime(r.setting_value || "08:00");
        if (r.setting_key === "face_scan_mode_cutoff") setModeCutoff(r.setting_value || "12:00");
        if (r.setting_key === "face_scan_entry_window") {
          const w = parseWindow(r.setting_value);
          if (w) { setEntryWin(w); setEntryEnabled(true); }
        }
        if (r.setting_key === "face_scan_exit_window") {
          const w = parseWindow(r.setting_value);
          if (w) { setExitWin(w); setExitEnabled(true); }
        }
        if (r.setting_key === "kiosk_idle_timeout_sec") setIdleTimeout(r.setting_value || "60");
        if (r.setting_key === "kiosk_hello_ai_enabled") setHelloAiEnabled(r.setting_value !== "false");
        if (r.setting_key === "kiosk_power_save") setPowerSave(r.setting_value !== "false");
        if (r.setting_key === "kiosk_wake_word_enabled") setWakeWordEnabled(r.setting_value === "true");
        if (r.setting_key === "face_adaptive_learning") setAdaptiveLearning(r.setting_value !== "false");
        if (r.setting_key === "face_liveness_enabled") setLivenessEnabled(r.setting_value !== "false");
        if (r.setting_key === "face_texture_gate") setTextureGate(r.setting_value !== "false");
      }
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const t = safeNum(threshold, NaN);
      if (!Number.isFinite(t) || t < 0.3 || t > 0.8) {
        toast.error("Threshold ต้องอยู่ระหว่าง 0.3 - 0.8");
        return;
      }
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(modeCutoff)) {
        toast.error("เวลาสลับโหมดต้องเป็น HH:MM");
        return;
      }
      const modeCutoffHm = modeCutoff.slice(0, 5);
      const cutoffTimeHm = cutoffTime.slice(0, 5);

      // ตรวจช่วงเวลา: end > start
      if (entryEnabled && toMin(entryWin.end) <= toMin(entryWin.start)) {
        toast.error("ช่วงเวลาสแกนเข้า: เวลาสิ้นสุดต้องหลังเวลาเริ่ม"); return;
      }
      if (exitEnabled && toMin(exitWin.end) <= toMin(exitWin.start)) {
        toast.error("ช่วงเวลาสแกนออก: เวลาสิ้นสุดต้องหลังเวลาเริ่ม"); return;
      }

      const idleSec = Math.max(15, Math.min(600, safeInt(idleTimeout, 60)));
      const { error } = await supabase.from("school_settings").upsert([
        { setting_key: "face_scan_threshold", setting_value: String(t) },
        { setting_key: "face_scan_cutoff_time", setting_value: cutoffTimeHm },
        { setting_key: "face_scan_mode_cutoff", setting_value: modeCutoffHm },
        { setting_key: "face_scan_entry_window", setting_value: entryEnabled ? fmtWindow(entryWin) : "" },
        { setting_key: "face_scan_exit_window", setting_value: exitEnabled ? fmtWindow(exitWin) : "" },
        { setting_key: "kiosk_idle_timeout_sec", setting_value: String(idleSec) },
        { setting_key: "kiosk_hello_ai_enabled", setting_value: helloAiEnabled ? "true" : "false" },
        { setting_key: "kiosk_power_save", setting_value: powerSave ? "true" : "false" },
        { setting_key: "kiosk_wake_word_enabled", setting_value: wakeWordEnabled ? "true" : "false" },
        { setting_key: "face_adaptive_learning", setting_value: adaptiveLearning ? "true" : "false" },
        { setting_key: "face_liveness_enabled", setting_value: livenessEnabled ? "true" : "false" },
        { setting_key: "face_texture_gate", setting_value: textureGate ? "true" : "false" },
      ], { onConflict: "setting_key" });
      if (error) throw error;
      clearAdaptiveFlagCache();
      toast.success("บันทึกแล้ว");
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Card className="max-w-xl">
      <CardContent className="p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4" />ตั้งค่าระบบสแกนหน้า</h3>

        <div className="space-y-2">
          <Label>ระดับความเข้มงวด (Threshold)</Label>
          <Input type="number" step="0.05" min="0.3" max="0.8" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <p className="text-xs text-muted-foreground">ต่ำกว่า = เข้มงวดมากขึ้น (จำคนผิดน้อย แต่อาจจำไม่ได้) — แนะนำ 0.5</p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />เรียนรู้ใบหน้าอัตโนมัติ (Adaptive Learning)</Label>
            <p className="text-xs text-muted-foreground">
              ทุกครั้งที่สแกนสำเร็จด้วยความมั่นใจสูง ระบบจะเก็บมุม/แสงใหม่เข้าคลังใบหน้าของนักเรียนคนนั้น
              (สูงสุด 2 ครั้ง/คน/วัน) ทำให้การสแกนครั้งต่อ ๆ ไปแม่นยำขึ้นเรื่อย ๆ
            </p>
          </div>
          <Switch checked={adaptiveLearning} onCheckedChange={setAdaptiveLearning} />
        </div>

        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
          <Label className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-semibold">
            <ShieldAlert className="w-4 h-4" /> กันการปลอมแปลงใบหน้า
          </Label>

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-2"><Eye className="w-4 h-4 text-primary" />ตรวจใบหน้าสด (Liveness)</Label>
              <p className="text-xs text-muted-foreground">
                สแกนต้องพบการกะพริบตา + การขยับศีรษะภายใน ~3.5 วิ ก่อนบันทึกเวลา — กันการใช้รูปถ่ายหรือจอภาพมาหลอกกล้อง
              </p>
            </div>
            <Switch checked={livenessEnabled} onCheckedChange={setLivenessEnabled} />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-2"><ScanFace className="w-4 h-4 text-primary" />ตรวจพื้นผิวใบหน้า (Texture)</Label>
              <p className="text-xs text-muted-foreground">
                เทียบลายพื้นผิวใบหน้าที่สแกนกับภาพที่ลงทะเบียนไว้ — กันคนหน้าคล้ายกันและการพิมพ์ภาพมาสแกน
                (ถ้าผู้ลงทะเบียนเดิมยังไม่มี texture จะถือว่าผ่านอัตโนมัติ)
              </p>
            </div>
            <Switch checked={textureGate} onCheckedChange={setTextureGate} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>เวลาตัด "มาสาย"</Label>
          <Time24Input value={cutoffTime} onChange={(v) => setCutoffTime(v)} withSeconds={false} />
          <p className="text-xs text-muted-foreground">สแกนหลังเวลานี้ = บันทึกเป็นมาสาย</p>
        </div>

        <div className="space-y-2">
          <Label>เวลาสลับโหมด "เข้า → ออก" อัตโนมัติ</Label>
          <Time24Input value={modeCutoff} onChange={(v) => setModeCutoff(v)} withSeconds={false} />
          <p className="text-xs text-muted-foreground">
            ใช้เมื่อโหมดสแกนอยู่ที่ "อัตโนมัติ" — ก่อนเวลานี้บันทึกเป็น "เข้าโรงเรียน", ตั้งแต่เวลานี้บันทึกเป็น "ออกจากโรงเรียน"
          </p>
        </div>

        {/* ช่วงเวลาที่อนุญาตให้สแกน (กันสแกนนอกเวลา) */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Clock className="w-4 h-4" /> ช่วงเวลาสแกน "เข้าโรงเรียน"
            </Label>
            <Switch checked={entryEnabled} onCheckedChange={setEntryEnabled} />
          </div>
          {entryEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">เริ่ม</Label>
                <Time24Input value={entryWin.start} onChange={(v) => setEntryWin((w) => ({ ...w, start: v }))} withSeconds={false} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">สิ้นสุด</Label>
                <Time24Input value={entryWin.end} onChange={(v) => setEntryWin((w) => ({ ...w, end: v }))} withSeconds={false} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ถ้าเปิด — สแกนนอกช่วงเวลานี้จะถูกปฏิเสธ (เช่น 06:00–10:00 กันสแกนตอนพักเที่ยง)
          </p>
        </div>

        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <Clock className="w-4 h-4" /> ช่วงเวลาสแกน "ออกจากโรงเรียน"
            </Label>
            <Switch checked={exitEnabled} onCheckedChange={setExitEnabled} />
          </div>
          {exitEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">เริ่ม</Label>
                <Time24Input value={exitWin.start} onChange={(v) => setExitWin((w) => ({ ...w, start: v }))} withSeconds={false} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">สิ้นสุด</Label>
                <Time24Input value={exitWin.end} onChange={(v) => setExitWin((w) => ({ ...w, end: v }))} withSeconds={false} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ถ้าเปิด — สแกนนอกช่วงเวลานี้จะถูกปฏิเสธ (เช่น 14:00–18:00 กันสแกนเล่นกลางคืน)
          </p>
        </div>

        {/* ===== Kiosk Mode settings ===== */}
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-3">
          <Label className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold">
            <Monitor className="w-4 h-4" /> โหมดคีออส (Kiosk)
          </Label>

          <div className="space-y-1.5">
            <Label className="text-xs">ระยะเวลาก่อนพักหน้าจอ (วินาที)</Label>
            <Input
              type="number" min="15" max="600" step="15"
              value={idleTimeout}
              onChange={(e) => setIdleTimeout(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              ไม่พบใบหน้า/ไม่มีการแตะ เกินเวลานี้จะเข้าสู่หน้าพักหน้าจอ (แสดงโลโก้ ข่าวประชาสัมพันธ์ นาฬิกา)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> เปิดโหมด Hello AI
              </Label>
              <p className="text-[11px] text-muted-foreground">
                ให้ปุ่มคุยกับ AI แสดงบนหน้าพักหน้าจอ (ใช้ได้เฉพาะนอกช่วงเวลาสแกน)
              </p>
            </div>
            <Switch checked={helloAiEnabled} onCheckedChange={setHelloAiEnabled} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>โหมดประหยัดพลังงาน (โน๊ตบุ๊คเก่า)</Label>
              <p className="text-[11px] text-muted-foreground">
                ปิดกล้อง + หยุด AI ตอนอยู่หน้าพักหน้าจอ/นอกเวลาสแกน (ลด CPU/พัดลม)
              </p>
            </div>
            <Switch checked={powerSave} onCheckedChange={setPowerSave} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" /> ปลุกด้วยเสียง “สวัสดี AI”
              </Label>
              <p className="text-[11px] text-muted-foreground">
                ไม่ต้องแตะจอ (เหมาะกับเครื่องในตู้) — เมื่ออยู่หน้าพักหน้าจอ ให้พูดว่า “สวัสดี AI” เพื่อเรียก Hello AI
                <br />ต้องอนุญาตไมโครโฟนที่เบราว์เซอร์ครั้งแรก และใช้งานได้ดีที่สุดบน Chrome/Edge
              </p>
            </div>
            <Switch checked={wakeWordEnabled} onCheckedChange={setWakeWordEnabled} />
          </div>
        </div>


        <Button onClick={save} disabled={busy} className="gradient-primary">
          <Save className="w-4 h-4 mr-2" />{busy ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default FaceSettingsTab;
