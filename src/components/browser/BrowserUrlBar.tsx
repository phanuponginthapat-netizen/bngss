import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openBrowserUrl } from "@/hooks/useBrowserShortcuts";

type Props = { placeholder?: string };

/**
 * URL bar สำหรับ นร พิมพ์ URL หรือคำค้น — ใช้ร่วม Agent + Browser page
 */
export default function BrowserUrlBar({ placeholder }: Props) {
  const [url, setUrl] = useState("");

  const submit = () => {
    if (!url.trim()) return;
    openBrowserUrl(url);
    setUrl("");
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-primary/30 bg-background focus-within:border-primary transition-colors p-2">
      <Search className="w-5 h-5 text-muted-foreground ml-2" />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder || "พิมพ์ URL หรือคำค้นหา แล้วกด Enter…"}
        className="flex-1 bg-transparent outline-none text-sm py-2"
      />
      <Button size="sm" onClick={submit} disabled={!url.trim()} className="gap-1">
        <ExternalLink className="w-4 h-4" /> เปิด
      </Button>
    </div>
  );
}
