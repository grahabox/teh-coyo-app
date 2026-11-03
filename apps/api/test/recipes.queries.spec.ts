import { recipeQuerySchema, recipeScope } from '../src/recipes/recipes.queries';
import type { Actor } from '../src/access/access';

const actor = (role: Actor['role'], locationId: string | null): Actor => ({
  id: 'user',
  name: 'Test',
  email: 'test@test.invalid',
  sessionId: 'session',
  role,
  locationId,
});
describe('Recipe paging scope', () => {
  it('bounds paging/filter input and keeps drafts scoped to authorized writers', () => {
    expect(recipeQuerySchema.parse({})).toMatchObject({ page: 1, perPage: 25, q: '' });
    expect(recipeQuerySchema.safeParse({ perPage: '500' }).success).toBe(false);
    expect(recipeQuerySchema.safeParse({ kind: 'other' }).success).toBe(false);
    expect(recipeScope(actor('DC_ADMIN', 'dc-own'))).toEqual({ scopeLocationId: 'dc-own' });
    expect(recipeScope(actor('DC_ADMIN', null))).toEqual({ id: { in: [] } });
    expect(recipeScope(actor('PARTNER_ADMIN', 'stand'))).toEqual({ id: { in: [] } });
    expect(recipeScope(actor('CENTRAL_ADMIN', null))).toEqual({});
  });
});
