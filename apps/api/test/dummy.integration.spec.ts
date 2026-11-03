import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { dummyDataset, dummyId, seedDummyData } from '../prisma/dummy-seeder';
import { dummyItems, dummyRecipeDefinitions } from '../prisma/dummy-data';
import { AccessService } from '../src/access/access';
import { RecipesService } from '../src/recipes/recipes.service';
import type { DatabaseService } from '../src/database/database.module';

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('Dummy seeding against isolated PostgreSQL', () => {
  let db: PrismaClient;
  let actorId: string;
  let createdFixture = false;
  const itemId = randomUUID();

  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('Explicit *_test database required.');
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    // Never reuse/delete somebody else's marked dataset in a shared test DB.
    if (await db.legalEntity.findUnique({ where: { id: dummyId('entity:company') } }))
      throw new Error('Dummy test dataset already exists. Use a clean dedicated test database.');
    const admin = await db.user.create({
      data: {
        email: `dummy-${randomUUID()}@test.invalid`,
        name: 'Dummy fixture test admin',
        role: 'CENTRAL_ADMIN',
        passwordHash: 'not-a-login-password',
      },
    });
    actorId = admin.id;
    for (const unit of [
      { code: 'g', name: 'Gram', dimension: 'MASS' as const, factor: '1' },
      { code: 'kg', name: 'Kilogram', dimension: 'MASS' as const, factor: '1000' },
      { code: 'ml', name: 'Mililiter', dimension: 'VOLUME' as const, factor: '1' },
      { code: 'L', name: 'Liter', dimension: 'VOLUME' as const, factor: '1000' },
      { code: 'pcs', name: 'Buah', dimension: 'COUNT' as const, factor: '1' },
    ])
      await db.unit.upsert({ where: { code: unit.code }, create: unit, update: {} });
    const gram = await db.unit.findUniqueOrThrow({ where: { code: 'g' } });
    await db.stockItem.create({
      data: {
        id: itemId,
        code: `EXISTING-${randomUUID()}`,
        name: 'Existing user item',
        baseUnitId: gram.id,
      },
    });
  });

  afterAll(async () => {
    if (db && createdFixture) {
      // Deletes only fixture IDs recorded by this suite's dummy audit events.
      const events = await db.auditEvent.findMany({
        where: { actorId, action: 'dummy.seed_created' },
      });
      const ids = events.map((event) => event.subjectId);
      await db.recipe.deleteMany({ where: { id: { in: ids } } });
      await db.menuVariant.deleteMany({ where: { id: { in: ids } } });
      await db.menu.deleteMany({ where: { id: { in: ids } } });
      await db.stockItem.deleteMany({ where: { id: { in: ids } } });
      for (const type of ['STAND', 'DC', 'CENTER'] as const)
        await db.location.deleteMany({ where: { id: { in: ids }, type } });
      await db.legalEntity.deleteMany({ where: { id: { in: ids } } });
      await db.auditEvent.deleteMany({ where: { actorId } });
    }
    if (db && actorId) {
      await db.stockItem.deleteMany({ where: { id: itemId } });
      await db.user.deleteMany({ where: { id: actorId } });
    }
    await db?.$disconnect();
  });

  it('creates a valid marked graph, reruns without duplicates/overwrites and previews all recipes', async () => {
    const before = await db.stockItem.findUniqueOrThrow({ where: { id: itemId } });
    const result = await seedDummyData(db, actorId);
    createdFixture = true;
    expect(result).toEqual({
      dataset: dummyDataset,
      entities: 4,
      locations: 43,
      items: 14,
      menus: 1,
      variants: 6,
      recipes: 11,
      skipped: 0,
    });
    expect(await db.stockItem.findUniqueOrThrow({ where: { id: itemId } })).toEqual(before);
    const dummyItem = dummyId(`item:${dummyItems[0].key}`);
    await db.stockItem.update({
      where: { id: dummyItem },
      data: { name: 'Changed fixture name, must stay untouched' },
    });
    const recipeId = dummyId('recipe:production-10');
    await db.recipe.update({
      where: { id: recipeId },
      data: { name: 'Changed dummy recipe, must stay untouched' },
    });
    const second = await seedDummyData(db, actorId);
    expect(second).toEqual({
      dataset: dummyDataset,
      entities: 0,
      locations: 0,
      items: 0,
      menus: 0,
      variants: 0,
      recipes: 0,
      skipped: 79,
    });
    expect((await db.stockItem.findUniqueOrThrow({ where: { id: dummyItem } })).name).toBe(
      'Changed fixture name, must stay untouched',
    );
    expect((await db.recipe.findUniqueOrThrow({ where: { id: recipeId } })).name).toBe(
      'Changed dummy recipe, must stay untouched',
    );
    expect(await db.auditEvent.count({ where: { actorId, action: 'dummy.seed_created' } })).toBe(
      79,
    );
    const service = new RecipesService(db as DatabaseService, new AccessService());
    const actor = {
      id: actorId,
      name: 'Test',
      email: 'test@test.invalid',
      role: 'CENTRAL_ADMIN' as const,
      locationId: null,
      sessionId: 'test',
    };
    for (const recipe of dummyRecipeDefinitions()) {
      const detail = await service.detail(actor, dummyId(`recipe:${recipe.key}`));
      expect(detail.status).toBe('DRAFT');
      const preview = await service.preview(actor, detail.id, {
        targetQuantity: recipe.kind === 'PRODUCTION' ? '25' : '10',
        targetUnitCode: recipe.outputUnitCode,
      });
      expect(preview.planningOnly).toBe(true);
      expect(preview.components.length).toBe(recipe.components.length);
    }
    const graph = await db.location.findMany({
      where: { code: { startsWith: 'DUMMY-' } },
      include: { parent: true },
    });
    for (const row of graph) {
      if (row.type === 'CENTER') expect(row.parentId).toBeNull();
      else {
        expect(row.parent!.type).toBe(row.type === 'DC' ? 'CENTER' : 'DC');
        if (row.ownership === 'OWNED') expect(row.entityId).toBe(row.parent!.entityId);
        else expect(row.entityId).not.toBe(row.parent!.entityId);
      }
    }
  }, 30000);
});
