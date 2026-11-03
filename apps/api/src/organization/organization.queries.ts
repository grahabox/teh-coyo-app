import { z } from 'zod';
import type { Actor } from '../access/access';
import type { Prisma } from '../generated/prisma/client';

const paging = {
  q: z.string().trim().max(100, 'Pencarian maksimal 100 karakter.').default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
};
export const locationQuerySchema = z
  .object({
    ...paging,
    type: z.enum(['CENTER', 'DC', 'STAND']).optional(),
    ownership: z.enum(['OWNED', 'PARTNER']).optional(),
    parentId: z.uuid().optional(),
  })
  .strict();
export const entityQuerySchema = z
  .object({
    ...paging,
    excludeEntityId: z.uuid().optional(),
  })
  .strict();

// Filters can only narrow this scope; never let search/parentId replace it.
export function locationScope(actor: Actor): Prisma.LocationWhereInput {
  if (actor.role === 'CENTRAL_ADMIN') return {};
  if (!actor.locationId) return { id: { in: [] } };
  if (actor.role === 'DC_ADMIN')
    return { OR: [{ id: actor.locationId }, { parentId: actor.locationId }] };
  return { id: actor.locationId };
}

export function locationWhere(
  actor: Actor,
  query: z.infer<typeof locationQuerySchema>,
): Prisma.LocationWhereInput {
  return {
    AND: [
      locationScope(actor),
      ...(query.type ? [{ type: query.type }] : []),
      ...(query.ownership ? [{ ownership: query.ownership }] : []),
      ...(query.parentId ? [{ parentId: query.parentId }] : []),
      ...(query.q
        ? [
            {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { code: { contains: query.q, mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
    ],
  };
}
