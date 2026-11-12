// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluateSchoolScan, bangkokScanMinutes } from "../../../supabase/functions/_shared/schoolScanPolicy";
const settings = { face_scan_entry_window: "06:00-11:00", face_scan_exit_window: "", face_scan_mode_cutoff: "13:00" };
describe("school settings shared by face and QR", () => {
  it("opens entry at 06:00", () => expect(evaluateSchoolScan(settings, 360, "in").allowed).toBe(true));
  it("blocks entry before 06:00", () => expect(evaluateSchoolScan(settings, 359, "in").allowed).toBe(false));
  it("closes entry exactly at 11:00", () => expect(evaluateSchoolScan(settings, 660, "in").allowed).toBe(false));
  it("allows entry at 10:59", () => expect(evaluateSchoolScan(settings, 659, "in").allowed).toBe(true));
  it("switches auto to exit at 13:00", () => expect(evaluateSchoolScan(settings, 780).direction).toBe("out"));
  it("does not restrict an empty exit window", () => expect(evaluateSchoolScan(settings, 1100, "out").allowed).toBe(true));
  it("uses Bangkok time", () => expect(bangkokScanMinutes(new Date("2026-11-12T04:00:00Z"))).toBe(660));
  it("rejects malformed settings", () => expect(() => evaluateSchoolScan({ ...settings, face_scan_entry_window: "25:00-26:00" }, 660)).toThrow());
});