/**
 * Shared signer resolver — ใช้ร่วมในทุกเอกสาร (ปพ.5/ปพ.6, คำสั่งโรงเรียน, SAR, รายงานประจำปี ฯลฯ)
 * ดึงจากตาราง director_signatures ที่ admin ตั้งค่าไว้ใน "การตั้งค่า > ลายเซ็นผู้บริหาร"
 * แล้วจับคู่ตาม keyword ในช่อง position
 */
import { supabase } from "@/integrations/supabase/client";

export interface Signer {
  name: string;
  position: string;
  signature_url?: string;
}

export type SignerRole =
  | "academic_head"          // หัวหน้างานวิชาการ
  | "subject_group_head"     // หัวหน้ากลุ่มสาระการเรียนรู้
  | "measurement_head"       // หัวหน้างานวัดและประเมินผล
  | "deputy_academic"        // รอง ผอ. กลุ่มบริหารวิชาการ
  | "deputy_personnel"       // รอง ผอ. กลุ่มบริหารงานบุคคล
  | "deputy_general"         // รอง ผอ. กลุ่มบริหารทั่วไป
  | "deputy_budget"          // รอง ผอ. กลุ่มบริหารงบประมาณ
  | "director";              // ผู้อำนวยการสถานศึกษา

const ROLE_KEYWORDS: Record<SignerRole, string[]> = {
  academic_head: ["หัวหน้างานวิชาการ", "งานวิชาการ"],
  subject_group_head: ["หัวหน้ากลุ่มสาระ", "หัวหน้ากลุ่ม"],
  measurement_head: ["หัวหน้างานวัด", "วัดและประเมิน"],
  deputy_academic: ["รองผู้อำนวยการฝ่ายวิชาการ", "รองผู้อำนวยการกลุ่มบริหารวิชาการ", "รองผอ.วิชาการ"],
  deputy_personnel: ["ฝ่ายบุคคล", "บริหารงานบุคคล", "บริหารบุคคล"],
  deputy_general: ["บริหารทั่วไป", "ฝ่ายบริหารทั่วไป"],
  deputy_budget: ["งบประมาณ", "บริหารงบประมาณ"],
  director: ["ผู้อำนวยการ", "ผอ."],
};

let cache: Signer[] | null = null;
let cacheAt = 0;
const TTL = 60_000;

async function loadAll(): Promise<Signer[]> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL) return cache;
  const { data } = await supabase
    .from("director_signatures")
    .select("name, position, signature_url")
    .eq("is_active", true);
  cache = (data || []) as any;
  cacheAt = now;
  return cache!;
}

export function invalidateSignerCache() {
  cache = null;
  cacheAt = 0;
}

/** หาผู้ลงนามตามบทบาท — คืน undefined ถ้ายังไม่ได้ตั้งค่า */
export async function getSigner(role: SignerRole): Promise<Signer | undefined> {
  const all = await loadAll();
  const kws = ROLE_KEYWORDS[role];
  // จับคู่เฉพาะ role อื่นออกก่อน (เช่น "ผู้อำนวยการ" อาจ match ของ "รองผู้อำนวยการ" — กรองด้วยลำดับยาวกว่า)
  if (role === "director") {
    return all.find((s) =>
      kws.some((k) => String(s.position || "").includes(k)) &&
      !String(s.position || "").includes("รอง")
    );
  }
  return all.find((s) => kws.some((k) => String(s.position || "").includes(k)));
}

/** ดึงผู้ลงนามหลายบทบาทพร้อมกัน */
export async function getSigners(
  roles: SignerRole[],
): Promise<Partial<Record<SignerRole, Signer>>> {
  const all = await loadAll();
  const out: Partial<Record<SignerRole, Signer>> = {};
  for (const r of roles) {
    const kws = ROLE_KEYWORDS[r];
    const match =
      r === "director"
        ? all.find((s) => kws.some((k) => String(s.position || "").includes(k)) && !String(s.position || "").includes("รอง"))
        : all.find((s) => kws.some((k) => String(s.position || "").includes(k)));
    if (match) out[r] = match;
  }
  return out;
}
