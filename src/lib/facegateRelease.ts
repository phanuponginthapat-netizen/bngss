import { useEffect, useState } from "react";
import { getBackendConfig } from "@/lib/runtimeConfig";
import { useCmsValue } from "@/hooks/useCmsSettings";

/**
 * ไฟลต์ ดิ ตั้ งโปรแกรมตู้ สแกนหน ้ า (FaceGate)
 *
 * รุ ่ นล ่ าสุด = ไฟลท์ ี่ GitHub Actions "Build FaceGate Agent" สร ้ างไว ้ในพ ื้ นท ี่ เก ็ บ
 * (manifest หน ้ า: app-downloads/facegate-version.json)
 * ถ ้ ายังไม ่เคยสร ้ าง หร ืออ ่ าน manifest ไม ่ได ้ → กล ับไปใช ้ไฟล ท์ ี่ แพ ็กไว ้ในโปรเจกต ์
 */

/** ไฟล ต์ ิ ั ้ ดต ั ้ งท ี่ แพ ็กไว ้ในโปรเจกต ์ — เปิ ดได ้ท ั นที โ ดยไม ่ ต ้ องรอ Actions */
export const FACEGATE_BUNDLED_URL = "/downloads/facegate-agent-installer.zip";

export interface FacegateRelease {
  version?: string;
  build?: number | string;
  fileName?: string;
  url?: string;
  sha256?: string;
  sizeBytes?: number;
  releasedAt?: string;
  notes?: string;
}

const MANIFEST_URL = `${getBackendConfig().url}/storage/v1/object/public/app-downloads/facegate-version.json`;

let cached: FacegateRelease | null | undefined;
let pending: Promise<FacegateRelease | null> | null = null;

export async function fetchFacegateRelease(): Promise<FacegateRelease | null> {
  if (cached !== undefined) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return null;
      const m = (await res.json()) as FacegateRelease;
      return m && typeof m.url === "string" && m.url.startsWith("http") ? m : null;
    } catch {
      return null;
    }
  })().then((m) => {
    cached = m;
    pending = null;
    return m;
  });
  return pending;
}

/** ลิงก ์ดาวน ์โหลดโปรแกรมต ู้ สแกนพร ้ อเวอร ์ ช ั น — ใช ้ร ่ วมก ั นท ั้ งหน ้ าท ี่ แ นนำ และหน ้ าต ั้ งค ่ า */
export function useFacegateRelease() {
  const override = useCmsValue("facegate_agent_url");
  const [release, setRelease] = useState<FacegateRelease | null>(cached ?? null);

  useEffect(() => {
    let alive = true;
    if (cached === undefined) {
      fetchFacegateRelease().then((m) => {
        if (alive) setRelease(m);
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const custom = override.trim();
  return {
    /** ลิงก ์ท ี่ ควรใช ้ (ผ ู้ด ูแลใส ่เอ งบ ้ านก ่ อน แล ้วค ่ วยล ั งก ์จ าก Actions แล ้วจ ึ งไฟล ์ในโปรเจกต ์) */
    url: custom || release?.url || FACEGATE_BUNDLED_URL,
    release,
    fileName: release?.fileName || "facegate-agent-installer.zip",
    version: release?.version ?? "",
    /** เป ็ นรุ ่ นท ี่ Actions สร ้ างล ่ าสุด (ไม ่ ใช ่ไฟล ์ต ้ างในโปรเจกต ์) */
    isBuilt: Boolean(!custom && release?.url),
  };
}
