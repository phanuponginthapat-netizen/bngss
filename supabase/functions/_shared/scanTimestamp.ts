/** Retries must retain the captured instant; invalid dates never become today's scans. */
export function scanTimestamp(raw: unknown, now = new Date()): Date {
  if (raw === undefined || raw === null) return now; // legacy clients
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    throw new Error("Invalid scan timestamp");
  }
  const captured = new Date(raw);
  if (!Number.isFinite(captured.getTime()) || captured.getTime() > now.getTime() + 60_000) {
    throw new Error("Invalid scan timestamp");
  }
  return captured;
}