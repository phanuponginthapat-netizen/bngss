// Shared LINE Messaging API helpers.
// - Settings fetchers (single key / bulk `line_*`)
// - push / multicast / broadcast / reply wrappers with consistent error surface

const LINE_BASE = "https://api.line.me/v2/bot/message";

// ============ SETTINGS ============

/** Fetch a single `school_settings.setting_value` by key. */
export async function getSetting(sb: any, key: string): Promise<string | null> {
  const { data } = await sb.from("school_settings")
    .select("setting_value").eq("setting_key", key).maybeSingle();
  return (data?.setting_value as string) || null;
}

/** Fetch all `line_%` keys as a flat map. */
export async function getLineSettings(sb: any): Promise<Record<string, string>> {
  const { data } = await sb.from("school_settings")
    .select("setting_key, setting_value").like("setting_key", "line_%");
  const map: Record<string, string> = {};
  (data || []).forEach((d: any) => { map[d.setting_key] = d.setting_value || ""; });
  return map;
}

/** Shortcut — LINE channel access token from settings. */
export const getLineToken = (sb: any) => getSetting(sb, "line_channel_access_token");

// ============ SEND ============

async function linePost(path: string, token: string, body: unknown) {
  const res = await fetch(`${LINE_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LINE ${path} ${res.status}: ${txt}`);
  }
  return res;
}

export const pushMessage = (token: string, to: string, messages: any[]) =>
  linePost("push", token, { to, messages });

export const multicastMessage = (token: string, userIds: string[], messages: any[]) =>
  linePost("multicast", token, { to: userIds, messages });

export const broadcastMessage = (token: string, messages: any[]) =>
  linePost("broadcast", token, { messages });

export const replyMessage = (token: string, replyToken: string, messages: any[]) =>
  linePost("reply", token, { replyToken, messages });
