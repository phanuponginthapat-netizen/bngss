/**
 * สร้าง "เล่ม ปพ.5 / ปพ.6" เป็น PDF จากศูนย์ (ไม่ใช้ไฟล์เทมเพลตที่ผู้ใช้อัปโหลด)
 * ใช้ jsPDF + autoTable + ฟอนต์ TH Sarabun New
 *
 * คงชื่อฟังก์ชันเดิม (exportPP5Book / exportPP6Book) เพื่อไม่ต้องแก้หน้าเรียกใช้
 * แต่ตอนนี้คืนผลเป็น .pdf ที่พร้อมพิมพ์เป็นเล่มทันที
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/lib/jspdfThai";
import { getSigners } from "@/lib/signerMap";

export type SchoolHeader = {
  school_name?: string;
  affiliation?: string;
  tambon?: string;
  amphoe?: string;
  province?: string;
  director_name?: string;
  director_title?: string;
  academic_head_name?: string;
  academic_head_title?: string;
  school_logo?: string;
  garuda_emblem?: string;
};

export type PP5Input = {
  school: SchoolHeader;
  level: string;
  semester: number | string;
  academic_year: number | string;
  grade_level: string;
  subject_group: string;
  subject_name: string;
  subject_code: string;
  hours_per_week?: number | string;
  homeroom_teacher?: string;
  teacher_name: string;
  teacher_title?: string;
  subject_head_name?: string;
  subject_head_title?: string;
  measurement_head?: string;
  measurement_head_title?: string;
  approval_day?: number | string;
  approval_month?: string;
  approval_year_be?: number | string;
  students: Array<{
    no: number;
    student_code: string;
    citizen_id?: string;
    full_name: string;
  }>;
  /** ช่องคะแนนจริงตามที่ตั้งไว้ในระบบ (เรียงตาม sort_order) */
  score_columns?: Array<{
    column_name: string;
    max_score?: number | string;
    column_type?: "assignment" | "midterm" | "final" | string;
  }>;
  /** คะแนนรายช่อง + รวม + เกรด อิงจาก student_code */
  student_scores?: Record<string, {
    values: Array<number | string | null | undefined>;
    during?: number | string;
    final?: number | string;
    total?: number | string;
    grade?: string;
  }>;
  /** บันทึกเวลาเรียน — รายวัน (YYYY-MM-DD) + สถานะต่อนักเรียน
   *  status: "" ว่าง, "/" มา, "ล" ลา, "ป" ป่วย, "ข" ขาด, "ส" สาย */
  attendance?: {
    dates: string[]; // ISO date strings เรียงตามวันที่
    marks: Record<string, string[]>; // key = student_code, ค่าตามดัชนีเดียวกับ dates
  };

};

export type PP6Input = {
  school: SchoolHeader;
  director_name?: string;
  director_title?: string;
  academic_head_name?: string;
  academic_head_position?: string;
  homeroom_teacher: string;
  homeroom_teacher_position?: string;
  semester: number | string;
  academic_year: number | string;
  grade_level: string;
  education_level: string;
  approval_day?: number | string;
  approval_month?: string;
  approval_year_be?: number | string;
  students: Array<{ no: number; student_code: string; full_name: string }>;
  subjects?: Array<{
    type: "พื้นฐาน" | "เพิ่มเติม";
    short_name: string;
    code: string;
    full_name: string;
    weight: number | string;
    hours_per_year?: number | string;
  }>;
};

// ---------- shared helpers ----------
const THAI_DIGITS = ["๐","๑","๒","๓","๔","๕","๖","๗","๘","๙"];
export function toThaiDigits(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (d) => THAI_DIGITS[Number(d)]);
}
function mapThai(arg: any): any {
  if (typeof arg === "string") return toThaiDigits(arg);
  if (Array.isArray(arg)) return arg.map(mapThai);
  return arg;
}
async function newDoc() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerThaiFont(doc);
  doc.setFont("THSarabunNew", "normal");
  // แปลงเลขอารบิก -> เลขไทย อัตโนมัติทุกครั้งที่วาดข้อความ
  const origText = doc.text.bind(doc);
  (doc as any).text = (text: any, x: number, y: number, options?: any) =>
    origText(mapThai(text), x, y, options);
  return doc;
}

