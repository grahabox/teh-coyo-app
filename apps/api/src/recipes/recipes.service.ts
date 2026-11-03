import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../database/database.module';
import { AccessService, type Actor } from '../access/access';
import { idSchema, nameSchema, quantitySchema, validate } from '../common/validation';
import {
  convertQuantity,
  positiveQuantity,
  scaleQuantity,
  type MeasurementUnit,
} from './recipe.math';
import { recipeQuerySchema, recipeScope } from './recipes.queries';

function invalidField(field: string, message: string): never {
  throw new BadRequestException({ message, issues: [{ field, message }] });
}

export const recipeSchema = z
  .object({
    name: nameSchema,
    kind: z.enum(['PRODUCTION', 'SERVING']),
    scopeLocationId: idSchema.nullable().default(null),
    outputItemId: idSchema.nullable().default(null),
    menuVariantId: idSchema.nullable().default(null),
    outputQuantity: quantitySchema,
    outputUnitCode: z.string().min(1).max(20),
    components: z
      .array(
        z
          .object({
            stockItemId: idSchema,
            quantity: quantitySchema,
            unitCode: z.string().min(1).max(20),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

@Injectable()
export class RecipesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  list(actor: Actor) {
    const where = recipeScope(actor);
    // Drafts are only visible to their authorized writers, never to cashiers/partners.
    if (actor.role !== 'CENTRAL_ADMIN' && actor.role !== 'DC_ADMIN') return [];
    return this.db.recipe.findMany({
      where,
      include: {
        outputItem: true,
        menuVariant: true,
        components: { include: { stockItem: { include: { baseUnit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async page(actor: Actor, input: unknown) {
    const query = validate(recipeQuerySchema, input);
    const where = {
      AND: [
        recipeScope(actor),
        ...(query.kind ? [{ kind: query.kind }] : []),
        ...(query.q ? [{ name: { contains: query.q, mode: 'insensitive' as const } }] : []),
      ],
    };
    const [items, total] = await this.db.$transaction([
      this.db.recipe.findMany({
        where,
        include: {
          outputItem: true,
          menuVariant: true,
          scopeLocation: { select: { id: true, name: true, code: true } },
          _count: { select: { components: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: query.perPage,
        skip: (query.page - 1) * query.perPage,
      }),
      this.db.recipe.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(total / query.perPage),
    };
  }

  async detail(actor: Actor, id: string) {
    const recipe = await this.db.recipe.findUnique({
      where: { id: validate(idSchema, id) },
      include: {
        outputItem: { include: { baseUnit: true } },
        menuVariant: { include: { menu: true } },
        scopeLocation: { select: { id: true, name: true, code: true } },
        components: {
          include: { stockItem: { include: { baseUnit: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!recipe) throw new NotFoundException('Resep tidak ditemukan.');
    this.access.requireRecipeWriter(actor, recipe.scopeLocationId);
    return recipe;
  }

  async create(actor: Actor, body: unknown) {
    const data = validate(recipeSchema, body);
    this.access.requireRecipeWriter(actor, data.scopeLocationId);
    if (data.scopeLocationId) {
      const location = await this.db.location.findUnique({ where: { id: data.scopeLocationId } });
      if (!location || location.type !== 'DC')
        invalidField('scopeLocationId', 'Pilih DC yang tersedia untuk resep ini.');
    }
    try {
      positiveQuantity(data.outputQuantity);
    } catch (error) {
      invalidField('outputQuantity', (error as Error).message);
    }
    if (
      data.kind === 'PRODUCTION'
        ? !data.outputItemId || data.menuVariantId
        : !data.menuVariantId || data.outputItemId
    ) {
      invalidField(
        data.kind === 'PRODUCTION' ? 'outputItemId' : 'menuVariantId',
        'Produksi membutuhkan barang hasil; takaran per cup membutuhkan menu minuman.',
      );
    }
    const ids = data.components.map((line) => line.stockItemId);
    if (new Set(ids).size !== ids.length) {
      const duplicate = ids.findIndex((id, index) => ids.indexOf(id) !== index);
      invalidField(
        `components.${duplicate}.stockItemId`,
        'Bahan ini sudah ditambahkan. Gabungkan takarannya dalam satu baris.',
      );
    }
    if (data.outputItemId && ids.includes(data.outputItemId))
      invalidField(
        `components.${ids.indexOf(data.outputItemId)}.stockItemId`,
        'Barang hasil tidak boleh menjadi bahan resepnya sendiri.',
      );
    const [units, items, output, variant] = await Promise.all([
      this.db.unit.findMany(),
      this.db.stockItem.findMany({ where: { id: { in: ids } }, include: { baseUnit: true } }),
      data.outputItemId
        ? this.db.stockItem.findUnique({
            where: { id: data.outputItemId },
            include: { baseUnit: true },
          })
        : null,
      data.menuVariantId
        ? this.db.menuVariant.findUnique({ where: { id: data.menuVariantId } })
        : null,
    ]);
    if (data.outputItemId && !output)
      invalidField('outputItemId', 'Barang hasil tidak ditemukan. Pilih barang yang tersedia.');
    if (data.menuVariantId && !variant)
      invalidField('menuVariantId', 'Menu minuman tidak ditemukan. Pilih menu yang tersedia.');
    const missingIndex = ids.findIndex((id) => !items.some((item) => item.id === id));
    if (missingIndex !== -1)
      invalidField(
        `components.${missingIndex}.stockItemId`,
        'Bahan tidak ditemukan. Pilih bahan yang tersedia.',
      );
    const measurement = (code: string, field: string): MeasurementUnit => {
      const unit = units.find((unit) => unit.code === code);
      if (!unit) invalidField(field, 'Satuan tidak ditemukan. Pilih satuan yang tersedia.');
      return { code: unit.code, dimension: unit.dimension, factor: unit.factor.toString() };
    };
    let outputBaseQuantity: string;
    let components: {
      stockItemId: string;
      quantity: string;
      unitCode: string;
      baseQuantity: string;
    }[];
    try {
      if (
        data.kind === 'SERVING' &&
        (data.outputUnitCode !== 'pcs' || data.outputQuantity !== '1')
      ) {
        invalidField('outputQuantity', 'Takaran penyajian harus berbasis 1 cup.');
      }
      outputBaseQuantity =
        data.kind === 'SERVING'
          ? '1'
          : convertQuantity(
              data.outputQuantity,
              measurement(data.outputUnitCode, 'outputUnitCode'),
              measurement(output!.baseUnit.code, 'outputItemId'),
            );
      components = data.components.map((line, index) => {
        const item = items.find((item) => item.id === line.stockItemId)!;
        try {
          positiveQuantity(line.quantity);
        } catch (error) {
          invalidField(`components.${index}.quantity`, (error as Error).message);
        }
        let baseQuantity: string;
        try {
          baseQuantity = convertQuantity(
            line.quantity,
            measurement(line.unitCode, `components.${index}.unitCode`),
            measurement(item.baseUnit.code, `components.${index}.stockItemId`),
          );
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          invalidField(`components.${index}.unitCode`, (error as Error).message);
        }
        return {
          ...line,
          baseQuantity,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      invalidField('outputUnitCode', (error as Error).message);
    }
    return this.db.$transaction(async (tx) => {
      const { components: _input, ...header } = data;
      const recipe = await tx.recipe.create({
        data: {
          ...header,
          outputBaseQuantity,
          createdBy: actor.id,
          components: { create: components },
        },
        include: { components: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'recipe.draft_created',
          subjectId: recipe.id,
          details: {
            kind: data.kind,
            componentCount: components.length,
            scopeLocationId: data.scopeLocationId,
          },
        },
      });
      return recipe;
    });
  }

  async preview(actor: Actor, id: string, body: unknown) {
    const input = validate(
      z
        .object({ targetQuantity: quantitySchema, targetUnitCode: z.string().min(1).max(20) })
        .strict(),
      body,
    );
    const recipe = await this.db.recipe.findUnique({
      where: { id: validate(idSchema, id) },
      include: {
        outputItem: { include: { baseUnit: true } },
        components: { include: { stockItem: { include: { baseUnit: true } } } },
      },
    });
    if (!recipe) throw new NotFoundException('Resep tidak ditemukan.');
    this.access.requireRecipeWriter(actor, recipe.scopeLocationId);
    if (!recipe.components.length)
      invalidField('targetQuantity', 'Resep belum memiliki bahan. Simulasi belum tersedia.');
    const unit = await this.db.unit.findUnique({ where: { code: input.targetUnitCode } });
    if (!unit) invalidField('targetUnitCode', 'Pilih satuan target yang tersedia.');
    try {
      positiveQuantity(input.targetQuantity);
    } catch (error) {
      invalidField('targetQuantity', (error as Error).message);
    }
    try {
      const base =
        recipe.kind === 'SERVING'
          ? { code: 'pcs', dimension: 'COUNT', factor: '1' }
          : {
              code: recipe.outputItem!.baseUnit.code,
              dimension: recipe.outputItem!.baseUnit.dimension,
              factor: recipe.outputItem!.baseUnit.factor.toString(),
            };
      if (
        recipe.kind === 'SERVING' &&
        (!/^\d+$/.test(input.targetQuantity) || input.targetUnitCode !== 'pcs')
      )
        invalidField('targetQuantity', 'Jumlah cup harus bilangan bulat positif.');
      const targetBase = convertQuantity(
        input.targetQuantity,
        { code: unit.code, dimension: unit.dimension, factor: unit.factor.toString() },
        base,
      );
      return {
        recipeId: recipe.id,
        version: recipe.version,
        status: 'DRAFT',
        planningOnly: true,
        targetQuantity: input.targetQuantity,
        targetUnitCode: input.targetUnitCode,
        components: recipe.components.map((line) => ({
          stockItemId: line.stockItemId,
          name: line.stockItem.name,
          unitCode: line.stockItem.baseUnit.code,
          ...scaleQuantity(
            line.baseQuantity.toString(),
            targetBase,
            recipe.outputBaseQuantity.toString(),
          ),
        })),
        warning: 'Simulasi kebutuhan standar; tidak mengubah stok dan bukan hasil produksi aktual.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      invalidField('targetUnitCode', (error as Error).message);
    }
  }
}
