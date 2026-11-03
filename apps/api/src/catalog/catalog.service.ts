import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../database/database.module';
import { AccessService, type Actor } from '../access/access';
import { validate } from '../common/validation';

const catalogCode = z
  .string()
  .trim()
  .min(2, 'Isi kode minimal 2 karakter.')
  .max(40, 'Kode maksimal 40 karakter.')
  .regex(
    /^[A-Z0-9_-]+$/,
    'Gunakan huruf A–Z, angka, tanda hubung (-), atau garis bawah (_), tanpa spasi.',
  );
const catalogName = z
  .string()
  .trim()
  .min(2, 'Isi nama minimal 2 karakter.')
  .max(120, 'Nama maksimal 120 karakter.');
export const itemSchema = z
  .object({
    code: catalogCode,
    name: catalogName,
    baseUnitId: z.uuid('Pilih satuan pencatatan barang yang valid.'),
  })
  .strict();
export const menuSchema = z.object({ name: catalogName }).strict();
export const variantSchema = z
  .object({
    code: catalogCode,
    name: catalogName,
    menuId: z.uuid('Pilih kelompok minuman yang valid.'),
  })
  .strict();

function fieldError(field: string, message: string) {
  return { message, issues: [{ field, message }] };
}
function isUniqueConflict(error: unknown) {
  return (error as { code?: string })?.code === 'P2002';
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}
  async list() {
    const [units, items, menus, variants] = await Promise.all([
      this.db.unit.findMany({ orderBy: { code: 'asc' } }),
      this.db.stockItem.findMany({
        include: { baseUnit: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      this.db.menu.findMany({ orderBy: { name: 'asc' }, take: 500 }),
      this.db.menuVariant.findMany({
        include: { menu: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);
    return { units, items, menus, variants };
  }
  units() {
    return this.db.unit.findMany({ orderBy: { code: 'asc' } });
  }
  async options(kind: 'items' | 'variants', input: unknown) {
    const query = validate(
      z
        .object({
          q: z.string().trim().max(100).default(''),
          page: z.coerce.number().int().min(1).max(100000).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(10),
        })
        .strict(),
      input,
    );
    const where = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { code: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const paging = {
      where,
      orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    };
    if (kind === 'items') {
      const [items, total] = await this.db.$transaction([
        this.db.stockItem.findMany({ ...paging, include: { baseUnit: true } }),
        this.db.stockItem.count({ where }),
      ]);
      return {
        items,
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.ceil(total / query.perPage),
      };
    }
    const [items, total] = await this.db.$transaction([
      this.db.menuVariant.findMany({ ...paging, include: { menu: true } }),
      this.db.menuVariant.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(total / query.perPage),
    };
  }
  async createItem(actor: Actor, body: unknown) {
    this.access.requireCentral(actor);
    const data = validate(itemSchema, body);
    const unit = await this.db.unit.findUnique({ where: { id: data.baseUnitId } });
    if (!unit || unit.factor.toString() !== '1')
      throw new BadRequestException(
        fieldError('baseUnitId', 'Pilih Gram, Mililiter, atau Buah sebagai satuan pencatatan.'),
      );
    return this.db
      .$transaction(async (tx) => {
        const item = await tx.stockItem.create({ data });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'stock_item.created',
            subjectId: item.id,
            details: data,
          },
        });
        return item;
      })
      .catch((error: unknown) => {
        if (isUniqueConflict(error))
          throw new ConflictException(
            fieldError('code', 'Kode ini sudah digunakan. Gunakan kode lain.'),
          );
        throw error;
      });
  }
  async createMenu(actor: Actor, body: unknown) {
    this.access.requireCentral(actor);
    const data = validate(menuSchema, body);
    return this.db
      .$transaction(async (tx) => {
        const menu = await tx.menu.create({ data });
        await tx.auditEvent.create({
          data: { actorId: actor.id, action: 'menu.created', subjectId: menu.id, details: data },
        });
        return menu;
      })
      .catch((error: unknown) => {
        if (isUniqueConflict(error))
          throw new ConflictException(
            fieldError(
              'name',
              'Kelompok minuman ini sudah ada. Gunakan kelompok tersebut atau nama lain.',
            ),
          );
        throw error;
      });
  }
  async createVariant(actor: Actor, body: unknown) {
    this.access.requireCentral(actor);
    const data = validate(variantSchema, body);
    if (!(await this.db.menu.findUnique({ where: { id: data.menuId } })))
      throw new BadRequestException(
        fieldError('menuId', 'Kelompok minuman tidak ditemukan. Pilih kelompok yang tersedia.'),
      );
    return this.db
      .$transaction(async (tx) => {
        const variant = await tx.menuVariant.create({ data });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'variant.created',
            subjectId: variant.id,
            details: data,
          },
        });
        return variant;
      })
      .catch(async (error: unknown) => {
        if (isUniqueConflict(error)) {
          const duplicateCode = await this.db.menuVariant.findUnique({
            where: { code: data.code },
          });
          throw new ConflictException(
            duplicateCode
              ? fieldError('code', 'Kode ini sudah digunakan. Gunakan kode lain.')
              : fieldError(
                  'name',
                  'Rasa / menu ini sudah ada dalam kelompok tersebut. Gunakan nama lain.',
                ),
          );
        }
        throw error;
      });
  }
}
