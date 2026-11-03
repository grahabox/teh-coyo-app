import { z } from 'zod';
const quantity = z
  .string()
  .regex(
    /^-?\d{1,9}(\.\d{1,6})?$/,
    'Isi angka dengan titik desimal, maksimal 6 angka di belakang titik.',
  );
export const stockFormSchema = z
  .object({
    kind: z.enum(['OPENING', 'RECEIPT', 'ADJUSTMENT', 'TRANSFER']),
    locationId: z.uuid('Pilih lokasi.'),
    destinationId: z.string(),
    businessDate: z.iso.date('Isi tanggal yang valid.'),
    reference: z.string().trim().min(2, 'Isi referensi dokumen.').max(120),
    reason: z.string().trim().min(3, 'Isi keterangan/alasan minimal 3 karakter.').max(500),
    supplierName: z.string().trim().max(120),
    lines: z
      .array(z.object({ stockItemId: z.uuid('Pilih barang.'), quantity }))
      .min(1, 'Tambahkan minimal satu barang.')
      .max(100),
  })
  .superRefine((data, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (data.kind === 'TRANSFER' && !z.uuid().safeParse(data.destinationId).success)
      issue(['destinationId'], 'Pilih lokasi tujuan.');
    if (data.kind === 'RECEIPT' && data.supplierName.length < 2)
      issue(['supplierName'], 'Isi nama supplier.');
    const seen = new Set<string>();
    data.lines.forEach((line, i) => {
      if (seen.has(line.stockItemId))
        issue(['lines', i, 'stockItemId'], 'Barang sudah ada di dokumen.');
      seen.add(line.stockItemId);
      if (data.kind !== 'ADJUSTMENT' && line.quantity.startsWith('-'))
        issue(['lines', i, 'quantity'], 'Jumlah tidak boleh negatif.');
      if (data.kind !== 'OPENING' && /^-?0+(\.0+)?$/.test(line.quantity))
        issue(['lines', i, 'quantity'], 'Jumlah tidak boleh nol.');
    });
  });
export type StockForm = z.infer<typeof stockFormSchema>;
// Six decimal places, using bigint to avoid binary floating-point stock arithmetic.
export function scaled(value: string) {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const v = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  return negative ? -v : v;
}
export function remaining(sent: string, received: string) {
  const v = scaled(sent) - scaled(received);
  return `${v / 1000000n}.${(v % 1000000n).toString().padStart(6, '0')}`.replace(/\.?0+$/, '');
}
