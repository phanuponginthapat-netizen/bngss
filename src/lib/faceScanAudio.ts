// Shared audio + speech helpers for face scan
let _audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
    return _audioCtx;
  } catch { return null; }
}

/**
 * ปลดล็อกระบบเสียงบน iOS Safari — ต้องเรียกจากภายใน user gesture (เช่น onClick)
 * iOS จะบล็อก AudioContext และ speechSynthesis จนกว่าจะถูกเรียกครั้งแรกจากการแตะของผู้ใช้
 */
export function unlockAudio() {
  try {
    const ctx = getCtx();
    if (ctx) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.01);
    }
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch { /* noop */ }
}

function tone(freq: number, duration: number, delay = 0, type: OscillatorType = "sine", gainVal = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainVal, t + 0.01);
  g.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** Ding-ding ascending — successful new scan */
export function playSuccessSound() {
  tone(880, 0.12, 0);
  tone(1320, 0.18, 0.1);
}

/** Soft single low beep — duplicate / already scanned within cooldown */
export function playDuplicateSound() {
  tone(440, 0.18, 0, "triangle", 0.05);
}

/** Buzz — face detected but not in database */
export function playUnknownSound() {
  tone(220, 0.12, 0, "square", 0.04);
  tone(180, 0.14, 0.12, "square", 0.04);
}

/** มีเสียงพูดภาษาไทย/เสียงใดๆ ในเครื่องหรือไม่ (Linux kiosk ส่วนใหญ่ไม่มี) */
function hasLocalVoice(): boolean {
  try {
    if (!("speechSynthesis" in window)) return false;
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return false;
    return voices.some((v) => /^th/i.test(v.lang));
  } catch { return false; }
}

let _ttsAudio: HTMLAudioElement | null = null;
let _speechSequence = 0;
let _speechChain: Promise<void> = Promise.resolve();
/** จำนวนประโยคที่ยังพูดไม่จบ + ช่วงเว้นระยะหลังพูดจบก่อนเริ่มตรวจจับใหม่ */
let _speechPending = 0;
let _speechQuietUntil = 0;
const SPEECH_TAIL_MS = 600;

/** แคช URL ของไฟล์เสียงที่เคยสังเคราะห์แล้ว — ลดการรอเรียก TTS ซ้ำ (สาเหตุของเสียงกระตุก) */
const _ttsCache = new Map<string, string>();
const TTS_CACHE_MAX = 60;

function rememberTts(text: string, url: string) {
  _ttsCache.set(text, url);
  if (_ttsCache.size > TTS_CACHE_MAX) {
    const oldest = _ttsCache.keys().next().value as string | undefined;
    if (oldest) {
      const old = _ttsCache.get(oldest);
      _ttsCache.delete(oldest);
      if (old) { try { URL.revokeObjectURL(old); } catch { /* noop */ } }
    }
  }
}

function speakLocal(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "th-TH";
      u.rate = 1.05;
      u.volume = 1;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      setTimeout(finish, 8000);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { resolve(); }
  });
}

async function fetchTtsUrl(text: string): Promise<string | null> {
  const cached = _ttsCache.get(text);
  if (cached) return cached;

  // 1) ยิงตรงแบบ GET → ได้ audio/mpeg ตรงๆ (เสถียรกว่าบน Chromium/Linux)
  try {
    const { getBackendConfig } = await import("@/lib/runtimeConfig");
    const { url: base, anonKey } = getBackendConfig();
    const endpoint = `${base}/functions/v1/tts-th?text=${encodeURIComponent(text)}&lang=th`;
    const r = await fetch(endpoint, { headers: { apikey: anonKey } });
    if (r.ok && (r.headers.get("content-type") || "").includes("audio")) {
      const blob = await r.blob();
      if (blob.size > 200) {
        const u = URL.createObjectURL(new Blob([blob], { type: "audio/mpeg" }));
        rememberTts(text, u);
        return u;
      }
    }
  } catch { /* ลองวิธีสำรองต่อ */ }

  // 2) สำรอง: เรียกผ่าน supabase functions.invoke (POST)
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("tts-th", {
    body: { text },
    headers: { Accept: "application/octet-stream" },
  });
  if (error || !data) return null;
  if (!(data instanceof Blob) && (data as any)?.fallback) return null;
  const blob = data instanceof Blob
    ? new Blob([data], { type: "audio/mpeg" })
    : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
  if (blob.size < 100) return null;
  const url = URL.createObjectURL(blob);
  rememberTts(text, url);
  return url;
}

/** สำรองสุดท้าย: เล่น mp3 ผ่าน WebAudio (บาง Chromium/Linux บล็อก <audio> แต่ AudioContext ยังออกเสียง) */
async function playViaAudioContext(url: string): Promise<boolean> {
  try {
    const ctx = getCtx();
    if (!ctx) return false;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const buf = await (await fetch(url)).arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.playbackRate.value = 1.15;
    src.connect(ctx.destination);
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
      setTimeout(resolve, (decoded.duration / 1.15) * 1000 + 800);
      src.start();
    });
    return true;
  } catch { return false; }
}

