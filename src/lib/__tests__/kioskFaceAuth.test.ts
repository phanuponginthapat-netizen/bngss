// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authorizeKioskFace } from "../../../supabase/functions/_shared/kioskFaceAuth";

function database(active: boolean | null, roles: string[] = [], signedIn = false) {
  return {
    from: vi.fn((table: string) => ({ select: () => ({ eq: () => table === "kiosk_devices"
      ? { maybeSingle: async () => ({ data: active === null ? null : { id: "device", is_active: active }, error: null }) }
      : Promise.resolve({ data: roles.map(role => ({ role })), error: null }) }) })),
    auth: { getUser: vi.fn(async () => ({ data: { user: signedIn ? { id: "user" } : null }, error: null })) },
  };
}
describe("kiosk biometric access", () => {
  it("rejects anonymous callers before accessing face data", async () => {
    const db = database(true);
    expect(await authorizeKioskFace(new Request("https://example.test"), db)).toBe(false);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("permits only a registered active device without login", async () => {
    const req = new Request("https://example.test", { headers: { "x-device-key": "test-device" } });
    expect(await authorizeKioskFace(req, database(true))).toBe(true);
    expect(await authorizeKioskFace(req, database(false))).toBe(false);
    expect(await authorizeKioskFace(req, database(null))).toBe(false);
  });
  it("checks authenticated roles server-side rather than trusting the bearer string", async () => {
    const req = new Request("https://example.test", { headers: { authorization: "Bearer test-token" } });
    expect(await authorizeKioskFace(req, database(null, ["admin"], true))).toBe(true);
    expect(await authorizeKioskFace(req, database(null, ["director"], true))).toBe(true);
    expect(await authorizeKioskFace(req, database(null, ["student"], true))).toBe(false);
    expect(await authorizeKioskFace(req, database(null, ["admin"], false))).toBe(false);
  });
});