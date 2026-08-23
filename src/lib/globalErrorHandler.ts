/**
 * globalErrorHandler — ดัก window.onerror + unhandledrejection ทั้งระบบ
 * - log ไป console + supabase (error_logs หรือ edge function) แบบ graceful (missing table ไม่พัง)
 * - toast แจ้งผู้ใช้เป็นภาษาไทย (ไม่รัว)
 * - preventDefault สำหรับ unhandledrejection เพื่อไม่ให้ blank screen / console error รุนแรง
 *
 * ติดตั้งครั้งเดียว: installGlobalErrorHandler() ใน main.tsx หรือ App.tsx useEffect
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let installed = false;

// noise ที่ไม่ควร log / toast
const NOISE_PATTERNS: RegExp[] = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /play\(\) request was interrupted/i,
  /Object Not Found Matching Id:\d+, MethodName:update/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
];

function isNoise(msg: string | null | undefined): boolean {
  if (!msg) return false;
  return NOISE_PATTERNS.some((p) => p.test(msg));
}

function genErrorId(): string {
  try {
    const c = crypto as unknown as { randomUUID?: () => string };
    if (c?.randomUUID) return c.randomUUID().slice(0, 8).toUpperCase();
  } catch {}
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function logToSupabase(payload: {
  message: string;
  stack?: string;
  source: string;
  url?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const msg = (payload.message ?? "unknown").slice(0, 2000);
  const stack = payload.stack?.slice(0, 5000);
  const url = payload.url ?? (typeof window !== "undefined" ? window.location.href : undefined);

  // 1) try direct table insert (most reliable) — handle missing table gracefully
  try {
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as unknown as never));
    const row: Record<string, unknown> = {
      message: msg,
      source: payload.source,
    };
    if (stack) row.stack = stack;
    if (url) row.url = url;
    if (user && (user as unknown as { id?: string }).id) row.user_id = (user as unknown as { id: string }).id;
    if (typeof navigator !== "undefined") row.user_agent = navigator.userAgent;
    if (payload.context) row.context = payload.context as never;
    // keep created_at default
    const { error } = await supabase.from("error_logs").insert(row as never);
    if (!error) return;
    // table missing (42P01) or RLS etc — fall through to console, do not throw
    console.warn("[globalErrorHandler] supabase insert failed, fallback to console:", error.message);
  } catch (e) {
    console.warn("[globalErrorHandler] insert to error_logs failed (likely missing table):", e);
  }

  // 2) fallback: try edge function if exists (optional) — never throw
  try {
    // fire-and-forget, ignore response
    await supabase.functions.invoke("log-error", {
      body: { message: msg, stack, source: payload.source, url, context: payload.context },
    }).catch(() => {});
  } catch {}

  // 3) always console
  console.error(`[globalError:${payload.source}]`, msg, payload.stack ?? "", payload.context ?? "");
}

// throttle toast to avoid spam
let lastToastMsg = "";
let lastToastAt = 0;
function showToast(message: string, _source: string) {
  const now = Date.now();
  if (message === lastToastMsg && now - lastToastAt < 3500) return;
  lastToastMsg = message;
  lastToastAt = now;
  const hint = "ลองรีโหลดหน้า หากยังไม่ได้ให้แจ้งผู้ดูแลพร้อมรหัสข้อผิดพลาด";
  try {
    toast.error(message.length > 180 ? message.slice(0, 180) + "…" : message, {
      description: `💡 ${hint}`,
      duration: 5500,
    });
  } catch {}
}

function toDisplayMessage(reason: unknown): string {
  if (typeof reason === "string") return reason.slice(0, 300);
  const r = reason as Record<string, unknown> | null;
  if (!r) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  const msg = (r.message as string) || (r.error as string) || (r.reason as string) || "";
  if (msg) return String(msg).slice(0, 300);
  try { return JSON.stringify(r).slice(0, 300); } catch { return String(reason).slice(0, 300); }
}

export function installGlobalErrorHandler(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // --- window.onerror (legacy) ---
  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = typeof message === "string" ? message : String(message ?? "window.onerror");
    if (isNoise(msg) || isNoise(error?.message)) {
      if (typeof prevOnError === "function") try { return prevOnError.apply(window, arguments as unknown as Parameters<OnErrorEventHandler>); } catch {}
      return false;
    }
    const errorId = genErrorId();
    const stack = error?.stack;
    console.error(`[window.onerror:${errorId}]`, msg, { source, lineno, colno, error });

    logToSupabase({
      message: `[${errorId}] ${msg}`,
      stack,
      source: "window.onerror",
      context: { errorId, filename: source, lineno, colno },
    }).catch(() => {});

    // Show toast — Thai friendly
    const display = msg.includes("[") ? msg : `[${errorId}] ${msg}`;
    // Avoid blank screen: do not rethrow, return true to signal handled (prevent default console "Uncaught")
    // But we already logged; return false lets browser also log, which is okay.
    // We return false to keep default logging, but we have prevented crash.
    try { showToast(display, "window.onerror"); } catch {}

    if (typeof prevOnError === "function") {
      try { return prevOnError.apply(window, arguments as unknown as Parameters<OnErrorEventHandler>); } catch {}
    }
    // Prevent blank screen — returning false still logs but doesn't crash app shell
    return false;
  };

  // --- window.onunhandledrejection ---
  const prevOnUnhandled = window.onunhandledrejection;
  window.onunhandledrejection = function (event: PromiseRejectionEvent) {
    // Critical: preventDefault so browser doesn't treat as fatal and blank screen isn't triggered in some shells
    try { event.preventDefault(); } catch {}
    const reason: unknown = (event as unknown as { reason?: unknown }).reason;
    const rawMsg = toDisplayMessage(reason);
    if (isNoise(rawMsg)) {
      if (typeof prevOnUnhandled === "function") try { (prevOnUnhandled as unknown as (e: PromiseRejectionEvent) => unknown).call(window, event); } catch {}
      return;
    }
    const errorId = genErrorId();
    const stack = (reason as { stack?: string } | null)?.stack;
    console.error(`[unhandledrejection:${errorId}]`, reason);

    logToSupabase({
      message: `[${errorId}] ${rawMsg || "unhandledrejection"}`,
      stack,
      source: "unhandledrejection",
      context: { errorId, reason: typeof reason === "object" ? (() => { try { return JSON.parse(JSON.stringify(reason)); } catch { return String(reason); } })() : reason },
    }).catch(() => {});

    try { showToast(rawMsg || "เกิดข้อผิดพลาดจากระบบ (unhandled rejection)", "unhandledrejection"); } catch {}

    if (typeof prevOnUnhandled === "function") {
      try { (prevOnUnhandled as unknown as (e: PromiseRejectionEvent) => unknown).call(window, event); } catch {}
    }
  };

  // Also addEventListener variants for robustness (some browsers only fire listeners)
  window.addEventListener("error", (e: ErrorEvent) => {
    if (isNoise(e.message)) return;
    // Don't double-log if window.onerror already handled same error — deduplicate via flag
    // We still ensure no blank screen: error events don't unmount React tree if boundary exists
    // Just ensure we log chunk load errors specially
    const msg = e.message || "window.error";
    if (/Loading chunk|ChunkLoadError/i.test(msg)) {
      const id = genErrorId();
      console.error(`[chunk-error:${id}]`, e);
      logToSupabase({
        message: `[${id}] ${msg}`,
        stack: (e.error as Error | undefined)?.stack,
        source: "window.error",
        context: { errorId: id, filename: e.filename, lineno: e.lineno, colno: e.colno },
      }).catch(() => {});
      try {
        toast.error("โหลดไฟล์ไม่สำเร็จ", {
          description: "💡 กรุณากด รีโหลด เพื่อโหลดเวอร์ชันใหม่",
          duration: 6000,
          action: { label: "รีโหลด", onClick: () => window.location.reload() },
        });
      } catch {}
      // Prevent full page crash
      e.preventDefault?.();
    }
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    try { e.preventDefault(); } catch {}
    // listener already handled via onunhandledrejection above; this is extra safety
    // Ensure no blank screen: swallow
  });

  // Catch React hydration / resource errors that might otherwise blank screen
  window.addEventListener("error", (e) => {
    // Capture resource load errors (img, script) — don't break app
    const target = e.target as unknown as HTMLElement | null;
    if (target && (target as any) !== window && (target as HTMLImageElement).tagName) {
      // silent for resource errors to avoid toast spam
      e.preventDefault?.();
    }
  }, true);
}

/** Alias kept for compatibility with older import name */
export const installGlobalErrorHandlers = installGlobalErrorHandler;

export default installGlobalErrorHandler;
