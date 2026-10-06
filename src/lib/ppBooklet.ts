import { formatGPA } from "@/lib/gradeUtils";
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
  .bk-root { font-family: "TH Sarabun New","Sarabun",sans-serif; color:#111; }
  .bk-page { width:100%; min-height:268mm; padding:14mm 16mm 20mm 20mm; box-sizing:border-box; position:relative; page-break-after:always; break-after:page; font-size:18px; line-height:1.35; }
  .bk-page:last-child { page-break-after:auto; break-after:auto; }
  .bk-pageno { position:absolute; bottom:8mm; left:20mm; right:16mm; display:flex; justify-content:space-between; border-top:1px solid #9aa3ad; padding-top:2mm; font-size:15px; color:#555; }
  /* ปก */
  .bk-cover { text-align:center; padding-top:22mm; height:240mm; box-sizing:border-box; border:3px double #1f3a5f; padding-left:10mm; padding-right:10mm; }
  .bk-cover img.logo { width:32mm; height:32mm; object-fit:contain; margin:0 auto 6mm; display:block; }
  .bk-cover .t1 { font-size:32px; font-weight:700; color:#1f3a5f; }
  .bk-cover .t3 { font-size:22px; color:#333; }
  .bk-cover .t2 { font-size:42px; font-weight:700; margin:14mm 0 2mm; color:#1f3a5f; }
  .bk-cover .rule { width:50%; margin:6mm auto; border-top:2px solid #1f3a5f; }
  .bk-cover .meta { margin:18mm auto 0; width:70%; font-size:22px; border:1px solid #c9d2dc; border-radius:3mm; padding:5mm 8mm; text-align:left; line-height:1.9; }
  .bk-cover .meta b { display:inline-block; width:38%; color:#1f3a5f; }
  /* หัวกระดาษรายบุคคล */
  .bk-head { display:flex; align-items:center; gap:5mm; border-bottom:2px solid #1f3a5f; padding-bottom:3mm; margin-bottom:4mm; }
  .bk-head img { width:18mm; height:18mm; object-fit:contain; }
  .bk-head .h-mid { flex:1; text-align:center; }
  .bk-head .h-school { font-size:22px; font-weight:700; }
  .bk-head .h-title { font-size:20px; font-weight:700; color:#1f3a5f; }
  .bk-head .h-sub { font-size:16px; color:#444; }
  .bk-head .h-code { border:1px solid #1f3a5f; padding:1mm 3mm; font-size:15px; color:#1f3a5f; white-space:nowrap; }
  .bk-info { display:grid; grid-template-columns:2fr 1fr 1fr; border:1px solid #9aa3ad; margin-bottom:4mm; }
  .bk-info > div { padding:1.5mm 3mm; border-right:1px solid #9aa3ad; }
  .bk-info > div:last-child { border-right:none; }
  .bk-info span { color:#555; font-size:15px; display:block; }
  .bk-info b { font-size:19px; }
  .bk-sec { background:#1f3a5f; color:#fff; font-weight:700; padding:1mm 3mm; margin:4mm 0 0; font-size:17px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .bk-subsec { font-weight:700; color:#1f3a5f; margin:3mm 0 1mm; border-left:3px solid #1f3a5f; padding-left:2mm; }
  table.bk-t { width:100%; border-collapse:collapse; font-size:16px; }
  table.bk-t th, table.bk-t td { border:1px solid #7d8791; padding:1px 5px; }
  table.bk-t thead th { background:#e8eef5; font-weight:700; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  table.bk-t tbody tr:nth-child(even) td { background:#f7f9fb; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  table.bk-t tfoot td { background:#eef2f6; font-weight:700; }
  table.bk-t .c { text-align:center; } table.bk-t .r { text-align:right; } table.bk-t .m { white-space:nowrap; }
  .bk-sum { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #1f3a5f; margin-top:3mm; text-align:center; }
  .bk-sum > div { padding:1.5mm; border-right:1px solid #c9d2dc; }
  .bk-sum > div:last-child { border-right:none; }
  .bk-sum span { display:block; font-size:14px; color:#555; } .bk-sum b { font-size:22px; color:#1f3a5f; }
  .bk-comment { border:1px solid #9aa3ad; min-height:16mm; padding:2mm 3mm; color:#999; }
  .bk-sigs { display:grid; gap:4mm; margin-top:10mm; text-align:center; font-size:16px; }
  .bk-sigs .ln { border-bottom:1px dotted #000; width:80%; margin:0 auto 1mm; height:8mm; }
  .bk-toc-title { text-align:center; font-size:28px; font-weight:700; color:#1f3a5f; margin-bottom:6mm; }
  .bk-sig-page { padding-top:20mm; }
  @media print { .bk-page { min-height:0; } }
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
      <div><b>ชั้น/ห้อง</b>${esc(opts.classLabel)}</div>
      ${opts.homeroom ? `<div><b>ครูประจำชั้น</b>${esc(opts.homeroom)}</div>` : ""}
      <div><b>จำนวนนักเรียน</b>${opts.count} คน</div>
      <div><b>วันที่จัดพิมพ์</b>${currentThaiDate()}</div>
    </div>
  </div>`;
}

function tocHtml(rows: { no: number; code: string; name: string; page: number }[]) {
  return `
  <div class="bk-toc-title">สารบัญ</div>
  <table class="bk-t">
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
    `<div class="bk-pageno"><span>${esc(school.school_name || "")}</span><span>${esc(footerNote || `${docTitle} — ${classLabel}`)}</span><span>หน้า ${n} / ${totalPages}</span></div>`;

  const pages: string[] = [];
  pages.push(`<div class="bk-page">${coverHtml(school, { docTitle, subtitle, classLabel, count: parts.length, homeroom })}</div>`);
  if (toc.length) pages.push(`<div class="bk-page">${tocHtml(toc)}</div>`);
  parts.forEach((p, i) => pages.push(`<div class="bk-page">${p.html}${footer(i + 1)}</div>`));
  pages.push(`<div class="bk-page">${signaturePageHtml(school, docTitle, parts.length)}${footer(totalPages)}</div>`);

  return `${BOOKLET_CSS}<div class="obec-a4-page bk-root">${pages.join("")}</div>`;
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
  const logo = school.school_logo || school.garuda_emblem;
  const code = (docTitle.match(/\((ปพ\.\d)\)/) || [])[1] || "";
  return `
  <div class="bk-head">
    ${logo ? `<img src="${esc(logo)}" alt="" />` : `<div style="width:18mm"></div>`}
    <div class="h-mid">
      <div class="h-school">${esc(school.school_name || "")}</div>
      <div class="h-title">${esc(docTitle.replace(/\s*\(ปพ\.\d\)/, ""))}</div>
      <div class="h-sub">${esc(subtitle)}</div>
    </div>
    <div class="h-code">${esc(code)}</div>
  </div>
  <div class="bk-info">
    <div><span>ชื่อ - สกุล</span><b>${formatFullNameHtml(student.prefix, student.first_name, student.last_name)}</b></div>
    <div><span>เลขประจำตัว</span><b>${esc(student.student_code)}</b></div>
    <div><span>ชั้น/ห้อง</span><b>${esc(classLabel)}</b></div>
  </div>`;
}

const NUMERIC_GRADE = /^(4|3\.5|3|2\.5|2|1\.5|1|0)$/;
/** หน่วยกิต/คะแนนถ่วง — ไม่นับวิชาที่ยังเป็น ร/มส/มผ (ตามระเบียบวัดผล สพฐ.) */
function gpTotals(rows: any[], subjectOf: (id: string) => any) {
  let cr = 0, gp = 0, allCr = 0;
  rows.forEach((s: any) => {
    const c = Number(subjectOf(s.subject_id)?.credits) || 0;
    allCr += c;
    const g = String(s.grade ?? "").trim();
    if (!NUMERIC_GRADE.test(g)) return;
    cr += c; gp += Number(g) * c;
  });
  return { cr, gp, allCr };
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
        const { cr, gp, allCr } = gpTotals(rows, subjectOf);
        totalCredits += cr;
        totalGP += gp;
        return `
        <div class="bk-subsec">ปีการศึกษา ${esc(key.replace("/", " ภาคเรียนที่ "))}</div>
        <table class="bk-t">
          <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th class="c">หน่วยกิต</th><th class="c">ผลการเรียน</th></tr></thead>
          <tbody>
            ${rows
              .map((s: any) => {
                const sub = subjectOf(s.subject_id);
                return `<tr><td class="m">${esc(sub?.code)}</td><td>${esc(sub?.name_th)}</td><td class="c">${esc(sub?.credits ?? "")}</td><td class="c"><span>${esc(s.grade || "-")}</span></td></tr>`;
              })
              .join("")}
          </tbody>
          <tfoot><tr><td colspan="2" class="r">รวม</td><td class="c">${allCr}</td><td class="c">GPA: ${formatGPA(gp, cr)}</td></tr></tfoot>
        </table>`;
      })
      .join("");

    const mineAssess = assessments.filter((a: any) => a.student_id === st.id);
    const assessHtml = mineAssess.length
      ? `<div class="bk-sec">ผลการประเมินคุณลักษณะและสมรรถนะ</div>
         <table class="bk-t">
           <thead><tr><th>รายการ</th><th class="c">ภาคเรียน</th><th class="c">ระดับ</th></tr></thead>
           <tbody>${mineAssess
             .map((a: any) => `<tr><td>${esc(a.assessment_criteria?.title)}</td><td class="c">${esc(a.semester ?? "")}</td><td class="c">${esc(levelLabel(a.level))}</td></tr>`)
             .join("")}</tbody>
         </table>`
      : "";

    const html = `
      ${studentHeaderHtml(school, "ระเบียนแสดงผลการเรียน (ปพ.1)", "หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑", st, classLabel)}
      ${tables || '<p style="text-align:center;padding:16px;color:#888">ไม่มีข้อมูลผลการเรียน</p>'}
      ${assessHtml}
      <div class="bk-sum">
        <div><span>ภาคเรียนที่เรียน</span><b>${Object.keys(grouped).length}</b></div>
        <div><span>หน่วยกิตที่ได้</span><b>${totalCredits}</b></div>
        <div><span>ผลการเรียนเฉลี่ยสะสม (GPAX)</span><b>${formatGPA(totalGP, totalCredits)}</b></div>
        <div><span>ผลการประเมิน</span><b>${mineAssess.length ? "มีผล" : "-"}</b></div>
      </div>
      <div class="bk-sigs" style="grid-template-columns:repeat(2,1fr)"><div><div class="ln"></div>(.....................................)<br/>นายทะเบียน</div><div><div class="ln"></div>${school.director_name ? `(${esc(school.director_name)})` : "(.....................................)"}<br/>${esc(school.director_title || "ผู้อำนวยการโรงเรียน")}</div></div>`;

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
    const { cr: credits, gp } = gpTotals(mine, subjectOf);
    const att = attendance.filter((a: any) => a.student_id === st.id);
    const present = att.filter((a: any) => a.status === "present" || a.status === "late").length;
    const absent = att.filter((a: any) => a.status === "absent").length;
    const leave = att.filter((a: any) => /leave|sick|ลา/.test(String(a.status))).length;

    const mineAssess = assessments.filter((a: any) => a.student_id === st.id && Number(a.semester) === opts.semester);
    const section = (title: string, cat: string) => {
      const rows = mineAssess.filter((a: any) => (a.assessment_criteria?.category === cat || (cat === "reading" && a.assessment_criteria?.category === "reading_writing")));
      if (!rows.length) return "";
      return `<div class="bk-subsec">${title}</div>
        <table class="bk-t"><thead><tr><th>รายการประเมิน</th><th class="c" style="width:110px">ระดับ</th></tr></thead>
        <tbody>${rows.map((a: any) => `<tr><td>${esc(a.assessment_criteria?.title)}</td><td class="c">${esc(levelLabel(a.level))}</td></tr>`).join("")}</tbody></table>`;
    };

    const html = `
      ${studentHeaderHtml(school, "สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)", subtitle, st, classLabel)}
      <div class="bk-sec">ส่วนที่ 1: ผลการเรียน</div>
      <table class="bk-t">
        <thead><tr><th>รหัสวิชา</th><th>รายวิชา</th><th class="c">หน่วยกิต</th><th class="c">กลางภาค</th><th class="c">ปลายภาค</th><th class="c">รวม</th><th class="c">เกรด</th></tr></thead>
        <tbody>${
          mine.length
            ? mine
                .map((s: any) => {
                  const sub = subjectOf(s.subject_id);
                  return `<tr><td class="m">${esc(sub?.code)}</td><td>${esc(sub?.name_th)}</td><td class="c">${esc(sub?.credits ?? "")}</td><td class="c">${esc(s.midterm_score ?? "")}</td><td class="c">${esc(s.final_score ?? "")}</td><td class="c">${esc(s.total_score ?? "")}</td><td class="c"><span>${esc(s.grade || "-")}</span></td></tr>`;
                })
                .join("")
            : '<tr><td colspan="7" class="c" style="padding:12px;color:#888">ไม่มีข้อมูลผลการเรียน</td></tr>'
        }</tbody>
      </table>
      <div class="bk-sum">
        <div><span>หน่วยกิตที่ได้</span><b>${credits}</b></div>
        <div><span>GPA ภาคเรียนนี้</span><b>${formatGPA(gp, credits)}</b></div>
        <div><span>มาเรียน / ทั้งหมด (วัน)</span><b>${att.length ? `${present}/${att.length}` : "-"}</b></div>
        <div><span>ร้อยละเวลาเรียน · ขาด · ลา</span><b style="font-size:18px">${att.length ? `${((present / att.length) * 100).toFixed(1)}% · ${absent} · ${leave}` : "-"}</b></div>
      </div>
      ${section("ส่วนที่ 2: สมรรถนะสำคัญของผู้เรียน", "competency")}
      ${section("ส่วนที่ 3: คุณลักษณะอันพึงประสงค์", "desirable")}
      ${section("ส่วนที่ 4: การอ่าน คิดวิเคราะห์ และเขียน", "reading")}
      <div class="bk-sec">ความเห็นครูที่ปรึกษา</div>
      <div class="bk-comment">......................................................................................................................................</div>
      <div class="bk-sigs" style="grid-template-columns:repeat(3,1fr)"><div><div class="ln"></div>(.....................................)<br/>ครูที่ปรึกษา</div><div><div class="ln"></div>(.....................................)<br/>ผู้ปกครอง</div><div><div class="ln"></div>${school.director_name ? `(${esc(school.director_name)})` : "(.....................................)"}<br/>${esc(school.director_title || "ผู้อำนวยการโรงเรียน")}</div></div>`;

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

// ───────────────────────── school info from CMS ─────────────────────────

const CMS_SCHOOL_KEYS = ["school_name", "school_address", "school_logo", "garuda_emblem", "director_name", "director_title"] as const;

/** ดึงข้อมูลโรงเรียนจากหน้าตั้งค่า (cms_settings) — fallback school_settings */
export async function loadBookletSchoolInfo(): Promise<BookletSchoolInfo> {
  const info: Record<string, string> = {};
  const { data: cms } = await supabase.from("cms_settings").select("key, value").in("key", CMS_SCHOOL_KEYS as unknown as string[]);
  for (const r of (cms as any[]) || []) if (r.value) info[r.key] = String(r.value);
  const missing = CMS_SCHOOL_KEYS.filter((k) => !info[k]);
  if (missing.length) {
    const { data: ss } = await supabase.from("school_settings").select("setting_key, setting_value").in("setting_key", missing as unknown as string[]);
    for (const r of (ss as any[]) || []) if (r.setting_value) info[r.setting_key] = String(r.setting_value);
  }
  return info as BookletSchoolInfo;
}

/** พิมพ์รวมเล่มทั้งห้อง (ปพ.1 หรือ ปพ.6) โดยใช้ข้อมูลโรงเรียนจาก CMS */
export async function printClassBooklet(kind: BookletKind, classroomId: string, opts: { semester?: number; academicYearBE?: string } = {}) {
  const [{ openPrintWindow }, { logAudit }] = await Promise.all([import("@/lib/printUtils"), import("@/lib/auditLog")]);
  const [school, data] = await Promise.all([
    loadBookletSchoolInfo(),
    loadClassBookletData(classroomId, kind === "pp6" ? { semester: opts.semester } : {}),
  ]);
  if (!data.students.length) throw new Error("ไม่พบนักเรียนในห้องนี้");
  const html = kind === "pp1"
    ? buildTranscriptBooklet(data, school)
    : buildReportCardBooklet(data, school, { semester: opts.semester || 1, academicYearBE: opts.academicYearBE || "" });
  void logAudit({ action: `print_${kind}_booklet`, target_table: "classrooms", target_id: classroomId, details: { students: data.students.length, semester: opts.semester ?? null } });
  openPrintWindow(html, { title: `${kind === "pp1" ? "ปพ.1" : "ปพ.6"} รวมเล่ม` });
}
