// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), sign: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: mocks.from, storage: { from: () => ({ createSignedUrl: mocks.sign }) },
} }));
import { loadNotificationEvidence, notificationEvidenceReference } from "../facegateNotificationEvidence";

describe("attendance notification evidence access", () => {
  beforeEach(() => vi.clearAllMocks());
  const reference = { reference_type: "face_scan_log", reference_id: "exact-scan" };
  function record(data: unknown, error: unknown = null) {
    const eq = vi.fn().mockReturnValue({ maybeSingle: async () => ({ data, error }) });
    mocks.from.mockReturnValue({ select: () => ({ eq }) });
    return eq;
  }
  it("reads only the referenced scan and signs its own two photos", async () => {
    const eq = record({ captured_face_url: "scans/day/child-a.jpg", students: { photo_url: "parent/child-a.jpg" } });
    mocks.sign.mockImplementation(async (path: string) => ({ data: { signedUrl: `signed:${path}` }, error: null }));
    const result = await loadNotificationEvidence(reference);
    expect(mocks.from).toHaveBeenCalledWith("face_scan_logs");
    expect(eq).toHaveBeenCalledWith("id", "exact-scan");
    expect(result?.scan).toBe("signed:scans/day/child-a.jpg");
    expect(result?.portrait).toBe("signed:parent/child-a.jpg");
  });
  it("does not sign anything when server RLS hides another child's scan", async () => {
    record(null);
    await expect(loadNotificationEvidence(reference)).rejects.toThrow();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not sign anything after a denied record read", async () => {
    record(null, new Error("permission denied"));
    await expect(loadNotificationEvidence(reference)).rejects.toThrow("permission denied");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not reuse a previous user's signed scan URL", async () => {
    record({ captured_face_url: "scans/day/child-a.jpg", students: { photo_url: null } });
    mocks.sign.mockResolvedValueOnce({ data: { signedUrl: "first-session" }, error: null });
    expect((await loadNotificationEvidence(reference))?.scan).toBe("first-session");
    mocks.sign.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    const result = await loadNotificationEvidence(reference);
    expect(result?.scan).toBeNull();
    expect(result?.failed).toBe(true);
  });
  it("ignores unrelated notifications rather than guessing a scan", () => {
    expect(notificationEvidenceReference({ reference_type: "homework", reference_id: "exact-scan" })).toBeNull();
  });
});