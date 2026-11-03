import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AccessService, type Actor } from '../access/access';
import { DatabaseService } from '../database/database.module';
import { InventoryService } from '../inventory/inventory.service';
import { Prisma } from '../generated/prisma/client';
import { idSchema, validate } from '../common/validation';
import {
  linkReceiptSchema,
  pageQuery,
  paymentSchema,
  purchaseQuery,
  purchaseReceiptSchema,
  purchaseSchema,
  supplierSchema,
} from './procurement.schemas';
import { purchaseTotals, referenceKey } from './purchase.math';

type Tx = Prisma.TransactionClient;
const include = {
  location: true,
  supplier: true,
  lines: {
    include: { stockItem: { include: { baseUnit: true } } },
    orderBy: { id: 'asc' as const },
  },
  receipts: {
    include: { stockDocument: { include: { lines: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  payments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PurchaseInclude;
type Purchase = Prisma.PurchaseGetPayload<{ include: typeof include }>;
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
function fail(field: string, message: string): never {
  throw new BadRequestException({ message, issues: [{ field, message }] });
}
const dateOf = (s: string) => new Date(s + 'T00:00:00Z');
const page = <T>(items: T[], total: number, q: { page: number; perPage: number }) => ({
  items,
  total,
  page: q.page,
  perPage: q.perPage,
  totalPages: Math.ceil(total / q.perPage),
});

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}
  private requireAdmin(actor: Actor) {
    if (!['CENTRAL_ADMIN', 'DC_ADMIN'].includes(actor.role))
      throw new ForbiddenException('Pembelian tahap ini hanya untuk admin pusat/DC.');
  }
  private async location(tx: Tx, actor: Actor, id: string, write = false) {
    this.requireAdmin(actor);
    const loc = await tx.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Lokasi tidak ditemukan.');
    this.access.requireLocation(actor, loc);
    if (write && actor.role !== 'CENTRAL_ADMIN' && loc.id !== actor.locationId)
      throw new ForbiddenException('Admin DC hanya mencatat pembelian di DC sendiri.');
    if (loc.ownership === 'PARTNER')
      fail(
        'locationId',
        'Pembelian milik mitra belum termasuk tahap ini. Jangan catat sebagai belanja Teh Coyo.',
      );
    return loc;
  }
  private validDate(s: string) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (s > today) fail('businessDate', 'Tanggal kejadian tidak boleh di masa depan.');
    return dateOf(s);
  }
  private async get(tx: Tx, actor: Actor, id: string, write = false) {
    const p = await tx.purchase.findUnique({ where: { id }, include });
    if (!p) throw new NotFoundException('Nota pembelian tidak ditemukan.');
    await this.location(tx, actor, p.locationId, write);
    return p;
  }
  private present(p: Purchase) {
    return {
      ...p,
      outstandingAmount: p.totalAmount.sub(p.paidAmount).toString(),
      receiptStatus: p.lines.every((l) => l.receivedQuantity.eq(l.quantity))
        ? 'COMPLETE'
        : p.lines.some((l) => l.receivedQuantity.gt(0))
          ? 'PARTIAL'
          : 'NONE',
      paymentStatus: p.paidAmount.eq(0)
        ? 'UNPAID'
        : p.paidAmount.eq(p.totalAmount)
          ? 'PAID'
          : 'PARTIAL',
    };
  }
  private audit(tx: Tx, actor: Actor, action: string, id: string, details: Prisma.InputJsonValue) {
    return tx.auditEvent.create({ data: { actorId: actor.id, action, subjectId: id, details } });
  }
  async suppliers(actor: Actor, input: unknown) {
    this.requireAdmin(actor);
    const q = validate(pageQuery, input);
    const where: Prisma.SupplierWhereInput = q.q
      ? {
          OR: [
            { code: { contains: q.q, mode: 'insensitive' } },
            { name: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.db.$transaction([
      this.db.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.db.supplier.count({ where }),
    ]);
    return page(items, total, q);
  }
  async createSupplier(actor: Actor, body: unknown) {
    this.access.requireCentral(actor);
    const data = validate(supplierSchema, body);
    return this.inventory.withTransaction(async (tx) => {
      const existing = await tx.supplier.findUnique({ where: { id: data.id } });
      if (existing) {
        if (existing.code !== data.code || existing.name !== data.name)
          throw new ConflictException('ID supplier sudah dipakai dengan isian berbeda.');
        return existing;
      }
      if (await tx.supplier.findUnique({ where: { code: data.code } }))
        fail('code', 'Kode supplier sudah digunakan.');
      const created = await tx.supplier.create({ data });
      await this.audit(tx, actor, 'supplier.created', created.id, data);
      return created;
    });
  }
  async list(actor: Actor, input: unknown) {
    const q = validate(purchaseQuery, input);
    await this.location(this.db, actor, q.locationId);
    const where: Prisma.PurchaseWhereInput = {
      locationId: q.locationId,
      ...(q.q
        ? {
            OR: [
              { invoiceReference: { contains: q.q, mode: 'insensitive' } },
              { supplierName: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.purchase.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.db.purchase.count({ where }),
    ]);
    return page(
      items.map((p) => this.present(p)),
      total,
      q,
    );
  }
  async detail(actor: Actor, id: string) {
    return this.present(await this.get(this.db, actor, validate(idSchema, id)));
  }
  async receiptOptions(actor: Actor, id: string, input: unknown) {
    const p = await this.get(this.db, actor, validate(idSchema, id));
    const q = validate(pageQuery, input);
    const where: Prisma.StockDocumentWhereInput = {
      locationId: p.locationId,
      kind: 'RECEIPT',
      status: 'POSTED',
      purchaseReceipt: { is: null },
      supplierName: { equals: p.supplierName, mode: 'insensitive' },
      ...(q.q ? { reference: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.stockDocument.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.db.stockDocument.count({ where }),
    ]);
    return page(
      items.map((s) => ({
        id: s.id,
        name: s.reference,
        code: s.businessDate.toISOString().slice(0, 10),
      })),
      total,
      q,
    );
  }
  async create(actor: Actor, body: unknown) {
    const data = validate(purchaseSchema, body);
    const businessDate = this.validDate(data.businessDate);
    return this.inventory.withTransaction(async (tx) => {
      const loc = await this.location(tx, actor, data.locationId, true);
      const existing = await tx.purchase.findUnique({ where: { id: data.id }, include });
      if (existing) {
        if (existing.createdBy !== actor.id || existing.requestHash !== hash(data))
          throw new ConflictException('ID nota sudah digunakan dengan isian berbeda.');
        return this.present(existing);
      }
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) fail('supplierId', 'Pilih supplier yang tersedia.');
      const duplicate = await tx.purchase.findUnique({
        where: {
          supplierId_entityId_invoiceKey: {
            supplierId: supplier.id,
            entityId: loc.entityId,
            invoiceKey: referenceKey(data.invoiceReference),
          },
        },
      });
      if (duplicate)
        fail(
          'invoiceReference',
          'Nomor nota supplier ini sudah dicatat untuk pemilik usaha yang sama. Buka nota existing.',
        );
      const items = await tx.stockItem.count({
        where: { id: { in: data.lines.map((l) => l.stockItemId) } },
      });
      if (items !== data.lines.length) fail('lines', 'Ada barang yang tidak tersedia.');
      const totals = purchaseTotals(data.lines);
      if (
        totals.total.lte(0) ||
        totals.total.gte('1000000000000000000') ||
        totals.amounts.some((a) => a.lte(0) || a.gte('1000000000000000000'))
      )
        fail('lines', 'Nilai baris/total harus minimal Rp1 dan tidak melampaui kapasitas.');
      const p = await tx.purchase.create({
        data: {
          ...data,
          entityId: loc.entityId,
          ownership: loc.ownership,
          supplierName: supplier.name,
          invoiceKey: referenceKey(data.invoiceReference),
          businessDate,
          dueDate: data.dueDate ? dateOf(data.dueDate) : null,
          totalAmount: totals.total,
          requestHash: hash(data),
          createdBy: actor.id,
          lines: { create: data.lines.map((l, i) => ({ ...l, lineAmount: totals.amounts[i] })) },
        },
        include,
      });
      await this.audit(tx, actor, 'purchase.draft.created', p.id, data);
      return this.present(p);
    });
  }
  async confirm(actor: Actor, id: string) {
    validate(idSchema, id);
    return this.inventory.withTransaction(async (tx) => {
      const p = await this.get(tx, actor, id, true);
      if (p.status === 'CONFIRMED') return this.present(p);
      await tx.purchase.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: actor.id },
      });
      await this.audit(tx, actor, 'purchase.confirmed', id, {
        totalAmount: p.totalAmount.toString(),
        currency: p.currency,
      });
      return this.present(await this.get(tx, actor, id));
    });
  }
  async receive(actor: Actor, id: string, body: unknown) {
    validate(idSchema, id);
    const data = validate(purchaseReceiptSchema, body);
    const date = this.validDate(data.businessDate);
    return this.inventory.withTransaction(async (tx) => {
      const p = await this.get(tx, actor, id, true);
      const old = await tx.purchaseReceipt.findUnique({ where: { id: data.id } });
      if (old) {
        if (old.purchaseId !== id || old.actorId !== actor.id || old.requestHash !== hash(data))
          throw new ConflictException('ID terima sudah digunakan dengan isian berbeda.');
        return this.present(p);
      }
      if (p.status !== 'CONFIRMED') fail('status', 'Konfirmasi nota terlebih dahulu.');
      if (date < p.businessDate) fail('businessDate', 'Terima tidak boleh sebelum tanggal nota.');
      if (
        p.receipts.some(
          (r) => referenceKey(r.stockDocument.reference) === referenceKey(data.reference),
        )
      )
        fail(
          'reference',
          'Bukti penerimaan ini sudah dicatat pada nota. Gunakan referensi kejadian baru hanya jika benar-benar penerimaan tambahan.',
        );
      const lines = data.lines.map((l, i) => {
        const line = p.lines.find((v) => v.id === l.lineId);
        if (!line) fail('lines', 'Baris bukan milik nota ini.');
        if (line.receivedQuantity.add(l.quantity).gt(line.quantity))
          fail('lines', `Jumlah ${line.stockItem.name} melebihi sisa nota.`);
        return { line, quantity: l.quantity };
      });
      const stock = await this.inventory.receivePurchaseStock(tx, actor, {
        id: data.id,
        kind: 'RECEIPT',
        locationId: p.locationId,
        businessDate: data.businessDate,
        reference: data.reference,
        reason: `Nota ${p.invoiceReference}: ${data.note}`.slice(0, 500),
        supplierName: p.supplierName,
        lines: lines.map((l) => ({ stockItemId: l.line.stockItemId, quantity: l.quantity })),
      });
      for (const l of lines)
        await tx.purchaseLine.update({
          where: { id: l.line.id },
          data: { receivedQuantity: l.line.receivedQuantity.add(l.quantity) },
        });
      await tx.purchaseReceipt.create({
        data: {
          id: data.id,
          purchaseId: id,
          stockDocumentId: stock.id,
          requestHash: hash(data),
          actorId: actor.id,
        },
      });
      await this.audit(tx, actor, 'purchase.received', id, data);
      return this.present(await this.get(tx, actor, id));
    });
  }
  async linkReceipt(actor: Actor, id: string, body: unknown) {
    validate(idSchema, id);
    const data = validate(linkReceiptSchema, body);
    return this.inventory.withTransaction(async (tx) => {
      const p = await this.get(tx, actor, id, true);
      const old = await tx.purchaseReceipt.findUnique({ where: { id: data.id } });
      if (old) {
        if (old.purchaseId !== id || old.actorId !== actor.id || old.requestHash !== hash(data))
          throw new ConflictException('ID tautan sudah dipakai berbeda.');
        return this.present(p);
      }
      if (p.status !== 'CONFIRMED') fail('status', 'Konfirmasi nota terlebih dahulu.');
      const stock = await tx.stockDocument.findUnique({
        where: { id: data.stockDocumentId },
        include: { lines: true, purchaseReceipt: true },
      });
      if (
        !stock ||
        stock.locationId !== p.locationId ||
        stock.kind !== 'RECEIPT' ||
        stock.status !== 'POSTED'
      )
        fail(
          'stockDocumentId',
          'Pilih penerimaan supplier yang sudah tercatat pada lokasi nota ini.',
        );
      if (stock.purchaseReceipt)
        fail('stockDocumentId', 'Penerimaan sudah ditautkan ke nota lain/nota ini.');
      if (
        p.receipts.some(
          (r) => referenceKey(r.stockDocument.reference) === referenceKey(stock.reference),
        )
      )
        fail('stockDocumentId', 'Referensi penerimaan ini sudah tercatat pada nota.');
      if (referenceKey(stock.supplierName ?? '') !== referenceKey(p.supplierName))
        fail('stockDocumentId', 'Nama supplier penerimaan tidak cocok dengan supplier nota.');
      if (stock.businessDate < p.businessDate)
        fail('stockDocumentId', 'Penerimaan tidak boleh mendahului tanggal nota.');
      for (const l of stock.lines) {
        const line = p.lines.find((v) => v.stockItemId === l.stockItemId);
        if (!line || line.receivedQuantity.add(l.quantity).gt(line.quantity))
          fail('stockDocumentId', 'Barang/jumlah penerimaan tidak sesuai sisa nota.');
        await tx.purchaseLine.update({
          where: { id: line.id },
          data: { receivedQuantity: line.receivedQuantity.add(l.quantity) },
        });
      }
      await tx.purchaseReceipt.create({
        data: {
          id: data.id,
          purchaseId: id,
          stockDocumentId: stock.id,
          requestHash: hash(data),
          actorId: actor.id,
          linkedExisting: true,
        },
      });
      await this.audit(tx, actor, 'purchase.receipt.linked', id, data);
      return this.present(await this.get(tx, actor, id));
    });
  }
  async pay(actor: Actor, id: string, body: unknown) {
    validate(idSchema, id);
    const data = validate(paymentSchema, body);
    const date = this.validDate(data.businessDate);
    return this.inventory.withTransaction(async (tx) => {
      const p = await this.get(tx, actor, id, true);
      const old = await tx.purchasePayment.findUnique({ where: { id: data.id } });
      if (old) {
        if (old.purchaseId !== id || old.actorId !== actor.id || old.requestHash !== hash(data))
          throw new ConflictException('ID pembayaran sudah dipakai dengan isian berbeda.');
        return this.present(p);
      }
      if (p.status !== 'CONFIRMED') fail('status', 'Konfirmasi nota sebelum mencatat pembayaran.');
      if (date < p.businessDate)
        fail('businessDate', 'Pembayaran sebelum nota/uang muka belum didukung.');
      if (p.paidAmount.add(data.amount).gt(p.totalAmount))
        fail('amount', 'Pembayaran melebihi sisa tagihan nota.');
      if (
        await tx.purchasePayment.findUnique({
          where: {
            purchaseId_referenceKey: { purchaseId: id, referenceKey: referenceKey(data.reference) },
          },
        })
      )
        fail('reference', 'Bukti pembayaran ini sudah dicatat pada nota.');
      await tx.purchasePayment.create({
        data: {
          ...data,
          purchaseId: id,
          businessDate: date,
          referenceKey: referenceKey(data.reference),
          requestHash: hash(data),
          actorId: actor.id,
        },
      });
      await tx.purchase.update({
        where: { id },
        data: { paidAmount: p.paidAmount.add(data.amount) },
      });
      await this.audit(tx, actor, 'purchase.payment.recorded', id, data);
      return this.present(await this.get(tx, actor, id));
    });
  }
}
