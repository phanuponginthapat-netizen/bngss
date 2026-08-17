import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Clock, History, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { urlToFaceThumb } from "@/lib/faceThumb";
import { clearRegisteredFaceCache } from "@/lib/registeredFace";
import { saveErrorMessage } from "@/lib/saveError";

interface RequestRow {
  id: string;
  student_id: string;
  request_type: "initial" | "reregister";
  reason: string | null;
  photo_urls: string[];
  descriptors: number[][];
  status: string;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  students?: { prefix: string | null; first_name: string | null; last_name: string | null; student_code: string | null; photo_url: string | null };
}

interface HistoryRow {
  id: string;
  student_id: string;
  action: string;
  previous_count: number;
  new_count: number;
  reason: string | null;
  notes: string | null;
  performed_at: string;
  photo_urls: string[];
  students?: { prefix: string | null; first_name: string | null; last_name: string | null; student_code: string | null };
}

const signedUrlCache = new Map<string, string>();
const getSignedUrl = async (path: string): Promise<string> => {
  if (!path) return "";
  if (signedUrlCache.has(path)) return signedUrlCache.get(path)!;
  const { data } = await supabase.storage.from("face-photos").createSignedUrl(path, 3600);
  const url = data?.signedUrl || "";
  if (url) signedUrlCache.set(path, url);
  return url;
};

const PhotoStrip = ({ paths }: { paths: string[] }) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => { Promise.all(paths.map(getSignedUrl)).then(setUrls); }, [paths]);
  if (paths.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {paths.map((p, i) => (
        <img key={i} src={urls[i] || ""} alt="" className="w-20 h-20 object-cover rounded border flex-shrink-0 bg-muted" />
      ))}
    </div>
  );
};

