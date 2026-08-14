import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Printer, Loader2, Award, Search, Save } from "lucide-react";
import { formatDateLongBE } from "@/lib/dateBE";
import { getSchoolInfo } from "@/lib/schoolInfo";
import { CertificateRenderer, type CertTemplate } from "@/components/certificates/CertificateRenderer";
import BackButton from "@/components/BackButton";

const db = supabase as any;
const RENDER_W = 1400; // px ต่อ 1 ใบ (ความละเอียดสูงพอสำหรับ A4)

type Row = { key: string; name: string; className?: string; student_id?: string | null; award?: string; rank?: string };

export default function CertificatePrintPage() {
  const [templateId, setTemplateId] = useState<string>("");
  const [scope, setScope] = useState<"activity" | "class" | "manual">("activity");
  const [activityId, setActivityId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [manualText, setManualText] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [awardText, setAwardText] = useState("ได้เข้าร่วมกิจกรรม");
  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("ผู้อำนวยการโรงเรียน");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["certificate_templates"],
    queryFn: async () => (await db.from("certificate_templates").select("*").order("created_at", { ascending: false })).data || [],
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities_for_cert"],
    queryFn: async () => (await db.from("activities").select("id,title,category,start_at").order("start_at", { ascending: false }).limit(200)).data || [],
  });
  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => (await supabase.from("classrooms").select("id,name,grade_level").order("name")).data || [],
  });
  const { data: school } = useQuery({
    queryKey: ["school_info_general"],
    queryFn: async () => await getSchoolInfo("general"),
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["activity_participants_cert", activityId],
    enabled: scope === "activity" && !!activityId,
    queryFn: async () => {
      const { data } = await db
        .from("activity_participants")
        .select("id, team_name, student_id, students(id, prefix, first_name, last_name, classrooms(name))")
        .eq("activity_id", activityId);
      const ids = (data || []).map((p: any) => p.id);
      let scores: any[] = [];
      if (ids.length) {
        scores = (await db.from("activity_scores").select("participant_id, rank, score").in("participant_id", ids)).data || [];
      }
      return (data || []).map((p: any) => {
        const sc = scores.find((s) => s.participant_id === p.id);
        const s = p.students;
        return {
          key: p.id,
          student_id: p.student_id,
          name: s ? `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim() : (p.team_name || "-"),
          className: s?.classrooms?.name || "",
          rank: sc?.rank ? (sc.rank === 1 ? "ชนะเลิศ" : sc.rank === 2 ? "รองชนะเลิศ อันดับ 1" : sc.rank === 3 ? "รองชนะเลิศ อันดับ 2" : `อันดับที่ ${sc.rank}`) : "",
        } as Row;
      });
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["classroom_students_cert", classroomId],
    enabled: scope === "class" && !!classroomId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, classrooms(name)")
        .eq("classroom_id", classroomId)
        .order("first_name");
      return (data || []).map((s: any) => ({
        key: s.id,
        student_id: s.id,
        name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
        className: s.classrooms?.name || "",
      })) as Row[];
    },
  });

  const manualRows: Row[] = useMemo(
    () => manualText.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l, i) => ({ key: `m${i}`, name: l })),
    [manualText],
  );

  const sourceRows: Row[] = scope === "activity" ? (participants as Row[]) : scope === "class" ? (students as Row[]) : manualRows;
  const rows = useMemo(
    () => sourceRows.filter((r) => !search || r.name.includes(search) || (r.className || "").includes(search)),
    [sourceRows, search],
  );
  const selectedRows = useMemo(
    () => (scope === "manual" ? rows : rows.filter((r) => picked[r.key])),
    [rows, picked, scope],
  );

  const template: CertTemplate | null = useMemo(() => {
    const t = templates.find((x: any) => x.id === templateId);
    return t ? { ...t, fields: t.fields || [] } : null;
  }, [templates, templateId]);

  const activity = activities.find((a: any) => a.id === activityId);

  const dataFor = (r: Row, index: number) => ({
    name: r.name,
    class: r.className || "",
    award: r.rank ? `ได้รับรางวัล${r.rank}` : awardText,
    rank: r.rank || "",
    activity: activity?.title || "",
    date: formatDateLongBE(issueDate),
    cert_no: `${String(index + 1).padStart(4, "0")}/${new Date(issueDate).getFullYear() + 543}`,
    school: (school as any)?.school_name || (school as any)?.title || "",
    signer_name: signerName,
    signer_position: signerPosition,
  });

  const exportPdf = async () => {
    if (!template) return toast.error("เลือกเทมเพลตก่อน");
    if (selectedRows.length === 0) return toast.error("ยังไม่ได้เลือกผู้รับเกียรติบัตร");
    setBusy(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"), import("jspdf"),
      ]);
      await (document as any).fonts?.ready;
      const landscape = template.orientation !== "portrait";
      const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pw = landscape ? 297 : 210;
      const ph = landscape ? 210 : 297;
      const nodes = Array.from(stageRef.current?.querySelectorAll<HTMLElement>("[data-cert]") || []);
      for (let i = 0; i < nodes.length; i++) {
        const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pw, ph);
      }
      pdf.save(`certificates-${Date.now()}.pdf`);
      toast.success(`สร้างไฟล์ ${nodes.length} ใบแล้ว`);
    } catch (e: any) {
      toast.error(e?.message || "สร้าง PDF ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const saveIssues = async () => {
    if (!template?.id) return toast.error("บันทึกเทมเพลตก่อน");
    if (selectedRows.length === 0) return toast.error("ยังไม่ได้เลือกผู้รับ");
    const { data: u } = await supabase.auth.getUser();
    const payload = selectedRows.map((r, i) => {
      const d = dataFor(r, i);
      return {
        template_id: template.id,
        activity_id: activityId || null,
        student_id: r.student_id || null,
        recipient_name: r.name,
        award_text: d.award,
        rank_label: r.rank || null,
        cert_no: d.cert_no,
        issued_date: issueDate,
        data: d,
        created_by: u?.user?.id,
      };
    });
    const { error } = await db.from("certificate_issues").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`บันทึกประวัติการออกเกียรติบัตร ${payload.length} รายการ`);
  };

  return (
    <div className="space-y-4">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Printer className="w-6 h-6 text-primary" /> พิมพ์เกียรติบัตร
        </h1>
        <p className="text-sm text-muted-foreground">เลือกเทมเพลต เลือกผู้รับรายคนหรือทั้งรายการ แล้วสร้างไฟล์ PDF พิมพ์ได้ทันที</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">เทมเพลต</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="เลือกเทมเพลตเกียรติบัตร" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <RadioGroup value={scope} onValueChange={(v: any) => { setScope(v); setPicked({}); }} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="activity" id="s1" /><Label htmlFor="s1">ตามกิจกรรม</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="class" id="s2" /><Label htmlFor="s2">ตามห้องเรียน</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="manual" id="s3" /><Label htmlFor="s3">พิมพ์รายชื่อเอง</Label></div>
            </RadioGroup>

            {scope === "activity" && (
              <Select value={activityId} onValueChange={(v) => { setActivityId(v); setPicked({}); }}>
                <SelectTrigger><SelectValue placeholder="เลือกกิจกรรม/รายการแข่งขัน" /></SelectTrigger>
                <SelectContent>
                  {activities.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {scope === "class" && (
              <Select value={classroomId} onValueChange={(v) => { setClassroomId(v); setPicked({}); }}>
                <SelectTrigger><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
                <SelectContent>
                  {classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {scope === "manual" && (
              <Textarea rows={5} placeholder="พิมพ์ชื่อผู้รับ 1 คนต่อบรรทัด"
                value={manualText} onChange={(e) => setManualText(e.target.value)} />
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">ข้อความรางวัล (ค่าเริ่มต้น)</Label>
                <Input value={awardText} onChange={(e) => setAwardText(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">วันที่ออกให้</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">ชื่อผู้ลงนาม</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="(นาย... ...)" />
              </div>
              <div>
                <Label className="text-xs">ตำแหน่ง</Label>
                <Input value={signerPosition} onChange={(e) => setSignerPosition(e.target.value)} />
              </div>
            </div>

            {scope !== "manual" && (
              <>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input placeholder="ค้นหาชื่อ/ห้อง" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <Button size="sm" variant="outline"
                    onClick={() => setPicked(Object.fromEntries(rows.map((r) => [r.key, true])))}>เลือกทั้งหมด</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked({})}>ล้าง</Button>
                </div>
                <div className="max-h-64 overflow-auto border rounded-md divide-y">
                  {rows.map((r) => (
                    <label key={r.key} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-accent/40">
                      <Checkbox checked={!!picked[r.key]} onCheckedChange={(v) => setPicked((p) => ({ ...p, [r.key]: !!v }))} />
                      <span className="flex-1">{r.name}</span>
                      {r.className && <Badge variant="outline" className="text-[10px]">{r.className}</Badge>}
                      {r.rank && <Badge className="text-[10px]">{r.rank}</Badge>}
                    </label>
                  ))}
                  {rows.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">ไม่มีรายชื่อ</p>}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={exportPdf} disabled={busy || !template}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Printer className="w-4 h-4 mr-1" />}
                สร้าง PDF ({selectedRows.length} ใบ)
              </Button>
              <Button variant="outline" onClick={saveIssues} disabled={!template}>
                <Save className="w-4 h-4 mr-1" /> บันทึกประวัติการมอบ
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Label className="text-xs flex items-center gap-1 mb-2"><Award className="w-3.5 h-3.5" /> ตัวอย่าง</Label>
            {template && selectedRows[0] ? (
              <div className="overflow-auto">
                <CertificateRenderer template={template} data={dataFor(selectedRows[0], 0)} widthPx={520} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">เลือกเทมเพลตและผู้รับเพื่อดูตัวอย่าง</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* เวทีเรนเดอร์สำหรับส่งออก PDF (ซ่อนนอกจอ) */}
      <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
        <div ref={stageRef}>
          {template && selectedRows.map((r, i) => (
            <div data-cert key={r.key}>
              <CertificateRenderer template={template} data={dataFor(r, i)} widthPx={RENDER_W} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
