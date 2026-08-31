/**
 * ppBooklet — พิมพ์เอกสาร ปพ. แบบ "รวมเล่ม" ทั้งห้องเรียน
 * โครงเล่มตามระเบียบ สพฐ.: ปก → สารบัญ → เอกสารรายบุคคล (คนละหน้า มีเลขหน้าต่อเนื่อง) → หน้าลงนามรับรอง
 *
 * ใช้ร่วมกับ openPrintWindow() จาก printUtils.ts
 */
import { supabase } from "@/integrations/supabase/client";
import { formatFullNameHtml, formatFullNamePlain } from "@/lib/nameFormat";
import { currentThaiDate } from "@/lib/printUtils";
import { BE_OFFSET } from "@/lib/dateBE";

export type BookletKind = "pp1" | "pp6";

export interface BookletSchoolInfo {
  school_name?: string;
  school_address?: string;
  school_logo?: string;
  garuda_emblem?: string;
  director_name?: string;
  director_title?: string;
}

const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

const BOOKLET_CSS = `
<style>
  .bk-page {
    width: 100%;
    min-height: 268mm;
    padding: 14mm 16mm 20mm 18mm;
    box-sizing: border-box;
    position: relative;
    page-break-after: always;
    break-after: page;
  }
  .bk-page:last-child { page-break-after: auto; break-after: auto; }
  .bk-pageno {
    position: absolute; bottom: 8mm; left: 16mm; right: 16mm;
    text-align: center; font-size: 18px; color: #555;
  }
  .bk-cover { text-align: center; padding-top: 32mm; }
  .bk-cover img.logo { width: 34mm; height: auto; object-fit: contain; margin: 0 auto 8mm; display: block; }
  .bk-cover .t1 { font-size: 34px; font-weight: 700; margin-bottom: 4mm; }
  .bk-cover .t2 { font-size: 44px; font-weight: 700; margin: 10mm 0 4mm; }
  .bk-cover .t3 { font-size: 26px; margin-bottom: 2mm; }
  .bk-cover .meta { margin-top: 16mm; font-size: 24px; line-height: 1.8; }
  .bk-cover .rule { width: 60%; margin: 6mm auto; border-top: 2px solid #000; }
  .bk-toc-title { text-align: center; font-size: 30px; font-weight: 700; margin-bottom: 8mm; }
  table.bk-toc { width: 100%; border-collapse: collapse; font-size: 21px; }
  table.bk-toc th, table.bk-toc td { border: 1px solid #000; padding: 3px 6px; }
  table.bk-toc th { background: #f0f0f0; text-align: center; }
  .bk-sig-page { padding-top: 24mm; }
  .bk-sig-row { display: flex; justify-content: space-around; margin-top: 26mm; }
  .bk-sig-item { text-align: center; width: 46%; }
  .bk-sig-line { border-bottom: 1px dotted #000; height: 1px; margin: 0 auto 4mm; width: 80%; }
  @media print {
    .bk-page { min-height: 0; }
  }
</style>
`;

interface BookletPart {
  /** HTML ของเนื้อหาหน้านั้น */
  html: string;
  /** ข้อความสำหรับสารบัญ (ถ้ามี) */
  toc?: { code: string; name: string };
}

