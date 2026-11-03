import { z } from 'zod';
import type { Actor } from '../access/access';
import type { Prisma } from '../generated/prisma/client';

export const recipeQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    kind: z.enum(['PRODUCTION', 'SERVING']).optional(),
  })
  .strict();
export function recipeScope(actor: Actor): Prisma.RecipeWhereInput {
  if (actor.role === 'CENTRAL_ADMIN') return {};
  if (actor.role === 'DC_ADMIN' && actor.locationId) return { scopeLocationId: actor.locationId };
  return { id: { in: [] } };
}
