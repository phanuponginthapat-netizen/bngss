import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, X, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGES = [
  { code: "th", label: "🇹🇭 ไทย" },
  { code: "en", label: "🇬🇧 English" },
  { code: "my", label: "🇲🇲 မြန်မာ" },
  { code: "zh-CN", label: "🇨🇳 中文" },
  { code: "ja", label: "🇯🇵 日本語" },
  { code: "ko", label: "🇰🇷 한국어" },
  { code: "vi", label: "🇻🇳 Tiếng Việt" },
  { code: "lo", label: "🇱🇦 ລາວ" },
  { code: "km", label: "🇰🇭 ខ្មែរ" },
  { code: "ms", label: "🇲🇾 Bahasa Melayu" },
  { code: "id", label: "🇮🇩 Bahasa Indonesia" },
  { code: "fr", label: "🇫🇷 Français" },
  { code: "de", label: "🇩🇪 Deutsch" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "hi", label: "🇮🇳 हिन्दी" },
  { code: "ru", label: "🇷🇺 Русский" },
];

const TARGET_KEY = "app.bubbleTranslateTarget";

interface BubbleState {
  text: string;
  x: number;
  y: number;
}

export const TranslationBubble = () => {
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [target, setTarget] = useState<string>(() => {
    if (typeof window === "undefined") return "en";
    return localStorage.getItem(TARGET_KEY) || "en";
  });
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Listen to user selecting text on the page
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection?.();
      const text = sel?.toString().trim() || "";
      if (!text || text.length < 2 || text.length > 2000) {
        return;
      }
      // Ignore selections inside our own panel
      if (panelRef.current && sel && sel.anchorNode && panelRef.current.contains(sel.anchorNode)) {
        return;
      }
      try {
        const range = sel!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const x = Math.min(window.innerWidth - 56, Math.max(8, rect.left + rect.width / 2 - 24));
        const y = Math.max(8, rect.top - 48);
        setBubble({ text, x, y });
        setTranslation(null);
      } catch {
        // ignore
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, []);

  // Close on outside click / escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBubble(null);
        setTranslation(null);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      // Don't close immediately after selection (handled by selection)
      if (window.getSelection?.()?.toString().trim()) return;
      setBubble(null);
      setTranslation(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const translate = async () => {
    if (!bubble) return;
    setLoading(true);
    setTranslation(null);
    try {
      const result = await translateText(bubble.text, target);
      setTranslation(result);
    } catch (e: any) {
      const code = e?.code;
      const message =
        code === "UNAUTHORIZED"
          ? "กรุณาเข้าสู่ระบบใหม่ก่อนใช้งานการแปล"
          : code === "MISSING_PROVIDER_KEY"
            ? "ยังไม่ได้ตั้งค่า API key สำหรับผู้ให้บริการแปล"
            : code === "INVALID_PROVIDER_KEY"
              ? "API key ของผู้ให้บริการแปลไม่ถูกต้องหรือไม่มีสิทธิ์"
              : code === "RATE_LIMITED"
                ? "ผู้ให้บริการแปลเกินโควต้าหรือจำกัดอัตราชั่วคราว"
                : code === "PAYMENT_REQUIRED"
                  ? "บัญชีผู้ให้บริการแปลต้องมีเครดิตหรือเปิด billing"
                  : (e?.message || "แปลไม่สำเร็จ");
      setTranslation("⚠️ " + message);
    } finally {
      setLoading(false);
    }
  };


  const onSelectTarget = (v: string) => {
    setTarget(v);
    localStorage.setItem(TARGET_KEY, v);
    setTranslation(null);
  };

  const copy = async () => {
    if (!translation) return;
    try {
      await navigator.clipboard.writeText(translation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (!bubble) return null;

  // If no translation yet, show small floating bubble button.
  if (!translation && !loading) {
    return (
      <div
        ref={panelRef}
        className="notranslate fixed z-[9999] animate-in fade-in zoom-in-95"
        translate="no"
        style={{ top: bubble.y, left: bubble.x }}
      >
        <Button
          size="sm"
          onClick={translate}
          className="h-9 rounded-full shadow-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Languages className="w-4 h-4" />
          <span className="text-xs font-medium">แปล / Translate</span>
        </Button>
      </div>
    );
  }

  // Expanded panel with translation result
  const panelX = Math.min(window.innerWidth - 340, Math.max(8, bubble.x - 140));
  const panelY = Math.min(window.innerHeight - 220, bubble.y + 40);

  return (
    <div
      ref={panelRef}
      className="notranslate fixed z-[9999] w-[320px] rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95"
      translate="no"
      style={{ top: panelY, left: panelX }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Languages className="w-4 h-4 text-primary" />
          <span>แปลข้อความ</span>
        </div>
        <button
          onClick={() => {
            setBubble(null);
            setTranslation(null);
          }}
          className="p-1 rounded hover:bg-muted"
          aria-label="ปิด"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">ภาษาเป้าหมาย</span>
          <Select value={target} onValueChange={onSelectTarget}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[40vh]">
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-xs">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md bg-muted/50 p-2 text-xs max-h-24 overflow-y-auto">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">ต้นฉบับ</div>
          <div className="whitespace-pre-wrap break-words">{bubble.text}</div>
        </div>

        <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs min-h-[60px] max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase text-primary font-medium">คำแปล</span>
            {translation && !loading && (
              <button onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            )}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>กำลังแปล...</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{translation}</div>
          )}
        </div>

        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={translate} disabled={loading}>
          แปลอีกครั้ง
        </Button>
      </div>
    </div>
  );
};

export default TranslationBubble;
