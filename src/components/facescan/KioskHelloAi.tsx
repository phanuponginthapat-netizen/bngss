import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Mic, MicOff, X, Send, Volume2, VolumeX } from "lucide-react";
import { useAiBotSettings } from "@/hooks/useAiBotSettings";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  open: boolean;
  onClose: () => void;
  autoListen?: boolean; // เปิดไมค์อัตโนมัติเมื่อถูกปลุกด้วยเสียง
}

// Web Speech API types (ไม่อยู่ใน TS lib โดย default)
type SpeechRecognitionInstance = any;

const LISTEN_WINDOW_MS = 3000; // ให้เวลาผู้ใช้พูดหลัง beep 3 วินาที
const MAX_EMPTY_ROUNDS = 2; // ถ้าเงียบครบ 2 รอบ → ปิดตัวกลับไปรอ wake word
const FOLLOWUP_PROMPT = "ยังมีเรื่องอื่นที่อยากสอบถามเพิ่มเติมไหมคะ? หรือถ้าอยากทราบข้อมูลเกี่ยวกับโรงเรียน สามารถถามได้เลยนะคะ";
const RETRY_PROMPT = "ผมไม่ได้ยินเสียงพูดจากคุณเลย ช่วยพูดใหม่ด้วยครับ";

const getRecognition = (): SpeechRecognitionInstance | null => {
  const w: any = window;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "th-TH";
  rec.continuous = false;
  rec.interimResults = false;
  return rec;
};

