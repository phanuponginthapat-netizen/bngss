import { describe, expect, it } from "vitest";
import { facegateNotificationAlertId } from "../FacegateNotificationPhoto";

describe("FaceGate notification evidence reference", () => {
  it("reads the exact alert referenced by a notification", () => {
    expect(facegateNotificationAlertId({ reference_type: "kiosk_agent_alerts", reference_id: "alert-1" })).toBe("alert-1");
  });
  it("supports the inbox reference table", () => {
    expect(facegateNotificationAlertId({ reference_table: "kiosk_agent_alerts", reference_id: "alert-2" })).toBe("alert-2");
  });
  it("does not substitute evidence from unrelated notifications", () => {
    expect(facegateNotificationAlertId({ reference_type: "leave_requests", reference_id: "alert-1" })).toBeNull();
  });
  it("does not guess an alert when the reference is missing", () => {
    expect(facegateNotificationAlertId({ reference_type: "kiosk_agent_alerts" })).toBeNull();
  });
});