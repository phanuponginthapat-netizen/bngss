import { supabase } from "@/integrations/supabase/client";
import { toThaiErrorDetailed, toThaiErrorDetailedSync, type ThaiErrorDetail } from "./errorMessage";
import { toast } from "sonner";


type Ctx = Record<string, unknown> | undefined;

let installed = false;

export async function logError(
  message: string,
  opts: { stack?: string; componentStack?: string; source?: string; context?: Ctx } = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const row: Record<string, unknown> = {
      source: opts.source ?? "client",
      message: (message ?? "unknown").slice(0, 2000),
    };
    if (user?.id) row.user_id = user.id;
    if (opts.stack) row.stack = opts.stack.slice(0, 5000);
    if (opts.componentStack) row.component_stack = opts.componentStack.slice(0, 5000);
    if (typeof window !== "undefined") row.url = window.location.href;
    if (typeof navigator !== "undefined") row.user_agent = navigator.userAgent;
    if (opts.context) row.context = opts.context as never;
    await supabase.from("error_logs").insert(row as never);
  } catch (e) {
    console.warn("logError failed", e);
  }
}

// Harmless / noisy browser errors we never want to persist to error_logs.
const NOISE_PATTERNS = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /play\(\) request was interrupted/i,
];

const isNoise = (msg: string | undefined | null) =>
  !!msg && NOISE_PATTERNS.some((p) => p.test(msg));

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // กันการเด้ง toast ซ้ำๆข้อความเดียวกันติดต่อกัน
  let lastMsg = "";
  let lastAt = 0;
  const showThaiToast = (d: ThaiErrorDetail) => {
    const now = Date.now();
    if (d.reason === lastMsg && now - lastAt < 3000) return;
    lastMsg = d.reason;
    lastAt = now;
    try {
      toast.error(d.reason, {
        description: `💡 ${d.hint}`,
        duration: 6000,
      });
    } catch {}
  };

  window.addEventListener("error", (e) => {
    if (isNoise(e.message)) return;
    logError(e.message || "window.error", {
      stack: e.error?.stack,
      source: "window.error",
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
    showThaiToast(toThaiErrorDetailedSync(e.error || e.message));
  });

  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    const msg = typeof r === "string" ? r : r?.message ?? "unhandledrejection";
    if (isNoise(msg)) return;
    logError(msg, {
      stack: r?.stack,
      source: "unhandledrejection",
    });
    // ดึง body จาก edge function response ถ้ามี → แสดง toast ไทย
    toThaiErrorDetailed(r).then(showThaiToast).catch(() => showThaiToast(toThaiErrorDetailedSync(r)));
  });
}


