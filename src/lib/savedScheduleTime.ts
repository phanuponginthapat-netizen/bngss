export function savedPeriodTime(rows: Array<{ period?: number | null; start_time?: string | null; end_time?: string | null }>, period: number) {
  const times = rows.filter(r => r.period === period && r.start_time && r.end_time).map(r => ({ start: r.start_time?.slice(0, 5) ?? '', end: r.end_time?.slice(0, 5) ?? '' }));
  const first = times[0];
  if (!first || times.some(t => t.start !== first.start || t.end !== first.end)) return null;
  return first;
}