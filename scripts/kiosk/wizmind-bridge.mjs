#!/usr/bin/env node
/**
 * WizMind Bridge — สะพานเชื่อมกล้อง Dahua WizMind (IPC-HFW5442E-ZE / HFW5559E1-ZE-IL ฯลฯ)
 * เข้ากับระบบสแกนใบหน้าโรงเรียน แบบ realtime
 *
 * โหมดการทำงาน (ใช้พร้อมกันได้):
 *   1) dahua  — เกาะ event stream ของกล้อง (FaceDetection / SmartMotionHuman)
 *               เมื่อกล้องตรวจเจอใบหน้า → ดึง snapshot → ส่งเข้าระบบทันที
 *   2) listen — เปิด HTTP server ให้กล้อง/NVR ส่ง snapshot มาเอง (HTTP upload)
 *
 * ตัวอย่าง:
 *   node wizmind-bridge.mjs \
 *     --endpoint https://<project>.supabase.co/functions/v1/wizmind-bridge \
 *     --key $WIZMIND_BRIDGE_KEY \
 *     --camera gate-1 --camera-name "ประตูหน้า" \
 *     --host 192.168.1.108 --user admin --pass 'xxxx' \
 *     --listen 8099
 *
 * รันเป็น service: ดู docs/RTSP-CCTV-SETUP.md หัวข้อ "WizMind Bridge"
 */
import http from "node:http";
import crypto from "node:crypto";

// ---------- args ----------
const args = process.argv.slice(2);
const arg = (name, def = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const ENDPOINT = arg("endpoint", process.env.WIZMIND_ENDPOINT || "");
const KEY = arg("key", process.env.WIZMIND_BRIDGE_KEY || "");
const CAMERA_ID = arg("camera", process.env.WIZMIND_CAMERA_ID || "cam-1");
const CAMERA_NAME = arg("camera-name", process.env.WIZMIND_CAMERA_NAME || "");
const HOST = arg("host", process.env.WIZMIND_CAM_HOST || "");
const USER = arg("user", process.env.WIZMIND_CAM_USER || "admin");
const PASS = arg("pass", process.env.WIZMIND_CAM_PASS || "");
const CHANNEL = Number(arg("channel", "1"));
const LISTEN_PORT = Number(arg("listen", "0"));
const MIN_GAP_MS = Number(arg("min-gap", "700")); // กันยิงถี่เกินจากกล้องเดียวกัน
const VERBOSE = flag("verbose");

if (!ENDPOINT || !KEY) {
  console.error("ต้องระบุ --endpoint และ --key (หรือ env WIZMIND_ENDPOINT / WIZMIND_BRIDGE_KEY)");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dbg = (...a) => VERBOSE && log(...a);

// ---------- ส่งเข้าระบบ ----------
let lastSentAt = 0;
let sent = 0, failed = 0;

async function pushSnapshot(buf, { confidence = null, bbox = null, meta = {} } = {}) {
  const now = Date.now();
  if (now - lastSentAt < MIN_GAP_MS) { dbg("skip (min-gap)"); return; }
  lastSentAt = now;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-key": KEY,
      },
      body: JSON.stringify({
        camera_id: CAMERA_ID,
        camera_name: CAMERA_NAME,
        confidence,
        bbox,
        meta: { ...meta, bridge: "wizmind-bridge.mjs", ts: new Date().toISOString() },
        image_base64: buf.toString("base64"),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { failed++; log("❌ ส่งไม่สำเร็จ", res.status, JSON.stringify(json)); return; }
    sent++;
    log(`✅ ส่งแล้ว #${sent} (${(buf.length / 1024).toFixed(0)} KB) id=${json.id}`);
  } catch (e) {
    failed++;
    log("❌ error", e.message);
  }
}

// ---------- Digest auth สำหรับ Dahua ----------
function digestHeader(method, uri, wwwAuth) {
  const get = (k) => (new RegExp(`${k}="?([^",]+)"?`).exec(wwwAuth) || [])[1] || "";
  const realm = get("realm"), nonce = get("nonce"), qop = get("qop"), opaque = get("opaque");
  const cnonce = crypto.randomBytes(8).toString("hex");
  const nc = "00000001";
  const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
  const ha1 = md5(`${USER}:${realm}:${PASS}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  let h = `Digest username="${USER}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) h += `, opaque="${opaque}"`;
  return h;
}

async function camFetch(path, init = {}) {
  const url = `http://${HOST}${path}`;
  let res = await fetch(url, init);
  if (res.status === 401) {
    const wwwAuth = res.headers.get("www-authenticate") || "";
    const auth = wwwAuth.toLowerCase().startsWith("digest")
      ? digestHeader(init.method || "GET", path, wwwAuth)
      : "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
    res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: auth } });
  }
  return res;
}

