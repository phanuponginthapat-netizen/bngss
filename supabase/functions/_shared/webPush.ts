// Shared Web Push sender using RFC 8291 (aes128gcm) via @negrel/webpush.
// Replaces the previous hand-rolled VAPID flow that sent unencrypted payloads
// (which push services silently dropped, so notifications never showed up).
import * as webpush from "jsr:@negrel/webpush@^0.5.0";
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";

const DEFAULT_WEB_PUSH_PUBLIC_KEY =
  "BBMeUAOraQHGtdw31hIdhUwVLAQoy6Rzu2o6eTbhYByjG_6t6gwNSLzlp-T2ZWhl9arfDzQcNtQu6mJt3jUrxyI";

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const raw = atob(b64 + "=".repeat(pad));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function bytesToB64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function rawVapidToJwk(publicKeyB64u: string, privateKeyB64u: string) {
  const pub = b64urlToBytes(publicKeyB64u);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("Invalid VAPID public key");
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  const d = bytesToB64url(b64urlToBytes(privateKeyB64u));
  const publicKey: JsonWebKey = { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: [] };
  const privateKey: JsonWebKey = { kty: "EC", crv: "P-256", x, y, d, ext: true, key_ops: ["sign"] };
  return { publicKey, privateKey };
}

let appServerPromise: Promise<webpush.ApplicationServer> | null = null;

export async function getVapidPublicKey() {
  return (await getSecret(secretKeys.vapidPublic)) || DEFAULT_WEB_PUSH_PUBLIC_KEY;
}

export async function getAppServer(): Promise<webpush.ApplicationServer> {
  if (!appServerPromise) {
    const vapidPublicKey = await getVapidPublicKey();
    const priv = await getSecret(secretKeys.vapidPrivate);
    if (!priv) throw new Error("Web-push private key is not configured");
    appServerPromise = (async () => {
      const { publicKey, privateKey } = rawVapidToJwk(vapidPublicKey, priv);
      // Sanity-check: sign+verify a probe to detect keypair mismatch early
      try {
        const pubCheck = await crypto.subtle.importKey("jwk", { ...publicKey, key_ops: ["verify"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
        const privCheck = await crypto.subtle.importKey("jwk", privateKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
        const probe = new TextEncoder().encode("vapid-keypair-check");
        const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privCheck, probe);
        const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pubCheck, sig, probe);
        if (!ok) throw new Error("VAPID public/private keypair does not match. Set VAPID public key to the matching value, or regenerate keys.");
      } catch (e: any) {
        if (/does not match/.test(e?.message || "")) throw e;
        // importKey failures still bubble up below with the real error
      }
      const vapidKeys = await webpush.importVapidKeys({ publicKey, privateKey }, { extractable: false });
      return await webpush.ApplicationServer.new({
        contactInformation: "mailto:admin@school.com",
        vapidKeys,
      });
    })();
  }
  return appServerPromise;
}

export type StoredSub = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body?: string; url?: string; tag?: string; urgent?: boolean };

export type PushResult = { ok: boolean; gone: boolean; status?: number; error?: string };

// Web-push Topic header: must be URL-safe base64, ≤32 chars. Used by push services
// (FCM/APNs/Mozilla) to collapse duplicate pending messages — new push with same topic
// replaces the older undelivered one, like LINE/Messenger collapsing repeated alerts.
function toTopicHeader(tag?: string): string | undefined {
  if (!tag) return undefined;
  const cleaned = tag.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32);
  return cleaned || undefined;
}

export async function pushOne(sub: StoredSub, payload: PushPayload): Promise<PushResult> {
  try {
    const appServer = await getAppServer();
    const subscriber = appServer.subscribe({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
      expirationTime: null,
    } as unknown as PushSubscriptionJSON);

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      url: payload.url ?? "/dashboard",
      tag: payload.tag ?? "general",
      urgent: !!payload.urgent,
    });

    // High urgency + 1d TTL keeps message queued while device is offline (like FCM defaults).
    // Topic collapses stale duplicates so users don't get a backlog when phone wakes up.
    await subscriber.pushTextMessage(body, {
      urgency: "high",
      ttl: 86400,
      topic: toTopicHeader(payload.tag),
    } as any);
    return { ok: true, gone: false };
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    // negrel/webpush throws PushMessageError with `response`/`statusCode` for HTTP failures
    const status: number | undefined =
      e?.response?.status ?? e?.statusCode ?? (msg.match(/\b(4\d\d|5\d\d)\b/) ? Number(RegExp.$1) : undefined);
    const gone = status === 404 || status === 410;
    return { ok: false, gone, status, error: msg.slice(0, 300) };
  }
}
