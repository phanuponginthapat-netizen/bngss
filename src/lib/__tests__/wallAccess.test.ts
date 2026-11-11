// @vitest-environment node
import { describe, expect, it } from "vitest";
import { wallInteractionAllowed } from "../wallAccess";
describe("homepage feed interaction policy", () => {
  it("disallows reactions and comments for signed-in homepage visitors", () => {
    expect(wallInteractionAllowed(true, "signed-in-user")).toBe(false);
  });
  it("disallows reactions and comments for anonymous homepage visitors", () => {
    expect(wallInteractionAllowed(true, null)).toBe(false);
  });
  it("preserves signed-in interactions on the school feed", () => {
    expect(wallInteractionAllowed(false, "signed-in-user")).toBe(true);
  });
});