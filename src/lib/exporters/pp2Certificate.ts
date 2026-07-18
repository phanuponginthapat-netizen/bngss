import {
  ExportSchoolInfo,
  beYear,
  buildXlsxWithHeader,
  docHeaderHtml,
  openPrintWindow,
  sanitizeFn,
  signatureRowHtml,
} from "./common";

export interface PP2Cert {
  student_code: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  completion_date?: string; // YYYY-MM-DD
  national_id?: string;
}

const fullName = (s: PP2Cert) =>
  `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();

/** ปพ.2 — PDF print (single or batch certificates) */
export const printPP2 = (info: ExportSchoolInfo, level: string, students: PP2Cert[]) => {
  const pages = students
    .map(
      (s) => `
      <section style="page-break-after:always; text-align:center;">
        ${docHeaderHtml(info, "ประกาศนียบัตร (ปพ.2)", "หลักฐานแสดงวุฒิการศึกษา")}
        <p style="font-size:16pt; margin-top:24pt;">ประกาศนียบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>
        <div style="margin:18pt 0; padding:8pt 0; border-top:1px solid #999; border-bottom:1px solid #999;">
          <p style="font-size:20pt; font-weight:700;">${fullName(s)}</p>
          <p style="font-size:14pt;">เลขประจำตัว ${s.student_code}</p>
        </div>
        <p style="font-size:16pt;">ได้สำเร็จการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
        <p style="font-size:18pt; font-weight:700;">ระดับชั้น${s.grade_level || level}</p>
        <p style="font-size:16pt;">จาก${info.school_name}</p>
        ${s.completion_date ? `<p style="font-size:14pt; margin-top:6pt;">เมื่อวันที่ ${s.completion_date}</p>` : ""}
        ${signatureRowHtml(info)}
      </section>`,
    )
    .join("");
  openPrintWindow(pages || "<p>— ไม่มีนักเรียน —</p>", `ปพ.2-${level}`);
};

const buildRows = (students: PP2Cert[]) =>
  students.map((s, i) => [
    i + 1,
    s.student_code,
    s.prefix || "",
    s.first_name,
    s.last_name,
    s.national_id || "",
    s.grade_level || "",
    s.completion_date || "",
  ]);

export const exportPP2Sgs = (info: ExportSchoolInfo, level: string, students: PP2Cert[]) => {
  buildXlsxWithHeader(
    info,
    "PP2-SGS",
    `ทะเบียนประกาศนียบัตร (ปพ.2) ${level}`,
    [
      ["ลำดับ", "รหัส", "คำนำหน้า", "ชื่อ", "นามสกุล", "เลข ปชช.", "ระดับ", "วันที่จบ"],
      ...buildRows(students),
    ],
    `PP2_SGS_${sanitizeFn(level)}.xlsx`,
  );
};

export const exportPP2SchoolMis = (info: ExportSchoolInfo, level: string, students: PP2Cert[]) => {
  buildXlsxWithHeader(
    info,
    "PP2-SchoolMIS",
    `ทะเบียนประกาศนียบัตร (ปพ.2) ${level}`,
    [
      ["NO", "STUDENT_CODE", "PREFIX", "FIRST_NAME", "LAST_NAME", "CITIZEN_ID", "LEVEL", "COMPLETION_DATE"],
      ...buildRows(students),
    ],
    `PP2_SchoolMIS_${sanitizeFn(level)}.xlsx`,
  );
};
