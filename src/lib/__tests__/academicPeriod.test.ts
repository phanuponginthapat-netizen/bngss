import { describe, expect, it } from "vitest";
import { resolveAcademicPeriod, type AcademicPeriodRow } from "../academicPeriod";

// ปฏิทินจริงของโรงเรียน (ปีการศึกษา 2569)
// ภาคเรียนที่ 1: 16 พ.ค. 2569 (2026-05-16) – 10 ต.ค. 2569 (2026-10-10)
// ภาคเรียนที่ 2: เปิด 2 พ.ย. 2569 (2026-11-02) – 31 มี.ค. 2570 (2027-03-31)
const SCHOOL_PERIODS: AcademicPeriodRow[] = [
  { academic_year_be: 2569, semester: 1, start_date: "2026-05-16", end_date: "2026-10-10" },
  { academic_year_be: 2569, semester: 2, start_date: "2026-11-02", end_date: "2027-03-31" },
];

describe("resolveAcademicPeriod — ภาคเรียนที่ 2 เปิด 2 พฤศจิกายน 2569", () => {
  it("วันสุดท้ายของภาคเรียนที่ 1 ยังเป็นภาคเรียนที่ 1", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2026-10-10")).toMatchObject({
      yearBE: 2569,
      semester: 1,
      basis: "in-period",
    });
  });

  it("1 พฤศจิกายน (ก่อนเปิด 1 วัน) ต้องยังไม่跳到ภาคเรียนที่ 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2026-11-01")).toMatchObject({
      yearBE: 2569,
      semester: 1,
      basis: "recent-past",
    });
  });

  it("2 พฤศจิกายน วันเปิดเรียนจริง คือภาคเรียนที่ 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2026-11-02")).toMatchObject({
      yearBE: 2569,
      semester: 2,
      basis: "in-period",
    });
  });

  it("กลางภาคเรียนที่ 2 เป็นภาคเรียนที่ 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2027-02-01")).toMatchObject({
      yearBE: 2569,
      semester: 2,
    });
  });

  it("วันปิดภาคเรียน (31 มี.ค.) ยังนับเป็นภาคเรียนที่ 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2027-03-31")).toMatchObject({
      yearBE: 2569,
      semester: 2,
    });
  });

  it("หลังปิดภาคเรียนแล้ว ใช้คาบที่เพิ่งผ่านไป", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2027-04-20")).toMatchObject({
      yearBE: 2569,
      semester: 2,
      basis: "recent-past",
    });
  });

  it("ข้อมูลคาบเรียนเก่าค้าง (ห่างเกิน 180 วัน) ไม่ถูกใช้เป็นภาคเรียนปัจจุบัน", () => {
    const stale: AcademicPeriodRow[] = [
      { academic_year_be: 2567, semester: 2, start_date: "2024-11-01", end_date: "2025-03-31" },
    ];
    expect(resolveAcademicPeriod(stale, "2026-10-30")).toBeNull();
  });

  it("ไม่มีข้อมูลภาคเรียน → null ให้คำนวณจากเดือนต่อ", () => {
    expect(resolveAcademicPeriod([], "2026-11-02")).toBeNull();
  });

  it("วันที่/ภาคเรียนเสีย (semester = 3) ถูกรับ ไม่พัง", () => {
    const bad: AcademicPeriodRow[] = [
      { academic_year_be: 2569, semester: 3, start_date: "2026-11-02", end_date: "2027-03-31" },
      { academic_year_be: 2569, semester: 2, start_date: "2026-11-02", end_date: "2027-03-31" },
    ];
    expect(resolveAcademicPeriod(bad, "2026-11-05")).toMatchObject({ semester: 2 });
  });
});
