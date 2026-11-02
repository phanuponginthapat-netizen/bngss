// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canTestNotification } from "../notificationTest";
describe("notification test availability", () => {
  it("allows a signed-in native user despite unsupported web push", () => expect(canTestNotification("u", false, true, "unsupported")).toBe(true));
  it("does not enable signed-out or busy testing", () => {
    expect(canTestNotification(null, false, true, "subscribed")).toBe(false);
    expect(canTestNotification("u", true, true, "subscribed")).toBe(false);
  });
  it("requires a subscribed web browser", () => {
    expect(canTestNotification("u", false, false, "default")).toBe(false);
    expect(canTestNotification("u", false, false, "subscribed")).toBe(true);
  });
});