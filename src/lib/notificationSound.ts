// Louder, clearer notification "ping" via Web Audio API — เลียนแบบเสียง LINE/Messenger
// iOS Safari: AudioContext ต้องสร้าง/resume ภายใน user gesture — ปลดล็อกครั้งแรกที่แตะจอ
let ctx: AudioContext | null = null;
let lastPlay = 0;
let lastTag: string | null = null;
let unlocked = false;
let mp3Buffer: AudioBuffer | null = null;
let mp3Loading = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

async function ensureMp3(): Promise<AudioBuffer | null> {
  if (mp3Buffer || mp3Loading) return mp3Buffer;
  const ac = getCtx();
  if (!ac) return null;
  mp3Loading = true;
  try {
    const res = await fetch("/notification.mp3", { cache: "force-cache" });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    mp3Buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      ac.decodeAudioData(arr.slice(0), resolve, reject);
    });
    return mp3Buffer;
  } catch {
    return null;
  } finally {
    mp3Loading = false;
  }
}

function unlock() {
  if (unlocked) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    const buf = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
    unlocked = true;
    // preload mp3 หลังปลดล็อก
    ensureMp3();
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  const onGesture = () => {
    unlock();
    if (unlocked) {
      window.removeEventListener("touchend", onGesture);
      window.removeEventListener("click", onGesture);
      window.removeEventListener("keydown", onGesture);
    }
  };
  window.addEventListener("touchend", onGesture, { passive: true });
  window.addEventListener("click", onGesture);
  window.addEventListener("keydown", onGesture);
}

function playTonePattern(ac: AudioContext, urgent: boolean) {
  // ชุดโทน 3 ระดับ ให้ก้องและชัดกว่าเดิม (gain สูงขึ้น + 3 harmonics)
  const patterns = urgent
    ? [880, 1175, 880, 1175, 880]     // urgent: 5 โน้ตสลับ ดังต่อเนื่อง
    : [988, 1319];                     // ปกติ: 2 โน้ต ding-dong (B5→E6)
  const start = ac.currentTime;
  const step = urgent ? 0.15 : 0.18;
  patterns.forEach((freq, i) => {
    const t0 = start + i * step;
    // เล่น 3 harmonics พร้อมกัน (sine + triangle) ให้เสียง "ดัง+ก้อง" คล้าย real chime
    [
      { type: "sine" as OscillatorType, mult: 1, gain: 0.45 },
      { type: "triangle" as OscillatorType, mult: 2, gain: 0.18 },
      { type: "sine" as OscillatorType, mult: 3, gain: 0.10 },
    ].forEach(({ type, mult, gain }) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + 0.4);
    });
  });
}

async function playMp3(ac: AudioContext, urgent: boolean) {
  const buf = await ensureMp3();
  if (!buf) return false;
  try {
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf;
    g.gain.value = urgent ? 0.85 : 0.65; // เพดานกันเสียงคลิป (ลำโพงในตัวร้อน)
    src.connect(g).connect(ac.destination);
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

export function playNotificationSound(opts?: { urgent?: boolean; tag?: string }) {
  const now = Date.now();
  // Dedup ระดับ tag — ถ้า tag เดียวกันเพิ่งเล่นภายใน 3 วิ ให้ข้าม
  if (opts?.tag && opts.tag === lastTag && now - lastPlay < 3000) return;
  if (now - lastPlay < 400) return; // debounce burst
  lastPlay = now;
  lastTag = opts?.tag ?? null;

  try {
    if (localStorage.getItem("notif_sound_off") === "1") return;
  } catch {}

  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  // เล่นทั้ง mp3 + tone pattern พร้อมกัน — mp3 ให้ความหนา, tone ให้ความชัด/ก้อง
  playMp3(ac, !!opts?.urgent);
  playTonePattern(ac, !!opts?.urgent);
}
