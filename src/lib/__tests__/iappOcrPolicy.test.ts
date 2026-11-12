// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateOcrResult, OCR_MAX_BYTES, OCR_MAX_PAGES } from "../../../supabase/functions/iapp-document-markdown/policy";
const page = (n: number) => ({ page: n, markdown: `หน้า ${n}`, truncated: false });
describe("iApp document integrity", () => {
  it("keeps merged table cells and authoritative totals unchanged", () => {
    const markdown = '<table><tr><td rowspan="2">คะแนนรวม 83</td></tr></table>';
    expect(validateOcrResult({ markdown, pages: [page(1)], iapp: { page: 1 } }, 1).text).toBe(markdown);
  });
  it("rejects missing pages", () => { expect(() => validateOcrResult({ markdown: "หน้า 1", pages: [page(1)], iapp: { page: 1 } }, 2)).toThrow(); });
  it("rejects truncated pages", () => { expect(() => validateOcrResult({ markdown: "บางส่วน", pages: [{ ...page(1), truncated: true }], iapp: { page: 1 } }, 1)).toThrow(); });
  it("rejects shuffled page numbers", () => { expect(() => validateOcrResult({ markdown: "ข้อความ", pages: [page(2), page(1)], iapp: { page: 2 } }, 2)).toThrow(); });
  it("rejects blank pages", () => { expect(() => validateOcrResult({ markdown: "ข้อความ", pages: [{ ...page(1), markdown: " " }], iapp: { page: 1 } }, 1)).toThrow(); });
  it("retains 20000 characters and rejects 20001 rather than truncating", () => {
    const payload = (n: number) => ({ markdown: "ก".repeat(n), pages: [page(1)], iapp: { page: 1 } });
    expect(validateOcrResult(payload(20000), 1).text.length).toBe(20000);
    expect(() => validateOcrResult(payload(20001), 1)).toThrow();
  });
  it("keeps existing attachment limits", () => { expect(OCR_MAX_BYTES).toBe(8388608); expect(OCR_MAX_PAGES).toBe(50); });
});