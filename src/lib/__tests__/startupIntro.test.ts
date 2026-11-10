import { describe, expect, it } from "vitest";
import { canRevealStartup } from "../startupIntro";
describe("startup reveal requires video and current page readiness", () => {
  it("waits for video end even when data is ready", () => expect(canRevealStartup(false, true, 0, 0)).toBe(false));
  it("waits for authentication readiness", () => expect(canRevealStartup(true, false, 0, 0)).toBe(false));
  it("waits for page loaders and active data reads", () => {
    expect(canRevealStartup(true, true, 1, 0)).toBe(false);
    expect(canRevealStartup(true, true, 0, 1)).toBe(false);
  });
  it("reveals only after both requirements finish", () => expect(canRevealStartup(true, true, 0, 0)).toBe(true));
});