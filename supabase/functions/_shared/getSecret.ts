// Shared helper: read secret from DB first, fall back to env.
// Edge functions can import via: import { getSecret } from "../_shared/getSecret.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let cache: Record<string, { v: string | null; t: number }> = {};
const TTL_MS = 60_000;

export function invalidateSecretCache(key?: string) {
  if (key) delete cache[key];
  else cache = {};
}

export async function getSecret(key: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache[key];
  if (hit && now - hit.t < TTL_MS) return hit.v;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && srv) {
      const admin = createClient(url, srv);
      const { data, error } = await admin.rpc("get_app_secret", { _key: key });
      let value = typeof data === "string" ? data.trim() : "";

      // External installations may not yet have get_app_secret(), or may have
      // an older function definition. The service client can safely read the
      // private table directly, so values saved from the admin UI still win
      // over stale function environment variables.
      if (error || !value) {
        const { data: row } = await admin
          .from("app_secrets")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        value = typeof row?.value === "string" ? row.value.trim() : "";
      }

      if (value) {
        cache[key] = { v: value, t: now };
        return value;
      }
    }
  } catch (_) { /* ignore, fall through */ }

  const env = Deno.env.get(key) ?? null;
  cache[key] = { v: env, t: now };
  return env;
}
