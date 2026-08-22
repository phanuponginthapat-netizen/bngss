import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeadersPost, preflight } from "../_shared/cors.ts";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Uint8Array): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    encoded += BASE32_CHARS[parseInt(chunk, 2)];
  }
  return encoded;
}

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

async function generateTotp(secret: string, timeStep = 30): Promise<string> {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const counterBytes = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) { counterBytes[i] = tmp & 0xff; tmp = Math.floor(tmp / 256); }
  const hash = await hmacSha1(base32Decode(secret), counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;
  const code = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function generateSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(corsHeadersPost);

  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = (await import("https://esm.sh/@supabase/supabase-js@2.49.1")).createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as "generate" | "verify" | "disable";
    const admin = makeAdmin();

    if (action === "generate") {
      const secret = generateSecret();
      const issuer = "SchoolSystem";
      const account = user.email ?? user.id;
      const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

      await admin.from("mfa_settings").upsert({
        user_id: user.id,
        totp_secret: secret,
        enabled: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ secret, otpauth }), {
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { code } = body;
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "code required" }), {
          status: 400,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const { data: row } = await admin.from("mfa_settings").select("totp_secret").eq("user_id", user.id).single();
      if (!row?.totp_secret) {
        return new Response(JSON.stringify({ error: "No secret. Run generate first." }), {
          status: 400,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      // Check current and previous window (±30s)
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
          const backupCodes = generateBackupCodes();
          const hashed = await Promise.all(backupCodes.map(sha256Hex));
          await admin.from("mfa_settings").upsert({
            user_id: user.id,
            totp_secret: row.totp_secret,
            backup_codes: hashed,
            enabled: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          return new Response(JSON.stringify({ valid: true, backup_codes: backupCodes }), {
            headers: { ...corsHeadersPost, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ valid: false, error: "Invalid code" }), {
        status: 400,
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    if (action === "disable") {
      await admin.from("mfa_settings").upsert({
        user_id: user.id,
        totp_secret: null,
        backup_codes: null,
        enabled: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ disabled: true }), {
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
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
