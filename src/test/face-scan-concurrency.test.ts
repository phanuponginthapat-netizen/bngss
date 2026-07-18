// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ทดสอบการป้องกันการบันทึกซ้ำเมื่อมีการสแกนพร้อมกันจากหลายจุด
 * (ครูสแกนผ่านมือถือ + ตู้คีออส 2 ตู้)
 *
 * Contract ที่ต้องการ:
 *   - เมื่อหลายจุดส่ง INSERT มาที่ face_scan_logs สำหรับ
 *     (student_id, scan_date, scan_type) เดียวกันพร้อมกัน
 *   - Postgres unique index `face_scan_logs_unique_per_day` จะอนุญาตให้
 *     สำเร็จเพียง 1 ครั้ง ส่วน request อื่นๆ จะได้ error code 23505
 *   - โค้ดฝั่ง client (FaceScanTab / FaceKioskPage) ต้องตีความ 23505
 *     ว่าเป็น "สแกนซ้ำ" ไม่ใช่ error
 */

type InsertResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { code: string; message: string } };

/**
 * Mock พฤติกรรมของ Postgres unique index:
 * เก็บ key (student_id|scan_date|scan_type) ใน Set
 * - ถ้ายังไม่มี → insert สำเร็จ
 * - ถ้ามีแล้ว → คืน 23505 (unique_violation)
 *
 * ใช้ Promise.resolve เพื่อจำลอง atomic behavior ของ DB
 * (จริงๆ DB เป็น serializable ใน scope ของ unique index)
 */
function createMockFaceScanInsert() {
  const seen = new Set<string>();
  return async (
    studentId: string,
    scanDate: string,
    scanType: string,
  ): Promise<InsertResult> => {
    // จำลอง network latency แบบสุ่ม 0-10ms
    await new Promise((r) => setTimeout(r, Math.random() * 10));
    const key = `${studentId}|${scanDate}|${scanType}`;
    if (seen.has(key)) {
      return {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "face_scan_logs_unique_per_day"',
        },
      };
    }
    seen.add(key);
    return { data: { id: crypto.randomUUID() }, error: null };
  };
}

/**
 * จำลอง handler ของ recordScan ที่ใช้จริงใน FaceKioskPage/FaceScanTab
 * - คืน "success" 1 ครั้งสำหรับ insert ที่สำเร็จ
 * - คืน "duplicate" สำหรับ insert ที่ได้ 23505
 * - คืน "error" สำหรับ error อื่นๆ
 */
async function recordScan(
  insertFn: ReturnType<typeof createMockFaceScanInsert>,
  studentId: string,
  scanDate: string,
  scanType: string,
): Promise<"success" | "duplicate" | "error"> {
  const { data, error } = await insertFn(studentId, scanDate, scanType);
  if (error) {
    if (error.code === "23505") return "duplicate";
    return "error";
  }
  if (!data) return "duplicate";
  return "success";
}

describe("Face scan concurrency: หลายจุดสแกนพร้อมกัน", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("3 จุดสแกนนักเรียนคนเดียวกันพร้อมกัน → บันทึกสำเร็จแค่ 1 ครั้ง", async () => {
    const insert = createMockFaceScanInsert();
    const studentId = "stu-001";
    const today = new Date().toISOString().slice(0, 10);

    // ครูมือถือ + คีออส A + คีออส B ยิงพร้อมกัน
    const results = await Promise.all([
      recordScan(insert, studentId, today, "entry"), // มือถือครู
      recordScan(insert, studentId, today, "entry"), // คีออส A
      recordScan(insert, studentId, today, "entry"), // คีออส B
    ]);

    const successCount = results.filter((r) => r === "success").length;
    const duplicateCount = results.filter((r) => r === "duplicate").length;
    const errorCount = results.filter((r) => r === "error").length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(2);
    expect(errorCount).toBe(0);
  });

  it("10 จุดยิงพร้อมกันสำหรับนักเรียนคนเดียว → success = 1, duplicate = 9", async () => {
    const insert = createMockFaceScanInsert();
    const studentId = "stu-002";
    const today = new Date().toISOString().slice(0, 10);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => recordScan(insert, studentId, today, "entry")),
    );

    expect(results.filter((r) => r === "success")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(9);
    expect(results.filter((r) => r === "error")).toHaveLength(0);
  });

  it("นักเรียนคนละคนสแกนพร้อมกัน → บันทึกสำเร็จทั้งหมด ไม่บล็อกซึ่งกันและกัน", async () => {
    const insert = createMockFaceScanInsert();
    const today = new Date().toISOString().slice(0, 10);

    const results = await Promise.all([
      recordScan(insert, "stu-A", today, "entry"),
      recordScan(insert, "stu-B", today, "entry"),
      recordScan(insert, "stu-C", today, "entry"),
      recordScan(insert, "stu-D", today, "entry"),
    ]);

    expect(results.every((r) => r === "success")).toBe(true);
  });

  it("คนเดียวกันแต่คนละประเภท (entry vs assembly) → บันทึกได้ทั้งคู่", async () => {
    const insert = createMockFaceScanInsert();
    const today = new Date().toISOString().slice(0, 10);

    const results = await Promise.all([
      recordScan(insert, "stu-E", today, "entry"),
      recordScan(insert, "stu-E", today, "assembly"),
    ]);

    expect(results).toEqual(["success", "success"]);
  });

  it("วันต่างกัน → บันทึกได้ทั้งคู่", async () => {
    const insert = createMockFaceScanInsert();

    const results = await Promise.all([
      recordScan(insert, "stu-F", "2026-05-18", "entry"),
      recordScan(insert, "stu-F", "2026-05-19", "entry"),
    ]);

    expect(results).toEqual(["success", "success"]);
  });

  it("burst 50 requests ใน 1 ms → ยังเหลือ 1 success เท่านั้น (stress test)", async () => {
    const insert = createMockFaceScanInsert();
    const studentId = "stu-burst";
    const today = new Date().toISOString().slice(0, 10);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => recordScan(insert, studentId, today, "entry")),
    );

    expect(results.filter((r) => r === "success")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(49);
  });

  it("error อื่นที่ไม่ใช่ 23505 ต้องถูกแยกออกจาก duplicate", async () => {
    const insert = vi.fn(async (): Promise<InsertResult> => ({
      data: null,
      error: { code: "42501", message: "permission denied" },
    }));

    const r = await recordScan(insert as any, "stu-X", "2026-05-18", "entry");
    expect(r).toBe("error");
  });
});
