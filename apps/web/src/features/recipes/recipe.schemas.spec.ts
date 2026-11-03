import { describe, expect, it } from 'vitest';
import {
  compatibleUnits,
  recipeFormSchema,
  recipePayload,
  recipeQuantity,
  targetSchema,
} from './recipe.schemas';
import type { Unit } from '../../lib/types';

const id = 'cff1dfe4-801d-4913-a12e-d6dd7e62e8f8';
const production = {
  name: 'Teh Dasar',
  kind: 'PRODUCTION' as const,
  scopeLocationId: null,
  outputItemId: id,
  menuVariantId: '',
  outputQuantity: '10',
  outputUnitCode: 'L',
  components: [],
};
describe('Recipe editor and simulation rules', () => {
  it('allows empty-component drafts but validates header/output and added lines', () => {
    expect(recipeFormSchema.safeParse(production).success).toBe(true);
    expect(recipeFormSchema.safeParse({ ...production, outputItemId: '' }).success).toBe(false);
    expect(
      recipeFormSchema.safeParse({
        ...production,
        components: [{ stockItemId: '', quantity: '', unitCode: '' }],
      }).success,
    ).toBe(false);
    expect(recipePayload(production).menuVariantId).toBeNull();
  });
  it('rejects nonpositive, comma, exponent and overly precise quantities', () => {
    for (const value of ['0', '0.000000', '-1', '1,5', '1e2', '1.1234567'])
      expect(recipeQuantity.safeParse(value).success).toBe(false);
    expect(recipeQuantity.safeParse('0.000001').success).toBe(true);
  });
  it('rejects self-output and duplicate components, but original can have no powder', () => {
    const teaId = 'f1f1e23e-72cd-4bc9-987a-102234f9c0f3';
    const line = { stockItemId: teaId, quantity: '150', unitCode: 'ml' };
    const serving = {
      ...production,
      kind: 'SERVING',
      outputItemId: '',
      menuVariantId: id,
      outputQuantity: '1',
      outputUnitCode: 'pcs',
      components: [line],
    };
    expect(recipeFormSchema.safeParse(serving).success).toBe(true);
    expect(recipeFormSchema.safeParse({ ...serving, components: [line, line] }).success).toBe(
      false,
    );
    expect(
      recipeFormSchema.safeParse({ ...production, components: [{ ...line, stockItemId: id }] })
        .success,
    ).toBe(false);
    expect(recipePayload(recipeFormSchema.parse(serving)).outputItemId).toBeNull();
  });
  it('offers units within the same dimension and cup simulation requires whole counts', () => {
    const units = [
      { code: 'g', dimension: 'MASS' },
      { code: 'ml', dimension: 'VOLUME' },
      { code: 'L', dimension: 'VOLUME' },
    ] as Unit[];
    expect(compatibleUnits(units, 'VOLUME').map((unit) => unit.code)).toEqual(['ml', 'L']);
    expect(
      targetSchema('SERVING').safeParse({ targetQuantity: '2.5', targetUnitCode: 'pcs' }).success,
    ).toBe(false);
    expect(
      targetSchema('SERVING').safeParse({ targetQuantity: '3', targetUnitCode: 'pcs' }).success,
    ).toBe(true);
    expect(
      targetSchema('PRODUCTION').safeParse({ targetQuantity: '2.5', targetUnitCode: 'L' }).success,
    ).toBe(true);
  });
});
