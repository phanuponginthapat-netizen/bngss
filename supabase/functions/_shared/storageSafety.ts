export const NEVER_OFFLOAD = new Set([
  "app-downloads", "cms-images", "cms-logos", "profile-images", "face-photos",
  "signatures", "line-richmenu", "game-covers", "certificate-assets", "print-templates", "pdf-templates",
]);

export async function verifyCopy(source: Uint8Array, copy: Uint8Array): Promise<void> {
  if (source.byteLength !== copy.byteLength) throw new Error("Drive copy size mismatch; original retained");
  const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource))).join(",");
  if (await digest(source) !== await digest(copy)) throw new Error("Drive copy checksum mismatch; original retained");
}

export function oldApks(names: string[], current: string, product: "android" | "scanner"): string[] {
  const pattern = product === "android" ? /^bngss-app-(?:v[\d.]+(?:-\d+)?|latest)\.apk$/ : /^bngss-scanner-(?:build-\d+|latest)\.apk$/;
  if (!pattern.test(current) || !names.includes(current)) throw new Error("Verified current APK is required before pruning");
  return names.filter(name => pattern.test(name) && name !== current);
}