/**
 * พิมพ์เล่ม ปพ.5 ฉบับสมบูรณ์ (ทำงานในระบบทั้งหมด — ไม่ต้อง download .xlsx)
 * รวมทุกส่วนของเทมเพลตต้นฉบับเป็น HTML หน้าต่อหน้า A4 → Ctrl+P พิมพ์ได้เลย
 */
import { supabase } from "@/integrations/supabase/client";
import { openPrintWindow } from "@/lib/printUtils";
import { signatureImgHtml } from "@/components/documents/DocumentHeader";

export interface PP5BookInput {
  assignment: any; // currentAssignment (มี subjects, classrooms, personnel)
  schoolInfo: any;
  students: any[];
  scoreColumns: any[];
  columnScores: any[]; // student_column_scores rows
  indicators: any[];
  gradingConfig?: { weight_during?: number; weight_final?: number } | null;
}

const esc = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fullName = (s: any) =>
  `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();

const eduLevel = (grade: string) => {
  if (grade.startsWith("ม.4") || grade.startsWith("ม.5") || grade.startsWith("ม.6"))
    return "มัธยมศึกษาตอนปลาย";
  if (grade.startsWith("ม.")) return "มัธยมศึกษาตอนต้น";
  return "ประถมศึกษา";
};

const sectionLabelOf = (cls: any) => {
  const grade = cls?.grade_level || "";
  if (!cls?.name) return grade;
  return String(cls.name).includes("/") ? cls.name : `${grade}/${cls.name}`;
};

// ────────────────────────────────────────────────────────────
// 1) ปก
// ────────────────────────────────────────────────────────────
function renderCover(inp: PP5BookInput): string {
  const { assignment, schoolInfo } = inp;
  const subj = assignment.subjects || {};
  const cls = assignment.classrooms || {};
  const per = assignment.personnel || {};
  const grade = cls.grade_level || "";
  const section = sectionLabelOf(cls);
  const level = eduLevel(grade);
  const teacher = `${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}`.trim();
  const yearBE = (subj.academic_year || new Date().getFullYear()) + 543;
  const logo = schoolInfo?.school_logo
    ? `<img src="${schoolInfo.school_logo}" crossorigin="anonymous" style="width:130px;height:130px;object-fit:contain;" />`
    : "";

  return `
  <section class="page cover">
    <div style="text-align:center; margin-top:30mm;">
      ${logo}
      <h1 style="font-size:36pt; margin:12mm 0 4mm;">แบบ ปพ.5</h1>
      <div style="font-size:20pt;">แบบบันทึกผลการพัฒนาคุณภาพผู้เรียนประจำรายวิชา</div>
      <div style="font-size:16pt; margin-top:2mm;">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
      <div style="margin-top:18mm; font-size:20pt; line-height:1.8;">
        <div>รหัสวิชา <b>${esc(subj.code || "-")}</b> รายวิชา <b>${esc(subj.name_th || "-")}</b></div>
        <div>กลุ่มสาระการเรียนรู้ <b>${esc(subj.subject_group || "-")}</b></div>
        <div>ระดับชั้น <b>${esc(section)}</b> (${esc(level)})</div>
        <div>ภาคเรียนที่ <b>${esc(subj.semester || 1)}</b> ปีการศึกษา <b>${esc(yearBE)}</b></div>
        <div style="margin-top:8mm;">ครูผู้สอน <b>${esc(teacher || "-")}</b></div>
      </div>
      <div style="margin-top:24mm; font-size:18pt;">
        <div><b>${esc(schoolInfo?.school_name || "")}</b></div>
        <div style="font-size:14pt;">${esc(schoolInfo?.affiliation || "")}</div>
      </div>
    </div>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 2) ตัวชี้วัด/ผลการเรียนรู้
