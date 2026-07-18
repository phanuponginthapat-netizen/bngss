import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Globe, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface LanguageToggleProps {
  variant?: "light" | "default";
}

// Google Translate language codes (pageLanguage = 'th')
const LANGUAGES = [
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "my", label: "မြန်မာ (Myanmar)", flag: "🇲🇲" },
  { code: "zh-CN", label: "中文 (简体)", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "lo", label: "ລາວ", flag: "🇱🇦" },
  { code: "km", label: "ខ្មែរ", flag: "🇰🇭" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

const STORAGE_KEY = "app.pageTranslateLang";
const CHANGE_EVENT = "app:page-translate-change";
const STATUS_EVENT = "app:page-translate-status";
const SUPPORTED_CODES = new Set(LANGUAGES.map((language) => language.code));

function getCurrentLang(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED_CODES.has(saved)) return saved;
  const legacy = localStorage.getItem("app.lang");
  if (legacy && ["th", "en", "my", "zh-CN", "ja", "ko", "vi", "lo", "km", "ms", "id", "fr", "de", "es", "ar", "hi", "ru"].includes(legacy)) {
    return legacy;
  }
  return "th";
}

export const LanguageToggle = ({ variant = "default" }: LanguageToggleProps) => {
  const [lang, setLang] = useState<string>("th");
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    setLang(getCurrentLang());
  }, []);

  useEffect(() => {
    const sync = () => setLang(getCurrentLang());
    const handleStatus = (event: Event) => {
      const busy = Boolean((event as CustomEvent<{ busy?: boolean }>).detail?.busy);
      setIsTranslating(busy);
      if (!busy) sync();
    };

    window.addEventListener(CHANGE_EVENT, sync as EventListener);
    window.addEventListener("storage", sync);
    window.addEventListener(STATUS_EVENT, handleStatus as EventListener);

    return () => {
      window.removeEventListener(CHANGE_EVENT, sync as EventListener);
      window.removeEventListener("storage", sync);
      window.removeEventListener(STATUS_EVENT, handleStatus as EventListener);
    };
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  const handleSelect = (code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    localStorage.setItem("app.lang", code);
    setLang(code);
    setIsTranslating(code !== "th");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { lang: code } }));
  };


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            variant === "light"
              ? "text-primary-foreground hover:bg-primary-foreground/10 gap-1 notranslate"
              : "text-muted-foreground hover:text-foreground gap-1 notranslate"
          }
          translate="no"
        >
          {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          <span className="text-xs font-medium">
            {current.flag} {current.code.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] max-h-[60vh] overflow-y-auto notranslate" translate="no">
        {LANGUAGES.map((o, i) => (
          <div key={o.code}>
            {i === 3 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => handleSelect(o.code)} className="cursor-pointer">
              <span className="mr-2">{o.flag}</span>
              <span className="flex-1">{o.label}</span>
              {lang === o.code && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
