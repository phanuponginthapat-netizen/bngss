import { supabase } from "@/integrations/supabase/client";

export type PushRegistration = {
  endpoint: string;
  p256dh?: string;
  auth?: string;
  device_token?: string | null;
  provider?: "webpush" | "fcm";
  platform?: string | null;
};

type DbError = { code?: string; message?: string } | null | undefined;

function isMissingFunction(error: DbError): boolean {
  if (!error) return false;
  const msg = String(error.message || "");
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(msg);
}

/**
 * Save this device for the signed-in user. Uses the register_push_subscription function when the
 * school database has it; otherwise inserts and treats "already registered" as success, so a
 * missing UPDATE permission can never block re-registration (avoids RLS 42501 loops).
 */
export async function savePushRegistration(userId: string, reg: PushRegistration): Promise<{ error: DbError }> {
  const rpc = await (supabase as any).rpc("register_push_subscription", {
    _endpoint: reg.endpoint,
    _p256dh: reg.p256dh ?? "",
    _auth: reg.auth ?? "",
    _device_token: reg.device_token ?? null,
    _provider: reg.provider ?? "webpush",
    _platform: reg.platform ?? null,
  });
  if (!rpc?.error) return { error: null };
  if (!isMissingFunction(rpc.error)) return { error: rpc.error };

  const row: Record<string, unknown> = {
    user_id: userId,
    endpoint: reg.endpoint,
    p256dh: reg.p256dh ?? "",
    auth: reg.auth ?? "",
  };
  if (reg.device_token !== undefined) row.device_token = reg.device_token;
  if (reg.provider) row.provider = reg.provider;
  if (reg.platform !== undefined) row.platform = reg.platform;

  const { error } = await supabase.from("push_subscriptions").insert(row as any);
  if (!error || error.code === "23505") return { error: null };
  return { error };
}
