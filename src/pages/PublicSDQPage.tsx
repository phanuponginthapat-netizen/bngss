import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle, XCircle, ClipboardList } from "lucide-react";

const PublicSDQPage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const rawType = (searchParams.get("type") || "parent").toLowerCase();
  const assessorType: "parent" | "student" | "teacher" =
    rawType === "student" ? "student" : rawType === "teacher" ? "teacher" : "parent";
  const assessorRoleLabel =
    assessorType === "student" ? "นักเรียน" : assessorType === "teacher" ? "ครู" : "ผู้ปกครอง";
  const [submitted, setSubmitted] = useState(false);
  const [emotional, setEmotional] = useState("0");
  const [conduct, setConduct] = useState("0");
  const [hyper, setHyper] = useState("0");
  const [peer, setPeer] = useState("0");
  const [prosocial, setProsocial] = useState("0");
  const [assessorName, setAssessorName] = useState("");
  const [saving, setSaving] = useState(false);

  // Check if SDQ system is enabled
  const { data: sdqEnabled, isLoading: loadingSettings } = useQuery({
    queryKey: ["sdq_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cms_settings")
        .select("value")
        .eq("key", "sdq_enabled")
        .maybeSingle();
      return data?.value === "true";
    },
  });

  // Get student info
  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ["public_student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, classrooms!students_classroom_id_fkey(name, grade_level)")
        .eq("id", studentId!)
        .maybeSingle();
      return data;
    },
  });

  const total = [emotional, conduct, hyper, peer].reduce((a, b) => a + parseInt(b || "0"), 0);

  const getLevel = (t: number) => {
    if (t <= 13) return { label: "ปกติ", icon: CheckCircle, color: "text-success", bg: "bg-success-soft border-success/30" };
    if (t <= 15) return { label: "เสี่ยง", icon: AlertTriangle, color: "text-warning", bg: "bg-warning-soft border-warning/30" };
    return { label: "ผิดปกติ", icon: XCircle, color: "text-danger", bg: "bg-danger-soft border-danger/30" };
  };

  const level = getLevel(total);
  const LevelIcon = level.icon;

  const handleSubmit = async () => {
    if (!studentId || !assessorName.trim()) {
      toast.error("กรุณาระบุชื่อผู้ประเมิน");
      return;
    }
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      const { error } = await supabase.from("sdq_records").insert({
        student_id: studentId,
        emotional_score: parseInt(emotional || "0"),
        conduct_score: parseInt(conduct || "0"),
        hyperactivity_score: parseInt(hyper || "0"),
        peer_score: parseInt(peer || "0"),
        prosocial_score: parseInt(prosocial || "0"),
        total_difficulty: total,
        assessment_by: assessorName,
        assessment_type: assessorType,
      } as any);
      if (error) throw error;
      setSubmitted(true);
      toast.success("บันทึกผลประเมินสำเร็จ");
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    } finally {
      toast.dismiss(__tid_save_1);
      setSaving(false);
    }
  };

  if (loadingSettings || loadingStudent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-info to-info">
        <div className="animate-pulse text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  if (!sdqEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-info to-info p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertTriangle className="w-16 h-16 text-warning mx-auto" />
            <h2 className="text-xl font-bold">ระบบประเมิน SDQ ปิดอยู่</h2>
            <p className="text-muted-foreground">ขณะนี้ยังไม่เปิดรับการประเมิน กรุณาติดต่อโรงเรียนเพื่อสอบถามเพิ่มเติม</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-info to-info p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-danger mx-auto" />
            <h2 className="text-xl font-bold">ไม่พบข้อมูลนักเรียน</h2>
            <p className="text-muted-foreground">กรุณาตรวจสอบลิงก์อีกครั้ง</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success to-success p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
            <h2 className="text-xl font-bold">บันทึกสำเร็จ!</h2>
            <p className="text-muted-foreground">ขอบคุณที่ร่วมประเมิน SDQ ให้กับ {student.prefix}{student.first_name} {student.last_name}</p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${level.bg}`}>
              <LevelIcon className={`w-5 h-5 ${level.color}`} />
              <span className="font-semibold">ผลรวม: {total} ({level.label})</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-info to-info p-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <ClipboardList className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">แบบประเมิน SDQ</h1>
          <p className="text-sm text-muted-foreground">Strengths and Difficulties Questionnaire</p>
          <p className="text-sm text-muted-foreground">สำหรับ{assessorRoleLabel}</p>
        </div>

        {/* Student Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ข้อมูลนักเรียน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ชื่อ-สกุล</span><span className="font-medium">{student.prefix}{student.first_name} {student.last_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">รหัสนักเรียน</span><span className="font-mono">{student.student_code}</span></div>
            {(student as any).classrooms && (
              <div className="flex justify-between"><span className="text-muted-foreground">ระดับชั้น</span><span>{(student as any).classrooms.name}</span></div>
            )}
          </CardContent>
        </Card>

        {/* Assessor */}
        <Card>
          <CardContent className="pt-4">
            <Label>ชื่อผู้ประเมิน ({assessorRoleLabel}) <span className="text-danger">*</span></Label>
            <Input className="mt-1" placeholder={`ระบุชื่อ-นามสกุล ${assessorRoleLabel}`} value={assessorName} onChange={(e) => setAssessorName(e.target.value)} />
          </CardContent>
        </Card>

        {/* SDQ Scores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">คะแนนประเมิน</CardTitle>
            <CardDescription>ให้คะแนน 0-10 ในแต่ละด้าน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "ด้านอารมณ์", desc: "กังวล ไม่มีความสุข ร้องไห้ง่าย", value: emotional, set: setEmotional },
              { label: "ด้านความประพฤติ", desc: "โกรธง่าย ไม่เชื่อฟัง ทะเลาะ", value: conduct, set: setConduct },
              { label: "ด้านสมาธิ/ไฮเปอร์", desc: "อยู่ไม่นิ่ง ไม่มีสมาธิ วอกแวก", value: hyper, set: setHyper },
              { label: "ด้านเพื่อน", desc: "ไม่มีเพื่อน ถูกแกล้ง เล่นคนเดียว", value: peer, set: setPeer },
              { label: "ด้านสังคม (จุดแข็ง)", desc: "ใจดี ช่วยเหลือ แบ่งปัน", value: prosocial, set: setProsocial },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <Label className="font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                <Input type="number" min="0" max="10" value={item.value} onChange={(e) => item.set(e.target.value)} />
              </div>
            ))}

            {/* Total Preview */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${level.bg}`}>
              <div className="flex items-center gap-2">
                <LevelIcon className={`w-5 h-5 ${level.color}`} />
                <span className="font-semibold">คะแนนรวม (ไม่รวมสังคม)</span>
              </div>
              <span className="text-xl font-bold">{total} <span className="text-sm font-normal">({level.label})</span></span>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} className="w-full h-12 text-base" disabled={saving}>
          {saving ? "กำลังบันทึก..." : "ส่งผลประเมิน"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">ข้อมูลจะถูกส่งไปยังครูประจำชั้นเพื่อดูแลนักเรียนต่อไป</p>
      </div>
    </div>
  );
};

export default PublicSDQPage;
