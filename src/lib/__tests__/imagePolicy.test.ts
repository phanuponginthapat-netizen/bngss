import { describe, expect, it } from "vitest";
import { dailyImageLimit, isImagePromptAllowed } from "../../../supabase/functions/_shared/imagePolicy";

describe("chat image rules", () => {
  it("teachers get 10 images per day", () => expect(dailyImageLimit(["teacher"])).toBe(10));
  it("students get 5 images per day", () => expect(dailyImageLimit(["student"])).toBe(5));
  it("blocks nude or sexual prompts", () => {
    expect(isImagePromptAllowed("ผู้หญิงเปลือย")).toBe(false);
    expect(isImagePromptAllowed("a naked person")).toBe(false);
  });
  it("allows normal school prompts", () => expect(isImagePromptAllowed("นกฮูกอ่านหนังสือในห้องสมุด")).toBe(true));
});