// ────────────────────────────────────────────────────────────
function renderIndicators(inp: PP5BookInput): string {
  const rows = inp.indicators
    .map(
      (it, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(it.title || "")}</td>
      <td>${esc(it.description || "")}</td>
    </tr>`,
    )
    .join("");
  return `
  <section class="page">
    <h2>ตัวชี้วัด / ผลการเรียนรู้</h2>
    <table class="bordered">
      <thead><tr><th style="width:10%">ที่</th><th style="width:35%">ตัวชี้วัด</th><th>คำอธิบาย</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3" class="c muted">— ยังไม่ได้กำหนดตัวชี้วัด —</td></tr>`}</tbody>
    </table>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 3) รายชื่อนักเรียน
// ────────────────────────────────────────────────────────────
function renderStudentList(inp: PP5BookInput): string {
  const rows = inp.students
    .map(
      (s, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(s.student_code || "")}</td>
      <td class="c">${esc(s.citizen_id || "")}</td>
      <td>${esc(fullName(s))}</td>
    </tr>`,
    )
    .join("");
  return `
  <section class="page">
    <h2>รายชื่อนักเรียน</h2>
    <table class="bordered">
      <thead>
        <tr><th style="width:8%">เลขที่</th><th style="width:18%">รหัสประจำตัว</th><th style="width:22%">เลขประจำตัวประชาชน</th><th>ชื่อ - สกุล</th></tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="4" class="c muted">— ไม่มีนักเรียน —</td></tr>`}</tbody>
    </table>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 4) บันทึกเวลาเรียน — สรุปต่อนักเรียน
// ────────────────────────────────────────────────────────────
async function renderAttendance(inp: PP5BookInput): Promise<string> {
  const { assignment, students } = inp;
  const subj = assignment.subjects || {};
  const studentIds = students.map((s) => s.id);
  if (studentIds.length === 0) return "";

  const { data: records = [] } = await supabase
    .from("attendance")
    .select("student_id, status, attendance_date")
    .in("student_id", studentIds)
    .eq("subject_id", assignment.subject_id)
    .eq("academic_year", subj.academic_year || new Date().getFullYear())
    .eq("semester", subj.semester || 1);

  const summary = new Map<string, { present: number; absent: number; leave: number; late: number; total: number }>();
  for (const s of students) summary.set(s.id, { present: 0, absent: 0, leave: 0, late: 0, total: 0 });
  for (const r of records || []) {
    const m = summary.get(r.student_id);
    if (!m) continue;
    m.total += 1;
    if (r.status === "present") m.present += 1;
    else if (r.status === "absent") m.absent += 1;
    else if (r.status === "leave" || r.status === "excused") m.leave += 1;
    else if (r.status === "late") m.late += 1;
  }

  const rows = students
    .map((s, i) => {
      const m = summary.get(s.id)!;
      const pct = m.total > 0 ? Math.round(((m.present + m.late) / m.total) * 1000) / 10 : 0;
      return `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(s.student_code || "")}</td>
        <td>${esc(fullName(s))}</td>
        <td class="c">${m.total}</td>
        <td class="c">${m.present}</td>
        <td class="c">${m.absent}</td>
        <td class="c">${m.leave}</td>
        <td class="c">${m.late}</td>
        <td class="c">${pct}%</td>
      </tr>`;
    })
    .join("");

  return `
  <section class="page">
    <h2>บันทึกเวลาเรียน — สรุปประจำภาคเรียน</h2>
    <table class="bordered small">
      <thead>
        <tr>
          <th style="width:6%">เลขที่</th><th style="width:12%">รหัส</th><th>ชื่อ - สกุล</th>
          <th style="width:8%">คาบรวม</th><th style="width:8%">มา</th><th style="width:8%">ขาด</th>
          <th style="width:8%">ลา</th><th style="width:8%">สาย</th><th style="width:10%">% เวลาเรียน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 5) คะแนนตัวชี้วัด (นักเรียน × ตัวชี้วัด)
// ────────────────────────────────────────────────────────────
function renderIndicatorScores(inp: PP5BookInput): string {
  const { indicators, students, columnScores, scoreColumns } = inp;
  // ใช้ score columns ที่ผูก indicator_id (ถ้ามี) หรือชี้ผ่าน column_name → ในที่นี้ขอใช้ scoreColumns ตามลำดับ
  if (indicators.length === 0 || students.length === 0) return "";
  const header = indicators
    .map((it, i) => `<th title="${esc(it.title || "")}">${i + 1}</th>`)
    .join("");
  const rows = students
    .map((s, i) => {
      const cells = indicators
        .map((_, k) => {
          const col = scoreColumns[k];
          if (!col) return `<td class="c muted">-</td>`;
          const sc = columnScores.find((x: any) => x.student_id === s.id && x.column_id === col.id);
          return `<td class="c">${sc?.score ?? ""}</td>`;
        })
        .join("");
      return `<tr><td class="c">${i + 1}</td><td class="c">${esc(s.student_code || "")}</td><td>${esc(fullName(s))}</td>${cells}</tr>`;
    })
    .join("");
  return `
  <section class="page landscape">
    <h2>คะแนนตัวชี้วัด</h2>
    <table class="bordered small">
      <thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ - สกุล</th>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 6) บันทึกคะแนน + เกรดสรุป
// ────────────────────────────────────────────────────────────
async function renderScores(inp: PP5BookInput): Promise<string> {
  const { assignment, students, scoreColumns, columnScores, gradingConfig } = inp;
  const wD = Number(gradingConfig?.weight_during ?? 70);
  const wF = Number(gradingConfig?.weight_final ?? 30);
  const subj = assignment.subjects || {};

  const { data: scores = [] } = await supabase
    .from("student_scores")
    .select("*")
    .eq("subject_id", assignment.subject_id)
    .eq("academic_year", subj.academic_year || new Date().getFullYear())
    .eq("semester", subj.semester || 1);

  const enabledCols = scoreColumns.filter((c: any) => c.is_enabled !== false);
  const duringCols = enabledCols.filter((c: any) => c.column_type === "assignment" || c.column_type === "midterm");
  const finalCols = enabledCols.filter((c: any) => c.column_type === "final");
  const duringMax = duringCols.reduce((a: number, c: any) => a + Number(c.max_score || 0), 0);
  const finalMax = finalCols.reduce((a: number, c: any) => a + Number(c.max_score || 0), 0);

  const colHead = enabledCols
    .map((c: any) => `<th>${esc(c.column_name)}<br/><span class="muted">(${c.max_score})</span></th>`)
    .join("");

  const rows = students
    .map((s, i) => {
      const cellHtml = enabledCols
        .map((c: any) => {
          const sc = columnScores.find((x: any) => x.student_id === s.id && x.column_id === c.id);
          return `<td class="c">${sc?.score ?? ""}</td>`;
        })
        .join("");
      const dRaw = duringCols.reduce((a: number, c: any) => {
        const sc = columnScores.find((x: any) => x.student_id === s.id && x.column_id === c.id);
        return a + Number(sc?.score || 0);
      }, 0);
      const fRaw = finalCols.reduce((a: number, c: any) => {
        const sc = columnScores.find((x: any) => x.student_id === s.id && x.column_id === c.id);
        return a + Number(sc?.score || 0);
      }, 0);
      const d100 = duringMax > 0 ? Math.round((dRaw / duringMax) * wD * 100) / 100 : 0;
      const f100 = finalMax > 0 ? Math.round((fRaw / finalMax) * wF * 100) / 100 : 0;
      const total = Math.round((d100 + f100) * 100) / 100;
      const dbScore = scores.find((x: any) => x.student_id === s.id);
      const grade = dbScore?.grade ?? "";
      return `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(s.student_code || "")}</td>
        <td>${esc(fullName(s))}</td>
        ${cellHtml}
        <td class="c"><b>${d100}</b></td>
        <td class="c"><b>${f100}</b></td>
        <td class="c"><b>${total}</b></td>
        <td class="c"><b>${esc(grade)}</b></td>
      </tr>`;
    })
    .join("");

  return `
  <section class="page landscape">
    <h2>บันทึกคะแนน (สัดส่วน ${wD} : ${wF})</h2>
    <table class="bordered small">
      <thead>
        <tr>
          <th>เลขที่</th><th>รหัส</th><th>ชื่อ - สกุล</th>
          ${colHead}
          <th>ระหว่างเรียน<br/><span class="muted">(${wD})</span></th>
          <th>ปลายภาค<br/><span class="muted">(${wF})</span></th>
          <th>รวม<br/><span class="muted">(100)</span></th>
          <th>ผลการเรียน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 7) คุณลักษณะ / อ่านคิดวิเคราะห์ / สมรรถนะ
