// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const issPath = resolve(__dirname, "../../../scripts/kiosk/safe-browser/windows/SafeBrowser.iss");
const iss = readFileSync(issPath, "utf8");

// Inno Setup accepts Source: only under [Files]; a stray Source: line under
// another section (e.g. [Dirs]) fails the CI build of SafeBrowserSetup.exe.
describe("SafeBrowser.iss structure", () => {
  it("keeps every Source: entry inside the [Files] section", () => {
    let section = "";
    const offenders: string[] = [];
    for (const rawLine of iss.split(/\r?\n/)) {
      const line = rawLine.trim();
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        section = sectionMatch[1].toLowerCase();
        continue;
      }
      if (/^source\s*:/i.test(line) && section !== "files") {
        offenders.push(`[${section}] ${line.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ships the Wi-Fi helper and its manifest in the installer", () => {
    expect(iss).toContain("dist-safebrowser\\WifiHelper\\*");
    expect(iss).toContain("com.bngss.wifi.json");
  });

  it("copies the school extension to the shared ProgramData folder", () => {
    expect(iss).toContain("{commonappdata}\\BNG Safe Browser\\extension");
  });
});
