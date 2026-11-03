import { convertQuantity, positiveQuantity, scaleQuantity } from '../src/recipes/recipe.math';

const ml = { code: 'ml', dimension: 'VOLUME', factor: '1' };
const liter = { code: 'L', dimension: 'VOLUME', factor: '1000' };
const gram = { code: 'g', dimension: 'MASS', factor: '1' };
describe('Recipe quantities (planning only)', () => {
  it('converts L to ml without floating-point drift', () => {
    expect(convertQuantity('2.35', liter, ml)).toBe('2350');
    expect(convertQuantity('2350', ml, liter)).toBe('2.35');
  });
  it('scales batch inputs and keeps per-variant quantities distinct', () => {
    expect(scaleQuantity('100', '25000', '10000')).toEqual({ quantity: '250', rounded: false });
    expect(scaleQuantity('150', '3', '1').quantity).toBe('450');
    expect(scaleQuantity('100', '2', '1').quantity).toBe('200');
  });
  it('flags rounding and rejects zero, negative and incompatible units', () => {
    expect(scaleQuantity('1', '1', '3')).toEqual({ quantity: '0.333333', rounded: true });
    expect(() => positiveQuantity('0')).toThrow();
    expect(() => positiveQuantity('-1')).toThrow();
    expect(() => positiveQuantity('0.0000001')).toThrow();
    expect(() => convertQuantity('20', gram, ml)).toThrow('Satuan tidak kompatibel');
  });
});
