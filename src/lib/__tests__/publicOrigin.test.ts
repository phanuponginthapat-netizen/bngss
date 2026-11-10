import { describe, expect, it } from "vitest";
import { getSchoolPublicOrigin } from "../publicOrigin";

describe("public school links", () => {
  it.each(["https://www.bngss.online", "https://bngss.online", "https://bngss.lovable.app"])("preserves %s", origin => {
    expect(getSchoolPublicOrigin(origin)).toBe(origin);
  });
  it("never shares a local or preview address", () => {
    expect(getSchoolPublicOrigin("http://localhost:8080")).toBe("https://bngss.lovable.app");
    expect(getSchoolPublicOrigin("https://id-preview--example.lovable.app")).toBe("https://bngss.lovable.app");
    expect(getSchoolPublicOrigin("https://www.bngss.online.evil.test")).toBe("https://bngss.lovable.app");
  });
});