function coverHtml(school: BookletSchoolInfo, opts: { docTitle: string; subtitle: string; classLabel: string; count: number; homeroom?: string }) {
  const logo = school.school_logo || school.garuda_emblem;
  return `
  <div class="bk-cover">
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="logo" />` : ""}
    <div class="t1">${esc(school.school_name || "โรงเรียน")}</div>
    ${school.school_address ? `<div class="t3">${esc(school.school_address)}</div>` : ""}
    <div class="rule"></div>
    <div class="t2">${esc(opts.docTitle)}</div>
    <div class="t3">${esc(opts.subtitle)}</div>
    <div class="meta">
      <div>ชั้น ${esc(opts.classLabel)}</div>
      ${opts.homeroom ? `<div>ครูประจำชั้น ${esc(opts.homeroom)}</div>` : ""}
      <div>จำนวนนักเรียน ${opts.count} คน</div>
      <div>พิมพ์เมื่อ ${currentThaiDate()}</div>
    </div>
  </div>`;
}

function tocHtml(rows: { no: number; code: string; name: string; page: number }[]) {
  return `
  <div class="bk-toc-title">สารบัญ</div>
  <table class="bk-toc">
    <thead><tr><th style="width:12%">ที่</th><th style="width:24%">เลขประจำตัว</th><th>ชื่อ - สกุล</th><th style="width:14%">หน้า</th></tr></thead>
    <tbody>
      ${rows.map((r) => `<tr><td style="text-align:center">${r.no}</td><td style="text-align:center">${esc(r.code)}</td><td>${esc(r.name)}</td><td style="text-align:center">${r.page}</td></tr>`).join("")}
    </tbody>
  </table>`;
}

function signaturePageHtml(school: BookletSchoolInfo, docTitle: string, count: number) {
  return `
  <div class="bk-sig-page">
    <div style="text-align:center;font-size:28px;font-weight:700;margin-bottom:10mm">หน้ารับรองเอกสาร</div>
    <div style="font-size:22px;line-height:2;text-indent:2.5em">
      ขอรับรองว่า${esc(docTitle)}เล่มนี้ จำนวน ${count} ราย เป็นเอกสารที่จัดทำขึ้นจากข้อมูลผลการเรียนของนักเรียน
      ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑ ถูกต้องและเป็นความจริงทุกประการ
    </div>
    <div class="bk-sig-row">
      <div class="bk-sig-item">
        <div class="bk-sig-line"></div>
        <div>(...........................................)</div>
        <div>นายทะเบียน</div>
      </div>
      <div class="bk-sig-item">
        <div class="bk-sig-line"></div>
        <div>${school.director_name ? `(${esc(school.director_name)})` : "(...........................................)"}</div>
        <div>${esc(school.director_title || "ผู้อำนวยการโรงเรียน")}</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:16mm;font-size:21px">วันที่ ${currentThaiDate()}</div>
  </div>`;
}

/** ประกอบเล่ม: ปก + สารบัญ + หน้ารายบุคคล + หน้ารับรอง (มีเลขหน้าต่อเนื่อง) */
export function assembleBooklet(params: {
  school: BookletSchoolInfo;
  docTitle: string;
  subtitle: string;
  classLabel: string;
  homeroom?: string;
  parts: BookletPart[];
  footerNote?: string;
}): string {
  const { school, docTitle, subtitle, classLabel, homeroom, parts, footerNote } = params;
  const toc = parts
    .map((p, i) => (p.toc ? { no: i + 1, code: p.toc.code, name: p.toc.name, page: i + 1 } : null))
    .filter(Boolean) as { no: number; code: string; name: string; page: number }[];

  const totalPages = parts.length + 1; // หน้ารายบุคคล + หน้ารับรอง
  const footer = (n: number) =>
    `<div class="bk-pageno">${esc(footerNote || `${docTitle} — ${classLabel}`)} · หน้า ${n} / ${totalPages}</div>`;

  const pages: string[] = [];
  pages.push(`<div class="bk-page">${coverHtml(school, { docTitle, subtitle, classLabel, count: parts.length, homeroom })}</div>`);
  if (toc.length) pages.push(`<div class="bk-page">${tocHtml(toc)}</div>`);
  parts.forEach((p, i) => pages.push(`<div class="bk-page">${p.html}${footer(i + 1)}</div>`));
  pages.push(`<div class="bk-page">${signaturePageHtml(school, docTitle, parts.length)}${footer(totalPages)}</div>`);

  return `${BOOKLET_CSS}<div class="obec-a4-page">${pages.join("")}</div>`;
}

// ───────────────────────── data loading ─────────────────────────

export interface ClassBookletData {
  classroom: any;
  students: any[];
  subjects: any[];
  scores: any[];
  assessments: any[];
  attendance: any[];
}

/** ดึงข้อมูลทั้งห้องในไม่กี่ query (ไม่มี N+1) */
export async function loadClassBookletData(classroomId: string, opts: { semester?: number } = {}): Promise<ClassBookletData> {
  const { data: classroom } = await supabase.from("classrooms").select("*").eq("id", classroomId).maybeSingle();
  const { data: students = [] } = await supabase
    .from("students")
    .select("id, student_code, prefix, first_name, last_name")
    .eq("classroom_id", classroomId)
    .eq("status", "active")
    .order("student_code");

  const list = students || [];
  const codes = list.map((s: any) => s.student_code).filter(Boolean);
  const ids = list.map((s: any) => s.id);
  if (!codes.length) return { classroom, students: [], subjects: [], scores: [], assessments: [], attendance: [] };

  const scoreQuery = supabase.from("student_scores").select("*").in("student_code", codes);
  const [{ data: subjects }, { data: scores }, { data: assessments }, { data: attendance }] = await Promise.all([
    supabase.from("subjects").select("*"),
    (opts.semester ? scoreQuery.eq("semester", opts.semester) : scoreQuery).order("academic_year").order("semester"),
    supabase.from("student_assessment_scores").select("*, assessment_criteria(*)").in("student_id", ids),
    opts.semester
      ? supabase.from("attendance").select("student_id, status").in("student_id", ids).eq("semester", opts.semester)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return {
    classroom,
    students: list,
    subjects: subjects || [],
    scores: scores || [],
    assessments: (assessments as any[]) || [],
    attendance: (attendance as any[]) || [],
  };
}

// ───────────────────────── per-student page builders ─────────────────────────

const levelLabel = (level: string) =>
  ({ excellent: "ดีเยี่ยม", good: "ดี", moderate: "ผ่าน", needs_improvement: "ไม่ผ่าน" } as Record<string, string>)[level] || level || "-";

function studentHeaderHtml(school: BookletSchoolInfo, docTitle: string, subtitle: string, student: any, classLabel: string) {
  return `
  <div class="obec-header" style="margin-bottom:6mm">
    <div class="school-name">${esc(school.school_name || "")}</div>
    <div class="doc-title">${esc(docTitle)}</div>
    <div class="doc-subtitle">${esc(subtitle)}</div>
  </div>
  <div class="obec-info-box">
    <div class="obec-info-grid">
      <div><span class="info-label">ชื่อ-สกุล: </span><span class="info-value">${formatFullNameHtml(student.prefix, student.first_name, student.last_name)}</span></div>
      <div><span class="info-label">เลขประจำตัว: </span><span class="info-value">${esc(student.student_code)}</span></div>
      <div><span class="info-label">ชั้น/ห้อง: </span><span class="info-value">${esc(classLabel)}</span></div>
    </div>
  </div>`;
}

/** สร้างเล่ม ปพ.1 (ระเบียนแสดงผลการเรียน) ทั้งห้อง */
export function buildTranscriptBooklet(data: ClassBookletData, school: BookletSchoolInfo): string {
  const { classroom, students, subjects, scores, assessments } = data;
  const classLabel = classroom ? `${classroom.grade_level} - ${classroom.name}` : "-";
  const subjectOf = (id: string) => subjects.find((s: any) => s.id === id);

  const parts: BookletPart[] = students.map((st: any) => {
    const mine = scores.filter((s: any) => s.student_code === st.student_code);
    const grouped: Record<string, any[]> = {};
    mine.forEach((s: any) => {
      const key = `${(s.academic_year || 0) > 2400 ? s.academic_year : (s.academic_year || 0) + BE_OFFSET}/${s.semester}`;
      (grouped[key] ||= []).push(s);
    });

    let totalCredits = 0;
    let totalGP = 0;
    const tables = Object.entries(grouped)
      .map(([key, rows]) => {
        const cr = rows.reduce((a, s: any) => a + (subjectOf(s.subject_id)?.credits || 0), 0);
        const gp = rows.reduce((a, s: any) => a + (s.grade_point || 0) * (subjectOf(s.subject_id)?.credits || 0), 0);
        totalCredits += cr;
        totalGP += gp;
        return `
        <div class="obec-subsection-title">ปีการศึกษา ${esc(key.replace("/", " ภาคเรียนที่ "))}</div>
        <table class="obec-table">
          <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th class="center">หน่วยกิต</th><th class="center">ผลการเรียน</th></tr></thead>
          <tbody>
            ${rows
              .map((s: any) => {
                const sub = subjectOf(s.subject_id);
                return `<tr><td class="mono">${esc(sub?.code)}</td><td>${esc(sub?.name_th)}</td><td class="center">${esc(sub?.credits ?? "")}</td><td class="center"><span class="obec-grade">${esc(s.grade || "-")}</span></td></tr>`;
              })
              .join("")}
          </tbody>
          <tfoot><tr><td colspan="2" class="right">รวม</td><td class="center bold">${cr}</td><td class="center bold">GPA: ${cr > 0 ? (gp / cr).toFixed(2) : "0.00"}</td></tr></tfoot>
        </table>`;
      })
      .join("");

    const mineAssess = assessments.filter((a: any) => a.student_id === st.id);
    const assessHtml = mineAssess.length
      ? `<div class="obec-section-title">ผลการประเมินคุณลักษณะและสมรรถนะ</div>
         <table class="obec-table">
           <thead><tr><th>รายการ</th><th class="center">ภาคเรียน</th><th class="center">ระดับ</th></tr></thead>
           <tbody>${mineAssess
             .map((a: any) => `<tr><td>${esc(a.assessment_criteria?.title)}</td><td class="center">${esc(a.semester ?? "")}</td><td class="center">${esc(levelLabel(a.level))}</td></tr>`)
             .join("")}</tbody>
         </table>`
      : "";

    const html = `
      ${studentHeaderHtml(school, "ระเบียนแสดงผลการเรียน (ปพ.1)", "หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑", st, classLabel)}
      ${tables || '<p style="text-align:center;padding:16px;color:#888">ไม่มีข้อมูลผลการเรียน</p>'}
      ${assessHtml}
      <div class="obec-summary-box">
        <div><span class="summary-label">หน่วยกิตรวม: </span><span class="summary-value">${totalCredits}</span></div>
        <div><span class="summary-label">GPAX: </span><span class="summary-value">${totalCredits > 0 ? (totalGP / totalCredits).toFixed(2) : "0.00"}</span></div>
      </div>
      <div class="obec-signatures">
        <div class="obec-sig-row">
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title">(นายทะเบียน)</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-name">${school.director_name ? `(${esc(school.director_name)})` : "(ลงชื่อ)"}</div><div class="obec-sig-title">${esc(school.director_title || "ผู้อำนวยการโรงเรียน")}</div></div>
        </div>
      </div>`;

    return { html, toc: { code: st.student_code, name: formatFullNamePlain(st.prefix, st.first_name, st.last_name) } };
  });

  return assembleBooklet({
    school,
    docTitle: "ระเบียนแสดงผลการเรียน (ปพ.1)",
    subtitle: "หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑",
    classLabel,
    homeroom: classroom?.homeroom_teacher || undefined,
    parts,
  });
}

/** สร้างเล่ม ปพ.6 (สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน) ทั้งห้อง */
export function buildReportCardBooklet(data: ClassBookletData, school: BookletSchoolInfo, opts: { semester: number; academicYearBE: string }): string {
  const { classroom, students, subjects, scores, assessments, attendance } = data;
  const classLabel = classroom ? `${classroom.grade_level} - ${classroom.name}` : "-";
  const subjectOf = (id: string) => subjects.find((s: any) => s.id === id);
  const subtitle = `ภาคเรียนที่ ${opts.semester} ปีการศึกษา ${opts.academicYearBE}`;

  const parts: BookletPart[] = students.map((st: any) => {
    const mine = scores.filter((s: any) => s.student_code === st.student_code);
    const credits = mine.reduce((a, s: any) => a + (subjectOf(s.subject_id)?.credits || 0), 0);
    const gp = mine.reduce((a, s: any) => a + (s.grade_point || 0) * (subjectOf(s.subject_id)?.credits || 0), 0);
    const att = attendance.filter((a: any) => a.student_id === st.id);
    const present = att.filter((a: any) => a.status === "present").length;

    const mineAssess = assessments.filter((a: any) => a.student_id === st.id && Number(a.semester) === opts.semester);
    const section = (title: string, cat: string) => {
      const rows = mineAssess.filter((a: any) => a.assessment_criteria?.category === cat);
      if (!rows.length) return "";
      return `<div class="obec-subsection-title">${title}</div>
        <table class="obec-table"><thead><tr><th>รายการประเมิน</th><th class="center" style="width:110px">ระดับ</th></tr></thead>
        <tbody>${rows.map((a: any) => `<tr><td>${esc(a.assessment_criteria?.title)}</td><td class="center">${esc(levelLabel(a.level))}</td></tr>`).join("")}</tbody></table>`;
    };

    const html = `
      ${studentHeaderHtml(school, "สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)", subtitle, st, classLabel)}
      ${att.length ? `<div class="obec-att-box"><strong>สรุปเวลาเรียน:</strong> มาเรียน ${present}/${att.length} วัน (${((present / att.length) * 100).toFixed(1)}%)</div>` : ""}
      <div class="obec-section-title">ส่วนที่ 1: ผลการเรียน</div>
      <table class="obec-table">
        <thead><tr><th>รหัสวิชา</th><th>รายวิชา</th><th class="center">หน่วยกิต</th><th class="center">กลางภาค</th><th class="center">ปลายภาค</th><th class="center">รวม</th><th class="center">เกรด</th></tr></thead>
        <tbody>${
          mine.length
            ? mine
                .map((s: any) => {
                  const sub = subjectOf(s.subject_id);
                  return `<tr><td class="mono">${esc(sub?.code)}</td><td>${esc(sub?.name_th)}</td><td class="center">${esc(sub?.credits ?? "")}</td><td class="center">${esc(s.midterm_score ?? "")}</td><td class="center">${esc(s.final_score ?? "")}</td><td class="center bold">${esc(s.total_score ?? "")}</td><td class="center"><span class="obec-grade">${esc(s.grade || "-")}</span></td></tr>`;
                })
                .join("")
            : '<tr><td colspan="7" class="center" style="padding:12px;color:#888">ไม่มีข้อมูลผลการเรียน</td></tr>'
        }</tbody>
      </table>
      <div class="obec-summary-box">
        <div><span class="summary-label">หน่วยกิตรวม: </span><span class="summary-value">${credits}</span></div>
        <div><span class="summary-label">GPA ภาคเรียนนี้: </span><span class="summary-value">${credits > 0 ? (gp / credits).toFixed(2) : "0.00"}</span></div>
      </div>
      ${section("ส่วนที่ 2: สมรรถนะสำคัญของผู้เรียน", "competency")}
      ${section("ส่วนที่ 3: คุณลักษณะอันพึงประสงค์", "desirable")}
      ${section("ส่วนที่ 4: การอ่าน คิดวิเคราะห์ และเขียน", "reading")}
      <div class="obec-section-title">ความเห็นครูที่ปรึกษา</div>
      <div class="obec-comment-box">......................................................................................................................................</div>
      <div class="obec-signatures">
        <div class="obec-sig-grid-3">
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title">(ครูที่ปรึกษา)</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title">(ผู้ปกครอง)</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-name">${school.director_name ? `(${esc(school.director_name)})` : "(ลงชื่อ)"}</div><div class="obec-sig-title">${esc(school.director_title || "ผู้อำนวยการโรงเรียน")}</div></div>
        </div>
      </div>`;

    return { html, toc: { code: st.student_code, name: formatFullNamePlain(st.prefix, st.first_name, st.last_name) } };
  });

  return assembleBooklet({
    school,
    docTitle: "สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)",
    subtitle,
    classLabel,
    homeroom: classroom?.homeroom_teacher || undefined,
    parts,
  });
}
