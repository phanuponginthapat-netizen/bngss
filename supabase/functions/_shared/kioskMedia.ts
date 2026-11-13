// Re-sign stored media against the active backend; never save or serve expiring links.
// Stored values are either a private object path ("scans/2026-11-13/x.jpg"),
// a storage URL from any backend (public / signed / authenticated), or a data URL.
export async function kioskMediaUrl(db: any, raw: unknown, defaultBucket = "face-photos"): Promise<string | null> {
  if (typeof raw !== "string" || !raw) return null;
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)) return raw;
  const match = raw.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?]+)\/([^?]+)/);
  let bucket = defaultBucket;
  let path = "";
  if (match) {
    bucket = match[1];
    path = decodeURIComponent(match[2]);
  } else if (/^https?:\/\//i.test(raw)) {
    // a link that is not a storage object of this bucket set cannot be re-signed here
    return null;
  } else {
    path = decodeURIComponent(raw);
  }
  path = path.replace(/^\/+/, "");
  if (!bucket || !path) return null;
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
