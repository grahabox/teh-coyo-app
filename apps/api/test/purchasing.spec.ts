import { randomUUID } from 'node:crypto';
import { purchaseTotals, referenceKey } from '../src/procurement/purchase.math';
import {
  purchaseSchema,
  paymentSchema,
  supplierSchema,
} from '../src/procurement/procurement.schemas';
describe('Purchasing arithmetic and validation', () => {
  it('preserves dotted source supplier codes without loosening other input rules', () => {
    const data = { id: randomUUID(), code: 'V.00001', name: 'Test supplier' };
    expect(supplierSchema.parse(data).code).toBe('V.00001');
    expect(supplierSchema.safeParse({ ...data, code: 'SUPPLIER_01-A' }).success).toBe(true);
    for (const code of ['v.00001', 'V 00001', 'V/00001', 'V@00001'])
      expect(supplierSchema.safeParse({ ...data, code }).success).toBe(false);
    expect(supplierSchema.safeParse({ ...data, openingBalance: '100' }).success).toBe(false);
  });
  it('rounds positive exact line amounts HALF_UP and sums lines, not floating point', () => {
    const value = purchaseTotals([
      { quantity: '0.5', unitPrice: '3' },
      { quantity: '0.5', unitPrice: '3' },
    ]);
    expect(value.amounts.map((v) => v.toString())).toEqual(['2', '2']);
    expect(value.total.toString()).toBe('4');
    expect(
      purchaseTotals([{ quantity: '999999999.999999', unitPrice: '999999999999' }]).total.toFixed(
        0,
      ),
    ).toBe('999999999998999000000');
  });
  it('normalizes duplicate invoice/payment reference keys', () => {
    expect(referenceKey(' ab-01  test ')).toBe('AB-01 TEST');
  });
  it('requires source invoice, positive quantity/price and validates duplicate/due date', () => {
    const l = { stockItemId: randomUUID(), quantity: '2', unitPrice: '5000' };
    const body = {
      id: randomUUID(),
      locationId: randomUUID(),
      supplierId: randomUUID(),
      invoiceReference: 'INV-01',
      businessDate: '2026-01-01',
      note: 'Test invoice',
      lines: [l],
    };
    expect(purchaseSchema.safeParse(body).success).toBe(true);
    expect(purchaseSchema.safeParse({ ...body, dueDate: '2025-12-31' }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...body, lines: [l, l] }).success).toBe(false);
    for (const unitPrice of ['0', '1.5', '1,000', '-1'])
      expect(purchaseSchema.safeParse({ ...body, lines: [{ ...l, unitPrice }] }).success).toBe(
        false,
      );
    expect(purchaseSchema.safeParse({ ...body, tax: '11' }).success).toBe(false);
  });
  it('requires payment evidence and funding source; no default account or provider status', () => {
    const body = {
      id: randomUUID(),
      businessDate: '2026-01-01',
      amount: '100',
      method: 'CASH',
      reference: 'PAY-1',
      note: 'Test paid',
      fundingSource: 'Test cash',
    };
    expect(paymentSchema.safeParse(body).success).toBe(true);
    expect(paymentSchema.safeParse({ ...body, fundingSource: '' }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...body, amount: '0' }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...body, confirmedByProvider: true }).success).toBe(false);
  });
});
