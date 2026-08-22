import { supabase } from "@/integrations/supabase/client";

export type Holiday = { holiday_date: string; end_date: string; reason: string; source: string };

let cached: { data: Holiday[]; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchHolidays(): Promise<Holiday[]> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  const { data } = await supabase.from("holidays").select("*");
  const list = (data as any[]) || [];
  cached = { data: list, at: Date.now() };
  return list;
}

export function isHolidaySync(dateISO: string, holidays: Holiday[]): boolean {
  if (!dateISO) return false;
  for (const h of holidays) {
    if (dateISO >= h.holiday_date && dateISO <= h.end_date) return true;
  }
  // Weekend
  const d = new Date(dateISO);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false; // weekends handled separately if needed
  return false;
}

export async function isHoliday(dateISO: string): Promise<boolean> {
  const holidays = await fetchHolidays();
  return isHolidaySync(dateISO, holidays);
}

export function clearHolidayCache() { cached = null; }
