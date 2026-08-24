import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Database, Key, Download, Copy, Trash2, Plus, FileJson, FileSpreadsheet, ShieldCheck, Cloud } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { swal } from "@/lib/swal";
import MapPicker from "@/components/MapPicker";
import { getBackendConfig } from "@/lib/runtimeConfig";

const FUNCTIONS_BASE = `${getBackendConfig().url}/functions/v1`;

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-");

export default function DistrictFeedPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [hubConfig, setHubConfig] = useState<any>(null);
  const [endpoint, setEndpoint] = useState<any>(null);
  // viewMode = re-opening dialog for an existing key (raw secret no longer available)
  const [viewMode, setViewMode] = useState(false);
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [savingCoords, setSavingCoords] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [rotating, setRotating] = useState(false);

  const projectRef = getBackendConfig().projectId;
  const supabaseUrl = getBackendConfig().url;
  const apiBaseUrl = `${supabaseUrl}/functions/v1/district-feed-api`;

  const viewKeyDetails = (k: any) => {
    setNewKey(null);
    setViewMode(true);
    setEndpoint({
      project_ref: projectRef,
      supabase_url: supabaseUrl,
      functions_base_url: apiBaseUrl,
      openapi_url: `${apiBaseUrl}/openapi.json`,
      health_url: `${apiBaseUrl}/health`,
      auth_header: "x-api-key",
    });
    setHubConfig({
      school_name: school?.school_name ?? null,
      school_code: school?.school_code ?? school?.obec_code ?? null,
      latitude: school?.latitude ?? null,
      longitude: school?.longitude ?? null,
      api_base_url: apiBaseUrl,
      api_key: `${k.key_prefix}•••••••• (ไม่สามารถแสดงคีย์เต็มได้ — กด "ออก key ใหม่" หากต้องการคีย์ใหม่)`,
      project_ref: projectRef,
      key_name: k.name,
    });
    setOpenCreate(true);
  };

  const rotateKey = async (k: any) => {
    if (!(await swal.confirm({ title: `ออก API key ใหม่สำหรับ "${k.name}"?`, text: "key เดิมจะถูกยกเลิก ระบบเขตต้องอัปเดต key ใหม่" }))) return;
    if (rotating) return;
    setRotating(true);
    try {
      const { error: deactivateErr } = await supabase.from("district_api_keys").update({ is_active: false }).eq("id", k.id);
      if (deactivateErr) return toast({ title: "ออก key ใหม่ไม่สำเร็จ", description: deactivateErr.message, variant: "destructive" });
      const { data, error } = await supabase.functions.invoke("district-feed-create-key", {
        body: { name: k.name, description: k.description, scopes: k.scopes },
      });
      if (error) return toast({ title: "ออก key ใหม่ไม่สำเร็จ", description: error.message, variant: "destructive" });
      setViewMode(false);
      setNewKey(data?.key || null);
      setHubConfig(data?.hub_config || null);
      setEndpoint(data?.endpoint || null);
      qc.invalidateQueries({ queryKey: ["district-api-keys"] });
    } finally {
      setRotating(false);
    }
  };

  const { data: keys = [] } = useQuery({
    queryKey: ["district-api-keys"],
    queryFn: async () => {
      const { data } = await supabase.from("district_api_keys").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["district-feed-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("district_feed_logs").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const { data: school } = useQuery({
    queryKey: ["school-consent"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("id, school_name, school_code, obec_code, central_hub_consent, central_hub_consent_at, latitude, longitude").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (school?.latitude != null) setLat(String(school.latitude));
    if (school?.longitude != null) setLng(String(school.longitude));
  }, [school?.latitude, school?.longitude]);

  const ensureSchoolRow = async (): Promise<string | null> => {
    if (school?.id) return school.id;
    const { data: nameSetting } = await supabase
      .from("cms_settings").select("value").eq("key", "school_name").maybeSingle();
    const school_name = (nameSetting?.value as string) || "โรงเรียน";
    const code = `SCHOOL-${Date.now()}`;
    const { data, error } = await supabase.from("schools")
      .insert({ school_code: code, school_name }).select("id").single();
    if (error) { toast({ title: "สร้างข้อมูลโรงเรียนไม่สำเร็จ", description: error.message, variant: "destructive" }); return null; }
    qc.invalidateQueries({ queryKey: ["school-consent"] });
    return data.id;
  };

  const toggleConsent = async (next: boolean) => {
    const id = await ensureSchoolRow();
    if (!id) return;
    if (next && !(await swal.confirm({ title: "ยินยอมส่งข้อมูลสรุปขึ้นระบบกลาง?", text: "ระบบจะส่งเฉพาะตัวเลขสถิติ (ไม่มีข้อมูลส่วนบุคคล)" }))) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("schools").update({
      central_hub_consent: next,
      central_hub_consent_at: next ? new Date().toISOString() : null,
      central_hub_consent_by: next ? user?.id ?? null : null,
    }).eq("id", id);
    if (error) return toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
    toast({ title: next ? "เปิดการส่งข้อมูลแล้ว" : "ปิดการส่งข้อมูลแล้ว" });
    qc.invalidateQueries({ queryKey: ["school-consent"] });
  };

  const saveCoords = async () => {
    if (savingCoords) return;
    const latNum = parseFloat(lat), lngNum = parseFloat(lng);
    if (!isFinite(latNum) || latNum < -90 || latNum > 90) return toast({ title: "ละติจูดไม่ถูกต้อง (-90 ถึง 90)", variant: "destructive" });
    if (!isFinite(lngNum) || lngNum < -180 || lngNum > 180) return toast({ title: "ลองจิจูดไม่ถูกต้อง (-180 ถึง 180)", variant: "destructive" });
    setSavingCoords(true);
    try {
      const id = await ensureSchoolRow();
      if (!id) return;
      const { error } = await supabase.from("schools").update({ latitude: latNum, longitude: lngNum }).eq("id", id);
      if (error) return toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
      toast({ title: "บันทึกพิกัดเรียบร้อย" });
      qc.invalidateQueries({ queryKey: ["school-consent"] });
    } finally {
      setSavingCoords(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return toast({ title: "เบราว์เซอร์ไม่รองรับ GPS", variant: "destructive" });
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(String(pos.coords.latitude)); setLng(String(pos.coords.longitude)); toast({ title: "ดึงพิกัดปัจจุบันแล้ว" }); },
      (err) => toast({ title: "อ่านพิกัดไม่สำเร็จ", description: err.message, variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const createKey = async () => {
    if (!name.trim()) return toast({ title: "กรุณาระบุชื่อ", variant: "destructive" });
    if (creatingKey) return;
    setCreatingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("district-feed-create-key", {
        body: { name, description },
      });
      if (error) return toast({ title: "สร้าง API key ไม่สำเร็จ", description: error.message, variant: "destructive" });
      setNewKey(data?.key || null);
      setHubConfig(data?.hub_config || null);
      setEndpoint(data?.endpoint || null);
      setName(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["district-api-keys"] });
    } finally {
      setCreatingKey(false);
    }
  };

  const downloadHubConfig = () => {
    if (!hubConfig) return;
    const blob = new Blob([JSON.stringify(hubConfig, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hub-config-${hubConfig.school_code || "school"}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const revokeKey = async (id: string) => {
    if (!(await swal.confirm({ title: "ลบ API key นี้ออกจากระบบ?", text: "ลบถาวร — ระบบเขตที่ใช้ key นี้จะเข้าถึงไม่ได้ทันที", danger: true }))) return;
    const { error } = await supabase.from("district_api_keys").delete().eq("id", id);
    if (error) return toast({ title: "ลบไม่สำเร็จ", description: error.message, variant: "destructive" });
    toast({ title: "ลบแล้ว" });
    qc.invalidateQueries({ queryKey: ["district-api-keys"] });
  };

  const exportJson = async (kind: "schools" | "stats" | "obec" | "pp") => {
    let payload: any = {};
    if (kind === "schools") {
      const { data } = await supabase.from("schools").select("*");
      payload = { exported_at: new Date().toISOString(), schools: data || [] };
    } else if (kind === "stats") {
      const [students, personnel, classrooms] = await Promise.all([
        supabase.from("students").select("id, status", { count: "exact", head: true }),
        supabase.from("personnel").select("id", { count: "exact", head: true }),
        supabase.from("classrooms").select("id", { count: "exact", head: true }),
      ]);
      payload = {
        exported_at: new Date().toISOString(),
        stats: {
          total_students: students.count ?? 0,
          total_personnel: personnel.count ?? 0,
          total_classrooms: classrooms.count ?? 0,
        },
      };
    } else if (kind === "obec") {
      const [lunch, milk] = await Promise.all([
        supabase.from("school_lunch_records").select("*").order("lunch_date", { ascending: false }).limit(500),
        supabase.from("school_milk_records").select("*").order("distribution_date", { ascending: false }).limit(500),
      ]);
      payload = { exported_at: new Date().toISOString(), school_lunch: lunch.data || [], school_milk: milk.data || [] };
    } else if (kind === "pp") {
      const { data } = await supabase.from("enrollments").select("*").limit(2000);
      payload = { exported_at: new Date().toISOString(), enrollments: data || [] };
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `district-feed-${kind}-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    const { data } = await supabase.from("schools").select("*");
    if (!data || data.length === 0) return toast({ title: "ไม่มีข้อมูล" });
    const cols = Object.keys(data[0]);
    const rows = [cols.join(",")];
    for (const row of data) {
      rows.push(cols.map((c) => JSON.stringify((row as any)[c] ?? "")).join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `schools-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const copyKey = (k: string) => {
    navigator.clipboard.writeText(k);
    toast({ title: "คัดลอกแล้ว" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6" /> ระบบเขต / Feed API
        </h1>
        <p className="text-sm text-muted-foreground">
          จัดการ API key และส่งออกข้อมูลโรงเรียนสำหรับระบบเขตพื้นที่ภายนอก
        </p>
      </div>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" /> ส่งข้อมูลสรุปขึ้นระบบกลาง (Central Hub)
          </CardTitle>
          <CardDescription>
            เปิดเพื่ออนุญาตให้ระบบกลางดึงข้อมูล <b>สถิติสรุปรายวัน</b> ของโรงเรียน (จำนวนนักเรียน/บุคลากร/อัตราการมาเรียน ฯลฯ)
            <br />ระบบจะ <b>ไม่ส่งข้อมูลส่วนบุคคล</b> (ชื่อ เลขบัตร รูป) เป็นไปตาม PDPA
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <div>โรงเรียน: <b>{school?.school_name || "-"}</b></div>
            <div className="text-muted-foreground text-xs">
              รหัสโรงเรียน: <code>{school?.school_code || school?.obec_code || "ยังไม่ระบุ"}</code>
              {school?.central_hub_consent_at && <> • ยินยอมเมื่อ {fmt(school.central_hub_consent_at)}</>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{school?.central_hub_consent ? "เปิด" : "ปิด"}</span>
            <Switch checked={!!school?.central_hub_consent} onCheckedChange={toggleConsent} />
          </div>
        </CardContent>
      </Card>

      {/* GPS coordinates — สำหรับให้ระบบเขต/ส่วนกลาง ปักหมุดโรงเรียนบนแผนที่ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">📍 พิกัด GPS โรงเรียน (สำหรับแสดงบนแผนที่ระบบกลาง)</CardTitle>
          <CardDescription>
            ระบบเขตจะดึงพิกัดนี้ผ่าน <code>GET /district-feed-api/schools</code> (รวม GeoJSON FeatureCollection) เพื่อปักหมุดบนแผนที่
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MapPicker
            lat={lat ? parseFloat(lat) : null}
            lng={lng ? parseFloat(lng) : null}
            radius={150}
            height={380}
            onChange={(la, ln) => { setLat(String(la)); setLng(String(ln)); }}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>ละติจูด (Latitude)</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="เช่น 13.7563" inputMode="decimal" />
            </div>
            <div>
              <Label>ลองจิจูด (Longitude)</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="เช่น 100.5018" inputMode="decimal" />
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="outline" onClick={useCurrentLocation}>📡 ใช้ตำแหน่งปัจจุบัน</Button>
              <Button type="button" onClick={saveCoords} disabled={savingCoords}>{savingCoords ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </div>
          {school?.latitude != null && school?.longitude != null && (
            <p className="text-xs text-muted-foreground">
              พิกัดที่บันทึกไว้: {school.latitude}, {school.longitude} •{" "}
              <button
                type="button"
                onClick={() => window.open(`https://www.google.com/maps?q=${school.latitude},${school.longitude}`, "_blank", "noopener,noreferrer")}
                className="underline text-primary hover:opacity-80"
              >
                เปิดใน Google Maps ↗
              </button>
            </p>
          )}
        </CardContent>
      </Card>


      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys"><Key className="w-4 h-4 mr-1" /> API Keys</TabsTrigger>
          <TabsTrigger value="export"><Download className="w-4 h-4 mr-1" /> Export</TabsTrigger>
          <TabsTrigger value="docs"><FileJson className="w-4 h-4 mr-1" /> เอกสาร API</TabsTrigger>
          <TabsTrigger value="logs"><ShieldCheck className="w-4 h-4 mr-1" /> Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { setOpenCreate(true); setNewKey(null); setViewMode(false); setHubConfig(null); setEndpoint(null); }}>
              <Plus className="w-4 h-4 mr-1" /> สร้าง API Key
            </Button>
          </div>
          {keys.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มี API key — กดปุ่มด้านบนเพื่อสร้าง</CardContent></Card>
          )}
          {keys.map((k: any) => (
            <Card key={k.id}>
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{k.name}</p>
                    {k.is_active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="outline">Revoked</Badge>}
                    {(k.scopes || []).map((s: string) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                  </div>
                  <p className="text-xs text-muted-foreground">{k.description || "-"}</p>
                  <p className="text-xs font-mono mt-1">{k.key_prefix}••••••••</p>
                  <p className="text-xs text-muted-foreground">สร้าง {fmt(k.created_at)} • ใช้ล่าสุด {fmt(k.last_used_at)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => viewKeyDetails(k)} title="ดูข้อมูลการเชื่อมต่อ">
                  <FileJson className="w-4 h-4 mr-1" /> ดู
                </Button>
                {k.is_active && (
                  <Button variant="outline" size="sm" onClick={() => rotateKey(k)} disabled={rotating} title="ออก key ใหม่ (rotate)">
                    <Key className="w-4 h-4 mr-1" /> ออก key ใหม่
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => revokeKey(k.id)} title={k.is_active ? "ลบ key นี้" : "ลบรายการที่ค้างนี้ออกจากระบบ"}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="export" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ส่งออกข้อมูล (Manual)</CardTitle>
              <CardDescription>ดาวน์โหลดข้อมูลแบบ on-demand เพื่อนำเข้าระบบเขต</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => exportJson("schools")}><FileJson className="w-4 h-4 mr-1" /> โรงเรียน (JSON)</Button>
              <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="w-4 h-4 mr-1" /> โรงเรียน (CSV)</Button>
              <Button variant="outline" onClick={() => exportJson("stats")}><FileJson className="w-4 h-4 mr-1" /> สถิติ (JSON)</Button>
              <Button variant="outline" onClick={() => exportJson("obec")}><FileJson className="w-4 h-4 mr-1" /> รายงาน OBEC (JSON)</Button>
              <Button variant="outline" onClick={() => exportJson("pp")}><FileJson className="w-4 h-4 mr-1" /> รายงาน ปพ. (JSON)</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">REST API Endpoints</CardTitle>
              <CardDescription>ใช้ <code className="px-1 bg-muted rounded">x-api-key</code> หรือ <code className="px-1 bg-muted rounded">Authorization: Bearer &lt;key&gt;</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm font-mono">
              <p className="break-all"><Badge>GET</Badge> {FUNCTIONS_BASE}/district-feed-api/schools</p>
              <p className="break-all"><Badge>GET</Badge> {FUNCTIONS_BASE}/district-feed-api/schools/:id</p>
              <p className="break-all"><Badge>GET</Badge> {FUNCTIONS_BASE}/district-feed-api/stats?school_id=...</p>
              <p className="break-all"><Badge>GET</Badge> {FUNCTIONS_BASE}/district-feed-api/reports/obec</p>
              <p className="break-all"><Badge>GET</Badge> {FUNCTIONS_BASE}/district-feed-api/reports/pp?academic_year=2568</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-2">
          {logs.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีการเรียก API</CardContent></Card>}
          {logs.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-3 text-sm flex items-center gap-2 flex-wrap">
                <Badge variant={l.status_code >= 400 ? "destructive" : "outline"}>{l.status_code}</Badge>
                <code className="text-xs">{l.method} {l.endpoint}</code>
                <span className="text-xs text-muted-foreground ml-auto">{fmt(l.created_at)}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? "API Key สร้างสำเร็จ" : viewMode ? "ข้อมูลการเชื่อมต่อ API" : "สร้าง API Key ใหม่"}</DialogTitle>
          </DialogHeader>
          {(newKey || viewMode) ? (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {newKey ? (
                <>
                  <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">⚠️ คัดลอก key นี้ทันที จะไม่แสดงอีก</p>
                  <div>
                    <Label className="text-xs">API Key</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={newKey} className="font-mono text-xs" />
                      <Button size="sm" onClick={() => copyKey(newKey)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">ℹ️ คีย์เต็มถูกเก็บแบบเข้ารหัส (hash) จึงไม่สามารถแสดงซ้ำได้ — หากต้องการคีย์ใหม่ กด "ออก key ใหม่" ที่การ์ดด้านนอก</p>
              )}

              {endpoint && (
                <>
                  <div>
                    <Label className="text-xs">Project Ref</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={endpoint.project_ref} className="font-mono text-xs" />
                      <Button size="sm" variant="outline" onClick={() => copyKey(endpoint.project_ref)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Functions Base URL</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={endpoint.functions_base_url} className="font-mono text-xs" />
                      <Button size="sm" variant="outline" onClick={() => copyKey(endpoint.functions_base_url)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">OpenAPI Spec</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={endpoint.openapi_url} className="font-mono text-xs" />
                      <Button size="sm" variant="outline" onClick={() => copyKey(endpoint.openapi_url)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Auth Header (ชื่อ header สำหรับส่ง API Key)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={endpoint.auth_header || "x-api-key"} className="font-mono text-xs" />
                      <Button size="sm" variant="outline" onClick={() => copyKey(endpoint.auth_header || "x-api-key")}><Copy className="w-4 h-4" /></Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ใช้ได้ 2 รูปแบบ: <code className="px-1 bg-muted rounded">x-api-key: &lt;KEY&gt;</code> หรือ <code className="px-1 bg-muted rounded">Authorization: Bearer &lt;KEY&gt;</code>
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">ตัวอย่างคำสั่ง cURL</Label>
                    <pre className="text-[11px] bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{`curl -H "x-api-key: <YOUR_KEY>" \\
  "${endpoint.functions_base_url}/schools"`}</pre>
                    <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => copyKey(`curl -H "x-api-key: <YOUR_KEY>" "${endpoint.functions_base_url}/schools"`)}>
                      <Copy className="w-3 h-3 mr-1" /> คัดลอก cURL
                    </Button>
                  </div>
                </>
              )}

              {hubConfig && (
                <div>
                  <Label className="text-xs flex items-center justify-between">
                    <span>Hub Config (วางในฟอร์ม "เพิ่มโรงเรียน" ของ Hub กลาง)</span>
                    <Button size="sm" variant="outline" onClick={downloadHubConfig}>
                      <Download className="w-3 h-3 mr-1" /> ดาวน์โหลด JSON
                    </Button>
                  </Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">{JSON.stringify(hubConfig, null, 2)}</pre>
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => copyKey(JSON.stringify(hubConfig, null, 2))}>
                    <Copy className="w-3 h-3 mr-1" /> คัดลอกทั้งหมด
                  </Button>
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => { setOpenCreate(false); setNewKey(null); setViewMode(false); setHubConfig(null); setEndpoint(null); }}>เสร็จสิ้น</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>ชื่อ Key *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สพป.เขต 1" />
              </div>
              <div>
                <Label>คำอธิบาย</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ระบุการใช้งาน" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCreate(false)}>ยกเลิก</Button>
                <Button onClick={createKey} disabled={creatingKey}>{creatingKey ? "กำลังสร้าง..." : "สร้าง"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
