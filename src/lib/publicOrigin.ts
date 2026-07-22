// Frontend resolver for the app's public/production origin.
// Order: CMS `public_origin` → window.location.origin (only when it looks
// like a real prod URL, not preview/localhost) → null. No literal fallback.
// Consumers should await getPublicOrigin() and handle null with a UI hint
// asking admin to set CMS → public_origin.

import { supabase } from "@/integrations/supabase/client";

function looksLikeProd(o: string): boolean {
  return !(
    o.includes("id-preview--") ||
    o.includes("lovableproject.com") ||
    o.includes("lovable.dev") ||
    o.includes("localhost") ||
    o.includes("127.0.0.1")
  );
}

let cache: { at: number; value: string | null } | null = null;

export async function getPublicOrigin(): Promise<string | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  let value: string | null = null;
  try {
    const { data } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("key", "public_origin")
      .maybeSingle();
    const cms = (data?.value as string | undefined)?.replace(/\/+$/, "") || null;
    if (cms) value = cms;
  } catch {}
  if (!value && typeof window !== "undefined" && looksLikeProd(window.location.origin)) {
    value = window.location.origin;
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Sync best-effort — returns window.origin if prod-looking, else null. Use only for defaults. */
export function guessPublicOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return looksLikeProd(window.location.origin) ? window.location.origin : null;
}
