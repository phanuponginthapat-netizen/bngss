/** Unknown measurements stay unknown; recorded zero is a valid measurement. */
export function measuredNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function measuredAverage(values: unknown[]): number | null {
  const measured = values.map(measuredNumber).filter((n): n is number => n !== null);
  return measured.length ? measured.reduce((sum, n) => sum + n, 0) / measured.length : null;
}
export function percentageChange(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / Math.abs(previous) * 100;
}
export function weightedChartAverage(rows: { value: number | null; count: number }[]): number | null {
  const measured = rows.filter((r): r is {value:number;count:number} => r.value !== null && r.count > 0);
  const count = measured.reduce((s,r)=>s+r.count,0);
  return count ? Math.round(measured.reduce((s,r)=>s+r.value*r.count,0)/count*10)/10 : null;
}