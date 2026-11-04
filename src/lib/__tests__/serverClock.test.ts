// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clockSkewMs, syncServerClock } from "../serverClock";

/**
 * นาฬิกากลางของระบบตองถามเวลาจากเซิร์ฟเวอร์ก่อนบันทึกการเช็คชื่อ
 * ถ้าคำขอนี้ไม่มี apikey เซิรฟ์เวอรจ์ะปฏเสท (401) และสวนตางนาฬิกาจะไมเคยถูกคำนวณ
 * = ระบบใชเวลาเครื่องที่อาจเพียนโดยไมรรู
 */
describe("serverClock sync", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the backend key when asking the server for the time", async () => {
    const calls: Array<{ url: string; init?: any }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: any) => {
        calls.push({ url: String(url), init });
        return new Response(null, {
          status: 200,
          headers: { date: new Date(Date.now() + 5000).toUTCString() },
        });
      }),
    );

    await syncServerClock(true);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/auth\/v1\/health$/);
    expect(calls[0].init?.method).toBe("HEAD");
    const apiKey = calls[0].init?.headers?.apikey;
    expect(typeof apiKey).toBe("string");
    expect(apiKey && apiKey.length > 20).toBe(true);
  });

  it("records the difference when the server answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, {
          status: 200,
          headers: { date: new Date(Date.now() + 5000).toUTCString() },
        }),
      ),
    );

    await syncServerClock(true);

    // เครื่องน้าเซิรฟ์เวอร 5 วินาที → ตองเห็นสวนตางในชวงเดกวนกน
    expect(clockSkewMs()).toBeGreaterThan(4000);
    expect(clockSkewMs()).toBeLessThan(6500);
  });
});
