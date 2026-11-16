import { describe, expect, it } from "vitest";
import { requireOfficeSourceReady } from "../office/sourceReadState";
describe("office source read safety", () => {
  it("blocks export while loading", () => { expect(() => requireOfficeSourceReady(true, null)).toThrow("กำลังอ่านไฟล์"); });
  it("blocks export after read failure", () => { expect(() => requireOfficeSourceReady(false, "unreadable")).toThrow("เปิดไฟล์ไม่สำเร็จ"); });
  it("allows a new or successfully opened file", () => { expect(() => requireOfficeSourceReady(false, null)).not.toThrow(); });
});