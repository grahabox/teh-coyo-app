import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { hashPassword } from '../src/auth/password';
import type { Actor } from '../src/access/access';

const testUrl = process.env.TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
suite('Stock foundation against dedicated PostgreSQL test database', () => {
  let app: INestApplication, db: DatabaseService, service: InventoryService;
  let center: string, dc: string, stand: string, otherDc: string, entity: string;
  let item: string, second: string;
  let actor: Actor, dcActor: Actor, standActor: Actor;
  let centralToken: string, dcToken: string, standToken: string;
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const date = '2026-01-01';
  const later = '2026-01-02';
  const users: string[] = [];
  const password = randomBytes(24).toString('hex');
  const payload = (kind: string, locationId: string, quantity: string, extra = {}) => ({
    id: randomUUID(),
    kind,
    locationId,
    businessDate: date,
    reference: `INV-${tag}-${randomUUID().slice(0, 8)}`,
    reason: 'TEST ONLY verified count',
    lines: [{ stockItemId: item, quantity }],
    ...extra,
  });
  const post = async (data: ReturnType<typeof payload>) => {
    const doc = await service.create(actor, data);
    return service.post(actor, doc.id, data.kind === 'TRANSFER' ? 'ship' : 'post');
  };
  const balance = async (locationId: string, stockItemId = item) =>
    (
      await db.stockBalance.findUnique({
        where: { locationId_stockItemId: { locationId, stockItemId } },
      })
    )?.quantity.toString();
  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test'))
      throw new Error('A dedicated _test database is mandatory.');
    process.env.DATABASE_URL = testUrl;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.APP_ORIGIN = 'http://localhost:5173';
    app = await createApp();
    await app.init();
    db = app.get(DatabaseService);
    service = app.get(InventoryService);
    const unit = await db.unit.upsert({
      where: { code: 'pcs' },
      create: { code: 'pcs', name: 'Buah', dimension: 'COUNT', factor: '1' },
      update: {},
    });
    entity = (
      await db.legalEntity.create({ data: { code: `INV-${tag}`, name: 'Inventory TEST company' } })
    ).id;
    center = (
      await db.location.create({
        data: { code: `INV-C-${tag}`, name: 'TEST center', type: 'CENTER', entityId: entity },
      })
    ).id;
    dc = (
      await db.location.create({
        data: {
          code: `INV-D-${tag}`,
          name: 'TEST DC',
          type: 'DC',
          entityId: entity,
          parentId: center,
        },
      })
    ).id;
    otherDc = (
      await db.location.create({
        data: {
          code: `INV-D2-${tag}`,
          name: 'TEST other DC',
          type: 'DC',
          entityId: entity,
          parentId: center,
        },
      })
    ).id;
    stand = (
      await db.location.create({
        data: {
          code: `INV-S-${tag}`,
          name: 'TEST stand',
          type: 'STAND',
          entityId: entity,
          parentId: dc,
        },
      })
    ).id;
    item = (
      await db.stockItem.create({
        data: { code: `INV-I-${tag}`, name: 'TEST item', baseUnitId: unit.id },
      })
    ).id;
    second = (
      await db.stockItem.create({
        data: { code: `INV-I2-${tag}`, name: 'TEST second', baseUnitId: unit.id },
      })
    ).id;
    const passwordHash = await hashPassword(password);
    for (const [role, locationId] of [
      ['CENTRAL_ADMIN', null],
      ['DC_ADMIN', dc],
      ['STAND_CASHIER', stand],
    ] as const) {
      const user = await db.user.create({
        data: {
          name: role,
          email: `${role.toLowerCase()}-${tag.toLowerCase()}@test.invalid`,
          role,
          locationId,
          passwordHash,
        },
      });
      users.push(user.id);
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({ email: user.email, password })
        .expect(201);
      const a: Actor = {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        locationId,
        sessionId: randomUUID(),
      };
      if (role === 'CENTRAL_ADMIN') {
        actor = a;
        centralToken = login.body.accessToken;
      } else if (role === 'DC_ADMIN') {
        dcActor = a;
        dcToken = login.body.accessToken;
      } else {
        standActor = a;
        standToken = login.body.accessToken;
      }
    }
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    // Immutable history cannot be deleted row-by-row. Reset ONLY inventory tables in
    // the explicit _test database; integration tests run serially, not on dev data.
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test'))
      throw new Error('Unsafe cleanup URL.');
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE "PurchaseReceipt", "StockMovement", "StockReceiptEvent", "StockDocumentLine", "StockDocument", "StockBalance"',
    );
    await db.auditEvent.deleteMany({ where: { actorId: { in: users } } });
    await db.authSession.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.stockItem.deleteMany({ where: { id: { in: [item, second] } } });
    await db.location.deleteMany({ where: { id: stand } });
    await db.location.deleteMany({ where: { id: { in: [dc, otherDc] } } });
    await db.location.deleteMany({ where: { id: center } });
    await db.legalEntity.delete({ where: { id: entity } });
    await app.close();
  });

  it('shows missing balances as null; draft has no movement; opening explicitly accepts zero', async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/inventory/balances?locationId=${center}&stockItemId=${item}`)
      .auth(centralToken, { type: 'bearer' })
      .expect(200);
    expect(before.body.items[0].quantity).toBeNull();
    const input = payload('OPENING', center, '100');
    const created = await request(app.getHttpServer())
      .post('/api/v1/inventory/documents')
      .auth(centralToken, { type: 'bearer' })
      .send(input)
      .expect(201);
    expect(await balance(center)).toBeUndefined();
    expect(await db.stockMovement.count()).toBe(0);
    await service.post(actor, created.body.id, 'post');
    await post(payload('OPENING', dc, '0'));
    await post(payload('OPENING', stand, '0'));
    expect(await balance(center)).toBe('100');
    expect(await balance(dc)).toBe('0');
  });
  it('uses idempotent creation and confirmation, rejects changed content and second opening', async () => {
    const input = payload('RECEIPT', center, '0.1', { supplierName: 'TEST Supplier' });
    const doc = await service.create(actor, input);
    expect((await service.create(actor, input)).id).toBe(doc.id);
    await expect(
      service.create(actor, { ...input, reason: 'Changed content' }),
    ).rejects.toMatchObject({ status: 409 });
    await Promise.all([service.post(actor, doc.id, 'post'), service.post(actor, doc.id, 'post')]);
    expect(await balance(center)).toBe('100.1');
    expect(await db.stockMovement.count({ where: { line: { documentId: doc.id } } })).toBe(1);
    await expect(post(payload('OPENING', center, '10'))).rejects.toMatchObject({ status: 400 });
    await expect(service.create(dcActor, payload('ADJUSTMENT', dc, '1'))).rejects.toMatchObject({
      status: 403,
    });
  });
  it('ships 20, receives actual 18, holds 2 in transit and retries receipt without doubling', async () => {
    const doc = await post(payload('TRANSFER', center, '20', { destinationId: dc }));
    expect(await balance(center)).toBe('80.1');
    expect(await balance(dc)).toBe('0');
    const body = {
      id: randomUUID(),
      businessDate: date,
      note: 'TEST received 18, short 2',
      lines: [{ lineId: doc.lines[0].id, quantity: '18' }],
    };
    const response = await request(app.getHttpServer())
      .post(`/api/v1/inventory/documents/${doc.id}/receive`)
      .auth(dcToken, { type: 'bearer' })
      .send(body)
      .expect(201);
    expect(response.body.lines[0].receivedQuantity).toBe('18');
    const received = await service.detail(dcActor, doc.id);
    expect(received.status).toBe('SHIPPED');
    expect(received.lines[0].receivedQuantity.toString()).toBe('18');
    await service.receive(dcActor, doc.id, body);
    expect(await balance(dc)).toBe('18');
    await expect(
      service.receive(dcActor, doc.id, { ...body, note: 'Changed content' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.receive(dcActor, doc.id, {
        ...body,
        id: randomUUID(),
        lines: [{ lineId: doc.lines[0].id, quantity: '3' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await balance(dc)).toBe('18');
    const complete = await service.receive(dcActor, doc.id, {
      ...body,
      id: randomUUID(),
      lines: [{ lineId: doc.lines[0].id, quantity: '2' }],
    });
    expect(complete.status).toBe('RECEIVED');
    expect(await balance(dc)).toBe('20');
  });
  it('rejects insufficient stock atomically across lines and concurrent overspending', async () => {
    const bad = await service.create(
      actor,
      payload('TRANSFER', center, '1', {
        destinationId: dc,
        lines: [
          { stockItemId: item, quantity: '1' },
          { stockItemId: second, quantity: '1' },
        ],
      }),
    );
    await expect(service.post(actor, bad.id, 'ship')).rejects.toMatchObject({ status: 400 });
    expect(await balance(center)).toBe('80.1');
    expect((await service.detail(actor, bad.id)).status).toBe('DRAFT');
    const a = await service.create(actor, payload('TRANSFER', center, '50', { destinationId: dc }));
    const b = await service.create(actor, payload('TRANSFER', center, '50', { destinationId: dc }));
    const result = await Promise.allSettled([
      service.post(actor, a.id, 'ship'),
      service.post(actor, b.id, 'ship'),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(center)).toBe('30.1');
  });
  it('enforces source/destination roles, hides incoming drafts and prevents cross-DC access', async () => {
    const doc = await service.create(
      dcActor,
      payload('TRANSFER', dc, '1', { destinationId: stand }),
    );
    await request(app.getHttpServer())
      .get(`/api/v1/inventory/documents/${doc.id}`)
      .auth(standToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/inventory/balances?locationId=${otherDc}`)
      .auth(dcToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/inventory/documents')
      .auth(standToken, { type: 'bearer' })
      .send(payload('RECEIPT', stand, '1', { supplierName: 'Test' }))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/documents/${doc.id}/ship`)
      .auth(dcToken, { type: 'bearer' })
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/inventory/documents/${doc.id}`)
      .auth(standToken, { type: 'bearer' })
      .expect(200);
    const body = {
      id: randomUUID(),
      businessDate: date,
      note: 'TEST count',
      lines: [{ lineId: doc.lines[0].id, quantity: '1' }],
    };
    await expect(service.receive(dcActor, doc.id, body)).rejects.toMatchObject({ status: 403 });
    await service.receive(standActor, doc.id, body);
    expect(await balance(stand)).toBe('1');
    await expect(
      service.create(dcActor, payload('TRANSFER', dc, '1', { destinationId: otherDc })),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('uses exact decimals, prevents backdating/future posting and requires initialized destinations', async () => {
    await post(payload('ADJUSTMENT', center, '-0.1', { businessDate: later }));
    expect(await balance(center)).toBe('30');
    await expect(
      post(payload('RECEIPT', center, '1', { supplierName: 'Test', businessDate: date })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.create(actor, payload('OPENING', otherDc, '0', { businessDate: '2099-01-01' })),
    ).rejects.toMatchObject({ status: 400 });
    const doc = await post(
      payload('TRANSFER', center, '1', { businessDate: later, destinationId: otherDc }),
    );
    const body = {
      id: randomUUID(),
      businessDate: later,
      note: 'TEST destination not initialized',
      lines: [{ lineId: doc.lines[0].id, quantity: '1' }],
    };
    await expect(service.receive(actor, doc.id, body)).rejects.toMatchObject({ status: 400 });
    expect(await balance(otherDc)).toBeUndefined();
    expect((await service.detail(actor, doc.id)).receipts).toHaveLength(0);
    await post(payload('OPENING', otherDc, '0'));
    await service.receive(actor, doc.id, body);
    expect(await balance(otherDc)).toBe('1');
  });
  it('retains audit and append-only movements, lists server-paged scoped records and reconciles totals', async () => {
    const movements = await service.movements(actor, {
      locationId: center,
      stockItemId: item,
      perPage: '2',
      page: '1',
    });
    expect(movements.items).toHaveLength(2);
    expect(movements.total).toBeGreaterThan(2);
    expect(
      await db.auditEvent.count({ where: { actorId: actor.id, action: 'stock.post' } }),
    ).toBeGreaterThan(0);
    const movement = await db.stockMovement.findFirstOrThrow({ where: { locationId: center } });
    await expect(
      db.stockMovement.update({ where: { id: movement.id }, data: { quantity: '999' } }),
    ).rejects.toThrow();
    for (const locationId of [center, dc, stand, otherDc]) {
      const aggregate = await db.stockMovement.aggregate({
        where: { locationId, stockItemId: item },
        _sum: { quantity: true },
      });
      expect(aggregate._sum.quantity?.toString()).toBe(await balance(locationId));
    }
    await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?locationId=${center}`)
      .expect(401);
    const docs = await service.documents(dcActor, { locationId: dc, perPage: '2' });
    expect(docs.items).toHaveLength(2);
    expect(docs.total).toBeGreaterThan(2);
  });
});
