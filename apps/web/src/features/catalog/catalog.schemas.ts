import { z } from 'zod';

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Isi ${label} terlebih dahulu.`)
    .min(2, 'Nama minimal 2 karakter.')
    .max(120, 'Nama maksimal 120 karakter.');
const code = z
  .string()
  .trim()
  .min(1, 'Isi kode terlebih dahulu.')
  .min(2, 'Kode minimal 2 karakter.')
  .max(40, 'Kode maksimal 40 karakter.')
  .regex(
    /^[A-Z0-9_-]+$/,
    'Gunakan huruf A–Z, angka, tanda hubung (-), atau garis bawah (_), tanpa spasi.',
  );

export const itemFormSchema = z.object({
  name: name('nama barang'),
  code,
  baseUnitId: z.uuid('Pilih satuan pencatatan barang.'),
});
export const menuGroupFormSchema = z.object({ name: name('nama kelompok minuman') });
export const variantFormSchema = z.object({
  name: name('nama rasa / menu'),
  code,
  menuId: z.uuid('Pilih kelompok minuman.'),
});
export type ItemFormValues = z.infer<typeof itemFormSchema>;
export type GroupFormValues = z.infer<typeof menuGroupFormSchema>;
export type VariantFormValues = z.infer<typeof variantFormSchema>;

export function unitLabel(code: string) {
  return (
    (
      {
        g: 'Gram (g)',
        ml: 'Mililiter (ml)',
        pcs: 'Buah (pcs)',
        kg: 'Kilogram (kg)',
        L: 'Liter (L)',
      } as Record<string, string>
    )[code] ?? code
  );
}

export function matchesSearch(query: string, ...values: string[]) {
  const term = query.trim().toLocaleLowerCase('id');
  return values.some((value) => value.toLocaleLowerCase('id').includes(term));
}
