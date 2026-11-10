import { useQuery } from "@tanstack/react-query";

/**
 * ข้อมูลรุ่ Android ที่เผยแพร่จาก GitHub Releases (tag: android-latest)
 * ลิงก์ดาวน์โหลดเป็นลิงก์ถาวร — GitHub จะส่งไฟล์รุ่ล่าสุดที่แนบไว้กบัตางนั้นเสมอ
 */
export const ANDROID_APK_DOWNLOAD_URL =
  "https://github.com/phanuponginthapat-netizen/bngss/releases/download/android-latest/bngss-app.apk";

export const ANDROID_RELEASE_PAGE_URL =
  "https://github.com/phanuponginthapat-netizen/bngss/releases/tag/android-latest";

export const ANDROID_APK_FILE_NAME = "bngss-app.apk";

const RELEASE_API_URL =
  "https://api.github.com/repos/phanuponginthapat-netizen/bngss/releases/tags/android-latest";

export type AndroidRelease = {
  /** เชน 1.0.169-169 — ว่างถ้ายังอ่านไมได้ */
  version: string;
  fileName: string;
  sizeBytes: number;
  /** ISO string */
  publishedAt: string;
  downloadUrl: string;
  notes: string;
};

/**
 * Values verified from GitHub on 10 Nov 2026 (BE) — used when the API cannot be read
 * so the download page still shows release info and keeps working
 */
export const FALLBACK_ANDROID_RELEASE: AndroidRelease = {
  version: "1.0.169",
  fileName: ANDROID_APK_FILE_NAME,
  sizeBytes: 31081833,
  publishedAt: "2026-11-10T06:37:01Z",
  downloadUrl: ANDROID_APK_DOWNLOAD_URL,
  notes: "",
};

/** Validates GitHub API data; returns only a usable release (never the API's own URL) */
export function parseAndroidRelease(value: unknown): AndroidRelease | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (r.draft === true || r.tag_name !== "android-latest") return null;

  const assets = Array.isArray(r.assets) ? r.assets : [];
  const apk = assets.find((a: unknown) => {
    if (!a || typeof a !== "object") return false;
    const f = a as Record<string, unknown>;
    return f.name === ANDROID_APK_FILE_NAME && typeof f.browser_download_url === "string";
  }) as Record<string, unknown> | undefined;
  if (!apk) return null;

  const size = typeof apk.size === "number" && apk.size > 0 ? apk.size : FALLBACK_ANDROID_RELEASE.sizeBytes;
  const publishedAt =
    typeof r.published_at === "string" && !Number.isNaN(Date.parse(r.published_at))
      ? r.published_at
      : FALLBACK_ANDROID_RELEASE.publishedAt;
  const name = typeof r.name === "string" ? r.name : "";
  const body = typeof r.body === "string" ? r.body : "";
  const version =
    name.match(/\d+\.\d+\.\d+(?:-\d+)?/)?.[0] ?? body.match(/\d+\.\d+\.\d+(?:-\d+)?/)?.[0] ?? "";

  return {
    version,
    fileName: ANDROID_APK_FILE_NAME,
    sizeBytes: size,
    publishedAt,
    // keep the canonical URL we define; never build a link from the API response
    downloadUrl: ANDROID_APK_DOWNLOAD_URL,
    notes: body.trim(),
  };
}

/** Reads the latest release from GitHub — returns null when unreadable (offline / quota) */
export async function fetchAndroidRelease(timeoutMs = 8000): Promise<AndroidRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(RELEASE_API_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    return parseAndroidRelease(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Download hook: live GitHub data when readable, otherwise the verified fallback */
export function useAndroidRelease() {
  const query = useQuery({
    queryKey: ["github-android-release"],
    queryFn: () => fetchAndroidRelease(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return {
    release: query.data ?? FALLBACK_ANDROID_RELEASE,
    isLive: Boolean(query.data),
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

/** 31081833 -> "29.6 MB" */
export function formatReleaseSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "-";
  const mb = sizeBytes / 1048576;
  if (mb >= 1000) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** ISO -> "10 พฤศจิกายน 2569" (เวลากรุงเทพฯ, พ.ศ.) */
export function formatReleaseDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const day = Number(get("day"));
    const month = Number(get("month"));
    const year = Number(get("year"));
    if (!day || !month || !year) return date.toISOString().slice(0, 10);
    return `${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
