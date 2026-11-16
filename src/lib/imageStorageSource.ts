/** Parse only storage object URLs; unrelated remote images must stay untouched. */
export function imageStorageSource(source: string, defaultBucket = 'profile-images'): { bucket: string; path: string } | null {
  if (/^(data:|blob:)/i.test(source)) return null;
  const match = source.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
  if (/^(https?:|\/)/i.test(source)) return null;
  const path = source.startsWith(`${defaultBucket}/`) ? source.slice(defaultBucket.length + 1) : source;
  return { bucket: defaultBucket, path: decodeURIComponent(path) };
}