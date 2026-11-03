import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(2, 'Isi nama minimal 2 karakter.')
  .max(120, 'Nama maksimal 120 karakter.');
const code = z
  .string()
  .trim()
  .min(2, 'Isi kode minimal 2 karakter.')
  .max(40, 'Kode maksimal 40 karakter.')
  .regex(/^[A-Z0-9_-]+$/, 'Gunakan huruf A–Z, angka, - atau _, tanpa spasi.');
export const entityFormSchema = z.object({ name, code });
export const locationFormSchema = z
  .object({
    name,
    code,
    type: z.enum(['CENTER', 'DC', 'STAND']),
    ownership: z.enum(['OWNED', 'PARTNER']),
    parentId: z.uuid().nullable(),
    entityId: z.string(),
  })
  .superRefine((data, context) => {
    if (data.type !== 'CENTER' && !data.parentId)
      context.addIssue({
        code: 'custom',
        path: ['parentId'],
        message:
          data.type === 'DC'
            ? 'Pilih pusat yang membawahi DC ini.'
            : 'Pilih DC yang menangani stand ini.',
      });
    if (
      (data.type === 'CENTER' || data.ownership === 'PARTNER') &&
      !z.uuid().safeParse(data.entityId).success
    )
      context.addIssue({
        code: 'custom',
        path: ['entityId'],
        message: 'Pilih pemilik usaha yang tersedia.',
      });
  });
export type LocationFormValues = z.infer<typeof locationFormSchema>;
export type EntityFormValues = z.infer<typeof entityFormSchema>;
export function locationLabel(type: 'CENTER' | 'DC' | 'STAND') {
  return { CENTER: 'pusat', DC: 'DC', STAND: 'stand' }[type];
}
