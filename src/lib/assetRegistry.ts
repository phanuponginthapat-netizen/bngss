import { budgetDateParts } from './budgetAccounting';
export function assetNumericFields(form: { acquisition_cost: unknown; depreciation_rate: unknown; useful_life_years: unknown; quantity: unknown }) {
  const cost = Number(form.acquisition_cost), rate = Number(form.depreciation_rate), life = Number(form.useful_life_years), quantity = Number(form.quantity);
  if (String(form.acquisition_cost ?? '').trim() === '' || !Number.isFinite(cost) || cost < 0) throw new Error('ราคาที่ได้มาต้องเป็นตัวเลขไม่ติดลบ');
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('อัตราเสื่อมราคาต้องอยู่ระหว่าง 0–100');
  if (!Number.isInteger(life) || life < 1) throw new Error('อายุการใช้งานต้องเป็นจำนวนเต็มตั้งแต่ 1 ปี');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ชิ้น');
  return { cost, rate, life, quantity };
}
// Preserve the existing edit-time reducing-balance estimate; not a statutory depreciation ledger.
export function assetEstimatedValue(cost: number, rate: number, acquired: string | null, asOf: string) {
  if (!acquired) return cost;
  const start = budgetDateParts(acquired), end = budgetDateParts(asOf);
  const years = Math.max(0, end.year - start.year - (end.month < start.month || (end.month === start.month && end.day < start.day) ? 1 : 0));
  return Math.round(Math.max(0,cost * Math.pow(1-rate/100,years))*100)/100;
}
export function assetMatchesSearch(row: { asset_code?: string | null; asset_name?: string | null; serial_number?: string | null; barcode?: string | null; responsible_person?: string | null; location?: string | null; building?: string | null; room?: string | null }, query: string) {
  const q=query.trim().toLocaleLowerCase();
  return !q || Object.values(row).some(v=>typeof v==='string' && v.toLocaleLowerCase().includes(q));
}