// ────────────────────────────────────────────────────────────
async function renderAssessment(inp: PP5BookInput, category: "character" | "reading" | "competency", title: string): Promise<string> {
  const { assignment, students } = inp;
  const subj = assignment.subjects || {};
  const year = subj.academic_year || new Date().getFullYear();
  const semester = subj.semester || 1;

  const { data: criteria = [] } = await supabase
    .from("assessment_criteria")
    .select("*")
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order");

  if ((criteria || []).length === 0 || students.length === 0) return "";

  const critIds = (criteria as any[]).map((c) => c.id);
  const studentIds = students.map((s) => s.id);
  const { data: scoreRows = [] } = await supabase
    .from("student_assessment_scores")
    .select("*")
    .in("student_id", studentIds)
    .in("criteria_id", critIds)
    .eq("semester", semester)
    .eq("academic_year", year);

  const head = (criteria as any[])
    .map((c, i) => `<th title="${esc(c.title)}">${i + 1}</th>`)
    .join("");
  const rows = students
    .map((s, i) => {
      const cells = (criteria as any[])
        .map((c) => {
          const sc = (scoreRows as any[]).find((x) => x.student_id === s.id && x.criteria_id === c.id);
          return `<td class="c">${sc?.score ?? ""}</td>`;
        })
        .join("");
      return `<tr><td class="c">${i + 1}</td><td class="c">${esc(s.student_code || "")}</td><td>${esc(fullName(s))}</td>${cells}</tr>`;
    })
    .join("");

  const legend = (criteria as any[])
    .map((c, i) => `<li><b>${i + 1}.</b> ${esc(c.title)}</li>`)
    .join("");

  return `
  <section class="page">
    <h2>${esc(title)}</h2>
    <table class="bordered small">
      <thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ - สกุล</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="legend">
      <div class="muted" style="margin-top:6px;">หมายเหตุ — เกณฑ์ประเมิน: 3 = ดีเยี่ยม, 2 = ดี, 1 = ผ่าน, 0 = ไม่ผ่าน</div>
      <ol style="columns:2; -webkit-columns:2; margin-top:4px;">${legend}</ol>
    </div>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 8) สรุปตัดสินผลการเรียน
// ────────────────────────────────────────────────────────────
async function renderSummary(inp: PP5BookInput): Promise<string> {
  const { assignment, students } = inp;
  const subj = assignment.subjects || {};
  const { data: scores = [] } = await supabase
    .from("student_scores")
    .select("*")
    .eq("subject_id", assignment.subject_id)
    .eq("academic_year", subj.academic_year || new Date().getFullYear())
    .eq("semester", subj.semester || 1);

  const dist: Record<string, number> = { "4": 0, "3.5": 0, "3": 0, "2.5": 0, "2": 0, "1.5": 0, "1": 0, "0": 0, "ร": 0, "มส": 0 };
  const rows = students
    .map((s, i) => {
      const sc = (scores as any[]).find((x) => x.student_id === s.id);
      const grade = String(sc?.grade ?? "-");
      if (dist[grade] !== undefined) dist[grade] += 1;
      return `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(s.student_code || "")}</td>
        <td>${esc(fullName(s))}</td>
        <td class="c">${sc?.total_score ?? "-"}</td>
        <td class="c"><b>${esc(grade)}</b></td>
      </tr>`;
    })
    .join("");
  const distHtml = Object.entries(dist)
    .map(([g, n]) => `<td class="c"><b>${g}</b><br/>${n}</td>`)
    .join("");

  return `
  <section class="page">
    <h2>สรุปตัดสินผลการเรียน</h2>
    <table class="bordered small">
      <thead><tr><th style="width:8%">เลขที่</th><th style="width:15%">รหัส</th><th>ชื่อ - สกุล</th><th style="width:12%">คะแนนรวม</th><th style="width:14%">เกรด</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h3 style="margin-top:8mm;">สรุปการกระจายผลการเรียน</h3>
    <table class="bordered c"><tbody><tr>${distHtml}</tr></tbody></table>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// 9) หน้าลงนาม
