import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Printer, Save } from "lucide-react";
import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { BE_OFFSET } from "@/lib/dateBE";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { saveErrorMessage } from "@/lib/saveError";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  academicYear: number;
  semester: number;
}

type Data = {
  total_students: number;
  visited: number;
  visited_male: number;
  visited_female: number;
  not_visited: number;
  not_visited_reason: string;
  family_warm: number;
  family_broken: number;
  parents_deceased: number;
  parents_divorced: number;
  not_with_parents: number;
  learning_risk: number;
  health_issue: number;
  risky_behavior: number;
  rb_health: number;
  rb_drug: number;
  rb_violence: number;
  rb_travel: number;
  rb_sex: number;
  rb_gaming: number;
  economic_issue: number;
  other_issue: number;
  other_issue_desc: string;
  urgent_help: number;
  agencies: string;
  data_usage: string;
  parent_concerns: string;
  obstacles: string;
  reporter_name: string;
  reporter_position: string;
};

const emptyData = (): Data => ({
  total_students: 0, visited: 0, visited_male: 0, visited_female: 0,
  not_visited: 0, not_visited_reason: "",
  family_warm: 0, family_broken: 0,
  parents_deceased: 0, parents_divorced: 0, not_with_parents: 0,
  learning_risk: 0, health_issue: 0, risky_behavior: 0,
  rb_health: 0, rb_drug: 0, rb_violence: 0, rb_travel: 0, rb_sex: 0, rb_gaming: 0,
  economic_issue: 0, other_issue: 0, other_issue_desc: "",
  urgent_help: 0,
  agencies: "", data_usage: "", parent_concerns: "", obstacles: "",
  reporter_name: "", reporter_position: "",
});

const pct = (n: number, total: number) => {
  if (!total || total <= 0) return "0.00";
  return ((n / total) * 100).toFixed(2);
};

