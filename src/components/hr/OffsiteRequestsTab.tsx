import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Time24Input } from "@/components/ui/time24-input";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { Plus, Check, X, Trash2, MapPin, Send, FileText, Camera, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { todayBangkok } from "@/lib/dateBE";
import { notify } from "@/lib/notify";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { confirmDelete } from "@/lib/confirmAction";

export type OffsiteType = "official_duty" | "offsite_during" | "early_leave";

const TYPE_LABEL: Record<OffsiteType, { label: string; color: string }> = {
  official_duty: { label: "ขออนุญาตไปราชการ", color: "bg-info-soft text-info" },
  offsite_during: { label: "ออกนอกสถานที่ระหว่างวัน", color: "bg-info-soft text-info" },
  early_leave: { label: "ออกก่อนเวลา (ไม่กลับ)", color: "bg-warning-soft text-warning" },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "รออนุมัติ", color: "bg-warning-soft text-warning" },
  approved: { label: "อนุมัติแล้ว", color: "bg-success-soft text-success" },
  rejected: { label: "ไม่อนุมัติ", color: "bg-danger-soft text-danger" },
};

interface Props {
  isAdmin: boolean;
  myPersonnel: any | null;
}

export function OffsiteRequestsTab({ isAdmin, myPersonnel }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // form state
  const [form, setForm] = useState({
    request_type: "official_duty" as OffsiteType,
    request_date: todayBangkok(),
    leave_time: "",
    return_date: "",
    return_time: "",
    reason: "",
    location: "",
    notes: "",
    acting_teacher: "",
  });

  const resetForm = () => {
    setForm({
      request_type: "official_duty",
      request_date: todayBangkok(),
      leave_time: "",
      return_date: "",
      return_time: "",
      reason: "",
      location: "",
      notes: "",
      acting_teacher: "",
    });
    setCapturedPhoto(null);
    stopCamera();
  };

  const startCamera = async () => {
    setCapturedPhoto(null);
    setCameraOpen(true);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setTimeout(async () => {
        if (videoRef.current) {
          await attachStreamToVideo(videoRef.current, stream);
          setCameraReady(true);
        }
      }, 50);
    } catch (e: any) {
      toast.error("ไม่สามารถเปิดกล้องได้: " + (e.message || ""));
      setCameraOpen(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    const stamp = new Date().toLocaleString("th-TH");
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, size - 36, size, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText(stamp, 10, size - 12);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    setCapturedPhoto(dataUrl);
    stopCamera();
    return dataUrl;
  };

  const uploadOffsitePhoto = async (dataUrl: string, code: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    const today = todayBangkok();
    const path = `${today}/offsite_${code}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("attendance-photos").upload(path, blob, {
      contentType: "image/jpeg",
    });
    if (error) {
      console.warn("Offsite photo upload failed; fallback to data URL", error);
      return dataUrl;
    }
    const { data } = await supabase.storage
      .from("attendance-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl || dataUrl;
  };

  useEffect(() => () => stopCamera(), []);

  const { data: requests = [] } = useQuery({
    queryKey: ["offsite_requests", isAdmin ? "all" : myPersonnel?.id],
    enabled: isAdmin || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase
        .from("offsite_requests" as any)
        .select("*, personnel(prefix, first_name, last_name, employee_code, user_id)")
        .order("request_date", { ascending: false })
        .limit(200);
      if (!isAdmin && myPersonnel?.id) q = q.eq("personnel_id", myPersonnel.id);
      const { data, error } = await q;
      if (error) { console.error(error); return []; }
      return data || [];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["personnel-active-teachers"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      return data || [];
    },
  });

  const submit = async () => {
    if (!myPersonnel?.id) {
      toast.error("ไม่พบข้อมูลบุคลากรของคุณ");
      return;
    }
    if (!form.reason.trim()) { toast.error("กรุณาระบุเหตุผล"); return; }
    if (form.request_type === "official_duty" && !form.location.trim()) {
      toast.error("กรุณาระบุสถานที่ปฏิบัติราชการ"); return;
    }
    if (form.request_type === "offsite_during" && (!form.leave_time || !form.return_time)) {
      toast.error("กรุณาระบุเวลาออกและเวลาที่กลับ"); return;
    }
    if (form.request_type === "early_leave" && !form.leave_time) {
      toast.error("กรุณาระบุเวลาที่ออก"); return;
    }
    if (!capturedPhoto) {
      toast.error("กรุณาถ่ายภาพยืนยันตัวตนก่อนส่งคำขอ"); return;
    }

    setSaving(true);
    let photoUrl: string | null = null;
    try {
      photoUrl = await uploadOffsitePhoto(capturedPhoto, myPersonnel.employee_code || myPersonnel.id);
    } catch (e) { console.warn(e); }

    const { error } = await supabase.from("offsite_requests" as any).insert({
      personnel_id: myPersonnel.id,
      request_type: form.request_type,
      request_date: form.request_date,
      leave_time: form.leave_time || null,
      return_date: form.return_date || null,
      return_time: form.return_time || null,
      reason: form.reason,
      location: form.location || null,
      notes: form.notes || null,
      acting_teacher: form.acting_teacher || null,
      photo_url: photoUrl,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ส่งคำขอเรียบร้อย รออนุมัติจากผู้บริหาร");
    setOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["offsite_requests"] });
  };

  const approve = async (r: any) => {
    const { error } = await supabase
      .from("offsite_requests" as any)
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: "ผู้บริหาร",
      })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("อนุมัติแล้ว");

    // Auto-create substitute teaching row (best effort, only for official_duty full day or with acting_teacher)
    try {
      if (r.request_type === "official_duty" || r.acting_teacher) {
        const personName = r.personnel
          ? `${r.personnel.first_name || ""} ${r.personnel.last_name || ""}`.trim()
          : "";
        await supabase.from("substitute_teaching").insert({
          original_teacher: personName,
          substitute_teacher: r.acting_teacher || "",
          teaching_date: r.request_date,
          period: r.request_type === "official_duty" ? "ทั้งวัน" : `${r.leave_time || ""} - ${r.return_time || "เลิกงาน"}`,
          status: r.acting_teacher ? "confirmed" : "pending",
          notes: `อัตโนมัติจากคำขอ${TYPE_LABEL[r.request_type as OffsiteType]?.label || ""}: ${r.reason || ""}`,
        } as any);
      }

      if (r.personnel?.user_id) {
        await notify({
          user_ids: [r.personnel.user_id],
          title: "✅ คำขออนุมัติแล้ว",
          body: `${TYPE_LABEL[r.request_type as OffsiteType]?.label || ""} วันที่ ${r.request_date}`,
          type: "offsite_request_approved",
          severity: "success",
          reference_id: r.id,
          reference_type: "offsite_requests",
          url: "/dashboard/hr/time-clock",
          channels: ["in_app", "push", "line"],
        });
      }
    } catch (e) { console.error(e); }

    qc.invalidateQueries({ queryKey: ["offsite_requests"] });
    qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
  };

  const reject = async () => {
    if (!rejectId) return;
    const { error } = await supabase
      .from("offsite_requests" as any)
      .update({ status: "rejected", rejected_reason: rejectReason })
      .eq("id", rejectId);
    if (error) { toast.error(error.message); return; }

    const r = (requests as any[]).find((x) => x.id === rejectId);
    if (r?.personnel?.user_id) {
      await notify({
        user_ids: [r.personnel.user_id],
        title: "❌ คำขอไม่ได้รับการอนุมัติ",
        body: rejectReason || "ไม่ระบุเหตุผล",
        type: "offsite_request_rejected",
        severity: "warning",
        reference_id: rejectId,
        reference_type: "offsite_requests",
        url: "/dashboard/hr/time-clock",
        channels: ["in_app", "push", "line"],
      });
    }

    toast.success("ปฏิเสธคำขอแล้ว");
    setRejectId(null);
    setRejectReason("");
    qc.invalidateQueries({ queryKey: ["offsite_requests"] });
  };

  const removeRow = async (id: string) => {
    if (!(await confirmDelete("ลบคำขอนี้?"))) return;
    const { error } = await supabase.from("offsite_requests" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["offsite_requests"] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              คำขอออกนอกสถานที่ / ไปราชการ
            </h3>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "อนุมัติ/ปฏิเสธคำขอ และจัดหาครูสอนแทนอัตโนมัติ" : "ส่งคำขอเพื่อรอการอนุมัติจากผู้บริหาร"}
            </p>
          </div>
          {!isAdmin && myPersonnel && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" />ส่งคำขอใหม่</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>ส่งคำขอใหม่</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>ประเภทคำขอ</Label>
                    <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v as OffsiteType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official_duty">ขออนุญาตไปราชการ</SelectItem>
                        <SelectItem value="offsite_during">ขอออกนอกสถานที่ระหว่างวัน (มีกำหนดกลับ)</SelectItem>
                        <SelectItem value="early_leave">ขอออกก่อนเวลา (ไม่กลับ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>วันที่</Label>
                    <BEDatePicker value={form.request_date} onChange={(v) => setForm({ ...form, request_date: v })} />
                  </div>

                  {(form.request_type === "offsite_during" || form.request_type === "early_leave") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>เวลาที่ออก</Label>
                        <Time24Input withSeconds={false} value={form.leave_time} onChange={(v) => setForm({ ...form, leave_time: v })} />
                      </div>
                      {form.request_type === "offsite_during" && (
                        <div>
                          <Label>เวลาที่กลับ</Label>
                          <Time24Input withSeconds={false} value={form.return_time} onChange={(v) => setForm({ ...form, return_time: v })} />
                        </div>
                      )}
                    </div>
                  )}

                  {form.request_type === "offsite_during" && (
                    <div>
                      <Label>วันที่กลับ (กรณีข้ามวัน)</Label>
                      <BEDatePicker value={form.return_date} onChange={(v) => setForm({ ...form, return_date: v })} />
                    </div>
                  )}

                  {form.request_type === "official_duty" && (
                    <div>
                      <Label>สถานที่ปฏิบัติราชการ *</Label>
                      <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น สพป.เขต 1" />
                    </div>
                  )}

                  <div>
                    <Label>เหตุผล *</Label>
                    <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="ระบุเหตุผล..." />
                  </div>

                  <div>
                    <Label>หมายเหตุเพิ่มเติม</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="-" />
                  </div>

                  <div>
                    <Label>ครูสอนแทน (ถ้ามี)</Label>
                    <Select value={form.acting_teacher || "none"} onValueChange={(v) => setForm({ ...form, acting_teacher: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="เลือกครูสอนแทน" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— ไม่ระบุ (ระบบจะให้ผู้บริหารจัดหาให้) —</SelectItem>
                        {(teachers as any[]).map((t) => (
                          <SelectItem key={t.id} value={`${t.first_name} ${t.last_name}`}>
                            {t.prefix || ""}{t.first_name} {t.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Photo capture */}
                  <div className="space-y-2 border-t pt-3">
                    <Label className="flex items-center gap-2"><Camera className="w-4 h-4" />ภาพถ่ายยืนยันตัวตน *</Label>
                    {!cameraOpen && !capturedPhoto && (
                      <Button type="button" variant="outline" className="w-full" onClick={startCamera}>
                        <Camera className="w-4 h-4 mr-2" />เปิดกล้องถ่ายภาพ
                      </Button>
                    )}
                    {cameraOpen && !capturedPhoto && (
                      <div className="space-y-2">
                        <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                          {!cameraReady && (
                            <div className="absolute inset-0 flex items-center justify-center text-white text-sm">กำลังเปิดกล้อง...</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" onClick={() => capturePhoto()} disabled={!cameraReady} className="flex-1">
                            <Camera className="w-4 h-4 mr-2" />ถ่ายภาพ
                          </Button>
                          <Button type="button" variant="outline" onClick={stopCamera}>ยกเลิก</Button>
                        </div>
                      </div>
                    )}
                    {capturedPhoto && (
                      <div className="space-y-2">
                        <img src={capturedPhoto} alt="preview" className="w-full aspect-square object-cover rounded-lg border" />
                        <Button type="button" variant="outline" className="w-full" onClick={startCamera}>
                          <RotateCcw className="w-4 h-4 mr-2" />ถ่ายใหม่
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                  <Button onClick={submit} disabled={saving}><Send className="w-4 h-4 mr-2" />ส่งคำขอ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                {isAdmin && <TableHead>ผู้ขอ</TableHead>}
                <TableHead>ประเภท</TableHead>
                <TableHead>เวลา/สถานที่</TableHead>
                <TableHead>เหตุผล</TableHead>
                <TableHead>ครูสอนแทน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests as any[]).length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">ยังไม่มีคำขอ</TableCell></TableRow>
              )}
              {(requests as any[]).map((r) => {
                const t = TYPE_LABEL[r.request_type as OffsiteType];
                const s = STATUS_LABEL[r.status] || { label: r.status, color: "" };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{r.request_date}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          {r.photo_url && (
                            <a href={r.photo_url} target="_blank" rel="noopener noreferrer">
                              <img src={r.photo_url} alt="ภาพยืนยัน" className="w-10 h-10 rounded object-cover border" />
                            </a>
                          )}
                          <div>
                            {r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}
                            <div className="text-xs text-muted-foreground font-mono">{r.personnel?.employee_code}</div>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell><Badge className={t?.color}>{t?.label}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {r.leave_time && <div>ออก: {r.leave_time}</div>}
                      {r.return_time && <div>กลับ: {r.return_date ? `${r.return_date} ` : ""}{r.return_time}</div>}
                      {r.location && <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" />{r.location}</div>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      <div>{r.reason}</div>
                      {r.notes && <div className="text-muted-foreground">📝 {r.notes}</div>}
                      {r.rejected_reason && <div className="text-danger">❌ {r.rejected_reason}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.acting_teacher || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isAdmin && r.status === "pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="default" onClick={() => approve(r)}><Check className="w-3.5 h-3.5 mr-1" />อนุมัติ</Button>
                          <Button size="sm" variant="destructive" onClick={() => { setRejectId(r.id); setRejectReason(""); }}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      )}
                      {(!isAdmin && r.status === "pending") || isAdmin ? (
                        <Button size="sm" variant="ghost" onClick={() => removeRow(r.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Reject dialog */}
        <Dialog open={!!rejectId} onOpenChange={(v) => !v && setRejectId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>ปฏิเสธคำขอ</DialogTitle></DialogHeader>
            <div>
              <Label>เหตุผลการปฏิเสธ</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectId(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={reject}>ปฏิเสธ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
