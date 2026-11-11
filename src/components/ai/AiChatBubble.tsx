import { SchoolToolDialog } from "./SchoolToolDialog";
import { AiFileAttachment } from "./AiFileAttachment";
import { readAiAttachment, type AiAttachment } from "@/lib/aiAttachments";
import ReactMarkdown from "react-markdown";
import { streamSchoolTool, schoolToolLabels, type SchoolTool } from "@/lib/schoolTools";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X, MessageCircle, Loader2, Play, ImagePlus, Sparkles, FileText, BookOpen, ClipboardCheck, GraduationCap, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAiBotSettings } from "@/hooks/useAiBotSettings";
import { swal } from "@/lib/swal";
import { subscribeToPush, getCurrentPushStatus, isPwaCapable, isInIframe, isPreviewHost } from "@/lib/pushSubscribe";
import { askFreeAI } from "@/lib/freeAI";
import { useUserRole } from "@/hooks/useUserRole";
import { streamImage } from "@/lib/streamImage";
import { loadAiChatHistory } from "@/lib/aiChatHistory";

const AI_IMAGE_PREFIX = "ai-image://";
const signedCache = new Map<string, string>();

/** Chat image: resolves saved images (ai-image://path) and opens full size on tap. */
function ChatImage({ src, partial, onOpen }: { src: string; partial?: boolean; onOpen: (url: string) => void }) {
  const stored = src.startsWith(AI_IMAGE_PREFIX) ? src.slice(AI_IMAGE_PREFIX.length) : null;
  const [url, setUrl] = useState<string | null>(stored ? signedCache.get(stored) ?? null : src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!stored) { setUrl(src); return; }
    if (signedCache.has(stored)) { setUrl(signedCache.get(stored)!); return; }
    let alive = true;
    supabase.storage.from("ai-chat-images").createSignedUrl(stored, 60 * 60 * 24).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data?.signedUrl) { setFailed(true); return; }
      signedCache.set(stored, data.signedUrl);
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [src, stored]);
  if (failed) return <div className="text-xs opacity-70">โหลดภาพไม่สำเร็จ</div>;
  if (!url) return <div className="h-40 w-56 rounded-lg bg-muted animate-pulse" />;
  return (
    <button type="button" onClick={() => !partial && onOpen(url)} className="block" title="แตะเพื่อดูภาพเต็ม">
      <img src={url} alt="ภาพในบทสนทนา" className={cn("rounded-lg max-w-full h-auto cursor-zoom-in", partial && "blur-lg")} loading="lazy" />
    </button>
  );
}

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

type Msg = { role: "user" | "assistant"; content: string; imagePartial?: boolean };

type ChatLogRow = { role: "user" | "assistant"; content: string; created_at: string };

// ===== Shared voice-loop config (เหมือน KioskHelloAi) =====
const LISTEN_WINDOW_MS = 3000;
const MAX_EMPTY_ROUNDS = 2;
const FOLLOWUP_PROMPT = "ยังมีเรื่องอื่นที่อยากสอบถามเพิ่มเติมไหมคะ? หรือถ้าอยากทราบข้อมูลเกี่ยวกับโรงเรียน สามารถถามได้เลยนะคะ";
const RETRY_PROMPT = "ผมไม่ได้ยินเสียงพูดจากคุณเลย ช่วยพูดใหม่ด้วยครับ";

// Pick readable text color (#fff or #111) for a given hex bg
function textOn(hex: string): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex || "");
  if (!m) return "#111827";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111827" : "#ffffff";
}

function orderChatRows(rows: ChatLogRow[]): Msg[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const timeDiff = new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;

      const roleDiff = (a.row.role === "user" ? 0 : 1) - (b.row.role === "user" ? 0 : 1);
      if (roleDiff !== 0) return roleDiff;

      return a.index - b.index;
    })
    .map(({ row }) => ({ role: row.role, content: row.content }));
}

