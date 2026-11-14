import { markMissingAsAbsent, resolveDigestStatuses } from "./attendanceDigest.ts";

export interface AttendanceCell { date: string; total: number; present: number; late: number; leave: number; absent: number; unrecorded: number; evidence: boolean }
export interface SchoolAttendanceRow { student_id: string | null; status: string | null; attendance_date: string }
export interface SchoolScanRow { student_id: string | null; scan_time: string | null; created_at?: string | null; scan_type: string; scan_date: string }
export interface AttendanceClass { name: string; rosterTotal: number; rosterMale: number; rosterFemale: number; daily: AttendanceCell[]; maleDaily: AttendanceCell[]; femaleDaily: AttendanceCell[] }
export interface AttendanceRoster { id: string; className: string; gender?: string | null }

// Only totals leave the server. Ignore evidence belonging to a different roster.
export function aggregatePublicAttendance(ids: string[], dates: string[], attendance: SchoolAttendanceRow[], scans: SchoolScanRow[], today: string, clock: string, threshold: string, end: string, groups?: { roster: AttendanceRoster[]; classes: AttendanceClass[] }): AttendanceCell[] {
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
    const classCells = new Map<string, AttendanceCell>();
    for (const group of groups?.classes ?? []) {
      const row = { ...cell, total: group.rosterTotal };
      group.maleDaily.push({ ...cell, total: group.rosterMale });
      group.femaleDaily.push({ ...cell, total: group.rosterFemale });
      group.daily.push(row);
      classCells.set(group.name, row);
    }
    const classById = new Map(groups?.roster.map(s => [s.id, s.className]) ?? []);
    for (const id of ids) {
      const status = statuses.get(id) ?? "unrecorded";
      cell[status === "sick" ? "leave" : status]++;
      const classCell = classCells.get(classById.get(id) ?? "");
      if (classCell) {
        classCell[status === "sick" ? "leave" : status]++;
        const person = groups?.roster.find(s => s.id === id);
        const group = groups?.classes.find(s => s.name === person?.className);
        const gender = attendanceGender(person?.gender);
        const sexCell = gender === "male" ? group?.maleDaily.at(-1) : gender === "female" ? group?.femaleDaily.at(-1) : undefined;
        if (sexCell) sexCell[status === "sick" ? "leave" : status]++;
      }
    }
    return cell;
  });
}

export function aggregatePublicClasses(roster: AttendanceRoster[], dates: string[], attendance: SchoolAttendanceRow[], scans: SchoolScanRow[], today: string, clock: string, threshold: string, end: string): AttendanceClass[] {
  const levelOrder = (name: string) => {
    const match = name.match(/^(อ|ป|ม)\.(\d+)/);
    return match ? ({ อ: 0, ป: 10, ม: 20 }[match[1]] ?? 100) + Number(match[2]) : 100;
  };
  const names = [...new Set(roster.map(s => s.className))].sort((a,b)=>levelOrder(a)-levelOrder(b) || a.localeCompare(b,"th",{numeric:true}));
  const classes = names.map(name => {
    const members = roster.filter(s => s.className === name);
    return {name, rosterTotal: members.length, rosterMale: members.filter(s => attendanceGender(s.gender) === "male").length, rosterFemale: members.filter(s => attendanceGender(s.gender) === "female").length, daily: [] as AttendanceCell[], maleDaily: [] as AttendanceCell[], femaleDaily: [] as AttendanceCell[]};
  });
  aggregatePublicAttendance(roster.map(s=>s.id), dates, attendance, scans, today, clock, threshold, end, {roster, classes});
  return classes;
}
export function attendanceGender(value?: string | null): "male" | "female" | null {
  const gender = value?.trim().toLowerCase();
  return ["male", "ชาย", "m"].includes(gender ?? "") ? "male" : ["female", "หญิง", "f"].includes(gender ?? "") ? "female" : null;
}
