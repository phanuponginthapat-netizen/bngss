import { useEffect, useMemo, useRef } from "react";

/**
 * Wake-word listener — ฟังต่อเนื่องด้วย Web Speech API
 * ปลุกเมื่อได้ยินคำว่า "สวัสดี AI" / "สวัสดีเอไอ" / "หวัดดีเอไอ"
 *
 * ใช้สำหรับโหมดคีออสที่วางในตู้ ไม่ต้องแตะจอ
 */
export function useWakeWord(opts: {
  enabled: boolean;
  onWake: () => void;
  phrases?: string[];
}) {
  const { enabled, onWake } = opts;
  const phrases = useMemo(() => opts.phrases ?? [
    "hello ai", "hello a i", "hello hey eye", "hey ai", "hey a i",
    "ฮัลโหล ai", "ฮัลโหลเอไอ", "เฮลโล ai", "เฮลโลเอไอ",
    "สวัสดี ai", "สวัสดีเอไอ", "สวัสดี เอไอ",
    "หวัดดีเอไอ", "หวัดดี เอไอ", "หวัดดี ai", "สวัสดีไอ",
  ], [opts.phrases]);
  const phraseKey = useMemo(() => phrases.join("|"), [phrases]);
  const normalizedPhrases = useMemo(() => phrases.map(normalizeSpeech), [phraseKey]);
  const recRef = useRef<any>(null);
  const stoppedRef = useRef(false);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    if (!enabled) return;
    const w: any = window;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    stoppedRef.current = false;
    let restartTimer: any = null;
    let langIndex = 0;
    let startedOnce = false;
    const langs = ["en-US", "th-TH"];

    const clearRestart = () => {
      if (restartTimer) clearTimeout(restartTimer);
      restartTimer = null;
    };

    const scheduleRestart = (delay = 900) => {
      if (stoppedRef.current) return;
      clearRestart();
      restartTimer = setTimeout(start, delay);
    };

    const start = () => {
      if (stoppedRef.current) return;
      try {
        const rec = new Ctor();
        rec.lang = langs[langIndex % langs.length];
        langIndex += 1;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 3;
        rec.onresult = (ev: any) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            for (let j = 0; j < res.length; j++) {
              const t = String(res[j].transcript || "").toLowerCase().trim();
              if (!t) continue;
              const nt = normalizeSpeech(t);
              if (normalizedPhrases.some((p) => p && nt.includes(p))) {
                stoppedRef.current = true;
                try { rec.stop(); } catch { /* noop */ }
                onWakeRef.current();
                return;
              }
            }
          }
        };
        rec.onerror = (e: any) => {
          // not-allowed / service-not-allowed = ผู้ใช้ปฏิเสธไมค์ → หยุดถาวร
          if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
            stoppedRef.current = true;
          }
        };
        rec.onend = () => {
          if (stoppedRef.current) return;
          recRef.current = null;
          // Chrome/Speech service หยุดเองเป็นระยะ โดยเฉพาะตอนเงียบ — เปิดใหม่แบบหน่วงเพื่อไม่ให้ไอคอนไมค์กระพริบรัว
          scheduleRestart(startedOnce ? 1200 : 400);
        };
        rec.start();
        startedOnce = true;
        recRef.current = rec;
      } catch {
        scheduleRestart(1800);
      }
    };

    // ขอสิทธิ์ไมค์ล่วงหน้าแบบสั้น ๆ เพื่อให้ Chromium policy/permission พร้อมก่อนเริ่ม SpeechRecognition
    const warmMic = async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia?.({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        stream?.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") stoppedRef.current = true;
      }
      start();
    };
    warmMic();
    return () => {
      stoppedRef.current = true;
      clearRestart();
      try { recRef.current?.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [enabled, phraseKey]);
}

function normalizeSpeech(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s\-_.!?,;:'"`~()[\]{}]+/g, "")
    .replace(/เอไอ/g, "ai")
    .replace(/เอย์อาย/g, "ai")
    .replace(/เฮลโล/g, "hello")
    .replace(/ฮัลโหล/g, "hello")
    .trim();
}
