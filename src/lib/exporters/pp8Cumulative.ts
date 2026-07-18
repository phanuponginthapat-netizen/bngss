import {
  ExportSchoolInfo,
  buildXlsxWithHeader,
  docHeaderHtml,
  openPrintWindow,
  sanitizeFn,
  signatureRowHtml,
} from "./common";

export interface PP8Record {
  student_code: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  classroom?: string;
  national_id?: string;
  date_of_birth?: string;
  gender?: string;
  attendance?: { total: number; present: number; absent: number; late: number; sick: number };
  behavior?: { positive: number; negative: number };
  home_visits?: number;
  health_records?: number;
}

const fullName = (s: PP8Record) =>
  `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();

export const printPP8 = (info: ExportSchoolInfo, students: PP8Record[]) => {
  const pages = students
    .map(
      (s) => `
      <section style="page-break-after:always;">
        ${docHeaderHtml(info, "ระเบียนสะสม (ปพ.8)", fullName(s))}
        <table>
          <tbody>
            <tr><th style="width:30%;">รหัสนักเรียน</th><td>${s.student_code}</td></tr>
            <tr><th>ชั้น</th><td>${s.grade_level || ""} ${s.classroom || ""}</td></tr>
            <tr><th>เลขประจำตัวประชาชน</th><td>${s.national_id || "-"}</td></tr>
            <tr><th>วันเกิด</th><td>${s.date_of_birth || "-"}</td></tr>
            <tr><th>เพศ</th><td>${s.gender || "-"}</td></tr>
          </tbody>
        </table>
        <h3 style="margin-top:14px;">สรุปการมาเรียน</h3>
        <table><thead><tr><th>ทั้งหมด</th><th>มา</th><th>ขาด</th><th>สาย</th><th>ป่วย</th></tr></thead>
          <tbody><tr class="text-center">
            <td>${s.attendance?.total ?? 0}</td>
            <td>${s.attendance?.present ?? 0}</td>
            <td>${s.attendance?.absent ?? 0}</td>
            <td>${s.attendance?.late ?? 0}</td>
            <td>${s.attendance?.sick ?? 0}</td>
          </tr></tbody>
        </table>
        <h3 style="margin-top:14px;">สรุปพฤติกรรม</h3>
        <table><thead><tr><th>คะแนนดี</th><th>คะแนนหัก</th><th>เยี่ยมบ้าน</th><th>บันทึกสุขภาพ</th></tr></thead>
          <tbody><tr class="text-center">
            <td>+${s.behavior?.positive ?? 0}</td>
            <td>${s.behavior?.negative ?? 0}</td>
            <td>${s.home_visits ?? 0}</td>
            <td>${s.health_records ?? 0}</td>
          </tr></tbody>
        </table>
        ${signatureRowHtml(info)}
      </section>`,
    )
    .join("");
  openPrintWindow(pages || "<p>— ไม่มีข้อมูล —</p>", "ปพ.8");
};

const aoa = (rows: PP8Record[]) =>
  rows.map((r, i) => [
    i + 1, r.student_code, r.prefix || "", r.first_name, r.last_name,
    r.national_id || "", r.grade_level || "", r.classroom || "", r.date_of_birth || "", r.gender || "",
    r.attendance?.total ?? 0, r.attendance?.present ?? 0, r.attendance?.absent ?? 0,
    r.attendance?.late ?? 0, r.attendance?.sick ?? 0,
    r.behavior?.positive ?? 0, r.behavior?.negative ?? 0,
    r.home_visits ?? 0, r.health_records ?? 0,
  ]);

export const exportPP8Sgs = (info: ExportSchoolInfo, classroomName: string, rows: PP8Record[]) => {
  buildXlsxWithHeader(
    info, "PP8-SGS", `ระเบียนสะสม (ปพ.8) ${classroomName}`,
    [["ลำดับ","รหัส","คำนำหน้า","ชื่อ","นามสกุล","เลข ปชช.","ระดับ","ห้อง","วันเกิด","เพศ","มาเรียน_ทั้งหมด","มา","ขาด","สาย","ป่วย","พฤติกรรมดี","พฤติกรรมหัก","เยี่ยมบ้าน","บันทึกสุขภาพ"], ...aoa(rows)],
    `PP8_SGS_${sanitizeFn(classroomName)}.xlsx`,
  );
};

export const exportPP8SchoolMis = (info: ExportSchoolInfo, classroomName: string, rows: PP8Record[]) => {
  buildXlsxWithHeader(
    info, "PP8-SchoolMIS", `ระเบียนสะสม (ปพ.8) ${classroomName}`,
    [["NO","STUDENT_CODE","PREFIX","FIRST_NAME","LAST_NAME","CITIZEN_ID","LEVEL","ROOM","DOB","GENDER","ATT_TOTAL","PRESENT","ABSENT","LATE","SICK","BEH_POS","BEH_NEG","HOME_VISITS","HEALTH_RECS"], ...aoa(rows)],
    `PP8_SchoolMIS_${sanitizeFn(classroomName)}.xlsx`,
  );
};
