import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ url: "https://school.test" }));
vi.mock("@/lib/runtimeConfig", () => ({ getBackendConfig: () => ({ url: state.url }) }));
import { getKioskDeviceKey, saveKioskDeviceKey, kioskCredentialHeaders } from "../kioskDeviceCredential";
beforeEach(() => { localStorage.clear(); state.url = "https://school.test"; });
describe("kiosk credential persistence", () => {
  it("retains the provisioned device credential for login-free scanning", () => {
    saveKioskDeviceKey(" test-key ");
    expect(getKioskDeviceKey()).toBe("test-key");
    expect(kioskCredentialHeaders()).toEqual({ "x-device-key": "test-key" });
  });
  it("never sends one school's credential to a different backend", () => {
    saveKioskDeviceKey("test-key"); state.url = "https://other.test";
    expect(kioskCredentialHeaders()).toEqual({});
  });
});