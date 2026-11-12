// @vitest-environment node
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parsePP5Workbook } from "../pp5AutoParser";

describe("individual learner activity outcomes", () => {
  it("reads ผ and มผ independently, without deriving missing outcomes from the combined result", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["เลขที่", "เลขประจำตัว", "ชื่อ - สกุล", "ภาษาไทย"],
      [1, "2845", "ทดสอบ", 83],
    ]), "คะแนนสอบ");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["เลขที่", "เลขประจำตัว", "ชื่อ - สกุล", "กิจกรรมพัฒนาผู้เรียน", null, null, null],
      [null, null, null, "แนะแนว", "ลูกเสือ-เนตรนารี", "ชุมนุม", "กิจกรรม"],
      [1, "2845", "ทดสอบ", "ผ่าน", "มผ", null, "ผ่าน"],
    ]), "ข้อมูลกิจกรรม");
    const parsed = await parsePP5Workbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const outcomes = parsed.consolidated[0].perSubject;
    expect(outcomes["แนะแนว"]?.grade).toBe("ผ");
    expect(outcomes["ลูกเสือ"]?.grade).toBe("มผ");
    expect(outcomes["ชุมนุม"]).toBeUndefined();
    expect(outcomes["แนะแนว"]?.totalScore).toBeUndefined();
  });
});