async function grabSnapshot() {
  const res = await camFetch(`/cgi-bin/snapshot.cgi?channel=${CHANNEL}`);
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- โหมด 1: เกาะ event stream ของกล้อง ----------
async function attachEvents() {
  const codes = arg("codes", "FaceDetection,SmartMotionHuman");
  const path = `/cgi-bin/eventManager.cgi?action=attach&codes=[${codes}]&heartbeat=5`;
  log(`🔌 เชื่อมต่อ event stream: ${HOST} codes=[${codes}]`);
  const res = await camFetch(path);
  if (!res.ok || !res.body) throw new Error(`attach ${res.status}`);

  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("Code=")) continue;
      const code = (/Code=([^;]+)/.exec(line) || [])[1] || "";
      const action = (/action=([^;]+)/.exec(line) || [])[1] || "";
      dbg("event", code, action);
      if (action !== "Start" && action !== "Pulse") continue;
      try {
        const img = await grabSnapshot();
        await pushSnapshot(img, { meta: { code, action } });
      } catch (e) { log("⚠️ snapshot ล้มเหลว", e.message); }
    }
    if (buf.length > 1_000_000) buf = "";
  }
  throw new Error("event stream ปิด");
}

async function runEventLoop() {
  let backoff = 1000;
  for (;;) {
    try {
      await attachEvents();
      backoff = 1000;
    } catch (e) {
      log("🔁 หลุดการเชื่อมต่อ:", e.message, `— ลองใหม่ใน ${backoff / 1000}s`);
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  }
}

// ---------- โหมด 2: HTTP listener ให้กล้อง/NVR ส่งภาพมาเอง ----------
function runListener(port) {
  http
    .createServer((req, res) => {
      if (req.method !== "POST") { res.writeHead(405).end("method"); return; }
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        const raw = Buffer.concat(chunks);
        // ตัดส่วนหัว multipart แบบง่าย ๆ: หา JPEG SOI/EOI
        const start = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
        const img = start >= 0 ? raw.slice(start) : raw;
        if (img.length < 1024) { res.writeHead(400).end("no image"); return; }
        await pushSnapshot(img, { meta: { via: "http-listener" } });
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
      });
    })
    .listen(port, () => log(`📥 HTTP listener พร้อมที่พอร์ต ${port} (ตั้งกล้องให้ POST ภาพมาที่นี่)`));
}

// ---------- start ----------
log(`🚀 WizMind Bridge • camera=${CAMERA_ID} → ${ENDPOINT}`);
if (LISTEN_PORT) runListener(LISTEN_PORT);
if (HOST) runEventLoop();
if (!LISTEN_PORT && !HOST) {
  console.error("ต้องระบุ --host (โหมดกล้อง Dahua) หรือ --listen <port> อย่างน้อยหนึ่งอย่าง");
  process.exit(1);
}
setInterval(() => log(`📊 ส่งสำเร็จ ${sent} • ล้มเหลว ${failed}`), 300_000);
