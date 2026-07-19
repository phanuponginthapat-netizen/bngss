/**
 * Read-only mode guard for Observer accounts (ศน. / ศึกษานิเทศก์).
 *
 * Intercepts window.fetch and blocks all mutating HTTP requests
 * (POST/PUT/PATCH/DELETE) that target the Lovable Cloud backend:
 *   - /rest/v1/*        (PostgREST writes)
 *   - /storage/v1/object/* (file uploads / deletes)
 *   - /functions/v1/*   (edge functions — may mutate)
 *
 * GET/HEAD requests always pass through so observers can browse freely.
 * PostgREST RPC via POST is also blocked (RPC often writes).
 *
 * Enable/disable via setReadOnly(true|false). The state is stored on
 * window so it survives HMR and can be inspected from devtools.
 */
import { swal } from "@/lib/swal";

const FLAG = "__LOVABLE_READ_ONLY__";
declare global {
  interface Window {
    __LOVABLE_READ_ONLY__?: boolean;
    __LOVABLE_READ_ONLY_INSTALLED__?: boolean;
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SUPABASE_PATH_RE = /\/(rest|storage|functions)\/v1\//;

let lastNotifiedAt = 0;
function notifyBlocked(url: string, method: string) {
  const now = Date.now();
  if (now - lastNotifiedAt < 1500) return; // throttle
  lastNotifiedAt = now;
  try {
    swal.error(
      "โหมดผู้สังเกตการณ์ (อ่านอย่างเดียว)",
      `บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลในระบบ\n(${method} ${new URL(url).pathname})`
    );
  } catch {
    // swal may not be ready during early boot
    console.warn("[read-only] blocked", method, url);
  }
}

export function setReadOnly(on: boolean) {
  if (typeof window === "undefined") return;
  window[FLAG] = !!on;
  if (on) installOnce();
}

export function isReadOnly(): boolean {
  return typeof window !== "undefined" && !!window[FLAG];
}

function installOnce() {
  if (typeof window === "undefined") return;
  if (window.__LOVABLE_READ_ONLY_INSTALLED__) return;
  window.__LOVABLE_READ_ONLY_INSTALLED__ = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (!window[FLAG]) return origFetch(input, init);

      const method = (
        init?.method ||
        (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (!MUTATING.has(method)) return origFetch(input, init);

      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (SUPABASE_PATH_RE.test(url)) {
        notifyBlocked(url, method);
        return new Response(
          JSON.stringify({
            error: "read_only_mode",
            message: "โหมดผู้สังเกตการณ์: ไม่อนุญาตให้แก้ไขข้อมูล",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      console.warn("[read-only] guard error", e);
    }
    return origFetch(input, init);
  };
}
