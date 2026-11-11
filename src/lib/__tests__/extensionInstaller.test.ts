// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { CANONICAL_BACKEND } from "../runtimeConfig";

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel));

/** Minimal zip reader (stored + deflate) — enough for the installer packages. */
function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("bad central directory entry");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error("bad local header");
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    if (!name.endsWith("/")) {
      if (method === 8) out.set(name, zlib.inflateRawSync(data));
      else if (method === 0) out.set(name, Buffer.from(data));
      else throw new Error(`unsupported zip method ${method}`);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/** Key that expired on the school backend — must never ship in an installer again. */
const DEAD_KEY = "sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v";

describe("Safe Browser installer package", () => {
  const zip = readZip(read("public/extension.zip"));

  it("contains exactly the current extension/ sources (no stale build)", () => {
    expect([...zip.keys()].sort()).toEqual(walk("extension"));
  });

  it("carries the live backend so config loads before any login", () => {
    const bg = zip.get("background.js")?.toString("utf8") || "";
    expect(/DEFAULT_SUPABASE_URL = "([^"]+)"/.exec(bg)?.[1]).toBe(CANONICAL_BACKEND.url);
    expect(/DEFAULT_ANON_KEY = "([^"]+)"/.exec(bg)?.[1]).toBe(CANONICAL_BACKEND.anonKey);
  });

  it("opens the school system, not the retired deploy host", () => {
    const bg = zip.get("background.js")?.toString("utf8") || "";
    expect(/DEFAULT_APP_ORIGIN = "([^"]+)"/.exec(bg)?.[1]).toBe("https://bngss.online");
    const blocked = zip.get("blocked.js")?.toString("utf8") || "";
    expect(blocked).toContain("https://bngss.online/dashboard/browser");
    expect(blocked).not.toContain("bngss.vercel.app");
  });

  it("is byte-identical under every download name", () => {
    const base = read("public/extension.zip");
    for (const alias of ["public/safe-browser-extension.zip", "public/school-safe-browser.zip"]) {
      expect(read(alias).equals(base)).toBe(true);
    }
  });
});

describe("Linux installer defaults", () => {
  it("kiosk setup reads branding with the live backend", () => {
    const sh = read("public/kiosk-setup.sh").toString("utf8");
    expect(/CMS_BASE="\$\{CMS_BASE:-([^}]+)\}"/.exec(sh)?.[1]).toBe(CANONICAL_BACKEND.url);
    expect(/CMS_ANON_KEY="\$\{CMS_ANON_KEY:-([^}]+)\}"/.exec(sh)?.[1]).toBe(CANONICAL_BACKEND.anonKey);
    expect(sh).not.toContain(DEAD_KEY);
  });

  it("boot splash and student setup point at the current system", () => {
    const splash = read("public/kiosk-boot-splash.sh").toString("utf8");
    expect(/CMS_SUPABASE_ANON="\$\{CMS_SUPABASE_ANON:-([^}]+)\}"/.exec(splash)?.[1]).toBe(
      CANONICAL_BACKEND.anonKey,
    );
    const student = read("public/setup.sh").toString("utf8");
    expect(/SYSTEM_URL="\$\{SYSTEM_URL:-([^}]+)\}"/.exec(student)?.[1]).toBe("https://bngss.lovable.app");
    expect(/SYSTEM_URL="\$\{SYSTEM_URL:-([^}]+)\}"/.exec(read("public/wifi-helper/install.sh").toString("utf8"))?.[1]).toBe(
      "https://bngss.lovable.app",
    );
  });

  it("keeps the shipped kiosk copy in sync with public/kiosk-setup.sh", () => {
    const shipped = read("public/kiosk-setup.sh").toString("utf8").trimEnd();
    const copy = read("scripts/kiosk/setup-mxlinux-kiosk.sh").toString("utf8").trimEnd();
    expect(copy).toBe(shipped);
  });

  it("never reintroduces the expired backend key into shipped files", () => {
    const shipped = [
      "public/extension.zip",
      "public/kiosk-setup.sh",
      "public/kiosk-boot-splash.sh",
      "public/setup.sh",
      "public/wifi-helper/install.sh",
      "scripts/kiosk/setup-mxlinux-kiosk.sh",
      "scripts/kiosk/update-boot-splash.sh",
    ];
    for (const f of shipped) expect(read(f).includes(DEAD_KEY), f).toBe(false);
  });
});
