// Period schedule builder — ดึงโครงสร้างคาบจาก school_settings
// รองรับ:
// 1) คำนวณเวลาเท่ากันทุกคาบ (period_duration_min) — โหมดพื้นฐาน
// 2) override เวลารายคาบ (period_times_json) — โหมด custom per-period
// 3) แยก ประถม/มัธยม (split_levels_schedule)
// 4) ตารางวันเสาร์-อาทิตย์ (weekend_schedule_enabled + weekend_days_json)

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SchoolLevel = "primary" | "secondary";
export type Session = "morning" | "afternoon";

export type PeriodTimeOverride = { period: number; start: string; end: string };

export type PeriodSlot =
  | { kind: "period"; period: number; start: string; end: string; label: string; session: Session }
  | { kind: "lunch"; start: string; end: string; label: string };

export type PeriodConfig = {
  periodsPerDay: number;
  lunchAfterPeriod: number;
  startTime: string;        // "HH:MM"
  periodMinutes: number;
  lunchMinutes: number;
  periodTimes?: PeriodTimeOverride[]; // optional per-period overrides
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

export function gradeToLevel(grade?: string | null): SchoolLevel {
  const g = (grade || "").trim();
  if (g.startsWith("ม.") || /^M\.?/i.test(g)) return "secondary";
  return "primary";
}

/** Build slots from config. หากมี periodTimes overrides จะใช้เวลานั้นแทน */
export function buildPeriodSlots(cfg: Partial<PeriodConfig> = {}): PeriodSlot[] {
  const c = { ...DEFAULTS, ...cfg };
  const slots: PeriodSlot[] = [];

  // overrides map by period number
  const overrideMap = new Map<number, PeriodTimeOverride>();
  (c.periodTimes || []).forEach((o) => {
    if (o && o.period && o.start && o.end) overrideMap.set(o.period, o);
  });

  let cursor = toMin(c.startTime);
  for (let p = 1; p <= c.periodsPerDay; p++) {
    const ov = overrideMap.get(p);
    let startStr: string;
    let endStr: string;
    if (ov) {
      startStr = ov.start;
      endStr = ov.end;
      cursor = toMin(endStr);
    } else {
      startStr = toHHMM(cursor);
      endStr = toHHMM(cursor + c.periodMinutes);
      cursor = cursor + c.periodMinutes;
    }
    const session: Session = p <= c.lunchAfterPeriod ? "morning" : "afternoon";
    slots.push({
      kind: "period",
      period: p,
      start: startStr,
      end: endStr,
      label: `คาบ ${p}`,
      session,
    });
    if (p === c.lunchAfterPeriod && p < c.periodsPerDay) {
      // pick lunch end from next period's override if exists; else cursor + lunchMinutes
      const next = overrideMap.get(p + 1);
      const lStart = toMin(endStr);
      const lEnd = next ? toMin(next.start) : lStart + c.lunchMinutes;
      slots.push({
        kind: "lunch",
        start: toHHMM(lStart),
        end: toHHMM(lEnd),
        label: "พักกลางวัน",
      });
      cursor = lEnd;
    }
  }
  return slots;
}

function parsePeriodTimesJSON(raw?: string): PeriodTimeOverride[] | undefined {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return undefined;
    const out: PeriodTimeOverride[] = arr
      .map((x: any) => ({
        period: parseInt(x?.period),
        start: String(x?.start || "").slice(0, 5),
        end: String(x?.end || "").slice(0, 5),
      }))
      .filter((x) => x.period && /^\d\d:\d\d$/.test(x.start) && /^\d\d:\d\d$/.test(x.end));
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

function parseCfgFromMap(map: Record<string, string>, prefix = ""): PeriodConfig {
  const p = prefix ? `${prefix}_` : "";
  return {
    periodsPerDay: parseInt(map[`${p}periods_per_day`] || "") || DEFAULTS.periodsPerDay,
    lunchAfterPeriod: parseInt(map[`${p}lunch_after_period`] || "") || DEFAULTS.lunchAfterPeriod,
    startTime: (map[`${p}period_start_time`] || DEFAULTS.startTime).slice(0, 5),
    periodMinutes: parseInt(map[`${p}period_duration_min`] || "") || DEFAULTS.periodMinutes,
    lunchMinutes: parseInt(map[`${p}lunch_duration_min`] || "") || DEFAULTS.lunchMinutes,
    periodTimes: parsePeriodTimesJSON(map[`${p}period_times_json`]),
  };
}

/** Weekend days config: 6 = Saturday, 7 = Sunday */
export type WeekendCfg = {
  enabled: boolean;
  days: number[]; // subset of [6, 7]
};

function parseWeekendCfg(map: Record<string, string>): WeekendCfg {
  const enabled = map.weekend_schedule_enabled === "1" || map.weekend_schedule_enabled === "true";
  let days: number[] = [];
  try {
    const arr = JSON.parse(map.weekend_days_json || "[]");
    if (Array.isArray(arr)) days = arr.map((x) => parseInt(x)).filter((x) => x === 6 || x === 7);
  } catch {/* noop */}
  if (enabled && days.length === 0) days = [6, 7];
  return { enabled, days };
}

export function usePeriodSchedule(level?: SchoolLevel) {
  return useQuery({
    queryKey: ["period_schedule_config", level || "global"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "split_levels_schedule",
          "periods_per_day", "lunch_after_period", "period_start_time", "period_duration_min", "lunch_duration_min", "period_times_json",
          "primary_periods_per_day", "primary_lunch_after_period", "primary_period_start_time", "primary_period_duration_min", "primary_lunch_duration_min", "primary_period_times_json",
          "secondary_periods_per_day", "secondary_lunch_after_period", "secondary_period_start_time", "secondary_period_duration_min", "secondary_lunch_duration_min", "secondary_period_times_json",
          "weekend_schedule_enabled", "weekend_days_json",
        ]);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (r.setting_value != null) map[r.setting_key] = r.setting_value; });

      const split = map.split_levels_schedule === "1" || map.split_levels_schedule === "true";
      const globalCfg = parseCfgFromMap(map, "");
      let cfg = globalCfg;
      if (split && level) {
        const levelMap: Record<string, string> = {};
        const pfx = level === "primary" ? "primary_" : "secondary_";
        ["periods_per_day", "lunch_after_period", "period_start_time", "period_duration_min", "lunch_duration_min", "period_times_json"].forEach((k) => {
          levelMap[k] = map[`${pfx}${k}`] || map[k] || "";
        });
        cfg = parseCfgFromMap(levelMap, "");
      }
      const slots = buildPeriodSlots(cfg);
      const periodSlots = slots.filter((s): s is Extract<PeriodSlot, { kind: "period" }> => s.kind === "period");
      const weekend = parseWeekendCfg(map);
      return { cfg, slots, periodSlots, split, globalCfg, weekend };
    },
  });
}
