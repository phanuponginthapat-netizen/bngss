// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isExpiredFcmToken } from "../../../supabase/functions/_shared/fcmErrors";
describe("native device token preservation", () => {
  it("does not delete tokens on project-level NOT_FOUND", () => expect(isExpiredFcmToken(JSON.stringify({ error: { status: "NOT_FOUND", message: "Project not found" } }))).toBe(false));
  it("removes only explicitly unregistered device tokens", () => expect(isExpiredFcmToken(JSON.stringify({ error: { details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } }))).toBe(true));
  it("preserves tokens for unreadable provider errors", () => expect(isExpiredFcmToken("upstream unavailable")).toBe(false));
});