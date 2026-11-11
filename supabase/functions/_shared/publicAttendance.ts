import { markMissingAsAbsent, resolveDigestStatuses } from "./attendanceDigest.ts";

export interface AttendanceCell { date: string; total: number; present: number; late: number; leave: number; absent: number; unrecorded: number; evidence: boolean }
export interface SchoolAttendanceRow { student_id: string | null; status: string | null; attendance_date: string }
export interface SchoolScanRow { student_id: string | null; scan_time: string | null; created_at?: string | null; scan_type: string; scan_date: string }

// Only totals leave the server. Ignore evidence belonging to a different roster.
export function aggregatePublicAttendance(ids: string[], dates: string[], attendance: SchoolAttendanceRow[], scans: SchoolScanRow[], today: string, clock: string, threshold: string, end: string): AttendanceCell[] {
  const roster = new Set(ids);
  const att = new Map<string, SchoolAttendanceRow[]>();
  const entries = new Map<string, SchoolScanRow[]>();
  for (const row of attendance) if (row.student_id && roster.has(row.student_id)) {
    const group = att.get(row.attendance_date) ?? []; group.push(row); att.set(row.attendance_date, group);
  }
  for (const row of scans) if (row.student_id && roster.has(row.student_id)) {
    const group = entries.get(row.scan_date) ?? []; group.push(row); entries.set(row.scan_date, group);
  }
  return dates.map(date => {
    const statuses = resolveDigestStatuses(att.get(date) ?? [], entries.get(date) ?? [], threshold);
    const evidence = statuses.size > 0;
    if (date <= today) markMissingAsAbsent(statuses, ids, date < today ? "23:59:59" : clock, end);
    const cell: AttendanceCell = { date, total: ids.length, present: 0, late: 0, leave: 0, absent: 0, unrecorded: 0, evidence };
    for (const id of ids) {
      const status = statuses.get(id) ?? "unrecorded";
      cell[status === "sick" ? "leave" : status]++;
    }
    return cell;
  });
}