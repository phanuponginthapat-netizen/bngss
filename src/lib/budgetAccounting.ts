export type BudgetTransaction = { transaction_date: string; transaction_type: string; amount: number | string; budget_source?: string | null };
export type AccountSnapshot = { id: string; account_name: string; balance: number | string; fiscal_year: number; month: number; updated_at: string; school_id?: string | null };
export const canUseBudgetAccounting = (role: string | null) => role === 'admin' || role === 'director' || role === 'teacher';
export const bangkokToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function budgetDateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('วันที่รายการไม่ถูกต้อง');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) throw new Error('วันที่รายการไม่ถูกต้อง');
  return { year, month, day };
}
export function accountingAmount(value: string | number, positive = false) {
  if (String(value).trim() === '') throw new Error('กรุณาระบุจำนวนเงิน');
  const n = Number(value);
  if (!Number.isFinite(n) || (positive && n <= 0)) throw new Error('จำนวนเงินไม่ถูกต้อง');
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function budgetPeriodRows<T extends BudgetTransaction>(rows: T[], year: string, month: string): T[] {
  return rows.filter(r => { const d = budgetDateParts(r.transaction_date); return (year === 'all' || d.year === Number(year)) && (month === 'all' || d.month === Number(month)); });
}
export function budgetSummary(rows: BudgetTransaction[]) {
  let income = 0, expense = 0;
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
  const sources = new Map<string, { name: string; income: number; expense: number }>();
  for (const row of rows) {
    const amount = accountingAmount(row.amount);
    const source = row.budget_source || 'ไม่ระบุแหล่งงบ';
    const entry = sources.get(source) || { name: source, income: 0, expense: 0 };
    const bucket = months[budgetDateParts(row.transaction_date).month - 1];
    if (row.transaction_type === 'income') { income += amount; entry.income += amount; if (bucket) bucket.income += amount; }
    else if (row.transaction_type === 'expense') { expense += amount; entry.expense += amount; if (bucket) bucket.expense += amount; }
    else throw new Error('ประเภทรายการไม่ถูกต้อง');
    sources.set(source, entry);
  }
  return { income: accountingAmount(income), expense: accountingAmount(expense), net: accountingAmount(income - expense), months, sources: [...sources.values()].sort((a,b) => b.expense - a.expense) };
}
// A balance is a snapshot, not another income: take one latest eligible snapshot per account.
export function latestAccountSnapshots<T extends AccountSnapshot>(rows: T[], year: string, month: string): T[] {
  const latest = new Map<string, T>();
  for (const r of rows) {
    const ce = r.fiscal_year >= 2400 ? r.fiscal_year - 543 : r.fiscal_year;
    if ((year !== 'all' && ce !== Number(year)) || (month !== 'all' && r.month > Number(month))) continue;
    const key = `${r.school_id || ''}:${r.account_name.trim()}`;
    const old = latest.get(key);
    const order = `${ce}-${String(r.month).padStart(2,'0')}-${r.updated_at}-${r.id}`;
    const oldYear = old && (old.fiscal_year >= 2400 ? old.fiscal_year - 543 : old.fiscal_year);
    const oldOrder = old && `${oldYear}-${String(old.month).padStart(2,'0')}-${old.updated_at}-${old.id}`;
    if (!oldOrder || order > oldOrder) latest.set(key,r);
  }
  return [...latest.values()].sort((a,b)=>a.account_name.localeCompare(b.account_name,'th'));
}