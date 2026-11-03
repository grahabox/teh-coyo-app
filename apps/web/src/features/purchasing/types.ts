import type { Item, LocationRow } from '../../lib/types';
export interface Supplier {
  id: string;
  code: string;
  name: string;
}
export interface Purchase {
  id: string;
  locationId: string;
  supplierId: string;
  location: LocationRow;
  supplierName: string;
  invoiceReference: string;
  businessDate: string;
  dueDate: string | null;
  note: string;
  status: 'DRAFT' | 'CONFIRMED';
  currency: 'IDR';
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  receiptStatus: 'NONE' | 'PARTIAL' | 'COMPLETE';
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  lines: {
    id: string;
    stockItemId: string;
    stockItem: Item;
    quantity: string;
    receivedQuantity: string;
    unitPrice: string;
    lineAmount: string;
  }[];
  receipts: {
    id: string;
    linkedExisting: boolean;
    stockDocumentId: string;
    stockDocument: { reference: string; businessDate: string; reason: string };
  }[];
  payments: {
    id: string;
    businessDate: string;
    amount: string;
    method: 'CASH' | 'BANK_TRANSFER';
    fundingSource: string;
    reference: string;
    note: string;
  }[];
}
export const receiptNames = {
  NONE: 'Belum diterima',
  PARTIAL: 'Diterima sebagian',
  COMPLETE: 'Diterima lengkap',
};
export const paymentNames = { UNPAID: 'Belum dibayar', PARTIAL: 'Dibayar sebagian', PAID: 'Lunas' };
export const rupiah = (value: string) =>
  `Rp${new Intl.NumberFormat('id-ID').format(BigInt(value))}`;
