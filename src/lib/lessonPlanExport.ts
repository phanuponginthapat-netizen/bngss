import { formatDateBE } from "@/lib/dateBE";

type LookupCtx = {
  subjectName?: (id: string) => string;
  classroomName?: (id: string) => string;
  personnelName?: (id: string) => string;
  schoolName?: string;
};

const esc = (s: any) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/\n/g, "<br/>");

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง", submitted: "รอนิเทศ", approved: "อนุมัติ", revise_needed: "ปรับแก้",
};

export function buildLessonPlanHTML(p: any, ctx: LookupCtx = {}) {
  const subj = ctx.subjectName?.(p.subject_id) || "-";
  const cls = ctx.classroomName?.(p.classroom_id) || "-";
  const teacher = ctx.personnelName?.(p.teacher_id) || "-";
  const reviewer = p.reviewer_id ? ctx.personnelName?.(p.reviewer_id) : "";
  const section = (title: string, body: string) => `
    <section>
      <h3>${esc(title)}</h3>
      <div class="body">${body || '<span class="muted">—</span>'}</div>
    </section>`;
  const listBadges = (arr?: string[]) =>
    arr && arr.length ? arr.map(x => `<span class="badge">${esc(x)}</span>`).join(" ") : '<span class="muted">—</span>';

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"/>
<title>แผนการจัดการเรียนรู้ - ${esc(p.unit_title || "")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'TH Sarabun New','Sarabun','IBM Plex Sans Thai',sans-serif; font-size: 15pt; color:#111; margin:0; }
  h1 { font-size: 22pt; margin: 0 0 4px; text-align:center; }
  h2 { font-size: 16pt; margin: 18px 0 6px; color:#1e40af; border-bottom:1px solid #cbd5e1; padding-bottom:2px; }
  h3 { font-size: 14pt; margin: 10px 0 4px; color:#1e3a8a; }
  .muted { color:#888; font-style: italic; }
  .head { text-align:center; margin-bottom:8px; }
  .meta { display:grid; grid-template-columns: repeat(3, 1fr); gap:6px 14px; font-size: 13pt; margin: 8px 0 12px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; }
  .meta div b { color:#334155; }
  section { break-inside: avoid; margin-bottom: 8px; }
  .body { white-space: pre-wrap; }
  .badge { display:inline-block; padding:1px 8px; border:1px solid #94a3b8; border-radius:999px; font-size:12pt; margin:1px; background:#f1f5f9; }
  .review, .reflection { border-left: 4px solid #2563eb; padding:8px 12px; background:#eff6ff; margin: 10px 0; border-radius:4px; }
  .reflection { border-left-color:#059669; background:#ecfdf5; }
  .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
  .sign { margin-top: 40px; display:grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align:center; font-size: 13pt; }
  .sign .line { border-top:1px dotted #333; margin: 42px 20px 4px; }
  @media print { .no-print { display:none; } }
  .toolbar { position: sticky; top:0; background:#fff; padding:8px; border-bottom:1px solid #e2e8f0; display:flex; gap:8px; }
  .toolbar button { padding:6px 14px; border:1px solid #2563eb; background:#2563eb; color:#fff; border-radius:6px; cursor:pointer; font-size:14px; }
  .toolbar button.secondary { background:#fff; color:#2563eb; }
</style></head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
    <button class="secondary" onclick="window.close()">ปิด</button>
  </div>

  <div class="head">
    ${ctx.schoolName ? `<div style="font-size:13pt;">${esc(ctx.schoolName)}</div>` : ""}
    <h1>แผนการจัดการเรียนรู้</h1>
    <div>หน่วยที่ ${esc(p.unit_no)} · บทที่ ${esc(p.lesson_no)} — ${esc(p.unit_title)}</div>
    ${p.lesson_title ? `<div class="muted">${esc(p.lesson_title)}</div>` : ""}
  </div>

  <div class="meta">
    <div><b>วิชา:</b> ${esc(subj)}</div>
    <div><b>ชั้น/ห้อง:</b> ${esc(cls)}</div>
    <div><b>ครูผู้สอน:</b> ${esc(teacher)}</div>
    <div><b>ปีการศึกษา:</b> ${esc(p.academic_year)}</div>
    <div><b>ภาคเรียน:</b> ${esc(p.semester)}</div>
    <div><b>จำนวนคาบ:</b> ${esc(p.hours || 1)}</div>
    <div><b>มาตรฐาน:</b> ${esc(p.learning_standard || "-")}</div>
    <div style="grid-column: span 2;"><b>ตัวชี้วัด:</b> ${listBadges(p.indicators)}</div>
    <div><b>สถานะ:</b> ${esc(STATUS_LABEL[p.status] || p.status)}</div>
  </div>

  <h2>แผนการสอน</h2>
  ${section("จุดประสงค์การเรียนรู้", esc(p.objectives))}
  ${section("สาระสำคัญ", esc(p.key_concept))}
  ${section("สาระการเรียนรู้", esc(p.content))}
  ${section("กระบวนการจัดการเรียนรู้", esc(p.teaching_process))}
  ${section("สื่อ / แหล่งเรียนรู้", esc(p.materials))}

  <div class="grid2">
    ${section("วิธีวัดและประเมินผล", esc(p.assessment_method))}
    ${section("เกณฑ์การประเมิน", esc(p.assessment_criteria))}
  </div>

  <section><h3>สมรรถนะสำคัญ</h3><div>${listBadges(p.competencies)}</div></section>
  <section><h3>คุณลักษณะอันพึงประสงค์</h3><div>${listBadges(p.desired_characteristics)}</div></section>
  ${p.reading_thinking_writing ? section("การอ่าน คิดวิเคราะห์ เขียน", esc(p.reading_thinking_writing)) : ""}

  ${(p.post_reflection_outcomes || p.post_reflection_problems || p.post_reflection_improvements || p.post_reflection_notes) ? `
    <h2>บันทึกหลังการสอน</h2>
    <div class="reflection">
      ${p.post_reflection_taught_at ? `<div><b>วันที่สอน:</b> ${esc(formatDateBE(p.post_reflection_taught_at))}</div>` : ""}
      ${p.post_reflection_outcomes ? section("ผลการจัดการเรียนรู้", esc(p.post_reflection_outcomes)) : ""}
      ${p.post_reflection_problems ? section("ปัญหา / อุปสรรค", esc(p.post_reflection_problems)) : ""}
      ${p.post_reflection_improvements ? section("แนวทางแก้ไข / ปรับปรุง", esc(p.post_reflection_improvements)) : ""}
      ${p.post_reflection_notes ? section("ข้อสังเกต / ข้อเสนอแนะเพิ่มเติม", esc(p.post_reflection_notes)) : ""}
    </div>
  ` : ""}

  ${p.reviewer_note ? `
    <h2>ความเห็นผู้นิเทศ</h2>
    <div class="review">
      <div>${esc(p.reviewer_note)}</div>
      <div class="muted" style="font-size:12pt;margin-top:4px;">โดย ${esc(reviewer)} · ${p.reviewed_at ? esc(formatDateBE(p.reviewed_at)) : ""}</div>
    </div>` : ""}

  <div class="sign">
    <div><div class="line"></div>ครูผู้สอน<br/>(${esc(teacher)})</div>
    <div><div class="line"></div>ผู้นิเทศ / ผู้อำนวยการ<br/>${reviewer ? `(${esc(reviewer)})` : ""}</div>
  </div>

  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script>
</body></html>`;
}

export function printLessonPlan(p: any, ctx: LookupCtx = {}) {
  const html = buildLessonPlanHTML(p, ctx);
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function exportLessonPlanJSON(p: any) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lesson-plan-${(p.unit_title || "plan").replace(/[^\w\u0E00-\u0E7F-]+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