export default function AiChatBubble() {
  const bot = useAiBotSettings();
  const { role: userRole } = useUserRole();
  const greetingMsg: Msg = useMemo(() => ({ role: "assistant", content: bot.greeting }), [bot.greeting]);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<SchoolTool | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([greetingMsg]);
  const [historyError, setHistoryError] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("ai_voice_on");
    return saved === null ? true : saved === "1";
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null); // data URL
  const [pendingFile, setPendingFile] = useState<AiAttachment | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const pickDocument = async (file: File) => {
    setReadingFile(true);
    try { setPendingFile(await readAiAttachment(file)); setPendingImage(null); }
    catch (error) { swal.error(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ"); }
    finally { setReadingFile(false); }
  };
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const { schoolLogo } = useSystemSettings();

  // Resizing keeps this same chat mounted: draft, attachment and active replies survive.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, fullscreen]);

  useEffect(() => {
    if (!open || !fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector(".swal2-container") || viewerUrl || activeTool) return;
        event.preventDefault();
        setFullscreen(false);
      }
      if (event.key !== "Tab" || activeTool) return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([type="file"]), a[href], [tabindex="0"]'
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, fullscreen, viewerUrl, activeTool]);

  // ===== Voice-loop refs (shared with KioskHelloAi) =====
  const autoLoopRef = useRef(false);
  const emptyRoundsRef = useRef(0);
  const listenTimerRef = useRef<number | null>(null);
  const beepCtxRef = useRef<AudioContext | null>(null);
  const elevenAudioRef = useRef<HTMLAudioElement | null>(null);
  const elevenQuotaOutRef = useRef(false);

  const beep = (freq = 880, dur = 0.18) => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = beepCtxRef.current || new Ctx();
      beepCtxRef.current = ctx;
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
    } catch {}
  };

  // ลอง ElevenLabs ก่อน; ถ้าโควต้าหมด → false เพื่อ fallback
  const speakElevenLabs = async (text: string): Promise<boolean> => {
    if (elevenQuotaOutRef.current) return false;
    try {
      const { data, error } = await supabase.functions.invoke("tts-elevenlabs", { body: { text } });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) elevenQuotaOutRef.current = true;
        return false;
      }
      let blob: Blob | null = null;
      if (data instanceof Blob) blob = data;
      else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: "audio/mpeg" });
      else if (data && typeof data === "object" && (data as any).fallback) {
        if ((data as any).quota) elevenQuotaOutRef.current = true;
        return false;
      }
      if (!blob || blob.size < 100) return false;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      elevenAudioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      });
      elevenAudioRef.current = null;
      return true;
    } catch { return false; }
  };

  // Sync greeting when settings load (only if untouched)
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].role === "assistant" ? [greetingMsg] : prev
    );
  }, [greetingMsg]);

  // Load chat history from server (cross-device sync) + subscribe to realtime
  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const data = await loadAiChatHistory(uid);
      if (cancelled) return;
      if (data.length && !busyRef.current) {
        setMessages([greetingMsg, ...orderChatRows(data as ChatLogRow[])]);
      }
      setHistoryError(false);
      // Realtime: pick up messages from other devices/sessions
      channel = supabase
        .channel(`ai-chat-${uid}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "ai_chat_logs", filter: `user_id=eq.${uid}` },
          (payload: any) => {
            const r = payload.new;
            if (!r || (r.role !== "user" && r.role !== "assistant")) return;
            if (busyRef.current) return;
            setMessages((prev) => {
              // dedupe: skip if same role+content exists in recent messages
              // (handles the case where realtime arrives after we already appended locally,
              // which would otherwise push the user message below the assistant reply)
              const recent = prev.slice(-8);
              if (recent.some((m) => m.role === r.role && m.content === r.content)) return prev;
              return [...prev, { role: r.role, content: r.content }];
            });
          })
        .subscribe();
    })().catch(() => { if (!cancelled) setHistoryError(true); });
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [greetingMsg]);

  // Refetch latest history every time the bubble is opened (catch up if realtime missed anything)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const data = await loadAiChatHistory(uid);
      if (cancelled || busyRef.current) return;
      // Do not erase locally generated output while the server is catching up.
      if (data.length) setMessages([greetingMsg, ...orderChatRows(data as ChatLogRow[])]);
      setHistoryError(false);
    })().catch(() => { if (!cancelled) setHistoryError(true); });
    return () => { cancelled = true; };
  }, [open, greetingMsg, historyRetry]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Persist voice preference
  useEffect(() => {
    try { localStorage.setItem("ai_voice_on", voiceOn ? "1" : "0"); } catch {}
  }, [voiceOn]);

  // Warm up TTS voices — Chrome returns [] from getVoices() until "voiceschanged" fires.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const warm = () => { try { window.speechSynthesis.getVoices(); } catch {} };
    warm();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
  }, []);

  // Auto request notification permission + push subscription (once per session, when usable)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPwaCapable() || isInIframe() || isPreviewHost()) return;
    if (sessionStorage.getItem("push_auto_asked") === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getCurrentPushStatus();
        if (cancelled) return;
        if (status === "subscribed" || status === "denied" || status === "unsupported") return;
        sessionStorage.setItem("push_auto_asked", "1");
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        await subscribeToPush();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Owl hoot marker — keep through sanitize; replaced by real owl sound during speak()
  const OWL_MARK = "\u0001OWL\u0001";

  const sanitizeForSpeech = (raw: string) => {
    let t = raw;
    // ลบ code block และ inline code
    t = t.replace(/```[\s\S]*?```/g, " ");
    t = t.replace(/`([^`]*)`/g, "$1");
    // ลบ markdown link [text](url) เหลือแค่ text
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // ลบ URL
    t = t.replace(/https?:\/\/\S+/g, " ");
    // ลบเสียง "ฮูก"/"ฮู้ก" ออกจากข้อความที่พูด (ไม่เล่นเสียงนกฮูก)
    t = t.replace(/ฮู้?[กกๆๆ]+/g, " ");
    t = t.replace(/ฮู[\s,!.…]*ฮู[\s,!.…]*/g, " ");
    // แก้คำอ่าน "ดร.เอาล์" / "ดร เอาล์" / "Dr. Owl" → "ดอกเตอร์อาว" (ออกเสียงให้ถูก)
    t = t.replace(/ดร\.?\s*เอาล์?/g, "ดอกเตอร์อาว");
    t = t.replace(/เอาล์/g, "อาว");
    t = t.replace(/\bDr\.?\s*Owl\b/gi, "ดอกเตอร์อาว");
    // ลบ emoji และสัญลักษณ์พิเศษที่ทำให้ TTS สะดุด
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");
    // แปลงสัญลักษณ์ bullet/markdown เป็นการเว้นวรรค
    t = t.replace(/[*_~`|]+/g, " ");
    t = t.replace(/^\s*[-•]\s+/gm, " ");
    // คณิตศาสตร์: ทศนิยม เช่น 3.14 → "สาม จุด หนึ่งสี่"
    t = t.replace(/(\d)\.(\d)/g, "$1 จุด $2");
    // เครื่องหมายลบ/ขีดกลางระหว่างตัวเลข → "ลบ"
    t = t.replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 ลบ $2");
    t = t.replace(/(^|\s)[-–—]+(\s|$)/g, "$1 $2");
    // การหาร: a/b หรือ a÷b
    t = t.replace(/(\d)\s*[\/÷]\s*(\d)/g, "$1 หารด้วย $2");
    t = t.replace(/÷/g, " หารด้วย ");
    t = t.replace(/\//g, " ");
    t = t.replace(/\\/g, " ");
    // การคูณ: a*b, a×b, a·b
    t = t.replace(/(\d)\s*[*×·]\s*(\d)/g, "$1 คูณ $2");
    t = t.replace(/[×·]/g, " คูณ ");
    // แปลงสัญลักษณ์อื่นๆ
    t = t.replace(/&/g, " และ ");
    t = t.replace(/\+/g, " บวก ");
    t = t.replace(/−/g, " ลบ ");
    t = t.replace(/≠/g, " ไม่เท่ากับ ");
    t = t.replace(/≈/g, " ประมาณ ");
    t = t.replace(/≤/g, " น้อยกว่าหรือเท่ากับ ");
    t = t.replace(/≥/g, " มากกว่าหรือเท่ากับ ");
    t = t.replace(/</g, " น้อยกว่า ");
    t = t.replace(/>/g, " มากกว่า ");
    t = t.replace(/=/g, " เท่ากับ ");
    t = t.replace(/%/g, " เปอร์เซ็นต์ ");
    t = t.replace(/°/g, " องศา ");
    t = t.replace(/√/g, " รากที่สองของ ");
    t = t.replace(/π/g, " พาย ");
    t = t.replace(/\^/g, " ยกกำลัง ");
    t = t.replace(/฿/g, " บาท ");
    t = t.replace(/\$/g, " ดอลลาร์ ");
    t = t.replace(/@/g, " แอท ");
    t = t.replace(/#/g, " เลขที่ ");
    // จุดที่เหลือ (ไม่ใช่ปลายประโยค) → "จุด"
    t = t.replace(/(\S)\.(\S)/g, "$1 จุด $2");
    // ลบวงเล็บ
    t = t.replace(/[()[\]{}"]+/g, " ");

    // ยุบ whitespace (เก็บ marker ไว้)
    t = t.replace(/\s+/g, " ").trim();
    // ใส่จังหวะหยุดหลังเครื่องหมายวรรคตอนเพื่อให้อ่านเป็นธรรมชาติ
    t = t.replace(/([.!?])\s*/g, "$1 ");
    return t;
  };

  // เล่นเสียง "นกฮูก" สังเคราะห์ด้วย Web Audio API — สอง hoot โทนต่ำพร้อม vibrato/pitch glide
  const owlAudioCtxRef = useRef<AudioContext | null>(null);
  const playOwlHoot = (): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const AC: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return resolve();
        if (!owlAudioCtxRef.current || owlAudioCtxRef.current.state === "closed") {
          owlAudioCtxRef.current = new AC();
        }
        const ctx = owlAudioCtxRef.current!;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.value = 0.0001;
        master.connect(ctx.destination);

        const hoot = (start: number, baseFreq: number, dur: number) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(baseFreq * 0.93, start);
          osc.frequency.exponentialRampToValueAtTime(baseFreq, start + 0.07);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, start + dur);

          // vibrato (นกฮูกจริงสั่นเล็กๆ)
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.value = 6.5;
          lfoGain.gain.value = baseFreq * 0.018;
          lfo.connect(lfoGain).connect(osc.frequency);

          // เติม harmonic เบาๆ ให้นุ่มเหมือนเป่าลม
          const osc2 = ctx.createOscillator();
          osc2.type = "triangle";
          osc2.frequency.value = baseFreq * 2;
          const g2 = ctx.createGain();
          g2.gain.value = 0.08;
          osc2.connect(g2);

          const env = ctx.createGain();
          env.gain.setValueAtTime(0.0001, start);
          env.gain.exponentialRampToValueAtTime(0.6, start + 0.06);
          env.gain.setValueAtTime(0.6, start + dur - 0.15);
          env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

          osc.connect(env);
          g2.connect(env);
          env.connect(master);

          osc.start(start); osc2.start(start); lfo.start(start);
          osc.stop(start + dur + 0.02); osc2.stop(start + dur + 0.02); lfo.stop(start + dur + 0.02);
        };

        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.9, now + 0.02);

        const dur1 = 0.5;
        const gap = 0.18;
        const dur2 = 0.85;
        hoot(now, 380, dur1);            // "Hoo"
        hoot(now + dur1 + gap, 330, dur2); // "Hoooot" — โทนต่ำกว่า ยาวกว่า
        const total = dur1 + gap + dur2 + 0.05;
        master.gain.setValueAtTime(0.9, now + total - 0.05);
        master.gain.exponentialRampToValueAtTime(0.0001, now + total);
        setTimeout(resolve, total * 1000 + 20);
      } catch {
        resolve();
      }
    });
  };


  const pickThaiVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      /th.*(female|kanya|premwadee|niwat)/i,
      /(female|google).*th/i,
      /th/i,
    ];
    for (const re of preferred) {
      const v = voices.find((vo) => re.test(`${vo.lang} ${vo.name}`));
      if (v) return v;
    }
    return null;
  };

  // เลือกเสียงอังกฤษสำเนียงอเมริกัน (en-US) สำหรับอ่านคำ/ประโยคภาษาอังกฤษ
  const pickEnglishUSVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      // คุณภาพดี (natural / neural / online) ของ en-US ก่อน
      /en[-_]US.*(natural|neural|online|premium|enhanced)/i,
      /(samantha|ava|allison|nicky|aria|jenny|guy|davis|tony)/i,
      /google.*us.*english/i,
      /microsoft.*(aria|jenny|guy|davis).*en[-_]?US/i,
      /en[-_]US/i,
      /^en\b/i,
    ];
    for (const re of preferred) {
      const v = voices.find((vo) => re.test(`${vo.lang} ${vo.name}`));
      if (v) return v;
    }
    return null;
  };

  // แยกข้อความเป็น segment ตามภาษา (ไทย vs อังกฤษ) เพื่อให้ TTS ใช้สำเนียงถูกต้อง
  const segmentByLanguage = (text: string): { text: string; lang: "th-TH" | "en-US" }[] => {
    const segments: { text: string; lang: "th-TH" | "en-US" }[] = [];
    // จับชิ้น "ภาษาอังกฤษ" (ตัวอักษรละติน ตัวเลข เครื่องหมายวรรคตอนของอังกฤษ) ที่ติดกัน
    const re = /([A-Za-z][A-Za-z0-9'’\-.,!?:; ]*[A-Za-z0-9.!?])|([A-Za-z]+)/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (start > lastIndex) {
        const th = text.slice(lastIndex, start).trim();
        if (th) segments.push({ text: th, lang: "th-TH" });
      }
      const en = m[0].trim();
      if (en) segments.push({ text: en, lang: "en-US" });
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      const tail = text.slice(lastIndex).trim();
      if (tail) segments.push({ text: tail, lang: "th-TH" });
    }
    // รวม segment ภาษาเดียวกันที่อยู่ติดกัน
    const merged: { text: string; lang: "th-TH" | "en-US" }[] = [];
    for (const s of segments) {
      const last = merged[merged.length - 1];
      if (last && last.lang === s.lang) last.text += " " + s.text;
      else merged.push({ ...s });
    }
    return merged;
  };

  // Fallback: ใช้ server-side TTS ฟรี เมื่อเครื่องไม่มีเสียงไทย
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakViaServer = (text: string): Promise<"ok" | "fallback"> =>
    new Promise<"ok" | "fallback">((resolve) => {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("tts-th", {
            body: { text },
          });
          if (error || !data) return resolve("fallback");
          if (!(data instanceof Blob) && (data as any)?.fallback) return resolve("fallback");
          const blob = data instanceof Blob
            ? new Blob([data], { type: "audio/mpeg" })
            : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
          if (blob.size < 100) return resolve("fallback");
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.playbackRate = 1.35;
          (audio as any).preservesPitch = true;
          (audio as any).mozPreservesPitch = true;
          (audio as any).webkitPreservesPitch = true;
          remoteAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve("ok"); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve("fallback"); };
          await audio.play().catch(() => resolve("fallback"));
        } catch {
          resolve("fallback");
        }
      })();
    });

  const speakUtterance = (seg: { text: string; lang: "th-TH" | "en-US" }, thVoice: SpeechSynthesisVoice | null, enVoice: SpeechSynthesisVoice | null) =>
    new Promise<void>((resolve) => {
      (async () => {
      // ไม่มีเสียงไทยในเครื่อง → ลอง server TTS ก่อน, ถ้าไม่ได้ค่อย fallback ไป browser
      if (seg.lang === "th-TH" && !thVoice) {
        const r = await speakViaServer(seg.text);
        if (r === "ok") return resolve();
        // fallback: ใช้ browser TTS ด้วย lang=th-TH (ดีกว่าเงียบ)
      }
      try {
        const u = new SpeechSynthesisUtterance(seg.text);
        if (seg.lang === "en-US") {
          u.lang = "en-US";
          if (enVoice) u.voice = enVoice;
          u.rate = 1.0;
          u.pitch = 1.05;
        } else {
          u.lang = "th-TH";
          if (thVoice) u.voice = thVoice;
          u.rate = 1.15;
          u.pitch = 1.15;
        }
        u.volume = 1.0;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
      })();
    });


  const speak = async (text: string, force = false) => {
    if ((!voiceOn && !force) || typeof window === "undefined") return;
    try {
      try { window.speechSynthesis?.cancel(); } catch {}
      try { remoteAudioRef.current?.pause(); } catch {}
      try { elevenAudioRef.current?.pause(); } catch {}
      const clean = sanitizeForSpeech(text);
      if (!clean) return;
      // 1) ลอง ElevenLabs ก่อน (คุณภาพดี, ตัดคำไทยดี)
      const ok = await speakElevenLabs(clean);
      if (ok) return;
      // 2) fallback: pipeline เดิม (Thai/English segmentation + tts-th + browser)
      if (!window.speechSynthesis) return;
      const thVoice = pickThaiVoice();
      const enVoice = pickEnglishUSVoice();
      const segments = segmentByLanguage(clean);
      for (const seg of segments) {
        await speakUtterance(seg, thVoice, enVoice);
      }
    } catch {}
  };



  const compressImage = async (file: File, maxSize = 1280, quality = 0.85): Promise<string> => {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { swal.info("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (f.size > 8 * 1024 * 1024) { swal.info("ไฟล์ใหญ่เกิน 8MB"); return; }
    try {
      const url = await compressImage(f);
      setPendingImage(url);
      setPendingFile(null);
    } catch { swal.info("อ่านรูปไม่สำเร็จ"); }
  };

  const createCreditImage = async (prompt: string, nextDisplay: Msg[]) => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("กรุณาเข้าสู่ระบบก่อนสร้างภาพ");
      let finalUrl: string | null = null;
      await streamImage(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        { mode: "image", messages: [{ role: "user", content: prompt }] },
        (url, isFinal) => {
          if (isFinal) finalUrl = url;
          setMessages([...nextDisplay, {
            role: "assistant", content: `![ภาพจาก Lovable AI](${url})`, imagePartial: !isFinal,
          }]);
        },
        undefined,
        { Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      );
      // Save to history so the image is still there after closing the chat.
      if (finalUrl) {
        try {
          const image = await toDataUrl(finalUrl);
          const { data: saved, error: saveErr } = await supabase.functions.invoke("ai-chat", {
            body: { mode: "save_image", image, messages: [{ role: "user", content: prompt }] },
          });
          if (saveErr || !saved?.path) throw saveErr || new Error("save failed");
          if (saved.driveSaved === false) swal.toast.info("บันทึกภาพในแชทแล้ว แต่ยังส่งเข้า Google Drive ไม่สำเร็จ");
          const savedContent = `![ภาพจาก Lovable AI](${AI_IMAGE_PREFIX}${saved.path})`;
          setMessages((prev) => {
            const out: Msg[] = [];
            let replaced = false;
            for (const m of prev) {
              if (!replaced && m.role === "assistant" && m.content.includes(finalUrl!)) {
                out.push({ role: "assistant", content: savedContent }); replaced = true; continue;
              }
              const last = out[out.length - 1];
              if (last && last.role === m.role && last.content === m.content) continue; // realtime duplicate
              out.push(m);
            }
            return out.filter((m, i, arr) => !(m.content === savedContent && arr.findIndex((x) => x.content === savedContent) !== i));
          });
        } catch (e) {
          console.warn("[AiChat] save image failed", e);
          swal.toast.info("สร้างภาพแล้ว แต่บันทึกลงประวัติไม่สำเร็จ — แตะที่ภาพแล้วกดบันทึกภาพเก็บไว้");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "สร้างภาพไม่สำเร็จ";
      setMessages([...nextDisplay, { role: "assistant", content: message }]);
      swal.error(message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (readingFile || busy) return;
    if (pendingFile) {
      await runSchoolTool(content || "ช่วยวิเคราะห์และสรุปไฟล์นี้", "", 5, "analyze");
      return;
    }
    if ((!content && !pendingImage) || busy) return;
    // Build user content: text + optional image
    const userContent: any = pendingImage
      ? [
          { type: "text", text: content || "ช่วยอธิบาย/แก้โจทย์จากรูปนี้ให้หน่อย" },
          { type: "image_url", image_url: { url: pendingImage } },
        ]
      : content;
    const displayText = pendingImage
      ? `${content || "(ส่งรูปภาพ)"}\n\n![attached](${pendingImage})`
      : content;
    const nextSend: any[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: userContent },
    ];
    const nextDisplay: Msg[] = [...messages, { role: "user", content: displayText }];
    setMessages(nextDisplay);
    setInput("");
    setPendingImage(null);
    setBusy(true);
    // --- Local tools (ไม่ต้องรอ AI) — สร้างรูป/ใบงาน/แผน/ข้อสอบ ได้ทันที ---
    const lower = String(content||"").toLowerCase();
    if (/(สร้างรูป|วาดรูป|generate image|create image)/i.test(lower)) {
      const prompt = content.replace(/.*(สร้างรูป|วาดรูป|generate image|create image)\s*/i, "").trim() || content;
      await createCreditImage(prompt, nextDisplay);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: nextSend },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.error || "ขอโทษค่ะ ตอบไม่ได้";
      setMessages([...nextDisplay, { role: "assistant", content: reply }]);
      if (data?.historySaved === false) swal.error("สร้างคำตอบแล้ว แต่ยังบันทึกแชทไม่สำเร็จ กรุณาคัดลอกหรือบันทึกร่างเก็บไว้ก่อนปิดหน้า");
      speak(reply);
    } catch (e: any) {
      // ลอง AI ฟรีในเครื่องก่อน (ไม่ต้องใช้ API)
      try {
        const prompt = nextSend.map(m=> `${m.role}: ${m.content}`).join("\n");
        const free = await askFreeAI(prompt);
        if (free) { setMessages([...nextDisplay, { role: "assistant", content: free + "\n\n_(ตอบด้วย AI ฟรีในเครื่อง)_" }]); speak(free); return; }
      } catch {}
      const msg = String(e?.message || e?.context?.error || "");
      // จำแนกชนิด error ให้แม่นยำ — "เครดิตหมด" ใช้เฉพาะกรณีโควต้าจริงๆ เท่านั้น
      const isDailyQuota = /ครบ\s*\d+\s*ข้อความ|daily limit|quota.*exceed/i.test(msg);
      const isCreditOut = /402|insufficient.*credit|credit.*exhaust|payment required|All AI providers failed/i.test(msg);
      const isRateLimit = /429|rate.?limit|too many requests/i.test(msg) && !isDailyQuota;
      const friendly = isDailyQuota
        ? "วันนี้ใช้ AI ครบโควต้าแล้วค่ะ กรุณากลับมาใหม่พรุ่งนี้นะคะ 🙏"
        : isCreditOut
          ? "ขออภัยค่ะ เครดิต AI หมด กรุณาแจ้งผู้ดูแลระบบเพื่อเพิ่ม API key ที่ /dashboard/admin/ai-providers นะคะ 🙏"
          : isRateLimit
            ? "ระบบ AI ถูกเรียกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่นะคะ 🙏"
            : `ขออภัยค่ะ เกิดข้อขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ 🙏${msg ? `\n\n_รายละเอียด: ${msg.slice(0, 200)}_` : ""}`;
      setMessages([...nextDisplay, { role: "assistant", content: friendly }]);
    } finally {
      setBusy(false);
    }
  };

  const runSchoolTool = async (topic: string, grade: string, count: number, requestedTool?: SchoolTool) => {
    const tool = requestedTool || activeTool;
    if (!tool || busy || readingFile) return;
    const label = schoolToolLabels[tool];
    const next: Msg[] = [...messages, { role: "user", content: `${label}: ${topic}${pendingFile ? `\nไฟล์ประกอบ: ${pendingFile.name}` : ""}` }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setActiveTool(null);
    setBusy(true);
    try {
      await streamSchoolTool({ tool, topic, grade, count, attachment: pendingFile || undefined }, text => {
        setMessages([...next, { role: "assistant", content: text }]);
      });
      setInput("");
      setPendingFile(null);
    } catch (error) {
      swal.error(error instanceof Error ? error.message : "สร้างงานไม่สำเร็จ");
      setInput(topic);
    } finally { setBusy(false); }
  };

  const generateImage = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    const nextDisplay: Msg[] = [...messages, { role: "user", content: `🎨 สร้างรูป: ${prompt}` }];
    setMessages(nextDisplay);
    setInput("");
    setBusy(true);
    await createCreditImage(prompt, nextDisplay);
  };


  // ===== Auto voice-loop (shared behavior with KioskHelloAi) =====
  const stopVoiceLoop = () => {
    autoLoopRef.current = false;
    if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };

  // ฟังหนึ่งรอบ (3 วิ) — ไม่มีเสียง → null
  const listenOnce = (): Promise<string | null> => new Promise((resolve) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { resolve(null); return; }
    const rec = new SR();
    rec.lang = "th-TH"; rec.continuous = false; rec.interimResults = false;
    recRef.current = rec;
    let done = false;
    const finish = (v: string | null) => {
      if (done) return; done = true;
      if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
      setListening(false);
      try { rec.stop(); } catch {}
      recRef.current = null;
      resolve(v);
    };
    rec.onresult = (e: any) => finish(e.results?.[0]?.[0]?.transcript || null);
    rec.onerror = () => finish(null);
    rec.onend = () => finish(null);
    try {
      rec.start();
      setListening(true);
      listenTimerRef.current = window.setTimeout(() => finish(null), LISTEN_WINDOW_MS);
    } catch { finish(null); }
  });

  // ส่งข้อความไป AI แล้วคืนคำตอบ (สำหรับ voice loop)
  const sendVoice = async (text: string): Promise<string | null> => {
    const nextDisplay: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextDisplay);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, { role: "user", content: text }].map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.error || "ขออภัยค่ะ ตอบไม่ได้";
      setMessages([...nextDisplay, { role: "assistant", content: reply }]);
      return reply;
    } catch {
      setMessages([...nextDisplay, { role: "assistant", content: "ขออภัยค่ะ เกิดข้อขัดข้องชั่วคราว 🙏" }]);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const runVoiceLoop = async () => {
    while (autoLoopRef.current) {
      beep(880, 0.15);
      await new Promise((r) => setTimeout(r, 250));
      const said = await listenOnce();
      if (!autoLoopRef.current) return;
      if (!said) {
        emptyRoundsRef.current += 1;
        if (emptyRoundsRef.current === 1) {
          setMessages((m) => [...m, { role: "assistant", content: RETRY_PROMPT }]);
          await speak(RETRY_PROMPT, true);
          continue;
        }
        if (emptyRoundsRef.current >= MAX_EMPTY_ROUNDS) {
          beep(440, 0.12);
          await new Promise((r) => setTimeout(r, 180));
          beep(330, 0.18);
          autoLoopRef.current = false;
          return;
        }
        continue;
      }
      emptyRoundsRef.current = 0;
      const reply = await sendVoice(said);
      if (!autoLoopRef.current) return;
      if (reply) {
        await speak(reply, true);
        if (!autoLoopRef.current) return;
        setMessages((m) => [...m, { role: "assistant", content: FOLLOWUP_PROMPT }]);
        await speak(FOLLOWUP_PROMPT, true);
      }
    }
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { swal.info("เบราว์เซอร์ไม่รองรับการสั่งงานด้วยเสียง"); return; }
    if (autoLoopRef.current || listening) {
      stopVoiceLoop();
      return;
    }
    emptyRoundsRef.current = 0;
    autoLoopRef.current = true;
    runVoiceLoop();
  };

  // รูปจาก backend เก่าที่ปิดไปแล้วโหลดไม่ได้ — ซ่อนรูปที่เสียแทนการแสดงข้อความแตก
  return createPortal(
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-3 md:bottom-[calc(env(safe-area-inset-bottom)+24px)] md:right-5 lg:bottom-[calc(env(safe-area-inset-bottom)+24px)] lg:right-6 z-40 group"
          aria-label="เปิดผู้ช่วย AI"
        >
          <span className="absolute -top-9 right-0 hidden group-hover:block whitespace-nowrap text-xs font-bold bg-white text-foreground border-2 border-foreground rounded-full px-3 py-1 shadow-[3px_3px_0_hsl(var(--foreground))]"
            style={{ fontFamily: "'Comic Sans MS', 'IBM Plex Sans Thai', sans-serif" }}
          >
            คุยกับ {bot.name} 💬
          </span>
          <span className="relative block w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 via-fuchsia-500 to-violet-500 border-2 border-white ring-2 ring-foreground/80 shadow-[3px_3px_0_hsl(var(--foreground))] flex items-center justify-center overflow-hidden hover:rotate-6 hover:scale-110 transition-transform animate-bounce-slow">
            {bot.avatarUrl && !avatarBroken ? (
              <img src={bot.avatarUrl} alt={bot.name} className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} />
            ) : (
              <MessageCircle className="w-5 h-5 text-white drop-shadow" />
            )}
          </span>
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full ring-2 ring-white animate-pulse" />
          <span className="absolute -top-1.5 -left-1.5 text-sm animate-bounce">✨</span>

        </button>
      )}


      {/* Chat panel */}
      {open && (
        <div className={cn(
          "fixed flex flex-col overflow-hidden bg-background text-foreground",
          fullscreen
            ? "inset-0 z-[100] w-full h-[100dvh]"
            : "z-40 rounded-3xl shadow-2xl border border-border bottom-[calc(env(safe-area-inset-bottom)+76px)] right-3 md:bottom-[calc(env(safe-area-inset-bottom)+24px)] md:right-6 w-[min(360px,calc(100vw-2rem))] h-[min(520px,calc(100dvh-8rem))]",
        )}
          ref={panelRef}
          role="dialog"
          aria-modal={fullscreen || undefined}
          aria-label={`แชทกับ ${bot.name}`}
          style={fullscreen ? undefined : { backgroundColor: bot.bgColor, boxShadow: "0 20px 60px -12px hsl(var(--primary)/0.25), 0 8px 20px -4px hsl(var(--foreground)/0.1)" }}
        >
          <div className={cn("flex shrink-0 items-center gap-2.5 px-4 py-3 border-b border-border", fullscreen && "sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]")} style={fullscreen ? undefined : { background: bot.headerGradient || "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
            <Avatar className="w-8 h-8">
              {bot.avatarUrl && !avatarBroken ? <AvatarImage src={bot.avatarUrl} /> : schoolLogo ? <AvatarImage src={schoolLogo} /> : null}
              <AvatarFallback className="gradient-primary text-primary-foreground"><Bot className="w-4 h-4" /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{bot.name}</div>
              <div className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-success rounded-full" /> ออนไลน์
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? "ปิดเสียง" : "เปิดเสียง"}>
              {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFullscreen(value => !value)} title={fullscreen ? "ย่อแชท" : "เปิดแชทเต็มจอ"} aria-label={fullscreen ? "ย่อแชท" : "เปิดแชทเต็มจอ"}>
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="ปิดแชท AI" title="ปิดแชท AI" onClick={() => { stopVoiceLoop(); setOpen(false); setFullscreen(false); window.speechSynthesis?.cancel(); try { remoteAudioRef.current?.pause(); } catch {} try { elevenAudioRef.current?.pause(); } catch {} }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {historyError && <div role="alert" className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-sm text-destructive bg-background">
            <span>โหลดประวัติแชทไม่สำเร็จ</span>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setHistoryRetry(value => value + 1)}>ลองใหม่</Button>
          </div>}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            style={!fullscreen && bot.bgImageUrl ? { backgroundImage: `url(${bot.bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className={cn("p-3 space-y-2", fullscreen && "w-full max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-5")}>
              {messages.map((m, i) => {
                // Parse markdown ![](url) → render text + image segments
                const segments: Array<{ type: "text" | "img"; value: string }> = [];
                const re = /!\[[^\]]*\]\(([^)]+)\)/g;
                let lastIdx = 0; let mm: RegExpExecArray | null;
                const raw = m.content || "";
                while ((mm = re.exec(raw)) !== null) {
                  if (mm.index > lastIdx) segments.push({ type: "text", value: raw.slice(lastIdx, mm.index) });
                  segments.push({ type: "img", value: mm[1] });
                  lastIdx = mm.index + mm[0].length;
                }
                if (lastIdx < raw.length) segments.push({ type: "text", value: raw.slice(lastIdx) });
                if (segments.length === 0) segments.push({ type: "text", value: raw });
                const textOnly = segments.filter((s) => s.type === "text").map((s) => s.value).join(" ").trim();
                return (
                  <div key={i} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap break-words shadow-sm space-y-1",
                        m.role === "user" ? "rounded-br-sm" : "rounded-bl-sm",
                      )}
                      style={{
                        backgroundColor: m.role === "user" ? bot.userColor : bot.assistantColor,
                        color: textOn(m.role === "user" ? bot.userColor : bot.assistantColor),
                      }}
                    >
                      {segments.map((s, idx) =>
                        s.type === "img" ? (
                          <ChatImage key={idx} src={s.value} partial={m.imagePartial} onOpen={setViewerUrl} />
                        ) : (
                          s.value && <div key={idx} className="prose prose-sm max-w-none dark:prose-invert text-inherit prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit"><ReactMarkdown>{s.value}</ReactMarkdown></div>
                        )
                      )}
                    </div>
                    {m.role === "assistant" && textOnly && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(textOnly); swal.success("คัดลอกแล้ว"); } catch { swal.error("คัดลอกไม่สำเร็จ"); } }}>คัดลอก</Button>
                        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { const url = URL.createObjectURL(new Blob([textOnly], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "school-ai-draft.txt"; a.click(); URL.revokeObjectURL(url); }}>บันทึกร่าง</Button>
                      <button
                        type="button"
                        onClick={() => speak(textOnly, true)}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-muted transition-colors"
                        title="ฟังอีกครั้ง"
                      >
                        <Play className="w-3 h-3" /> ฟังอีกครั้ง
                      </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!busy && !input && messages[messages.length - 1]?.role !== "user" && (
                <div className="flex flex-wrap gap-1.5 pt-1" aria-label="งานที่ผู้ช่วยทำได้">
                  {(["teacher","admin","director","staff"].includes(userRole||"")
                    ? ["ช่วยร่างหนังสือราชการเรื่อง ", "ช่วยสรุปรายงานต่อไปนี้ให้กระชับ: ", "ช่วยร่างประกาศโรงเรียนเรื่อง ", "ช่วยเขียนข้อความแจ้งผู้ปกครองทาง LINE เรื่อง "]
                    : userRole==="parent" ? ["ลูกมีการบ้านค้างไหม", "ลูกมาเรียนครบไหมสัปดาห์นี้"] : ["ช่วยอธิบายบทเรียนเรื่อง ", "ช่วยสรุปเนื้อหาต่อไปนี้: "]
                  ).map((p) => (
                    <button key={p} type="button" onClick={() => setInput(p)}
                      className="text-xs rounded-full border bg-card px-3 py-1.5 text-foreground hover:bg-muted hover:border-primary/40 transition-colors">
                      {p.replace(/[:\s]+$/, "").replace(/เรื่อง$/, "").replace(/^ช่วย/, "")}
                    </button>
                  ))}
                </div>
              )}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> กำลังคิด...
                  </div>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className={cn("flex shrink-0 flex-col gap-1 p-2 border-t bg-card", fullscreen && "w-full max-w-4xl mx-auto px-4 sm:px-8 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]")}
          >
            {pendingImage && (
              <div className="relative inline-block self-start">
                <img src={pendingImage} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                  title="ลบรูป"
                >×</button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            <AiFileAttachment file={pendingFile} reading={readingFile} disabled={busy} onPick={pickDocument} onRemove={() => setPendingFile(null)} />
            <div className="flex items-center gap-1 flex-wrap">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleMic} title="พูดใส่ไมค์">
                {listening ? <MicOff className="w-4 h-4 text-destructive animate-pulse" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()} title="แนบรูปภาพ" disabled={busy}>
                <ImagePlus className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={generateImage} title="สร้างภาพด้วยเครดิต Lovable AI" disabled={busy || !input.trim()}>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </Button>
              {["teacher","admin","director"].includes(userRole||"") && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={()=> setActiveTool("worksheet")} aria-label="สร้างใบงาน" title="สร้างใบงาน" disabled={busy}><FileText className="w-3.5 h-3.5 text-sky-600" /></Button>}
              {["teacher","admin","director"].includes(userRole||"") && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={()=> setActiveTool("lesson")} aria-label="สร้างแผนการสอน" title="สร้างแผนการสอน" disabled={busy}><BookOpen className="w-3.5 h-3.5 text-emerald-600" /></Button>}
              {(["teacher","admin","director","student"].includes(userRole||"")) && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={()=> setActiveTool("quiz")} aria-label="สร้างข้อสอบ" title="สร้างข้อสอบ" disabled={busy}><ClipboardCheck className="w-3.5 h-3.5 text-violet-600" /></Button>}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={()=> setActiveTool("grades")} aria-label="สรุปผลการเรียน" title="สรุปผลการเรียนจากข้อมูลที่ให้" disabled={busy}><GraduationCap className="w-3.5 h-3.5 text-amber-600" /></Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                placeholder={pendingImage ? "เพิ่มคำถามเกี่ยวกับรูป (ไม่บังคับ)..." : "พิมพ์ข้อความ..."}
                className={cn("h-8 text-sm", fullscreen && "h-12")}
                disabled={busy}
                maxLength={2000}
              />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={busy || readingFile || (!input.trim() && !pendingImage && !pendingFile)}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className={`text-[10px] text-right pr-1 ${input.length >= 1800 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {input.length}/2000 ตัวอักษร · ✨ รูป · 📄 ใบงาน · 📚 แผน · 📋 ข้อสอบ · 🎓 สรุปเกรด
            </div>
          </form>
        </div>
      )}
      <SchoolToolDialog tool={activeTool} draft={input} busy={busy} attachment={pendingFile} reading={readingFile} onPick={pickDocument} onRemove={() => setPendingFile(null)} onClose={() => setActiveTool(null)} onGenerate={runSchoolTool} />
      {viewerUrl && (
        <div className="fixed inset-0 z-[200] bg-background/95 flex flex-col" role="dialog" aria-label="ดูภาพเต็ม" onClick={() => setViewerUrl(null)}>
          <div className="flex justify-end gap-2 p-3" onClick={(e) => e.stopPropagation()}>
            <Button asChild variant="secondary" size="sm"><a href={viewerUrl} target="_blank" rel="noreferrer" download>บันทึกภาพ</a></Button>
            <Button variant="secondary" size="icon" onClick={() => setViewerUrl(null)} aria-label="ปิด"><X className="w-4 h-4" /></Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <img src={viewerUrl} alt="ภาพเต็ม" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
