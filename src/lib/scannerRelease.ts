export type ScannerRelease = {
  product: "scanner";
  version: string;
  appId: "com.bngss.scanner";
  appName: "BNG Scanner";
  identityVerified: true;
  sha256: string;
  files: { name: string; url: string; sizeBytes: number }[];
};

/** Accept only releases verified from the compiled APK, never an old latest alias. */
export function parseScannerRelease(value: unknown): ScannerRelease | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (r.product !== "scanner" || r.appId !== "com.bngss.scanner" ||
      r.appName !== "BNG Scanner" || r.identityVerified !== true ||
      typeof r.version !== "string" || typeof r.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(r.sha256) || !Array.isArray(r.files)) return null;
  const files = r.files.filter((file: unknown) => {
    if (!file || typeof file !== "object") return false;
    const f = file as Record<string, unknown>;
    if (typeof f.name !== "string" || !/^bngss-scanner-build-\d+\.apk$/.test(f.name) ||
        typeof f.url !== "string" || typeof f.sizeBytes !== "number" || f.sizeBytes <= 0) return false;
    try {
      const url = new URL(f.url);
      return url.protocol === "https:" && decodeURIComponent(url.pathname.split("/").pop() || "") === f.name;
    } catch { return false; }
  });
  return files.length ? { ...r, files } as ScannerRelease : null;
}