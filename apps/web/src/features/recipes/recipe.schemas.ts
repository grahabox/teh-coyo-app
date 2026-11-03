import { z } from 'zod';
import type { Recipe, Unit } from '../../lib/types';

export const recipeQuantity = z
  .string()
  .trim()
  .regex(
    /^\d{1,9}(\.\d{1,6})?$/,
    'Isi angka positif dengan titik desimal, maksimal 6 angka desimal.',
  )
  .refine((value) => /[1-9]/.test(value), 'Jumlah harus lebih dari nol.');
export const recipeFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Isi nama resep minimal 2 karakter.')
      .max(120, 'Nama maksimal 120 karakter.'),
    kind: z.enum(['PRODUCTION', 'SERVING']),
    scopeLocationId: z.uuid('Pilih DC yang tersedia.').nullable(),
    outputItemId: z.string(),
    menuVariantId: z.string(),
    outputQuantity: recipeQuantity,
    outputUnitCode: z.string().min(1, 'Pilih satuan hasil.'),
    components: z
      .array(
        z.object({
          stockItemId: z.uuid('Pilih bahan yang digunakan.'),
          quantity: recipeQuantity,
          unitCode: z.string().min(1, 'Pilih satuan bahan.'),
        }),
      )
      .max(50, 'Maksimal 50 bahan per resep.'),
  })
  .superRefine((data, context) => {
    const field = data.kind === 'PRODUCTION' ? 'outputItemId' : 'menuVariantId';
    if (!z.uuid().safeParse(data[field]).success)
      context.addIssue({
        code: 'custom',
        path: [field],
        message:
          data.kind === 'PRODUCTION'
            ? 'Pilih barang hasil produksi.'
            : 'Pilih menu minuman yang terkait.',
      });
    if (data.kind === 'SERVING' && (data.outputQuantity !== '1' || data.outputUnitCode !== 'pcs'))
      context.addIssue({
        code: 'custom',
        path: ['outputQuantity'],
        message: 'Takaran penyajian harus berbasis 1 cup.',
      });
    const seen = new Set<string>();
    data.components.forEach((line, index) => {
      if (seen.has(line.stockItemId))
        context.addIssue({
          code: 'custom',
          path: ['components', index, 'stockItemId'],
          message: 'Bahan sudah dipilih. Gabungkan takarannya dalam satu baris.',
        });
      if (data.kind === 'PRODUCTION' && line.stockItemId && line.stockItemId === data.outputItemId)
        context.addIssue({
          code: 'custom',
          path: ['components', index, 'stockItemId'],
          message: 'Barang hasil tidak boleh menjadi bahan resepnya sendiri.',
        });
      seen.add(line.stockItemId);
    });
  });
export type RecipeFormValues = z.infer<typeof recipeFormSchema>;
export function recipePayload(values: RecipeFormValues) {
  return {
    ...values,
    outputItemId: values.kind === 'PRODUCTION' ? values.outputItemId : null,
    menuVariantId: values.kind === 'SERVING' ? values.menuVariantId : null,
  };
}
export function compatibleUnits(units: Unit[], dimension: Unit['dimension'] | undefined) {
  return units.filter((unit) => unit.dimension === dimension);
}
export function targetSchema(kind: Recipe['kind']) {
  return z
    .object({
      targetQuantity: recipeQuantity,
      targetUnitCode: z.string().min(1, 'Pilih satuan target.'),
    })
    .superRefine((data, context) => {
      if (
        kind === 'SERVING' &&
        (!/^\d+$/.test(data.targetQuantity) || data.targetUnitCode !== 'pcs')
      )
        context.addIssue({
          code: 'custom',
          path: ['targetQuantity'],
          message: 'Jumlah cup harus bilangan bulat positif.',
        });
    });
}
