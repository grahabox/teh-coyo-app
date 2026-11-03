import {
  dummyCities,
  dummyEntities,
  dummyFlavors,
  dummyItems,
  dummyRecipeDefinitions,
} from '../prisma/dummy-data';
import { dummyId, requireDummyDevelopment } from '../prisma/dummy-seeder';
import { recipeSchema } from '../src/recipes/recipes.service';
import { convertQuantity } from '../src/recipes/recipe.math';

describe('Development dummy fixture safety', () => {
  it('has marked unique data, stable IDs and both recipe types', () => {
    expect(dummyCities).toHaveLength(6);
    expect(dummyItems).toHaveLength(14);
    expect(dummyFlavors).toHaveLength(6);
    const recipes = dummyRecipeDefinitions();
    expect(recipes).toHaveLength(11);
    expect(recipes.filter((recipe) => recipe.kind === 'PRODUCTION')).toHaveLength(4);
    expect(recipes.filter((recipe) => recipe.kind === 'SERVING')).toHaveLength(7);
    for (const entries of [dummyEntities, dummyItems, dummyFlavors]) {
      expect(new Set(entries.map((entry) => entry.code)).size).toBe(entries.length);
      expect(
        entries.every((entry) => entry.code.startsWith('DUMMY-') && entry.name.includes('Dummy')),
      ).toBe(true);
    }
    expect(new Set(recipes.map((recipe) => dummyId(`recipe:${recipe.key}`))).size).toBe(
      recipes.length,
    );
    expect(dummyId('same')).toBe(dummyId('same'));
    expect(dummyId('same')).not.toBe(dummyId('different'));
  });

  it('uses valid component dimensions and leaves original free of powder/milk', () => {
    const units = {
      g: { code: 'g', dimension: 'MASS', factor: '1' },
      kg: { code: 'kg', dimension: 'MASS', factor: '1000' },
      ml: { code: 'ml', dimension: 'VOLUME', factor: '1' },
      L: { code: 'L', dimension: 'VOLUME', factor: '1000' },
      pcs: { code: 'pcs', dimension: 'COUNT', factor: '1' },
    };
    for (const recipe of dummyRecipeDefinitions()) {
      const item = dummyItems.find((item) => item.key === recipe.outputItem);
      expect(() =>
        recipeSchema.parse({
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
        }),
      ).not.toThrow();
      if (item)
        expect(() =>
          convertQuantity(
            recipe.outputQuantity,
            units[recipe.outputUnitCode as keyof typeof units],
            units[item.unit],
          ),
        ).not.toThrow();
      expect(new Set(recipe.components.map((line) => line.item)).size).toBe(
        recipe.components.length,
      );
      for (const line of recipe.components) {
        const input = dummyItems.find((item) => item.key === line.item);
        expect(input).toBeDefined();
        expect(() =>
          convertQuantity(
            line.quantity,
            units[line.unitCode as keyof typeof units],
            units[input!.unit],
          ),
        ).not.toThrow();
        expect(line.item).not.toBe(recipe.outputItem);
      }
    }
    const original = dummyRecipeDefinitions().find((recipe) => recipe.key === 'serving-original')!;
    expect(
      original.components.some((line) =>
        ['milk', 'chocolate', 'melon', 'matcha', 'taro', 'strawberry'].includes(line.item),
      ),
    ).toBe(false);
  });

  it('requires explicit confirmation, non-production mode and a local approved database', () => {
    const valid = {
      nodeEnv: 'development',
      databaseUrl: 'postgresql://user@localhost:5432/teh_coyo',
      confirmed: true,
    };
    expect(() => requireDummyDevelopment(valid)).not.toThrow();
    expect(() =>
      requireDummyDevelopment({
        ...valid,
        nodeEnv: 'test',
        databaseUrl: 'postgresql://user@127.0.0.1:55432/teh_coyo_test',
      }),
    ).not.toThrow();
    expect(() => requireDummyDevelopment({ ...valid, confirmed: false })).toThrow();
    expect(() => requireDummyDevelopment({ ...valid, nodeEnv: 'production' })).toThrow();
    expect(() => requireDummyDevelopment({ ...valid, nodeEnv: undefined })).toThrow();
    expect(() =>
      requireDummyDevelopment({
        ...valid,
        databaseUrl: 'postgresql://user@remote.example/teh_coyo',
      }),
    ).toThrow();
    expect(() =>
      requireDummyDevelopment({
        ...valid,
        databaseUrl: 'postgresql://user@localhost/other_database',
      }),
    ).toThrow();
  });
});
