import { useEffect, useState } from "react";
import { Loader2, Languages } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PACK_STATUS_EVENT = "app:translate-pack-status";

interface PackStatus {
  loading: boolean;
  lang?: string;
  progress?: number;
  total?: number;
}

const LANG_LABELS: Record<string, string> = {
  en: "English",
  my: "မြန်မာ",
  "zh-CN": "中文",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  lo: "ລາວ",
  km: "ខ្មែរ",
  ms: "Bahasa Melayu",
  id: "Bahasa Indonesia",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  ar: "العربية",
  hi: "हिन्दी",
  ru: "Русский",
};

export const TranslatePackOverlay = () => {
  const [status, setStatus] = useState<PackStatus>({ loading: false });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PackStatus>).detail;
      if (!detail) return;
      setStatus(detail);
    };
    window.addEventListener(PACK_STATUS_EVENT, handler as EventListener);
    const unavailable = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; code?: string }>).detail;
      toast({
        title: "การแปลไม่พร้อมใช้งาน",
        description: detail?.message || "กรุณาลองใหม่ภายหลัง",
        variant: "destructive",
      });
      setStatus({ loading: false });
    };
    window.addEventListener("app:translate-unavailable", unavailable as EventListener);
    return () => {
      window.removeEventListener(PACK_STATUS_EVENT, handler as EventListener);
      window.removeEventListener("app:translate-unavailable", unavailable as EventListener);
    };
  }, []);

  if (!status.loading) return null;

  const langLabel = status.lang ? LANG_LABELS[status.lang] ?? status.lang.toUpperCase() : "";
  const total = status.total ?? 0;
  const progress = status.progress ?? 0;
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm notranslate"
      translate="no"
      role="dialog"
      aria-live="polite"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Languages className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">กำลังโหลดแพ็คภาษา</h3>
            <p className="text-xs text-muted-foreground">
              {langLabel ? `Loading ${langLabel} pack…` : "Loading language pack…"}
            </p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted relative">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.max(percent, 8)}%` }}
          />
          <div className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>
        <p className="mt-2 text-right text-[11px] text-muted-foreground">
          {total > 0 ? `${progress}/${total} • ${percent}%` : "เตรียมข้อมูล…"}
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ครั้งต่อไปจะแปลทันทีจากเครื่องของคุณ (เก็บไว้ในอุปกรณ์)
        </p>
      </div>
    </div>
  );
};

export default TranslatePackOverlay;
