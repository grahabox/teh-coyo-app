import type { Item, Location } from '../../lib/types';
export type StockKind = 'OPENING' | 'RECEIPT' | 'ADJUSTMENT' | 'TRANSFER';
export const kindNames: Record<StockKind, string> = {
  OPENING: 'Saldo awal',
  RECEIPT: 'Penerimaan supplier',
  ADJUSTMENT: 'Penyesuaian',
  TRANSFER: 'Transfer',
};
export const statusNames = {
  DRAFT: 'Draft',
  POSTED: 'Tercatat',
  SHIPPED: 'Dalam perjalanan / selisih terbuka',
  RECEIVED: 'Diterima lengkap',
};
export interface StockDocument {
  id: string;
  kind: StockKind;
  status: keyof typeof statusNames;
  locationId: string;
  destinationId: string | null;
  location: Location;
  destination: Location | null;
  reference: string;
  reason: string;
  supplierName: string | null;
  businessDate: string;
  lines: {
    id: string;
    stockItemId: string;
    stockItem: Item;
    quantity: string;
    receivedQuantity: string;
  }[];
  receipts: { id: string; businessDate: string; note: string; createdAt: string }[];
}
export interface StockRow extends Item {
  quantity: string | null;
  openingDate: string | null;
}
export interface Movement {
  id: string;
  businessDate: string;
  kind: string;
  quantity: string;
  balanceAfter: string;
  line: { stockItem: Item; document: { id: string; reference: string; reason: string } };
}
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
