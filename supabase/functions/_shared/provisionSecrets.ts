// Auto-provisions secrets that the app can generate itself (CRON_SECRET, VAPID pair).
// Called lazily by getSecret() / webPush.ts so a freshly-remixed project just works
// without the operator having to paste anything into the Secrets UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !srv) return null;
  return createClient(url, srv);
}

async function persist(key: string, value: string, category: string, description: string) {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.rpc("set_app_secret", { _key: key, _value: value, _category: category, _description: description });
  } catch (_) { /* fire and forget */ }
}

function randomHex(len = 32): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

export async function generateCronSecret(): Promise<string> {
  const v = randomHex(32); // 64 hex chars
  await persist("CRON_SECRET", v, "auto", "Auto-generated on first use for cron authentication");
  return v;
}

export async function generateVapidPair(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error("Failed to export VAPID JWK");

  const xBytes = Uint8Array.from(atob(jwk.x.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - jwk.x.length % 4) % 4)), (c) => c.charCodeAt(0));
  const yBytes = Uint8Array.from(atob(jwk.y.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - jwk.y.length % 4) % 4)), (c) => c.charCodeAt(0));
  const dBytes = Uint8Array.from(atob(jwk.d.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - jwk.d.length % 4) % 4)), (c) => c.charCodeAt(0));

  const pub = new Uint8Array(65);
  pub[0] = 0x04;
  pub.set(xBytes, 1);
  pub.set(yBytes, 33);
  const publicKey = b64url(pub);
  const privateKey = b64url(dBytes);

  await persist("VAPID_PUBLIC_KEY", publicKey, "auto", "Auto-generated Web Push VAPID public key");
  await persist("VAPID_PRIVATE_KEY", privateKey, "auto", "Auto-generated Web Push VAPID private key");
  return { publicKey, privateKey };
}

/** คีย์สำหรับ WizMind / CCTV bridge — สร้างเองอัตโนมัติเมื่อยังไม่มี */
export async function generateWizmindBridgeKey(): Promise<string> {
  const v = randomHex(24); // 48 hex chars
  await persist("WIZMIND_BRIDGE_KEY", v, "auto", "Auto-generated key for WizMind/CCTV face-event bridge");
  return v;
}
