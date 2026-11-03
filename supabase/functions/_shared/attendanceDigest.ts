export type DigestStatus = "present" | "late" | "leave" | "sick" | "absent" | "unrecorded";
const rank: Record<DigestStatus, number> = { present: 5, late: 4, leave: 3, sick: 3, absent: 1, unrecorded: 0 };

export function resolveDigestStatuses(
  attendance: { student_id: string | null; status: string | null }[],
  scans: { student_id: string | null; scan_time: string | null; created_at?: string | null; scan_type: string }[],
  threshold: string,
): Map<string, DigestStatus> {
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(threshold)) throw new Error("Invalid school late threshold");
  const cutoff = threshold.length === 5 ? `${threshold}:00` : threshold;
  const statuses = new Map<string, DigestStatus>();
  for (const row of attendance) {
    if (!row.student_id) continue;
    const status = row.status?.toLowerCase() as DigestStatus;
    if (!Object.prototype.hasOwnProperty.call(rank, status)) continue;
    const previous = statuses.get(row.student_id) ?? "unrecorded";
    if (rank[status] > rank[previous]) statuses.set(row.student_id, status);
  }
  const earliest = new Map<string, Date>();
  for (const scan of scans) {
    if (!scan.student_id || !["entry", "assembly"].includes(scan.scan_type)) continue;
    const time = new Date(scan.scan_time || scan.created_at || "");
    if (!Number.isFinite(time.getTime())) throw new Error("Invalid entry scan timestamp");
    const previous = earliest.get(scan.student_id);
    if (!previous || time < previous) earliest.set(scan.student_id, time);
  }
  for (const [id, time] of earliest) {
    // Saved school attendance remains authoritative for present/late; scans rescue absent/missing records.
    if (["present", "late"].includes(statuses.get(id) ?? "")) continue;
    const clock = time.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    statuses.set(id, clock > cutoff ? "late" : "present");
  }
  return statuses;
}

export async function readDigestRows<T>(query: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const result = await query(start, start + 499);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Attendance source returned no data");
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}