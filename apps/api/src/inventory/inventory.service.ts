import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AccessService, canAccessLocation, type Actor } from '../access/access';
import { DatabaseService } from '../database/database.module';
import { idSchema, validate } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import {
  documentSchema,
  inventoryQuery,
  receiveSchema,
  type DocumentInput,
} from './inventory.schemas';

type Tx = Prisma.TransactionClient;
const includeDocument = {
  location: true,
  destination: true,
  lines: {
    include: { stockItem: { include: { baseUnit: true } } },
    orderBy: { id: 'asc' as const },
  },
  receipts: { orderBy: [{ businessDate: 'asc' as const }, { createdAt: 'asc' as const }] },
} satisfies Prisma.StockDocumentInclude;
type Document = Prisma.StockDocumentGetPayload<{ include: typeof includeDocument }>;
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
function fail(field: string, message: string): never {
  throw new BadRequestException({ message, issues: [{ field, message }] });
}
const dateValue = (date: string) => new Date(`${date}T00:00:00Z`);
const pageResult = <T>(items: T[], total: number, query: { page: number; perPage: number }) => ({
  items,
  total,
  ...query,
  totalPages: Math.ceil(total / query.perPage),
});

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  private validDate(value: string) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (value > today) fail('businessDate', 'Tanggal stok tidak boleh di masa depan.');
    return dateValue(value);
  }
  private async location(actor: Actor, id: string, tx: Tx = this.db) {
    const location = await tx.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Lokasi tidak ditemukan.');
    this.access.requireLocation(actor, location);
    return location;
  }
  private writer(actor: Actor, data: Pick<DocumentInput, 'kind' | 'locationId'>) {
    if (data.kind === 'OPENING' || data.kind === 'ADJUSTMENT')
      return this.access.requireCentral(actor);
    if (actor.role === 'CENTRAL_ADMIN') return;
    if (actor.role !== 'DC_ADMIN' || actor.locationId !== data.locationId)
      throw new ForbiddenException(
        'Penerimaan dan pengiriman hanya oleh admin pusat atau admin DC untuk DC sendiri.',
      );
  }
  private authorizeDocument(actor: Actor, doc: Document) {
    if (canAccessLocation(actor, doc.location)) return;
    if (doc.status !== 'DRAFT' && doc.destination && canAccessLocation(actor, doc.destination))
      return;
    throw new ForbiddenException('Dokumen di luar cakupan akses.');
  }
  private async getDocument(tx: Tx, actor: Actor, id: string) {
    const doc = await tx.stockDocument.findUnique({ where: { id }, include: includeDocument });
    if (!doc) throw new NotFoundException('Dokumen stok tidak ditemukan.');
    this.authorizeDocument(actor, doc);
    return doc;
  }
  // One database-wide inventory lock makes multi-line posting atomic and deadlock-free.
  // All inventory writes use this boundary; no floating point quantities or direct balance edits.
  async withTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74201931)`;
        return work(tx);
      },
      { timeout: 15000, maxWait: 15000 },
    );
  }

  async create(actor: Actor, input: unknown) {
    const data = validate(documentSchema, input);
    this.writer(actor, data);
    const businessDate = this.validDate(data.businessDate);
    return this.withTransaction(async (tx) => {
      const source = await this.location(actor, data.locationId, tx);
      const existing = await tx.stockDocument.findUnique({
        where: { id: data.id },
        include: includeDocument,
      });
      if (existing) {
        this.authorizeDocument(actor, existing);
        if (existing.createdBy !== actor.id || existing.requestHash !== hash(data))
          throw new ConflictException('ID dokumen sudah digunakan dengan isian berbeda.');
        return existing;
      }
      if (data.destinationId) {
        const dest = await tx.location.findUnique({ where: { id: data.destinationId } });
        if (
          !dest ||
          dest.parentId !== source.id ||
          !(
            (source.type === 'CENTER' && dest.type === 'DC') ||
            (source.type === 'DC' && dest.type === 'STAND')
          )
        )
          fail(
            'destinationId',
            'Transfer tahap ini hanya pusat → DC binaan atau DC → stand binaan.',
          );
      }
      const items = await tx.stockItem.findMany({
        where: { id: { in: data.lines.map((l) => l.stockItemId) } },
      });
      if (items.length !== data.lines.length) fail('lines', 'Ada barang yang tidak tersedia.');
      const doc = await tx.stockDocument.create({
        data: {
          ...data,
          businessDate,
          requestHash: hash(data),
          createdBy: actor.id,
          lines: {
            create: data.lines.map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity })),
          },
        },
        include: includeDocument,
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'stock.draft.created',
          subjectId: doc.id,
          details: data,
        },
      });
      return doc;
    });
  }

  // Procurement adapter: same transaction/lock as invoice receipt and counters.
  // Domain modules never directly change balance/ledger tables.
  async receivePurchaseStock(tx: Tx, actor: Actor, input: unknown) {
    const data = validate(documentSchema, input);
    if (data.kind !== 'RECEIPT') fail('kind', 'Pembelian hanya membuat penerimaan supplier.');
    this.writer(actor, data);
    await this.location(actor, data.locationId, tx);
    const date = this.validDate(data.businessDate);
    if (await tx.stockDocument.findUnique({ where: { id: data.id } }))
      throw new ConflictException(
        'ID stok sudah digunakan. Tautkan penerimaan existing melalui aksi terpisah.',
      );
    const priorReceipt = await tx.stockDocument.findFirst({
      where: {
        locationId: data.locationId,
        kind: 'RECEIPT',
        status: 'POSTED',
        supplierName: { equals: data.supplierName!, mode: 'insensitive' },
        reference: { equals: data.reference, mode: 'insensitive' },
      },
    });
    if (priorReceipt)
      fail(
        'reference',
        'Bukti terima supplier ini sudah masuk buku stok pada lokasi ini. Tautkan penerimaan existing, jangan terima ulang.',
      );
    const doc = await tx.stockDocument.create({
      data: {
        ...data,
        businessDate: date,
        requestHash: hash(data),
        createdBy: actor.id,
        lines: {
          create: data.lines.map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity })),
        },
      },
      include: includeDocument,
    });
    for (const line of doc.lines)
      await this.move(tx, actor, doc, line, doc.locationId, line.quantity, 'RECEIPT', date);
    await tx.stockDocument.update({
      where: { id: doc.id },
      data: { status: 'POSTED', postedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'stock.purchase.received',
        subjectId: doc.id,
        details: data,
      },
    });
    return this.getDocument(tx, actor, doc.id);
  }

  private async move(
    tx: Tx,
    actor: Actor,
    doc: Document,
    line: Document['lines'][number],
    locationId: string,
    amount: Prisma.Decimal,
    kind: string,
    businessDate: Date,
    receiptEventId: string | null = null,
  ) {
    await tx.stockBalance.upsert({
      where: { locationId_stockItemId: { locationId, stockItemId: line.stockItemId } },
      create: { locationId, stockItemId: line.stockItemId },
      update: {},
    });
    const key = { locationId_stockItemId: { locationId, stockItemId: line.stockItemId } };
    const balance = await tx.stockBalance.findUniqueOrThrow({ where: key });
    if (kind === 'OPENING') {
      if (balance.openingDate)
        fail(
          'lines',
          `Saldo awal ${line.stockItem.name} sudah ditetapkan. Gunakan penyesuaian untuk koreksi.`,
        );
    } else {
      if (!balance.openingDate)
        fail(
          'lines',
          `Tetapkan saldo awal ${line.stockItem.name} di lokasi terkait, termasuk nol jika memang kosong.`,
        );
      if (
        businessDate < balance.openingDate ||
        (balance.lastMovementDate && businessDate < balance.lastMovementDate)
      )
        fail(
          'businessDate',
          'Tanggal tidak boleh mendahului saldo awal atau mutasi terakhir barang di lokasi terkait.',
        );
    }
    const next = balance.quantity.add(amount);
    if (next.isNegative())
      fail(
        'lines',
        `Stok ${line.stockItem.name} tidak cukup. Tersedia ${balance.quantity.toString()} ${line.stockItem.baseUnit.code}.`,
      );
    if (next.gte('1000000000000')) fail('lines', 'Jumlah stok melampaui kapasitas pencatatan.');
    await tx.stockBalance.update({
      where: key,
      data: {
        quantity: next,
        lastMovementDate: businessDate,
        ...(kind === 'OPENING' ? { openingDate: businessDate } : {}),
      },
    });
    await tx.stockMovement.create({
      data: {
        locationId,
        stockItemId: line.stockItemId,
        lineId: line.id,
        receiptEventId,
        kind,
        quantity: amount,
        balanceAfter: next,
        businessDate,
        actorId: actor.id,
      },
    });
  }

  async post(actor: Actor, id: string, mode: 'post' | 'ship') {
    validate(idSchema, id);
    return this.withTransaction(async (tx) => {
      const doc = await this.getDocument(tx, actor, id);
      this.writer(actor, doc);
      await this.location(actor, doc.locationId, tx);
      if ((mode === 'ship') !== (doc.kind === 'TRANSFER'))
        fail('kind', 'Aksi tidak sesuai jenis dokumen.');
      if (doc.status !== 'DRAFT') return doc; // repeat confirmation cannot post twice
      this.validDate(doc.businessDate.toISOString().slice(0, 10));
      for (const line of doc.lines)
        await this.move(
          tx,
          actor,
          doc,
          line,
          doc.locationId,
          doc.kind === 'TRANSFER' ? line.quantity.negated() : line.quantity,
          doc.kind === 'TRANSFER' ? 'SHIPMENT' : doc.kind,
          doc.businessDate,
        );
      await tx.stockDocument.update({
        where: { id },
        data: { status: mode === 'ship' ? 'SHIPPED' : 'POSTED', postedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: `stock.${mode}`,
          subjectId: id,
          details: { businessDate: doc.businessDate.toISOString() },
        },
      });
      return this.getDocument(tx, actor, id);
    });
  }

  async receive(actor: Actor, id: string, input: unknown) {
    validate(idSchema, id);
    const data = validate(receiveSchema, input);
    const date = this.validDate(data.businessDate);
    return this.withTransaction(async (tx) => {
      const doc = await this.getDocument(tx, actor, id);
      if (doc.kind !== 'TRANSFER' || !doc.destinationId) fail('kind', 'Dokumen bukan transfer.');
      await this.location(actor, doc.destinationId, tx);
      if (actor.role !== 'CENTRAL_ADMIN' && actor.locationId !== doc.destinationId)
        throw new ForbiddenException('Penerimaan harus oleh akun lokasi tujuan atau admin pusat.');
      const existing = await tx.stockReceiptEvent.findUnique({ where: { id: data.id } });
      if (existing) {
        if (
          existing.documentId !== id ||
          existing.actorId !== actor.id ||
          existing.requestHash !== hash(data)
        )
          throw new ConflictException('ID penerimaan sudah digunakan dengan isian berbeda.');
        return doc;
      }
      if (doc.status !== 'SHIPPED')
        fail('status', 'Transfer belum dikirim atau sudah diterima lengkap.');
      if (
        date < doc.businessDate ||
        (doc.receipts.length && date < doc.receipts[doc.receipts.length - 1].businessDate)
      )
        fail('businessDate', 'Tanggal terima tidak boleh mendahului kirim/penerimaan sebelumnya.');
      await tx.stockReceiptEvent.create({
        data: {
          id: data.id,
          documentId: id,
          actorId: actor.id,
          businessDate: date,
          note: data.note,
          requestHash: hash(data),
        },
      });
      for (const received of data.lines) {
        const line = doc.lines.find((l) => l.id === received.lineId);
        if (!line) fail('lines', 'Baris bukan milik transfer ini.');
        const amount = new Prisma.Decimal(received.quantity);
        if (line.receivedQuantity.add(amount).gt(line.quantity))
          fail('lines', `Jumlah ${line.stockItem.name} melebihi sisa kiriman.`);
        await this.move(
          tx,
          actor,
          doc,
          line,
          doc.destinationId,
          amount,
          'TRANSFER_RECEIPT',
          date,
          data.id,
        );
        await tx.stockDocumentLine.update({
          where: { id: line.id },
          data: { receivedQuantity: line.receivedQuantity.add(amount) },
        });
      }
      const lines = await tx.stockDocumentLine.findMany({ where: { documentId: id } });
      if (lines.every((l) => l.receivedQuantity.eq(l.quantity)))
        await tx.stockDocument.update({ where: { id }, data: { status: 'RECEIVED' } });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'stock.transfer.received',
          subjectId: id,
          details: data,
        },
      });
      return this.getDocument(tx, actor, id);
    });
  }

  async detail(actor: Actor, id: string) {
    return this.getDocument(this.db, actor, validate(idSchema, id));
  }

  async balances(actor: Actor, input: unknown) {
    const q = validate(inventoryQuery, input);
    await this.location(actor, q.locationId);
    const where: Prisma.StockItemWhereInput = {
      ...(q.stockItemId ? { id: q.stockItemId } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { code: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.stockItem.findMany({
        where,
        include: { baseUnit: true, stockBalances: { where: { locationId: q.locationId } } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.db.stockItem.count({ where }),
    ]);
    return pageResult(
      items.map(({ stockBalances, ...item }) => ({
        ...item,
        quantity: stockBalances[0]?.openingDate ? stockBalances[0].quantity : null,
        openingDate: stockBalances[0]?.openingDate ?? null,
      })),
      total,
      { page: q.page, perPage: q.perPage },
    );
  }

  async documents(actor: Actor, input: unknown) {
    const q = validate(inventoryQuery, input);
    await this.location(actor, q.locationId);
    const where: Prisma.StockDocumentWhereInput = {
      AND: [
        {
          OR: [
            { locationId: q.locationId },
            { destinationId: q.locationId, status: { not: 'DRAFT' } },
          ],
        },
        ...(q.q
          ? [
              {
                OR: [
                  { reference: { contains: q.q, mode: 'insensitive' as const } },
                  { reason: { contains: q.q, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
        ...(q.stockItemId ? [{ lines: { some: { stockItemId: q.stockItemId } } }] : []),
      ],
    };
    const [items, total] = await this.db.$transaction([
      this.db.stockDocument.findMany({
        where,
        include: includeDocument,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.db.stockDocument.count({ where }),
    ]);
    return pageResult(items, total, { page: q.page, perPage: q.perPage });
  }

  async movements(actor: Actor, input: unknown) {
    const q = validate(inventoryQuery, input);
    await this.location(actor, q.locationId);
    const where: Prisma.StockMovementWhereInput = {
      locationId: q.locationId,
      ...(q.stockItemId ? { stockItemId: q.stockItemId } : {}),
      ...(q.q
        ? {
            line: {
              stockItem: {
                OR: [
                  { name: { contains: q.q, mode: 'insensitive' } },
                  { code: { contains: q.q, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.stockMovement.findMany({
        where,
        include: {
          line: {
            include: {
              stockItem: { include: { baseUnit: true } },
              document: { select: { id: true, reference: true, reason: true } },
            },
          },
        },
        orderBy: [{ sequence: 'desc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.db.stockMovement.count({ where }),
    ]);
    return pageResult(items, total, { page: q.page, perPage: q.perPage });
  }
}
