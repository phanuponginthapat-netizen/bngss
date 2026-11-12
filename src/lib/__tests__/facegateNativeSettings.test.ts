import { describe, expect, it } from "vitest";
import { facegateDefaults, facegateSettingsPatch } from "@/components/kiosk/facegateSettings";
describe("native FaceGate settings", () => {
  it("retains the school's fixed two-second pause", () => {
    expect(facegateSettingsPatch(facegateDefaults).next_person_delay_seconds).toBe(2);
  });
  it("rejects invalid camera rotation", () => {
    expect(() => facegateSettingsPatch({ ...facegateDefaults, kiosk_camera_rotate: 45 })).toThrow();
  });
  it("rejects invalid match threshold", () => {
    expect(() => facegateSettingsPatch({ ...facegateDefaults, match_threshold: NaN })).toThrow();
  });
});