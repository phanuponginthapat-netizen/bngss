/** Stable receipt ID for retries of one device's captured staff scan. */
export async function scanReceipt(deviceId: string, personId: string, timestamp: string, direction: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([deviceId, personId, timestamp, direction]))));
  hash[6] = (hash[6] & 15) | 80;
  hash[8] = (hash[8] & 63) | 128;
  const hex = Array.from(hash.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}