import { supabase } from "@/integrations/supabase/client";
import { getBackendConfig } from "@/lib/runtimeConfig";

export type HealthStatus = {
  db: boolean;
  storage: boolean;
  functions: number;
  ok: boolean;
  error?: string;
  timestamp?: string;
};

/**
 * Call setup-health-check edge function and log result to console.
 * Handles missing tables gracefully — logs warning instead of throwing.
 */
export async function reportHealth(): Promise<HealthStatus | null> {
  try {
    // Try via supabase functions.invoke first (uses runtime config)
    const { data, error } = await supabase.functions.invoke("setup-health-check", {
      method: "GET",
    } as any);

    if (error) {
      // Fallback to direct fetch via backend URL
      const cfg = getBackendConfig();
      const url = `${cfg.url}/functions/v1/setup-health-check`;
      const resp = await fetch(url, {
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
        },
      });
      const json = await resp.json().catch(() => ({}));
      const result: HealthStatus = {
        db: !!json.db,
        storage: !!json.storage,
        functions: Number(json.functions ?? 0),
        ok: !!json.ok,
        timestamp: json.timestamp,
        error: json.error,
      };
      if (!resp.ok) {
        console.warn("[monitoring] health check failed:", result);
      } else {
        console.log("[monitoring] health:", result);
      }
      return result;
    }

    const result: HealthStatus = {
      db: !!(data as any)?.db,
      storage: !!(data as any)?.storage,
      functions: Number((data as any)?.functions ?? 0),
      ok: !!(data as any)?.ok,
      timestamp: (data as any)?.timestamp,
      error: (data as any)?.error,
    };
    console.log("[monitoring] health:", result);
    if (!result.ok) {
      console.warn("[monitoring] health not ok:", result);
    }
    return result;
  } catch (e) {
    const msg = (e as Error).message;
    console.warn("[monitoring] reportHealth error (graceful):", msg);
    return { db: false, storage: false, functions: 0, ok: false, error: msg };
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start pinging setup-health-check every 5 minutes.
 * Returns a cleanup function to stop the interval.
 * Handles missing tables gracefully — logs and continues.
 */
export function setupHeartbeat(): () => void {
  // immediate check (fire-and-forget)
  reportHealth().catch(() => {});

  // clear any existing timer
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer as any);
  }

  // use globalThis to work in both browser and node/test
  const intervalFn = typeof window !== "undefined" ? window.setInterval.bind(window) : setInterval;
  heartbeatTimer = intervalFn(() => {
    reportHealth().catch(() => {});
  }, 5 * 60 * 1000) as any;

  // cleanup
  return () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer as any);
      heartbeatTimer = null;
    }
  };
}

/**
 * Stop heartbeat if running — useful for tests or logout.
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer as any);
    heartbeatTimer = null;
  }
}
