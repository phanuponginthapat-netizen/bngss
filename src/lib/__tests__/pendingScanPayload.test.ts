// @vitest-environment node
import { describe, it, expect } from "vitest";
import { pendingScanPayload } from "../pendingScanPayload";
import { scanReceipt } from "../../../supabase/functions/_shared/scanReceipt";
describe("scanner retry integrity", () => {
  it("keeps the captured Bangkok day across a midnight retry", () => {
    expect(pendingScanPayload({student_id:"s",scan_time:"2026-11-14T16:59:00Z"})).toMatchObject({scan_date:"2026-11-14",scan_time:"2026-11-14T16:59:00.000Z"});
  });
  it("does not invent a timestamp for an old unknown-time pending item", () => expect(() => pendingScanPayload({scan_date:"2026-11-01"})).toThrow());
  it("rejects an invalid pending timestamp", () => expect(() => pendingScanPayload({scan_time:"bad"})).toThrow());
  it("keeps one staff receipt when the response was lost", async () => {
    expect(await scanReceipt("device","staff","2026-11-14T01:00:00Z","in")).toBe(await scanReceipt("device","staff","2026-11-14T01:00:00Z","in"));
  });
  it("keeps distinct staff scans distinct", async () => {
    expect(await scanReceipt("device","staff","2026-11-14T01:00:00Z","in")).not.toBe(await scanReceipt("device","staff","2026-11-14T02:00:00Z","in"));
  });
});