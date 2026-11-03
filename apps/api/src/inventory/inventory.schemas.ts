import { z } from 'zod';
import { idSchema } from '../common/validation';

export const stockQuantity = z
  .string()
  .regex(
    /^-?\d{1,9}(\.\d{1,6})?$/,
    'Gunakan angka, titik desimal, maksimal 6 angka di belakang titik.',
  );
export const businessDate = z.iso.date('Isi tanggal yang valid.');
export const documentSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['OPENING', 'RECEIPT', 'ADJUSTMENT', 'TRANSFER']),
    locationId: idSchema,
    destinationId: idSchema.nullable().default(null),
    businessDate,
    reference: z.string().trim().min(2, 'Isi referensi dokumen.').max(120),
    reason: z.string().trim().min(3, 'Isi keterangan/alasan minimal 3 karakter.').max(500),
    supplierName: z.string().trim().min(2).max(120).nullable().default(null),
    lines: z
      .array(z.object({ stockItemId: idSchema, quantity: stockQuantity }).strict())
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((data, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (data.kind === 'TRANSFER' && (!data.destinationId || data.destinationId === data.locationId))
      issue(['destinationId'], 'Pilih tujuan berbeda dari sumber.');
    if (data.kind !== 'TRANSFER' && data.destinationId)
      issue(['destinationId'], 'Tujuan hanya untuk transfer.');
    if (data.kind === 'RECEIPT' && !data.supplierName)
      issue(['supplierName'], 'Isi nama supplier sumber barang.');
    if (data.kind !== 'RECEIPT' && data.supplierName)
      issue(['supplierName'], 'Supplier hanya untuk penerimaan.');
    const seen = new Set<string>();
    data.lines.forEach((line, i) => {
      if (seen.has(line.stockItemId))
        issue(['lines', i, 'stockItemId'], 'Barang sudah ada di dokumen.');
      seen.add(line.stockItemId);
      const zero = /^-?0+(\.0+)?$/.test(line.quantity);
      if (data.kind !== 'ADJUSTMENT' && line.quantity.startsWith('-'))
        issue(['lines', i, 'quantity'], 'Jumlah tidak boleh negatif.');
      if (data.kind !== 'OPENING' && zero)
        issue(['lines', i, 'quantity'], 'Jumlah tidak boleh nol.');
    });
  });

export const receiveSchema = z
  .object({
    id: idSchema,
    businessDate,
    note: z.string().trim().min(3, 'Isi catatan penerimaan/selisih.').max(500),
    lines: z
      .array(
        z
          .object({
            lineId: idSchema,
            quantity: stockQuantity.refine(
              (v) => !v.startsWith('-') && !/^0+(\.0+)?$/.test(v),
              'Jumlah terima harus positif.',
            ),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.lines.map((l) => l.lineId)).size !== data.lines.length)
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Baris penerimaan tidak boleh berulang.',
      });
  });

export const inventoryQuery = z
  .object({
    locationId: idSchema,
    stockItemId: idSchema.optional(),
    q: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type DocumentInput = z.infer<typeof documentSchema>;
