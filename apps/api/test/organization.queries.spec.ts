import {
  locationQuerySchema,
  entityQuerySchema,
  locationWhere,
} from '../src/organization/organization.queries';
import type { Actor } from '../src/access/access';

const actor = (role: Actor['role'], locationId: string | null): Actor => ({
  id: 'user',
  email: 'test@test.invalid',
  name: 'User',
  role,
  locationId,
  sessionId: 'session',
});
describe('Server organization filtering', () => {
  it('limits paging and validates filters', () => {
    expect(locationQuerySchema.parse({})).toMatchObject({ page: 1, perPage: 25, q: '' });
    expect(locationQuerySchema.parse({ page: '2', perPage: '10', q: '  Cirebon  ' })).toMatchObject(
      { page: 2, perPage: 10, q: 'Cirebon' },
    );
    expect(locationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(locationQuerySchema.safeParse({ perPage: '1000' }).success).toBe(false);
    expect(locationQuerySchema.safeParse({ parentId: 'invalid' }).success).toBe(false);
    expect(entityQuerySchema.safeParse({ unexpected: 'x' }).success).toBe(false);
  });
  it('intersects filters with actor scope instead of replacing scope', () => {
    const query = locationQuerySchema.parse({
      type: 'STAND',
      q: 'other',
      parentId: '23f3f210-886a-42fd-9047-7d66ff940abc',
    });
    expect(locationWhere(actor('DC_ADMIN', 'dc-own'), query).AND).toEqual(
      expect.arrayContaining([
        { OR: [{ id: 'dc-own' }, { parentId: 'dc-own' }] },
        { parentId: query.parentId },
        { type: 'STAND' },
      ]),
    );
    expect(locationWhere(actor('PARTNER_ADMIN', 'partner-own'), query).AND).toContainEqual({
      id: 'partner-own',
    });
    expect(locationWhere(actor('DC_ADMIN', null), query).AND).toContainEqual({ id: { in: [] } });
  });
});
