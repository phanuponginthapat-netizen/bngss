// Signed OAuth state (HMAC) — ไม่พึ่ง Lovable
const enc = new TextEncoder();

function secret(): string {
  return Deno.env.get("CRON_SECRET")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_JWT_SECRET")
    ?? "bng-oauth-state";
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload))));
}

export interface StatePayload {
  u: string; // user id
  r: string; // return url
  e: number; // expires at (ms)
}

export async function signState(data: StatePayload): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(data)));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyState(state: string): Promise<StatePayload | null> {
  const [payload, sig] = (state || "").split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as StatePayload;
    if (!data?.u || !data?.e || data.e < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
