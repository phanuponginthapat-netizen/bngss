// Create a short URL via a public shortener (is.gd, fallback tinyurl).
// Falls back to the original URL if both providers fail.
export async function shortenUrl(url: string): Promise<string> {
  try {
    const r = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
    if (r.ok) {
      const t = (await r.text()).trim();
      if (t.startsWith("http")) return t;
    }
  } catch {}
  try {
    const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    if (r.ok) {
      const t = (await r.text()).trim();
      if (t.startsWith("http")) return t;
    }
  } catch {}
  return url;
}
