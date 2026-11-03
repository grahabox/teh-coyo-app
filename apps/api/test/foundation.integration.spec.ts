import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.module';
import { hashPassword } from '../src/auth/password';

// This suite creates data ONLY in the explicit test database, never a dev/production URL.
const testUrl = process.env.TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
suite('Foundation API against real PostgreSQL', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let centralToken: string;
  let dcToken: string;
  let partnerToken: string;
  let cookie: string;
  let centerId: string;
  let dcId: string;
  let otherDcId: string;
  let standId: string;
  let otherStandId: string;
  let entityId: string;
  let partnerEntityId: string;
  let teaId: string;
  let powderId: string;
  let cupId: string;
  let variantId: string;
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const password = randomBytes(24).toString('hex');
  const origin = 'http://localhost:5173';

  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test'))
      throw new Error('TEST_DATABASE_URL must end with a dedicated _test database.');
    process.env.DATABASE_URL = testUrl;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.APP_ORIGIN = origin;
    app = await createApp();
    await app.init();
    db = app.get(DatabaseService);
    for (const unit of [
      { code: 'g', name: 'Gram', dimension: 'MASS' as const, factor: '1' },
      { code: 'ml', name: 'Mililiter', dimension: 'VOLUME' as const, factor: '1' },
      { code: 'L', name: 'Liter', dimension: 'VOLUME' as const, factor: '1000' },
      { code: 'pcs', name: 'Buah', dimension: 'COUNT' as const, factor: '1' },
    ])
      await db.unit.upsert({ where: { code: unit.code }, create: unit, update: {} });
    const entity = await db.legalEntity.create({
      data: { code: `TEST-${tag}`, name: 'Test company' },
    });
    entityId = entity.id;
    const partner = await db.legalEntity.create({
      data: { code: `PARTNER-${tag}`, name: 'Test partner' },
    });
    partnerEntityId = partner.id;
    const center = await db.location.create({
      data: { code: `CENTER-${tag}`, name: 'Test center', type: 'CENTER', entityId },
    });
    centerId = center.id;
    const dc = await db.location.create({
      data: { code: `DC-${tag}`, name: 'Test DC', type: 'DC', entityId, parentId: centerId },
    });
    dcId = dc.id;
    const otherDc = await db.location.create({
      data: { code: `DC2-${tag}`, name: 'Other DC', type: 'DC', entityId, parentId: centerId },
    });
    otherDcId = otherDc.id;
    const stand = await db.location.create({
      data: { code: `STAND-${tag}`, name: 'Test stand', type: 'STAND', entityId, parentId: dcId },
    });
    standId = stand.id;
    const otherStand = await db.location.create({
      data: {
        code: `STAND2-${tag}`,
        name: 'Other stand',
        type: 'STAND',
        entityId,
        parentId: otherDcId,
      },
    });
    otherStandId = otherStand.id;
    const partnerStand = await db.location.create({
      data: {
        code: `PARTNERSTAND-${tag}`,
        name: 'Partner stand',
        type: 'STAND',
        ownership: 'PARTNER',
        entityId: partnerEntityId,
        parentId: dcId,
      },
    });
    const hash = await hashPassword(password);
    for (const account of [
      {
        email: `central-${tag}@test.invalid`,
        name: 'Central',
        role: 'CENTRAL_ADMIN' as const,
        locationId: null,
      },
      { email: `dc-${tag}@test.invalid`, name: 'DC', role: 'DC_ADMIN' as const, locationId: dcId },
      {
        email: `partner-${tag}@test.invalid`,
        name: 'Partner',
        role: 'PARTNER_ADMIN' as const,
        locationId: partnerStand.id,
      },
    ])
      await db.user.create({
        data: { ...account, email: account.email.toLowerCase(), passwordHash: hash },
      });
    const central = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: `central-${tag}@test.invalid`, password })
      .expect(201);
    centralToken = central.body.accessToken;
    cookie = (central.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const dcLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: `dc-${tag}@test.invalid`, password })
      .expect(201);
    dcToken = dcLogin.body.accessToken;
    const partnerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: `partner-${tag}@test.invalid`, password })
      .expect(201);
    partnerToken = partnerLogin.body.accessToken;
  }, 30000);

  afterAll(async () => {
    if (db) {
      const users = await db.user.findMany({
        where: { email: { contains: tag.toLowerCase() } },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);
      await db.recipe.deleteMany({ where: { createdBy: { in: userIds } } });
      await db.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
      await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.menuVariant.deleteMany({ where: { code: { endsWith: tag } } });
      await db.menu.deleteMany({ where: { name: { endsWith: tag } } });
      await db.stockItem.deleteMany({ where: { code: { endsWith: tag } } });
      await db.location.deleteMany({
        where: { entityId: { in: [entityId, partnerEntityId] }, type: 'STAND' },
      });
      await db.location.deleteMany({ where: { entityId, type: 'DC' } });
      await db.location.deleteMany({ where: { entityId, type: 'CENTER' } });
      await db.legalEntity.deleteMany({ where: { id: { in: [entityId, partnerEntityId] } } });
    }
    await app?.close();
  });

  const post = (path: string, body: object, token = centralToken) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('enforces authentication, scoped reads and writes in the backend', async () => {
    await request(app.getHttpServer()).get('/api/v1/locations').expect(401);
    const dcLocations = await request(app.getHttpServer())
      .get('/api/v1/locations')
      .set('Authorization', `Bearer ${dcToken}`)
      .expect(200);
    expect(dcLocations.body.map((location: { id: string }) => location.id)).toContain(standId);
    expect(dcLocations.body.map((location: { id: string }) => location.id)).not.toContain(
      otherStandId,
    );
    await request(app.getHttpServer())
      .get(`/api/v1/locations/${otherStandId}`)
      .set('Authorization', `Bearer ${dcToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/locations/${standId}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(403);
    await post('entities', { code: `INVALID-${tag}`, name: 'Not allowed' }, dcToken).expect(403);
    await post('catalog/items', {}, partnerToken).expect(403);
    await post('locations', {
      code: `INVALID-${tag}`,
      name: 'Wrong parent',
      type: 'STAND',
      entityId,
      parentId: centerId,
    }).expect(400);
  });

  it('paginates and filters organization records without widening access', async () => {
    const get = (path: string, token = centralToken) =>
      request(app.getHttpServer()).get(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`);
    const query = `type=STAND&parentId=${dcId}&q=stand&perPage=1`;
    const first = await get(`locations/page?${query}&page=1`).expect(200);
    const second = await get(`locations/page?${query}&page=2`).expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.totalPages).toBe(2);
    expect(first.body.items).toHaveLength(1);
    expect(second.body.items).toHaveLength(1);
    expect(first.body.items[0].id).not.toBe(second.body.items[0].id);
    expect(first.body.items[0].parent.id).toBe(dcId);
    const own = await get(`locations/page?type=STAND&parentId=${dcId}&ownership=OWNED`).expect(200);
    expect(own.body.items.map((row: { id: string }) => row.id)).toEqual([standId]);
    const narrowed = await get(`locations/page?type=STAND&parentId=${otherDcId}`, dcToken).expect(
      200,
    );
    expect(narrowed.body.total).toBe(0);
    const partner = await get(`locations/page?type=STAND`, partnerToken).expect(200);
    expect(partner.body.items).toHaveLength(1);
    expect(partner.body.items[0].ownership).toBe('PARTNER');
    const detail = await get(`locations/${dcId}/detail`, dcToken).expect(200);
    expect(detail.body._count.children).toBe(2);
    await get(`locations/${otherDcId}/detail`, dcToken).expect(403);
    await get(`locations/${dcId}/detail`, partnerToken).expect(403);
    const owners = await get(`entities/page?q=${tag}&excludeEntityId=${entityId}`).expect(200);
    expect(owners.body.items.map((owner: { id: string }) => owner.id)).toEqual([partnerEntityId]);
    await get('entities/page', dcToken).expect(403);
    await get('locations/page?perPage=1000').expect(400);
    await get('locations/page?parentId=invalid').expect(400);
    const duplicate = await post('locations', {
      code: `DC-${tag}`,
      name: 'Duplicate DC',
      type: 'DC',
      entityId,
      parentId: centerId,
    }).expect(409);
    expect(duplicate.body.issues[0].field).toBe('code');
    const sameOwnerPartner = await post('locations', {
      code: `INVALIDPARTNER-${tag}`,
      name: 'Invalid partner',
      type: 'STAND',
      ownership: 'PARTNER',
      entityId,
      parentId: dcId,
    }).expect(400);
    expect(sameOwnerPartner.body.issues[0].field).toBe('entityId');
    // Search/count must operate on the database, not a legacy first-500 array.
    await db.location.createMany({
      data: Array.from({ length: 505 }, (_, index) => ({
        code: `SCALE-${String(index).padStart(3, '0')}-${tag}`,
        name: `Scale stand ${String(index).padStart(3, '0')} ${tag}`,
        type: 'STAND' as const,
        entityId,
        parentId: dcId,
      })),
    });
    const scalePage = await get(
      `locations/page?type=STAND&parentId=${dcId}&q=SCALE-&perPage=25&page=21`,
      dcToken,
    ).expect(200);
    expect(scalePage.body.total).toBe(505);
    expect(scalePage.body.items).toHaveLength(5);
    const beyond500 = await get(
      `locations/page?type=STAND&parentId=${dcId}&q=SCALE-504-${tag}`,
      dcToken,
    ).expect(200);
    expect(beyond500.body.total).toBe(1);
    expect(beyond500.body.items[0].code).toBe(`SCALE-504-${tag}`);
  });

  it('creates catalog and immutable draft recipes, previews without inventory changes', async () => {
    const units = await request(app.getHttpServer())
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${centralToken}`)
      .expect(200);
    const unitId = (code: string) =>
      units.body.units.find((unit: { code: string }) => unit.code === code).id;
    teaId = (
      await post('catalog/items', {
        code: `TEA-${tag}`,
        name: 'Tea base',
        baseUnitId: unitId('ml'),
      }).expect(201)
    ).body.id;
    powderId = (
      await post('catalog/items', {
        code: `POWDER-${tag}`,
        name: 'Powder',
        baseUnitId: unitId('g'),
      }).expect(201)
    ).body.id;
    cupId = (
      await post('catalog/items', {
        code: `CUP-${tag}`,
        name: 'Empty cup',
        baseUnitId: unitId('pcs'),
      }).expect(201)
    ).body.id;
    const menu = await post('catalog/menus', { name: `Test menu ${tag}` }).expect(201);
    variantId = (
      await post('catalog/variants', {
        code: `CHOC-${tag}`,
        name: 'Chocolate',
        menuId: menu.body.id,
      }).expect(201)
    ).body.id;
    const duplicateItem = await post('catalog/items', {
      code: `TEA-${tag}`,
      name: 'Duplicate item',
      baseUnitId: unitId('ml'),
    }).expect(409);
    expect(duplicateItem.body.issues[0].field).toBe('code');
    const duplicateGroup = await post('catalog/menus', { name: `Test menu ${tag}` }).expect(409);
    expect(duplicateGroup.body.issues[0].field).toBe('name');
    const duplicateVariantCode = await post('catalog/variants', {
      code: `CHOC-${tag}`,
      name: 'Other chocolate',
      menuId: menu.body.id,
    }).expect(409);
    expect(duplicateVariantCode.body.issues[0].field).toBe('code');
    const duplicateVariantName = await post('catalog/variants', {
      code: `CHOC2-${tag}`,
      name: 'Chocolate',
      menuId: menu.body.id,
    }).expect(409);
    expect(duplicateVariantName.body.issues[0].field).toBe('name');
    const wrongUnit = await post('catalog/items', {
      code: `WRONGUNIT-${tag}`,
      name: 'Invalid base unit',
      baseUnitId: unitId('L'),
    }).expect(400);
    expect(wrongUnit.body.issues[0].field).toBe('baseUnitId');
    const body = {
      name: 'Serving test',
      kind: 'SERVING',
      menuVariantId: variantId,
      outputQuantity: '1',
      outputUnitCode: 'pcs',
      components: [
        { stockItemId: teaId, quantity: '100', unitCode: 'ml' },
        { stockItemId: powderId, quantity: '10', unitCode: 'g' },
        { stockItemId: cupId, quantity: '1', unitCode: 'pcs' },
      ],
    };
    const recipe = await post('recipes', body).expect(201);
    expect(recipe.body.status).toBe('DRAFT');
    const get = (path: string, token = centralToken) =>
      request(app.getHttpServer()).get(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`);
    const detail = await get(`recipes/${recipe.body.id}/detail`).expect(200);
    expect(detail.body.components).toHaveLength(3);
    expect(detail.body.menuVariant.menu.name).toBe(`Test menu ${tag}`);
    await get(`recipes/${recipe.body.id}/detail`, dcToken).expect(403);
    await get(`recipes/${recipe.body.id}/detail`, partnerToken).expect(403);
    const emptyPartnerPage = await get('recipes/page?kind=SERVING', partnerToken).expect(200);
    expect(emptyPartnerPage.body.total).toBe(0);
    await get('recipes/page?perPage=500').expect(400);
    const variantsPage = await get(`catalog/variants/page?q=CHOC-${tag}`).expect(200);
    expect(variantsPage.body.items[0].id).toBe(variantId);
    const itemsPage = await get(`catalog/items/page?q=TEA-${tag}`).expect(200);
    expect(itemsPage.body.items[0].baseUnit.code).toBe('ml');
    const result = await post(`recipes/${recipe.body.id}/preview`, {
      targetQuantity: '2',
      targetUnitCode: 'pcs',
    }).expect(201);
    expect(result.body.planningOnly).toBe(true);
    expect(result.body.components.map((line: { quantity: string }) => line.quantity)).toEqual([
      '200',
      '20',
      '2',
    ]);
    expect(
      await db.auditEvent.count({
        where: { subjectId: recipe.body.id, action: 'recipe.draft_created' },
      }),
    ).toBe(1);
    await post(
      `recipes/${recipe.body.id}/preview`,
      { targetQuantity: '2', targetUnitCode: 'pcs' },
      dcToken,
    ).expect(403);
    const local = await post('recipes', { ...body, scopeLocationId: dcId }, dcToken).expect(201);
    const localDetail = await get(`recipes/${local.body.id}/detail`, dcToken).expect(200);
    expect(localDetail.body.scopeLocation.id).toBe(dcId);
    const localPage = await get('recipes/page?kind=SERVING&q=Serving', dcToken).expect(200);
    expect(localPage.body.items.map((row: { id: string }) => row.id)).toEqual([local.body.id]);
    const dcDrafts = await request(app.getHttpServer())
      .get('/api/v1/recipes')
      .set('Authorization', `Bearer ${dcToken}`)
      .expect(200);
    expect(dcDrafts.body.map((draft: { id: string }) => draft.id)).toContain(local.body.id);
    expect(dcDrafts.body.map((draft: { id: string }) => draft.id)).not.toContain(recipe.body.id);
    const production = await post('recipes', {
      name: 'Production test',
      kind: 'PRODUCTION',
      outputItemId: teaId,
      outputQuantity: '10',
      outputUnitCode: 'L',
      components: [{ stockItemId: powderId, quantity: '100', unitCode: 'g' }],
    }).expect(201);
    const scaled = await post(`recipes/${production.body.id}/preview`, {
      targetQuantity: '25',
      targetUnitCode: 'L',
    }).expect(201);
    expect(scaled.body.components[0].quantity).toBe('250');
    const original = await post('recipes', {
      ...body,
      name: 'Original fixture',
      components: [
        { stockItemId: teaId, quantity: '150', unitCode: 'ml' },
        { stockItemId: cupId, quantity: '1', unitCode: 'pcs' },
      ],
    }).expect(201);
    const originalPreview = await post(`recipes/${original.body.id}/preview`, {
      targetQuantity: '3',
      targetUnitCode: 'pcs',
    }).expect(201);
    expect(
      originalPreview.body.components.map((line: { quantity: string }) => line.quantity),
    ).toEqual(['450', '3']);
    const incompatible = await post('recipes', {
      ...body,
      components: [{ stockItemId: powderId, quantity: '10', unitCode: 'ml' }],
    }).expect(400);
    expect(incompatible.body.issues[0].field).toBe('components.0.unitCode');
    const zero = await post('recipes', {
      ...body,
      components: [{ stockItemId: teaId, quantity: '0', unitCode: 'ml' }],
    }).expect(400);
    expect(zero.body.issues[0].field).toBe('components.0.quantity');
    const duplicateIngredient = await post('recipes', {
      ...body,
      components: [body.components[0], body.components[0]],
    }).expect(400);
    expect(duplicateIngredient.body.issues[0].field).toBe('components.1.stockItemId');
    const globalPage = await get('recipes/page?kind=SERVING&q=Serving&perPage=1&page=2').expect(
      200,
    );
    expect(globalPage.body.total).toBe(2);
    expect(globalPage.body.items).toHaveLength(1);
    expect(globalPage.body.items[0]._count.components).toBe(3);
    await post('recipes', { ...body, scopeLocationId: otherDcId }, dcToken).expect(403);
    await post('recipes', body, partnerToken).expect(403);
    await post(`recipes/${recipe.body.id}/preview`, {
      targetQuantity: '0',
      targetUnitCode: 'pcs',
    }).expect(400);
    const incomplete = await post('recipes', { ...body, components: [] }).expect(201);
    await post(`recipes/${incomplete.body.id}/preview`, {
      targetQuantity: '1',
      targetUnitCode: 'pcs',
    }).expect(400);
  });

  it('documents endpoints and rotates/revokes refresh sessions with origin protection', async () => {
    const openapi = await request(app.getHttpServer()).get('/api/openapi.json').expect(200);
    expect(openapi.body.paths['/api/v1/recipes/{id}/preview']).toBeDefined();
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.invalid')
      .set('Cookie', cookie)
      .expect(403);
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(201);
    expect(refreshed.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(refreshed.headers['set-cookie'][0]).toContain('SameSite=Strict');
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(401);
    const nextCookie = (refreshed.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', nextCookie)
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(401);
  });
});
