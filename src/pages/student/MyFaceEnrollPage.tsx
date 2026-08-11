import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScanFace, ShieldCheck, CheckCircle2, Clock, AlertTriangle, Sparkles, Lock, Camera,
} from "lucide-react";
import LivenessFaceRegisterDialog from "@/components/users/LivenessFaceRegisterDialog";

const MyFaceEnrollPage = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data: me, isLoading } = useQuery({
    queryKey: ["my-student-face-record"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, photo_url, classrooms!students_classroom_id_fkey(name, grade_level)")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: samples = [] } = useQuery({
    queryKey: ["my-face-samples", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_face_descriptors")
        .select("id, source, quality_score, created_at")
        .eq("student_id", me!.id);
      return data || [];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["my-face-requests", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("face_registration_requests")
        .select("id, status, request_type, created_at, review_notes")
        .eq("student_id", me!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const pending = requests.find((r: any) => r.status === "pending");
  const registered = samples.length > 0;
  const fullName = me
    ? `${me.prefix || ""}${me.first_name || ""} ${me.last_name || ""}`.trim()
    : "";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-face-samples"] });
    qc.invalidateQueries({ queryKey: ["my-face-requests"] });
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!me) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-2">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <p className="font-semibold">ไม่พบข้อมูลนักเรียนของบัญชีนี้</p>
          <p className="text-sm text-muted-foreground">
            กรุณาติดต่อครูที่ปรึกษาเพื่อเชื่อมบัญชีผู้ใช้กับข้อมูลนักเรียนก่อนลงทะเบียนใบหน้า
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <ScanFace className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">ลงทะเบียนใบหน้าของฉัน</h1>
          <p className="text-sm text-muted-foreground">
            ลงทะเบียนใบหน้าเพื่อใช้สแกนเข้าโรงเรียน — ตรวจสอบการมีชีวิตจริง (Liveness) ระดับแอปธนาคาร
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />สถานะของฉัน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {me.photo_url ? (
              <img
                src={me.photo_url}
                alt={`รูปนักเรียน ${fullName}`}
                className="w-14 h-14 rounded-xl object-cover border"
                onContextMenu={(e) => e.preventDefault()}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                <Camera className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-[180px]">
              <p className="font-semibold">{fullName}</p>
              <p className="text-xs text-muted-foreground">
                รหัส {me.student_code}
                {(me as any).classrooms?.name ? ` · ${(me as any).classrooms.name}` : ""}
              </p>
            </div>
            {registered ? (
              <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />ลงทะเบียนแล้ว {samples.length} ภาพ
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="w-3 h-3" />ยังไม่ได้ลงทะเบียน
              </Badge>
            )}
          </div>

          {pending && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">มีคำขอรออนุมัติอยู่</p>
                <p className="text-xs text-muted-foreground">
                  ส่งเมื่อ {new Date(pending.created_at).toLocaleString("th-TH")} — เจ้าหน้าที่จะตรวจสอบและอนุมัติให้
                </p>
              </div>
            </div>
          )}

          {registered && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                เหตุผลที่ต้องลงทะเบียนใหม่ (จำเป็น เช่น ตัดผม / ใส่แว่น / โตขึ้น)
              </label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล..." />
            </div>
          )}

          <Button
            className="gradient-primary gap-2 w-full sm:w-auto"
            disabled={!!pending || (registered && !reason.trim())}
            onClick={() => setOpen(true)}
          >
            <ScanFace className="w-4 h-4" />
            {registered ? "ลงทะเบียนใบหน้าใหม่" : "เริ่มลงทะเบียนใบหน้า"}
          </Button>
          {pending && (
            <p className="text-xs text-muted-foreground">
              ต้องรอผลคำขอเดิมก่อน จึงจะส่งคำขอใหม่ได้
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />ระบบป้องกันการจำผิดคน
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="flex gap-2"><Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            ตรวจการมีชีวิตจริง: อ้าปาก · หันซ้าย-ขวา · Color Challenge กันใช้รูปถ่าย/วิดีโอ</div>
          <div className="flex gap-2"><Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            ตรวจว่าทุกภาพเป็นคนเดียวกัน — ถ้าสลับคนกลางคัน ระบบจะปฏิเสธ</div>
          <div className="flex gap-2"><Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            เทียบกับใบหน้าทุกคนในระบบ ถ้าซ้ำกับผู้อื่นจะไม่ให้ลงทะเบียน</div>
          <div className="flex gap-2"><Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            คำขอทุกรายการต้องผ่านการอนุมัติจากเจ้าหน้าที่ก่อนใช้งานจริง</div>
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ประวัติคำขอล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                <div>
                  <p className="font-medium">
                    {r.request_type === "reregister" ? "ลงทะเบียนใหม่" : "ลงทะเบียนครั้งแรก"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("th-TH")}
                    {r.review_notes ? ` · ${r.review_notes}` : ""}
                  </p>
                </div>
                <Badge
                  variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                >
                  {r.status === "approved" ? "อนุมัติแล้ว" : r.status === "rejected" ? "ไม่อนุมัติ" : "รออนุมัติ"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <LivenessFaceRegisterDialog
        open={open}
        onOpenChange={setOpen}
        studentCode={me.student_code}
        displayName={fullName}
        submitMode="request"
        reason={reason}
        onComplete={() => { setReason(""); refresh(); }}
      />
    </div>
  );
};

export default MyFaceEnrollPage;
