// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

const source = (file: string) => fs.readFileSync(`extension/${file}`, "utf8");
describe("extension page integration", () => {
  it("detects forbidden content inserted after initial load", async () => {
    const messages: any[] = [];
    const sendMessage = async (m: any) => {
      messages.push(m);
      return m.type === "GET_STATE" ? { config: { browser_keyword_categories: "[]", browser_keywords: "unsafe-one,unsafe-two" } } : { ok: true };
    };
    const timers: (() => void)[] = [];
    let mutation = () => {};
    const body = { innerText: "ordinary lesson" };
    const window = { top: null as any, self: null as any, addEventListener: () => {} };
    window.top = window; window.self = window;
    const ctx = vm.createContext({ window, self: {}, location: { href: "https://example.org" },
      document: { body, title: "Research", readyState: "complete", querySelector: () => null, addEventListener: () => {} },
      chrome: { runtime: { sendMessage } }, setTimeout: (f: any) => { timers.push(f); return timers.length; },
      clearTimeout: () => {}, setInterval: () => {}, MutationObserver: class { constructor(f: any) { mutation = f; } observe() {} },
    });
    vm.runInContext(source("keywords.js"), ctx);
    vm.runInContext(source("keyword-guard.js"), ctx);
    await timers.shift()?.();
    expect(messages.some(m => m.type === "KEYWORD_HIT")).toBe(false);
    body.innerText = "unsafe-one unsafe-two";
    mutation();
    await timers.shift()?.();
    expect(messages.filter(m => m.type === "KEYWORD_HIT")).toHaveLength(1);
    expect(messages.find(m => m.type === "KEYWORD_HIT")?.word).toBe("unsafe-one");
  });
});