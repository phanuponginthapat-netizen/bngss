import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Bell, X } from "lucide-react";
import { routeForNotification } from "@/lib/notificationRoute";
import { playNotificationSound } from "@/lib/notificationSound";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  raw: any;
  leaving?: boolean;
};

const AUTO_DISMISS_MS = 6000;
const MAX_TOASTS = 4;

/**
 * Facebook-style notification popups — fixed bottom-left, slide in, auto-fade.
 * Listens to realtime INSERTs on `notifications` for the current user.
 */
export default function NotificationToastListener() {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((arr) => arr.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((arr) => arr.filter((t) => t.id !== id)), 250);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-toast-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n: any = payload.new;
          if (!n || n.is_read) return;
          const toast: Toast = {
            id: n.id,
            title: n.title || "การแจ้งเตือนใหม่",
            message: n.message ?? null,
            type: n.type || "notification",
            raw: n,
          };
          setToasts((arr) => [toast, ...arr].slice(0, MAX_TOASTS));
          try { playNotificationSound(); } catch { /* ignore */ }
          setTimeout(() => dismiss(n.id), AUTO_DISMISS_MS);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, dismiss]);

  const handleClick = (t: Toast) => {
    dismiss(t.id);
    const route = routeForNotification(t.raw) || "/dashboard/inbox";
    navigate(route);
  };


  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[60] flex flex-col-reverse gap-2 pointer-events-none"
      style={{
        left: "max(env(safe-area-inset-left), 0.75rem)",
        bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => handleClick(t)}
          className={cn(
            "pointer-events-auto group relative w-[min(22rem,calc(100vw-1.5rem))] text-left",
            "bg-card/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl",
            "px-3 py-2.5 flex items-start gap-3 hover:bg-accent/40 transition-all",
            t.leaving ? "opacity-0 -translate-x-4" : "animate-fade-in-up"
          )}
          style={{ transition: "opacity 250ms, transform 250ms" }}
        >
          <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{t.title}</div>
            {t.message && (
              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.message}</div>
            )}
          </div>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 -m-1 rounded"
            aria-label="ปิด"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        </button>
      ))}
    </div>
  );
}
