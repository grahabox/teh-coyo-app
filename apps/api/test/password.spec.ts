import { hashPassword, verifyPassword } from '../src/auth/password';

describe('Password hashing', () => {
  it('uses a random salt and validates only the correct password', async () => {
    const password = 'not-a-production-password';
    const first = await hashPassword(password);
    expect(first).not.toBe(await hashPassword(password));
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong', first)).toBe(false);
    expect(await verifyPassword(password, 'invalid')).toBe(false);
  });
});
