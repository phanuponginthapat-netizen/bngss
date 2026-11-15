export async function verifyLineSignature(body: string, signature: string | null, secret: string | null): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(body));
  } catch { return false; }
}