// Facebook-style live notification.
// - Rich sonner toast (slide-in, icon, click-through, dismiss)
// - Native OS Notification when tab is hidden (works in browser + installed PWA)
// - Plays a short 2-tone "ding"
// - Updates the app badge on installed PWAs
import { toast } from "sonner";
import { createElement } from "react";
import { playNotificationSound } from "@/lib/notificationSound";
import { haptic } from "@/lib/haptics";
import { markNotificationSeen, wasNotificationSeen } from "@/lib/notificationDedup";

export type LiveNotifyOpts = {
  title: string;
  body?: string;
  route?: string | null;
  urgent?: boolean;
  icon?: string;      // emoji or short symbol
  image?: string;     // avatar/thumb url
  tag?: string;       // dedup key for OS notification
  onNavigate?: (route: string) => void;
};

const SILENCE_KEY = "notif_toast_off";

function isSilenced(): boolean {
  try { return localStorage.getItem(SILENCE_KEY) === "1"; } catch { return false; }
}

/** Try to show a native OS notification. Returns true if shown. */
async function tryNativeNotification(opts: LiveNotifyOpts): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    // Prefer Service Worker showNotification (required on Android/iOS PWA + more reliable).
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const payload: NotificationOptions = {
      body: opts.body,
      icon: opts.image || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: opts.tag || opts.title,
      data: { url: opts.route || "/dashboard/inbox" },
      requireInteraction: !!opts.urgent,
    } as NotificationOptions;
    if (reg && "showNotification" in reg) {
      await reg.showNotification(opts.title, payload);
      return true;
    }
    // Fallback: page-level Notification (desktop browsers).
    const n = new Notification(opts.title, payload);
    n.onclick = () => {
      window.focus();
      if (opts.route) {
        if (opts.onNavigate) opts.onNavigate(opts.route);
        else window.location.href = opts.route;
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Update PWA app-icon badge (best-effort). */
export function setAppBadge(count: number) {
  try {
    const nav = navigator as any;
    if (count > 0 && nav.setAppBadge) nav.setAppBadge(count).catch(() => {});
    else if (nav.clearAppBadge) nav.clearAppBadge().catch(() => {});
  } catch {}
}

/** Reflect unread count in the tab title, e.g. "(3) Original Title". */
export function setTitleBadge(count: number) {
  if (typeof document === "undefined") return;
  const base = document.title.replace(/^\(\d+\)\s*/, "");
  document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
}

/** Show a Facebook-style live notification. */
export function showLiveNotification(opts: LiveNotifyOpts) {
  // Sound + haptic
  playNotificationSound({ urgent: opts.urgent });
  haptic(opts.urgent ? "warning" : "light");

  // Native notification when hidden (or PWA in background)
  const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";
  if (hidden) {
    void tryNativeNotification(opts);
    return;
  }

  if (isSilenced()) return;

  const route = opts.route ?? null;
  const duration = opts.urgent ? 10000 : 6000;
  const initials = (opts.icon || "🔔").slice(0, 2);

  toast.custom(
    (id) =>
      createElement(
        "div",
        {
          role: "button",
          tabIndex: 0,
          onClick: () => {
            toast.dismiss(id);
            if (route) {
              if (opts.onNavigate) opts.onNavigate(route);
              else window.location.href = route;
            }
          },
          onKeyDown: (e: any) => {
            if (e.key === "Enter" || e.key === " ") {
              toast.dismiss(id);
              if (route && opts.onNavigate) opts.onNavigate(route);
            }
          },
          className: `group cursor-pointer select-none flex items-start gap-3 rounded-xl border shadow-elevated backdrop-blur-md bg-background/95 p-3 pr-9 w-[min(380px,calc(100vw-1.5rem))] hover:bg-muted/60 transition-all animate-slide-in-right relative ${
            opts.urgent ? "border-destructive/50 ring-1 ring-destructive/20" : "border-border"
          }`,
        },
        // Avatar / icon bubble
        createElement(
          "div",
          {
            className: `flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold overflow-hidden ${
              opts.urgent ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
            }`,
          },
          opts.image
            ? createElement("img", {
                src: opts.image,
                alt: "",
                className: "w-full h-full object-cover",
                loading: "lazy",
              })
            : initials
        ),
        // Text
        createElement(
          "div",
          { className: "flex-1 min-w-0" },
          createElement(
            "div",
            { className: "text-sm font-semibold leading-tight line-clamp-2" },
            opts.title
          ),
          opts.body
            ? createElement(
                "div",
                { className: "text-xs text-muted-foreground mt-0.5 line-clamp-2" },
                opts.body
              )
            : null,
          createElement(
            "div",
            { className: "text-[10px] text-muted-foreground/70 mt-1" },
            new Date().toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })
          )
        ),
        // Close button
        createElement(
          "button",
          {
            type: "button",
            "aria-label": "Close",
            onClick: (e: any) => {
              e.stopPropagation();
              toast.dismiss(id);
            },
            className:
              "absolute top-1.5 right-1.5 w-6 h-6 inline-flex items-center justify-center rounded-md text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted",
          },
          "×"
        )
      ),
    { duration, dismissible: true }
  );
}

export function setNotificationSilenced(silent: boolean) {
  try {
    if (silent) localStorage.setItem(SILENCE_KEY, "1");
    else localStorage.removeItem(SILENCE_KEY);
  } catch {}
}
