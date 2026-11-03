import { z } from 'zod';
import { idSchema, nameSchema } from '../common/validation';
import { businessDate, stockQuantity } from '../inventory/inventory.schemas';

export const money = z
  .string()
  .regex(/^\d{1,12}$/, 'Isi rupiah utuh (tanpa titik pemisah/koma), maksimal 12 digit.');
const positiveMoney = money.refine((v) => !/^0+$/.test(v), 'Jumlah harus lebih dari nol.');
export const supplierSchema = z
  .object({
    id: idSchema,
    code: z
      .string()
      .trim()
      .min(2, 'Isi kode supplier minimal 2 karakter.')
      .max(40)
      .regex(/^[A-Z0-9_.-]+$/, 'Gunakan A–Z, angka, titik (.), - atau _.'),
    name: nameSchema,
  })
  .strict();
export const pageQuery = z
  .object({
    q: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const purchaseQuery = pageQuery.extend({ locationId: idSchema });
const positiveQuantity = stockQuantity.refine(
  (v) => !v.startsWith('-') && !/^0+(\.0+)?$/.test(v),
  'Jumlah harus positif.',
);
export const purchaseSchema = z
  .object({
    id: idSchema,
    locationId: idSchema,
    supplierId: idSchema,
    invoiceReference: z.string().trim().min(2, 'Isi nomor nota/faktur supplier.').max(120),
    businessDate,
    dueDate: businessDate.nullable().default(null),
    note: z.string().trim().min(3, 'Isi keterangan pembelian.').max(500),
    lines: z
      .array(
        z
          .object({ stockItemId: idSchema, quantity: positiveQuantity, unitPrice: positiveMoney })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
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
export const purchaseReceiptSchema = z
  .object({
    id: idSchema,
    businessDate,
    reference: z.string().trim().min(2, 'Isi nomor surat jalan/bukti terima.').max(120),
    note: z.string().trim().min(3, 'Isi catatan penerimaan.').max(500),
    lines: z
      .array(z.object({ lineId: idSchema, quantity: positiveQuantity }).strict())
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.lines.map((l) => l.lineId)).size !== data.lines.length)
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Baris tidak boleh duplikat.' });
  });
export const linkReceiptSchema = z
  .object({ id: idSchema, stockDocumentId: idSchema, note: z.string().trim().min(3).max(500) })
  .strict();
export const paymentSchema = z
  .object({
    id: idSchema,
    businessDate,
    amount: positiveMoney,
    method: z.enum(['CASH', 'BANK_TRANSFER']),
    fundingSource: z.string().trim().min(3, 'Isi sumber dana/rekening/kas pembayar.').max(120),
    reference: z.string().trim().min(2, 'Isi nomor bukti pembayaran.').max(120),
    note: z.string().trim().min(3, 'Isi catatan pembayaran.').max(500),
  })
  .strict();
