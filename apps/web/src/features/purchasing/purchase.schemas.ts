import { z } from 'zod';
import { scaled } from '../inventory/inventory.schemas';
const quantity = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,6})?$/, 'Gunakan angka dan titik desimal, maksimal 6 angka desimal.')
  .refine((v) => !/^0+(\.0+)?$/.test(v), 'Jumlah harus positif.');
const money = z
  .string()
  .regex(/^\d{1,12}$/, 'Isi rupiah utuh tanpa pemisah ribuan/koma.')
  .refine((v) => !/^0+$/.test(v), 'Nilai harus positif.');
export const supplierFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Isi kode supplier.')
    .max(40)
    .regex(/^[A-Z0-9_.-]+$/, 'Gunakan A–Z, angka, titik (.), - atau _.'),
  name: z.string().trim().min(2, 'Isi nama supplier.').max(120),
});
export const purchaseFormSchema = z
  .object({
    locationId: z.uuid('Pilih lokasi.'),
    supplierId: z.uuid('Pilih supplier.'),
    invoiceReference: z.string().trim().min(2, 'Isi nomor nota/faktur supplier.').max(120),
    businessDate: z.iso.date('Isi tanggal nota yang valid.'),
    dueDate: z
      .string()
      .refine(
        (v) => v === '' || z.iso.date().safeParse(v).success,
        'Isi tanggal jatuh tempo yang valid.',
      ),
    note: z.string().trim().min(3, 'Isi keterangan pembelian.').max(500),
    lines: z
      .array(z.object({ stockItemId: z.uuid('Pilih barang.'), quantity, unitPrice: money }))
      .min(1, 'Tambahkan minimal satu barang.')
      .max(100),
  })
  .superRefine((data, ctx) => {
    if (data.dueDate && data.dueDate < data.businessDate)
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Jatuh tempo tidak boleh sebelum tanggal nota.',
      });
    const seen = new Set<string>();
    data.lines.forEach((l, i) => {
      if (seen.has(l.stockItemId))
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'stockItemId'],
          message: 'Barang sudah ada di nota.',
        });
      seen.add(l.stockItemId);
    });
  });
export type PurchaseForm = z.infer<typeof purchaseFormSchema>;
export const paymentFormSchema = z.object({
  businessDate: z.iso.date(),
  amount: money,
  method: z.enum(['CASH', 'BANK_TRANSFER']),
  fundingSource: z.string().trim().min(3, 'Isi sumber dana/kas/rekening.').max(120),
  reference: z.string().trim().min(2, 'Isi nomor bukti pembayaran.').max(120),
  note: z.string().trim().min(3, 'Isi catatan pembayaran.').max(500),
});
export const receiveFormSchema = z
  .object({
    businessDate: z.iso.date(),
    reference: z.string().trim().min(2, 'Isi nomor bukti terima/surat jalan.').max(120),
    note: z.string().trim().min(3, 'Isi catatan penerimaan.').max(500),
    lines: z.array(
      z.object({
        lineId: z.string(),
        quantity: z
          .string()
          .refine(
            (v) => v === '' || /^\d{1,9}(\.\d{1,6})?$/.test(v),
            'Isi jumlah positif dengan titik desimal.',
          ),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (
      !data.lines.some((l) => /^\d{1,9}(\.\d{1,6})?$/.test(l.quantity) && scaled(l.quantity) > 0n)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Isi minimal satu jumlah terima positif.',
      });
  });
export const linkFormSchema = z.object({
  stockDocumentId: z.uuid('Isi ID dokumen penerimaan yang valid.'),
  note: z.string().trim().min(3, 'Isi dasar tautan nota/penerimaan.').max(500),
});
export function lineAmount(qty: string, price: string): string | null {
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(qty) || !/^\d{1,12}$/.test(price)) return null;
  return ((scaled(qty) * BigInt(price) + 500000n) / 1000000n).toString();
}
