import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type BackNavState = {
  backTo?: string;
};

interface BackButtonProps {
  className?: string;
  fallback?: string;
  label?: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "icon";
}

/**
 * Reusable Back button. Uses browser history when available,
 * otherwise navigates to the provided `fallback` route (default: /dashboard).
 */
const BackButton = ({
  className,
  fallback,
  label,
  variant = "ghost",
  size = "sm",
}: BackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLanguage();
  const routeState = (location.state as BackNavState | null) ?? null;

  const text = label ?? (lang === "th" ? "ย้อนกลับ" : "Back");

  // Smart fallback: parent path of current route
  // e.g. /dashboard/exam/new -> /dashboard/exam, /dashboard/exam/123/scan -> /dashboard/exam/123
  const smartFallback = (() => {
    if (fallback) return fallback;
    const segs = location.pathname.split("/").filter(Boolean);
    if (segs.length <= 1) return "/dashboard";
    segs.pop();
    return "/" + segs.join("/");
  })();

  const handleClick = () => {
    // 1) ถ้ามี backTo ระบุชัดเจน ใช้เลย (สำคัญที่สุด)
    if (routeState?.backTo) {
      navigate(routeState.backTo, { replace: true });
      return;
    }

    // 2) ถ้ามี SPA history จริง (ไม่ใช่ entry แรกที่ผู้ใช้เปิดตรง) ให้ย้อน history
    //    location.key === "default" = tab เพิ่งเปิดตรง URL นี้ ไม่มี history ภายใน
    //    อาศัย location.key อย่างเดียวเพราะ document.referrer ไม่รีเฟรชใน SPA
    if (location.key !== "default") {
      navigate(-1);
      return;
    }

    // 3) เปิดตรง (deep link / refresh) — ใช้ smart fallback
    navigate(smartFallback, { replace: true });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn("gap-1.5", className)}
      aria-label={text}
    >
      <ArrowLeft className="w-4 h-4" />
      {size !== "icon" && <span>{text}</span>}
    </Button>
  );
};

export default BackButton;