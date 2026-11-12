import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { facegateDefaults, facegateSettingsPatch, type FacegateSettings } from "./facegateSettings";

export default function FacegateNativeSettings() {
  const [form, setForm] = useState<FacegateSettings>(facegateDefaults);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setReady(false); setError("");
    try {
      const { data, error } = await supabase.from("school_settings").select("setting_value").eq("setting_key", "kiosk_config").maybeSingle();
      if (error) throw error;
      const raw = typeof data?.setting_value === "string" ? JSON.parse(data.setting_value || "{}") : data?.setting_value || {};
      setForm({ ...facegateDefaults, ...raw }); setReady(true);
    } catch { setError("อ่านค่าตั้งค่า FaceGate ไม่สำเร็จ"); }
  };
  useEffect(() => { void load(); }, []);
  const set = <K extends keyof FacegateSettings>(key: K, value: FacegateSettings[K]) => setForm(f => ({ ...f, [key]: value }));
  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const patch = facegateSettingsPatch(form);
      // Read just before saving: never overwrite unrelated Linux installation fields.
      const { data, error: readError } = await supabase.from("school_settings").select("setting_value").eq("setting_key", "kiosk_config").maybeSingle();
      if (readError) throw readError;
      const previous = typeof data?.setting_value === "string" ? JSON.parse(data.setting_value || "{}") : data?.setting_value || {};
      const allowed = Object.fromEntries(Object.keys(facegateDefaults).map(key => [key, patch[key as keyof FacegateSettings]]));
      const { error } = await supabase.from("school_settings").upsert({ setting_key: "kiosk_config", setting_value: JSON.stringify({ ...previous, ...allowed, next_person_delay_seconds: 2 }) }, { onConflict: "setting_key" });
      if (error) throw error;
      toast.success("บันทึกแล้ว เครื่องออนไลน์จะรับค่ารอบซิงก์ถัดไป");
    } catch (e) { toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  };
  if (error) return <div className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />ลองใหม่</Button></div>;
  if (!ready) return <p className="text-muted-foreground">กำลังอ่านค่าตั้งค่า…</p>;
  const toggle = (key: keyof FacegateSettings, title: string) => <div className="flex items-center justify-between gap-4 py-3"><Label htmlFor={key}>{title}</Label><Switch id={key} checked={Boolean(form[key])} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} /></div>;
  const numeric = (key: keyof FacegateSettings, title: string, min: number, max: number, step = .05) => <div className="space-y-2"><Label htmlFor={key}>{title}</Label><Input id={key} type="number" min={min} max={max} step={step} value={Number(form[key])} onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))} /></div>;
  return <div className="max-w-3xl space-y-6">
    <section className="space-y-4 border-b pb-6"><h2 className="text-lg font-semibold">การตรวจจับและจำใบหน้า</h2>
      <div className="grid gap-4 sm:grid-cols-2">{numeric("match_threshold", "เกณฑ์ความเหมือน (สูงขึ้น = เข้มงวดขึ้น)", .3, .9)}{numeric("detector_min_score", "เกณฑ์ตรวจพบใบหน้า", .3, .9)}{numeric("geometry_weight", "น้ำหนักสัดส่วนใบหน้า", 0, 1)}{numeric("geometry_min_score", "เกณฑ์สัดส่วนใบหน้า", 0, 1)}</div>
      {toggle("require_liveness", "ตรวจบุคคลจริง")}{toggle("qr_card_enabled", "รับบัตร QR นักเรียน")}
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground"><div><dt className="inline">พื้นที่สแกน: </dt><dd className="inline text-foreground">ใบหน้าทั้งใบในกรอบ</dd></div><div><dt className="inline">พักระหว่างคน: </dt><dd className="inline text-foreground">2 วินาที</dd></div></dl>
    </section>
    <section className="space-y-3 border-b pb-6"><h2 className="text-lg font-semibold">กล้องและภาพสด</h2>{toggle("kiosk_mirror", "ภาพกล้องแบบกระจก")}{toggle("live_view_enabled", "ส่งภาพสดสำหรับผู้ดูแล")}
      <Label>หมุนภาพกล้อง</Label><Select value={String(form.kiosk_camera_rotate)} onValueChange={v => set("kiosk_camera_rotate", Number(v))}><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger><SelectContent>{[0,90,180,270].map(n => <SelectItem key={n} value={String(n)}>{n}°</SelectItem>)}</SelectContent></Select>
    </section>
    <section className="space-y-4 border-b pb-6"><h2 className="text-lg font-semibold">เสียง</h2>{toggle("voice_enabled", "เปิดเสียงพูด")}
      <Label>ระดับเสียง {Math.round(form.voice_volume * 100)}%</Label><Slider aria-label="ระดับเสียง" value={[form.voice_volume]} min={0} max={1} step={.05} onValueChange={v => set("voice_volume", v[0] ?? 1)} />
      {numeric("voice_rate", "ความเร็วเสียงพูด", .5, 2, .1)}
      {([['voice_welcome_text','ข้อความต้อนรับ'],['voice_denied_text','ข้อความไม่พบในทะเบียน'],['voice_duplicate_text','ข้อความสแกนซ้ำ']] as const).map(([key,title]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{title}</Label><Input id={key} maxLength={300} value={form[key]} onChange={e => set(key,e.target.value)} /></div>)}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">ประตู</h2>{toggle("door_enabled", "เปิดการควบคุมประตู")}{numeric("door_open_seconds", "เวลาเปิดประตู (วินาที)", 1, 30, 1)}</section>
    <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}บันทึกค่าของโปรแกรม</Button>
  </div>;
}