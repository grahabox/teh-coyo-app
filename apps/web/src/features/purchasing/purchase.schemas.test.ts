import { describe, expect, it } from 'vitest';
import {
  lineAmount,
  purchaseFormSchema,
  paymentFormSchema,
  supplierFormSchema,
} from './purchase.schemas';
describe('Purchase UI', () => {
  it('accepts dotted supplier source codes and still rejects unsupported characters', () => {
    expect(supplierFormSchema.parse({ code: 'V.00001', name: 'Test supplier' }).code).toBe(
      'V.00001',
    );
    expect(supplierFormSchema.safeParse({ code: 'V 00001', name: 'Test supplier' }).success).toBe(
      false,
    );
    expect(supplierFormSchema.safeParse({ code: 'V/00001', name: 'Test supplier' }).success).toBe(
      false,
    );
  });
  it('previews whole-rupiah HALF_UP amounts exactly including large input', () => {
    expect(lineAmount('0.5', '3')).toBe('2');
    expect(lineAmount('2', '5000')).toBe('10000');
    expect(lineAmount('999999999.999999', '999999999999')).toBe('999999999998999000000');
    expect(lineAmount('1', '1.5')).toBeNull();
  });
  it('requires invoice and supplier, positive quantity and rejects duplicate items', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const l = { stockItemId: id, quantity: '2', unitPrice: '5000' };
    const body = {
      locationId: id,
      supplierId: id,
      invoiceReference: 'INV-1',
      businessDate: '2026-01-01',
      dueDate: '',
      note: 'Test invoice',
      lines: [l],
    };
    expect(purchaseFormSchema.safeParse(body).success).toBe(true);
    expect(purchaseFormSchema.safeParse({ ...body, lines: [l, l] }).success).toBe(false);
    expect(purchaseFormSchema.safeParse({ ...body, dueDate: '2025-12-31' }).success).toBe(false);
    expect(purchaseFormSchema.safeParse({ ...body, supplierId: '' }).success).toBe(false);
  });
  it('validates declared payments in whole rupiah with evidence', () => {
    const value = {
      businessDate: '2026-01-01',
      amount: '5000',
      method: 'CASH',
      fundingSource: 'Test cash',
      reference: 'PAY-1',
      note: 'Paid test',
    };
    expect(paymentFormSchema.safeParse(value).success).toBe(true);
    expect(paymentFormSchema.safeParse({ ...value, amount: '5,000' }).success).toBe(false);
  });
});