// ────────────────────────────────────────────────────────────
async function renderSignatures(inp: PP5BookInput): Promise<string> {
  const { assignment, schoolInfo } = inp;
  const per = assignment.personnel || {};
  const teacher = `${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}`.trim();
  const today = new Date();
  const dateBE = `${today.getDate()} ${
    ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"][today.getMonth()]
  } ${today.getFullYear() + 543}`;

  // โหลดลายเซ็นที่ admin ตั้งค่าไว้ใน "การตั้งค่า > ลายเซ็น"
  // จับคู่ตาม keyword ในช่อง position
  const { data: sigs } = await supabase
    .from("director_signatures")
    .select("name, position, signature_url")
    .eq("is_active", true);
  const findSig = (...keys: string[]) =>
    (sigs || []).find((s: any) => keys.some((k) => String(s.position || "").includes(k)));

  const head = findSig("หัวหน้ากลุ่มสาระ", "หัวหน้ากลุ่ม");
  const measure = findSig("หัวหน้างานวัด", "วัดและประเมิน");
  const deputyAcademic = findSig("รองผู้อำนวยการฝ่ายวิชาการ", "รองผู้อำนวยการกลุ่มบริหารวิชาการ");
  const deputyPersonnel = findSig("ฝ่ายบุคคล", "บริหารงานบุคคล", "บริหารบุคคล");
  const deputyGeneral = findSig("บริหารทั่วไป", "ฝ่ายบริหารทั่วไป");
  const deputyBudget = findSig("งบประมาณ", "บริหารงบประมาณ");
  const director = findSig("ผู้อำนวยการ", "ผอ.");

  const block = (role: string, name: string, position: string, sigUrl?: string) => `
    <div class="sig-block">
      <div class="sig-pad">${signatureImgHtml(sigUrl, 50)}</div>
      <div class="sig-line"></div>
      <div>(${esc(name || "-")})</div>
      <div class="muted">${esc(position)}</div>
      <div class="muted">${esc(role)}</div>
    </div>`;

  const optionalBlock = (role: string, sig: any) =>
    sig ? block(role, sig.name || "", sig.position || "", sig.signature_url) : "";

  return `
  <section class="page">
    <h2>การรับรองและการอนุมัติผลการเรียน</h2>
    <div style="text-align:right; margin:8mm 0 4mm;">วันที่ ${dateBE}</div>
    <div class="sig-grid">
      ${block("ครูผู้สอน", teacher, per.position || "ครู")}
      ${block("หัวหน้ากลุ่มสาระการเรียนรู้", head?.name || "", head?.position || "", head?.signature_url)}
      ${block("หัวหน้างานวัดและประเมินผล", measure?.name || "", measure?.position || "", measure?.signature_url)}
      ${block("รองผู้อำนวยการกลุ่มบริหารวิชาการ", deputyAcademic?.name || "", deputyAcademic?.position || "", deputyAcademic?.signature_url)}
      ${optionalBlock("รองผู้อำนวยการกลุ่มบริหารงานบุคคล", deputyPersonnel)}
      ${optionalBlock("รองผู้อำนวยการกลุ่มบริหารทั่วไป", deputyGeneral)}
      ${optionalBlock("รองผู้อำนวยการกลุ่มบริหารงบประมาณ", deputyBudget)}
      ${block("ผู้อำนวยการสถานศึกษา", director?.name || schoolInfo?.director_name || "", director?.position || schoolInfo?.director_title || "ผู้อำนวยการ", director?.signature_url || schoolInfo?.director_signature_url)}
    </div>
  </section>`;
}

