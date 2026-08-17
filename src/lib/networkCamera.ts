import Hls from "hls.js";

/**
 * ตัวช่วยเชื่อมต่อกล้องเครือข่าย (IP camera / CCTV) เข้ากับ <video>
 *
 * เบราว์เซอร์ไม่รองรับ RTSP โดยตรง — ต้องผ่าน gateway (MediaMTX / go2rtc)
 * แปลงเป็น HLS (.m3u8), MP4/WebM, หรือ MJPEG ก่อน
 */

export type StreamKind = "hls" | "mjpeg" | "progressive" | "webrtc" | "rtsp" | "empty" | "invalid";

export function classifyStreamUrl(raw: string): StreamKind {
  const url = (raw || "").trim();
  if (!url) return "empty";
  const lower = url.toLowerCase();
  if (lower.startsWith("rtsp://") || lower.startsWith("rtsps://") || lower.startsWith("rtmp://")) return "rtsp";
  if (!/^https?:\/\//.test(lower) && !lower.startsWith("blob:")) return "invalid";
  const path = lower.split("#")[0];
  if (path.includes(".m3u8")) return "hls";
  if (/\.(mp4|webm|ogg|mov)(\?|$)/.test(path)) return "progressive";
  if (path.includes("whep") || path.includes("webrtc")) return "webrtc";
  if (/(mjpe?g|\.cgi|video\.cgi|snapshot|\.jpg)(\?|$)/.test(path) || path.includes("action=stream")) return "mjpeg";
  // ไม่ทราบชนิด — ให้ลองเป็น progressive
  return "progressive";
}

export function describeStreamKind(kind: StreamKind): string {
  switch (kind) {
    case "hls": return "HLS (.m3u8)";
    case "mjpeg": return "MJPEG";
    case "progressive": return "MP4 / WebM";
    case "webrtc": return "WebRTC (WHEP)";
    case "rtsp": return "RTSP";
    case "empty": return "ยังไม่ได้ตั้งค่า";
    default: return "ไม่รองรับ";
  }
}

/** ข้อความอธิบายปัญหาแบบภาษาไทย เมื่อ URL ใช้ไม่ได้ */
export function validateStreamUrl(raw: string): string | null {
  const kind = classifyStreamUrl(raw);
  if (kind === "empty") return "กรุณาตั้งค่า URL ของกล้องเครือข่าย";
  if (kind === "rtsp") {
    return "เบราว์เซอร์เปิด RTSP/RTMP โดยตรงไม่ได้ — ต้องใช้ gateway (MediaMTX / go2rtc) แปลงเป็น HLS ก่อน เช่น http://<server>:8888/cam1/index.m3u8";
  }
  if (kind === "invalid") return "URL ต้องขึ้นต้นด้วย http:// หรือ https://";
  if (kind === "webrtc") return "ยังไม่รองรับ WebRTC/WHEP — กรุณาใช้ HLS (.m3u8) จาก gateway เดียวกัน";
  if (location.protocol === "https:" && raw.trim().toLowerCase().startsWith("http://")) {
    return "หน้าเว็บเป็น HTTPS แต่ URL กล้องเป็น HTTP — เบราว์เซอร์จะบล็อก (mixed content) กรุณาใช้ HTTPS หรือ reverse proxy";
  }
  return null;
}

export type NetworkCameraHandle = {
  kind: StreamKind;
  /** หยุดสตรีม + ยกเลิก watchdog ทั้งหมด */
  destroy: () => void;
};

type AttachOptions = {
  /** timeout ต่อการเชื่อมต่อหนึ่งครั้ง (ms) */
  timeoutMs?: number;
  /** แจ้งสถานะให้ UI (เชื่อมต่อใหม่ / ผิดพลาด) */
  onStatus?: (msg: string) => void;
  /** เรียกเมื่อกู้คืนไม่ได้แล้ว */
  onFatal?: (msg: string) => void;
  /** เปิด watchdog ตรวจภาพค้าง แล้วต่อใหม่อัตโนมัติ */
  autoReconnect?: boolean;
};

/**
 * ต่อกล้องเครือข่ายเข้ากับ video element
 * - HLS ผ่าน hls.js (มี auto-recover networkError/mediaError) หรือ native HLS บน Safari/iOS
 * - MJPEG / MP4 / WebM ผ่าน video.src ตรง ๆ
 * - มี watchdog ตรวจ "ภาพค้าง" (currentTime ไม่เดิน) แล้วเชื่อมต่อใหม่พร้อม backoff
 */
export async function attachNetworkCamera(
  video: HTMLVideoElement,
  rawUrl: string,
  opts: AttachOptions = {},
): Promise<NetworkCameraHandle> {
  const { timeoutMs = 15000, onStatus, onFatal, autoReconnect = true } = opts;
  const url = rawUrl.trim();
  const problem = validateStreamUrl(url);
  if (problem) throw new Error(problem);
  const kind = classifyStreamUrl(url);

  let hls: Hls | null = null;
  let destroyed = false;
  let watchdog: number | null = null;
  let reconnectTimer: number | null = null;
  let attempts = 0;

  const clearTimers = () => {
    if (watchdog !== null) { window.clearInterval(watchdog); watchdog = null; }
    if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  const teardown = () => {
    clearTimers();
    if (hls) { try { hls.destroy(); } catch { /* noop */ } hls = null; }
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch { /* noop */ }
  };

  const scheduleReconnect = (reason: string) => {
    if (destroyed || !autoReconnect) { onFatal?.(reason); return; }
    attempts += 1;
    if (attempts > 8) { onFatal?.(`${reason} (พยายามเชื่อมต่อใหม่ครบ 8 ครั้งแล้ว)`); return; }
    const delay = Math.min(30000, 1500 * 2 ** (attempts - 1));
    onStatus?.(`กล้องหลุด (${reason}) — เชื่อมต่อใหม่ใน ${Math.round(delay / 1000)} วิ`);
    reconnectTimer = window.setTimeout(() => {
      if (destroyed) return;
      connect().catch((e) => scheduleReconnect(e?.message || "เชื่อมต่อไม่สำเร็จ"));
    }, delay);
  };

  const startWatchdog = () => {
    if (!autoReconnect) return;
    if (watchdog !== null) window.clearInterval(watchdog);
    let lastTime = -1;
    let stalled = 0;
    watchdog = window.setInterval(() => {
      if (destroyed || video.paused) return;
      const t = video.currentTime;
      if (Math.abs(t - lastTime) < 0.02) {
        stalled += 1;
        if (stalled >= 5) { // ~10 วินาทีที่ภาพไม่ขยับ
          stalled = 0;
          teardownStreamOnly();
          scheduleReconnect("ภาพค้าง");
        }
      } else {
        stalled = 0;
        attempts = 0; // สตรีมกลับมาปกติ → รีเซ็ต backoff
      }
      lastTime = t;
    }, 2000);
  };

  const teardownStreamOnly = () => {
    if (hls) { try { hls.destroy(); } catch { /* noop */ } hls = null; }
    if (watchdog !== null) { window.clearInterval(watchdog); watchdog = null; }
  };

  const connect = async () => {
    teardownStreamOnly();
    if (destroyed) return;
    video.crossOrigin = "anonymous"; // จำเป็นสำหรับการ capture ภาพลง canvas
    video.muted = true;
    (video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;

    if (kind === "hls" && Hls.isSupported()) {
      const inst = new Hls({
        lowLatencyMode: true,
        liveSyncDuration: 1.5,
        liveMaxLatencyDuration: 6,
        backBufferLength: 10,
        maxBufferLength: 6,
        manifestLoadingTimeOut: timeoutMs,
        manifestLoadingMaxRetry: 2,
        fragLoadingTimeOut: timeoutMs,
        fragLoadingMaxRetry: 4,
        xhrSetup: (xhr) => { xhr.withCredentials = false; },
      });
      hls = inst;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const to = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("หมดเวลาเชื่อมต่อ (ตรวจ URL / firewall / CORS ของ gateway)"));
        }, timeoutMs);
        inst.on(Hls.Events.MANIFEST_PARSED, () => {
          if (settled) return;
          settled = true; window.clearTimeout(to); resolve();
        });
        inst.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (settled) {
            // กู้คืนระหว่างเล่นอยู่
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { onStatus?.("สตรีมสะดุด — กำลังโหลดใหม่"); inst.startLoad(); }
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { onStatus?.("ภาพผิดพลาด — กำลังกู้คืน"); inst.recoverMediaError(); }
            else { teardownStreamOnly(); scheduleReconnect(data.details || "hls fatal"); }
            return;
          }
          settled = true; window.clearTimeout(to);
          reject(new Error(hlsErrorMessage(data.details as string)));
        });
        inst.loadSource(url);
        inst.attachMedia(video);
      });
    } else if (kind === "hls") {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) throw new Error("เบราว์เซอร์นี้ไม่รองรับ HLS");
      video.src = url; // native HLS (Safari / iOS)
    } else {
      video.src = url; // MJPEG / MP4 / WebM
    }

    await Promise.race([
      video.play(),
      new Promise((_r, rej) => window.setTimeout(() => rej(new Error("เปิดภาพจากกล้องไม่สำเร็จภายในเวลาที่กำหนด")), timeoutMs)),
    ]);
    attempts = 0;
    startWatchdog();
  };

  await connect();

  return {
    kind,
    destroy: () => { destroyed = true; teardown(); },
  };
}

