import { useEffect, useState } from "react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

// ตาราง kiosk_devices มีคอลัมน์ใหม่ที่ type ที่สร้างอัตโนมัติยังไม่รู้จัก
const supabase = supabaseClient as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, RefreshCw, Trash2, Monitor, Power } from "lucide-react";
import { toast } from "sonner";

type KioskDevice = {
  id: string;
  device_id: string;
  device_key: string | null;
  name: string | null;
  default_direction: string | null;
  is_active: boolean | null;
  agent_version: string | null;
  platform: string | null;
  camera_ok: boolean | null;
  last_seen_at: string | null;
};

const newKey = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const isOnline = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() < 3 * 60_000;

export default function KioskDeviceManager() {
  const [rows, setRows] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kiosk_devices")
      .select("id, device_id, device_key, name, default_direction, is_active, agent_version, platform, camera_ok, last_seen_at")
      .not("device_key", "is", null)
      .order("created_at", { ascending: false });
    if (error) toast.error("โหลดรายการเครื่องไม่สำเร็จ: " + error.message);
    setRows(((data ?? []) as unknown) as KioskDevice[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addDevice = async () => {
    const label = name.trim() || `ตู้สแกน ${rows.length + 1}`;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("kiosk_devices").insert({
      device_id: `kiosk-${Date.now().toString(36)}`,
      device_key: newKey(),
      name: label,
      default_direction: "in",
      is_active: true,
      status: "offline",
      user_id: auth?.user?.id ?? null,
    } as any);
    if (error) return toast.error("เพิ่มเครื่องไม่สำเร็จ: " + error.message);
    setName("");
    toast.success(`เพิ่ม "${label}" แล้ว — คัดลอกรหัสเครื่องไปใส่ตอนติดตั้ง`);
    load();
  };

  const rotate = async (d: KioskDevice) => {
    const { error } = await supabase.from("kiosk_devices").update({ device_key: newKey() }).eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("ออกรหัสใหม่แล้ว — ต้องตั้งค่าเครื่องนี้ใหม่");
    load();
  };

  const toggle = async (d: KioskDevice) => {
    const { error } = await supabase.from("kiosk_devices").update({ is_active: !d.is_active }).eq("id", d.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (d: KioskDevice) => {
    if (!confirm(`ลบเครื่อง "${d.name || d.device_id}" ?`)) return;
    const { error } = await supabase.from("kiosk_devices").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    load();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("คัดลอกแล้ว");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Monitor className="w-5 h-5" />เครื่องสแกนใบหน้า (ตู้คีออส)</CardTitle>
        <CardDescription>
          สร้างรหัสเครื่อง 1 รหัสต่อ 1 เครื่อง แล้วกรอกตอนติดตั้งโปรแกรมสแกน — เครื่องจะดึงรายชื่อและใบหน้ามาเก็บไว้ ใช้ได้แม้เน็ตหลุด
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="ชื่อเครื่อง เช่น ประตูหน้าโรงเรียน"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={addDevice} className="gap-2"><Plus className="w-4 h-4" />เพิ่มเครื่อง</Button>
          <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" />รีเฟรช</Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีเครื่อง — กด "เพิ่มเครื่อง" เพื่อสร้างรหัสแรก</p>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <div key={d.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{d.name || d.device_id}</span>
                  <Badge variant={isOnline(d.last_seen_at) ? "default" : "secondary"}>
                    {isOnline(d.last_seen_at) ? "ออนไลน์" : "ออฟไลน์"}
                  </Badge>
                  {d.is_active === false && <Badge variant="destructive">ปิดใช้งาน</Badge>}
                  {d.agent_version && <Badge variant="outline">v{d.agent_version}</Badge>}
                  {d.camera_ok === false && <Badge variant="destructive">กล้องมีปัญหา</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <code className="rounded bg-muted px-2 py-1 font-mono break-all">{d.device_key}</code>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(d.device_key ?? "")}>
                    <Copy className="w-3.5 h-3.5" />คัดลอกรหัสเครื่อง
                  </Button>
                  {d.last_seen_at && <span>ติดต่อล่าสุด {new Date(d.last_seen_at).toLocaleString("th-TH")}</span>}
                  {d.platform && <span>· {d.platform}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => rotate(d)}>
                    <RefreshCw className="w-3.5 h-3.5" />ออกรหัสใหม่
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => toggle(d)}>
                    <Power className="w-3.5 h-3.5" />{d.is_active === false ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => remove(d)}>
                    <Trash2 className="w-3.5 h-3.5" />ลบ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
