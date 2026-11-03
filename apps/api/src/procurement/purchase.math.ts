import { Prisma } from '../generated/prisma/client';
import Decimal from 'decimal.js';
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export function purchaseTotals(lines: { quantity: string; unitPrice: string }[]) {
  const amounts = lines.map(
    (l) =>
      new Prisma.Decimal(
        new Exact(l.quantity).mul(l.unitPrice).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0),
      ),
  );
  return { amounts, total: amounts.reduce((sum, v) => sum.add(v), new Prisma.Decimal(0)) };
}
export const referenceKey = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
