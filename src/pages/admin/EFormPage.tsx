import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { openPrintWindow } from "@/lib/printUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import FormTemplateButton from "@/components/academic/FormTemplateButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileText, Users, DollarSign, GraduationCap, ArrowLeft, Building2, Send } from "lucide-react";
import { SendEFormDialog } from "@/components/eform/SendEFormDialog";
import DOMPurify from "dompurify";

// ============ Form Template Definitions ============

interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "number" | "student-select" | "personnel-select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  half?: boolean;
}

interface FormTemplate {
  id: string;
  title: string;
  description: string;
  category: "official" | "personnel" | "student" | "budget";
  fields: FormField[];
  render: (data: Record<string, string>, schoolName: string) => string;
}

const today = new Date();
const thaiDate = (d: Date) => {
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
};

// ===== OBEC A4 Document Styles (ตามระเบียบสำนักนายกฯ) =====
// ตราครุฑ: หนังสือภายนอก 3 ซม., หนังสือภายใน/บันทึกข้อความ 1.5 ซม.
// บรรทัด: line-height 1.4 (ตามมาตรฐาน), ย่อหน้า indent 2.5 ซม.
const S = {
  lh: 'line-height:1.5;font-size:16pt;',
  indent: 'text-indent:2.5cm;line-height:1.5;font-size:16pt;text-align:justify;',
  sig: 'text-align:center;margin-top:36pt;font-size:16pt;line-height:1.6;page-break-inside:avoid;',
  garudaLarge: `<img src="__GARUDA_URL__" crossorigin="anonymous" style="width:3cm;height:3cm;object-fit:contain;display:block;margin:0 auto;" onerror="this.onerror=null;this.src='__LOVABLE_ORIGIN__/images/garuda.png'" />`,
  garudaSmall: `<img src="__GARUDA_URL__" crossorigin="anonymous" style="width:1.5cm;height:1.5cm;object-fit:contain;display:block;margin:0 auto 4pt;" onerror="this.onerror=null;this.src='__LOVABLE_ORIGIN__/images/garuda.png'" />`,
};
const replaceOrigin = (html: string, garudaUrl?: string) =>
  html
    .replace(/__LOVABLE_ORIGIN__/g, window.location.origin)
    .replace(/__GARUDA_URL__/g, garudaUrl && garudaUrl.trim() ? garudaUrl : `${window.location.origin}/images/garuda.png`);
const docWrap = (content: string) => `<div class="obec-a4-page">${content}</div>`;

// ชั้นความเร็ว stamp
const urgencyStamp = (level: string) => {
  if (!level || level === "none") return "";
  const labels: Record<string, string> = {
    urgent: "ด่วน",
    very_urgent: "ด่วนมาก",
    most_urgent: "ด่วนที่สุด",
  };
  return `<div style="text-align:left;color:red;font-size:20pt;font-weight:bold;margin-bottom:4pt;"><span style="border:2pt solid red;padding:2pt 8pt;display:inline-block;">${labels[level] || ""}</span></div>`;
};

const urgencyField: FormField = {
  key: "urgency",
  label: "ชั้นความเร็ว",
  type: "select",
  options: [
    { value: "none", label: "ปกติ (ไม่ระบุ)" },
    { value: "urgent", label: "ด่วน" },
    { value: "very_urgent", label: "ด่วนมาก" },
    { value: "most_urgent", label: "ด่วนที่สุด" },
  ],
  half: true,
};

