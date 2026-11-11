export const EXT_CONFIG_KEYS = [
  "school_name", "school_name_en", "school_logo", "footer_school_name", "app_name", "app_short_name", "app_favicon_url",
  "browser_blocklist", "browser_ad_domains", "browser_time_rules", "browser_login_url", "browser_default_homepage", "browser_block_message",
  "browser_keywords", "browser_keyword_categories", "browser_keyword_allowlist", "browser_keyword_scan_page",
];
export function safeVisit(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("ข้อมูลไม่ถูกต้อง");
  const b = input as Record<string, unknown>;
  if (typeof b.url !== "string" || b.url.length > 8192) throw new Error("URL ไม่ถูกต้อง");
  const url = new URL(b.url);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("URL ไม่ถูกต้อง");
  url.username = ""; url.password = ""; url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/token|password|secret|code|key/i.test(key)) url.searchParams.delete(key);
  const actions = ["visit", "blocked", "ad_blocked", "time_blocked", "keyword_blocked", "auth_required"];
  if (!actions.includes(String(b.action))) throw new Error("ประเภทประวัติไม่ถูกต้อง");
  return { url: url.href, domain: url.hostname, action: String(b.action), reason: typeof b.reason === "string" ? b.reason.slice(0, 1000) : null };
}