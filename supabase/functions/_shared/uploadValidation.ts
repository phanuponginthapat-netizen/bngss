export const MAX_DRIVE_BYTES = 50 * 1024 * 1024;
const TYPES = new Set(['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/zip','audio/mpeg','audio/wav','audio/webm','video/mp4','video/webm','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);

export function decodeUpload(raw: unknown, maxBytes: number): Uint8Array {
  if (typeof raw !== 'string' || !raw.length || raw.length > Math.ceil(maxBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) throw new Error('invalid or oversized upload');
  const decoded = atob(raw);
  if (!decoded.length || decoded.length > maxBytes) throw new Error('invalid or oversized upload');
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

export function validateDriveUpload(path: unknown, contentType: unknown, raw: unknown) {
  if (typeof path !== 'string' || path.length > 240 || !/^[A-Za-z0-9_./ -]+$/.test(path) || path.startsWith('/') || path.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('invalid upload path');
  if (typeof contentType !== 'string' || !TYPES.has(contentType)) throw new Error('unsupported file type');
  return decodeUpload(raw, MAX_DRIVE_BYTES);
}

export function validateJpegSnapshot(snapshot: string): Uint8Array {
  const raw = snapshot.startsWith('data:image/jpeg;base64,') ? snapshot.slice(23) : snapshot;
  const bytes = decodeUpload(raw, 5_000_000);
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('snapshot must be JPEG');
  return bytes;
}