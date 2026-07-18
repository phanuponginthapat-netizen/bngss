import { supabase } from "@/integrations/supabase/client";
import { toThaiError, toThaiErrorSync } from "./errorMessage";
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
  window.addEventListener("error", (e) => {
    if (isNoise(e.message)) return;
    logError(e.message || "window.error", {
      stack: e.error?.stack,
      source: "window.error",
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    const msg = typeof r === "string" ? r : r?.message ?? "unhandledrejection";
    if (isNoise(msg)) return;
    logError(msg, {
      stack: r?.stack,
      source: "unhandledrejection",
    });
  });
}

