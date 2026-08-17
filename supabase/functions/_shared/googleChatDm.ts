// Google Chat direct-message helper (Google Workspace only).
//
// Sends 1:1 DMs to Workspace users the same way LINE OA sends personal messages.
// Requires a Google Cloud service account with Domain-Wide Delegation granted in
// the Workspace Admin console for these scopes:
//   https://www.googleapis.com/auth/chat.spaces.create
//   https://www.googleapis.com/auth/chat.spaces
//   https://www.googleapis.com/auth/chat.messages.create
//
// Secrets:
//   GOOGLE_CHAT_SA_JSON        – full service-account JSON key
//   GOOGLE_CHAT_IMPERSONATE_USER – Workspace user the bot impersonates (e.g. notify@school.ac.th)

const SCOPES = [
  "https://www.googleapis.com/auth/chat.spaces.create",
  "https://www.googleapis.com/auth/chat.spaces",
  "https://www.googleapis.com/auth/chat.messages.create",
].join(" ");

export function gchatDmConfigured(): boolean {
  return Boolean(Deno.env.get("GOOGLE_CHAT_SA_JSON") && Deno.env.get("GOOGLE_CHAT_IMPERSONATE_USER"));
}

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let cachedToken: { token: string; exp: number } | null = null;

/** Mint (and cache) an OAuth access token impersonating the configured Workspace user. */
export async function getChatAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = JSON.parse(Deno.env.get("GOOGLE_CHAT_SA_JSON")!);
  const subject = Deno.env.get("GOOGLE_CHAT_IMPERSONATE_USER")!;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    sub: subject,
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key).buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)),
  );
  const assertion = `${header}.${claim}.${b64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`google token error ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  cachedToken = { token: data.access_token, exp: now + Number(data.expires_in || 3600) };
  return data.access_token;
}

const spaceCache = new Map<string, string>();

/** Resolve (or create) the DM space name for a Workspace user email. */
export async function getDmSpace(email: string, token: string): Promise<string> {
  const cached = spaceCache.get(email);
  if (cached) return cached;

  const find = await fetch(
    `https://chat.googleapis.com/v1/spaces:findDirectMessage?name=${encodeURIComponent(`users/${email}`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (find.ok) {
    const j = await find.json();
    if (j?.name) { spaceCache.set(email, j.name); return j.name; }
  } else if (find.status !== 404) {
    throw new Error(`findDirectMessage ${find.status}: ${(await find.text()).slice(0, 200)}`);
  }

  const setup = await fetch("https://chat.googleapis.com/v1/spaces:setup", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      space: { spaceType: "DIRECT_MESSAGE", singleUserBotDm: false },
      memberships: [{ member: { name: `users/${email}`, type: "HUMAN" } }],
    }),
  });
  if (!setup.ok) throw new Error(`spaces.setup ${setup.status}: ${(await setup.text()).slice(0, 200)}`);
  const space = await setup.json();
  spaceCache.set(email, space.name);
  return space.name;
}

/** Send a Chat message (text or cardsV2 payload) as a DM to a Workspace user. */
export async function sendChatDm(email: string, payload: Record<string, unknown>): Promise<void> {
  const token = await getChatAccessToken();
  const space = await getDmSpace(email, token);
  const resp = await fetch(`https://chat.googleapis.com/v1/${space}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`messages.create ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}
