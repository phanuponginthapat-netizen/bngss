import { describe, expect, it } from "vitest";
import { installedAppEntry } from "../installedAppEntry";

const launch = { pathname: "/", installed: true, authReady: true, signedIn: true };

describe("installed app launch", () => {
  it("opens the dashboard on each signed-in APK launch", () => {
    expect(installedAppEntry(launch)).toBe("dashboard");
    expect(installedAppEntry({ ...launch })).toBe("dashboard");
  });
  it("waits for the saved account instead of showing the homepage", () => {
    expect(installedAppEntry({ ...launch, authReady: false, signedIn: false })).toBe("pending");
    expect(installedAppEntry(launch)).toBe("dashboard");
  });
  it("does not redirect signed-out users", () => {
    expect(installedAppEntry({ ...launch, signedIn: false })).toBe("public");
  });
  it("leaves the ordinary website homepage available", () => {
    expect(installedAppEntry({ ...launch, installed: false })).toBe("public");
  });
  it("preserves task and notification destinations", () => {
    expect(installedAppEntry({ ...launch, pathname: "/dashboard/student/homework" })).toBe("public");
  });
  it("preserves deliberately opened public pages", () => {
    expect(installedAppEntry({ ...launch, pathname: "/page/home" })).toBe("public");
  });
});