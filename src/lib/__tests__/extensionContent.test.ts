// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

const source = (file: string) => fs.readFileSync(`extension/${file}`, "utf8");
describe("extension page integration", () => {
  beforeEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });
  it("detects forbidden content inserted after initial load", async () => {
    vi.useFakeTimers();
    document.title = "School research";
    const messages: any[] = [];
    const sendMessage = vi.fn(async (m: any) => {
      messages.push(m);
      return m.type === "GET_STATE" ? { config: { browser_keyword_categories: "[]", browser_keywords: "unsafe-one,unsafe-two" } } : { ok: true };
    });
    Object.assign(window, { chrome: { runtime: { sendMessage } } });
    window.eval(source("keywords.js"));
    window.eval(source("keyword-guard.js"));
    await vi.advanceTimersByTimeAsync(500);
    document.body.innerHTML = "<p>unsafe-one unsafe-two</p>";
    Object.defineProperty(document.body, "innerText", { configurable: true, value: "unsafe-one unsafe-two" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(messages.filter(m => m.type === "KEYWORD_HIT")).toHaveLength(1);
    expect(messages.find(m => m.type === "KEYWORD_HIT")?.word).toBe("unsafe-one");
    vi.clearAllTimers();
  });
  it("keeps a teacher lock full-screen and excludes unsafe shortcuts", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="__sb_lock" style="position:fixed;top:0px">Locked</div>';
    Object.assign(window, { chrome: { runtime: { sendMessage: async () => ({ config: { browser_shortcuts: [{ target_url: "javascript:alert(1)" }, { target_url: "https://example.org", label_th: "School" }] } }) } } });
    window.eval(source("toolbar.js"));
    await vi.advanceTimersByTimeAsync(600);
    expect(document.getElementById("__sb_lock")?.style.top).toBe("0px");
    expect(document.querySelectorAll(".sb-app")).toHaveLength(1);
    expect(document.querySelector(".sb-app")?.getAttribute("href")).toBe("https://example.org");
    vi.clearAllTimers();
  });
});