import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PdpaConsentCardProps {
  acceptedAt?: string | null;
  version?: string | null;
  showLink?: boolean;
}

/**
 * Shared PDPA consent display.
 * Shows acceptance status, version, and date in a unified visual style.
 */
export const PdpaConsentCard = ({ acceptedAt, version, showLink = true }: PdpaConsentCardProps) => {
  const { lang } = useLanguage();

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-md">
        <ShieldCheck className="w-6 h-6 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {acceptedAt ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-success-soft text-success hover:bg-success-soft border-success/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {lang === "th" ? "ยอมรับแล้ว" : "Accepted"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {lang === "th" ? "เวอร์ชัน" : "Version"}{" "}
                <strong className="text-foreground">{version || "1.0"}</strong>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "th" ? "วันที่ยอมรับ" : "Accepted on"}:{" "}
              <strong className="text-foreground">
                {new Date(acceptedAt).toLocaleString(lang === "th" ? "th-TH" : "en-GB", {
                  dateStyle: "long",
                  timeStyle: "short",
                  hour12: false,
                })}
              </strong>
            </p>
          </>
        ) : (
          <>
            <Badge variant="outline" className="border-warning/30 text-warning">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {lang === "th" ? "ยังไม่ยอมรับ" : "Not accepted"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "th"
                ? "ระบบจะแสดงให้ยอมรับเมื่อเข้าสู่ระบบครั้งถัดไป"
                : "You'll be prompted to accept on your next login."}
            </p>
          </>
        )}
      </div>
      {showLink && (
        <a
          href="/pdpa"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
        >
          {lang === "th" ? "อ่านข้อตกลง" : "Read agreement"}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
};

export default PdpaConsentCard;