/** โหลดรูปเป็น data URL เพื่อฝังลง PDF — รวม composite พื้นหลังขาว ป้องกัน PNG โปร่งใสกลายเป็นพื้นดำใน jsPDF */
async function loadImageDataUrl(src?: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  if (!src) return null;
  try {
    // โหลดเป็น HTMLImageElement แล้ววาดบน canvas พื้นขาว แปลงเป็น JPEG
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 256;
    canvas.height = img.naturalHeight || img.height || 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.95), format: "JPEG" };
  } catch { return null; }
}


function center(doc: jsPDF, text: string, y: number, size = 16, bold = false) {
  doc.setFont("THSarabunNew", bold ? "bold" : "normal");
  doc.setFontSize(size);
  const w = doc.internal.pageSize.getWidth();
  doc.text(text, w / 2, y, { align: "center" });
}

function line(doc: jsPDF, label: string, value: string, x: number, y: number, size = 14, maxWidth = 75) {
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(size);
  doc.text(label, x, y);
  doc.setFont("THSarabunNew", "normal");
  const labelW = doc.getTextWidth(label) + 2;
  const valueX = x + labelW;
  const wrapped = doc.splitTextToSize(value || "—", Math.max(20, maxWidth - labelW));
  doc.text(wrapped, valueX, y);
  // คืนความสูงที่ใช้จริง (mm) สำหรับ caller ที่ต้องการเลื่อน y
  const lineHeight = size * 0.42;
  return Array.isArray(wrapped) ? wrapped.length * lineHeight : lineHeight;
}

async function coverBlock(
  doc: jsPDF,
  opts: {
    docTitle: string;
    subTitle?: string;
    school: SchoolHeader;
    metaLeft: Array<[string, string]>;
    metaRight?: Array<[string, string]>;
  }
) {
  const W = doc.internal.pageSize.getWidth();
  // กรอบ
  doc.setLineWidth(0.6);
  doc.rect(15, 15, W - 30, 267);

  // โลโก้โรงเรียน (จาก CMS) ตรงกลางส่วนบน — fallback เป็นข้อความ "ตราโรงเรียน"
  const logo = await loadImageDataUrl(opts.school.school_logo);
  if (logo) {
    const size = 32;
    try {
      doc.addImage(logo.dataUrl, logo.format, (W - size) / 2, 22, size, size);
    } catch {
      center(doc, "ตราโรงเรียน", 35, 12);
    }
  } else {
    center(doc, "ตราโรงเรียน", 35, 12);
  }

  center(doc, opts.docTitle, 72, 32, true);
  if (opts.subTitle) center(doc, opts.subTitle, 87, 18);

  // ชื่อโรงเรียน: ตัดบรรทัดอัตโนมัติให้พอดีกรอบ
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(22);
  const schoolName = opts.school.school_name || "";
  const schoolLines = doc.splitTextToSize(schoolName, W - 50);
  doc.text(schoolLines, W / 2, 105, { align: "center" });

  const affLine = [opts.school.affiliation, opts.school.tambon, opts.school.amphoe, opts.school.province]
    .filter(Boolean).join(" · ");
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(14);
  const affWrapped = doc.splitTextToSize(affLine, W - 50);
  doc.text(affWrapped, W / 2, 105 + schoolLines.length * 9, { align: "center" });

  // คอลัมน์ซ้าย/ขวา กว้างคงที่ ป้องกันข้อความล้น
  const leftX = 22;
  const rightX = W / 2 + 5;
  const colW = W / 2 - 30;
  let y = 150;
  opts.metaLeft.forEach(([k, v]) => {
    const h = line(doc, k, v, leftX, y, 14, colW);
    y += Math.max(8, h + 2);
  });
  if (opts.metaRight) {
    let yr = 150;
    opts.metaRight.forEach(([k, v]) => {
      const h = line(doc, k, v, rightX, yr, 14, colW);
      yr += Math.max(8, h + 2);
    });
  }

  // ตราครุฑเล็กด้านล่าง (จาก CMS) ถ้ามี
  const garuda = await loadImageDataUrl(opts.school.garuda_emblem);
  if (garuda) {
    const gs = 18;
    try {
      doc.addImage(garuda.dataUrl, garuda.format, (W - gs) / 2, 240, gs, gs);
    } catch {}
  }

  center(doc, `สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน  กระทรวงศึกษาธิการ`, 273, 13);
}

