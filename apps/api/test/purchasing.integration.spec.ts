import 'reflect-metadata';
import { randomUUID, randomBytes } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.module';
import { ProcurementService } from '../src/procurement/procurement.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { hashPassword } from '../src/auth/password';
import type { Actor } from '../src/access/access';

const testUrl = process.env.TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
suite('Purchasing on explicit disposable PostgreSQL _test database', () => {
  let app: INestApplication,
    db: DatabaseService,
    purchase: ProcurementService,
    stock: InventoryService;
  let actor: Actor, dcActor: Actor, partnerActor: Actor;
  let token: string, dcToken: string, partnerToken: string;
  let entity: string,
    partnerEntity: string,
    center: string,
    dc: string,
    dc2: string,
    partnerStand: string,
    item: string,
    second: string,
    supplier: string;
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const users: string[] = [];
  const password = randomBytes(24).toString('hex');
  const date = '2026-01-01';
  const invoice = (extra = {}) => ({
    id: randomUUID(),
    locationId: center,
    supplierId: supplier,
    invoiceReference: `BILL-${tag}-${randomUUID().slice(0, 8)}`,
    businessDate: date,
    note: 'TEST supplier invoice',
    lines: [{ stockItemId: item, quantity: '10', unitPrice: '5000' }],
    ...extra,
  });
  const received = (
    p: Awaited<ReturnType<ProcurementService['detail']>>,
    quantity: string,
    extra = {},
  ) => ({
    id: randomUUID(),
    businessDate: date,
    reference: `GR-${randomUUID()}`,
    note: 'TEST actual count',
    lines: [{ lineId: p.lines[0].id, quantity }],
    ...extra,
  });
  const paid = (amount: string, extra = {}) => ({
    id: randomUUID(),
    businessDate: date,
    amount,
    method: 'CASH',
    fundingSource: 'TEST drawer',
    reference: `PAY-${randomUUID()}`,
    note: 'TEST declared payment',
    ...extra,
  });
  const balance = async (locationId = center) =>
    (
      await db.stockBalance.findUnique({
        where: { locationId_stockItemId: { locationId, stockItemId: item } },
      })
    )?.quantity.toString();
  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test'))
      throw new Error('Unsafe test database.');
    process.env.DATABASE_URL = testUrl;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.APP_ORIGIN = 'http://localhost:5173';
    app = await createApp();
    await app.init();
    db = app.get(DatabaseService);
    purchase = app.get(ProcurementService);
    stock = app.get(InventoryService);
    const unit = await db.unit.upsert({
      where: { code: 'pcs' },
      create: { code: 'pcs', name: 'Buah', dimension: 'COUNT', factor: '1' },
      update: {},
    });
    entity = (
      await db.legalEntity.create({ data: { code: `BUY-E-${tag}`, name: 'TEST purchaser' } })
    ).id;
    partnerEntity = (
      await db.legalEntity.create({ data: { code: `BUY-PE-${tag}`, name: 'TEST partner' } })
    ).id;
    center = (
      await db.location.create({
        data: { code: `BUY-C-${tag}`, name: 'TEST center', type: 'CENTER', entityId: entity },
      })
    ).id;
    dc = (
      await db.location.create({
        data: {
          code: `BUY-D-${tag}`,
          name: 'TEST DC',
          type: 'DC',
          parentId: center,
          entityId: entity,
        },
      })
    ).id;
    dc2 = (
      await db.location.create({
        data: {
          code: `BUY-D2-${tag}`,
          name: 'TEST other DC',
          type: 'DC',
          parentId: center,
          entityId: entity,
        },
      })
    ).id;
    partnerStand = (
      await db.location.create({
        data: {
          code: `BUY-S-${tag}`,
          name: 'TEST partner stand',
          type: 'STAND',
          parentId: dc,
          entityId: partnerEntity,
          ownership: 'PARTNER',
        },
      })
    ).id;
    item = (
      await db.stockItem.create({
        data: { code: `BUY-I-${tag}`, name: 'TEST item', baseUnitId: unit.id },
      })
    ).id;
    second = (
      await db.stockItem.create({
        data: { code: `BUY-I2-${tag}`, name: 'TEST second item', baseUnitId: unit.id },
      })
    ).id;
    const passwordHash = await hashPassword(password);
    for (const [role, locationId] of [
      ['CENTRAL_ADMIN', null],
      ['DC_ADMIN', dc],
      ['PARTNER_ADMIN', partnerStand],
    ] as const) {
      const user = await db.user.create({
        data: {
          email: `buy-${role.toLowerCase()}-${tag.toLowerCase()}@test.invalid`,
          name: role,
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
        token = login.body.accessToken;
      } else if (role === 'DC_ADMIN') {
        dcActor = a;
        dcToken = login.body.accessToken;
      } else {
        partnerActor = a;
        partnerToken = login.body.accessToken;
      }
    }
    supplier = (
      await purchase.createSupplier(actor, {
        id: randomUUID(),
        code: `SUP.${tag}`,
        name: 'TEST Supplier',
      })
    ).id;
    for (const locationId of [center, dc]) {
      const doc = await stock.create(actor, {
        id: randomUUID(),
        kind: 'OPENING',
        locationId,
        businessDate: date,
        reference: `START-${tag}`,
        reason: 'TEST verified zero',
        lines: [{ stockItemId: item, quantity: '0' }],
      });
      await stock.post(actor, doc.id, 'post');
    }
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test'))
      throw new Error('Unsafe cleanup.');
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE "PurchasePayment", "PurchaseReceipt", "PurchaseLine", "Purchase", "StockMovement", "StockReceiptEvent", "StockDocumentLine", "StockDocument", "StockBalance"',
    );
    await db.supplier.deleteMany({ where: { id: supplier } });
    await db.auditEvent.deleteMany({ where: { actorId: { in: users } } });
    await db.authSession.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.stockItem.deleteMany({ where: { id: { in: [item, second] } } });
    await db.location.deleteMany({ where: { id: partnerStand } });
    await db.location.deleteMany({ where: { id: { in: [dc, dc2] } } });
    await db.location.deleteMany({ where: { id: center } });
    await db.legalEntity.deleteMany({ where: { id: { in: [entity, partnerEntity] } } });
    await app.close();
  });
  it('creates supplier/invoice draft idempotently, confirms without stock or payments and rejects duplicate supplier invoice across own locations', async () => {
    const body = invoice();
    const response = await request(app.getHttpServer())
      .post('/api/v1/purchasing/invoices')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(201);
    expect(response.body.totalAmount).toBe('50000');
    expect(response.body.status).toBe('DRAFT');
    expect(await balance()).toBe('0');
    expect((await purchase.create(actor, body)).id).toBe(body.id);
    await expect(purchase.create(actor, { ...body, note: 'Changed note' })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      purchase.create(actor, {
        ...body,
        id: randomUUID(),
        locationId: dc,
        invoiceReference: body.invoiceReference.toLowerCase(),
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(purchase.pay(actor, body.id, paid('100'))).rejects.toMatchObject({ status: 400 });
    await request(app.getHttpServer())
      .post(`/api/v1/purchasing/invoices/${body.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const p = await purchase.confirm(actor, body.id);
    expect(p.status).toBe('CONFIRMED');
    expect(p.outstandingAmount).toBe('50000');
    expect(p.payments).toHaveLength(0);
    expect(await balance()).toBe('0');
  });
  it('receives 8/10 then 2, uses one shared ledger, safely retries and rejects excess and reused receiving proof', async () => {
    const p = await purchase.create(actor, invoice());
    await purchase.confirm(actor, p.id);
    const body = received(p, '8');
    const response = await request(app.getHttpServer())
      .post(`/api/v1/purchasing/invoices/${p.id}/receive`)
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(201);
    expect(response.body.receiptStatus).toBe('PARTIAL');
    expect(await balance()).toBe('8');
    await purchase.receive(actor, p.id, body);
    expect(await balance()).toBe('8');
    await expect(
      purchase.receive(actor, p.id, { ...body, note: 'Different request' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      purchase.receive(actor, p.id, { ...body, id: randomUUID() }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(purchase.receive(actor, p.id, received(p, '3'))).rejects.toMatchObject({
      status: 400,
    });
    const final = await purchase.receive(actor, p.id, received(p, '2'));
    expect(final.receiptStatus).toBe('COMPLETE');
    expect(await balance()).toBe('10');
    expect(final.payments).toHaveLength(0);
    const ids = final.receipts.map((r) => r.stockDocumentId);
    expect(await db.stockMovement.count({ where: { line: { documentId: { in: ids } } } })).toBe(2);
  });
  it('links existing posted stock receipt once without new movement and prevents another invoice from claiming it', async () => {
    const stockDoc = await stock.create(actor, {
      id: randomUUID(),
      kind: 'RECEIPT',
      locationId: center,
      businessDate: date,
      reference: 'EXISTING-TEST',
      reason: 'TEST receiving before entering invoice',
      supplierName: 'TEST Supplier',
      lines: [{ stockItemId: item, quantity: '3' }],
    });
    await stock.post(actor, stockDoc.id, 'post');
    const p = await purchase.create(
      actor,
      invoice({ lines: [{ stockItemId: item, quantity: '3', unitPrice: '1000' }] }),
    );
    await purchase.confirm(actor, p.id);
    const before = await balance();
    const moves = await db.stockMovement.count();
    await expect(
      purchase.receive(actor, p.id, received(p, '3', { reference: 'existing-test' })),
    ).rejects.toMatchObject({ status: 400 });
    expect(await balance()).toBe(before);
    const options = await purchase.receiptOptions(actor, p.id, { q: 'EXISTING' });
    expect(options.items.some((v) => v.id === stockDoc.id)).toBe(true);
    const body = {
      id: randomUUID(),
      stockDocumentId: stockDoc.id,
      note: 'TEST same delivery evidence',
    };
    const linked = await purchase.linkReceipt(actor, p.id, body);
    expect(linked.receiptStatus).toBe('COMPLETE');
    expect(linked.receipts[0].linkedExisting).toBe(true);
    await purchase.linkReceipt(actor, p.id, body);
    expect(await balance()).toBe(before);
    expect(await db.stockMovement.count()).toBe(moves);
    const secondInvoice = await purchase.create(actor, invoice());
    await purchase.confirm(actor, secondInvoice.id);
    await expect(
      purchase.linkReceipt(actor, secondInvoice.id, { ...body, id: randomUUID() }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('records partial payments independent of receiving, retry is safe, overpayment and concurrent overspending are rejected', async () => {
    const p = await purchase.create(actor, invoice());
    await purchase.confirm(actor, p.id);
    const body = paid('20000');
    const first = await purchase.pay(actor, p.id, body);
    expect(first.outstandingAmount).toBe('30000');
    expect(first.receiptStatus).toBe('NONE');
    await purchase.pay(actor, p.id, body);
    expect((await purchase.detail(actor, p.id)).paidAmount.toString()).toBe('20000');
    await expect(purchase.pay(actor, p.id, { ...body, amount: '10000' })).rejects.toMatchObject({
      status: 409,
    });
    await expect(purchase.pay(actor, p.id, { ...body, id: randomUUID() })).rejects.toMatchObject({
      status: 400,
    });
    const race = await Promise.allSettled([
      purchase.pay(actor, p.id, paid('20000')),
      purchase.pay(actor, p.id, paid('20000')),
    ]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(purchase.pay(actor, p.id, paid('10001'))).rejects.toMatchObject({ status: 400 });
    const final = await purchase.pay(actor, p.id, paid('10000'));
    expect(final.paymentStatus).toBe('PAID');
    expect(final.outstandingAmount).toBe('0');
    expect(final.receiptStatus).toBe('NONE');
    const payment = await db.purchasePayment.findFirstOrThrow({ where: { purchaseId: p.id } });
    await expect(
      db.purchasePayment.update({ where: { id: payment.id }, data: { amount: '1' } }),
    ).rejects.toThrow();
  });
  it('rolls back all invoice receiving effects when a later stock item has no opening and rejects invalid dates', async () => {
    const p = await purchase.create(
      actor,
      invoice({
        lines: [
          { stockItemId: item, quantity: '1', unitPrice: '5000' },
          { stockItemId: second, quantity: '1', unitPrice: '1000' },
        ],
      }),
    );
    await purchase.confirm(actor, p.id);
    const before = await balance();
    const movementCount = await db.stockMovement.count();
    const body = {
      id: randomUUID(),
      businessDate: date,
      reference: 'FAIL-GR',
      note: 'TEST atomic fail',
      lines: p.lines.map((l) => ({ lineId: l.id, quantity: '1' })),
    };
    await expect(purchase.receive(actor, p.id, body)).rejects.toMatchObject({ status: 400 });
    expect(await balance()).toBe(before);
    expect(await db.stockMovement.count()).toBe(movementCount);
    expect((await purchase.detail(actor, p.id)).receipts).toHaveLength(0);
    expect(await db.stockDocument.findUnique({ where: { id: body.id } })).toBeNull();
    await expect(
      purchase.receive(actor, p.id, { ...body, businessDate: '2099-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      purchase.pay(actor, p.id, paid('1', { businessDate: '2025-12-31' })),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('enforces scoped role and ownership: no cross-DC, cashier/partner costs or partner expense attributed to company', async () => {
    const p = await purchase.create(dcActor, invoice({ locationId: dc }));
    await request(app.getHttpServer())
      .get(`/api/v1/purchasing/invoices/${p.id}`)
      .auth(dcToken, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/purchasing/invoices?locationId=${dc2}`)
      .auth(dcToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/purchasing/invoices/${p.id}`)
      .auth(partnerToken, { type: 'bearer' })
      .expect(403);
    await expect(purchase.create(dcActor, invoice())).rejects.toMatchObject({ status: 403 });
    await expect(
      purchase.create(actor, invoice({ locationId: partnerStand })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(purchase.suppliers(partnerActor, {})).rejects.toMatchObject({ status: 403 });
    await expect(
      purchase.createSupplier(dcActor, { id: randomUUID(), code: 'TEST', name: 'No permission' }),
    ).rejects.toMatchObject({ status: 403 });
    await request(app.getHttpServer())
      .get(`/api/v1/purchasing/invoices?locationId=${center}`)
      .expect(401);
  });
  it('keeps money exact, historical unit prices unchanged, paginates invoices and reconciles paid/receipt totals', async () => {
    const p = await purchase.create(
      actor,
      invoice({ lines: [{ stockItemId: item, quantity: '0.5', unitPrice: '3' }] }),
    );
    expect(p.totalAmount.toString()).toBe('2');
    const newer = await purchase.create(
      actor,
      invoice({ lines: [{ stockItemId: item, quantity: '0.5', unitPrice: '7' }] }),
    );
    expect(newer.totalAmount.toString()).toBe('4');
    expect((await purchase.detail(actor, p.id)).totalAmount.toString()).toBe('2');
    const result = await purchase.list(actor, {
      locationId: center,
      page: '1',
      perPage: '2',
      q: `BILL-${tag}`,
    });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBeGreaterThan(2);
    const all = await db.purchase.findMany({
      where: { locationId: center },
      include: { payments: true },
    });
    for (const bill of all) {
      const paid = bill.payments.reduce((s, p) => s + BigInt(p.amount.toString()), 0n);
      expect(paid.toString()).toBe(bill.paidAmount.toString());
    }
    expect(
      await db.auditEvent.count({
        where: { actorId: actor.id, action: 'purchase.payment.recorded' },
      }),
    ).toBeGreaterThan(0);
  });
});
