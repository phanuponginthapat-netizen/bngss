#!/usr/bin/env node
/**
 * ดึง branding จาก CMS (cms_settings) มาใส่แอป Android ตอน build
 *  - ชื่อแอป (app_name / school_name)  -> res/values/strings.xml + capacitor.config.ts appName
 *  - โลโก้ (school_logo_512 / school_logo / app_favicon_url) -> ไอคอนแอป (mipmap-*) + splash
 *  - สีธีม (theme_color / primary_color) -> พื้นหลังไอคอน + splash background
 *
 * ใช้ backend เดียวกับเว็บ (อ่านจาก public/app-config.js) — ไม่ต้องตั้งค่าซ้ำ
 * รันก่อน `npx cap sync android` :  node scripts/apply-cms-branding.mjs
 * ถ้าโหลดไม่สำเร็จจะ "ข้าม" เงียบ ๆ เพื่อไม่ให้ build ล้ม
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ANDROID_RES = path.join(root, "android/app/src/main/res");

function log(msg) { console.log(`[cms-branding] ${msg}`); }

function readBackendConfig() {
  const envUrl = process.env.CMS_SUPABASE_URL;
  const envKey = process.env.CMS_SUPABASE_ANON_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  try {
    const src = fs.readFileSync(path.join(root, "public/app-config.js"), "utf8");
    const url = src.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1];
    const key = src.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/)?.[1];
    if (url && key) return { url, key };
  } catch {}
  return null;
}

async function fetchCms(cfg) {
  const keys = [
    "app_name", "app_short_name", "school_name", "school_short_name",
    "school_logo", "school_logo_512", "app_favicon_url",
    "theme_color", "primary_color", "theme_primary_color",
  ];
  const headers = { apikey: cfg.key };
  if (!cfg.key.startsWith("sb_publishable_")) headers.Authorization = `Bearer ${cfg.key}`;
  const res = await fetch(
    `${cfg.url}/rest/v1/cms_settings?select=key,value&key=in.(${keys.join(",")})`,
    { headers, signal: AbortSignal.timeout(15000) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  const map = {};
  for (const r of rows || []) if (r?.key) map[r.key] = r.value || "";
  return map;
}

function escapeXml(v) {
  return String(v).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[c]));
}

function normalizeColor(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return ("#" + s.slice(1).split("").map((c) => c + c).join("")).toUpperCase();
  // hsl( h s% l% )  หรือ  "210 90% 50%" (รูปแบบ token ของระบบ)
  const m = s.match(/(-?[\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/);
  if (m) return hslToHex(+m[1], +m[2], +m[3]);
  return null;
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function writeStrings(appName) {
  const file = path.join(ANDROID_RES, "values/strings.xml");
  let xml = fs.readFileSync(file, "utf8");
  const safe = escapeXml(appName);
  xml = xml
    .replace(/<string name="app_name">[\s\S]*?<\/string>/, `<string name="app_name">${safe}</string>`)
    .replace(/<string name="title_activity_main">[\s\S]*?<\/string>/, `<string name="title_activity_main">${safe}</string>`);
  fs.writeFileSync(file, xml);
  log(`ชื่อแอป -> "${appName}"`);
}

function writeCapacitorAppName(appName) {
  const file = path.join(root, "capacitor.config.ts");
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(/appName:\s*'[^']*'/, `appName: '${appName.replace(/'/g, "\\'")}'`);
  fs.writeFileSync(file, src);
}

function writeColor(hex) {
  const file = path.join(ANDROID_RES, "values/ic_launcher_background.xml");
  fs.writeFileSync(
    file,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${hex}</color>\n</resources>\n`,
  );
  log(`สีพื้นไอคอน -> ${hex}`);
}

async function writeIcons(logoUrl, bgHex) {
  let sharp;
  try { ({ default: sharp } = await import("sharp")); }
  catch { log("ข้ามการสร้างไอคอน (ไม่มี sharp) — ติดตั้งด้วย `npm i -D sharp`"); return; }

  let buf;
  if (logoUrl.startsWith("data:")) {
    buf = Buffer.from(logoUrl.split(",")[1] || "", "base64");
  } else {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`โหลดโลโก้ไม่ได้ HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }

  const bg = bgHex || "#FFFFFF";
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

  for (const [d, size] of Object.entries(densities)) {
    const dir = path.join(ANDROID_RES, `mipmap-${d}`);
    fs.mkdirSync(dir, { recursive: true });
    const square = await sharp(buf)
      .resize(size, size, { fit: "contain", background: bg })
      .flatten({ background: bg })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, "ic_launcher.png"), square);
    fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), square);
    // foreground ของ adaptive icon ต้องมี safe-zone (โลโก้กินพื้นที่ ~66%)
    const fgSize = Math.round(size * 1.5); // 108dp grid
    const inner = Math.round(fgSize * 0.62);
    const fg = await sharp({
      create: { width: fgSize, height: fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: await sharp(buf).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, "ic_launcher_foreground.png"), fg);
  }

  // adaptive icon ให้ชี้ไปที่ png ที่เพิ่งสร้าง
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  const anyDpi = path.join(ANDROID_RES, "mipmap-anydpi-v26");
  fs.mkdirSync(anyDpi, { recursive: true });
  fs.writeFileSync(path.join(anyDpi, "ic_launcher.xml"), adaptive);
  fs.writeFileSync(path.join(anyDpi, "ic_launcher_round.xml"), adaptive);

  // splash (ใช้โลโก้กลางจอบนพื้นสีธีม)
  const splash = await sharp({ create: { width: 1280, height: 1280, channels: 4, background: bg } })
    .composite([{ input: await sharp(buf).resize(640, 640, { fit: "contain", background: bg }).flatten({ background: bg }).png().toBuffer() }])
    .png()
    .toBuffer();
  for (const dir of fs.readdirSync(ANDROID_RES).filter((d) => d.startsWith("drawable-"))) {
    const target = path.join(ANDROID_RES, dir, "splash.png");
    if (fs.existsSync(target)) fs.writeFileSync(target, splash);
  }
  const baseSplash = path.join(ANDROID_RES, "drawable", "splash.png");
  if (fs.existsSync(baseSplash)) fs.writeFileSync(baseSplash, splash);
  log("สร้างไอคอน + splash จากโลโก้ CMS แล้ว");
}

async function main() {
  const cfg = readBackendConfig();
  if (!cfg) { log("ไม่พบ backend config — ข้าม"); return; }

  let map;
  try { map = await fetchCms(cfg); }
  catch (e) { log(`ดึง CMS ไม่สำเร็จ (${e.message}) — ข้าม`); return; }

  const appName = map.app_short_name || map.app_name || map.school_short_name || map.school_name;
  if (appName) { writeStrings(appName); writeCapacitorAppName(appName); }

  const hex = normalizeColor(map.theme_color) || normalizeColor(map.primary_color) || normalizeColor(map.theme_primary_color);
  if (hex) writeColor(hex);

  const logo = map.school_logo_512 || map.school_logo || map.app_favicon_url;
  if (logo) {
    try { await writeIcons(logo, hex); }
    catch (e) { log(`สร้างไอคอนไม่สำเร็จ (${e.message}) — ใช้ไอคอนเดิม`); }
  } else {
    log("ไม่มีโลโก้ใน CMS — ใช้ไอคอนเดิม");
  }
}

main().catch((e) => { log(`ข้อผิดพลาด: ${e.message}`); });
