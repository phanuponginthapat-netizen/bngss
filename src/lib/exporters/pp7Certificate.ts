import {
  ExportSchoolInfo,
  buildXlsxWithHeader,
  docHeaderHtml,
  openPrintWindow,
  sanitizeFn,
  signatureRowHtml,
} from "./common";

export interface PP7Cert {
  student_code: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  classroom?: string;
  status?: string;
  gpa?: number | string;
  total_credits?: number;
  purpose?: string;
  national_id?: string;
}

const fullName = (s: PP7Cert) =>
  `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();

export const printPP7 = (info: ExportSchoolInfo, students: PP7Cert[]) => {
  const pages = students
    .map(
      (s) => `
      <section style="page-break-after:always;">
        ${docHeaderHtml(info, "ใบรับรองผลการศึกษา (ปพ.7)")}
        <p style="text-indent:36pt;">หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า</p>
        <div style="margin:12pt 36pt;">
          <p><strong>ชื่อ-สกุล:</strong> ${fullName(s)}</p>
          <p><strong>เลขประจำตัว:</strong> ${s.student_code}</p>
          ${s.classroom ? `<p><strong>ชั้น:</strong> ${s.classroom}</p>` : ""}
          <p><strong>สถานะ:</strong> ${s.status || "กำลังศึกษาอยู่"}</p>
        </div>
        ${s.gpa != null ? `<p style="text-indent:36pt;">มีผลการเรียนเฉลี่ยสะสม (GPA) เท่ากับ <strong>${s.gpa}</strong>${s.total_credits ? ` จากหน่วยกิตรวม ${s.total_credits} หน่วยกิต` : ""}</p>` : ""}
        <p style="text-indent:36pt; margin-top:8pt;">ออกใบรับรองฉบับนี้ให้เพื่อประกอบการ${s.purpose || "ใช้ตามวัตถุประสงค์"}</p>
        ${signatureRowHtml(info)}
      </section>`,
    )
    .join("");
  openPrintWindow(pages || "<p>— ไม่มีข้อมูล —</p>", "ปพ.7");
};

const aoa = (rows: PP7Cert[]) =>
  rows.map((r, i) => [
    i + 1, r.student_code, r.prefix || "", r.first_name, r.last_name,
    r.national_id || "", r.classroom || "", r.status || "", r.gpa ?? "", r.total_credits ?? "", r.purpose || "",
  ]);

export const exportPP7Sgs = (info: ExportSchoolInfo, rows: PP7Cert[]) => {
  buildXlsxWithHeader(
    info, "PP7-SGS", "ทะเบียนใบรับรองผลการศึกษา (ปพ.7)",
    [["ลำดับ", "รหัส", "คำนำหน้า", "ชื่อ", "นามสกุล", "เลข ปชช.", "ชั้น", "สถานะ", "GPA", "หน่วยกิต", "วัตถุประสงค์"], ...aoa(rows)],
    `PP7_SGS.xlsx`,
  );
};

export const exportPP7SchoolMis = (info: ExportSchoolInfo, rows: PP7Cert[]) => {
  buildXlsxWithHeader(
    info, "PP7-SchoolMIS", "ทะเบียนใบรับรองผลการศึกษา (ปพ.7)",
    [["NO", "STUDENT_CODE", "PREFIX", "FIRST_NAME", "LAST_NAME", "CITIZEN_ID", "CLASS", "STATUS", "GPA", "CREDITS", "PURPOSE"], ...aoa(rows)],
    `PP7_SchoolMIS.xlsx`,
  );
};
