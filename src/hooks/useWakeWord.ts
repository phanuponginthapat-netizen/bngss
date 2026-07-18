import { useEffect, useRef } from "react";

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
  const phrases = opts.phrases ?? [
    "สวัสดี ai", "สวัสดีเอไอ", "สวัสดี เอไอ",
    "หวัดดีเอไอ", "หวัดดี เอไอ", "หวัดดี ai",
    "สวัสดีไอ", "hello ai", "hey ai",
  ];
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

    const start = () => {
      if (stoppedRef.current) return;
      try {
        const rec = new Ctor();
        rec.lang = "th-TH";
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 3;
        rec.onresult = (ev: any) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            for (let j = 0; j < res.length; j++) {
              const t = String(res[j].transcript || "").toLowerCase().trim();
              if (!t) continue;
              if (phrases.some((p) => t.includes(p))) {
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
          // Chrome หยุดเองทุก ~60 วิ — เปิดใหม่
          restartTimer = setTimeout(start, 400);
        };
        rec.start();
        recRef.current = rec;
      } catch {
        restartTimer = setTimeout(start, 1500);
      }
    };

    start();
    return () => {
      stoppedRef.current = true;
      if (restartTimer) clearTimeout(restartTimer);
      try { recRef.current?.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [enabled]);
}
