import { thaiPublicHolidaysInRange } from "./thaiPublicHolidays";
export type StaffStatus = "normal" | "late" | "offsite" | "official" | "leave" | "absent" | "unrecorded";
export interface StaffClockRow { personnel_id: string; clock_date: string; clock_in: string | null; status: string; created_at?: string | null; id?: string }
export interface StaffDaySummary { date: string; total: number; normal: number; late: number; offsite: number; official: number; leave: number; absent: number; unrecorded: number }
export const STAFF_STATUSES: StaffStatus[] = ["normal", "late", "offsite", "official", "leave", "absent", "unrecorded"];
export function staffReportDates(start: string, end: string, today: string, holidays: { event_date: string; end_date: string | null }[]): string[] {
  const finish = end < today ? end : today;
  const publicDays = new Set(thaiPublicHolidaysInRange(start, finish).map(h => h.date));
  const dates: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(finish); t += 86400000) {
    const d = new Date(t), date = d.toISOString().slice(0, 10);
    if ([0, 6].includes(d.getUTCDay()) || publicDays.has(date) || holidays.some(h => h.event_date <= date && (h.end_date ?? h.event_date) >= date)) continue;
    dates.push(date);
  }
  return dates;
}
export function staffAttendanceSummary(ids: string[], dates: string[], records: StaffClockRow[]) {
  const roster = new Set(ids);
  const latest = new Map<string, StaffClockRow>();
  for (const row of records) {
    if (!roster.has(row.personnel_id)) continue;
    const key = `${row.clock_date}/${row.personnel_id}`;
    const previous = latest.get(key);
    if (!previous || String(row.created_at ?? row.clock_in ?? row.id ?? "") > String(previous.created_at ?? previous.clock_in ?? previous.id ?? "")) latest.set(key, row);
  }
  const statuses = new Map<string, StaffStatus>();
  const daily = dates.map(date => {
    const counts: StaffDaySummary = { date, total: ids.length, normal: 0, late: 0, offsite: 0, official: 0, leave: 0, absent: 0, unrecorded: 0 };
    for (const id of ids) {
      const key = `${date}/${id}`, row = latest.get(key);
      let status: StaffStatus = "unrecorded";
      if (row && STAFF_STATUSES.includes(row.status as StaffStatus)) {
        const attendance = ["normal", "late", "offsite"].includes(row.status);
        if (!attendance || (row.clock_in && Number.isFinite(Date.parse(row.clock_in)))) status = row.status as StaffStatus;
      }
      statuses.set(key, status); counts[status]++;
    }
    return counts;
  });
  const totals = daily.reduce((sum, row) => {
    sum.total += row.total;
    for (const status of STAFF_STATUSES) sum[status] += row[status];
    return sum;
  }, { total: 0, normal: 0, late: 0, offsite: 0, official: 0, leave: 0, absent: 0, unrecorded: 0 });
  return { daily, totals, statuses };
}
export function staffPercentage(value: number, denominator: number) { return denominator > 0 ? Math.round(value / denominator * 1000) / 10 : null; }