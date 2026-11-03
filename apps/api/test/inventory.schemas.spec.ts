import { documentSchema, receiveSchema } from '../src/inventory/inventory.schemas';
import { randomUUID } from 'node:crypto';

const base = () => ({
  id: randomUUID(),
  kind: 'OPENING',
  locationId: randomUUID(),
  businessDate: '2026-01-01',
  reference: 'TEST',
  reason: 'Verified count',
  lines: [{ stockItemId: randomUUID(), quantity: '0' }],
});
describe('Inventory validation', () => {
  it('accepts explicit zero opening, rejects zero movement and numeric instead of decimal string', () => {
    expect(documentSchema.safeParse(base()).success).toBe(true);
    expect(documentSchema.safeParse({ ...base(), kind: 'ADJUSTMENT' }).success).toBe(false);
    expect(
      documentSchema.safeParse({ ...base(), lines: [{ stockItemId: randomUUID(), quantity: 1 }] })
        .success,
    ).toBe(false);
  });
  it('requires receipt source and rejects unknown money/unit fields', () => {
    const input = {
      ...base(),
      kind: 'RECEIPT',
      lines: [{ stockItemId: randomUUID(), quantity: '1' }],
    };
    expect(documentSchema.safeParse(input).success).toBe(false);
    expect(documentSchema.safeParse({ ...input, supplierName: 'Supplier' }).success).toBe(true);
    expect(
      documentSchema.safeParse({ ...input, supplierName: 'Supplier', price: '1000' }).success,
    ).toBe(false);
  });
  it('rejects duplicate items, negative receipts, excess precision and invalid dates', () => {
    const input = base();
    expect(
      documentSchema.safeParse({ ...input, lines: [input.lines[0], input.lines[0]] }).success,
    ).toBe(false);
    expect(documentSchema.safeParse({ ...input, businessDate: '2026-02-30' }).success).toBe(false);
    for (const quantity of ['-1', '1.0000001', '1e2', '1000000000'])
      expect(
        documentSchema.safeParse({ ...input, lines: [{ ...input.lines[0], quantity }] }).success,
      ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...input,
        kind: 'ADJUSTMENT',
        lines: [{ ...input.lines[0], quantity: '-1.000001' }],
      }).success,
    ).toBe(true);
  });
  it('requires distinct transfer destination and unique positive received quantities', () => {
    const input = base();
    expect(
      documentSchema.safeParse({
        ...input,
        kind: 'TRANSFER',
        destinationId: input.locationId,
        lines: [{ ...input.lines[0], quantity: '1' }],
      }).success,
    ).toBe(false);
    const line = { lineId: randomUUID(), quantity: '1' };
    const receipt = {
      id: randomUUID(),
      businessDate: '2026-01-01',
      note: 'Received count',
      lines: [line],
    };
    expect(receiveSchema.safeParse(receipt).success).toBe(true);
    expect(receiveSchema.safeParse({ ...receipt, lines: [line, line] }).success).toBe(false);
    expect(
      receiveSchema.safeParse({ ...receipt, lines: [{ ...line, quantity: '0' }] }).success,
    ).toBe(false);
  });
});
