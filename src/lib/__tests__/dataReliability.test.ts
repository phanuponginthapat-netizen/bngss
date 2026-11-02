import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createFlowFetch } from "../requestFlow";
import { bangkokWeekday, reliableQueryDefaults, requireSuccessfulReads, unrecordedAttendance } from "../dataReliability";
import { readAllRows } from "../../../supabase/functions/bigdata-warehouse-cron/readSources";

describe("real data only", () => {
  it("keeps ten unrecorded students separate from two recorded absences", () => {
    expect(unrecordedAttendance(20, 7, 1, 2)).toBe(10);
  });
  it("does not reuse a response across caller identities", async () => {
    const base = vi.fn(async (_input: unknown, init?: RequestInit) => {
      await Promise.resolve();
      return new Response(new Headers(init?.headers).get("Authorization"));
    });
    const fetcher = createFlowFetch(base as typeof fetch);
    const responses = await Promise.all([
      fetcher("https://example.test/rows", { headers: { Authorization: "test-caller-a" } }),
      fetcher("https://example.test/rows", { headers: { Authorization: "test-caller-b" } }),
    ]);
    expect(await Promise.all(responses.map(r => r.text()))).toEqual(["test-caller-a", "test-caller-b"]);
    expect(base).toHaveBeenCalledTimes(2);
  });
  it("deduplicates equivalent reads with independent bodies", async () => {
    const base = vi.fn(async () => new Response("real rows"));
    const fetcher = createFlowFetch(base as typeof fetch);
    const responses = await Promise.all([fetcher("https://example.test/rows"), fetcher("https://example.test/rows")]);
    expect(await Promise.all(responses.map(r => r.text()))).toEqual(["real rows", "real rows"]);
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("never retries a potentially committed write", async () => {
    const base = vi.fn(async () => new Response(null, { status: 503 }));
    await createFlowFetch(base as typeof fetch)("https://example.test/rows", { method: "POST", body: "{}" });
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("does not display semester 1 data while semester 2 loads", () => {
    const client = new QueryClient({ defaultOptions: { queries: reliableQueryDefaults } });
    client.setQueryData(["scores", 2026, 1], [{ score: 90 }]);
    const observer = new QueryObserver(client, { queryKey: ["scores", 2026, 1], enabled: false });
    observer.setOptions({ queryKey: ["scores", 2026, 2], enabled: false });
    expect(observer.getCurrentResult().data).toBeUndefined();
    client.clear();
  });
  it("reports a failed source rather than empty success", () => {
    const error = new Error("source unavailable");
    expect(() => requireSuccessfulReads([{ error: null }, { error }])).toThrow("source unavailable");
  });
  it("uses Monday for the Bangkok opening date 2 November 2026", () => {
    expect(bangkokWeekday("2026-11-02")).toBe(1);
  });
  it("reads every warehouse page instead of silently truncating", async () => {
    const data = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const result = await readAllRows(async (from, to) => ({ data: data.slice(from, to + 1), error: null }));
    expect(result).toEqual(data);
  });
  it("fails the warehouse run when a later source page fails", async () => {
    await expect(readAllRows(async from => from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: "page unavailable" } })).rejects.toThrow("page unavailable");
  });
});