// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

function runtime() {
  const listeners: any[] = [];
  const data: Record<string, any> = {};
  const event = { addListener: () => {} };
  const chrome = {
    runtime: { getURL: (p: string) => `chrome-extension://test/${p}`, onMessage: { addListener: (f: any) => listeners.push(f) }, onInstalled: event, onStartup: event },
    storage: { local: { get: async () => data, set: async (v: any) => Object.assign(data, v), remove: async () => {} } },
    tabs: { onRemoved: event, onUpdated: event, query: async () => [], create: async () => ({ id: 1 }), update: async () => {} },
    alarms: { create: () => {}, onAlarm: event },
    webNavigation: { onBeforeNavigate: event, onCommitted: event, onHistoryStateUpdated: event },
  };
  const ctx = vm.createContext({ chrome, URL, Date, Intl, AbortSignal, setTimeout: () => {}, setInterval: () => {}, self: {}, fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  ctx.importScripts = (...files: string[]) => files.forEach(f => vm.runInContext(fs.readFileSync(`extension/${f}`, "utf8"), ctx));
  vm.runInContext(fs.readFileSync("extension/background.js", "utf8"), ctx);
  return { ctx, listeners, data };
}
describe("extension trust and domain policies", () => {
  it("syncs only school domains, never unrelated hosted apps", () => {
    const m = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
    const matches = m.content_scripts.find((s: any) => s.js.includes("session-sync.js")).matches;
    expect(matches).toContain("https://bngss.online/*");
    expect(matches).toContain("https://www.bngss.online/*");
    expect(matches).not.toContain("https://*.lovable.app/*");
    expect(matches).not.toContain("https://*.vercel.app/*");
  });
  it("matches domains exactly or as subdomains, not a substring", () => {
    const { ctx } = runtime();
    expect(vm.runInContext('hostMatches("notfacebook.com", ["facebook.com"])', ctx)).toBeNull();
    expect(vm.runInContext('hostMatches("www.facebook.com", ["facebook.com"])', ctx)).toBe("facebook.com");
  });
  it("cannot leak tokens to content scripts on third-party websites", async () => {
    const { listeners, data } = runtime();
    data.session = { access_token: "private-test-token", refresh_token: "private-refresh", user: { name: "Test" } };
    const response = await new Promise<any>((resolve) => listeners[0]({ type: "GET_STATE" }, { url: "https://example.org", tab: { id: 5 } }, resolve));
    expect(response.session?.access_token).toBeUndefined();
    expect(response.session?.refresh_token).toBeUndefined();
  });
  it("rejects forged session and remote commands from third-party tabs", () => {
    const { listeners, data } = runtime();
    let response: any;
    listeners[0]({ type: "SET_SESSION", session: { access_token: "forged" } }, { url: "https://example.org", tab: { id: 1 } }, (r: any) => { response = r; });
    expect(data.session).toBeUndefined();
    expect(response.ok).toBe(false);
    listeners[0]({ type: "SB_LOCK_ALL" }, { url: "https://example.org", tab: { id: 1 } }, (r: any) => { response = r; });
    expect(response.ok).toBe(false);
  });
  it("never treats an unknown role as a student monitoring session", () => {
    const { ctx } = runtime();
    expect(vm.runInContext('isStudentSession({role:null})', ctx)).toBe(false);
    expect(vm.runInContext('isStudentSession({role:"student"})', ctx)).toBe(true);
  });
});