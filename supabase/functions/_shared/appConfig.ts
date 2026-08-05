// Central resolver for app-wide config. No literal fallbacks —
// value chain: Deno env → cms_settings → school_settings → throw.
// Every edge function must read origin/email through here so a
// single edit (env or CMS) propagates everywhere.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readCms(key: string): Promise<string | null> {
  try {
    const { data } = await admin()
      .from("cms_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data?.value as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function getPublicOrigin(): Promise<string> {
  const env = Deno.env.get("PUBLIC_ORIGIN") || Deno.env.get("APP_URL");
  if (env) return env.replace(/\/+$/, "");
  const cms = await readCms("public_origin");
  if (cms) return cms.replace(/\/+$/, "");
  // ไม่มี fallback ไปโดเมนของ Lovable — ต้องตั้ง PUBLIC_ORIGIN/APP_URL หรือ cms_settings.public_origin
  const site = await readCms("site_url");
  if (site) return site.replace(/\/+$/, "");
  throw new Error("PUBLIC_ORIGIN is not configured (env APP_URL/PUBLIC_ORIGIN or cms_settings.public_origin)");
}

export async function getAdminEmail(): Promise<string> {
  const env = Deno.env.get("ADMIN_EMAIL");
  if (env) return env;
  const cms = await readCms("admin_email");
  if (cms) return cms;
  throw new Error("ADMIN_EMAIL is not configured (env or cms_settings.admin_email)");
}

export async function getVapidSubject(): Promise<string> {
  const env = Deno.env.get("VAPID_SUBJECT");
  if (env) return env.startsWith("mailto:") || env.startsWith("http") ? env : `mailto:${env}`;
  const email = await getAdminEmail();
  return `mailto:${email}`;
}
