// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isPlannedOffline, isStudentBrowser } from "../../../supabase/functions/_shared/kioskOfflinePolicy";

const at = (hhmm: string) => Date.parse(`2026-11-17T${hhmm}:00+07:00`);
const sched = { power_saving_enabled: true, power_off_time: "18:00" };

describe("kiosk offline alerts", () => {
  it("never alerts for student Safe Browser laptops", () => {
    expect(isStudentBrowser("Safe Browser (Windows)")).toBe(true);
    expect(isStudentBrowser("FaceGate Windows")).toBe(false);
  });
  it("skips a shutdown ordered by staff", () => {
    expect(isPlannedOffline(at("10:00"), {}, [{ action: "shutdown", consumed_at: new Date(at("09:59")).toISOString() }])).toBe(true);
  });
  it("skips the scheduled power-off time", () => {
    expect(isPlannedOffline(at("18:02"), sched, [])).toBe(true);
  });
  it("alerts when the scanner dies on its own", () => {
    expect(isPlannedOffline(at("10:00"), sched, [])).toBe(false);
    expect(isPlannedOffline(at("10:00"), {}, [{ action: "shutdown", consumed_at: new Date(at("08:00")).toISOString() }])).toBe(false);
  });
});

import { isScannerDevice } from "../../../supabase/functions/_shared/kioskOfflinePolicy";
describe("isScannerDevice", () => {
  it("หน้า agent เครื่องนักเรียน (ไม่มี Device Key) ไม่ใช่ตู้สแกน", () => expect(isScannerDevice({ platform: null, kiosk_mode: null, device_key: null })).toBe(false));
  it("ตู้หน้าประตูเป็นตู้สแกน", () => expect(isScannerDevice({ kiosk_mode: "door" })).toBe(true));
  it("FaceGate ที่มี Device Key เป็นตู้สแกน", () => expect(isScannerDevice({ device_key: "abc" })).toBe(true));
  it("Safe Browser ไม่ใช่ตู้สแกนแม้มี Device Key", () => expect(isScannerDevice({ platform: "Safe Browser (Windows)", device_key: "abc" })).toBe(false));
});