function signatureBlock(doc: jsPDF, y: number, rows: Array<{ role: string; name?: string; title?: string }>) {
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 30) / rows.length;
  rows.forEach((r, i) => {
    const cx = 15 + colW * i + colW / 2;
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(14);
    doc.text("ลงชื่อ ............................................................", cx, y, { align: "center" });
    doc.text(`( ${r.name || " " } )`, cx, y + 8, { align: "center" });
    doc.text(r.role, cx, y + 16, { align: "center" });
    if (r.title) doc.text(r.title, cx, y + 23, { align: "center" });
  });
}

function save(doc: jsPDF, filename: string) {
  doc.save(filename);
}

// ============================================================
// ปพ.5 — สมุดบันทึกผลการเรียนรู้ (รายวิชา)
// ============================================================
export async function exportPP5Book(data: PP5Input, filename?: string) {
  const doc = await newDoc();

  // ---- หน้าปก ----
  await coverBlock(doc, {
    docTitle: "ปพ.๕",
    subTitle: "แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (รายวิชา)",
    school: data.school,
    metaLeft: [
      ["รหัสวิชา : ", String(data.subject_code || "")],
      ["รายวิชา : ", String(data.subject_name || "")],
      ["กลุ่มสาระฯ : ", String(data.subject_group || "")],
      ["ระดับชั้น : ", String(data.grade_level || "")],
      ["จำนวน นร. : ", `${data.students.length} คน`],
    ],
    metaRight: [
      ["ภาคเรียนที่ : ", String(data.semester ?? "")],
      ["ปีการศึกษา : ", String(data.academic_year ?? "")],
      ["ชั่วโมง/สัปดาห์ : ", String(data.hours_per_week ?? "")],
      ["ครูผู้สอน : ", data.teacher_name || ""],
      ["ระดับการศึกษา : ", String(data.level || "")],
    ],
  });

  // ---- หน้า "ข้อมูลพื้นฐาน" ----
  doc.addPage();
  center(doc, "ข้อมูลพื้นฐานของรายวิชา", 22, 20, true);
  let y = 38;
  const meta: Array<[string, string]> = [
    ["โรงเรียน", data.school.school_name || ""],
    ["สังกัด", data.school.affiliation || ""],
    ["ระดับการศึกษา", String(data.level || "")],
    ["ระดับชั้น", data.grade_level],
    ["กลุ่มสาระการเรียนรู้", data.subject_group],
    ["รหัสวิชา / ชื่อวิชา", `${data.subject_code}  ${data.subject_name}`],
    ["จำนวนชั่วโมง/สัปดาห์", String(data.hours_per_week ?? "")],
    ["ภาคเรียน / ปีการศึกษา", `${data.semester} / ${data.academic_year}`],
    ["ครูผู้สอน", `${data.teacher_name}${data.teacher_title ? "  (" + data.teacher_title + ")" : ""}`],
    ["ครูที่ปรึกษา", data.homeroom_teacher || "—"],
  ];
  const W = doc.internal.pageSize.getWidth();
  meta.forEach(([k, v]) => {
    const h = line(doc, `${k} :`, v, 20, y, 16, W - 40);
    y += Math.max(9, h + 3);
  });

  // ---- หน้า "รายชื่อนักเรียน" ----
  doc.addPage();
  center(doc, `รายชื่อนักเรียน — ${data.grade_level}`, 18, 18, true);
  center(doc, `${data.subject_code}  ${data.subject_name}    ภาคเรียนที่ ${data.semester}/${data.academic_year}`, 26, 13);

  autoTable(doc, {
    startY: 32,
    margin: { left: 15, right: 15 },
    head: [["ที่", "รหัสนักเรียน", "เลขประจำตัวประชาชน", "ชื่อ-สกุล"]],
    body: data.students.map((s, i) => [
      String(s.no || i + 1),
      s.student_code || "",
      s.citizen_id || "",
      s.full_name || "",
    ]),
    styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 1.5, lineColor: [80, 80, 80], lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "center", cellWidth: 40 },
      3: { halign: "left" },
    },
    didDrawPage: (data) => {
      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(10);
      doc.text(`หน้า ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 15, 290, { align: "right" });
    },
  });

  // ---- ตารางบันทึกคะแนน (ใช้ช่องคะแนนจริงจากระบบ) ----
  doc.addPage("a4", "landscape");
  center(doc, "แบบบันทึกผลคะแนนระหว่างเรียน / ปลายภาค", 14, 18, true);
  center(doc, `${data.subject_code}  ${data.subject_name}    ภาคเรียนที่ ${data.semester}/${data.academic_year}    ${data.grade_level}    จำนวน ${data.students.length} คน`, 21, 12);

  const cols = data.score_columns || [];
  const colHeaders = cols.length
    ? cols.map((c) => `${c.column_name}${c.max_score ? `\n(${c.max_score})` : ""}`)
    : Array.from({ length: 10 }, (_, i) => `ครั้งที่ ${i + 1}`);

  const scoreHead = [["ที่", "รหัส", "ชื่อ-สกุล", ...colHeaders, "ระหว่างเรียน", "ปลายภาค", "รวม", "เกรด"]];
  const scoreBody = data.students.map((s, i) => {
    const sc = data.student_scores?.[s.student_code];
    const vals = sc?.values || [];
    const cells = colHeaders.map((_, ci) => {
      const v = vals[ci];
      return v === null || v === undefined || v === "" ? "" : String(v);
    });
    return [
      String(s.no || i + 1),
      s.student_code || "",
      s.full_name || "",
      ...cells,
      sc?.during !== undefined && sc?.during !== "" ? String(sc.during) : "",
      sc?.final !== undefined && sc?.final !== "" ? String(sc.final) : "",
      sc?.total !== undefined && sc?.total !== "" ? String(sc.total) : "",
      sc?.grade || "",
    ];
  });
  autoTable(doc, {
    startY: 28,
    margin: { left: 8, right: 8 },
    head: scoreHead,
    body: scoreBody,
    styles: { font: "THSarabunNew", fontSize: 9, cellPadding: 1, lineColor: [80, 80, 80], lineWidth: 0.1, halign: "center" },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", halign: "center", valign: "middle" },
    columnStyles: { 0: { halign: "center", cellWidth: 8 }, 1: { halign: "center", cellWidth: 16 }, 2: { halign: "left", cellWidth: 48 } },
    didDrawPage: () => {
      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(10);
      doc.text(`หน้า ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 12, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    },
  });

  // ---- หน้าบันทึกเวลาเรียน (เดือนเป็นกลุ่มหัวตาราง, วันเป็นคอลัมน์) ----
  const att = data.attendance;
  if (att && att.dates && att.dates.length) {
    const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    // จัดกลุ่มวันที่ตามเดือน (เรียงตามวันที่)
    const sorted = [...att.dates].sort();
    const groups: { label: string; days: { iso: string; day: number }[] }[] = [];
    sorted.forEach((iso) => {
      const dt = new Date(iso);
      const label = `${THAI_MONTHS[dt.getMonth()]} ${dt.getFullYear() + 543}`;
      const last = groups[groups.length - 1];
      const day = dt.getDate();
      if (last && last.label === label) last.days.push({ iso, day });
      else groups.push({ label, days: [{ iso, day }] });
    });

    // แบ่งหน้า — สูงสุด ~24 คอลัมน์วันต่อหน้า เพื่อให้พอดี A4 แนวนอน
    const MAX_DAYS_PER_PAGE = 24;
    type Chunk = { label: string; days: { iso: string; day: number }[] }[];
    const pages: Chunk[] = [];
    let curr: Chunk = [];
    let count = 0;
    groups.forEach((g) => {
      let remaining = [...g.days];
      while (remaining.length) {
        const room = MAX_DAYS_PER_PAGE - count;
        const take = remaining.slice(0, room);
        curr.push({ label: g.label, days: take });
        count += take.length;
        remaining = remaining.slice(take.length);
        if (count >= MAX_DAYS_PER_PAGE) { pages.push(curr); curr = []; count = 0; }
      }
    });
    if (curr.length) pages.push(curr);

    pages.forEach((pg, pi) => {
      doc.addPage("a4", "landscape");
      center(doc, "แบบบันทึกเวลาเรียน", 12, 18, true);
      center(doc, `${data.subject_code}  ${data.subject_name}    ${data.grade_level}    ภาคเรียนที่ ${data.semester}/${data.academic_year}    (หน้า ${pi + 1}/${pages.length})`, 19, 12);
      // สร้างหัวตาราง 2 แถว: เดือน (colSpan ตามจำนวนวัน) / วัน
      const monthRow: any[] = [
        { content: "ที่", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "รหัส", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "ชื่อ-สกุล", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ];
      const dayRow: any[] = [];
      const flatDays: { iso: string }[] = [];
      pg.forEach((g) => {
        monthRow.push({ content: g.label, colSpan: g.days.length, styles: { halign: "center" } });
        g.days.forEach((d) => { dayRow.push(String(d.day)); flatDays.push({ iso: d.iso }); });
      });
      monthRow.push({ content: "มา", rowSpan: 2, styles: { halign: "center", valign: "middle" } });
      monthRow.push({ content: "ลา", rowSpan: 2, styles: { halign: "center", valign: "middle" } });
      monthRow.push({ content: "ป่วย", rowSpan: 2, styles: { halign: "center", valign: "middle" } });
      monthRow.push({ content: "ขาด", rowSpan: 2, styles: { halign: "center", valign: "middle" } });

      const body = data.students.map((s, i) => {
        const arr = att.marks[s.student_code] || [];
        const cells = flatDays.map((d) => {
          const idx = sorted.indexOf(d.iso);
          return idx >= 0 ? (arr[idx] || "") : "";
        });
        let nMa = 0, nLa = 0, nPuay = 0, nKhad = 0;
        cells.forEach((v) => {
          if (v === "/" || v === "✓") nMa++;
          else if (v === "ล") nLa++;
          else if (v === "ป") nPuay++;
          else if (v === "ข" || v === "ส") nKhad++;
        });
        return [String(s.no || i + 1), s.student_code || "", s.full_name || "", ...cells, String(nMa), String(nLa), String(nPuay), String(nKhad)];
      });

      autoTable(doc, {
        startY: 25,
        margin: { left: 6, right: 6 },
        head: [monthRow, dayRow],
        body,
        styles: { font: "THSarabunNew", fontSize: 8, cellPadding: 0.6, lineColor: [80, 80, 80], lineWidth: 0.1, halign: "center" },
        headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", halign: "center", valign: "middle" },
        columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 14 }, 2: { halign: "left", cellWidth: 44 } },
        didDrawPage: () => {
          doc.setFont("THSarabunNew", "normal");
          doc.setFontSize(9);
          doc.text("สัญลักษณ์:  / = มา   ล = ลา   ป = ป่วย   ข = ขาด", 6, doc.internal.pageSize.getHeight() - 6);
        },
      });
    });
  }



  // ---- หน้าลงนามอนุมัติ ----
  doc.addPage();
  center(doc, "หน้าลงนามอนุมัติ ปพ.๕", 25, 20, true);
  center(doc,
    `ภาคเรียนที่ ${data.semester}  ปีการศึกษา ${data.academic_year}  รหัสวิชา ${data.subject_code}  ${data.subject_name}`,
    35, 14);
  center(doc, `วันที่ ${data.approval_day ?? "....."}  เดือน ${data.approval_month ?? "................"}  พ.ศ. ${data.approval_year_be ?? "....."}`, 50, 14);

  // ดึงผู้ลงนามจาก "การตั้งค่า > ลายเซ็นผู้บริหาร" (admin)
  const sigs = await getSigners([
    "subject_group_head", "measurement_head", "academic_head",
    "deputy_academic", "deputy_personnel", "deputy_general", "deputy_budget",
    "director",
  ]);

  signatureBlock(doc, 80, [
    { role: "ครูผู้สอน", name: data.teacher_name, title: data.teacher_title || "" },
    { role: "หัวหน้ากลุ่มสาระฯ", name: data.subject_head_name || sigs.subject_group_head?.name || "", title: data.subject_head_title || sigs.subject_group_head?.position || "" },
  ]);
  signatureBlock(doc, 130, [
    { role: "หัวหน้างานวัดและประเมินผล", name: data.measurement_head || sigs.measurement_head?.name || "", title: data.measurement_head_title || sigs.measurement_head?.position || "" },
    { role: "หัวหน้างานวิชาการ", name: data.school.academic_head_name || sigs.academic_head?.name || "", title: data.school.academic_head_title || sigs.academic_head?.position || "" },
  ]);
  // รอง ผอ. ทุกฝ่ายที่ตั้งค่าไว้ (วิชาการ / บุคคล / ทั่วไป / งบประมาณ)
  const deputies = [sigs.deputy_academic, sigs.deputy_personnel, sigs.deputy_general, sigs.deputy_budget]
    .filter(Boolean) as { name: string; position: string }[];
  if (deputies.length) {
    signatureBlock(doc, 180, deputies.map((d) => ({ role: d.position, name: d.name })));
  }
  signatureBlock(doc, 230, [
    { role: data.school.director_title || "ผู้อำนวยการ", name: sigs.director?.name || data.school.director_name || "", title: data.school.school_name || "" },
  ]);

  save(doc, filename || `ปพ.5_${data.subject_code || data.subject_name}_${data.grade_level}_${data.academic_year}.pdf`);
}

