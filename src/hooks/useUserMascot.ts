// DiceBear avatar URL builder + user mascot hook
// ใช้สไตล์ avataaars / open-peeps ที่รองรับการตกแต่งตัวละครแบบ ZEPETO-like
// (ทรงผม, ตา, คิ้ว, ปาก, แว่น, เสื้อ, หนวด ฯลฯ) — ฟรี ไม่ติดลิขสิทธิ์
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MascotConfig = {
  style: string;
  seed: string;
  backgroundColor?: string;
  hairColor?: string;
  skinColor?: string;
  flip?: boolean;
  scale?: number;
  // ตกแต่งเพิ่ม (รองรับโดย avataaars / open-peeps)
  top?: string;           // ทรงผม/หมวก
  accessories?: string;   // แว่น
  facialHair?: string;    // หนวด/เครา
  clothing?: string;      // เสื้อ
  clothesColor?: string;
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
};

export const MASCOT_STYLES = [
  { id: "avataaars", label: "Avataaars (ตกแต่งเต็มรูปแบบ)" },
  { id: "open-peeps", label: "Open Peeps (สไตล์น่ารัก)" },
  { id: "personas", label: "Personas" },
  { id: "notionists", label: "Notionists" },
  { id: "adventurer", label: "นักผจญภัย" },
  { id: "lorelei", label: "ลอเรไล" },
  { id: "micah", label: "มิคาห์" },
  { id: "miniavs", label: "มินิ" },
  { id: "big-smile", label: "ยิ้มกว้าง" },
  { id: "fun-emoji", label: "อิโมจิสนุก" },
  { id: "bottts", label: "หุ่นยนต์" },
  { id: "pixel-art", label: "พิกเซลอาร์ต" },
  { id: "thumbs", label: "นิ้วโป้ง" },
];

export const BG_COLORS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "transparent"];

// avataaars option lists (subset ที่นิยม)
export const AVATAAARS_OPTIONS = {
  top: ["shortHairShortFlat", "shortHairShortRound", "shortHairTheCaesar", "longHairStraight", "longHairCurly", "longHairBun", "longHairFro", "hat", "hijab", "turban", "winterHat1", "noHair"],
  accessories: ["blank", "kurt", "prescription01", "prescription02", "round", "sunglasses", "wayfarers"],
  facialHair: ["blank", "beardLight", "beardMajestic", "beardMedium", "moustacheFancy", "moustacheMagnum"],
  clothing: ["blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck"],
  eyes: ["default", "happy", "wink", "winkWacky", "squint", "surprised", "hearts", "side"],
  eyebrows: ["default", "raisedExcited", "sadConcerned", "upDown", "angry", "flatNatural"],
  mouth: ["default", "smile", "twinkle", "tongue", "serious", "sad", "screamOpen"],
};

export function buildMascotUrl(cfg: MascotConfig | null | undefined, mood: "happy" | "neutral" | "worried" = "happy"): string {
  if (!cfg?.style || !cfg?.seed) return "";
  const params = new URLSearchParams();
  params.set("seed", cfg.seed);
  if (cfg.backgroundColor) params.set("backgroundColor", cfg.backgroundColor);
  if (cfg.hairColor) params.set("hairColor", cfg.hairColor);
  if (cfg.skinColor) params.set("skinColor", cfg.skinColor);
  if (cfg.flip) params.set("flip", "true");
  if (cfg.scale) params.set("scale", String(cfg.scale));
  if (cfg.top) params.set("top", cfg.top);
  if (cfg.accessories) params.set("accessories", cfg.accessories);
  if (cfg.facialHair) params.set("facialHair", cfg.facialHair);
  if (cfg.clothing) params.set("clothing", cfg.clothing);
  if (cfg.clothesColor) params.set("clothesColor", cfg.clothesColor);
  if (cfg.eyebrows) params.set("eyebrows", cfg.eyebrows);

  // mood override
  const moodEyes: Record<string, string> = { happy: "happy", neutral: "default", worried: "squint" };
  const moodMouth: Record<string, string> = { happy: "smile", neutral: "default", worried: "sad" };
  params.set("eyes", cfg.eyes || moodEyes[mood]);
  params.set("mouth", cfg.mouth || moodMouth[mood]);
  return `https://api.dicebear.com/9.x/${cfg.style}/svg?${params.toString()}`;
}

export function useUserMascot(userId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["user_mascot", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("mascot_config").eq("id", userId!).maybeSingle();
      return (data?.mascot_config as MascotConfig | null) || null;
    },
    staleTime: 60_000,
  });

  async function save(cfg: MascotConfig) {
    if (!userId) return;
    const { error } = await supabase.from("profiles")
      .update({ mascot_config: cfg as any }).eq("id", userId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["user_mascot", userId] });
  }

  async function clear() {
    if (!userId) return;
    const { error } = await supabase.from("profiles")
      .update({ mascot_config: null }).eq("id", userId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["user_mascot", userId] });
  }



  return { config: q.data, isLoading: q.isLoading, save, clear };
}