const FaceApprovalTab = () => {
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canManage = isAdmin || isDirector;
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["face-pending-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_registration_requests")
        .select("*, students(prefix, first_name, last_name, student_code, photo_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RequestRow[];
    },
  });

  const { data: reviewed = [] } = useQuery({
    queryKey: ["face-reviewed-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_registration_requests")
        .select("*, students(prefix, first_name, last_name, student_code, photo_url)")
        .in("status", ["approved", "rejected", "cancelled"])
        .order("reviewed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as RequestRow[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["face-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_registration_history")
        .select("*, students(prefix, first_name, last_name, student_code)")
        .order("performed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as HistoryRow[];
    },
  });

  const approve = async (req: RequestRow) => {
    if (!canManage) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // กันจำผิดคน: ตรวจว่าใบหน้าในคำขอไม่ซ้ำกับนักเรียนคนอื่นที่ลงทะเบียนไว้แล้ว
      const { data: dup, error: dupErr } = await supabase.rpc("check_face_duplicate", {
        _student_id: req.student_id,
        _descriptors: req.descriptors as any,
        _threshold: 0.42,
      });
      if (dupErr) throw dupErr;
      const hit = Array.isArray(dup) ? (dup as any[])[0] : null;
      if (hit) {
        toast.error(
          `อนุมัติไม่ได้ — ใบหน้าซ้ำกับ ${hit.match_name ?? ""} (${hit.match_code ?? "-"}) ระยะห่าง ${Number(hit.min_distance).toFixed(3)}`,
        );
        setBusy(false);
        return;
      }

      const { data: prev } = await supabase.from("student_face_descriptors")
        .select("id").eq("student_id", req.student_id);
      const previous_count = prev?.length ?? 0;


      // Reregister → replace all; Initial → append
      if (req.request_type === "reregister") {
        await supabase.from("student_face_descriptors").delete().eq("student_id", req.student_id);
      }
      const startIdx = req.request_type === "reregister" ? 0 : previous_count;

      // เก็บภาพใบหน้าที่อนุมัติไว้กับ descriptor เพื่อใช้แสดงเทียบตอนสแกนที่คีออส
      const thumbs = await Promise.all(
        req.descriptors.map(async (_d, i) => {
          const path = req.photo_urls?.[i];
          if (!path) return null;
          const url = await getSignedUrl(path);
          if (!url) return null;
          return (await urlToFaceThumb(url)) || null;
        }),
      );

      const rows = req.descriptors.map((d, i) => ({
        student_id: req.student_id,
        sample_index: startIdx + i,
        descriptor: d,
        captured_by: req.requested_by,
        source: "request_approved",
        face_image: thumbs[i],
      }));
      const { error: insErr } = await supabase.from("student_face_descriptors").insert(rows);
      if (insErr) throw insErr;
      clearRegisteredFaceCache(req.student_id);


      const { error: updErr } = await supabase.from("face_registration_requests").update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", req.id);
      if (updErr) throw updErr;

      await supabase.from("face_registration_history").insert({
        student_id: req.student_id,
        request_id: req.id,
        action: req.request_type === "reregister" ? "reregistered" : "registered",
        previous_count,
        new_count: rows.length + (req.request_type === "reregister" ? 0 : previous_count),
        photo_urls: req.photo_urls,
        reason: req.reason,
        notes: `อนุมัติคำขอ ${req.request_type === "reregister" ? "ลงทะเบียนใหม่" : "ลงทะเบียนครั้งแรก"}`,
        performed_by: user?.id,
      });

      toast.success("อนุมัติคำขอเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["face-pending-requests"] });
      qc.invalidateQueries({ queryKey: ["face-reviewed-requests"] });
      qc.invalidateQueries({ queryKey: ["face-history"] });
      qc.invalidateQueries({ queryKey: ["face-known"] });
      qc.invalidateQueries({ queryKey: ["face-db"] });
      qc.invalidateQueries({ queryKey: ["face-registered-ids"] });
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setBusy(false); }
  };

  const reject = async (req: RequestRow) => {
    if (!canManage) return;
    if (!rejectReason.trim()) { toast.error("กรุณาระบุเหตุผล"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("face_registration_requests").update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: rejectReason.trim(),
      }).eq("id", req.id);
      if (error) throw error;

      await supabase.from("face_registration_history").insert({
        student_id: req.student_id,
        request_id: req.id,
        action: "rejected",
        previous_count: 0,
        new_count: 0,
        reason: req.reason,
        notes: `ปฏิเสธ: ${rejectReason.trim()}`,
        performed_by: user?.id,
      });

      toast.success("ปฏิเสธคำขอแล้ว");
      setRejectingId(null); setRejectReason("");
      qc.invalidateQueries({ queryKey: ["face-pending-requests"] });
      qc.invalidateQueries({ queryKey: ["face-reviewed-requests"] });
      qc.invalidateQueries({ queryKey: ["face-history"] });
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setBusy(false); }
  };

  const studentLabel = (s?: RequestRow["students"]) =>
    s ? `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""} (${s.student_code ?? "-"})`.trim() : "-";

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">เฉพาะแอดมิน/ผู้อำนวยการ</p>
          <p className="text-sm text-muted-foreground">เมนูนี้สำหรับอนุมัติคำขอลงทะเบียนใบหน้าเท่านั้น</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" /> รออนุมัติ
            {pending.length > 0 && <Badge variant="destructive" className="ml-1">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-2"><CheckCircle2 className="w-4 h-4" /> ที่ตรวจแล้ว</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> ประวัติ</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {loadingPending && <Loader2 className="w-5 h-5 animate-spin" />}
          {!loadingPending && pending.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">ไม่มีคำขอที่รออนุมัติ</CardContent></Card>
          )}
          {pending.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{studentLabel(req.students)}</span>
                      <Badge variant={req.request_type === "reregister" ? "default" : "secondary"}>
                        {req.request_type === "reregister" ? "ลงทะเบียนใหม่" : "ลงทะเบียนครั้งแรก"}
                      </Badge>
                      <Badge variant="outline">{req.descriptors.length} ภาพ</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ส่งเมื่อ {new Date(req.created_at).toLocaleString("th-TH")}
                    </p>
                    {req.reason && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded">
                        <span className="font-medium">เหตุผล: </span>{req.reason}
                      </p>
                    )}
                  </div>
                </div>

                <PhotoStrip paths={req.photo_urls} />

                {rejectingId === req.id ? (
                  <div className="space-y-2 border-t pt-3">
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="เหตุผลที่ปฏิเสธ..."
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => reject(req)} disabled={busy} variant="destructive" size="sm">
                        ยืนยันปฏิเสธ
                      </Button>
                      <Button onClick={() => { setRejectingId(null); setRejectReason(""); }} variant="outline" size="sm">
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => approve(req)} disabled={busy} className="gradient-primary" size="sm">
                      <CheckCircle2 className="w-4 h-4 mr-2" />อนุมัติ
                    </Button>
                    <Button onClick={() => setRejectingId(req.id)} disabled={busy} variant="outline" size="sm">
                      <XCircle className="w-4 h-4 mr-2" />ปฏิเสธ
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reviewed" className="mt-4 space-y-2">
          {reviewed.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">ยังไม่มีรายการที่ตรวจ</CardContent></Card>
          )}
          {reviewed.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-3 flex items-start justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{studentLabel(req.students)}</span>
                    <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                      {req.status === "approved" ? "อนุมัติ" : req.status === "rejected" ? "ปฏิเสธ" : "ยกเลิก"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {req.reviewed_at && `ตรวจ ${new Date(req.reviewed_at).toLocaleString("th-TH")} • `}
                    {req.descriptors.length} ภาพ
                  </p>
                  {req.review_notes && <p className="text-xs mt-1">หมายเหตุ: {req.review_notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-2">
          {history.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">ยังไม่มีประวัติ</CardContent></Card>
          )}
          {history.map((h) => (
            <Card key={h.id}>
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium">{studentLabel(h.students as any)}</span>
                  <Badge variant="outline">{h.action}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(h.performed_at).toLocaleString("th-TH")} • ก่อน {h.previous_count} → หลัง {h.new_count} ภาพ
                </p>
                {h.reason && <p className="text-xs"><span className="font-medium">เหตุผล:</span> {h.reason}</p>}
                {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FaceApprovalTab;