const KioskHelloAi = ({ open, onClose, autoListen }: Props) => {
  const bot = useAiBotSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoLoopRef = useRef(false); // ทำงานเฉพาะเมื่อถูกปลุกด้วยเสียง
  const emptyRoundsRef = useRef(0);
  const listenTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const elevenQuotaOutRef = useRef(false); // เมื่อ ElevenLabs โควต้าหมด → ใช้ speechSynthesis ตลอด session

  // beep สั้น ๆ เพื่อบอกให้ผู้ใช้เริ่มพูด
  const beep = useCallback((freq = 880, dur = 0.18) => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* noop */ }
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
    if (audioElRef.current) {
      try { audioElRef.current.pause(); audioElRef.current.src = ""; } catch { /* noop */ }
      audioElRef.current = null;
    }
  }, []);

  const pickThaiVoice = useCallback(() => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang.toLowerCase().startsWith("th")) ||
           voices.find((v) => v.lang.toLowerCase().includes("th")) ||
           null;
  }, []);

  const speakBrowser = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ""));
        u.lang = "th-TH";
        u.rate = 1.0;
        u.pitch = 1.0;
        const thaiVoice = pickThaiVoice();
        if (thaiVoice) u.voice = thaiVoice;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  }, [pickThaiVoice]);

  // ลอง ElevenLabs ก่อน; ถ้าโควต้าหมด/พลาด → คืน false เพื่อ fallback
  const speakElevenLabs = useCallback(async (text: string): Promise<boolean> => {
    if (elevenQuotaOutRef.current) return false;
    try {
      const { data, error } = await supabase.functions.invoke("tts-elevenlabs", {
        body: { text },
      });
      if (error) {
        // ตรวจสถานะจาก context ถ้ามี
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) {
          elevenQuotaOutRef.current = true;
          toast.info("โควต้า ElevenLabs หมด — ใช้เสียงในบราวเซอร์แทน");
        }
        return false;
      }
      // data อาจเป็น Blob (binary) หรือ object (error JSON)
      let blob: Blob | null = null;
      if (data instanceof Blob) blob = data;
      else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: "audio/mpeg" });
      else if (data && typeof data === "object" && (data as any).fallback) {
        if ((data as any).quota) elevenQuotaOutRef.current = true;
        return false;
      }
      if (!blob) return false;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioElRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      });
      audioElRef.current = null;
      return true;
    } catch {
      return false;
    }
  }, []);

  const stripForSpeech = (raw: string) =>
    raw
      // ลบ emoji / symbol / pictograph / dingbat / flag / regional indicator
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "")
      .replace(/[*_`#]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const speak = useCallback(async (raw: string): Promise<void> => {
    if (!ttsOn) return;
    const text = stripForSpeech(raw);
    if (!text) return;
    stopSpeaking();
    const ok = await speakElevenLabs(text);
    if (!ok) await speakBrowser(text);
  }, [ttsOn, stopSpeaking, speakElevenLabs, speakBrowser]);


  // เริ่มฟังหนึ่งรอบ (3 วิ) — ถ้าไม่ได้ยินอะไรจะนับเป็น 1 empty round
  const startListenOnce = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const rec = getRecognition();
      if (!rec) { resolve(null); return; }
      recRef.current = rec;
      let done = false;
      const finish = (val: string | null) => {
        if (done) return;
        done = true;
        if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
        setListening(false);
        try { rec.stop(); } catch { /* noop */ }
        recRef.current = null;
        resolve(val);
      };
      rec.onresult = (ev: any) => {
        const said = ev.results?.[0]?.[0]?.transcript || "";
        finish(said || null);
      };
      rec.onerror = () => finish(null);
      rec.onend = () => finish(null);
      try {
        rec.start();
        setListening(true);
        listenTimerRef.current = window.setTimeout(() => finish(null), LISTEN_WINDOW_MS);
      } catch {
        finish(null);
      }
    });
  }, []);

  const closeAndReset = useCallback(() => {
    autoLoopRef.current = false;
    emptyRoundsRef.current = 0;
    try { recRef.current?.stop(); } catch { /* noop */ }
    stopSpeaking();
    onClose();
  }, [onClose, stopSpeaking]);

  // ส่งข้อความ + คืนคำตอบ (สำหรับใช้ใน loop)
  const sendAndReply = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim() || busy) return null;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.content || (data as any)?.message || "ขออภัยค่ะ ไม่สามารถตอบได้ในตอนนี้";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      return reply;
    } catch (e: any) {
      toast.error(e.message || "AI ไม่ตอบสนอง");
      setMessages((m) => [...m, { role: "assistant", content: "ขออภัยค่ะ ระบบมีปัญหาชั่วคราว ลองใหม่อีกครั้งได้ไหมคะ" }]);
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, messages]);

  // ลูปสนทนาต่อเนื่อง: beep → ฟัง 3วิ → ถ้าได้ยินก็ส่งเข้า AI แล้วพูดตอบ → beep → ฟังใหม่
  const runConversationLoop = useCallback(async () => {
    while (autoLoopRef.current) {
      // สัญญาณให้ผู้ใช้พูด
      beep(880, 0.15);
      await new Promise((r) => setTimeout(r, 250));
      const said = await startListenOnce();
      if (!autoLoopRef.current) return;
      if (!said) {
        emptyRoundsRef.current += 1;
        if (emptyRoundsRef.current === 1) {
          // รอบแรกที่เงียบ: บอกให้พูดใหม่ แล้ว loop ต่อไปจะ "ปิ๊บ" ให้ฟังอีก 3 วิ
          setMessages((m) => [...m, { role: "assistant", content: RETRY_PROMPT }]);
          await speak(RETRY_PROMPT);
          continue;
        }
        if (emptyRoundsRef.current >= MAX_EMPTY_ROUNDS) {
          // beep ต่ำ ๆ บอกว่าปิดตัว
          beep(440, 0.12);
          await new Promise((r) => setTimeout(r, 180));
          beep(330, 0.18);
          toast.info("ไม่มีการโต้ตอบ ปิดการสนทนา — พูด \"สวัสดี AI\" เพื่อเรียกใหม่");
          closeAndReset();
          return;
        }
        continue;
      }
      emptyRoundsRef.current = 0;
      const reply = await sendAndReply(said);
      if (!autoLoopRef.current) return;
      if (reply) {
        await speak(reply);
        if (!autoLoopRef.current) return;
        // ถามต่อว่ามีเรื่องอื่นอีกไหม
        setMessages((m) => [...m, { role: "assistant", content: FOLLOWUP_PROMPT }]);
        await speak(FOLLOWUP_PROMPT);
      }
      if (!autoLoopRef.current) return;
    }
  }, [beep, startListenOnce, sendAndReply, speak, closeAndReset]);

  // เปิดหน้าต่าง: ทักทาย → เข้าโหมด loop (ถ้าถูกปลุกด้วยเสียง)
  useEffect(() => {
    if (!open) return;
    const greeting = `สวัสดีค่ะ 👋 ${bot.greeting || "หนูคือผู้ช่วย AI ของโรงเรียน มีอะไรให้ช่วยไหมคะ?"}`;
    setMessages([{ role: "assistant", content: greeting }]);
    emptyRoundsRef.current = 0;
    autoLoopRef.current = !!autoListen;
    (async () => {
      await speak(greeting);
      if (autoLoopRef.current && open) runConversationLoop();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ปุ่ม/Enter สำหรับ input พิมพ์ (สำรอง)
  const sendTyped = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    // หยุด loop ชั่วคราว ปล่อยให้ผู้ใช้พิมพ์คุมเอง
    autoLoopRef.current = false;
    const reply = await sendAndReply(text);
    if (reply) await speak(reply);
  }, [input, sendAndReply, speak]);

  // ปุ่มไมค์เผื่อกดเอง (kiosk ปกติไม่แตะ) — กดแล้วเริ่ม loop อีกครั้ง
  const toggleMic = useCallback(() => {
    if (listening) {
      autoLoopRef.current = false;
      try { recRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    emptyRoundsRef.current = 0;
    autoLoopRef.current = true;
    runConversationLoop();
  }, [listening, runConversationLoop]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const preload = () => { try { synth.getVoices(); } catch { /* noop */ } };
    preload();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = preload;
    }
    return () => {
      if (synth.onvoiceschanged === preload) synth.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      autoLoopRef.current = false;
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
      try { recRef.current?.stop(); } catch { /* noop */ }
      stopSpeaking();
    };
  }, [stopSpeaking]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeAndReset}>
      <div
        className="w-full max-w-2xl h-[85vh] bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-gradient-to-r from-indigo-600/40 to-purple-600/40">
          <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
            {bot.avatarUrl ? (
              <img src={bot.avatarUrl} alt="ai" className="w-full h-full rounded-full object-cover" />
            ) : (
              <Sparkles className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1 text-white">
            <h2 className="font-bold text-lg">{bot.name || "Hello AI"}</h2>
            <p className="text-xs opacity-70">
              {listening ? "🎙️ กำลังฟัง... (พูดภายใน 3 วิ)" : "พูดคุย ถามข้อมูลโรงเรียน หรือให้ช่วยแนะนำ"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setTtsOn((v) => !v)} className="text-white hover:bg-white/10">
            {ttsOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={closeAndReset} className="text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-white/10 text-white rounded-bl-sm border border-white/10"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-white/10 text-white/70 rounded-2xl px-4 py-2.5 text-sm">
                กำลังคิด<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 bg-black/30">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={toggleMic}
              size="icon"
              className={`rounded-full h-11 w-11 shrink-0 ${listening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-white/10 hover:bg-white/20"}`}
            >
              {listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </Button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendTyped(); }}
              placeholder={listening ? "กำลังฟัง..." : "พิมพ์หรือรอสัญญาณเพื่อพูด"}
              className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 outline-none focus:bg-white/15 border border-white/10"
              disabled={busy}
            />
            <Button
              type="button"
              onClick={sendTyped}
              disabled={!input.trim() || busy}
              size="icon"
              className="rounded-full h-11 w-11 shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              <Send className="w-5 h-5 text-white" />
            </Button>
          </div>
          <p className="text-[10px] text-white/40 mt-2 text-center">
            ระบบสนทนาต่อเนื่อง — หลังเสียง "ปิ๊บ" พูดภายใน 3 วิ · เงียบ 2 รอบจะปิดอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
};

export default KioskHelloAi;
