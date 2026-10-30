import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBackendConfig } from "@/lib/runtimeConfig";
import { CMS_CACHE_KEY, parseCmsCache, type CmsMap } from "@/lib/cmsSettingsCache";

/**
 * Bulk loader — โหลด cms_settings ทั้งหมดครั้งเดียวต่อ session แล้ว cache ไว้
 * แทนการ query เป็นชุดเล็ก ๆ ในแต่ละหน้า → ลด round-trip ลงมหาศาล
 *
 * 3 ชั้น cache:
 *  1) React Query in-memory (staleTime 10 นาที)
 *  2) localStorage (TTL 1 ชั่วโมง) — เรนเดอร์ทันทีตอนเปิดเว็บ
 *  3) BroadcastChannel — sync ข้ามแท็บใน browser เดียวกัน
 *     ป้องกันไม่ให้แต่ละแท็บยิง network เอง
 *
 * ทุก hook ที่อ่าน cms_settings ต้องใช้ผ่าน selector นี้
 */

const LS_KEY = CMS_CACHE_KEY;
const BACKEND = getBackendConfig().url;
const CHANNEL_NAME = "cms_settings_sync_v1";


/**
 * Keys ที่เก็บ base64 image / ก้อน HTML ใหญ่ (>10KB) — ห้ามดึงตอน bulk
 * เพราะทำให้ทุกครั้งที่เข้าระบบต้องโหลดหลาย MB
 * ใช้ useCmsHeavyValue(key) โหลดเฉพาะหน้าที่ต้องการ
 */
export const HEAVY_KEYS = [
  "id_card_logo_url",
  "id_card_logo_url_2",
  "id_card_logo_url_3",
  "id_card_bg_image_url",
  "id_card_body_bg_image_url",
  "school_seal",
  "garuda_emblem",
  "hero_background",
] as const;

/**
 * โหลดค่า cms_settings แบบหนัก (base64 image ฯลฯ) เฉพาะเมื่อจำเป็น
 * cache 24 ชม. ใน react-query เพราะแทบไม่เปลี่ยน
 */
export function useCmsHeavyValue(key: string) {
  return useQuery({
    queryKey: ["cms_settings_heavy", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string) ?? "";
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}


function readLocal(): CmsMap | null {
  try {
    return parseCmsCache(localStorage.getItem(LS_KEY), BACKEND, Date.now())?.data ?? null;
  } catch { return null; }
}

function writeLocal(data: CmsMap) {
  if (!Object.keys(data).length) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), backend: BACKEND, data })); } catch { /* quota */ }
}

let broadcast: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!broadcast) {
    try { broadcast = new BroadcastChannel(CHANNEL_NAME); } catch { broadcast = null; }
  }
  return broadcast;
}

export function useCmsSettingsBulk() {
  const qc = useQueryClient();

  // Subscribe ครั้งเดียว — รับ broadcast จากแท็บอื่นแล้ว seed cache
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "cms_settings" && ev.data.backend === BACKEND &&
          parseCmsCache(JSON.stringify({ backend: BACKEND, at: Date.now(), data: ev.data.data }), BACKEND, Date.now())) {
        qc.setQueryData(["cms_settings_bulk"], ev.data.data as CmsMap);
        writeLocal(ev.data.data as CmsMap);
      }
    };
    ch.addEventListener("message", onMsg);
    return () => ch.removeEventListener("message", onMsg);
  }, [qc]);

  return useQuery({
    queryKey: ["cms_settings_bulk"],
    queryFn: async (): Promise<CmsMap> => {
      // รูปทั้งหมดถูกย้ายไป Storage bucket cms-assets แล้ว → value ใน DB เป็น URL สั้น
      // ปลอดภัยที่จะดึงทุก key พร้อมกัน (~2 KB total)
      const { data, error } = await supabase.from("cms_settings").select("key, value");
      if (error) throw error;
      const map: CmsMap = {};
      (data || []).forEach((s: any) => {
        if (s?.key) map[s.key] = s.value ?? "";
      });
      writeLocal(map);
      // broadcast ให้แท็บอื่นในเครื่องเดียวกัน ไม่ต้องยิง DB ซ้ำ
      try { getChannel()?.postMessage({ type: "cms_settings", backend: BACKEND, data: map }); } catch { /* noop */ }
      return map;
    },
    initialData: () => readLocal() ?? undefined,
    initialDataUpdatedAt: () => {
      try {
        return parseCmsCache(localStorage.getItem(LS_KEY), BACKEND, Date.now())?.at;
      } catch { return undefined; }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

/** อ่านค่าเดียวจาก cms_settings (ผ่าน bulk cache) */
export function useCmsValue(key: string): string {
  const { data } = useCmsSettingsBulk();
  return data?.[key] ?? "";
}

/** อ่านหลายค่าจาก cms_settings (ผ่าน bulk cache) */
export function useCmsValues(keys: string[]): Record<string, string> {
  const { data } = useCmsSettingsBulk();
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = data?.[k] ?? "";
  return out;
}
