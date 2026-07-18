// Period schedule builder — ดึงโครงสร้างคาบจาก school_settings (periods_per_day, lunch_after_period,
// period_start_time, period_duration_min, lunch_duration_min) แล้วคำนวณเวลา/คาบ + แทรกแถวพักเที่ยง
// ใช้ร่วมกันระหว่างหน้า "ตารางเรียน" และ "จองห้องพิเศษ" เพื่อให้สอดคล้องกัน

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PeriodSlot =
  | { kind: "period"; period: number; start: string; end: string; label: string }
  | { kind: "lunch"; start: string; end: string; label: string };

export type PeriodConfig = {
  periodsPerDay: number;
  lunchAfterPeriod: number;
  startTime: string;        // "HH:MM"
  periodMinutes: number;
  lunchMinutes: number;
};

const DEFAULTS: PeriodConfig = {
  periodsPerDay: 8,
  lunchAfterPeriod: 4,
  startTime: "08:30",
  periodMinutes: 50,
  lunchMinutes: 60,
};

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}
function toHHMM(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Build slots from config: period rows + a lunch row injected after `lunchAfterPeriod`. */
export function buildPeriodSlots(cfg: Partial<PeriodConfig> = {}): PeriodSlot[] {
  const c = { ...DEFAULTS, ...cfg };
  const slots: PeriodSlot[] = [];
  let cursor = toMin(c.startTime);
  for (let p = 1; p <= c.periodsPerDay; p++) {
    const start = cursor;
    const end = start + c.periodMinutes;
    slots.push({
      kind: "period",
      period: p,
      start: toHHMM(start),
      end: toHHMM(end),
      label: `คาบ ${p}`,
    });
    cursor = end;
    if (p === c.lunchAfterPeriod && p < c.periodsPerDay) {
      const lEnd = cursor + c.lunchMinutes;
      slots.push({
        kind: "lunch",
        start: toHHMM(cursor),
        end: toHHMM(lEnd),
        label: "พักกลางวัน",
      });
      cursor = lEnd;
    }
  }
  return slots;
}

/** Hook: load all 5 settings together + return computed slots. Single query, cached. */
export function usePeriodSchedule() {
  return useQuery({
    queryKey: ["period_schedule_config"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "periods_per_day",
          "lunch_after_period",
          "period_start_time",
          "period_duration_min",
          "lunch_duration_min",
        ]);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (r.setting_value != null) map[r.setting_key] = r.setting_value; });
      const cfg: PeriodConfig = {
        periodsPerDay: parseInt(map.periods_per_day || "") || DEFAULTS.periodsPerDay,
        lunchAfterPeriod: parseInt(map.lunch_after_period || "") || DEFAULTS.lunchAfterPeriod,
        startTime: (map.period_start_time || DEFAULTS.startTime).slice(0, 5),
        periodMinutes: parseInt(map.period_duration_min || "") || DEFAULTS.periodMinutes,
        lunchMinutes: parseInt(map.lunch_duration_min || "") || DEFAULTS.lunchMinutes,
      };
      const slots = buildPeriodSlots(cfg);
      const periodSlots = slots.filter((s): s is Extract<PeriodSlot, { kind: "period" }> => s.kind === "period");
      return { cfg, slots, periodSlots };
    },
  });
}
