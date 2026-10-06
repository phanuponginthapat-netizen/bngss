import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parsePP5Workbook } from "../pp5AutoParser";
describe("ปพ.5 อิเล็กทรอนิกส์ — สรุปตัดสินผลการเรียน", () => {
  it("อ่านคะแนน เกรด และผลประเมิน 3 ด้านจากไฟล์จริง", async () => {
    const b = readFileSync(__dirname + "/fixtures/pp5-sample.xlsx");
    const r = await parsePP5Workbook(new Uint8Array(b) as any);
    const s = r.consolidated.find((c) => c.studentCode === "2654")!;
    const v = Object.values(s.perSubject)[0];
    expect(v.totalScore).toBe(71);
    expect(v.grade).toBe("3");
    expect(v.readingResult).toBe("ดี");
    expect(v.characterResult).toBe("ดีเยี่ยม");
    expect(v.finalDecision).toBe("ผ่าน");
    expect(v.attendanceHours).toBe(20);
  });
});
