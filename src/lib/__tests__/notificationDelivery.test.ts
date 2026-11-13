import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { notificationEventTag } from "../notificationIdentity";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), sound: vi.fn(), haptic: vi.fn() }));
vi.mock("sonner", () => ({ toast: { custom: mocks.toast } }));
vi.mock("../notificationSound", () => ({ playNotificationSound: mocks.sound }));
vi.mock("../haptics", () => ({ haptic: mocks.haptic }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.stubGlobal("localStorage", { getItem: () => null });
});

describe("one alert per original event", () => {
  it("alerts once when realtime, inbox mirror and native push share an ID, even when urgent", async () => {
    const { showLiveNotification } = await import("../liveNotification");
    const opts = { title: "scan", urgent: true };
    showLiveNotification({ ...opts, tag: notificationEventTag("notifications", { id: "n" }) });
    showLiveNotification({ ...opts, tag: notificationEventTag("inbox_items", { id: "i", notification_id: "n" }) });
    showLiveNotification({ ...opts, tag: "notifications-n" });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.sound).toHaveBeenCalledTimes(1);
    showLiveNotification({ ...opts, tag: "notifications-next" });
    expect(mocks.toast).toHaveBeenCalledTimes(2);
  });

  it("shows a repeated urgent background push only once", async () => {
    const handlers = new Map<string, (event: any) => void>();
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const postMessage = vi.fn();
    const clients = [{ visibilityState: "hidden", focused: false, postMessage }];
    const self = { addEventListener: (name: string, cb: (event: any) => void) => handlers.set(name, cb),
      registration: { showNotification }, clients: { matchAll: async () => clients } };
    runInNewContext(readFileSync("public/sw.js", "utf8"), { self, Map, Set, Date, URL });
    const push = handlers.get("push");
    if (!push) throw new Error("Missing push handler");
    const dispatch = async (tag: string) => {
      let pending: Promise<unknown> = Promise.resolve();
      push({ data: { json: () => ({ title: "scan", tag, urgent: true }) }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
      await pending;
    };
    await dispatch("notifications-n");
    await dispatch("notifications-n");
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ displayed: true }));
    await dispatch("notifications-next");
    expect(showNotification).toHaveBeenCalledTimes(2);
  });
});