// ────────────────────────────────────────────────────────────
// CSS เฉพาะของเล่ม ปพ.5
// ────────────────────────────────────────────────────────────
const BOOK_CSS = `
/* มาตรฐานหนังสือราชการไทย: A4 ขอบบน 2.5cm ขอบล่าง 2cm ขอบซ้าย 3cm ขอบขวา 2cm */
@page { size: A4 portrait; margin: 2.5cm 2cm 2cm 3cm; }
@page landscape { size: A4 landscape; margin: 2cm 2.5cm; }
html, body { margin:0; padding:0; }
body {
  font-family: "TH Sarabun New","Sarabun",serif;
  font-size: 16px;        /* ตามคำขอ — ใช้ทุกส่วนรายละเอียด */
  line-height: 1.45;
  color:#000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* แต่ละ section = ขึ้นหน้าใหม่ แต่ "อนุญาตให้ตารางยาวๆ ตัดข้ามหน้าได้"
   เพื่อไม่ให้เนื้อหาถูก clip หาย */
.page {
  page-break-after: always;
  break-after: page;
  page-break-inside: auto;
  break-inside: auto;
}
.page:last-child { page-break-after: auto; break-after: auto; }
.page.landscape { page: landscape; }

/* เฉพาะบล็อกเล็กๆ ที่ "ต้องอยู่ด้วยกัน" เท่านั้นที่ห้ามตัด */
.keep, .sig-grid, .sig-block, .legend, .doc-header {
  page-break-inside: avoid;
  break-inside: avoid;
}
h1,h2,h3,h4 { font-family: "TH Sarabun New","Sarabun",serif; page-break-after: avoid; break-after: avoid; }
h1 { font-size: 28px; margin: 0 0 6px; }
h2 { text-align:center; font-size: 22px; margin: 0 0 8px; }
h3 { font-size: 18px; margin: 10px 0 4px; }
p  { margin: 0 0 6px; text-indent: 2.5em; }     /* ย่อหน้าหนังสือราชการ */
p.no-indent, .no-indent p { text-indent: 0; }

table.bordered { width:100%; border-collapse:collapse; font-size: 16px; }
table.bordered th, table.bordered td { border:1px solid #000; padding:3px 5px; }
table.bordered th { background:#f0f0f0; text-align:center; font-weight:700; }
table { page-break-inside: auto; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr, td, th { page-break-inside: avoid; break-inside: avoid; }

.small { font-size: 14px; }
.c { text-align:center; }
.r { text-align:right; }
.muted { color:#444; font-size: 13px; }
.legend ol { padding-left:18px; margin: 4px 0; }

.sig-grid {
  display:grid; grid-template-columns:1fr 1fr;
  gap: 14mm 12mm; margin-top: 12mm; text-align:center;
}
.sig-block { padding-top: 8mm; }
.sig-pad { height: 18mm; }
.sig-line { border-bottom:1px dotted #000; margin:0 10mm 2mm; }

.cover h1 { font-family:"TH Sarabun New","Sarabun",serif; font-size: 36px; }
.cover { font-size: 18px; }
`;


// ────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────
export async function exportPP5FullBook(inp: PP5BookInput) {
  const subj = inp.assignment.subjects || {};
  const cls = inp.assignment.classrooms || {};
  const section = sectionLabelOf(cls);

  const [attendance, scores, character, reading, competency, summary, signatures] = await Promise.all([
    renderAttendance(inp),
    renderScores(inp),
    renderAssessment(inp, "character", "ผลการประเมินคุณลักษณะอันพึงประสงค์"),
    renderAssessment(inp, "reading", "ผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน"),
    renderAssessment(inp, "competency", "ผลการประเมินสมรรถนะสำคัญของผู้เรียน"),
    renderSummary(inp),
    renderSignatures(inp),
  ]);

  const html = `
    <style>${BOOK_CSS}</style>
    ${renderCover(inp)}
    ${renderIndicators(inp)}
    ${renderStudentList(inp)}
    ${attendance}
    ${renderIndicatorScores(inp)}
    ${scores}
    ${character}
    ${reading}
    ${competency}
    ${summary}
    ${signatures}
  `;

  openPrintWindow(html, {
    title: `ปพ.5 ${subj.code || ""} ${subj.name_th || ""} ${section}`,
    landscape: false,
  });
}
