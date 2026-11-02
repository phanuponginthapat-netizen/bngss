// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authorizePushRecipient } from "../../../supabase/functions/_shared/pushAuthorization";
function db(id: string | null, roles: string[] = []) {
  return { auth: { getUser: async () => ({ data: { user: id ? { id } : null }, error: null }) }, from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: roles.map(role => ({ role })), error: null }) }) })) };
}
const req = (token?: string) => new Request("https://example.test", { headers: token ? { authorization: `Bearer ${token}` } : {} });
describe("direct push recipient authorization", () => {
  it("rejects anonymous and invalid sessions", async () => {
    expect(await authorizePushRecipient(req(), db("u"), "u", "service-test")).toBe(false);
    expect(await authorizePushRecipient(req("invalid"), db(null), "u", "service-test")).toBe(false);
  });
  it("allows own test but rejects sending to another user", async () => {
    expect(await authorizePushRecipient(req("user-test"), db("u"), "u", "service-test")).toBe(true);
    expect(await authorizePushRecipient(req("user-test"), db("u"), "other", "service-test")).toBe(false);
  });
  it("preserves privileged and internal fanout", async () => {
    expect(await authorizePushRecipient(req("user-test"), db("u", ["admin"]), "other", "service-test")).toBe(true);
    expect(await authorizePushRecipient(req("service-test"), db(null), "other", "service-test")).toBe(true);
  });
});