/** เล่นเสียงพูดผ่าน server TTS (ใช้ได้บน Linux kiosk ที่ไม่มี voice ในเครื่อง) */
async function speakRemote(text: string): Promise<boolean> {
  try {
    const sequence = ++_speechSequence;
    const url = await fetchTtsUrl(text);
    if (!url) return false;
    if (sequence !== _speechSequence) return true; // มีข้อความใหม่กว่าแล้ว
    try { _ttsAudio?.pause(); } catch { /* noop */ }
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 1;
    audio.playbackRate = 1.15;
    (audio as any).preservesPitch = true;
    _ttsAudio = audio;
    // รอให้บัฟเฟอร์พร้อมก่อนเล่น — กันเสียงสะดุดบนเครื่องช้า
    if (audio.readyState < 3) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        audio.addEventListener("canplaythrough", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        setTimeout(done, 1200);
      });
    }
    try {
      await audio.play();
    } catch {
      // autoplay ถูกบล็อก หรือ element เล่นไม่ได้ → ใช้ WebAudio แทน
      return await playViaAudioContext(url);
    }
    // ให้ประโยคถัดไปรอจนพูดจบ ไม่ตัดทับกัน
    let ended = false;
    await new Promise<void>((resolve) => {
      audio.addEventListener("ended", () => { ended = true; resolve(); }, { once: true });
      audio.addEventListener("error", () => resolve(), { once: true });
      setTimeout(resolve, 6000);
    });
    // ถ้าไม่มีความคืบหน้าเลย (เวลาเล่น = 0) แปลว่าเงียบจริง → ลอง WebAudio
    if (!ended && audio.currentTime < 0.05) return await playViaAudioContext(url);
    return true;
  } catch { return false; }
}


/** Speak text in Thai — ใช้ไฟล์เสียง TTS ก่อนเสมอ เพราะ Chromium/Linux อาจรายงาน voice แต่ไม่มีเสียงออก */
export function speakText(text: string) {
  const clean = String(text || "").trim();
  if (!clean) return;
  _speechPending += 1;
  _speechChain = _speechChain
    .then(() => speakRemote(clean))
    .then(async (ok) => { if (!ok && hasLocalVoice()) await speakLocal(clean); })
    .catch(() => { /* noop */ })
    .finally(() => {
      _speechPending = Math.max(0, _speechPending - 1);
      if (_speechPending === 0) _speechQuietUntil = Date.now() + SPEECH_TAIL_MS;
    });
}

/** กำลังพูดอยู่หรือยังอยู่ในช่วงเว้นระยะหลังพูดจบ */
export function isSpeaking(): boolean {
  if (_speechPending > 0) return true;
  return Date.now() < _speechQuietUntil;
}

/** รอจนพูดจบ (พร้อมเว้นระยะสั้นๆ) ก่อนกลับไปตรวจจับใบหน้าต่อ */
export async function waitForSpeechEnd(maxWaitMs = 12000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (isSpeaking() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
  }
}

/** เตรียมไฟล์เสียงประโยคที่ใช้บ่อยล่วงหน้า — ครั้งแรกจะไม่ดีเลย์ */
export function prewarmSpeech(phrases: string[]) {
  for (const p of phrases) {
    const clean = String(p || "").trim();
    if (clean && !_ttsCache.has(clean)) void fetchTtsUrl(clean).catch(() => {});
  }
}


/** เตือนไข้สูง — เสียงสองจังหวะสูงต่ำซ้ำ */
export function playFeverAlert() {
  tone(1046, 0.16, 0, "sawtooth", 0.07);
  tone(784, 0.16, 0.18, "sawtooth", 0.07);
  tone(1046, 0.16, 0.36, "sawtooth", 0.07);
}

/** เตือนพบโลหะ/อาวุธ — ไซเรนสั้น */
export function playWeaponAlert() {
  for (let i = 0; i < 4; i++) {
    tone(660, 0.1, i * 0.16, "square", 0.09);
    tone(990, 0.1, i * 0.16 + 0.08, "square", 0.09);
  }
}

/** เสียงประตูเปิด */
export function playGateOpenSound() {
  tone(523, 0.1, 0, "sine", 0.07);
  tone(659, 0.1, 0.09, "sine", 0.07);
  tone(880, 0.16, 0.18, "sine", 0.07);
}

/** เสียงปฏิเสธการผ่านประตู */
export function playGateDeniedSound() {
  tone(300, 0.22, 0, "sawtooth", 0.07);
  tone(200, 0.28, 0.2, "sawtooth", 0.07);
}
