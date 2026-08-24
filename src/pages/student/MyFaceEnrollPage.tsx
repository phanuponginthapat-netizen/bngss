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
      const cols =
        "id, student_code, prefix, first_name, last_name, photo_url, classrooms!students_classroom_id_fkey(name, grade_level)";
      const { data } = await supabase
        .from("students")
        .select(cols)
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data) return data;
      // สำรอง: บัญชียังไม่ผูกโดยตรง — หาจากรหัสนักเรียนในโปรไฟล์
      const { data: prof } = await supabase
        .from("profiles")
        .select("student_code")
        .eq("id", user.id)
        .maybeSingle();
      const code = prof?.student_code?.trim();
      if (!code) return null;
      const { data: byCode } = await supabase
        .from("students")
        .select(cols)
        .eq("student_code", code)
        .maybeSingle();
      return byCode;
    },
  });

  const { data: mePersonnel, isLoading: loadingP } = useQuery({
    queryKey: ["my-personnel-face-record"],
    enabled: !isLoading && !me,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const cols = "id, employee_code, prefix, first_name, last_name, avatar_url";
      const { data } = await (supabase as any)
        .from("personnel")
        .select(cols)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) return data;
      const { data: prof } = await supabase
        .from("profiles")
        .select("employee_code")
        .eq("id", user.id)
        .maybeSingle();
      const code = prof?.employee_code?.trim();
      if (!code) return null;
      const { data: byCode } = await (supabase as any)
        .from("personnel")
        .select(cols)
        .eq("employee_code", code)
        .maybeSingle();
      return byCode;
    },
  });

  const { data: personnelSamples = [] } = useQuery({
    queryKey: ["my-personnel-face-samples", mePersonnel?.id],
    enabled: !!mePersonnel?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("personnel_face_descriptors")
        .select("id, created_at")
        .eq("personnel_id", mePersonnel!.id);
      return data || [];
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

  // สำรองสุดท้าย: ให้เซิร์ฟเวอร์หาข้อมูลให้ (ข้าม RLS อย่างปลอดภัย) + ผูกบัญชีอัตโนมัติ
  const { data: serverIdentity } = useQuery({
    queryKey: ["my-face-identity"],
    enabled: !isLoading && !loadingP && !me && !mePersonnel,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_my_face_identity");
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      // ผูกบัญชีให้เรียบร้อย ครั้งหน้าจะหาเจอทันที
      (supabase as any).rpc("link_my_identity").then(() => {
        qc.invalidateQueries({ queryKey: ["my-student-face-record"] });
        qc.invalidateQueries({ queryKey: ["my-personnel-face-record"] });
      });
      return {
        id: row.person_id,
        kind: row.kind as "student" | "personnel",
        student_code: row.kind === "student" ? row.code : null,
        employee_code: row.kind === "personnel" ? row.code : null,
        prefix: row.prefix,
        first_name: row.first_name,
        last_name: row.last_name,
        photo_url: row.photo_url,
        classrooms: row.classroom_name ? { name: row.classroom_name } : null,
      };
    },
  });

  const pending = null as any;
  const registered = (me ? samples.length : personnelSamples.length) > 0;
  const person: any = me || mePersonnel || serverIdentity;
  const fullName = person
    ? `${person.prefix || ""}${person.first_name || ""} ${person.last_name || ""}`.trim()
    : "";


  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-face-samples"] });
    qc.invalidateQueries({ queryKey: ["my-face-requests"] });
    qc.invalidateQueries({ queryKey: ["my-personnel-face-samples"] });
  };

  if (isLoading || loadingP) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!person) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <p className="font-semibold">ยังเชื่อมบัญชีกับข้อมูลนักเรียน/บุคลากรไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground">
            กดปุ่มด้านล่างเพื่อให้ระบบค้นหาและเชื่อมบัญชีให้อัตโนมัติ (จากรหัสนักเรียน อีเมล หรือชื่อ-นามสกุล)
            หากยังไม่สำเร็จ กรุณาแจ้งผู้ดูแลระบบ
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              const { data } = await (supabase as any).rpc("link_my_identity");
              qc.invalidateQueries();
              if (!data || data === "none") {
                alert("ระบบยังหาข้อมูลของบัญชีนี้ไม่พบ กรุณาแจ้งผู้ดูแลระบบให้เชื่อมรหัสนักเรียนกับบัญชีนี้");
              }
            }}
          >
            <ShieldCheck className="w-4 h-4" />เชื่อมบัญชีอัตโนมัติ
          </Button>
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
            {(person.photo_url || person.avatar_url) ? (
              <img
                src={person.photo_url || person.avatar_url}
                alt={`รูปของ ${fullName}`}
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
                รหัส {person.student_code || person.employee_code || "-"}
                {person.classrooms?.name ? ` · ${person.classrooms.name}` : ""}
              </p>
            </div>
            {registered ? (
              <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />ลงทะเบียนแล้ว {me ? samples.length : personnelSamples.length} ภาพ
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
            ผ่าน Liveness แล้วระบบอนุมัติและใช้งานได้ทันที ไม่ต้องรอเจ้าหน้าที่</div>
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
        studentCode={me?.student_code || (profileFallback as any)?.student_code || undefined}
        personnelId={!me ? mePersonnel?.id : undefined}
        selfPersonnel={!me && !(profileFallback as any)?.student_code}
        displayName={fullName}
        submitMode="request"
        reason={reason}
        onComplete={() => { setReason(""); refresh(); }}
      />

    </div>
  );
};

export default MyFaceEnrollPage;
