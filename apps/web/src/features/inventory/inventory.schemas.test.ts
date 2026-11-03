import { describe, expect, it } from 'vitest';
import { remaining, scaled, stockFormSchema } from './inventory.schemas';
describe('Inventory UI quantities', () => {
  it('subtracts six-place decimals exactly without floating point', () => {
    expect(remaining('20', '18')).toBe('2');
    expect(remaining('0.3', '0.1')).toBe('0.2');
    expect(remaining('0.000001', '0.000001')).toBe('0');
    expect(scaled('-0.000001')).toBe(-1n);
    expect(remaining('999999999.999999', '999999999.999998')).toBe('0.000001');
  });
  it('validates zero opening but not zero adjustment, duplicate items, receipt source', () => {
    const item = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const value = {
      kind: 'OPENING',
      locationId: item,
      destinationId: '',
      businessDate: '2026-01-01',
      reference: 'TEST',
      reason: 'Verified count',
      supplierName: '',
      lines: [{ stockItemId: item, quantity: '0' }],
    };
    expect(stockFormSchema.safeParse(value).success).toBe(true);
    expect(stockFormSchema.safeParse({ ...value, kind: 'ADJUSTMENT' }).success).toBe(false);
    expect(
      stockFormSchema.safeParse({ ...value, lines: [value.lines[0], value.lines[0]] }).success,
    ).toBe(false);
    expect(
      stockFormSchema.safeParse({
        ...value,
        kind: 'RECEIPT',
        lines: [{ stockItemId: item, quantity: '1' }],
      }).success,
    ).toBe(false);
  });
});
