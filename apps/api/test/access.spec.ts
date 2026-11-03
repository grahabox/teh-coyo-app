import { ForbiddenException } from '@nestjs/common';
import { AccessService, canAccessLocation, type Actor } from '../src/access/access';

const actor = (role: Actor['role'], locationId: string | null): Actor => ({
  id: 'user',
  name: 'Test',
  email: 'test@example.test',
  role,
  locationId,
  sessionId: 'session',
});
describe('Scoped access', () => {
  const access = new AccessService();
  it('allows central and only DC own location/direct stands', () => {
    expect(
      canAccessLocation(actor('CENTRAL_ADMIN', null), { id: 'elsewhere', parentId: null }),
    ).toBe(true);
    expect(canAccessLocation(actor('DC_ADMIN', 'dc-1'), { id: 'stand-1', parentId: 'dc-1' })).toBe(
      true,
    );
    expect(canAccessLocation(actor('DC_ADMIN', 'dc-1'), { id: 'stand-2', parentId: 'dc-2' })).toBe(
      false,
    );
  });
  it('isolates cashiers and partners, including unassigned accounts', () => {
    expect(
      canAccessLocation(actor('PARTNER_ADMIN', 'stand-1'), { id: 'stand-2', parentId: 'dc-1' }),
    ).toBe(false);
    expect(canAccessLocation(actor('STAND_CASHIER', null), { id: 'stand-1', parentId: null })).toBe(
      false,
    );
  });
  it('rejects cashier recipe updates and DC writing global/other DC drafts', () => {
    expect(() => access.requireRecipeWriter(actor('STAND_CASHIER', 'stand-1'), null)).toThrow(
      ForbiddenException,
    );
    expect(() => access.requireRecipeWriter(actor('DC_ADMIN', 'dc-1'), null)).toThrow(
      ForbiddenException,
    );
    expect(() => access.requireRecipeWriter(actor('DC_ADMIN', 'dc-1'), 'dc-2')).toThrow(
      ForbiddenException,
    );
    expect(() => access.requireRecipeWriter(actor('DC_ADMIN', 'dc-1'), 'dc-1')).not.toThrow();
  });
});