// ============================================================
// ปพ.6 — สมุดรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ระดับชั้น)
// ============================================================
export async function exportPP6Book(data: PP6Input, filename?: string) {
  const doc = await newDoc();

  await coverBlock(doc, {
    docTitle: "ปพ.๖",
    subTitle: "แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล",
    school: data.school,
    metaLeft: [
      ["ระดับการศึกษา : ", data.education_level || ""],
      ["ระดับชั้น : ", data.grade_level || ""],
      ["ภาคเรียนที่ : ", String(data.semester ?? "")],
      ["ปีการศึกษา : ", String(data.academic_year ?? "")],
    ],
    metaRight: [
      ["ครูที่ปรึกษา : ", data.homeroom_teacher || ""],
      ["ตำแหน่ง : ", data.homeroom_teacher_position || "ครู"],
      ["จำนวน นร. : ", `${data.students.length} คน`],
    ],
  });

  // ---- ข้อมูลพื้นฐาน ----
  doc.addPage();
  center(doc, "ข้อมูลพื้นฐาน", 22, 20, true);
  let y = 38;
  const meta: Array<[string, string]> = [
    ["โรงเรียน", data.school.school_name || ""],
    ["สังกัด", data.school.affiliation || ""],
    ["ระดับการศึกษา", data.education_level],
    ["ระดับชั้น", data.grade_level],
    ["ภาคเรียน / ปีการศึกษา", `${data.semester} / ${data.academic_year}`],
    ["ครูที่ปรึกษา", `${data.homeroom_teacher}${data.homeroom_teacher_position ? "  (" + data.homeroom_teacher_position + ")" : ""}`],
    ["ผู้อำนวยการ", `${data.director_name || data.school.director_name || ""}`],
  ];
  meta.forEach(([k, v]) => { line(doc, `${k} :`, v, 20, y, 16); y += 9; });

  // ---- รายวิชา ----
  if (data.subjects?.length) {
    doc.addPage();
    center(doc, "รายวิชาที่เปิดสอน", 18, 18, true);
    autoTable(doc, {
      startY: 28,
      margin: { left: 15, right: 15 },
      head: [["ประเภท", "รหัส", "ชื่อย่อ", "ชื่อเต็ม", "น้ำหนัก", "ชม./ปี"]],
      body: data.subjects.map((s) => [
        s.type || "",
        s.code || "",
        s.short_name || "",
        s.full_name || "",
        String(s.weight ?? ""),
        String(s.hours_per_year ?? ""),
      ]),
      styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 1.5, lineColor: [80, 80, 80], lineWidth: 0.1 },
      headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", halign: "center" },
      columnStyles: { 0: { halign: "center", cellWidth: 22 }, 1: { halign: "center", cellWidth: 22 }, 2: { halign: "center", cellWidth: 24 }, 4: { halign: "center", cellWidth: 18 }, 5: { halign: "center", cellWidth: 18 } },
    });
  }

  // ---- รายชื่อนักเรียน ----
  doc.addPage();
  center(doc, `รายชื่อนักเรียน — ${data.grade_level}`, 18, 18, true);
  center(doc, `ภาคเรียนที่ ${data.semester}  ปีการศึกษา ${data.academic_year}`, 26, 13);
  autoTable(doc, {
    startY: 32,
    margin: { left: 15, right: 15 },
    head: [["ที่", "รหัสนักเรียน", "ชื่อ-สกุล"]],
    body: data.students.map((s, i) => [String(s.no || i + 1), s.student_code || "", s.full_name || ""]),
    styles: { font: "THSarabunNew", fontSize: 13, cellPadding: 1.5, lineColor: [80, 80, 80], lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "center", cellWidth: 16 }, 1: { halign: "center", cellWidth: 32 } },
  });

  // ---- ลงนาม ----
  doc.addPage();
  center(doc, "หน้าลงนามรับรอง ปพ.๖", 25, 20, true);
  center(doc, `ภาคเรียนที่ ${data.semester}  ปีการศึกษา ${data.academic_year}  ระดับชั้น ${data.grade_level}`, 35, 14);
  center(doc, `วันที่ ${data.approval_day ?? "....."}  เดือน ${data.approval_month ?? "................"}  พ.ศ. ${data.approval_year_be ?? "....."}`, 50, 14);

  const sigs6 = await getSigners([
    "academic_head", "deputy_academic", "deputy_personnel", "deputy_general", "deputy_budget", "director",
  ]);
  signatureBlock(doc, 90, [
    { role: "ครูที่ปรึกษา", name: data.homeroom_teacher, title: data.homeroom_teacher_position || "ครู" },
    { role: "หัวหน้างานวิชาการ", name: data.academic_head_name || data.school.academic_head_name || sigs6.academic_head?.name || "", title: data.academic_head_position || sigs6.academic_head?.position || "" },
  ]);
  const deputies6 = [sigs6.deputy_academic, sigs6.deputy_personnel, sigs6.deputy_general, sigs6.deputy_budget]
    .filter(Boolean) as { name: string; position: string }[];
  if (deputies6.length) {
    signatureBlock(doc, 150, deputies6.map((d) => ({ role: d.position, name: d.name })));
  }
  signatureBlock(doc, 210, [
    { role: data.director_title || "ผู้อำนวยการ", name: sigs6.director?.name || data.director_name || data.school.director_name || "", title: data.school.school_name || "" },
  ]);

  save(doc, filename || `ปพ.6_${data.grade_level}_${data.semester}_${data.academic_year}.pdf`);
}
