import { describe,it,expect } from 'vitest';
import { assetNumericFields,assetEstimatedValue,assetMatchesSearch } from '../assetRegistry';
describe('asset registry integrity',()=>{
  const fields={acquisition_cost:'10000',depreciation_rate:'20',useful_life_years:'5',quantity:'2'};
  it('does not depreciate a newly acquired item on registration',()=>{expect(assetEstimatedValue(10000,20,'2026-11-20','2026-11-20')).toBe(10000);});
  it('uses the same existing yearly estimate at create and edit boundaries',()=>{expect(assetEstimatedValue(10000,20,'2024-11-20','2026-11-20')).toBe(6400);expect(assetEstimatedValue(10000,20,'2024-11-21','2026-11-20')).toBe(8000);});
  it('rejects invalid numeric fields instead of silently replacing values',()=>{expect(assetNumericFields(fields)).toEqual({cost:10000,rate:20,life:5,quantity:2});for(const patch of [{acquisition_cost:'abc'},{acquisition_cost:-1},{depreciation_rate:101},{quantity:1.5},{quantity:0},{useful_life_years:2.5}])expect(()=>assetNumericFields({...fields,...patch})).toThrow();});
  it('finds serial numbers and barcodes with normalized search',()=>{expect(assetMatchesSearch({serial_number:'SN-ABC-123'},' abc ')).toBe(true);expect(assetMatchesSearch({barcode:'B-001'},'b-001')).toBe(true);expect(assetMatchesSearch({asset_code:'A1'},'B1')).toBe(false);});
});