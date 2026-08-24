import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch a diverse set of location-based photos using only free, key-less sources:
 *  1. Wikipedia (en + th) geosearch pageimages
 *  2. Wikimedia Commons geosearch (community photos near coordinates)
 *  3. Wikimedia Commons keyword search keyed off reverse-geocoded place name
 * Results are de-duplicated and shuffled to keep the hero feeling fresh.
 */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchWikipediaImages(lat: number, lng: number, host: string, radius = 10000): Promise<string[]> {
  try {
    const url =
      `https://${host}/w/api.php?action=query&format=json&origin=*` +
      `&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600` +
      `&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=${radius}&ggslimit=30`;
    const res = await fetch(url);
    const json = await res.json();
    const pages = json?.query?.pages ?? {};
    const imgs: string[] = [];
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      const src = p?.original?.source || p?.thumbnail?.source;
      if (src && /\.(jpe?g|png|webp)$/i.test(src)) imgs.push(src);
    }
    return imgs;
  } catch {
    return [];
  }
}

async function fetchCommonsImages(lat: number, lng: number, radius = 10000): Promise<string[]> {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=${radius}&ggsnamespace=6&ggslimit=40` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=1600`;
    const res = await fetch(url);
    const json = await res.json();
    const pages = json?.query?.pages ?? {};
    const imgs: string[] = [];
    for (const k of Object.keys(pages)) {
      const info = pages[k]?.imageinfo?.[0];
      const src = info?.thumburl || info?.url;
      if (src && /\.(jpe?g|png|webp)$/i.test(src)) imgs.push(src);
    }
    return imgs;
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=th`,
      { headers: { Accept: "application/json" } }
    );
    const json = await res.json();
    const a = json?.address ?? {};
    return a.city || a.town || a.village || a.county || a.state || a.province || null;
  } catch {
    return null;
  }
}

/**
 * Keyword image search via Wikimedia Commons (keyless).
 * หมายเหตุ: เดิมใช้ Openverse แต่ API เปลี่ยนไปบังคับ auth แล้วคืน 401 ทุกครั้ง
 */
async function fetchKeywordImages(query: string): Promise<string[]> {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(query)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=1600`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const pages = json?.query?.pages ?? {};
    const imgs: string[] = [];
    for (const k of Object.keys(pages)) {
      const info = pages[k]?.imageinfo?.[0];
      const src = info?.thumburl || info?.url;
      if (src && /\.(jpe?g|png|webp)$/i.test(src)) imgs.push(src);
    }
    return imgs;
  } catch {
    return [];
  }
}


/** Guaranteed visual variety even if all geo APIs fail or are blocked */
function picsumFallback(lat: number, lng: number): string[] {
  const seedBase = `${lat.toFixed(3)}_${lng.toFixed(3)}_${Date.now()}`;
  return Array.from({ length: 10 }, (_, i) =>
    `https://picsum.photos/seed/${encodeURIComponent(seedBase + "_" + i)}/1600/900`
  );
}

async function fetchAllImages(lat: number, lng: number): Promise<string[]> {
  const [enWiki, thWiki, commons, place] = await Promise.all([
    fetchWikipediaImages(lat, lng, "en.wikipedia.org", 10000),
    fetchWikipediaImages(lat, lng, "th.wikipedia.org", 10000),
    fetchCommonsImages(lat, lng, 10000),
    reverseGeocode(lat, lng),
  ]);

  const queries = place
    ? [`${place} landscape`, `${place} temple`, `${place} city`, "thailand nature"]
    : ["thailand landscape", "thailand temple", "asia nature"];
  const openverseResults = await Promise.all(queries.map(fetchKeywordImages));
  const openverse = openverseResults.flat();

  const geo = Array.from(new Set([...enWiki, ...thWiki, ...commons, ...openverse]));
  // Always blend picsum so we always have plenty of variety
  const merged = Array.from(new Set([...geo, ...picsumFallback(lat, lng)]));
  return shuffle(merged).slice(0, 20);
}

export function useNearbyPlaceImages() {
  const { data: coords } = useQuery({
    queryKey: ["school_coordinates_bg"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["clock_latitude", "clock_longitude"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return {
        lat: parseFloat(map.clock_latitude || "0"),
        lng: parseFloat(map.clock_longitude || "0"),
      };
    },
    staleTime: 60 * 60 * 1000,
  });

  const hasCoords = !!coords && coords.lat !== 0 && coords.lng !== 0;

  const { data: images } = useQuery({
    queryKey: ["nearby_place_images", coords?.lat, coords?.lng],
    enabled: hasCoords,
    queryFn: () => fetchAllImages(coords!.lat, coords!.lng),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  return { images: images ?? [], hasCoords };
}
