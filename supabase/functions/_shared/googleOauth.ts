// Native Google OAuth helpers — ไม่พึ่ง Lovable connector gateway
// รองรับ 2 โหมด
//  1) Service Account  : GOOGLE_SERVICE_ACCOUNT_JSON  (งานระบบ เช่น LINE Vault, backup)
//  2) OAuth Client     : GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
//                        + GOOGLE_DRIVE_REFRESH_TOKEN (งานระบบ) หรือ refresh token รายผู้ใช้
import { getSecret } from "./getSecret.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive",
];

async function env(key: string): Promise<string | null> {
  return (await getSecret(key)) || Deno.env.get(key) || null;
}

export async function getOAuthClient(): Promise<{ id: string; secret: string } | null> {
  const id = (await env("GOOGLE_OAUTH_CLIENT_ID")) || (await env("GOOGLE_CLIENT_ID"));
  const secret = (await env("GOOGLE_OAUTH_CLIENT_SECRET")) || (await env("GOOGLE_CLIENT_SECRET"));
  if (!id || !secret) return null;
  return { id, secret };
}

export async function hasNativeGoogleOAuth(): Promise<boolean> {
  return Boolean(await getOAuthClient());
}

/** สร้าง URL ให้ผู้ใช้กด consent (per-user OAuth) */
export async function buildAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  scopes?: string[];
  loginHint?: string;
}): Promise<string> {
  const client = await getOAuthClient();
  if (!client) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set("client_id", client.id);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", (opts.scopes ?? DRIVE_SCOPES).join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", opts.state);
  if (opts.loginHint) u.searchParams.set("login_hint", opts.loginHint);
  return u.toString();
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const client = await getOAuthClient();
  if (!client) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.id,
      client_secret: client.secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`google token exchange failed [${res.status}]: ${text.slice(0, 300)}`);
  return JSON.parse(text) as GoogleTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const client = await getOAuthClient();
  if (!client) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: client.id,
      client_secret: client.secret,
      grant_type: "refresh_token",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`google token refresh failed [${res.status}]: ${text.slice(0, 300)}`);
  return JSON.parse(text) as GoogleTokens;
}

/** ดึงโปรไฟล์ผู้ใช้ Google จาก access token */
export async function fetchGoogleUserInfo(accessToken: string) {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return await r.json() as { sub?: string; email?: string; name?: string };
}

// ---------- Service Account (JWT bearer) ----------

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let saCache: { token: string; exp: number } | null = null;

export async function getServiceAccountToken(scopes = ["https://www.googleapis.com/auth/drive"]): Promise<string | null> {
  const raw = await env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  if (saCache && saCache.exp > Date.now() + 60_000) return saCache.token;

  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing client_email/private_key");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const subject = (await env("GOOGLE_IMPERSONATE_USER")) || undefined; // domain-wide delegation (optional)
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
    ...(subject ? { sub: subject } : {}),
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  const assertion = `${header}.${payload}.${b64url(sig)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`service account token failed [${res.status}]: ${text.slice(0, 300)}`);
  const data = JSON.parse(text) as GoogleTokens;
  saCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

let sysCache: { token: string; exp: number } | null = null;

/** Access token สำหรับงานระบบ (service account ก่อน แล้วค่อย refresh token กลาง) */
export async function getSystemDriveToken(): Promise<string | null> {
  if (sysCache && sysCache.exp > Date.now() + 60_000) return sysCache.token;
  const sa = await getServiceAccountToken();
  if (sa) return sa;
  const refresh = (await env("GOOGLE_DRIVE_REFRESH_TOKEN")) || (await env("GOOGLE_REFRESH_TOKEN"));
  if (!refresh) return null;
  const t = await refreshAccessToken(refresh);
  sysCache = { token: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000 };
  return t.access_token;
}

export async function hasNativeSystemDrive(): Promise<boolean> {
  try {
    return Boolean(await getSystemDriveToken());
  } catch {
    return false;
  }
}
