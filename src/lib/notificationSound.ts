// Lightweight notification "ping" via Web Audio API — no asset file needed.
// iOS Safari requires the AudioContext to be created/resumed inside a user
// gesture, so we attach one-shot listeners that unlock it the first time the
// user taps/clicks/keys anywhere in the app.
let ctx: AudioContext | null = null;
let lastPlay = 0;
let unlocked = false;

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

function unlock() {
  if (unlocked) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    // Play an inaudible buffer to satisfy iOS gesture requirement.
    const buf = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
    unlocked = true;
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

export function playNotificationSound(opts?: { urgent?: boolean }) {
  const now = Date.now();
  if (now - lastPlay < 400) return; // debounce burst
  lastPlay = now;

  // Respect user preference
  try {
    if (localStorage.getItem("notif_sound_off") === "1") return;
  } catch {}

  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const tones = opts?.urgent ? [880, 660, 880] : [880, 1175];
  const start = ac.currentTime;
  tones.forEach((freq, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t0 = start + i * 0.12;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + 0.2);
  });
}