function hlsErrorMessage(details: string): string {
  switch (details) {
    case "manifestLoadError":
      return "โหลด playlist ไม่ได้ — ตรวจ URL, การเข้าถึงเครือข่าย และ CORS ของ gateway (Access-Control-Allow-Origin)";
    case "manifestParsingError":
      return "playlist ไม่ถูกต้อง — URL อาจไม่ใช่สตรีม HLS";
    case "manifestLoadTimeOut":
      return "หมดเวลาโหลด playlist — gateway อาจปิดอยู่หรือถูก firewall บล็อก";
    case "fragLoadError":
      return "โหลดชิ้นวิดีโอไม่ได้ — ตรวจแบนด์วิดท์/gateway";
    default:
      return `เชื่อมต่อสตรีมไม่สำเร็จ (${details})`;
  }
}

/** ทดสอบ URL อย่างรวดเร็วโดยไม่ต้องเปิดกล้องจริง */
export async function testStreamUrl(rawUrl: string, timeoutMs = 8000): Promise<{ ok: boolean; message: string }> {
  const problem = validateStreamUrl(rawUrl);
  if (problem) return { ok: false, message: problem };
  const kind = classifyStreamUrl(rawUrl);
  const ctrl = new AbortController();
  const to = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(rawUrl.trim(), { method: "GET", signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, message: `gateway ตอบกลับ HTTP ${res.status}` };
    if (kind === "hls") {
      const text = (await res.text()).slice(0, 2048);
      if (!text.includes("#EXTM3U")) return { ok: false, message: "URL ตอบกลับแต่ไม่ใช่ playlist HLS" };
    }
    return { ok: true, message: `เชื่อมต่อได้ (${describeStreamKind(kind)})` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) return { ok: false, message: "หมดเวลาเชื่อมต่อ — ตรวจ URL / firewall" };
    return { ok: false, message: `เชื่อมต่อไม่ได้ — มักเกิดจาก CORS หรือ gateway ปิดอยู่ (${msg})` };
  } finally {
    window.clearTimeout(to);
  }
}
