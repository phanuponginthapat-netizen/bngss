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

function speakLocal(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = 1.05;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

/** เล่นเสียงพูดผ่าน server TTS (ใช้ได้บน Linux kiosk ที่ไม่มี voice ในเครื่อง) */
async function speakRemote(text: string): Promise<boolean> {
  try {
    const sequence = ++_speechSequence;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("tts-th", {
      body: { text },
      headers: { Accept: "application/octet-stream" },
    });
    if (error || !data) return false;
    if (!(data instanceof Blob) && (data as any)?.fallback) return false;
    const blob = data instanceof Blob
      ? new Blob([data], { type: "audio/mpeg" })
      : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
    if (blob.size < 100) return false;
    const url = URL.createObjectURL(blob);
    if (sequence !== _speechSequence) {
      URL.revokeObjectURL(url);
      return true;
    }
    try { _ttsAudio?.pause(); } catch { /* noop */ }
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 1;
    audio.playbackRate = 1.3;
    (audio as any).preservesPitch = true;
    audio.onended = () => URL.revokeObjectURL(url);
    _ttsAudio = audio;
    await audio.play();
    return true;
  } catch { return false; }
}

/** Speak text in Thai — ใช้ไฟล์เสียง TTS ก่อนเสมอ เพราะ Chromium/Linux อาจรายงาน voice แต่ไม่มีเสียงออก */
export function speakText(text: string) {
  const clean = String(text || "").trim();
  if (!clean) return;
  void speakRemote(clean).then((ok) => {
    if (!ok && hasLocalVoice()) speakLocal(clean);
  });
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
