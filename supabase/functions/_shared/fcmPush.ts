// FCM (Firebase Cloud Messaging) sender for the Android APK via the HTTP v1 API.
// Requires the secret FCM_SERVICE_ACCOUNT_JSON = Firebase service-account key JSON:
//   { "project_id", "client_email", "private_key", ... }
// When the secret is missing, sendFcm() returns { ok:false, skipped:true } so
// existing Web Push flows keep working untouched.
import { getSecret } from "./getSecret.ts";

const SCOPES = "https://www.googleapis.com/auth/firebase.messaging";

export type FcmPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export type FcmResult = {
  ok: boolean;
  skipped?: boolean;
  gone?: boolean;
  status?: number;
  error?: string;
};

let accessTokenPromise: Promise<string | null> | null = null;

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signJwt(privateKeyPem: string, headerB64: string, payloadB64: string): Promise<string> {
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  return `${headerB64}.${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

async function getAccessToken(): Promise<string | null> {
  if (accessTokenPromise) return accessTokenPromise;
  accessTokenPromise = (async () => {
    try {
      const raw = await getSecret("FCM_SERVICE_ACCOUNT_JSON");
      if (!raw) return null;
      const sa = JSON.parse(raw);
      const now = Math.floor(Date.now() / 1000);
      const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
      const payload = b64url(
        JSON.stringify({
          iss: sa.client_email,
          scope: SCOPES,
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        }),
      );
      const jwt = await signJwt(sa.private_key, header, payload);
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      });
      if (!res.ok) throw new Error(`OAuth token failed: ${res.status}`);
      const j = await res.json();
      return j.access_token as string;
    } catch (e: any) {
      console.error("FCM access token error", e?.message || e);
      return null;
    }
  })();
  return accessTokenPromise;
}

export async function sendFcm(token: string, payload: FcmPayload): Promise<FcmResult> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { ok: false, skipped: true, error: "FCM_SERVICE_ACCOUNT_JSON not configured" };
    }
    const raw = await getSecret("FCM_SERVICE_ACCOUNT_JSON");
    const projectId = JSON.parse(raw!).project_id;
    const msg = {
      message: {
        token,
        notification: { title: payload.title, body: payload.body ?? "" },
        android: {
          priority: "high",
          notification: { channel_id: "default", sound: "default", visibility: "PUBLIC", notification_priority: "PRIORITY_MAX", default_sound: true, default_vibrate_timings: true },
        },
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
        data: { url: payload.url ?? "/dashboard", tag: payload.tag ?? "general" },
      },
    };
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    if (!res.ok) {
      const txt = await res.text();
      const gone =
        res.status === 404 ||
        (res.status === 400 && txt.includes("UNREGISTERED")) ||
        (res.status === 400 && txt.includes("NOT_FOUND"));
      return { ok: false, status: res.status, error: txt.slice(0, 300), gone };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 300) };
  }
}