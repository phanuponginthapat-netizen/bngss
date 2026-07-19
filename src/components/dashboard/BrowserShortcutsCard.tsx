import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import BrowserShortcutsGrid from "@/components/browser/BrowserShortcutsGrid";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * การ์ดทางลัดเว็บสำหรับหน้า Dashboard ทุก role
 * ข้อมูลดึงจาก browser_shortcuts (admin จัดการที่เดียว)
 */
export default function BrowserShortcutsCard() {
  const { lang } = useLanguage();
  return (
    <Card className="shadow-elevated rounded-2xl">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="w-4 h-4 text-primary" />
          {lang === "th" ? "ทางลัดเว็บ" : "Web Shortcuts"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
        <BrowserShortcutsGrid />
      </CardContent>
    </Card>
  );
}
