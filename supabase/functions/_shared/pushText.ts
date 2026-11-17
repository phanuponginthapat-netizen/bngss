// Push services cap payloads at ~4KB of UTF-8 (Thai is 3 bytes/char), so cut by bytes, not characters.
export function clipUtf8(text: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= maxBytes) return text;
  let out = "";
  let used = 0;
  for (const ch of text) {
    const n = enc.encode(ch).length;
    if (used + n > maxBytes - 3) break;
    out += ch; used += n;
  }
  return out + "…";
}