export const HomeVisitSummaryDialog = ({ open, onOpenChange, academicYear, semester }: Props) => {
  const qc = useQueryClient();
  const schoolInfo = useSchoolInfo();
  const [data, setData] = useState<Data>(emptyData());
  const [saving, setSaving] = useState(false);

  // Auto-compute stats
  const { data: computed } = useQuery({
    queryKey: ["home_visit_summary_computed", academicYear, semester],
    enabled: open,
    queryFn: async () => {
      const [studentsRes, visitsRes] = await Promise.all([
        supabase.from("students").select("id, gender, status").eq("status", "active"),
        supabase.from("home_visits").select("student_id, family_status, students(gender)"),
      ]);
      const students = studentsRes.data || [];
      const visits = visitsRes.data || [];
      const uniqueStudentIds = new Set(visits.map((v: any) => v.student_id));
      let male = 0, female = 0;
      let warm = 0, broken = 0;
      const seen = new Set<string>();
      for (const v of visits as any[]) {
        const sid = v.student_id;
        const g = v.students?.gender || "";
        if (!seen.has(sid)) {
          seen.add(sid);
          if (g === "male" || g === "ชาย" || g === "M") male++;
          else if (g === "female" || g === "หญิง" || g === "F") female++;
        }
        const fs = String(v.family_status || "").toLowerCase();
        if (fs.includes("อบอุ่น") || fs.includes("warm")) warm++;
        else if (fs.includes("แตกแยก") || fs.includes("หย่า") || fs.includes("broken")) broken++;
      }
      return {
        total_students: students.length,
        visited: uniqueStudentIds.size,
        visited_male: male,
        visited_female: female,
        not_visited: Math.max(0, students.length - uniqueStudentIds.size),
        family_warm: warm,
        family_broken: broken,
      };
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["home_visit_summary", academicYear, semester],
    enabled: open && academicYear > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("home_visit_summaries")
        .select("*")
        .eq("academic_year", academicYear)
        .eq("semester", semester)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    const merged = emptyData();
    if (computed) Object.assign(merged, computed);
    if (existing?.data) Object.assign(merged, existing.data);
    if (existing?.reporter_name) merged.reporter_name = existing.reporter_name;
    if (existing?.reporter_position) merged.reporter_position = existing.reporter_position;
    setData(merged);
  }, [open, computed, existing]);

  const update = (k: keyof Data, v: any) => setData((d) => ({ ...d, [k]: v }));
  const num = (k: keyof Data) => (
    <Input type="number" min="0" value={(data as any)[k]} onChange={(e) => update(k, parseInt(e.target.value) || 0)} className="w-24 inline-block" />
  );

  const handleSave = async () => {
    if (saving) return;
    if (!academicYear || academicYear <= 0) {
      toast.error("กรุณาเลือกปีการศึกษาก่อนบันทึก");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        academic_year: academicYear,
        semester,
        data: data as any,
        reporter_name: data.reporter_name || null,
        reporter_position: data.reporter_position || null,
      };
      const { error } = await supabase
        .from("home_visit_summaries")
        .upsert(payload, { onConflict: "school_id,academic_year,semester" });
      if (error) throw error;
      toast.success("บันทึกสรุปรายงานสำเร็จ");
      qc.invalidateQueries({ queryKey: ["home_visit_summary", academicYear, semester] });
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const d = data;
    const total = d.total_students;
    const logo = schoolInfo.school_logo || "";
    const affiliation = (schoolInfo as any).school_affiliation || "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน";
    const beYear = academicYear ? academicYear + BE_OFFSET : "";
    const chk = (v: boolean) => (v ? "☑" : "☐");
    const html = `
      <div style="font-family:'TH Sarabun New',Sarabun,sans-serif;font-size:18pt;line-height:1.5;color:#000;">
        <div style="text-align:center;margin-bottom:12px;">
          ${logo ? `<img src="${logo}" style="height:80px;object-fit:contain;" />` : ""}
          <div style="font-size:22pt;font-weight:700;margin-top:6px;">แบบสรุปรายงานการเยี่ยมบ้านนักเรียน</div>
          <div>โรงเรียน${schoolInfo.school_name || "................."} สังกัด ${affiliation}</div>
          <div>ภาคเรียนที่ ${semester || "..."} ปีการศึกษา ${beYear || "........"}</div>
        </div>

        <ol style="padding-left:22px;">
          <li>จำนวนนักเรียนทั้งหมด <b>${total}</b> คน</li>
          <li>จำนวนนักเรียนที่สถานศึกษาออกเยี่ยมบ้าน <b>${d.visited}</b> คน
            เป็นชาย <b>${d.visited_male}</b> คน / หญิง <b>${d.visited_female}</b> คน</li>
          <li>จำนวนนักเรียนที่ไม่ได้ออกเยี่ยมบ้าน <b>${d.not_visited}</b> คน
            คิดเป็นร้อยละ <b>${pct(d.not_visited, total)}</b>
            <div>สาเหตุที่ไม่ได้ออกเยี่ยมบ้าน</div>
            <div style="min-height:60px;border-bottom:1px dotted #333;white-space:pre-wrap;">${d.not_visited_reason || ""}</div>
          </li>
          <li>สภาพครอบครัวนักเรียนที่สถานศึกษาไปเยี่ยมบ้าน
            <div style="margin-left:20px;">
              <div>${chk(d.family_warm > 0)} อบอุ่น จำนวน <b>${d.family_warm}</b> คน คิดเป็นร้อยละ <b>${pct(d.family_warm, d.visited)}</b></div>
              <div>${chk(d.family_broken > 0)} แตกแยก จำนวน <b>${d.family_broken}</b> คน คิดเป็นร้อยละ <b>${pct(d.family_broken, d.visited)}</b></div>
            </div>
          </li>
          <li>นักเรียนที่บิดา มารดาเสียชีวิต จำนวน <b>${d.parents_deceased}</b> คน คิดเป็นร้อยละ <b>${pct(d.parents_deceased, total)}</b></li>
          <li>นักเรียนที่บิดา มารดาหย่าร้างกัน จำนวน <b>${d.parents_divorced}</b> คน คิดเป็นร้อยละ <b>${pct(d.parents_divorced, total)}</b></li>
          <li>นักเรียนที่ไม่ได้อาศัยอยู่กับบิดา มารดาของตนเอง จำนวน <b>${d.not_with_parents}</b> คน คิดเป็นร้อยละ <b>${pct(d.not_with_parents, total)}</b></li>
          <li>นักเรียนที่เสี่ยงหรือมีปัญหาด้านการเรียน จำนวน <b>${d.learning_risk}</b> คน คิดเป็นร้อยละ <b>${pct(d.learning_risk, total)}</b></li>
          <li>นักเรียนที่มีปัญหาด้านสุขภาพ จำนวน <b>${d.health_issue}</b> คน คิดเป็นร้อยละ <b>${pct(d.health_issue, total)}</b></li>
          <li>นักเรียนที่มีพฤติกรรมเสี่ยง จำนวน <b>${d.risky_behavior}</b> คน คิดเป็นร้อยละ <b>${pct(d.risky_behavior, total)}</b>
            <div style="margin-left:20px;">
              - สุขภาพ <b>${d.rb_health}</b> คน
              - การใช้สารเสพติด <b>${d.rb_drug}</b> คน
              - ความรุนแรง <b>${d.rb_violence}</b> คน<br/>
              - การเดินทางมาเรียน <b>${d.rb_travel}</b> คน
              - ด้านเพศ <b>${d.rb_sex}</b> คน
              - ติดเกม <b>${d.rb_gaming}</b> คน
            </div>
          </li>
          <li>นักเรียนที่มีปัญหาด้านเศรษฐกิจ จำนวน <b>${d.economic_issue}</b> คน คิดเป็นร้อยละ <b>${pct(d.economic_issue, total)}</b></li>
          <li>นักเรียนที่มีปัญหาอื่น ๆ จำนวน <b>${d.other_issue}</b> คน คิดเป็นร้อยละ <b>${pct(d.other_issue, total)}</b>
            <div>ระบุปัญหาที่พบ</div>
            <div style="min-height:40px;border-bottom:1px dotted #333;white-space:pre-wrap;">${d.other_issue_desc || ""}</div>
          </li>
          <li>นักเรียนที่ต้องการได้รับการช่วยเหลือเร่งด่วน จำนวน <b>${d.urgent_help}</b> คน คิดเป็นร้อยละ <b>${pct(d.urgent_help, total)}</b></li>
        </ol>

        <div style="margin-top:12px;">
          <div><b>หน่วยงาน/สหวิชาชีพ/องค์กร ที่ร่วมเยี่ยมบ้าน</b></div>
          <div style="min-height:60px;border-bottom:1px dotted #333;white-space:pre-wrap;">${d.agencies || ""}</div>
          <div style="margin-top:10px;"><b>โรงเรียนนำข้อมูลการเยี่ยมบ้านไปใช้ประโยชน์อย่างไร</b></div>
          <div style="min-height:60px;border-bottom:1px dotted #333;white-space:pre-wrap;">${d.data_usage || ""}</div>
          <div style="margin-top:10px;"><b>ข้อห่วงใยของผู้ปกครองที่มีต่อนักเรียน</b></div>
          <div style="min-height:60px;border-bottom:1px dotted #333;white-space:pre-wrap;">${d.parent_concerns || ""}</div>
          <div style="margin-top:10px;"><b>ปัญหา อุปสรรค ข้อเสนอแนะ</b></div>
          <div style="min-height:60px;border-bottom:1px dotted #333;white-space:pre-wrap;">${d.obstacles || ""}</div>
        </div>

        <div style="margin-top:36px;text-align:center;">
          <div>ลงชื่อ ......................................... ผู้รายงาน</div>
          <div style="margin-top:6px;">( ${d.reporter_name || "................................."} )</div>
          <div style="margin-top:6px;">ตำแหน่ง ${d.reporter_position || "................................."}</div>
        </div>

        <div style="margin-top:14px;text-align:right;font-size:14pt;">วันที่พิมพ์ ${currentThaiDate()}</div>
      </div>
    `;
    openPrintWindow(html, { title: "แบบสรุปรายงานการเยี่ยมบ้านนักเรียน" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>แบบสรุปรายงานการเยี่ยมบ้านนักเรียน · ภาคเรียน {semester}/{academicYear ? academicYear + BE_OFFSET : "-"}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1" />บันทึก</Button>
              <Button size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />พิมพ์/ส่งออก</Button>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ข้อมูลรวม (คำนวณอัตโนมัติ แก้ไขได้)</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">1. จำนวนนักเรียนทั้งหมด {num("total_students")} คน</div>
                <div className="flex flex-wrap items-center gap-2">2. จำนวนนักเรียนที่สถานศึกษาออกเยี่ยมบ้าน {num("visited")} คน เป็นชาย {num("visited_male")} คน / หญิง {num("visited_female")} คน</div>
                <div className="flex flex-wrap items-center gap-2">3. จำนวนนักเรียนที่ไม่ได้ออกเยี่ยมบ้าน {num("not_visited")} คน คิดเป็นร้อยละ {pct(data.not_visited, data.total_students)}</div>
                <div><Label className="text-xs">สาเหตุที่ไม่ได้ออกเยี่ยมบ้าน</Label>
                  <Textarea rows={2} value={data.not_visited_reason} onChange={(e) => update("not_visited_reason", e.target.value)} /></div>
                <div className="pt-2 font-medium">4. สภาพครอบครัวนักเรียนที่สถานศึกษาไปเยี่ยมบ้าน</div>
                <div className="flex flex-wrap items-center gap-2 pl-4">- อบอุ่น จำนวน {num("family_warm")} คน คิดเป็นร้อยละ {pct(data.family_warm, data.visited)}</div>
                <div className="flex flex-wrap items-center gap-2 pl-4">- แตกแยก จำนวน {num("family_broken")} คน คิดเป็นร้อยละ {pct(data.family_broken, data.visited)}</div>
                <div className="flex flex-wrap items-center gap-2">5. นักเรียนที่บิดา มารดาเสียชีวิต จำนวน {num("parents_deceased")} คน คิดเป็นร้อยละ {pct(data.parents_deceased, data.total_students)}</div>
                <div className="flex flex-wrap items-center gap-2">6. นักเรียนที่บิดา มารดาหย่าร้างกัน จำนวน {num("parents_divorced")} คน คิดเป็นร้อยละ {pct(data.parents_divorced, data.total_students)}</div>
                <div className="flex flex-wrap items-center gap-2">7. นักเรียนที่ไม่ได้อาศัยอยู่กับบิดา มารดาของตนเอง จำนวน {num("not_with_parents")} คน คิดเป็นร้อยละ {pct(data.not_with_parents, data.total_students)}</div>
                <div className="flex flex-wrap items-center gap-2">8. นักเรียนที่เสี่ยงหรือมีปัญหาด้านการเรียน จำนวน {num("learning_risk")} คน คิดเป็นร้อยละ {pct(data.learning_risk, data.total_students)}</div>
                <div className="flex flex-wrap items-center gap-2">9. นักเรียนที่มีปัญหาด้านสุขภาพ จำนวน {num("health_issue")} คน คิดเป็นร้อยละ {pct(data.health_issue, data.total_students)}</div>
                <div className="flex flex-wrap items-center gap-2">10. นักเรียนที่มีพฤติกรรมเสี่ยง จำนวน {num("risky_behavior")} คน คิดเป็นร้อยละ {pct(data.risky_behavior, data.total_students)}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4 text-xs">
                  <div>- สุขภาพ {num("rb_health")} คน</div>
                  <div>- การใช้สารเสพติด {num("rb_drug")} คน</div>
                  <div>- ความรุนแรง {num("rb_violence")} คน</div>
                  <div>- การเดินทางมาเรียน {num("rb_travel")} คน</div>
                  <div>- ด้านเพศ {num("rb_sex")} คน</div>
                  <div>- ติดเกม {num("rb_gaming")} คน</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">11. นักเรียนที่มีปัญหาด้านเศรษฐกิจ จำนวน {num("economic_issue")} คน คิดเป็นร้อยละ {pct(data.economic_issue, data.total_students)}</div>
                <div className="flex flex-wrap items-center gap-2">12. นักเรียนที่มีปัญหาอื่น ๆ จำนวน {num("other_issue")} คน คิดเป็นร้อยละ {pct(data.other_issue, data.total_students)}</div>
                <div><Label className="text-xs">ระบุปัญหาที่พบ</Label>
                  <Textarea rows={2} value={data.other_issue_desc} onChange={(e) => update("other_issue_desc", e.target.value)} /></div>
                <div className="flex flex-wrap items-center gap-2">13. นักเรียนที่ต้องการได้รับการช่วยเหลือเร่งด่วน จำนวน {num("urgent_help")} คน คิดเป็นร้อยละ {pct(data.urgent_help, data.total_students)}</div>
              </CardContent></Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ข้อมูลเชิงพรรณนา</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">14. หน่วยงาน/สหวิชาชีพ/องค์กร ที่ร่วมเยี่ยมบ้าน</Label>
                  <Textarea rows={2} value={data.agencies} onChange={(e) => update("agencies", e.target.value)} /></div>
                <div><Label className="text-xs">15. โรงเรียนนำข้อมูลการเยี่ยมบ้านไปใช้ประโยชน์อย่างไร</Label>
                  <Textarea rows={2} value={data.data_usage} onChange={(e) => update("data_usage", e.target.value)} /></div>
                <div><Label className="text-xs">16. ข้อห่วงใยของผู้ปกครองที่มีต่อนักเรียน</Label>
                  <Textarea rows={2} value={data.parent_concerns} onChange={(e) => update("parent_concerns", e.target.value)} /></div>
                <div><Label className="text-xs">17. ปัญหา อุปสรรค ข้อเสนอแนะ</Label>
                  <Textarea rows={2} value={data.obstacles} onChange={(e) => update("obstacles", e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">ผู้รายงาน</Label>
                    <Input value={data.reporter_name} onChange={(e) => update("reporter_name", e.target.value)} /></div>
                  <div><Label className="text-xs">ตำแหน่ง</Label>
                    <Input value={data.reporter_position} onChange={(e) => update("reporter_position", e.target.value)} /></div>
                </div>
              </CardContent></Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default HomeVisitSummaryDialog;
