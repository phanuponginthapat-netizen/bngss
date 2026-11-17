// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

function runtime(fetcher?: any) {
  const listeners: any[] = [];
  const data: Record<string, any> = {};
  const event = { addListener: () => {} };
  const stub = (): any => new Proxy(function () { return Promise.resolve(undefined); }, { get: (_t, k) => (k === "then" ? undefined : stub()) });
  const fill = (o: any): any => new Proxy(o, { get: (t, k) => (k in t ? (t[k] && typeof t[k] === "object" && !Array.isArray(t[k]) ? fill(t[k]) : t[k]) : stub()) });
  const chromeBase = {
    runtime: { getManifest: () => ({ version: "test" }), getURL: (p: string) => `chrome-extension://test/${p}`, onMessage: { addListener: (f: any) => listeners.push(f) }, onInstalled: event, onStartup: event },
    storage: { local: { get: async () => data, set: async (v: any) => Object.assign(data, v), remove: async (keys: string[]) => keys.forEach(k => delete data[k]) } },
    tabs: { onRemoved: event, onUpdated: event, query: async () => [], create: async () => ({ id: 1 }), update: async () => {} },
    alarms: { create: () => {}, onAlarm: event },
    windows: { onCreated: event, onRemoved: event, getAll: async () => [], update: async () => ({}), getLastFocused: async () => null },
    webNavigation: { onBeforeNavigate: event, onCommitted: event, onHistoryStateUpdated: event },
  };
  const chrome = fill(chromeBase);
  const ctx = vm.createContext({ chrome, URL, Date, Intl, AbortSignal, setTimeout: () => {}, setInterval: () => {}, self: {}, fetch: fetcher || (async () => ({ ok: true, status: 200, json: async () => ({}) })) });
  ctx.importScripts = (...files: string[]) => files.forEach(f => vm.runInContext(fs.readFileSync(`extension/${f}`, "utf8"), ctx));
  vm.runInContext(fs.readFileSync("extension/background.js", "utf8"), ctx);
  listeners.reverse(); // main message handler is registered last
  return { ctx, listeners, data };
}
describe("extension trust and domain policies", () => {
  it("permits toolbar-initiated visible-tab capture without requiring an extension-icon click", () => {
    const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
    expect(manifest.host_permissions).toContain("<all_urls>");
  });
  it("loads public branding and policy without presenting an anonymous key as a user token", async () => {
    let headers: any;
    const { ctx, data } = runtime(async (_url: string, options: any) => {
      headers = options.headers;
      return { ok: true, json: async () => ({ school_name: "School", browser_blocklist: "blocked.example" }) };
    });
    expect((await vm.runInContext("refreshConfig()", ctx)).ok).toBe(true);
    expect(headers.Authorization).toBeUndefined();
    expect(headers.apikey).toBeTruthy();
    expect(data.config.browser_blocklist).toBe("blocked.example");
  });
  it("preserves expired credentials during an offline refresh for retry", async () => {
    const { ctx, data } = runtime(async () => { throw new Error("offline"); });
    data.session = { access_token: "old", refresh_token: "refresh", expires_at: 1 };
    expect(await vm.runInContext("getValidSession()", ctx)).toBeNull();
    expect(data.session.refresh_token).toBe("refresh");
    expect(data.sessionError).toBeTruthy();
  });
  it("refreshes concurrent requests once and returns the same renewed token", async () => {
    let requests = 0;
    const { ctx, data } = runtime(async (url: string) => {
      if (String(url).includes("token")) requests++;
      return { ok: true, json: async () => ({ access_token: "renewed", refresh_token: "rotated", expires_in: 3600 }) };
    });
    data.session = { access_token: "old", refresh_token: "refresh" };
    const renewed = await vm.runInContext("Promise.all([tryRefreshSession({access_token:'old',refresh_token:'refresh'}),tryRefreshSession({access_token:'old',refresh_token:'refresh'})])", ctx);
    expect(renewed.map((r: any) => r.access_token)).toEqual(["renewed", "renewed"]);
    expect(requests).toBe(1);
    expect(data.session.refresh_token).toBe("rotated");
  });
  it("never restores credentials if logout happens during refresh", async () => {
    let complete: any;
    const { ctx, data } = runtime(() => new Promise(resolve => { complete = resolve; }));
    data.session = { access_token: "old", refresh_token: "refresh" };
    const request = vm.runInContext("tryRefreshSession({access_token:'old',refresh_token:'refresh'})", ctx);
    await new Promise(resolve => setImmediate(resolve));
    delete data.session;
    complete({ ok: true, json: async () => ({ access_token: "renewed" }) });
    expect(await request).toBeNull();
    expect(data.session).toBeUndefined();
  });
  it("clears definitively rejected refresh credentials", async () => {
    const { ctx, data } = runtime(async () => ({ ok: false, status: 400 }));
    data.session = { access_token: "old", refresh_token: "refresh", expires_at: 1 };
    expect(await vm.runInContext("getValidSession()", ctx)).toBeNull();
    expect(data.session).toBeUndefined();
  });
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
  it("respects disabled keyword categories and retains custom words", () => {
    const { ctx } = runtime();
    expect(vm.runInContext('self.sbBuildKeywordList({browser_keyword_categories:"[]"}).words.length', ctx)).toBe(0);
    expect(vm.runInContext('self.sbBuildKeywordList({browser_keyword_categories:"[]",browser_keywords:"forbidden"}).words[0].w', ctx)).toBe("forbidden");
  });
  it("rejects invalid times and uses Bangkok time for overnight rules", () => {
    const { ctx } = runtime();
    expect(vm.runInContext('hhmmToMin("25:00")', ctx)).toBeNull();
    vm.runInContext('Date = class extends Date { constructor(){super("2026-11-10T17:30:00Z")} };', ctx);
    expect(vm.runInContext('checkTimeRules("facebook.com", [{domains:["facebook.com"], days:[2], start:"23:00",end:"01:00"}])?.hit', ctx)).toBe("facebook.com");
    expect(vm.runInContext('checkTimeRules("facebook.com", [{domains:["facebook.com"], days:[3], start:"23:00",end:"01:00"}])', ctx)).toBeNull();
  });
});