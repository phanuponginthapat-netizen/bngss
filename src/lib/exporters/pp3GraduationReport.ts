import {
  ExportSchoolInfo,
  beYear,
  buildXlsxWithHeader,
  docHeaderHtml,
  openPrintWindow,
  sanitizeFn,
  signatureRowHtml,
} from "./common";

export interface PP3Graduate {
  student_code: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  national_id?: string;
  birth_date?: string;
  graduation_year?: number | string;
  graduation_level?: string;
  graduation_gpa?: number | string;
}

const fullName = (s: PP3Graduate) =>
  `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();

/** ปพ.3 — PDF print */
export const printPP3 = (info: ExportSchoolInfo, level: string, graduates: PP3Graduate[]) => {
  const rows = graduates
    .map(
      (g, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${g.student_code}</td>
        <td>${fullName(g)}</td>
        <td class="text-center">${g.national_id || "-"}</td>
        <td class="text-center">${g.birth_date || "-"}</td>
        <td class="text-center">${g.graduation_year ? beYear(g.graduation_year) : "-"}</td>
        <td class="text-center">${g.graduation_gpa ?? "-"}</td>
      </tr>`,
    )
    .join("");

  const html = `
    ${docHeaderHtml(info, "แบบรายงานผู้สำเร็จการศึกษา (ปพ.3)", `ระดับชั้น ${level}`)}
    <table>
      <thead><tr>
        <th>ที่</th><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th>
        <th>เลขประจำตัว ปชช.</th><th>วันเกิด</th><th>ปีที่จบ</th><th>GPA</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="text-center">— ไม่มีผู้จบการศึกษา —</td></tr>`}</tbody>
    </table>
    ${signatureRowHtml(info)}
  `;
  openPrintWindow(html, `ปพ.3-${level}`);
};

const buildRows = (graduates: PP3Graduate[]) =>
  graduates.map((g, i) => [
    i + 1,
    g.student_code,
    g.prefix || "",
    g.first_name,
    g.last_name,
    g.national_id || "",
    g.birth_date || "",
    g.graduation_level || "",
    g.graduation_year ? beYear(g.graduation_year) : "",
    g.graduation_gpa ?? "",
  ]);

/** ปพ.3 — Excel SGS */
export const exportPP3Sgs = (info: ExportSchoolInfo, level: string, graduates: PP3Graduate[]) => {
  const rows: any[][] = [
    ["ลำดับ", "รหัส", "คำนำหน้า", "ชื่อ", "นามสกุล", "เลข ปชช.", "วันเกิด", "ระดับ", "ปีที่จบ พ.ศ.", "GPA"],
    ...buildRows(graduates),
  ];
  buildXlsxWithHeader(
    info,
    "PP3-SGS",
    `แบบรายงานผู้สำเร็จการศึกษา (ปพ.3) ระดับ ${level} — SGS`,
    rows,
    `PP3_SGS_${sanitizeFn(level)}.xlsx`,
  );
};

/** ปพ.3 — Excel SchoolMIS */
export const exportPP3SchoolMis = (info: ExportSchoolInfo, level: string, graduates: PP3Graduate[]) => {
  const rows: any[][] = [
    ["NO", "STUDENT_CODE", "PREFIX", "FIRST_NAME", "LAST_NAME", "CITIZEN_ID", "BIRTHDATE", "LEVEL", "GRAD_YEAR_BE", "GPA"],
    ...buildRows(graduates),
  ];
  buildXlsxWithHeader(
    info,
    "PP3-SchoolMIS",
    `แบบรายงานผู้สำเร็จการศึกษา (ปพ.3) ระดับ ${level} — SchoolMIS`,
    rows,
    `PP3_SchoolMIS_${sanitizeFn(level)}.xlsx`,
  );
};

/** ปพ.3 — CSV/XML DMC spec */
export const exportPP3Dmc = (info: ExportSchoolInfo, level: string, graduates: PP3Graduate[]) => {
  const xmlRows = graduates
    .map(
      (g) => `  <Graduate>
    <StudentCode>${g.student_code}</StudentCode>
    <Prefix>${g.prefix || ""}</Prefix>
    <FirstName>${g.first_name}</FirstName>
    <LastName>${g.last_name}</LastName>
    <CitizenId>${g.national_id || ""}</CitizenId>
    <BirthDate>${g.birth_date || ""}</BirthDate>
    <Level>${g.graduation_level || level}</Level>
    <GradYearBE>${g.graduation_year ? beYear(g.graduation_year) : ""}</GradYearBE>
    <GPA>${g.graduation_gpa ?? ""}</GPA>
  </Graduate>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DMC_GraduationReport>
  <School>
    <Name>${info.school_name}</Name>
    <ObecCode>${info.obec_code || ""}</ObecCode>
    <Affiliation>${info.affiliation || ""}</Affiliation>
    <AcademicYearBE>${beYear(info.academic_year as any)}</AcademicYearBE>
    <Level>${level}</Level>
  </School>
  <Graduates count="${graduates.length}">
${xmlRows}
  </Graduates>
</DMC_GraduationReport>`;

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PP3_DMC_${sanitizeFn(level)}.xml`;
  a.click();
  URL.revokeObjectURL(url);
};
