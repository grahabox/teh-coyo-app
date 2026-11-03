import { describe, expect, it } from 'vitest';
import {
  itemFormSchema,
  menuGroupFormSchema,
  variantFormSchema,
  matchesSearch,
  unitLabel,
} from './catalog.schemas';

describe('Barang & Menu input rules', () => {
  it('reports blank item fields with helpful messages', () => {
    const result = itemFormSchema.safeParse({ name: '', code: '', baseUnitId: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['name', 'code', 'baseUnitId']),
      );
      expect(result.error.issues[0].message).toBe('Isi nama barang terlebih dahulu.');
    }
  });
  it('trims names, enforces code characters, and needs a valid unit/group', () => {
    const id = 'e60615ec-e72e-4c8d-8b67-ac3e11ea7145';
    expect(
      itemFormSchema.parse({ name: '  Powder Coklat  ', code: ' CHOC-01 ', baseUnitId: id }).name,
    ).toBe('Powder Coklat');
    expect(
      itemFormSchema.safeParse({ name: 'Powder', code: 'invalid code', baseUnitId: id }).success,
    ).toBe(false);
    expect(menuGroupFormSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(
      variantFormSchema.safeParse({ name: 'Original', code: 'ORIGINAL', menuId: '' }).success,
    ).toBe(false);
  });
  it('searches case-insensitively by name/code/group and shows friendly units', () => {
    expect(matchesSearch(' powder ', 'Powder Coklat', 'CHOC')).toBe(true);
    expect(matchesSearch('choc', 'Powder Coklat', 'CHOC')).toBe(true);
    expect(matchesSearch('missing', 'Powder Coklat', 'CHOC')).toBe(false);
    expect(unitLabel('ml')).toBe('Mililiter (ml)');
    expect(unitLabel('other')).toBe('other');
  });
});
