import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeadersPost, preflight } from "../_shared/cors.ts";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(secret: string): Uint8Array {
  const clean = secret.replace(/[^A-Z2-7]/gi, "").toUpperCase();
  let bits = "";
  for (const c of clean) bits += BASE32_CHARS.indexOf(c).toString(2).padStart(5, "0");
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return new Uint8Array(sig);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(corsHeadersPost);

  try {
    const { user_id, code } = await req.json();
    if (!user_id || !code) {
      return new Response(JSON.stringify({ error: "user_id and code required" }), {
        status: 400,
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    const admin = makeAdmin();
    const { data: row } = await admin.from("mfa_settings").select("*").eq("user_id", user_id).single();

    // Not enrolled or not enabled → skip MFA
    if (!row || !row.enabled || !row.totp_secret) {
      return new Response(JSON.stringify({ valid: true, reason: "mfa_not_enabled" }), {
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    // Try TOTP
    const now = Math.floor(Date.now() / 1000);
    for (const offset of [-1, 0, 1]) {
      const counter = Math.floor((now + offset * 30) / 30);
      const counterBytes = new Uint8Array(8);
      let tmp = counter;
      for (let i = 7; i >= 0; i--) { counterBytes[i] = tmp & 0xff; tmp = Math.floor(tmp / 256); }
      const hash = await hmacSha1(base32Decode(row.totp_secret), counterBytes);
      const off = hash[hash.length - 1] & 0x0f;
      const val = ((hash[off] & 0x7f) << 24) | ((hash[off + 1] & 0xff) << 16) | ((hash[off + 2] & 0xff) << 8) | (hash[off + 3] & 0xff);
      const expected = String(val % 1_000_000).padStart(6, "0");
      if (code === expected) {
        return new Response(JSON.stringify({ valid: true, method: "totp" }), {
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }
    }

    // Try backup codes
    if (row.backup_codes && row.backup_codes.length > 0) {
      const inputHash = await sha256Hex(code);
      const idx = row.backup_codes.indexOf(inputHash);
      if (idx !== -1) {
        const remaining = [...row.backup_codes];
        remaining.splice(idx, 1);
        await admin.from("mfa_settings").update({ backup_codes: remaining, updated_at: new Date().toISOString() }).eq("user_id", user_id);
        return new Response(JSON.stringify({ valid: true, method: "backup_code", remaining: remaining.length }), {
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ valid: false, error: "Invalid code" }), {
      status: 400,
      headers: { ...corsHeadersPost, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeadersPost, "Content-Type": "application/json" },
    });
  }
});