const formTemplates: FormTemplate[] = [
  // ===== 1. หนังสือภายนอก (กระดาษตราครุฑ 3 ซม.) =====
  {
    id: "external_letter",
    title: "หนังสือภายนอก",
    description: "กระดาษตราครุฑ ใช้ติดต่อราชการอย่างเป็นทางการ เช่น ถึง สพท., หน่วยงานภายนอก",
    category: "official",
    fields: [
      urgencyField,
      { key: "doc_number", label: "ที่", type: "text", placeholder: "ศธ 04001/...", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "school_address_line", label: "ส่วนราชการ (ที่อยู่ 3 บรรทัด)", type: "textarea", placeholder: "โรงเรียน...\nเลขที่... หมู่... ถนน...\nต.... อ.... จ.... รหัสไปรษณีย์", half: true },
      { key: "to", label: "เรียน", type: "text", required: true },
      { key: "subject", label: "เรื่อง", type: "text", required: true },
      { key: "reference", label: "อ้างถึง", type: "text" },
      { key: "attachment", label: "สิ่งที่ส่งมาด้วย", type: "textarea", placeholder: "ระบุรายการ (ถ้ามี)" },
      { key: "body", label: "ข้อความ", type: "textarea", required: true },
      { key: "closing", label: "คำลงท้าย", type: "text", placeholder: "จึงเรียนมาเพื่อโปรดทราบ" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
        ${urgencyStamp(d.urgency)}
      </div>
      <div style="${S.lh}display:flex;justify-content:space-between;align-items:flex-start;gap:24pt;">
        <div><b>ที่</b>&nbsp;&nbsp;${d.doc_number || "......./......"}</div>
        <div style="text-align:right;white-space:pre-line;">${d.school_address_line || school}</div>
      </div>
      <div style="${S.lh}text-align:center;margin-top:6pt;">
        ${d.doc_date ? thaiDate(new Date(d.doc_date)) : ".......... เดือน .................... พ.ศ. .........."}
      </div>
      <div style="${S.lh}margin-top:12pt;">
        <div><b>เรื่อง</b>&nbsp;&nbsp;${d.subject || ""}</div>
        <div style="margin-top:4pt;"><b>เรียน</b>&nbsp;&nbsp;${d.to || ""}</div>
        ${d.reference ? `<div style="margin-top:4pt;"><b>อ้างถึง</b>&nbsp;&nbsp;${d.reference}</div>` : ""}
        ${d.attachment ? `<div style="margin-top:4pt;"><b>สิ่งที่ส่งมาด้วย</b>&nbsp;&nbsp;${d.attachment.split('\n').map((a: string, i: number) => `${i > 0 ? '<br/><span style="display:inline-block;width:108pt;"></span>' : ''}${d.attachment.split('\n').length > 1 ? `${(i + 1)}. ` : ''}${a}`).join('')}</div>` : ""}
      </div>
      <div style="${S.indent}white-space:pre-wrap;margin-top:12pt;">${d.body || ""}</div>
      <p style="${S.indent}margin-top:6pt;">${d.closing || "จึงเรียนมาเพื่อโปรดทราบ"}</p>
      <div style="${S.lh}text-align:center;margin-top:24pt;margin-left:50%;">ขอแสดงความนับถือ</div>
      <div style="${S.sig}margin-left:50%;">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "............................................................"}</div>
      </div>
    `)),
  },
  // ===== 2. หนังสือภายใน / บันทึกข้อความ (ตราครุฑ 1.5 ซม.) =====
  {
    id: "memo",
    title: "บันทึกข้อความ",
    description: "หนังสือภายใน ใช้ติดต่อภายในกระทรวง ทบวง กรม หรือภายในโรงเรียน",
    category: "official",
    fields: [
      urgencyField,
      { key: "department", label: "ส่วนราชการ", type: "text", placeholder: "โรงเรียน...", required: true, half: true },
      { key: "doc_number", label: "ที่", type: "text", placeholder: "ศธ 04001/...", half: true },
      { key: "doc_date", label: "วันที่", type: "date", required: true, half: true },
      { key: "subject", label: "เรื่อง", type: "text", required: true },
      { key: "to", label: "เรียน", type: "text", placeholder: "ผู้อำนวยการโรงเรียน...", required: true },
      { key: "attachment", label: "สิ่งที่แนบมาด้วย", type: "textarea", placeholder: "ระบุรายการ (ถ้ามี)" },
      { key: "body", label: "ข้อความ", type: "textarea", required: true },
      { key: "closing", label: "คำลงท้าย", type: "text", placeholder: "จึงเรียนมาเพื่อโปรดพิจารณา" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="margin-bottom:6pt;">
        ${S.garudaSmall}
        ${urgencyStamp(d.urgency)}
        <div style="text-align:center;font-size:22pt;font-weight:bold;padding-top:6pt;">บันทึกข้อความ</div>
      </div>
      <div style="${S.lh}margin-top:4pt;">
        <div><b>ส่วนราชการ</b>&nbsp;&nbsp;&nbsp;${d.department || school}</div>
        <div style="display:flex;justify-content:space-between;">
          <span><b>ที่</b>&nbsp;&nbsp;${d.doc_number || "......./......"}</span>
          <span><b>วันที่</b>&nbsp;&nbsp;${d.doc_date ? thaiDate(new Date(d.doc_date)) : "............................................."}</span>
        </div>
        <div><b>เรื่อง</b>&nbsp;&nbsp;${d.subject || "............................................................................................................"}</div>
      </div>
      <div style="border-top:1.5pt solid #000;margin:2pt 0 6pt;"></div>
      <div style="${S.lh}">
        <div><b>เรียน</b>&nbsp;&nbsp;${d.to || "............................................................................................................"}</div>
        ${d.attachment ? `<div><b>สิ่งที่แนบมาด้วย</b>&nbsp;&nbsp;${d.attachment.split('\n').map((a: string, i: number) => `${i > 0 ? '<br/><span style="display:inline-block;width:100pt;"></span>' : ''}${d.attachment.split('\n').length > 1 ? `${(i + 1)}. ` : ''}${a}`).join('')}</div>` : ""}
      </div>
      <div style="${S.indent}white-space:pre-wrap;margin-top:8pt;">${d.body || ""}</div>
      ${d.closing ? `<p style="${S.indent}margin-top:6pt;">${d.closing}</p>` : ""}
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "............................................................"}</div>
      </div>
    `)),
  },
  // ===== 3. คำสั่ง (หนังสือสั่งการ - ตราครุฑ 3 ซม.) =====
  {
    id: "order",
    title: "คำสั่ง",
    description: "หนังสือสั่งการ เช่น คำสั่งแต่งตั้งครูเวร, มอบหมายงาน, คำสั่งเวรยาม",
    category: "official",
    fields: [
      { key: "order_number", label: "คำสั่งที่", type: "text", placeholder: "เช่น 001/2567", half: true },
      { key: "doc_date", label: "สั่ง ณ วันที่", type: "date", half: true },
      { key: "subject", label: "เรื่อง", type: "text", required: true },
      { key: "preamble", label: "อาศัยอำนาจ / ด้วย (คำนำ)", type: "textarea", placeholder: "ตามที่... / ด้วย... / อาศัยอำนาจตามความในมาตรา..." },
      { key: "body", label: "รายละเอียดคำสั่ง", type: "textarea", required: true },
      { key: "effective_date", label: "ให้มีผลตั้งแต่วันที่", type: "date" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
      </div>
      <div style="text-align:center;font-size:20pt;font-weight:bold;">คำสั่ง${school}</div>
      <div style="text-align:center;${S.lh}">ที่ ${d.order_number || "......./......"}</div>
      <div style="text-align:center;${S.lh}margin-bottom:4pt;"><b>เรื่อง</b> ${d.subject || ""}</div>
      <div style="border-top:1.5pt solid #000;margin:2pt 0 6pt;"></div>
      ${d.preamble ? `<div style="${S.indent}white-space:pre-wrap;">${d.preamble}</div>` : ""}
      <div style="${S.indent}white-space:pre-wrap;margin-top:8pt;">${d.body || ""}</div>
      ${d.effective_date ? `<p style="${S.indent}margin-top:6pt;">ทั้งนี้ ตั้งแต่วันที่ ${thaiDate(new Date(d.effective_date))} เป็นต้นไป</p>` : ""}
      <p style="${S.indent}margin-top:6pt;">สั่ง ณ วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : ".......... เดือน .................... พ.ศ. .........."}</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "............................................................"}</div>
      </div>
    `)),
  },
  // ===== 4. ประกาศ (หนังสือประชาสัมพันธ์ - ตราครุฑ 3 ซม.) =====
  {
    id: "announcement",
    title: "ประกาศ",
    description: "หนังสือประชาสัมพันธ์ เช่น ประกาศรับสมัครนักเรียน, ประกาศผลสอบ",
    category: "official",
    fields: [
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "subject", label: "เรื่อง", type: "text", required: true },
      { key: "preamble", label: "ด้วย / ตามที่ (คำนำ)", type: "textarea", placeholder: "ด้วยโรงเรียน... / ตามที่..." },
      { key: "body", label: "รายละเอียดประกาศ", type: "textarea", required: true },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
      </div>
      <div style="text-align:center;font-size:20pt;font-weight:bold;">ประกาศ${school}</div>
      <div style="text-align:center;${S.lh}margin-bottom:4pt;"><b>เรื่อง</b> ${d.subject || ""}</div>
      <div style="border-top:1.5pt solid #000;margin:2pt 0 6pt;"></div>
      ${d.preamble ? `<div style="${S.indent}white-space:pre-wrap;">${d.preamble}</div>` : ""}
      <div style="${S.indent}white-space:pre-wrap;margin-top:8pt;">${d.body || ""}</div>
      <p style="${S.indent}margin-top:6pt;">ประกาศ ณ วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : ".......... เดือน .................... พ.ศ. .........."}</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "............................................................"}</div>
      </div>
    `)),
  },
  // ===== 5. รายงานการประชุม =====
  {
    id: "meeting_minutes",
    title: "รายงานการประชุม",
    description: "บันทึกรายงานการประชุมตามระเบียบสำนักนายกรัฐมนตรี",
    category: "official",
    fields: [
      { key: "meeting_name", label: "ชื่อการประชุม", type: "text", required: true, placeholder: "เช่น ประชุมคณะครูและบุคลากร ครั้งที่ 1/2567" },
      { key: "meeting_date", label: "วันที่ประชุม", type: "date", required: true, half: true },
      { key: "meeting_time", label: "เวลา", type: "text", placeholder: "09.00 - 12.00 น.", half: true },
      { key: "meeting_place", label: "สถานที่ประชุม", type: "text", placeholder: "ห้องประชุม..." },
      { key: "chairman", label: "ประธานการประชุม", type: "text", required: true },
      { key: "attendees", label: "ผู้เข้าร่วมประชุม", type: "textarea", placeholder: "ระบุรายชื่อ (แต่ละคนขึ้นบรรทัดใหม่)" },
      { key: "absentees", label: "ผู้ไม่เข้าร่วมประชุม", type: "textarea", placeholder: "ระบุรายชื่อ (ถ้ามี)" },
      { key: "recorder", label: "ผู้จดรายงาน", type: "text" },
      { key: "agenda_1", label: "ระเบียบวาระที่ 1 (เรื่องที่ประธานแจ้ง)", type: "textarea" },
      { key: "agenda_2", label: "ระเบียบวาระที่ 2 (เรื่องรับรองรายงาน)", type: "textarea" },
      { key: "agenda_3", label: "ระเบียบวาระที่ 3 (เรื่องสืบเนื่อง)", type: "textarea" },
      { key: "agenda_4", label: "ระเบียบวาระที่ 4 (เรื่องเสนอเพื่อทราบ)", type: "textarea" },
      { key: "agenda_5", label: "ระเบียบวาระที่ 5 (เรื่องเสนอเพื่อพิจารณา)", type: "textarea" },
      { key: "agenda_other", label: "ระเบียบวาระที่ 6 (เรื่องอื่น ๆ)", type: "textarea" },
      { key: "close_time", label: "เลิกประชุมเวลา", type: "text", placeholder: "12.00 น.", half: true },
    ],
    render: (d, school) => {
      const attendees = (d.attendees || "").split("\n").filter(Boolean);
      const absentees = (d.absentees || "").split("\n").filter(Boolean);
      const agendas = [
        { num: 1, title: "เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ", content: d.agenda_1 },
        { num: 2, title: "เรื่องรับรองรายงานการประชุม", content: d.agenda_2 },
        { num: 3, title: "เรื่องสืบเนื่อง", content: d.agenda_3 },
        { num: 4, title: "เรื่องเสนอเพื่อทราบ", content: d.agenda_4 },
        { num: 5, title: "เรื่องเสนอเพื่อพิจารณา", content: d.agenda_5 },
        { num: 6, title: "เรื่องอื่น ๆ", content: d.agenda_other },
      ];
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:20pt;font-weight:bold;margin-bottom:4pt;">รายงานการประชุม</div>
        <div style="text-align:center;font-size:18pt;font-weight:bold;">${d.meeting_name || ""}</div>
        <div style="text-align:center;${S.lh}">วันที่ ${d.meeting_date ? thaiDate(new Date(d.meeting_date)) : ".............................."} ${d.meeting_time ? `เวลา ${d.meeting_time}` : ""}</div>
        <div style="text-align:center;${S.lh}margin-bottom:8pt;">ณ ${d.meeting_place || "............................................"}</div>
        <div style="border-top:1pt solid #000;margin:2pt 0 6pt;"></div>
        <div style="${S.lh}"><b>ผู้มาประชุม</b></div>
        ${attendees.length > 0
          ? `<div style="${S.lh}padding-left:20pt;">${attendees.map((a, i) => `${i + 1}. ${a}`).join("<br/>")}</div>`
          : `<div style="${S.lh}padding-left:20pt;">จำนวน ........... คน</div>`
        }
        ${absentees.length > 0 ? `
          <div style="${S.lh}margin-top:4pt;"><b>ผู้ไม่มาประชุม</b></div>
          <div style="${S.lh}padding-left:20pt;">${absentees.map((a, i) => `${i + 1}. ${a}`).join("<br/>")}</div>
        ` : ""}
        <div style="${S.lh}margin-top:4pt;"><b>เริ่มประชุม</b> ${d.meeting_time ? `เวลา ${d.meeting_time.split("-")[0]?.trim() || d.meeting_time}` : "เวลา ........... น."}</div>
        ${agendas.filter(a => a.content).map(a => `
          <div style="${S.lh}margin-top:10pt;"><b>ระเบียบวาระที่ ${a.num}</b>&nbsp;&nbsp;${a.title}</div>
          <div style="${S.indent}white-space:pre-wrap;">${a.content}</div>
        `).join("")}
        ${d.close_time ? `<div style="${S.lh}margin-top:10pt;"><b>เลิกประชุมเวลา</b> ${d.close_time}</div>` : ""}
        <div style="text-align:right;margin-top:48pt;${S.lh}">
          <div>ลงชื่อ .................................................... ผู้จดรายงาน</div>
          <div style="margin-top:4pt;">(${d.recorder || "................................................"})</div>
        </div>
      `));
    },
  },
  // ===== 6. หนังสือรับรอง (ตราครุฑ 3 ซม.) =====
  {
    id: "cert_general",
    title: "หนังสือรับรอง",
    description: "หนังสือที่เจ้าหน้าที่ทำขึ้นเพื่อรับรองเหตุการณ์หรือรับรองบุคคล",
    category: "official",
    fields: [
      { key: "doc_number", label: "ที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "body", label: "ข้อความรับรอง", type: "textarea", required: true, placeholder: "ขอรับรองว่า ..." },
      { key: "purpose", label: "ออกให้เพื่อ", type: "text", placeholder: "เช่น ใช้ประกอบการสมัครงาน" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
      </div>
      <div style="text-align:center;${S.lh}">ที่ ${d.doc_number || "......./......"}</div>
      <div style="text-align:center;font-size:22pt;font-weight:bold;">หนังสือรับรอง</div>
      <div style="${S.indent}white-space:pre-wrap;margin-top:16pt;">${d.body || ""}</div>
      ${d.purpose ? `<p style="${S.indent}margin-top:6pt;">ออกหนังสือฉบับนี้ให้เพื่อ${d.purpose}</p>` : ""}
      <p style="${S.indent}margin-top:6pt;">ให้ไว้ ณ วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "ผู้อำนวยการโรงเรียน"}</div>
      </div>
    `)),
  },
  // ===== แบบฟอร์มบุคลากร =====
  {
    id: "leave_form",
    title: "ใบลา",
    description: "แบบฟอร์มใบลาป่วย ลากิจ ลาพักผ่อน (ตามระเบียบสำนักนายกรัฐมนตรี)",
    category: "personnel",
    fields: [
      { key: "leave_type", label: "ประเภทการลา", type: "select", options: [
        { value: "sick", label: "ลาป่วย" },
        { value: "personal", label: "ลากิจส่วนตัว" },
        { value: "vacation", label: "ลาพักผ่อน" },
        { value: "maternity", label: "ลาคลอดบุตร" },
        { value: "ordain", label: "ลาอุปสมบท" },
      ], required: true },
      { key: "name", label: "ชื่อ-สกุล", type: "text", required: true },
      { key: "position", label: "ตำแหน่ง", type: "text" },
      { key: "department", label: "สังกัด", type: "text" },
      { key: "start_date", label: "ตั้งแต่วันที่", type: "date", required: true, half: true },
      { key: "end_date", label: "ถึงวันที่", type: "date", required: true, half: true },
      { key: "total_days", label: "รวม (วัน)", type: "number", half: true },
      { key: "reason", label: "เหตุผล", type: "textarea", required: true },
      { key: "contact_phone", label: "โทรศัพท์ติดต่อ", type: "text", half: true },
      { key: "acting_person", label: "ผู้ปฏิบัติหน้าที่แทน", type: "text" },
    ],
    render: (d, school) => {
      const leaveTypes: Record<string, string> = { sick: "ลาป่วย", personal: "ลากิจส่วนตัว", vacation: "ลาพักผ่อน", maternity: "ลาคลอดบุตร", ordain: "ลาอุปสมบท" };
      return replaceOrigin(docWrap(`
        <div style="margin-bottom:6pt;">
          ${S.garudaSmall}
          <div style="text-align:center;font-size:22pt;font-weight:bold;padding-top:6pt;">แบบใบลา</div>
        </div>
        <div style="text-align:right;${S.lh}">เขียนที่ ${school}</div>
        <div style="text-align:right;${S.lh}margin-bottom:4pt;">วันที่ ${thaiDate(today)}</div>
        <div style="${S.lh}">
          <div><b>เรื่อง</b>&nbsp;&nbsp;ขอ${leaveTypes[d.leave_type] || "ลา"}</div>
          <div><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
        </div>
        <p style="${S.indent}">ข้าพเจ้า ${d.name || "......................................................"} ตำแหน่ง ${d.position || "......................................................"} สังกัด ${d.department || school}</p>
        <p style="${S.indent}">ขอ${leaveTypes[d.leave_type] || "ลา"} เนื่องจาก ${d.reason || "......................................................"}</p>
        <p style="${S.indent}">ตั้งแต่วันที่ ${d.start_date ? thaiDate(new Date(d.start_date)) : "......................................................"} ถึงวันที่ ${d.end_date ? thaiDate(new Date(d.end_date)) : "......................................................"} มีกำหนด ${d.total_days || "......"} วัน</p>
        <p style="${S.indent}">ระหว่างลาติดต่อได้ที่ โทร. ${d.contact_phone || "......................................................"}</p>
        ${d.acting_person ? `<p style="${S.indent}">ขอให้ ${d.acting_person} ปฏิบัติหน้าที่แทน</p>` : ""}
        <div style="${S.sig}">
          <div>ลงชื่อ .................................................... ผู้ขอลา</div>
          <div style="margin-top:4pt;">(${d.name || "................................................"})</div>
        </div>
        <div style="border-top:1pt dashed #999;margin:24pt 0;"></div>
        <div style="${S.lh}"><b>ความเห็นผู้บังคับบัญชา</b></div>
        <div style="${S.lh}">☐ อนุญาต &nbsp;&nbsp;&nbsp; ☐ ไม่อนุญาต เนื่องจาก ..................................................................</div>
        <div style="${S.sig}">
          <div>ลงชื่อ .................................................... ผู้อนุญาต</div>
          <div style="margin-top:4pt;">(................................................)</div>
          <div style="margin-top:4pt;">ตำแหน่ง ....................................................</div>
        </div>
      `));
    },
  },
  {
    id: "cert_teacher",
    title: "หนังสือรับรอง (บุคลากร)",
    description: "หนังสือรับรองการปฏิบัติงาน / รับรองเงินเดือน",
    category: "personnel",
    fields: [
      { key: "cert_type", label: "ประเภท", type: "select", options: [
        { value: "work", label: "รับรองการปฏิบัติงาน" },
        { value: "salary", label: "รับรองเงินเดือน" },
        { value: "position", label: "รับรองตำแหน่ง" },
      ], required: true },
      { key: "doc_number", label: "ที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "name", label: "ชื่อ-สกุล", type: "text", required: true },
      { key: "national_id", label: "เลขบัตรประชาชน", type: "text" },
      { key: "position", label: "ตำแหน่ง", type: "text" },
      { key: "salary", label: "เงินเดือน (บาท)", type: "number" },
      { key: "since_date", label: "ปฏิบัติงานตั้งแต่", type: "date" },
      { key: "purpose", label: "เพื่อใช้ในการ", type: "text", placeholder: "เช่น ยื่นกู้, สมัครงาน" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
      </div>
      <div style="text-align:center;${S.lh}">ที่ ${d.doc_number || "......./......"}</div>
      <div style="text-align:center;font-size:22pt;font-weight:bold;">หนังสือรับรอง</div>
      <p style="${S.indent}margin-top:12pt;">โรงเรียน${school} ขอรับรองว่า</p>
      <p style="${S.indent}">${d.name || "......................................................"} เลขประจำตัวประชาชน ${d.national_id || "......................................................"}</p>
      <p style="${S.indent}">ดำรงตำแหน่ง ${d.position || "......................................................"} ${d.salary ? `อัตราเงินเดือน ${Number(d.salary).toLocaleString()} บาท` : ""}</p>
      ${d.since_date ? `<p style="${S.indent}">ปฏิบัติงานตั้งแต่วันที่ ${thaiDate(new Date(d.since_date))}</p>` : ""}
      <p style="${S.indent}">ออกหนังสือฉบับนี้ให้เพื่อ${d.purpose || "ใช้ตามวัตถุประสงค์"}</p>
      <p style="${S.indent}">ให้ไว้ ณ วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "ผู้อำนวยการโรงเรียน"}</div>
      </div>
    `)),
  },
  {
    id: "vit_request",
    title: "แบบขอเลื่อนวิทยฐานะ (ว PA)",
    description: "แบบคำขอมีหรือเลื่อนวิทยฐานะ ตาม ว PA",
    category: "personnel",
    fields: [
      { key: "name", label: "ชื่อ-สกุล", type: "text", required: true },
      { key: "position", label: "ตำแหน่งปัจจุบัน", type: "text" },
      { key: "current_level", label: "วิทยฐานะปัจจุบัน", type: "select", options: [
        { value: "none", label: "ยังไม่มีวิทยฐานะ" },
        { value: "ครูชำนาญการ", label: "ครูชำนาญการ" },
        { value: "ครูชำนาญการพิเศษ", label: "ครูชำนาญการพิเศษ" },
        { value: "ครูเชี่ยวชาญ", label: "ครูเชี่ยวชาญ" },
      ] },
      { key: "request_level", label: "ขอเลื่อนเป็น", type: "select", options: [
        { value: "ครูชำนาญการ", label: "ครูชำนาญการ" },
        { value: "ครูชำนาญการพิเศษ", label: "ครูชำนาญการพิเศษ" },
        { value: "ครูเชี่ยวชาญ", label: "ครูเชี่ยวชาญ" },
        { value: "ครูเชี่ยวชาญพิเศษ", label: "ครูเชี่ยวชาญพิเศษ" },
      ], required: true },
      { key: "subject_group", label: "สาขา/กลุ่มสาระ", type: "text" },
      { key: "doc_date", label: "วันที่ยื่น", type: "date" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="margin-bottom:6pt;">
        ${S.garudaSmall}
        <div style="text-align:center;font-size:22pt;font-weight:bold;padding-top:6pt;">แบบคำขอมี/เลื่อนวิทยฐานะ</div>
        <div style="text-align:center;${S.lh}">(ตามหลักเกณฑ์ ว PA)</div>
      </div>
      <div style="text-align:right;${S.lh}">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
      <table class="obec-table" style="margin:12pt 0;font-size:16pt;">
        <tr><td style="width:40%;padding:6pt 8pt;"><b>ชื่อ-สกุล</b></td><td style="padding:6pt 8pt;">${d.name || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>ตำแหน่งปัจจุบัน</b></td><td style="padding:6pt 8pt;">${d.position || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>วิทยฐานะปัจจุบัน</b></td><td style="padding:6pt 8pt;">${d.current_level === "none" ? "ยังไม่มี" : (d.current_level || "ยังไม่มี")}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>ขอเลื่อนเป็น</b></td><td style="padding:6pt 8pt;">${d.request_level || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>สาขา/กลุ่มสาระ</b></td><td style="padding:6pt 8pt;">${d.subject_group || ""}</td></tr>
      </table>
      <div style="${S.sig}">
        <div>ลงชื่อ .................................................... ผู้ยื่นคำขอ</div>
        <div style="margin-top:4pt;">(${d.name || "................................................"})</div>
      </div>
    `)),
  },
  // ===== แบบฟอร์มนักเรียน =====
  {
    id: "student_cert",
    title: "ใบรับรองนักเรียน",
    description: "หนังสือรับรองการเป็นนักเรียน",
    category: "student",
    fields: [
      { key: "doc_number", label: "ที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "student_name", label: "ชื่อ-สกุลนักเรียน", type: "text", required: true },
      { key: "student_code", label: "เลขประจำตัว", type: "text" },
      { key: "grade_level", label: "ชั้น", type: "text", placeholder: "เช่น ม.3/1" },
      { key: "academic_year", label: "ปีการศึกษา", type: "text" },
      { key: "date_of_birth", label: "เกิดวันที่", type: "date" },
      { key: "national_id", label: "เลขบัตรประชาชน", type: "text" },
      { key: "purpose", label: "เพื่อใช้ในการ", type: "text" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
      </div>
      <div style="text-align:center;${S.lh}">ที่ ${d.doc_number || "......./......"}</div>
      <div style="text-align:center;font-size:22pt;font-weight:bold;">หนังสือรับรอง</div>
      <p style="${S.indent}margin-top:12pt;">${school} ขอรับรองว่า</p>
      <p style="${S.indent}">${d.student_name || "......................................................"} เลขประจำตัว ${d.student_code || "......................................................"}</p>
      ${d.national_id ? `<p style="${S.indent}">เลขประจำตัวประชาชน ${d.national_id}</p>` : ""}
      ${d.date_of_birth ? `<p style="${S.indent}">เกิดวันที่ ${thaiDate(new Date(d.date_of_birth))}</p>` : ""}
      <p style="${S.indent}">เป็นนักเรียนชั้น ${d.grade_level || "......"} ปีการศึกษา ${d.academic_year || "......"}</p>
      <p style="${S.indent}">ออกหนังสือฉบับนี้เพื่อ${d.purpose || "ใช้ตามวัตถุประสงค์"}</p>
      <p style="${S.indent}">ให้ไว้ ณ วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "ผู้อำนวยการโรงเรียน"}</div>
      </div>
    `)),
  },
  {
    id: "student_leave",
    title: "ใบลานักเรียน",
    description: "แบบฟอร์มใบลาสำหรับนักเรียน",
    category: "student",
    fields: [
      { key: "student_name", label: "ชื่อ-สกุลนักเรียน", type: "text", required: true },
      { key: "grade_level", label: "ชั้น", type: "text", half: true },
      { key: "student_code", label: "เลขประจำตัว", type: "text", half: true },
      { key: "leave_type", label: "ประเภทการลา", type: "select", options: [
        { value: "sick", label: "ลาป่วย" }, { value: "personal", label: "ลากิจ" },
      ], required: true },
      { key: "start_date", label: "ตั้งแต่วันที่", type: "date", required: true, half: true },
      { key: "end_date", label: "ถึงวันที่", type: "date", required: true, half: true },
      { key: "reason", label: "เหตุผล", type: "textarea", required: true },
      { key: "parent_name", label: "ผู้ปกครอง", type: "text" },
      { key: "parent_phone", label: "โทรศัพท์ผู้ปกครอง", type: "text" },
    ],
    render: (d, school) => {
      const lt: Record<string, string> = { sick: "ลาป่วย", personal: "ลากิจ" };
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:22pt;font-weight:bold;">ใบลา</div>
        <div style="text-align:center;${S.lh}margin-bottom:4pt;">${school}</div>
        <div style="text-align:right;${S.lh}">วันที่ ${thaiDate(today)}</div>
        <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ครูประจำชั้น / ครูที่ปรึกษา</div>
        <p style="${S.indent}">ข้าพเจ้า ${d.student_name || "......................................................"} ชั้น ${d.grade_level || "......"} เลขที่ ${d.student_code || "......"}</p>
        <p style="${S.indent}">ขอ${lt[d.leave_type] || "ลา"} เนื่องจาก ${d.reason || "......................................................"}</p>
        <p style="${S.indent}">ตั้งแต่วันที่ ${d.start_date ? thaiDate(new Date(d.start_date)) : "......................................................"} ถึงวันที่ ${d.end_date ? thaiDate(new Date(d.end_date)) : "......................................................"}</p>
        <div style="display:flex;justify-content:space-between;margin-top:48pt;${S.lh}">
          <div style="text-align:center;">
            <div>ลงชื่อ ............................................ ผู้ปกครอง</div>
            <div style="margin-top:4pt;">(${d.parent_name || "................................................"})</div>
            <div style="margin-top:4pt;">โทร. ${d.parent_phone || "......................................................"}</div>
          </div>
          <div style="text-align:center;">
            <div>ลงชื่อ ............................................ นักเรียน</div>
            <div style="margin-top:4pt;">(${d.student_name || "................................................"})</div>
          </div>
        </div>
        <div style="border-top:1pt dashed #999;margin:24pt 0;"></div>
        <div style="${S.lh}"><b>ความเห็นครูที่ปรึกษา</b></div>
        <div style="${S.lh}">☐ อนุญาต &nbsp;&nbsp;&nbsp; ☐ ไม่อนุญาต</div>
        <div style="${S.sig}">
          <div>ลงชื่อ .................................................... ครูที่ปรึกษา</div>
          <div style="margin-top:4pt;">(................................................)</div>
        </div>
      `));
    },
  },
  {
    id: "transfer_letter",
    title: "หนังสือส่งตัว",
    description: "หนังสือส่งตัวนักเรียนย้ายสถานศึกษา",
    category: "student",
    fields: [
      urgencyField,
      { key: "doc_number", label: "ที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "to_school", label: "ถึง (โรงเรียนปลายทาง)", type: "text", required: true },
      { key: "student_name", label: "ชื่อ-สกุลนักเรียน", type: "text", required: true },
      { key: "grade_level", label: "ชั้นที่กำลังศึกษา", type: "text" },
      { key: "reason", label: "เหตุผลในการย้าย", type: "textarea" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
        ${urgencyStamp(d.urgency)}
      </div>
      <div style="text-align:right;${S.lh}">
        <div><b>ที่</b>&nbsp;&nbsp;${d.doc_number || "......./......"}</div>
        <div>${school}</div>
        <div>${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      </div>
      <div style="${S.lh}">
        <div><b>เรื่อง</b>&nbsp;&nbsp;ส่งตัวนักเรียน</div>
        <div><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${d.to_school || "......................................................"}</div>
      </div>
      <p style="${S.indent}">ด้วย ${school} ขอส่งตัว ${d.student_name || "......................................................"} ซึ่งกำลังศึกษาชั้น ${d.grade_level || "......"}</p>
      ${d.reason ? `<p style="${S.indent}">เหตุผล: ${d.reason}</p>` : ""}
      <p style="${S.indent}">จึงเรียนมาเพื่อโปรดรับตัวนักเรียนดังกล่าวเข้าศึกษาต่อด้วย จะเป็นพระคุณ</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "ผู้อำนวยการโรงเรียน"}</div>
      </div>
    `)),
  },
  // ===== แบบฟอร์มงบประมาณ =====
  {
    id: "requisition",
    title: "ใบเบิกพัสดุ",
    description: "แบบฟอร์มเบิกวัสดุ/พัสดุภายในโรงเรียน",
    category: "budget",
    fields: [
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "requester", label: "ผู้เบิก", type: "text", required: true },
      { key: "department", label: "ฝ่าย/กลุ่มงาน", type: "text" },
      { key: "purpose", label: "เพื่อใช้ในงาน", type: "text" },
      { key: "items", label: "รายการพัสดุ (แต่ละรายการขึ้นบรรทัดใหม่)", type: "textarea", required: true, placeholder: "เช่น\nกระดาษ A4 5 รีม\nหมึกพิมพ์ 2 ตลับ" },
      { key: "approver", label: "ผู้อนุมัติ", type: "text" },
    ],
    render: (d, school) => {
      const items = (d.items || "").split("\n").filter(Boolean);
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:22pt;font-weight:bold;">ใบเบิกพัสดุ</div>
        <div style="text-align:center;${S.lh}margin-bottom:4pt;">${school}</div>
        <div style="text-align:right;${S.lh}">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
        <div style="${S.lh}">ผู้เบิก: ${d.requester || "......................................................"} &nbsp;&nbsp; ฝ่าย: ${d.department || "......................................................"}</div>
        <div style="${S.lh}">เพื่อใช้ในงาน: ${d.purpose || "......................................................"}</div>
        <table class="obec-table" style="font-size:16pt;">
          <thead><tr><th style="width:50pt;">ลำดับ</th><th>รายการ</th></tr></thead>
          <tbody>
            ${items.map((item, i) => `<tr><td class="center">${i + 1}</td><td>${item}</td></tr>`).join("")}
            ${items.length === 0 ? '<tr><td colspan="2" class="center" style="padding:20pt;color:#999;">ยังไม่มีรายการ</td></tr>' : ""}
          </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:48pt;${S.lh}">
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">ผู้เบิก</div>
          </div>
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">ผู้อนุมัติ</div>
            ${d.approver ? `<div style="margin-top:4pt;">(${d.approver})</div>` : ""}
          </div>
        </div>
      `));
    },
  },
  {
    id: "purchase_request",
    title: "ใบขออนุมัติจัดซื้อ",
    description: "แบบขออนุมัติจัดซื้อจัดจ้าง",
    category: "budget",
    fields: [
      { key: "doc_number", label: "เลขที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "requester", label: "ผู้ขอ", type: "text", required: true },
      { key: "department", label: "ฝ่าย", type: "text" },
      { key: "subject", label: "เรื่อง", type: "text", required: true },
      { key: "budget_source", label: "แหล่งงบประมาณ", type: "text", placeholder: "เช่น งบดำเนินงาน, เงินอุดหนุน" },
      { key: "amount", label: "จำนวนเงิน (บาท)", type: "number", required: true },
      { key: "reason", label: "เหตุผลความจำเป็น", type: "textarea", required: true },
      { key: "signer_name", label: "ผู้อนุมัติ", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="margin-bottom:6pt;">
        ${S.garudaSmall}
        <div style="text-align:center;font-size:22pt;font-weight:bold;padding-top:6pt;">บันทึกข้อความ</div>
      </div>
      <div style="${S.lh}margin-top:4pt;">
        <div><b>ส่วนราชการ</b>&nbsp;&nbsp;&nbsp;${school} <span style="float:right;"><b>ที่</b>&nbsp;${d.doc_number || "......./......"}&nbsp;&nbsp;<b>วันที่</b>&nbsp;${d.doc_date ? thaiDate(new Date(d.doc_date)) : "............"}</span></div>
        <div><b>เรื่อง</b>&nbsp;&nbsp;ขออนุมัติจัดซื้อ - ${d.subject || ""}</div>
      </div>
      <div style="border-top:1.5pt solid #000;margin:2pt 0 6pt;"></div>
      <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
      <p style="${S.indent}">ด้วย ${d.department || "......"} มีความจำเป็นต้องจัดซื้อ ${d.subject || "......................................................"}</p>
      <p style="${S.indent}">เหตุผล: ${d.reason || "......................................................"}</p>
      <p style="${S.indent}">จำนวนเงิน ${d.amount ? Number(d.amount).toLocaleString() : "......"} บาท จากแหล่งงบประมาณ: ${d.budget_source || "......................................................"}</p>
      <p style="${S.indent}">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
      <div style="display:flex;justify-content:space-between;margin-top:48pt;${S.lh}">
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">ผู้ขอ</div>
          <div style="margin-top:4pt;">(${d.requester || "................................................"})</div>
        </div>
        <div style="text-align:center;">
          <div>☐ อนุมัติ &nbsp;&nbsp; ☐ ไม่อนุมัติ</div>
          <div style="margin-top:20pt;">ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.signer_name || "................................................"})</div>
          <div style="margin-top:4pt;">ผู้อำนวยการ</div>
        </div>
      </div>
    `)),
  },
  {
    id: "inspection_report",
    title: "ใบตรวจรับ",
    description: "แบบตรวจรับพัสดุ/ครุภัณฑ์",
    category: "budget",
    fields: [
      { key: "doc_date", label: "วันที่ตรวจรับ", type: "date", required: true },
      { key: "po_number", label: "เลขที่ใบสั่งซื้อ", type: "text" },
      { key: "vendor", label: "ผู้ขาย/ร้านค้า", type: "text" },
      { key: "items", label: "รายการ (แต่ละรายการขึ้นบรรทัดใหม่)", type: "textarea", required: true },
      { key: "total_amount", label: "จำนวนเงินรวม (บาท)", type: "number" },
      { key: "result", label: "ผลการตรวจรับ", type: "select", options: [
        { value: "pass", label: "ถูกต้องครบถ้วน" },
        { value: "partial", label: "ไม่ครบถ้วน" },
        { value: "fail", label: "ไม่ผ่านการตรวจรับ" },
      ] },
      { key: "inspector1", label: "กรรมการตรวจรับ คนที่ 1", type: "text", required: true },
      { key: "inspector2", label: "กรรมการตรวจรับ คนที่ 2", type: "text" },
      { key: "inspector3", label: "กรรมการตรวจรับ คนที่ 3", type: "text" },
    ],
    render: (d, school) => {
      const items = (d.items || "").split("\n").filter(Boolean);
      const resultMap: Record<string, string> = { pass: "ถูกต้องครบถ้วน", partial: "ไม่ครบถ้วน", fail: "ไม่ผ่าน" };
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:22pt;font-weight:bold;">ใบตรวจรับพัสดุ</div>
        <div style="text-align:center;${S.lh}margin-bottom:4pt;">${school}</div>
        <div style="${S.lh}">วันที่ตรวจรับ: ${d.doc_date ? thaiDate(new Date(d.doc_date)) : "......................................................"}</div>
        <div style="${S.lh}">เลขที่ใบสั่งซื้อ: ${d.po_number || "......"} &nbsp;&nbsp; ผู้ขาย: ${d.vendor || "......................................................"}</div>
        <table class="obec-table" style="font-size:16pt;">
          <thead><tr><th style="width:50pt;">ลำดับ</th><th>รายการ</th></tr></thead>
          <tbody>
            ${items.map((item, i) => `<tr><td class="center">${i + 1}</td><td>${item}</td></tr>`).join("")}
          </tbody>
        </table>
        <div style="${S.lh}margin-top:8pt;">จำนวนเงินรวม: ${d.total_amount ? Number(d.total_amount).toLocaleString() : "......"} บาท</div>
        <div style="${S.lh}"><b>ผลการตรวจรับ:</b> ${resultMap[d.result] || "......................................................"}</div>
        <div style="display:flex;justify-content:space-around;margin-top:48pt;${S.lh}">
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">(${d.inspector1 || "................................................"})</div>
            <div style="margin-top:4pt;">กรรมการตรวจรับ</div>
          </div>
          ${d.inspector2 ? `<div style="text-align:center;"><div>ลงชื่อ ....................................................</div><div style="margin-top:4pt;">(${d.inspector2})</div><div style="margin-top:4pt;">กรรมการตรวจรับ</div></div>` : ""}
          ${d.inspector3 ? `<div style="text-align:center;"><div>ลงชื่อ ....................................................</div><div style="margin-top:4pt;">(${d.inspector3})</div><div style="margin-top:4pt;">กรรมการตรวจรับ</div></div>` : ""}
        </div>
      `));
    },
  },
  // ===== 7. หนังสือประทับตรา (ตราครุฑ 3 ซม.) =====
  {
    id: "stamped_letter",
    title: "หนังสือประทับตรา",
    description: "หนังสือที่ไม่ต้องลงชื่อผู้ส่ง ใช้ตราประทับแทนลายเซ็น เช่น ส่งเอกสาร ส่งสำเนา",
    category: "official",
    fields: [
      urgencyField,
      { key: "doc_number", label: "ที่", type: "text", placeholder: "ศธ 04001/...", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "to", label: "ถึง", type: "text", required: true },
      { key: "subject", label: "เรื่อง", type: "text", required: true },
      { key: "attachment", label: "สิ่งที่ส่งมาด้วย", type: "textarea" },
      { key: "body", label: "ข้อความ", type: "textarea", required: true },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
        ${urgencyStamp(d.urgency)}
      </div>
      <div style="text-align:right;${S.lh}">
        <div><b>ที่</b>&nbsp;&nbsp;${d.doc_number || "......./......"}</div>
      </div>
      <div style="${S.lh}margin-top:6pt;">
        <div><b>ถึง</b>&nbsp;&nbsp;${d.to || ""}</div>
        <div><b>เรื่อง</b>&nbsp;&nbsp;${d.subject || ""}</div>
        ${d.attachment ? `<div><b>สิ่งที่ส่งมาด้วย</b>&nbsp;&nbsp;${d.attachment}</div>` : ""}
      </div>
      <div style="${S.indent}white-space:pre-wrap;margin-top:8pt;">${d.body || ""}</div>
      <div style="text-align:center;margin-top:60pt;">
        <div style="border:2pt solid #000;width:4cm;height:4cm;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:12pt;color:#999;">(ตราประทับ)</div>
        <div style="margin-top:8pt;${S.lh}">${school}</div>
        <div style="${S.lh}">${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      </div>
    `)),
  },
  // ===== 8. หนังสือเชิญ =====
  {
    id: "invitation_letter",
    title: "หนังสือเชิญ",
    description: "หนังสือเชิญประชุม เชิญเป็นวิทยากร เชิญร่วมงาน",
    category: "official",
    fields: [
      { key: "doc_number", label: "ที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "to", label: "เรียน", type: "text", required: true },
      { key: "subject", label: "เรื่อง", type: "text", required: true, placeholder: "เช่น ขอเชิญประชุม, เชิญเป็นวิทยากร" },
      { key: "body", label: "ข้อความ", type: "textarea", required: true },
      { key: "event_date", label: "วันที่จัดงาน", type: "date", half: true },
      { key: "event_time", label: "เวลา", type: "text", placeholder: "09.00 น.", half: true },
      { key: "event_place", label: "สถานที่", type: "text" },
      { key: "closing", label: "คำลงท้าย", type: "text", placeholder: "จึงเรียนมาเพื่อโปรดเข้าร่วม" },
      { key: "signer_name", label: "ผู้ลงนาม", type: "text", required: true },
      { key: "signer_position", label: "ตำแหน่ง", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;margin-bottom:8pt;">
        ${S.garudaLarge}
      </div>
      <div style="text-align:right;${S.lh}">
        <div><b>ที่</b>&nbsp;&nbsp;${d.doc_number || "......./......"}</div>
        <div>${school}</div>
        <div>${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      </div>
      <div style="${S.lh}margin-top:6pt;">
        <div><b>เรื่อง</b>&nbsp;&nbsp;${d.subject || ""}</div>
        <div><b>เรียน</b>&nbsp;&nbsp;${d.to || ""}</div>
      </div>
      <div style="${S.indent}white-space:pre-wrap;margin-top:8pt;">${d.body || ""}</div>
      ${d.event_date ? `<p style="${S.indent}">ในวันที่ ${thaiDate(new Date(d.event_date))} ${d.event_time ? `เวลา ${d.event_time}` : ""} ${d.event_place ? `ณ ${d.event_place}` : ""}</p>` : ""}
      <p style="${S.indent}margin-top:6pt;">${d.closing || "จึงเรียนมาเพื่อโปรดพิจารณา"}</p>
      <div style="${S.sig}">
        <div>(${d.signer_name || "................................................"})</div>
        <div>${d.signer_position || "ผู้อำนวยการโรงเรียน"}</div>
      </div>
    `)),
  },
  // ===== 9. หนังสือมอบอำนาจ =====
  {
    id: "power_of_attorney",
    title: "หนังสือมอบอำนาจ",
    description: "หนังสือมอบอำนาจให้กระทำการแทน",
    category: "official",
    fields: [
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "grantor_name", label: "ผู้มอบอำนาจ", type: "text", required: true },
      { key: "grantor_position", label: "ตำแหน่ง", type: "text" },
      { key: "grantor_id", label: "เลขบัตรประชาชน (ผู้มอบ)", type: "text" },
      { key: "grantee_name", label: "ผู้รับมอบอำนาจ", type: "text", required: true },
      { key: "grantee_position", label: "ตำแหน่ง (ผู้รับมอบ)", type: "text" },
      { key: "grantee_id", label: "เลขบัตรประชาชน (ผู้รับมอบ)", type: "text" },
      { key: "authority_detail", label: "มอบอำนาจให้กระทำการ", type: "textarea", required: true, placeholder: "เช่น ลงนามในสัญญาจัดซื้อจัดจ้าง..." },
      { key: "witness1", label: "พยาน คนที่ 1", type: "text" },
      { key: "witness2", label: "พยาน คนที่ 2", type: "text" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;font-size:22pt;font-weight:bold;margin-bottom:16pt;">หนังสือมอบอำนาจ</div>
      <div style="text-align:right;${S.lh}">เขียนที่ ${school}</div>
      <div style="text-align:right;${S.lh}margin-bottom:8pt;">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      <p style="${S.indent}">โดยหนังสือฉบับนี้ ข้าพเจ้า ${d.grantor_name || "......................................................"} ตำแหน่ง ${d.grantor_position || "......................................................"} เลขประจำตัวประชาชน ${d.grantor_id || "......................................................"}</p>
      <p style="${S.indent}">ขอมอบอำนาจให้ ${d.grantee_name || "......................................................"} ตำแหน่ง ${d.grantee_position || "......................................................"} เลขประจำตัวประชาชน ${d.grantee_id || "......................................................"}</p>
      <p style="${S.indent}">เป็นผู้มีอำนาจกระทำการแทนข้าพเจ้าในเรื่อง ${d.authority_detail || "......................................................"}</p>
      <p style="${S.indent}">ทั้งนี้ ข้าพเจ้ายอมรับผิดชอบในกิจการที่ผู้รับมอบอำนาจได้กระทำไปตามหนังสือมอบอำนาจฉบับนี้ เสมือนว่าข้าพเจ้าเป็นผู้กระทำด้วยตนเอง</p>
      <div style="display:flex;justify-content:space-between;margin-top:48pt;${S.lh}">
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.grantor_name || "................................................"})</div>
          <div style="margin-top:4pt;">ผู้มอบอำนาจ</div>
        </div>
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.grantee_name || "................................................"})</div>
          <div style="margin-top:4pt;">ผู้รับมอบอำนาจ</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:36pt;${S.lh}">
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.witness1 || "................................................"})</div>
          <div style="margin-top:4pt;">พยาน</div>
        </div>
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.witness2 || "................................................"})</div>
          <div style="margin-top:4pt;">พยาน</div>
        </div>
      </div>
    `)),
  },
  // ===== 10. แบบขอใช้อาคาร/สถานที่ =====
  {
    id: "venue_request",
    title: "แบบขอใช้อาคาร/สถานที่",
    description: "แบบคำขอใช้อาคาร สถานที่ หรือสนามกีฬา",
    category: "official",
    fields: [
      { key: "doc_date", label: "วันที่ขอ", type: "date", half: true },
      { key: "requester", label: "ผู้ขอใช้", type: "text", required: true },
      { key: "organization", label: "หน่วยงาน/องค์กร", type: "text" },
      { key: "venue", label: "สถานที่ที่ขอใช้", type: "text", required: true, placeholder: "เช่น ห้องประชุม, หอประชุม, สนามกีฬา" },
      { key: "use_date", label: "วันที่ใช้", type: "date", required: true, half: true },
      { key: "use_time", label: "เวลา", type: "text", placeholder: "08.00 - 16.00 น.", half: true },
      { key: "purpose", label: "วัตถุประสงค์", type: "textarea", required: true },
      { key: "equipment_needed", label: "อุปกรณ์ที่ต้องการ", type: "textarea", placeholder: "เช่น โปรเจ็กเตอร์, ไมโครโฟน" },
      { key: "num_attendees", label: "จำนวนผู้เข้าร่วม (คน)", type: "number", half: true },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="margin-bottom:6pt;">
        ${S.garudaSmall}
        <div style="text-align:center;font-size:22pt;font-weight:bold;padding-top:6pt;">แบบขอใช้อาคาร/สถานที่</div>
        <div style="text-align:center;${S.lh}">${school}</div>
      </div>
      <div style="text-align:right;${S.lh}">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
      <table class="obec-table" style="margin:12pt 0;font-size:16pt;">
        <tr><td style="width:35%;padding:6pt 8pt;"><b>ผู้ขอใช้</b></td><td style="padding:6pt 8pt;">${d.requester || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>หน่วยงาน</b></td><td style="padding:6pt 8pt;">${d.organization || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>สถานที่ที่ขอใช้</b></td><td style="padding:6pt 8pt;">${d.venue || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>วันที่ใช้</b></td><td style="padding:6pt 8pt;">${d.use_date ? thaiDate(new Date(d.use_date)) : ""} ${d.use_time ? `เวลา ${d.use_time}` : ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>จำนวนผู้เข้าร่วม</b></td><td style="padding:6pt 8pt;">${d.num_attendees || "......"} คน</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>วัตถุประสงค์</b></td><td style="padding:6pt 8pt;">${d.purpose || ""}</td></tr>
        ${d.equipment_needed ? `<tr><td style="padding:6pt 8pt;"><b>อุปกรณ์ที่ต้องการ</b></td><td style="padding:6pt 8pt;">${d.equipment_needed}</td></tr>` : ""}
      </table>
      <div style="${S.sig}">
        <div>ลงชื่อ .................................................... ผู้ขอใช้</div>
        <div style="margin-top:4pt;">(${d.requester || "................................................"})</div>
      </div>
      <div style="border-top:1pt dashed #999;margin:24pt 0;"></div>
      <div style="${S.lh}"><b>ความเห็นผู้บังคับบัญชา</b></div>
      <div style="${S.lh}">☐ อนุญาต &nbsp;&nbsp;&nbsp; ☐ ไม่อนุญาต เนื่องจาก ..................................................................</div>
      <div style="${S.sig}">
        <div>ลงชื่อ .................................................... ผู้อนุญาต</div>
        <div style="margin-top:4pt;">(................................................)</div>
        <div style="margin-top:4pt;">ตำแหน่ง ....................................................</div>
      </div>
    `)),
  },
  // ===== แบบฟอร์มบุคลากรเพิ่ม =====
  // ===== 11. แบบขออนุญาตไปราชการ =====
  {
    id: "travel_request",
    title: "แบบขออนุญาตไปราชการ",
    description: "บันทึกข้อความขออนุญาตเดินทางไปราชการ/อบรม/สัมมนา",
    category: "personnel",
    fields: [
      { key: "doc_number", label: "ที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "name", label: "ชื่อ-สกุล", type: "text", required: true },
      { key: "position", label: "ตำแหน่ง", type: "text" },
      { key: "destination", label: "สถานที่ไปราชการ", type: "text", required: true },
      { key: "purpose", label: "เพื่อ", type: "textarea", required: true, placeholder: "เช่น เข้ารับการอบรม, ประชุมสัมมนา" },
      { key: "start_date", label: "ตั้งแต่วันที่", type: "date", required: true, half: true },
      { key: "end_date", label: "ถึงวันที่", type: "date", required: true, half: true },
      { key: "travel_by", label: "พาหนะที่ใช้", type: "select", options: [
        { value: "car_personal", label: "รถยนต์ส่วนตัว" },
        { value: "car_official", label: "รถยนต์ราชการ" },
        { value: "bus", label: "รถโดยสาร" },
        { value: "train", label: "รถไฟ" },
        { value: "plane", label: "เครื่องบิน" },
      ] },
      { key: "budget_source", label: "แหล่งงบประมาณ", type: "text", placeholder: "เช่น งบพัฒนาบุคลากร" },
      { key: "acting_person", label: "ผู้ปฏิบัติหน้าที่แทน", type: "text" },
    ],
    render: (d, school) => {
      const travelMap: Record<string, string> = { car_personal: "รถยนต์ส่วนตัว", car_official: "รถยนต์ราชการ", bus: "รถโดยสาร", train: "รถไฟ", plane: "เครื่องบิน" };
      return replaceOrigin(docWrap(`
        <div style="margin-bottom:6pt;">
          ${S.garudaSmall}
          <div style="text-align:center;font-size:22pt;font-weight:bold;padding-top:6pt;">บันทึกข้อความ</div>
        </div>
        <div style="${S.lh}margin-top:4pt;">
          <div><b>ส่วนราชการ</b>&nbsp;&nbsp;&nbsp;${school}</div>
          <div style="display:flex;justify-content:space-between;">
            <span><b>ที่</b>&nbsp;&nbsp;${d.doc_number || "......./......"}</span>
            <span><b>วันที่</b>&nbsp;&nbsp;${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</span>
          </div>
          <div><b>เรื่อง</b>&nbsp;&nbsp;ขออนุญาตไปราชการ</div>
        </div>
        <div style="border-top:1.5pt solid #000;margin:2pt 0 6pt;"></div>
        <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
        <p style="${S.indent}">ข้าพเจ้า ${d.name || "......................................................"} ตำแหน่ง ${d.position || "......................................................"}</p>
        <p style="${S.indent}">ขออนุญาตไปราชการ ณ ${d.destination || "......................................................"}</p>
        <p style="${S.indent}">เพื่อ ${d.purpose || "......................................................"}</p>
        <p style="${S.indent}">ตั้งแต่วันที่ ${d.start_date ? thaiDate(new Date(d.start_date)) : "......"} ถึงวันที่ ${d.end_date ? thaiDate(new Date(d.end_date)) : "......"}</p>
        <p style="${S.indent}">โดยใช้พาหนะ ${travelMap[d.travel_by] || "......"} ${d.budget_source ? `งบประมาณจาก ${d.budget_source}` : ""}</p>
        ${d.acting_person ? `<p style="${S.indent}">ระหว่างไปราชการ ขอให้ ${d.acting_person} ปฏิบัติหน้าที่แทน</p>` : ""}
        <p style="${S.indent}">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
        <div style="${S.sig}">
          <div>ลงชื่อ .................................................... ผู้ขออนุญาต</div>
          <div style="margin-top:4pt;">(${d.name || "................................................"})</div>
        </div>
        <div style="border-top:1pt dashed #999;margin:24pt 0;"></div>
        <div style="${S.lh}">☐ อนุมัติ &nbsp;&nbsp;&nbsp; ☐ ไม่อนุมัติ</div>
        <div style="${S.sig}">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(................................................)</div>
          <div style="margin-top:4pt;">ผู้อำนวยการ${school}</div>
        </div>
      `));
    },
  },
  // ===== 12. แบบสัญญาจ้าง =====
  {
    id: "employment_contract",
    title: "สัญญาจ้าง",
    description: "สัญญาจ้างลูกจ้างชั่วคราว ครูอัตราจ้าง พนักงานราชการ",
    category: "personnel",
    fields: [
      { key: "contract_number", label: "สัญญาเลขที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่ทำสัญญา", type: "date", half: true },
      { key: "employee_name", label: "ชื่อ-สกุลผู้รับจ้าง", type: "text", required: true },
      { key: "employee_id", label: "เลขบัตรประชาชน", type: "text" },
      { key: "employee_address", label: "ที่อยู่", type: "textarea" },
      { key: "position", label: "ตำแหน่งที่จ้าง", type: "text", required: true },
      { key: "salary", label: "อัตราค่าจ้าง (บาท/เดือน)", type: "number", required: true },
      { key: "start_date", label: "เริ่มสัญญา", type: "date", required: true, half: true },
      { key: "end_date", label: "สิ้นสุดสัญญา", type: "date", required: true, half: true },
      { key: "duties", label: "หน้าที่ความรับผิดชอบ", type: "textarea" },
      { key: "signer_name", label: "ผู้ว่าจ้าง (ผอ.)", type: "text", required: true },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;font-size:22pt;font-weight:bold;margin-bottom:8pt;">สัญญาจ้าง</div>
      <div style="text-align:center;${S.lh}margin-bottom:4pt;">เลขที่ ${d.contract_number || "......./......"}</div>
      <div style="text-align:right;${S.lh}">เขียนที่ ${school}</div>
      <div style="text-align:right;${S.lh}margin-bottom:8pt;">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      <p style="${S.indent}">สัญญาฉบับนี้ทำขึ้นระหว่าง ${school} โดย ${d.signer_name || "......................................................"} ผู้อำนวยการโรงเรียน ซึ่งต่อไปในสัญญานี้เรียกว่า <b>"ผู้ว่าจ้าง"</b> ฝ่ายหนึ่ง กับ</p>
      <p style="${S.indent}">${d.employee_name || "......................................................"} เลขประจำตัวประชาชน ${d.employee_id || "......................................................"} ${d.employee_address ? `อยู่บ้านเลขที่ ${d.employee_address}` : ""} ซึ่งต่อไปในสัญญานี้เรียกว่า <b>"ผู้รับจ้าง"</b> อีกฝ่ายหนึ่ง</p>
      <p style="${S.indent}">ทั้งสองฝ่ายตกลงทำสัญญามีข้อความดังต่อไปนี้</p>
      <p style="${S.indent}"><b>ข้อ 1.</b> ผู้ว่าจ้างตกลงจ้างและผู้รับจ้างตกลงรับจ้างทำงานในตำแหน่ง ${d.position || "......"}</p>
      <p style="${S.indent}"><b>ข้อ 2.</b> ระยะเวลาจ้าง ตั้งแต่วันที่ ${d.start_date ? thaiDate(new Date(d.start_date)) : "......"} ถึงวันที่ ${d.end_date ? thaiDate(new Date(d.end_date)) : "......"}</p>
      <p style="${S.indent}"><b>ข้อ 3.</b> ผู้ว่าจ้างตกลงจ่ายค่าจ้างให้ผู้รับจ้างในอัตราเดือนละ ${d.salary ? Number(d.salary).toLocaleString() : "......"} บาท</p>
      ${d.duties ? `<p style="${S.indent}"><b>ข้อ 4.</b> หน้าที่ความรับผิดชอบ: ${d.duties}</p>` : ""}
      <div style="display:flex;justify-content:space-between;margin-top:48pt;${S.lh}">
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.signer_name || "................................................"})</div>
          <div style="margin-top:4pt;">ผู้ว่าจ้าง</div>
        </div>
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(${d.employee_name || "................................................"})</div>
          <div style="margin-top:4pt;">ผู้รับจ้าง</div>
        </div>
      </div>
    `)),
  },
  // ===== แบบฟอร์มนักเรียนเพิ่ม =====
  // ===== 13. แบบคำร้องทั่วไป (นักเรียน) =====
  {
    id: "general_petition",
    title: "แบบคำร้องทั่วไป",
    description: "แบบคำร้องขอทั่วไปสำหรับนักเรียน เช่น ขอเอกสาร ขอเปลี่ยนชื่อ",
    category: "student",
    fields: [
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "student_name", label: "ชื่อ-สกุลนักเรียน", type: "text", required: true },
      { key: "student_code", label: "เลขประจำตัว", type: "text", half: true },
      { key: "grade_level", label: "ชั้น", type: "text", half: true },
      { key: "parent_name", label: "ชื่อผู้ปกครอง", type: "text" },
      { key: "phone", label: "โทรศัพท์", type: "text", half: true },
      { key: "request_type", label: "ประเภทคำร้อง", type: "select", options: [
        { value: "document", label: "ขอเอกสาร" },
        { value: "name_change", label: "ขอเปลี่ยนชื่อ-สกุล" },
        { value: "transfer", label: "ขอย้ายสถานศึกษา" },
        { value: "other", label: "อื่น ๆ" },
      ] },
      { key: "detail", label: "รายละเอียดคำร้อง", type: "textarea", required: true },
    ],
    render: (d, school) => {
      const typeMap: Record<string, string> = { document: "ขอเอกสาร", name_change: "ขอเปลี่ยนชื่อ-สกุล", transfer: "ขอย้ายสถานศึกษา", other: "อื่น ๆ" };
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:22pt;font-weight:bold;margin-bottom:4pt;">แบบคำร้องทั่วไป</div>
        <div style="text-align:center;${S.lh}margin-bottom:8pt;">${school}</div>
        <div style="text-align:right;${S.lh}">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
        <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
        <table class="obec-table" style="margin:12pt 0;font-size:16pt;">
          <tr><td style="width:35%;padding:6pt 8pt;"><b>ชื่อ-สกุลนักเรียน</b></td><td style="padding:6pt 8pt;">${d.student_name || ""}</td></tr>
          <tr><td style="padding:6pt 8pt;"><b>เลขประจำตัว</b></td><td style="padding:6pt 8pt;">${d.student_code || ""}</td></tr>
          <tr><td style="padding:6pt 8pt;"><b>ชั้น</b></td><td style="padding:6pt 8pt;">${d.grade_level || ""}</td></tr>
          <tr><td style="padding:6pt 8pt;"><b>ชื่อผู้ปกครอง</b></td><td style="padding:6pt 8pt;">${d.parent_name || ""}</td></tr>
          <tr><td style="padding:6pt 8pt;"><b>โทรศัพท์</b></td><td style="padding:6pt 8pt;">${d.phone || ""}</td></tr>
          <tr><td style="padding:6pt 8pt;"><b>ประเภทคำร้อง</b></td><td style="padding:6pt 8pt;">${typeMap[d.request_type] || ""}</td></tr>
        </table>
        <div style="${S.lh}"><b>รายละเอียด:</b></div>
        <div style="${S.indent}white-space:pre-wrap;">${d.detail || ""}</div>
        <div style="${S.sig}">
          <div>ลงชื่อ .................................................... ผู้ยื่นคำร้อง</div>
          <div style="margin-top:4pt;">(${d.parent_name || d.student_name || "................................................"})</div>
        </div>
        <div style="border-top:1pt dashed #999;margin:20pt 0;"></div>
        <div style="${S.lh}"><b>ผลการพิจารณา:</b></div>
        <div style="${S.lh}">☐ อนุมัติ &nbsp;&nbsp;&nbsp; ☐ ไม่อนุมัติ &nbsp;&nbsp;&nbsp; หมายเหตุ ..................................................................</div>
        <div style="${S.sig}">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">(................................................)</div>
          <div style="margin-top:4pt;">ผู้อำนวยการ${school}</div>
        </div>
      `));
    },
  },
  // ===== 14. ใบสมัครเข้าเรียน =====
  {
    id: "enrollment_form",
    title: "ใบสมัครเข้าเรียน",
    description: "แบบฟอร์มรับสมัครนักเรียนใหม่",
    category: "student",
    fields: [
      { key: "academic_year", label: "ปีการศึกษา", type: "text", half: true },
      { key: "grade_apply", label: "สมัครเข้าชั้น", type: "text", half: true },
      { key: "prefix", label: "คำนำหน้า", type: "select", options: [
        { value: "ด.ช.", label: "ด.ช." },
        { value: "ด.ญ.", label: "ด.ญ." },
        { value: "นาย", label: "นาย" },
        { value: "นางสาว", label: "นางสาว" },
      ], half: true },
      { key: "student_name", label: "ชื่อ-สกุล", type: "text", required: true },
      { key: "nickname", label: "ชื่อเล่น", type: "text", half: true },
      { key: "dob", label: "วันเดือนปีเกิด", type: "date", half: true },
      { key: "national_id", label: "เลขบัตรประชาชน", type: "text" },
      { key: "religion", label: "ศาสนา", type: "text", half: true },
      { key: "nationality", label: "สัญชาติ", type: "text", half: true },
      { key: "previous_school", label: "จบจากโรงเรียน", type: "text" },
      { key: "father_name", label: "ชื่อบิดา", type: "text" },
      { key: "father_job", label: "อาชีพบิดา", type: "text", half: true },
      { key: "mother_name", label: "ชื่อมารดา", type: "text" },
      { key: "mother_job", label: "อาชีพมารดา", type: "text", half: true },
      { key: "guardian_name", label: "ชื่อผู้ปกครอง", type: "text" },
      { key: "guardian_phone", label: "โทรศัพท์ผู้ปกครอง", type: "text", half: true },
      { key: "address", label: "ที่อยู่ปัจจุบัน", type: "textarea" },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;font-size:22pt;font-weight:bold;margin-bottom:4pt;">ใบสมัครเข้าเรียน</div>
      <div style="text-align:center;${S.lh}">${school}</div>
      <div style="text-align:center;${S.lh}margin-bottom:8pt;">ปีการศึกษา ${d.academic_year || "......"} &nbsp;&nbsp; สมัครเข้าชั้น ${d.grade_apply || "......"}</div>
      <div style="border-top:1pt solid #000;margin:2pt 0 8pt;"></div>
      <div style="${S.lh}"><b>1. ข้อมูลนักเรียน</b></div>
      <table class="obec-table" style="font-size:15pt;">
        <tr><td style="width:30%;padding:4pt 8pt;">ชื่อ-สกุล</td><td style="padding:4pt 8pt;">${d.prefix || ""} ${d.student_name || ""} ${d.nickname ? `(${d.nickname})` : ""}</td></tr>
        <tr><td style="padding:4pt 8pt;">วันเกิด</td><td style="padding:4pt 8pt;">${d.dob ? thaiDate(new Date(d.dob)) : ""}</td></tr>
        <tr><td style="padding:4pt 8pt;">เลขบัตรประชาชน</td><td style="padding:4pt 8pt;">${d.national_id || ""}</td></tr>
        <tr><td style="padding:4pt 8pt;">ศาสนา / สัญชาติ</td><td style="padding:4pt 8pt;">${d.religion || ""} / ${d.nationality || "ไทย"}</td></tr>
        <tr><td style="padding:4pt 8pt;">จบจากโรงเรียน</td><td style="padding:4pt 8pt;">${d.previous_school || ""}</td></tr>
      </table>
      <div style="${S.lh}margin-top:8pt;"><b>2. ข้อมูลครอบครัว</b></div>
      <table class="obec-table" style="font-size:15pt;">
        <tr><td style="width:30%;padding:4pt 8pt;">ชื่อบิดา</td><td style="padding:4pt 8pt;">${d.father_name || ""} ${d.father_job ? `อาชีพ ${d.father_job}` : ""}</td></tr>
        <tr><td style="padding:4pt 8pt;">ชื่อมารดา</td><td style="padding:4pt 8pt;">${d.mother_name || ""} ${d.mother_job ? `อาชีพ ${d.mother_job}` : ""}</td></tr>
        <tr><td style="padding:4pt 8pt;">ผู้ปกครอง</td><td style="padding:4pt 8pt;">${d.guardian_name || ""} ${d.guardian_phone ? `โทร. ${d.guardian_phone}` : ""}</td></tr>
        <tr><td style="padding:4pt 8pt;">ที่อยู่ปัจจุบัน</td><td style="padding:4pt 8pt;">${d.address || ""}</td></tr>
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:36pt;${S.lh}">
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">ผู้สมัคร / ผู้ปกครอง</div>
        </div>
        <div style="text-align:center;">
          <div>ลงชื่อ ....................................................</div>
          <div style="margin-top:4pt;">ผู้รับสมัคร</div>
        </div>
      </div>
    `)),
  },
  // ===== แบบฟอร์มงบประมาณเพิ่ม =====
  // ===== 15. ใบสำคัญรับเงิน =====
  {
    id: "receipt_voucher",
    title: "ใบสำคัญรับเงิน",
    description: "แบบฟอร์มใบสำคัญรับเงินสำหรับเบิกจ่ายงบประมาณ",
    category: "budget",
    fields: [
      { key: "voucher_number", label: "เลขที่", type: "text", half: true },
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "receiver_name", label: "ผู้รับเงิน", type: "text", required: true },
      { key: "receiver_address", label: "ที่อยู่ผู้รับเงิน", type: "text" },
      { key: "items", label: "รายการ (แต่ละรายการขึ้นบรรทัดใหม่: รายการ | จำนวนเงิน)", type: "textarea", required: true, placeholder: "เช่น\nค่าวิทยากร | 3000\nค่าอาหาร | 2000" },
      { key: "total_text", label: "จำนวนเงินรวม (ตัวอักษร)", type: "text", placeholder: "เช่น ห้าพันบาทถ้วน" },
    ],
    render: (d, school) => {
      const lines = (d.items || "").split("\n").filter(Boolean);
      const parsedItems = lines.map(l => {
        const [desc, amt] = l.split("|").map(s => s.trim());
        return { desc: desc || "", amount: amt ? Number(amt) : 0 };
      });
      const total = parsedItems.reduce((s, i) => s + i.amount, 0);
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:22pt;font-weight:bold;margin-bottom:4pt;">ใบสำคัญรับเงิน</div>
        <div style="text-align:right;${S.lh}">เลขที่ ${d.voucher_number || "......"}</div>
        <div style="text-align:right;${S.lh}margin-bottom:6pt;">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
        <div style="${S.lh}">ได้รับเงินจาก ${school}</div>
        <div style="${S.lh}margin-bottom:8pt;">ชื่อผู้รับเงิน: ${d.receiver_name || "......"} ${d.receiver_address ? `ที่อยู่: ${d.receiver_address}` : ""}</div>
        <table class="obec-table" style="font-size:16pt;">
          <thead><tr><th style="width:50pt;">ลำดับ</th><th>รายการ</th><th style="width:120pt;text-align:right;">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>
            ${parsedItems.map((item, i) => `<tr><td class="center">${i + 1}</td><td>${item.desc}</td><td style="text-align:right;">${item.amount ? item.amount.toLocaleString() : ""}</td></tr>`).join("")}
            <tr style="font-weight:bold;"><td colspan="2" class="center">รวม</td><td style="text-align:right;">${total.toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div style="${S.lh}margin-top:4pt;">จำนวนเงิน (ตัวอักษร): ${d.total_text || `(${total.toLocaleString()} บาท)`}</div>
        <div style="display:flex;justify-content:space-between;margin-top:48pt;${S.lh}">
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">ผู้รับเงิน</div>
            <div style="margin-top:4pt;">(${d.receiver_name || "................................................"})</div>
          </div>
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">ผู้จ่ายเงิน</div>
          </div>
        </div>
      `));
    },
  },
  // ===== 16. ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ =====
  {
    id: "travel_expense",
    title: "ใบเบิกค่าเดินทาง",
    description: "แบบฟอร์มเบิกค่าใช้จ่ายในการเดินทางไปราชการ (แบบ 8708)",
    category: "budget",
    fields: [
      { key: "doc_date", label: "วันที่", type: "date", half: true },
      { key: "name", label: "ชื่อ-สกุลผู้เบิก", type: "text", required: true },
      { key: "position", label: "ตำแหน่ง", type: "text" },
      { key: "destination", label: "สถานที่ไปราชการ", type: "text", required: true },
      { key: "purpose", label: "เพื่อ", type: "text" },
      { key: "start_date", label: "ออกเดินทางวันที่", type: "date", half: true },
      { key: "end_date", label: "กลับถึงวันที่", type: "date", half: true },
      { key: "transport_cost", label: "ค่าพาหนะ (บาท)", type: "number", half: true },
      { key: "hotel_cost", label: "ค่าที่พัก (บาท)", type: "number", half: true },
      { key: "daily_cost", label: "ค่าเบี้ยเลี้ยง (บาท)", type: "number", half: true },
      { key: "other_cost", label: "ค่าใช้จ่ายอื่น (บาท)", type: "number", half: true },
      { key: "approver", label: "ผู้อนุมัติ", type: "text" },
    ],
    render: (d, school) => {
      const t = Number(d.transport_cost) || 0;
      const h = Number(d.hotel_cost) || 0;
      const da = Number(d.daily_cost) || 0;
      const o = Number(d.other_cost) || 0;
      const total = t + h + da + o;
      return replaceOrigin(docWrap(`
        <div style="text-align:center;font-size:20pt;font-weight:bold;margin-bottom:4pt;">ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ</div>
        <div style="text-align:center;${S.lh}margin-bottom:8pt;">${school}</div>
        <div style="text-align:right;${S.lh}">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
        <div style="${S.lh}">ข้าพเจ้า ${d.name || "......"} ตำแหน่ง ${d.position || "......"}</div>
        <div style="${S.lh}">ได้เดินทางไปราชการ ณ ${d.destination || "......"} ${d.purpose ? `เพื่อ ${d.purpose}` : ""}</div>
        <div style="${S.lh}margin-bottom:8pt;">ตั้งแต่วันที่ ${d.start_date ? thaiDate(new Date(d.start_date)) : "......"} ถึงวันที่ ${d.end_date ? thaiDate(new Date(d.end_date)) : "......"}</div>
        <table class="obec-table" style="font-size:16pt;">
          <thead><tr><th>รายการ</th><th style="width:150pt;text-align:right;">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>
            <tr><td style="padding:4pt 8pt;">1. ค่าพาหนะ</td><td style="text-align:right;padding:4pt 8pt;">${t ? t.toLocaleString() : ""}</td></tr>
            <tr><td style="padding:4pt 8pt;">2. ค่าที่พัก</td><td style="text-align:right;padding:4pt 8pt;">${h ? h.toLocaleString() : ""}</td></tr>
            <tr><td style="padding:4pt 8pt;">3. ค่าเบี้ยเลี้ยง</td><td style="text-align:right;padding:4pt 8pt;">${da ? da.toLocaleString() : ""}</td></tr>
            <tr><td style="padding:4pt 8pt;">4. ค่าใช้จ่ายอื่น</td><td style="text-align:right;padding:4pt 8pt;">${o ? o.toLocaleString() : ""}</td></tr>
            <tr style="font-weight:bold;"><td class="center" style="padding:6pt 8pt;">รวมทั้งสิ้น</td><td style="text-align:right;padding:6pt 8pt;">${total.toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:36pt;${S.lh}">
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">(${d.name || "................................................"})</div>
            <div style="margin-top:4pt;">ผู้ขอเบิก</div>
          </div>
          <div style="text-align:center;">
            <div>ลงชื่อ ....................................................</div>
            <div style="margin-top:4pt;">(${d.approver || "................................................"})</div>
            <div style="margin-top:4pt;">ผู้อนุมัติ</div>
          </div>
        </div>
      `));
    },
  },
  // ===== 17. ใบขอใช้รถยนต์ราชการ =====
  {
    id: "vehicle_request",
    title: "ใบขอใช้รถยนต์ราชการ",
    description: "แบบขอใช้รถยนต์ส่วนกลาง/ราชการ",
    category: "budget",
    fields: [
      { key: "doc_date", label: "วันที่ขอ", type: "date", half: true },
      { key: "requester", label: "ผู้ขอใช้", type: "text", required: true },
      { key: "department", label: "ฝ่าย/กลุ่มงาน", type: "text" },
      { key: "destination", label: "สถานที่ปลายทาง", type: "text", required: true },
      { key: "purpose", label: "วัตถุประสงค์", type: "text", required: true },
      { key: "depart_date", label: "วันที่ออก", type: "date", half: true },
      { key: "depart_time", label: "เวลาออก", type: "text", placeholder: "08.00 น.", half: true },
      { key: "return_date", label: "วันที่กลับ", type: "date", half: true },
      { key: "return_time", label: "เวลากลับ", type: "text", placeholder: "17.00 น.", half: true },
      { key: "num_passengers", label: "จำนวนผู้โดยสาร (คน)", type: "number", half: true },
    ],
    render: (d, school) => replaceOrigin(docWrap(`
      <div style="text-align:center;font-size:22pt;font-weight:bold;margin-bottom:4pt;">ใบขอใช้รถยนต์ราชการ</div>
      <div style="text-align:center;${S.lh}margin-bottom:8pt;">${school}</div>
      <div style="text-align:right;${S.lh}">วันที่ ${d.doc_date ? thaiDate(new Date(d.doc_date)) : thaiDate(today)}</div>
      <div style="${S.lh}"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการ${school}</div>
      <table class="obec-table" style="margin:12pt 0;font-size:16pt;">
        <tr><td style="width:35%;padding:6pt 8pt;"><b>ผู้ขอใช้</b></td><td style="padding:6pt 8pt;">${d.requester || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>ฝ่าย</b></td><td style="padding:6pt 8pt;">${d.department || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>สถานที่ปลายทาง</b></td><td style="padding:6pt 8pt;">${d.destination || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>วัตถุประสงค์</b></td><td style="padding:6pt 8pt;">${d.purpose || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>วันเวลาออก</b></td><td style="padding:6pt 8pt;">${d.depart_date ? thaiDate(new Date(d.depart_date)) : ""} ${d.depart_time || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>วันเวลากลับ</b></td><td style="padding:6pt 8pt;">${d.return_date ? thaiDate(new Date(d.return_date)) : ""} ${d.return_time || ""}</td></tr>
        <tr><td style="padding:6pt 8pt;"><b>จำนวนผู้โดยสาร</b></td><td style="padding:6pt 8pt;">${d.num_passengers || "......"} คน</td></tr>
      </table>
      <div style="${S.sig}">
        <div>ลงชื่อ .................................................... ผู้ขอใช้</div>
        <div style="margin-top:4pt;">(${d.requester || "................................................"})</div>
      </div>
      <div style="border-top:1pt dashed #999;margin:20pt 0;"></div>
      <div style="${S.lh}"><b>ความเห็น</b></div>
      <div style="${S.lh}">☐ อนุมัติ &nbsp;&nbsp; ทะเบียนรถ ............................ &nbsp;&nbsp; พนักงานขับรถ ............................</div>
      <div style="${S.lh}">☐ ไม่อนุมัติ เนื่องจาก ..................................................................</div>
      <div style="${S.sig}">
        <div>ลงชื่อ .................................................... ผู้อนุมัติ</div>
        <div style="margin-top:4pt;">(................................................)</div>
      </div>
    `)),
  },
];

