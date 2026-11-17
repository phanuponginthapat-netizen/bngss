import { describe, expect, it } from "vitest";
import { getEmbedUrl } from "../socialPlatforms";

describe("school social embeds", () => {
  it("tries the saved numeric Facebook page instead of suppressing it", () => {
    const url = "https://www.facebook.com/profile.php?id=61582990731700";
    const embed = getEmbedUrl({ platform: "facebook", url });
    expect(embed).not.toBeNull();
    const parsed = new URL(embed ?? "https://invalid.example");
    expect(parsed.pathname).toBe("/plugins/page.php");
    expect(parsed.searchParams.get("href")).toBe(url);
  });
  it("uses the school TikTok profile embed", () => {
    expect(getEmbedUrl({ platform: "tiktok", url: "https://www.tiktok.com/@bngschool" }))
      .toBe("https://www.tiktok.com/embed/@bngschool?lang=th-TH");
  });
});