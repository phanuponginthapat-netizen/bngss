// @vitest-environment node
import { describe, expect, it } from "vitest";
import { authRoleRead } from "../authRoleRead";

describe("login role reads", () => {
  it("does not classify a failed read as an account without roles", () => {
    const error = new Error("network unavailable");
    expect(() => authRoleRead({ data: null, error })).toThrow(error);
  });
  it("keeps confirmed student roles for account 2693", () => {
    expect(authRoleRead({ data: [{ role: "student" }], error: null })).toEqual([{ role: "student" }]);
  });
  it("only returns empty roles after a successful empty read", () => {
    expect(authRoleRead({ data: [], error: null })).toEqual([]);
    expect(() => authRoleRead({ data: null, error: null })).toThrow();
  });
});