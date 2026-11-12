// Re-sign legacy URLs against the active backend; never save expiring links.
export async function kioskMediaUrl(db: any, raw: unknown): Promise<string | null> {
  if (typeof raw !== "string" || !raw) return null;
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)) return raw;
  const match = raw.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?]+)\/([^?]+)/);
  if (!match) return /^https:\/\//.test(raw) ? raw : null;
  const bucket = match[1];
  const path = decodeURIComponent(match[2]);
  if (!bucket || !path) return null;
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}