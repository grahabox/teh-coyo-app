import { createHash } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { recipeSchema } from '../src/recipes/recipes.service';
import { convertQuantity } from '../src/recipes/recipe.math';
import {
  dummyCities,
  dummyEntities,
  dummyFlavors,
  dummyItems,
  dummyRecipeDefinitions,
} from './dummy-data';

export const dummyDataset = 'tehcoyo-foundation-dummy-v1';

// Stable namespaced UUIDs avoid adding schema/unique keys just for demo data.
export function dummyId(key: string): string {
  const bytes = createHash('sha256').update(`${dummyDataset}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function requireDummyDevelopment(input: {
  nodeEnv?: string;
  databaseUrl: string;
  confirmed: boolean;
}) {
  if (input.nodeEnv !== 'development' && input.nodeEnv !== 'test')
    throw new Error('Dummy seed hanya untuk NODE_ENV=development/test, bukan produksi.');
  if (!input.confirmed)
    throw new Error('Gunakan --confirm-development-data untuk menyetujui penambahan data dummy.');
  const url = new URL(input.databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (
    !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) ||
    (name !== 'teh_coyo' && !name.endsWith('_test'))
  ) {
    throw new Error('Dummy seed dibatasi database lokal teh_coyo atau database khusus *_test.');
  }
}

export async function seedDummyData(db: PrismaClient, actorId: string) {
  return db.$transaction(
    async (tx) => {
      // Serializes re-runs without unsafe check-then-insert races or partial data.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(742091, 1)`;
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor?.active || actor.role !== 'CENTRAL_ADMIN')
        throw new Error('Admin pusat aktif diperlukan. Jalankan seed admin development dahulu.');
      const units = await tx.unit.findMany();
      for (const code of ['g', 'ml', 'pcs', 'L', 'kg']) {
        const unit = units.find((unit) => unit.code === code);
        const dimension =
          code === 'g' || code === 'kg' ? 'MASS' : code === 'pcs' ? 'COUNT' : 'VOLUME';
        const factor = code === 'L' || code === 'kg' ? '1000' : '1';
        if (!unit || unit.dimension !== dimension || unit.factor.toString() !== factor)
          throw new Error(
            'Satuan dasar belum lengkap atau berbeda. Jalankan db:seed dan periksa satuan; seed dummy tidak menimpa konversi.',
          );
      }
      const totals = {
        entities: 0,
        locations: 0,
        items: 0,
        menus: 0,
        variants: 0,
        recipes: 0,
        skipped: 0,
      };
      const audit = async (id: string, kind: string) =>
        tx.auditEvent.create({
          data: {
            actorId,
            action: 'dummy.seed_created',
            subjectId: id,
            details: { dataset: dummyDataset, kind, illustrationOnly: true },
          },
        });
      // Create-only by stable ID: user data and already present dummy rows are never updated.
      for (const entity of dummyEntities) {
        const id = dummyId(`entity:${entity.key}`);
        if (await tx.legalEntity.findUnique({ where: { id } })) {
          totals.skipped++;
          continue;
        }
        await tx.legalEntity.create({ data: { id, code: entity.code, name: entity.name } });
        await audit(id, 'entity');
        totals.entities++;
      }
      const companyId = dummyId('entity:company');
      const centerId = dummyId('location:center');
      const location = async (
        key: string,
        data: {
          code: string;
          name: string;
          type: 'CENTER' | 'DC' | 'STAND';
          ownership: 'OWNED' | 'PARTNER';
          entityId: string;
          parentId: string | null;
        },
      ) => {
        const id = dummyId(`location:${key}`);
        if (await tx.location.findUnique({ where: { id } })) {
          totals.skipped++;
          return;
        }
        if (data.type !== 'CENTER') {
          const parent = await tx.location.findUniqueOrThrow({ where: { id: data.parentId! } });
          if (
            parent.type !== (data.type === 'DC' ? 'CENTER' : 'DC') ||
            (data.ownership === 'OWNED'
              ? parent.entityId !== data.entityId
              : parent.entityId === data.entityId)
          ) {
            throw new Error(
              'Relasi dummy induk/pemilik sudah berbeda. Tidak ada data existing yang ditimpa.',
            );
          }
        }
        await tx.location.create({ data: { id, ...data } });
        await audit(id, 'location');
        totals.locations++;
      };
      await location('center', {
        code: 'DUMMY-PUSAT',
        name: 'Pusat Utama — Dummy',
        type: 'CENTER',
        ownership: 'OWNED',
        entityId: companyId,
        parentId: null,
      });
      for (const [cityIndex, city] of dummyCities.entries()) {
        const dcId = dummyId(`location:dc:${city.key}`);
        await location(`dc:${city.key}`, {
          code: `DUMMY-DC-${city.code}`,
          name: `DC ${city.name} — Dummy`,
          type: 'DC',
          ownership: 'OWNED',
          entityId: companyId,
          parentId: centerId,
        });
        for (let index = 1; index <= 6; index++) {
          const partner = index > 4;
          const partnerKey = ['partner-a', 'partner-b', 'partner-c'][
            (cityIndex + index - 5 + 3) % 3
          ];
          await location(`stand:${city.key}:${index}`, {
            code: `DUMMY-ST-${city.code}-${String(index).padStart(2, '0')}`,
            name: `Stand ${city.name} ${String(index).padStart(2, '0')} · ${partner ? 'Mitra' : 'Sendiri'} — Dummy`,
            type: 'STAND',
            ownership: partner ? 'PARTNER' : 'OWNED',
            entityId: partner ? dummyId(`entity:${partnerKey}`) : companyId,
            parentId: dcId,
          });
        }
      }
      for (const item of dummyItems) {
        const id = dummyId(`item:${item.key}`);
        if (await tx.stockItem.findUnique({ where: { id } })) {
          totals.skipped++;
          continue;
        }
        await tx.stockItem.create({
          data: {
            id,
            code: item.code,
            name: item.name,
            baseUnitId: units.find((unit) => unit.code === item.unit)!.id,
          },
        });
        await audit(id, 'item');
        totals.items++;
      }
      const menuId = dummyId('menu:tea');
      if (!(await tx.menu.findUnique({ where: { id: menuId } }))) {
        await tx.menu.create({ data: { id: menuId, name: 'Es Teh — Dummy' } });
        await audit(menuId, 'menu');
        totals.menus++;
      } else totals.skipped++;
      for (const flavor of dummyFlavors) {
        const id = dummyId(`variant:${flavor.key}`);
        if (await tx.menuVariant.findUnique({ where: { id } })) {
          totals.skipped++;
          continue;
        }
        await tx.menuVariant.create({ data: { id, code: flavor.code, name: flavor.name, menuId } });
        await audit(id, 'variant');
        totals.variants++;
      }
      for (const recipe of dummyRecipeDefinitions()) {
        const id = dummyId(`recipe:${recipe.key}`);
        if (await tx.recipe.findUnique({ where: { id } })) {
          totals.skipped++;
          continue;
        }
        const input = recipeSchema.parse({
          name: recipe.name,
          kind: recipe.kind,
          scopeLocationId: recipe.scopeDc ? dummyId(`location:dc:${recipe.scopeDc}`) : null,
          outputItemId: recipe.outputItem ? dummyId(`item:${recipe.outputItem}`) : null,
          menuVariantId: recipe.menuFlavor ? dummyId(`variant:${recipe.menuFlavor}`) : null,
          outputQuantity: recipe.outputQuantity,
          outputUnitCode: recipe.outputUnitCode,
          components: recipe.components.map((line) => ({
            stockItemId: dummyId(`item:${line.item}`),
            quantity: line.quantity,
            unitCode: line.unitCode,
          })),
        });
        const measure = (code: string) => {
          const unit = units.find((unit) => unit.code === code);
          if (!unit) throw new Error('Satuan resep dummy tidak tersedia.');
          return { code, dimension: unit.dimension, factor: unit.factor.toString() };
        };
        const output = input.outputItemId
          ? await tx.stockItem.findUniqueOrThrow({
              where: { id: input.outputItemId },
              include: { baseUnit: true },
            })
          : null;
        const outputBaseQuantity =
          recipe.kind === 'SERVING'
            ? '1'
            : convertQuantity(
                input.outputQuantity,
                measure(input.outputUnitCode),
                measure(output!.baseUnit.code),
              );
        const components = [];
        for (const line of input.components) {
          const item = await tx.stockItem.findUniqueOrThrow({
            where: { id: line.stockItemId },
            include: { baseUnit: true },
          });
          components.push({
            ...line,
            baseQuantity: convertQuantity(
              line.quantity,
              measure(line.unitCode),
              measure(item.baseUnit.code),
            ),
          });
        }
        const { components: _input, ...header } = input;
        await tx.recipe.create({
          data: {
            id,
            ...header,
            status: 'DRAFT',
            createdBy: actorId,
            outputBaseQuantity,
            components: { create: components },
          },
        });
        await audit(id, 'recipe');
        totals.recipes++;
      }
      return { dataset: dummyDataset, ...totals };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
