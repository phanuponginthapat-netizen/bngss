import { describe, it, expect } from 'vitest';
import { accountingAmount, budgetDateParts, budgetPeriodRows, budgetSummary, latestAccountSnapshots, canUseBudgetAccounting } from '../budgetAccounting';
describe('budget accounting', () => {
  const rows = [
    { transaction_date:'2026-11-20',transaction_type:'income',amount:1000,budget_source:'งบประมาณ' },
    { transaction_date:'2026-11-21',transaction_type:'expense',amount:250,budget_source:'งบประมาณ' },
    { transaction_date:'2025-11-20',transaction_type:'income',amount:9000 },
  ];
  it('shows director and personnel budget access, not family accounts', () => {
    expect(canUseBudgetAccounting('director')).toBe(true); expect(canUseBudgetAccounting('teacher')).toBe(true);
    for(const r of ['student','parent','alumni',null]) expect(canUseBudgetAccounting(r)).toBe(false);
  });
  it('keeps the selected period totals free of other years', () => {
    const selected = budgetPeriodRows(rows,'2026','11');
    expect(selected).toHaveLength(2); expect(budgetSummary(selected)).toMatchObject({income:1000,expense:250,net:750});
    expect(budgetSummary(selected).months[10]).toEqual({month:11,income:1000,expense:250});
  });
  it('counts the latest balance per account once, never historical or future snapshots', () => {
    const base = {account_name:'เงินอุดหนุน',fiscal_year:2026,updated_at:'2026-11-20T04:00:00Z'};
    const snapshots = [ {...base,id:'1',month:10,balance:1000}, {...base,id:'2',month:11,balance:750}, {...base,id:'3',month:12,balance:500}, {...base,id:'4',month:11,fiscal_year:2025,balance:9000} ];
    expect(latestAccountSnapshots(snapshots,'2026','11').map(r=>r.balance)).toEqual([750]);
    expect(latestAccountSnapshots(snapshots,'2026','10').map(r=>r.balance)).toEqual([1000]);
    expect(latestAccountSnapshots(snapshots,'2024','all')).toEqual([]);
  });
  it('accepts a genuine zero account balance but rejects invalid transaction amounts', () => {
    expect(accountingAmount('0')).toBe(0);expect(()=>accountingAmount('0',true)).toThrow();
    expect(()=>accountingAmount('abc')).toThrow();expect(()=>accountingAmount('')).toThrow();
  });
  it('uses the entered date rather than save time and rejects impossible dates', () => {
    expect(budgetDateParts('2025-12-31')).toEqual({year:2025,month:12,day:31});
    expect(()=>budgetDateParts('2026-02-30')).toThrow();
  });
});