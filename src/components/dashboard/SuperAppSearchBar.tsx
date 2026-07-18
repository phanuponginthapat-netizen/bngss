import { Search, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Sticky Alipay/WeChat-style top bar.
 * Search button triggers the global CommandPalette (Ctrl/Cmd+K).
 * Scan button jumps to the face-scan flow which already supports QR/barcode.
 */
export default function SuperAppSearchBar() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const openPalette = () => {
    // Re-use the existing CommandPalette keybind (Cmd/Ctrl+K)
    const isMac = navigator.platform.toLowerCase().includes("mac");
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      })
    );
  };

  return (
    <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 pt-1 pb-2 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openPalette}
          className="flex-1 flex items-center gap-2 h-11 px-4 rounded-full bg-muted/70 hover:bg-muted ring-1 ring-border/60 text-left transition-all hover:shadow-sm active:scale-[0.99]"
        >
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            {L("ค้นหาเมนู นักเรียน เอกสาร…", "Search menus, students, docs…")}
          </span>
          <kbd className="ml-auto hidden sm:inline-flex items-center text-[10px] font-mono text-muted-foreground/80 px-1.5 py-0.5 rounded bg-background/80 border border-border/60">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard/student/face-scan")}
          aria-label={L("สแกน", "Scan")}
          className="h-11 w-11 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-elevated hover:shadow-card-hover active:scale-95 transition-all shrink-0"
        >
          <ScanLine className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
