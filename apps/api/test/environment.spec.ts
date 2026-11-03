import {
  EnvironmentConfigurationError,
  readDatabaseUrl,
  readSeedEnvironment,
} from '../src/common/environment';

describe('Environment configuration diagnostics', () => {
  it('fails fast on a missing database URL instead of returning a dummy connection', () => {
    expect(() => readDatabaseUrl({})).toThrow(EnvironmentConfigurationError);
    expect(() => readDatabaseUrl({})).toThrow('DATABASE_URL');
    expect(() => readDatabaseUrl({})).toThrow('apps/api/.env');
    expect(() => readDatabaseUrl({ DATABASE_URL: '' })).toThrow(EnvironmentConfigurationError);
  });

  it('reports each missing seed variable without requiring unrelated API settings', () => {
    let error: unknown;
    try {
      readSeedEnvironment({});
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EnvironmentConfigurationError);
    const message = (error as Error).message;
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('SEED_ADMIN_EMAIL');
    expect(message).toContain('SEED_ADMIN_PASSWORD');
    expect(message).not.toContain('JWT_SECRET');
  });

  it('validates database URL shape without leaking invalid URL/password values', () => {
    const invalidUrl = 'mysql://secret-user:secret-db-password@localhost:3306/private_db';
    const secretPassword = 'shortsecret';
    let error: unknown;
    try {
      readSeedEnvironment({
        DATABASE_URL: invalidUrl,
        SEED_ADMIN_EMAIL: 'invalid-private-email',
        SEED_ADMIN_PASSWORD: secretPassword,
      });
    } catch (caught) {
      error = caught;
    }
    const message = (error as Error).message;
    expect(message).not.toContain(invalidUrl);
    expect(message).not.toContain('secret-db-password');
    expect(message).not.toContain('invalid-private-email');
    expect(message).not.toContain(secretPassword);
    expect(message).toContain('Password admin minimal 12 karakter.');
    expect(() => readDatabaseUrl({ DATABASE_URL: 'postgresql://localhost/' })).toThrow();
  });

  it('accepts PostgreSQL URLs and a complete opt-in seed environment', () => {
    const env = {
      DATABASE_URL: 'postgresql://user:encoded%40password@localhost:5432/coyo_test',
      SEED_ADMIN_EMAIL: 'admin@example.test',
      SEED_ADMIN_PASSWORD: 'test-password-at-least-12',
    };
    expect(readDatabaseUrl(env)).toBe(env.DATABASE_URL);
    expect(readSeedEnvironment(env)).toEqual(env);
  });
});
