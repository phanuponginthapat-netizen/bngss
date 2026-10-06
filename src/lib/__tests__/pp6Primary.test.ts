import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parsePP5Workbook } from "../pp5AutoParser";
describe("ปพ.6 ประถม — ไฟล์จริง ป.2", () => {
  it("อ่านนักเรียน 14 คน 11 วิชา เกรดจาก รศ.1 และผลประเมิน", async () => {
    const r = await parsePP5Workbook(new Uint8Array(readFileSync(__dirname + "/fixtures/pp6-sample.xlsx")) as any);
    expect(r.consolidated.length).toBe(14);
    const s: any = r.consolidated.find((c) => c.studentCode === "2721")!.perSubject;
    expect(Object.keys(s).length).toBe(11);
    expect(s["ภาษาไทย"].grade).toBe("2");
    expect(s["วิทยาศาสตร์และเทคโนโลยี"].totalScore).toBe(67.5);
    expect(s["การงานอาชีพ"].grade).toBe("4");
    expect(s["ภาษาไทย"].characterResult).toBe("ดี");
    expect(s["ภาษาไทย"].activityResult).toBe("ผ่าน");
  });
});
