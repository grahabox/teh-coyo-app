import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/auth/password';
import { EnvironmentConfigurationError, readSeedEnvironment } from '../src/common/environment';

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed is forbidden in production.');
  const env = readSeedEnvironment();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    for (const unit of [
      { code: 'g', name: 'Gram', dimension: 'MASS' as const, factor: '1' },
      { code: 'kg', name: 'Kilogram', dimension: 'MASS' as const, factor: '1000' },
      { code: 'ml', name: 'Mililiter', dimension: 'VOLUME' as const, factor: '1' },
      { code: 'L', name: 'Liter', dimension: 'VOLUME' as const, factor: '1000' },
      { code: 'pcs', name: 'Buah / cup', dimension: 'COUNT' as const, factor: '1' },
    ])
      await db.unit.upsert({ where: { code: unit.code }, create: unit, update: {} });
    const entity = await db.legalEntity.upsert({
      where: { code: 'DEMO-COYO' },
      create: { code: 'DEMO-COYO', name: 'Teh Coyo (development)' },
      update: {},
    });
    const center = await db.location.upsert({
      where: { code: 'DEMO-PUSAT' },
      create: {
        code: 'DEMO-PUSAT',
        name: 'Pusat — data contoh',
        type: 'CENTER',
        entityId: entity.id,
      },
      update: {},
    });
    await db.location.upsert({
      where: { code: 'DEMO-DC' },
      create: {
        code: 'DEMO-DC',
        name: 'DC — data contoh',
        type: 'DC',
        entityId: entity.id,
        parentId: center.id,
      },
      update: {},
    });
    await db.user.upsert({
      where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
      create: {
        email: env.SEED_ADMIN_EMAIL.toLowerCase(),
        name: 'Admin development',
        passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
        role: 'CENTRAL_ADMIN',
      },
      update: {},
    });
    console.log(
      'Development units, locations and admin ready. Existing passwords were not changed. No recipes/prices/tax rates seeded.',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof EnvironmentConfigurationError
      ? error.message
      : process.env.NODE_ENV === 'production'
        ? 'Development seed dilarang pada NODE_ENV=production.'
        : 'Seed failed. Check database/configuration.',
  );
  process.exitCode = 1;
});
