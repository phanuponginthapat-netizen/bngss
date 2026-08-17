import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, RefreshCw, Cpu } from "lucide-react";
import { toast } from "sonner";
import { IOT_CATEGORIES, getCategory } from "@/lib/iotCategories";
import { swal } from "@/lib/swal";
import { saveErrorMessage } from "@/lib/saveError";

interface DeviceForm {
  id?: string;
  name: string;
  description?: string;
  device_type: string;
  unit?: string;
  source_type: string;
  base_url?: string;
  entity_id?: string;
  api_token?: string;
  request_path?: string;
  json_path?: string;
  poll_interval_seconds: number;
  location?: string;
  dashboard_group: string;
  system_category: string;
  display_order: number;
  is_active: boolean;
}

const emptyForm: DeviceForm = {
  name: "",
  device_type: "sensor",
  source_type: "home_assistant",
  poll_interval_seconds: 60,
  dashboard_group: "general",
  system_category: "other",
  display_order: 0,
  is_active: true,
};

export default function IoTDevicesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DeviceForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["iot-devices-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iot_devices")
        .select("id,name,description,device_type,icon,unit,source_type,base_url,entity_id,request_path,json_path,poll_interval_seconds,location,dashboard_group,display_order,is_active,last_value,last_value_numeric,last_status,last_error,last_fetched_at,meta,system_category,color,created_at,updated_at")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const openNew = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (d: any) => {
    setForm({ ...emptyForm, ...d });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("กรุณากรอกชื่ออุปกรณ์");
      return;
    }
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      const payload: any = { ...form };
      delete payload.id;
      if (form.id) {
        // Don't overwrite existing api_token when user leaves the field blank
        if (!payload.api_token) delete payload.api_token;
        const { error } = await supabase.from("iot_devices").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("บันทึกแล้ว");
      } else {
        const { error } = await supabase.from("iot_devices").insert(payload);
        if (error) throw error;
        toast.success("เพิ่มอุปกรณ์แล้ว");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["iot-devices-admin"] });
      qc.invalidateQueries({ queryKey: ["iot-devices"] });
    } catch (e: any) {
      toast.error(e.message ?? "เกิดข้อผิดพลาด");
    } finally {
      toast.dismiss(__tid_save_1);
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!(await swal.confirm({ title: "ลบอุปกรณ์นี้?", danger: true }))) return;
    const { error } = await supabase.from("iot_devices").delete().eq("id", id);
    if (error) toast.error(saveErrorMessage(error));
    else {
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["iot-devices-admin"] });
    }
  };

  const testFetch = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("iot-fetch", {
        body: { device_id: id, record_history: false },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.status === "online") toast.success(`ค่าที่ได้: ${r.value}`);
      else toast.error(r?.error || "ทดสอบไม่สำเร็จ");
      qc.invalidateQueries({ queryKey: ["iot-devices-admin"] });
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Cpu className="h-7 w-7 text-primary" /> จัดการอุปกรณ์ IoT
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            เพิ่ม/แก้ไขการเชื่อมต่อ Home Assistant หรือ REST API ใดๆ
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> เพิ่มอุปกรณ์
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <div className="grid gap-3">
          {devices.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{d.name}</h3>
                    {(() => {
                      const c = getCategory(d.system_category);
                      const Icon = c.icon;
                      return (
                        <Badge variant="outline" className={c.ring}>
                          <Icon className={`h-3 w-3 mr-1 ${c.color}`} />
                          {c.label}
                        </Badge>
                      );
                    })()}
                    <Badge variant="outline">{d.source_type}</Badge>
                    <Badge variant="outline">{d.device_type}</Badge>
                    {!d.is_active && <Badge variant="secondary">ปิดใช้งาน</Badge>}
                    {d.last_status && (
                      <Badge variant="outline" className={
                        d.last_status === "online" ? "text-emerald-600 border-emerald-500/30"
                        : d.last_status === "error" ? "text-rose-600 border-rose-500/30"
                        : ""
                      }>{d.last_status}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {d.entity_id || d.request_path || d.base_url || "—"}
                  </p>
                  {d.last_value != null && (
                    <p className="text-sm mt-1">
                      ค่า: <span className="font-medium">{d.last_value}{d.unit ? ` ${d.unit}` : ""}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => testFetch(d.id)}>
                    <RefreshCw className="h-4 w-4 mr-1" /> ทดสอบ
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(d.id)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {devices.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีอุปกรณ์</CardContent></Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์ IoT"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>ชื่ออุปกรณ์ *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น อุณหภูมิห้องประชุม" />
            </div>
            <div className="md:col-span-2">
              <Label>คำอธิบาย</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>ประเภทอุปกรณ์</Label>
              <Select value={form.device_type} onValueChange={(v) => setForm({ ...form, device_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensor">Sensor</SelectItem>
                  <SelectItem value="switch">Switch</SelectItem>
                  <SelectItem value="gauge">Gauge</SelectItem>
                  <SelectItem value="binary">Binary</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ระบบ (หมวดหมู่ IoT) *</Label>
              <Select value={form.system_category} onValueChange={(v) => setForm({ ...form, system_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IOT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>หน่วยวัด</Label>
              <Input value={form.unit ?? ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="°C, %, kWh" />
            </div>
            <div>
              <Label>แหล่งข้อมูล *</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home_assistant">Home Assistant</SelectItem>
                  <SelectItem value="generic_rest">Generic REST API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ที่ตั้ง</Label>
              <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="อาคาร 1 ห้อง 101" />
            </div>
            <div className="md:col-span-2">
              <Label>Base URL *</Label>
              <Input value={form.base_url ?? ""} onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder={form.source_type === "home_assistant" ? "http://homeassistant.local:8123" : "https://api.example.com"} />
            </div>
            {form.source_type === "home_assistant" ? (
              <div className="md:col-span-2">
                <Label>Entity ID *</Label>
                <Input value={form.entity_id ?? ""} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} placeholder="sensor.living_room_temperature" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Request Path</Label>
                  <Input value={form.request_path ?? ""} onChange={(e) => setForm({ ...form, request_path: e.target.value })} placeholder="/v1/sensor/temp" />
                </div>
                <div>
                  <Label>JSON Path</Label>
                  <Input value={form.json_path ?? ""} onChange={(e) => setForm({ ...form, json_path: e.target.value })} placeholder="$.data.value" />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <Label>API Token / Bearer Token</Label>
              <Input type="password" value={form.api_token ?? ""} onChange={(e) => setForm({ ...form, api_token: e.target.value })} placeholder={form.id ? "•••••• (ปล่อยว่างเพื่อคงค่าเดิม)" : "Long-lived access token"} />
              <p className="text-xs text-muted-foreground mt-1">ใช้ใน header: Authorization: Bearer ... — เก็บลับ ไม่สามารถดึงกลับมาดูได้</p>
            </div>
            <div>
              <Label>กลุ่มแดชบอร์ด</Label>
              <Input value={form.dashboard_group} onChange={(e) => setForm({ ...form, dashboard_group: e.target.value })} placeholder="general" />
            </div>
            <div>
              <Label>ลำดับการแสดง</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
            </div>
            <div>
              <Label>ความถี่การ poll (วินาที)</Label>
              <Input type="number" value={form.poll_interval_seconds} onChange={(e) => setForm({ ...form, poll_interval_seconds: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}