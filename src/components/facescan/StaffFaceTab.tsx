import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanFace, UserPlus, Camera, CameraOff, Trash2, Database, CheckCircle2, AlertTriangle, FlaskConical, Images, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import LivenessFaceRegisterDialog from "@/components/users/LivenessFaceRegisterDialog";
import { useMyPersonnel } from "@/hooks/useMyPersonnel";
import { useUserRole } from "@/hooks/useUserRole";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  loadFaceModels, getAllDescriptors, matchDescriptor, drawFaceFrame,
  detectorOptionsHQ, estimateFaceSharpness, type KnownFace,
} from "@/lib/faceApi";
import {
  addPersonnelSamplesFromFiles, learnPersonnelFromScan, PERSONNEL_LEARN,
  type FileLearnResult,
} from "@/lib/personnelFaceLearning";
import { saveErrorMessage } from "@/lib/saveError";


interface SimResult {
  id: string;
  name: string;
  code: string;
  distance: number;
  confidence: number;
  time: string;
}

const fullName = (p: any) => `${p?.prefix || ""}${p?.first_name || ""} ${p?.last_name || ""}`.trim();

const StaffFaceTab = () => {
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canManageOthers = isAdmin || isDirector;
  const { data: me } = useMyPersonnel();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [search, setSearch] = useState("");

  // ---------- personnel list ----------
  const { data: personnel = [] } = useQuery({
    queryKey: ["staff-face-personnel"],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, employee_code, prefix, first_name, last_name, position, department")
        .eq("status", "active")
        .order("first_name");
      return data || [];
    },
  });

  // ---------- registered faces ----------
  const { data: faces = [], isLoading: facesLoading } = useQuery({
    queryKey: ["staff-face-db"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("personnel_face_descriptors")
        .select("id, personnel_id, descriptor, face_image, quality_score, created_at, personnel!inner(id, prefix, first_name, last_name, employee_code, position)");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const grouped = (() => {
    const map = new Map<string, any>();
    for (const r of faces as any[]) {
      const id = r.personnel_id;
      if (!map.has(id)) map.set(id, { ...r.personnel, personnel_id: id, sample_count: 0, face_image: null, best: -1, descriptors: [] as number[][] });
      const g = map.get(id);
      g.sample_count++;
      g.descriptors.push(r.descriptor as number[]);
      const q = r.quality_score ?? 0;
      if (r.face_image && q >= g.best) { g.face_image = r.face_image; g.best = q; }
    }
    return Array.from(map.values());
  })();

  const mySamples = grouped.find((g) => g.personnel_id === me?.id)?.sample_count || 0;

  const deleteFor = async (personnelId: string, name: string) => {
    if (!(await swal.confirm({ title: `ลบใบหน้าของ ${name} ทั้งหมด?`, danger: true }))) return;
    const { error } = await (supabase as any).from("personnel_face_descriptors").delete().eq("personnel_id", personnelId);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ลบแล้ว");
    qc.invalidateQueries({ queryKey: ["staff-face-db"] });
  };

  const filteredPersonnel = personnel.filter((p: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [p.first_name, p.last_name, p.employee_code].some((v) => String(v || "").toLowerCase().includes(q));
  });

  // ---------- simulation scan ----------
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const [modelMsg, setModelMsg] = useState("");
  const [results, setResults] = useState<SimResult[]>([]);
  const [autoLearn, setAutoLearn] = useState(true);
  const autoLearnRef = useRef(true);
  useEffect(() => { autoLearnRef.current = autoLearn; }, [autoLearn]);
  const learnedRef = useRef<Record<string, number>>({});
  const [learnLog, setLearnLog] = useState<string[]>([]);

  // ---------- multi-photo learning ----------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [learnTarget, setLearnTarget] = useState<string>("");
  const [uploadSearch, setUploadSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState<FileLearnResult[]>([]);


  const known: KnownFace[] = grouped.map((g) => ({
    studentId: g.personnel_id,
    descriptors: g.descriptors,
  }));
  const infoById = new Map<string, { name: string; code: string }>(
    grouped.map((g) => [g.personnel_id, { name: fullName(g), code: g.employee_code || "" }]),
  );

  const stopCamera = () => {
    cancelRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    try {
      setModelMsg("กำลังโหลดโมเดล...");
      await loadFaceModels((m) => setModelMsg(m));
      setModelMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      cancelRef.current = false;
      setStreaming(true);
      void loop();
    } catch (e: any) {
      toast.error("เปิดกล้องไม่สำเร็จ: " + (e?.message || ""));
      setModelMsg("");
    }
  };

  const loop = async () => {
    if (cancelRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) { setTimeout(loop, 400); return; }
    try {
      const dets = await getAllDescriptors(video as any, detectorOptionsHQ(416, 0.4));
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const det of dets) {
          const rb = det.detection.box;
          const box = { x: canvas.width - rb.x - rb.width, y: rb.y, width: rb.width, height: rb.height };
          const m = matchDescriptor(det.descriptor, known, 0.45);
          const hitId = m.studentId;
          const hit = hitId ? infoById.get(hitId) : null;
          const sharp = estimateFaceSharpness(video, box);
          drawFaceFrame(ctx, {
            box,
            label: hit ? `${hit.name} (${(m.confidence * 100).toFixed(0)}%)` : sharp < 40 ? "ภาพเบลอ" : "ไม่รู้จัก",
            color: hit ? "#22c55e" : "#f97316",
          } as any);
          if (hit) {
            setResults((prev) => {
              if (prev[0]?.id === hitId && Date.now() - new Date(prev[0].time).getTime() < 5000) return prev;
              return [{
                id: hitId!,
                name: hit.name,
                code: hit.code,
                distance: m.distance ?? 0,
                confidence: m.confidence,
                time: new Date().toISOString(),
              }, ...prev].slice(0, 20);
            });
          }
        }
      }
    } catch { /* ignore frame error */ }
    setTimeout(loop, 350);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register" className="gap-2"><UserPlus className="w-4 h-4" />ลงทะเบียน</TabsTrigger>
          <TabsTrigger value="simulate" className="gap-2"><FlaskConical className="w-4 h-4" />จำลองสแกน</TabsTrigger>
          <TabsTrigger value="db" className="gap-2"><Database className="w-4 h-4" />ฐานข้อมูล</TabsTrigger>
        </TabsList>

        {/* ---------- ลงทะเบียน ---------- */}
        <TabsContent value="register" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ScanFace className="w-4 h-4 text-primary" />ใบหน้าของฉัน (บุคลากร)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!me ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลบุคลากร — กรุณาเชื่อมบัญชีก่อนลงทะเบียนใบหน้า
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-semibold">{fullName(me)}</p>
                      <p className="text-xs text-muted-foreground">รหัส {me.employee_code} · {me.position}</p>
                    </div>
                    {mySamples > 0 ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />ลงทะเบียนแล้ว {mySamples} ภาพ
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" />ยังไม่ได้ลงทะเบียน</Badge>
                    )}
                  </div>
                  <Button className="gradient-primary gap-2" onClick={() => { setTarget(me); setDialogOpen(true); }}>
                    <ScanFace className="w-4 h-4" />{mySamples > 0 ? "ลงทะเบียนใบหน้าใหม่" : "เริ่มลงทะเบียนใบหน้า"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {canManageOthers && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ลงทะเบียนให้บุคลากรคนอื่น</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="ค้นหาชื่อ/รหัสบุคลากร..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto">
                  {filteredPersonnel.map((p: any) => {
                    const n = grouped.find((g) => g.personnel_id === p.id)?.sample_count || 0;
                    return (
                      <div key={p.id} className="p-3 rounded-lg border bg-card flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{fullName(p)}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.employee_code} · {p.position}</p>
                          <Badge variant={n ? "secondary" : "outline"} className="mt-1 text-xs">{n} ภาพ</Badge>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setTarget(p); setDialogOpen(true); }}>
                          <ScanFace className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------- จำลองสแกน ---------- */}
        <TabsContent value="simulate" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" />จำลองสแกนใบหน้าบุคลากร</h3>
                  <p className="text-xs text-muted-foreground">โหมดทดสอบ — ไม่บันทึกการมาปฏิบัติงาน ใช้ตรวจความแม่นยำของระบบ</p>
                </div>
                <Badge variant="outline">{grouped.length} คนในฐาน</Badge>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                {!streaming && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
                    {modelMsg || "กดเริ่มเพื่อเปิดกล้อง"}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {streaming ? (
                  <Button variant="outline" className="gap-2" onClick={stopCamera}><CameraOff className="w-4 h-4" />หยุด</Button>
                ) : (
                  <Button className="gradient-primary gap-2" onClick={startCamera}><Camera className="w-4 h-4" />เริ่มจำลองสแกน</Button>
                )}
                {results.length > 0 && <Button variant="ghost" onClick={() => setResults([])}>ล้างผล</Button>}
              </div>

              <div className="space-y-2">
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีผลการจำลอง</p>
                ) : results.map((r, i) => (
                  <div key={`${r.id}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.code} · {new Date(r.time).toLocaleTimeString("th-TH")}</p>
                    </div>
                    <Badge variant="secondary">ความมั่นใจ {(r.confidence * 100).toFixed(0)}% · d={r.distance.toFixed(3)}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- ฐานข้อมูล ---------- */}
        <TabsContent value="db" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2"><Database className="w-4 h-4" />ฐานข้อมูลใบหน้าบุคลากร</h3>
                <Badge variant="outline">{grouped.length} คน</Badge>
              </div>
              {facesLoading ? (
                <p className="text-center text-muted-foreground py-8">กำลังโหลด...</p>
              ) : grouped.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีใบหน้าบุคลากรในระบบ</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped.map((g) => (
                    <div key={g.personnel_id} className="p-3 rounded-lg border bg-card flex items-center gap-3">
                      {g.face_image ? (
                        <img src={g.face_image} alt="" className="w-12 h-12 rounded-full object-cover border" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs">{g.first_name?.[0]}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{fullName(g)}</p>
                        <p className="text-xs text-muted-foreground truncate">{g.employee_code} · {g.position}</p>
                        <Badge variant="secondary" className="mt-1 text-xs">{g.sample_count} ภาพ</Badge>
                      </div>
                      {canManageOthers && (
                        <Button size="icon" variant="ghost" onClick={() => deleteFor(g.personnel_id, fullName(g))}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {target && (
        <LivenessFaceRegisterDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          personnelId={target.id}
          displayName={fullName(target)}
          onComplete={() => qc.invalidateQueries({ queryKey: ["staff-face-db"] })}
        />
      )}
    </div>
  );
};

export default StaffFaceTab;
