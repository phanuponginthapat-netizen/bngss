import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X, MessageCircle, Loader2, Play, ImagePlus, Sparkles, Maximize2, Minimize2, FileText, FileType2, Presentation, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAiBotSettings } from "@/hooks/useAiBotSettings";
import { swal } from "@/lib/swal";
import { subscribeToPush, getCurrentPushStatus, isPwaCapable, isInIframe, isPreviewHost } from "@/lib/pushSubscribe";
import { checkProfanity, moderateImage } from "@/lib/contentModeration";
import { useUserRole } from "@/hooks/useUserRole";

type Msg = { role: "user" | "assistant"; content: string };

type ChatLogRow = { role: "user" | "assistant"; content: string; created_at: string };

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
  const greetingMsg: Msg = useMemo(() => ({ role: "assistant", content: bot.greeting }), [bot.greeting]);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([greetingMsg]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
  const { schoolLogo } = useSystemSettings();
  const { role } = useUserRole();
  const canUseDocTools = role === "admin" || role === "director" || role === "teacher";

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
      const { data } = await supabase
        .from("ai_chat_logs")
        .select("role,content,created_at")
        .eq("user_id", uid)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      if (data && data.length) {
        setMessages([greetingMsg, ...orderChatRows(data as ChatLogRow[])]);
      }
      // Realtime: pick up messages from other devices/sessions
      channel = supabase
        .channel(`ai-chat-${uid}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "ai_chat_logs", filter: `user_id=eq.${uid}` },
          (payload: any) => {
            const r = payload.new;
            if (!r || (r.role !== "user" && r.role !== "assistant")) return;
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
    })();
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
      const { data } = await supabase
        .from("ai_chat_logs")
        .select("role,content,created_at")
        .eq("user_id", uid)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled || !data) return;
      setMessages([greetingMsg, ...orderChatRows(data as ChatLogRow[])]);
    })();
    return () => { cancelled = true; };
  }, [open, greetingMsg]);

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
    // แทนเสียง "ฮูก"/"ฮู้ก" (เสียงนกฮูก) ด้วย marker เพื่อเล่นเสียงนกฮูกจริงๆ ตอนพูด
    t = t.replace(/ฮู้?[กกๆๆ]+/g, ` ${OWL_MARK} `);
    t = t.replace(/ฮู[\s,!.…]*ฮู[\s,!.…]*/g, ` ${OWL_MARK} `);
    // แก้คำอ่าน "ดร.เอาล์" / "ดร เอาล์" / "Dr. Owl" → "ดอกเตอร์อาว" (ออกเสียงให้ถูก)
    t = t.replace(/ดร\.?\s*เอาล์?/g, "ดอกเตอร์อาว");
    t = t.replace(/เอาล์/g, "อาว");
    t = t.replace(/\bDr\.?\s*Owl\b/gi, "ดอกเตอร์อาว");
    // ลบ emoji และสัญลักษณ์พิเศษที่ทำให้ TTS สะดุด
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");
    // === คณิตศาสตร์: ออกเสียงเครื่องหมายเป็นภาษาไทย (ทำก่อน strip อักขระ) ===
    // ทศนิยมในบริบทตัวเลข: 3.14 → "3 จุด 14"
    t = t.replace(/(\d)\.(\d)/g, "$1 จุด $2");
    // เครื่องหมายคณิตศาสตร์
    t = t.replace(/\s*[×✕]\s*/g, " คูณ ");
    t = t.replace(/(\d)\s*[xX]\s*(\d)/g, "$1 คูณ $2");
    t = t.replace(/(\d)\s*\*\s*(\d)/g, "$1 คูณ $2");
    t = t.replace(/\s*[÷]\s*/g, " หาร ");
    t = t.replace(/(\d)\s*\/\s*(\d)/g, "$1 หาร $2");
    t = t.replace(/(\d)\s*-\s*(\d)/g, "$1 ลบ $2");
    t = t.replace(/(^|\s)-(\d)/g, "$1ลบ $2");
    // ยกกำลัง / superscript
    t = t.replace(/\^2\b/g, " ยกกำลังสอง ");
    t = t.replace(/\^3\b/g, " ยกกำลังสาม ");
    t = t.replace(/\^(\d+)/g, " ยกกำลัง $1 ");
    t = t.replace(/²/g, " ยกกำลังสอง ");
    t = t.replace(/³/g, " ยกกำลังสาม ");
    // เศษส่วน
    t = t.replace(/½/g, " ครึ่ง ");
    t = t.replace(/¼/g, " หนึ่งส่วนสี่ ");
    t = t.replace(/¾/g, " สามส่วนสี่ ");
    // เครื่องหมายเปรียบเทียบ
    t = t.replace(/≥/g, " มากกว่าหรือเท่ากับ ");
    t = t.replace(/≤/g, " น้อยกว่าหรือเท่ากับ ");
    t = t.replace(/≠/g, " ไม่เท่ากับ ");
    t = t.replace(/(\d)\s*>\s*(\d)/g, "$1 มากกว่า $2");
    t = t.replace(/(\d)\s*<\s*(\d)/g, "$1 น้อยกว่า $2");

    // แปลงสัญลักษณ์ bullet/markdown เป็นการเว้นวรรค
    t = t.replace(/[*_~#>`|]+/g, " ");
    t = t.replace(/^\s*[-•]\s+/gm, " ");
    t = t.replace(/(^|\s)[-–—]+(\s|$)/g, "$1 $2");
    t = t.replace(/\//g, " ");
    t = t.replace(/\\/g, " ");
    // แปลงสัญลักษณ์ที่อ่านไม่เป็นธรรมชาติ
    t = t.replace(/&/g, " และ ");
    t = t.replace(/\+/g, " บวก ");
    t = t.replace(/=/g, " เท่ากับ ");
    t = t.replace(/%/g, " เปอร์เซ็นต์ ");
    // ลบวงเล็บ
    t = t.replace(/[()[\]{}<>"]+/g, " ");
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

  const speakUtterance = (seg: { text: string; lang: "th-TH" | "en-US" }, thVoice: SpeechSynthesisVoice | null, enVoice: SpeechSynthesisVoice | null) =>
    new Promise<void>((resolve) => {
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
    });

  const speak = async (text: string, force = false) => {
    if ((!voiceOn && !force) || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = sanitizeForSpeech(text);
      if (!clean) return;
      const thVoice = pickThaiVoice();
      const enVoice = pickEnglishUSVoice();
      // แยกข้อความตาม marker เสียงนกฮูก แล้วเล่นสลับกัน: พูด → ฮูก → พูด …
      const parts = clean.split(OWL_MARK);
      for (let i = 0; i < parts.length; i++) {
        const piece = parts[i].trim();
        if (piece) {
          const segments = segmentByLanguage(piece);
          for (const seg of segments) {
            await speakUtterance(seg, thVoice, enVoice);
          }
        }
        if (i < parts.length - 1) {
          await playOwlHoot();
        }
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
      // ตรวจรูปไม่เหมาะสมก่อน attach
      const mod = await moderateImage(url);
      if (!mod.ok) { swal.info(`รูปภาพไม่ผ่านการตรวจสอบ — ${mod.reason}`); return; }
      setPendingImage(url);
    } catch { swal.info("อ่านรูปไม่สำเร็จ"); }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (content) {
      const chk = checkProfanity(content);
      if (!chk.ok) { swal.info(`กรุณาใช้ภาษาสุภาพ — ${chk.reason}`); return; }
      const scope = checkSchoolScope(content);
      if (!scope.ok) { swal.info(scope.reason!); return; }
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
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: nextSend },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.error || "ขอโทษค่ะ ตอบไม่ได้";
      setMessages([...nextDisplay, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (e: any) {
      const msg = e?.message || "";
      const friendly = /non-2xx|429|402|quota|credit|limit/i.test(msg)
        ? "ขออภัยค่ะ ขณะนี้เครดิตการใช้งาน AI หมดแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อดำเนินการต่อนะคะ 🙏"
        : "ขออภัยค่ะ เกิดข้อขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ 🙏";
      setMessages([...nextDisplay, { role: "assistant", content: friendly }]);
    } finally {
      setBusy(false);
    }
  };

  const generateImage = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    const scope = checkSchoolScope(prompt);
    if (!scope.ok) { swal.info(scope.reason!); return; }
    const nextDisplay: Msg[] = [...messages, { role: "user", content: `🎨 สร้างรูป: ${prompt}` }];
    setMessages(nextDisplay);
    setInput("");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { mode: "image", messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.error || "สร้างรูปไม่สำเร็จ";
      setMessages([...nextDisplay, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...nextDisplay, { role: "assistant", content: "ขออภัยค่ะ สร้างรูปไม่สำเร็จ 🙏" }]);
    } finally {
      setBusy(false);
    }
  };


  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { swal.info("เบราว์เซอร์ไม่รองรับการสั่งงานด้วยเสียง"); return; }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "th-TH";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      if (transcript) send(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  // ===== School-scope guard: ป้องกันใช้ AI นอกขอบเขตงานโรงเรียน (กันเครดิตฟุ่มเฟือย) =====
  const OFF_TOPIC_PATTERNS = [
    /หวย|สลาก|เลขเด็ด|แทงบอล|พนัน|คาสิโน|บาคาร่า|สล็อต|gamble|casino|bet/i,
    /crypto|บิตคอย|bitcoin|เหรียญดิจิทัล|ico|nft|forex|เก็งกำไร/i,
    /ดูดวง|ทำนาย|ไพ่ยิปซี|โหราศาสตร์|ฤกษ์|tarot|horoscope/i,
    /(หาแฟน|จีบ|sex|porn|18\+|nude|เสียว|กามา|ลามก)/i,
    /แต่งเพลง.*(รัก|อกหัก)|เขียนนิยาย(?!.*การเรียน|.*นักเรียน)|fanfic|แฟนฟิค/i,
    /(ทำอาวุธ|ระเบิด|hack|crack|เจาะระบบ|bypass\s*password)/i,
  ];
  const SCHOOL_KEYWORDS = /โรงเรียน|นักเรียน|ครู|บทเรียน|การบ้าน|วิชา|สอบ|คณิต|วิทย|ภาษา|ประวัติ|สังคม|ศิลปะ|พลศึกษา|ห้องเรียน|กิจกรรม|ผู้ปกครอง|ผู้อำนวยการ|รายงาน|เอกสาร|ปพ|สพฐ|ระเบียบ|งาน|แผนการสอน|วิจัย|class|teach|lesson|homework|student|school|math|science|english|exam|report|curriculum|education/i;
  const checkSchoolScope = (text: string): { ok: boolean; reason?: string } => {
    if (!text || text.length < 5) return { ok: true };
    for (const p of OFF_TOPIC_PATTERNS) {
      if (p.test(text)) return { ok: false, reason: "คำขอนี้อยู่นอกขอบเขตงานโรงเรียน — กรุณาใช้สำหรับการเรียนการสอน งานวิชาการ หรืองานบริหารโรงเรียนเท่านั้น" };
    }
    return { ok: true };
  };

  // ===== Document generators (PDF / Word / Slide / Image) =====
  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const askAiText = async (prompt: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: { messages: [{ role: "user", content: prompt }] },
    });
    if (error) throw error;
    return (data as any)?.reply || "";
  };

  const generateWorksheet = async () => {
    const topic = input.trim();
    if (!topic) { swal.info("พิมพ์รายละเอียดใบงานก่อน เช่น 'ใบงานคณิต ป.3 บวก-ลบไม่เกิน 100 10 ข้อ' หรือ 'ใบงานภาษาอังกฤษ ม.1 verb to be'"); return; }
    const guard = checkSchoolScope(topic);
    if (!guard.ok) { swal.info(guard.reason!); return; }
    const profCheck = checkProfanity(topic);
    if (!profCheck.ok) { swal.info(`กรุณาใช้ภาษาสุภาพ — ${profCheck.reason}`); return; }

    setMessages((p) => [...p, { role: "user", content: `📝 สร้างใบงาน: ${topic}` }]);
    setInput(""); setBusy(true);
    try {
      const prompt = `สร้าง "ใบงาน" (worksheet) สำหรับนักเรียนตามคำสั่ง: "${topic}"
ข้อกำหนด:
- ตอบกลับเป็น HTML เท่านั้น ห้ามมี code fence หรือคำอธิบายเพิ่ม
- ปรับระดับภาษา/ความยากให้เหมาะกับวัย/ชั้นที่ระบุในคำสั่ง (ถ้าไม่ระบุ ให้คาดเดาที่เหมาะสม)
- โครงสร้าง:
  <header class="ws-head">
    <div class="ws-row"><span>ชื่อ-สกุล: <span class="blank long"></span></span><span>ชั้น: <span class="blank"></span></span><span>เลขที่: <span class="blank short"></span></span></div>
    <h1>หัวข้อใบงาน</h1>
    <p class="ws-objective">จุดประสงค์: ...</p>
    <p class="ws-instruction">คำชี้แจง: ...</p>
  </header>
  <ol class="ws-questions">
    <li>โจทย์ข้อ 1 ... <span class="blank long"></span></li>
    <li>โจทย์ที่ต้องเขียนยาว ...<div class="answer-box"></div></li>
    <li>เลือกตอบ: <label><input type="checkbox"/> ก. ...</label> <label><input type="checkbox"/> ข. ...</label></li>
    <li>จับคู่: <table class="match"><tr><td>1. ...</td><td><span class="blank"></span></td><td>ก. ...</td></tr></table></li>
  </ol>
  <footer class="ws-foot">คะแนนเต็ม ___ / ได้ ___ &nbsp; ผู้ตรวจ: <span class="blank long"></span></footer>
- ใช้ความหลากหลาย: เติมคำ, จับคู่, ตัวเลือก, เขียนตอบ, วาดภาพ (มี <div class="draw-box">วาดภาพ</div>) ตามความเหมาะสม
- อย่างน้อย 8-15 ข้อ`;
      let html = await askAiText(prompt);
      html = html.replace(/```html?\s*|```/g, "").trim();
      if (!html) throw new Error("ไม่ได้เนื้อหา");

      const w = window.open("", "_blank", "width=900,height=1100");
      if (!w) { swal.info("เบราว์เซอร์บล็อก popup — เปิดอนุญาตแล้วลองใหม่"); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ใบงาน: ${topic}</title>
        <style>
          @page{size:A4;margin:1.8cm}
          body{font-family:'TH Sarabun New','Sarabun',sans-serif;font-size:16pt;color:#111;line-height:1.55}
          .ws-head{border:2px solid #1e3a8a;border-radius:8px;padding:.6cm .8cm;margin-bottom:.6cm;background:linear-gradient(135deg,#eff6ff,#fff)}
          .ws-head h1{margin:.2cm 0;font-size:22pt;color:#1e3a8a;text-align:center}
          .ws-row{display:flex;justify-content:space-between;gap:.5cm;font-size:14pt;margin-bottom:.3cm}
          .ws-objective,.ws-instruction{margin:.15cm 0;font-size:14pt}
          .ws-instruction{font-weight:600}
          .blank{display:inline-block;border-bottom:1.5px dotted #333;min-width:3cm;height:1.2em;vertical-align:bottom}
          .blank.long{min-width:6cm}
          .blank.short{min-width:1.5cm}
          .answer-box{border:1.5px solid #555;border-radius:6px;min-height:2.2cm;margin:.2cm 0 .4cm;background:repeating-linear-gradient(transparent,transparent 0.7cm,#cbd5e1 0.7cm,#cbd5e1 .72cm)}
          .draw-box{border:2px dashed #6366f1;border-radius:8px;min-height:5cm;margin:.3cm 0;display:flex;align-items:flex-start;justify-content:flex-end;padding:.2cm;color:#94a3b8;font-size:12pt}
          ol.ws-questions{padding-left:1.2cm}
          ol.ws-questions>li{margin-bottom:.45cm;page-break-inside:avoid}
          label{display:inline-flex;align-items:center;gap:.2cm;margin-right:.6cm}
          input[type=checkbox]{width:14pt;height:14pt;border:1.5px solid #333}
          table.match{border-collapse:collapse;margin:.2cm 0;width:100%}
          table.match td{padding:.15cm .3cm;vertical-align:middle}
          .ws-foot{margin-top:.6cm;padding-top:.3cm;border-top:1.5px dashed #555;font-size:14pt;display:flex;justify-content:space-between;gap:.4cm}
          @media print{.no-print{display:none}}
        </style></head><body>
        <div class="no-print" style="position:fixed;top:8px;right:8px;font-family:sans-serif">
          <button onclick="window.print()" style="padding:6px 14px;border:0;border-radius:6px;background:#1e3a8a;color:#fff;cursor:pointer">🖨️ พิมพ์ / บันทึก PDF</button>
        </div>
        ${html}</body></html>`);
      w.document.close();
      setMessages((p) => [...p, { role: "assistant", content: `✅ สร้างใบงาน "${topic}" เรียบร้อย — กดปุ่ม "พิมพ์/บันทึก PDF" ในหน้าใหม่ได้เลยค่ะ` }]);
    } catch (e: any) {
      setMessages((p) => [...p, { role: "assistant", content: `ขออภัยค่ะ สร้างใบงานไม่สำเร็จ: ${e?.message || "เกิดข้อผิดพลาด"}` }]);
    } finally { setBusy(false); }
  };

  const generateDoc = async (kind: "pdf" | "docx" | "slide") => {
    const topic = input.trim();
    if (!topic) { swal.info("พิมพ์หัวข้อ/รายละเอียดที่ต้องการก่อน เช่น 'ใบงานคณิต ป.4 เรื่องเศษส่วน'"); return; }
    const guard = checkSchoolScope(topic);
    if (!guard.ok) { swal.info(guard.reason!); return; }
    const profCheck = checkProfanity(topic);
    if (!profCheck.ok) { swal.info(`กรุณาใช้ภาษาสุภาพ — ${profCheck.reason}`); return; }

    const label = kind === "pdf" ? "PDF" : kind === "docx" ? "Word" : "สไลด์";
    setMessages((p) => [...p, { role: "user", content: `📄 สร้างเอกสาร ${label}: ${topic}` }]);
    setInput(""); setBusy(true);
    try {
      const prompt = kind === "slide"
        ? `สร้างเนื้อหาสไลด์นำเสนอสำหรับงานโรงเรียน หัวข้อ: "${topic}"\nรูปแบบ: ส่งกลับเป็น HTML เท่านั้น (ห้ามมี code fence) แต่ละสไลด์อยู่ใน <section> มี <h2> หัวข้อ และเนื้อหา bullet/short text เหมาะกับการนำเสนอ ประมาณ 5-8 สไลด์`
        : `สร้างเอกสารงานโรงเรียน หัวข้อ: "${topic}"\nรูปแบบ: ส่งกลับเป็น HTML เท่านั้น (ห้ามมี code fence, ห้ามอธิบายเพิ่ม) ใช้ <h1>, <h2>, <p>, <ul>, <table> ตามความเหมาะสม ภาษาไทยทางการ เหมาะสำหรับ${label}โรงเรียน`;
      let html = await askAiText(prompt);
      html = html.replace(/```html?\s*|```/g, "").trim();
      if (!html) throw new Error("ไม่ได้เนื้อหา");

      if (kind === "pdf") {
        const w = window.open("", "_blank", "width=900,height=1100");
        if (!w) { swal.info("เบราว์เซอร์บล็อก popup — เปิดอนุญาตแล้วลองใหม่"); return; }
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${topic}</title>
          <style>@page{size:A4;margin:2cm}body{font-family:'TH Sarabun New','Sarabun',sans-serif;font-size:16pt;color:#000}
          h1{font-size:24pt}h2{font-size:20pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #555;padding:4px 6px}</style>
          </head><body>${html}<script>onload=()=>{focus();print()}<\/script></body></html>`);
        w.document.close();
      } else if (kind === "docx") {
        const { asBlob } = await import("html-docx-js-typescript");
        const out = await asBlob(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:'TH Sarabun New',sans-serif;font-size:16pt}</style></head><body><h1>${topic}</h1>${html}</body></html>`);
        const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        downloadBlob(blob, `${topic.slice(0, 40)}.docx`);
      } else {
        // slide → A4 landscape printable, one section per page
        const w = window.open("", "_blank", "width=1200,height=800");
        if (!w) { swal.info("เบราว์เซอร์บล็อก popup — เปิดอนุญาตแล้วลองใหม่"); return; }
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${topic}</title>
          <style>@page{size:A4 landscape;margin:1.2cm}body{font-family:'TH Sarabun New',sans-serif;color:#0f172a;margin:0}
          section{page-break-after:always;min-height:18cm;padding:1.5cm;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(135deg,#eef2ff,#fff)}
          section h2{font-size:36pt;margin:0 0 .6cm;color:#3730a3;border-bottom:3px solid #6366f1;padding-bottom:.3cm}
          section ul,section p{font-size:22pt;line-height:1.5}</style>
          </head><body>${html}<script>onload=()=>{focus();print()}<\/script></body></html>`);
        w.document.close();
      }
      setMessages((p) => [...p, { role: "assistant", content: `✅ สร้าง${label}เรื่อง "${topic}" เรียบร้อย — เปิด/ดาวน์โหลดได้แล้ว` }]);
    } catch (e: any) {
      setMessages((p) => [...p, { role: "assistant", content: `ขออภัยค่ะ สร้าง${label}ไม่สำเร็จ: ${e?.message || "เกิดข้อผิดพลาด"}` }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px + (var(--chat-stack, 0) + 1) * 52px)" }}
          className="fixed right-3 md:right-6 z-40 group"
          aria-label="เปิดผู้ช่วย AI"
        >
          <span className="absolute -top-9 right-0 hidden group-hover:block whitespace-nowrap text-xs font-bold bg-white text-foreground border-2 border-foreground rounded-full px-3 py-1 shadow-[3px_3px_0_hsl(var(--foreground))]"
            style={{ fontFamily: "'Comic Sans MS', 'IBM Plex Sans Thai', sans-serif" }}
          >
            คุยกับ {bot.name} 💬
          </span>
          <span className="relative block w-11 h-11 rounded-full bg-gradient-to-br from-danger via-danger to-info border-[2.5px] border-white ring-2 ring-foreground/80 shadow-[3px_3px_0_hsl(var(--foreground))] flex items-center justify-center overflow-hidden hover:rotate-6 hover:scale-110 transition-transform animate-bounce-slow">
            {bot.avatarUrl ? (
              <img src={bot.avatarUrl} alt={bot.name} className="w-full h-full object-cover" />
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
          "fixed z-40 border border-border shadow-elegant flex flex-col overflow-hidden",
          fullscreen
            ? "inset-0 rounded-none w-screen h-screen"
            : "rounded-2xl bottom-[calc(env(safe-area-inset-bottom,0px)+124px)] right-3 md:bottom-[80px] md:right-6 w-[min(340px,calc(100vw-2rem))] h-[min(480px,calc(100vh-8rem))]",
        )}
          style={{ backgroundColor: bot.bgColor }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: bot.headerGradient }}>
            <Avatar className="w-8 h-8">
              {bot.avatarUrl ? <AvatarImage src={bot.avatarUrl} /> : schoolLogo ? <AvatarImage src={schoolLogo} /> : null}
              <AvatarFallback className="gradient-primary text-primary-foreground"><Bot className="w-4 h-4" /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{bot.name}</div>
              <div className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-success rounded-full" /> ออนไลน์ · ใช้งานเฉพาะงานโรงเรียน
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? "ปิดเสียง" : "เปิดเสียง"}>
              {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen((v) => !v)} title={fullscreen ? "ย่อหน้าต่าง" : "ขยายเต็มจอ"}>
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOpen(false); setFullscreen(false); window.speechSynthesis?.cancel(); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Document generator toolbar — staff only (admin/director/teacher) */}
          {canUseDocTools && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/40 text-xs overflow-x-auto">
              <span className="text-[10px] text-muted-foreground shrink-0 mr-1">🎓 สร้างเอกสารโรงเรียน:</span>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" disabled={busy} onClick={() => generateDoc("pdf")} title="สร้างไฟล์ PDF จากหัวข้อในช่องพิมพ์">
                <FileText className="w-3.5 h-3.5 text-danger" />PDF
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" disabled={busy} onClick={() => generateDoc("docx")} title="สร้างไฟล์ Word">
                <FileType2 className="w-3.5 h-3.5 text-info" />Word
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" disabled={busy} onClick={() => generateDoc("slide")} title="สร้างสไลด์นำเสนอ">
                <Presentation className="w-3.5 h-3.5 text-warning" />สไลด์
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-success/30 bg-success-soft hover:bg-success-soft" disabled={busy} onClick={generateWorksheet} title="สร้างใบงาน (worksheet) แบบมีช่องตอบ พร้อมพิมพ์/บันทึก PDF">
                <ClipboardList className="w-3.5 h-3.5 text-success" />ใบงาน
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" disabled={busy || !input.trim()} onClick={generateImage} title="สร้างรูปภาพ">
                <Sparkles className="w-3.5 h-3.5 text-danger" />รูป
              </Button>
            </div>
          )}


          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={bot.bgImageUrl ? { backgroundImage: `url(${bot.bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className="p-3 space-y-2">
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
                          <img key={idx} src={s.value} alt="" className="rounded-lg max-w-full h-auto" loading="lazy" />
                        ) : (
                          s.value && <div key={idx}>{s.value}</div>
                        )
                      )}
                    </div>
                    {m.role === "assistant" && textOnly && (
                      <button
                        type="button"
                        onClick={() => speak(textOnly, true)}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-muted transition-colors"
                        title="ฟังอีกครั้ง"
                      >
                        <Play className="w-3 h-3" /> ฟังอีกครั้ง
                      </button>
                    )}
                  </div>
                );
              })}
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
            className="flex flex-col gap-1 p-2 border-t bg-card"
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
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleMic} title="พูดใส่ไมค์">
                {listening ? <MicOff className="w-4 h-4 text-destructive animate-pulse" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()} title="แนบรูปภาพ" disabled={busy}>
                <ImagePlus className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={generateImage} title="สร้างรูปจากข้อความ" disabled={busy || !input.trim()}>
                <Sparkles className="w-4 h-4 text-warning" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                placeholder={pendingImage ? "เพิ่มคำถามเกี่ยวกับรูป (ไม่บังคับ)..." : "พิมพ์ข้อความ..."}
                className="h-8 text-sm"
                disabled={busy}
                maxLength={2000}
              />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={busy || (!input.trim() && !pendingImage)}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className={`text-[10px] text-right pr-1 ${input.length >= 1800 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {input.length}/2000 ตัวอักษร · ✨ สร้างรูป · 📷 แนบรูป
            </div>
          </form>
        </div>
      )}
    </>
  );
}