// ============ Main Component ============

const categoryConfig = {
  official: { label: "หนังสือราชการ", icon: Building2, color: "text-info" },
  personnel: { label: "แบบฟอร์มบุคลากร", icon: Users, color: "text-success" },
  student: { label: "แบบฟอร์มนักเรียน", icon: GraduationCap, color: "text-info" },
  budget: { label: "แบบฟอร์มงบประมาณ", icon: DollarSign, color: "text-warning" },
};

const EFormPage = () => {
  const { lang } = useLanguage();
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // โหลดเทมเพลตที่ admin แก้ไขไว้ (ถ้ามี) — ใช้ตัวเดียวกันทั้ง ดูตัวอย่าง / แก้ไขฟอร์ม / พิมพ์ / ส่ง
  const { data: savedTemplate } = useQuery({
    queryKey: ["form_template", selectedTemplate?.id],
    enabled: !!selectedTemplate,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("form_templates").select("content_html")
        .eq("code", `eform_${selectedTemplate!.id}`).maybeSingle();
      return data?.content_html as string | undefined;
    },
  });

  const { data: cmsSettings = {} } = useQuery({
    queryKey: ["cms_settings_eform"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cms_settings")
        .select("key, value")
        .in("key", [
          "school_name",
          "school_address",
          "school_phone",
          "school_email",
          "director_name",
          "director_title",
        ]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value || ""; });
      return map;
    },
  });

  const schoolName = (cmsSettings as any).school_name || "โรงเรียน...";
  const schoolAddress = (cmsSettings as any).school_address || "";
  const directorName = (cmsSettings as any).director_name || "";
  const directorTitle = (cmsSettings as any).director_title || "ผู้อำนวยการโรงเรียน";
  // ที่อยู่ราชการต้องเป็น 3 บรรทัด ด้านขวาของหนังสือภายนอก
  // บรรทัด 1: ชื่อโรงเรียน, บรรทัด 2-3: ที่อยู่ (แยกตาม \n หรือ ",")
  const addrParts = (schoolAddress || "")
    .split(/\r?\n|,/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  const line2 = addrParts[0] || "";
  const line3 = addrParts.slice(1).join(" ") || "";
  const schoolAddressLine = [schoolName, line2, line3].filter(Boolean).join("\n");

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Auto-prefill ข้อมูลโรงเรียน/ผอ. จาก CMS
  const autoFillKeys: Record<string, string> = {
    school_address_line: schoolAddressLine,
    department: schoolName,
    signer_name: directorName,
    signer_position: directorTitle,
  };

  const handleSelectTemplate = (tmpl: FormTemplate) => {
    setSelectedTemplate(tmpl);
    const initial: Record<string, string> = {};
    tmpl.fields.forEach((f: any) => {
      const v = autoFillKeys[f.key];
      if (v) initial[f.key] = v;
    });
    setFormData(initial);
  };

  // รวมแหล่ง HTML: ใช้ template ที่ admin บันทึกไว้ (substitute {{key}}) ก่อน, ไม่งั้นใช้ render เริ่มต้น
  // ห่อด้วย .obec-a4-page ทุกครั้ง เพื่อให้ preview / print / ส่งในระบบ ใช้สไตล์ A4 + ฟอนต์ TH Sarabun เดียวกัน
  const buildHtml = (): string => {
    if (!selectedTemplate) return "";
    const garudaUrl = (cmsSettings as any).garuda_emblem || "";
    if (savedTemplate && savedTemplate.trim()) {
      const merged = savedTemplate.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_m, k) => (formData[k] ?? ""));
      const wrapped = /class="[^"]*obec-a4-page/.test(merged) ? merged : docWrap(merged);
      return replaceOrigin(wrapped, garudaUrl);
    }
    return replaceOrigin(selectedTemplate.render(formData, schoolName), garudaUrl);
  };

  const handlePrint = () => {
    const html = buildHtml();
    if (!html) return;
    openPrintWindow(html, { title: selectedTemplate?.title || "เอกสาร" });
  };

  const renderPreview = () => {
    if (!selectedTemplate) return null;
    return { __html: DOMPurify.sanitize(buildHtml(), { ADD_ATTR: ["target"] }) };
  };

  if (selectedTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplate(null); setFormData({}); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{selectedTemplate.title}</h1>
            <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">กรอกข้อมูล</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTemplate.fields.map((field, idx) => {
                const isHalf = field.half;
                const nextField = selectedTemplate.fields[idx + 1];
                const prevField = idx > 0 ? selectedTemplate.fields[idx - 1] : null;

                if (prevField?.half && isHalf) return null;

                if (isHalf && nextField?.half) {
                  return (
                    <div key={field.key} className="grid grid-cols-2 gap-3">
                      {[field, nextField].map(f => (
                        <div key={f.key}>
                          <Label className="text-xs">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                          {f.type === "select" ? (
                            <Select value={formData[f.key] || ""} onValueChange={v => handleFieldChange(f.key, v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือก..." /></SelectTrigger>
                              <SelectContent>
                                {f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={formData[f.key] || ""} onChange={e => handleFieldChange(f.key, e.target.value)} placeholder={f.placeholder} className="h-8 text-sm" />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={field.key}>
                    <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
                    {field.type === "textarea" ? (
                      <Textarea value={formData[field.key] || ""} onChange={e => handleFieldChange(field.key, e.target.value)} placeholder={field.placeholder} className="min-h-[80px] text-sm" />
                    ) : field.type === "select" ? (
                      <Select value={formData[field.key] || ""} onValueChange={v => handleFieldChange(field.key, v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือก..." /></SelectTrigger>
                        <SelectContent>
                          {field.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={formData[field.key] || ""} onChange={e => handleFieldChange(field.key, e.target.value)} placeholder={field.placeholder} className="h-8 text-sm" />
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => setPreviewOpen(true)} variant="outline" className="flex-1 min-w-[100px]">
                  <FileText className="w-4 h-4 mr-1" /> ดูตัวอย่าง
                </Button>
                <FormTemplateButton
                  code={`eform_${selectedTemplate.id}`}
                  title={`แก้ไขฟอร์ม: ${selectedTemplate.title}`}
                  defaultHtml={buildHtml()}
                  label="แก้ไขฟอร์ม"
                  className="flex-1 min-w-[100px]"
                />
                <Button onClick={handlePrint} variant="outline" className="flex-1 min-w-[100px]">
                  <Printer className="w-4 h-4 mr-1" /> พิมพ์ A4
                </Button>
                <Button onClick={() => setSendOpen(true)} className="flex-1 min-w-[100px]">
                  <Send className="w-4 h-4 mr-1" /> ส่งในระบบ
                </Button>
              </div>
            </CardContent>
          </Card>

          <SendEFormDialog
            open={sendOpen}
            onOpenChange={setSendOpen}
            title={selectedTemplate.title}
            contentHtml={buildHtml()}
            templateId={selectedTemplate.id}
            category={selectedTemplate.category}
            formData={formData}
            urgency={formData.urgency}
          />

          {/* Live A4 Preview */}
          <Card className="hidden lg:block">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                ตัวอย่างเอกสาร
                <Badge variant="outline" className="text-[10px]">A4</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="mx-auto border border-border shadow-sm overflow-hidden bg-white text-black"
                style={{
                  width: "100%",
                  maxWidth: "420px",
                  aspectRatio: "210 / 297",
                  padding: "16px 16px 12px 24px",
                  fontFamily: "'TH Sarabun New', 'TH SarabunIT๙', 'Sarabun', sans-serif",
                  fontSize: "16pt",
                  lineHeight: 1.5,
                  position: "relative",
                }}
              >
                <div
                  style={{ transform: "scale(0.42)", transformOrigin: "top left", width: "238%" }}
                  dangerouslySetInnerHTML={renderPreview() || { __html: "" }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-3 p-4">
            <DialogHeader>
              <DialogTitle>ตัวอย่างเอกสาร - {selectedTemplate.title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border border-border bg-white text-black rounded-md">
              <div
                style={{
                  padding: "12px",
                  fontFamily: "'TH Sarabun New', 'TH SarabunIT๙', 'Sarabun', sans-serif",
                  fontSize: "10pt",
                  lineHeight: 1.5,
                  zoom: 0.55,
                }}
                dangerouslySetInnerHTML={renderPreview() || { __html: "" }}
              />
            </div>
            <Button onClick={handlePrint} className="w-full shrink-0">
              <Printer className="w-4 h-4 mr-2" /> พิมพ์ A4
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== Template Selection View =====
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">E-Form ออกเอกสาร</h1>
          <p className="text-sm text-muted-foreground">ระบบออกเอกสารราชการ มาตรฐาน สพฐ. กระดาษ A4 ฟอนต์ TH Sarabun New 16pt</p>
        </div>
        <FormTemplateButton code="eform" title="E-Form — เทมเพลตเอกสารราชการ" />
      </div>

      <Tabs defaultValue="official">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          {(Object.entries(categoryConfig) as [keyof typeof categoryConfig, typeof categoryConfig[keyof typeof categoryConfig]][]).map(([key, cfg]) => (
            <TabsTrigger key={key} value={key} className="text-xs gap-1">
              <cfg.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{cfg.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(categoryConfig) as (keyof typeof categoryConfig)[]).map(cat => {
          const templates = formTemplates.filter(t => t.category === cat);
          const cfg = categoryConfig[cat];
          return (
            <TabsContent key={cat} value={cat}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(tmpl => (
                  <Card key={tmpl.id} className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50" onClick={() => handleSelectTemplate(tmpl)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${cfg.color}`}>
                          <cfg.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground">{tmpl.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{tmpl.description}</p>
                          <Badge variant="outline" className="text-[10px] mt-2">{cfg.label}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default EFormPage;
