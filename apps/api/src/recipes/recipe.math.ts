import Decimal from 'decimal.js';

Decimal.set({ precision: 36 });

export interface MeasurementUnit {
  code: string;
  dimension: string;
  factor: string;
}
export function positiveQuantity(value: string) {
  const quantity = new Decimal(value);
  if (
    !quantity.isFinite() ||
    quantity.lte(0) ||
    quantity.gt('999999999') ||
    quantity.decimalPlaces() > 6
  ) {
    throw new Error('Jumlah harus positif, maksimal 999999999 dengan 6 desimal.');
  }
  return quantity;
}

export function convertQuantity(value: string, from: MeasurementUnit, to: MeasurementUnit) {
  if (from.dimension !== to.dimension)
    throw new Error('Satuan tidak kompatibel. Massa tidak dapat dikonversi ke volume.');
  const result = positiveQuantity(value).mul(from.factor).div(to.factor);
  if (result.decimalPlaces() > 6) throw new Error('Konversi melebihi presisi 6 desimal.');
  return result.toFixed();
}

export function scaleQuantity(quantity: string, targetBase: string, recipeOutputBase: string) {
  const exact = positiveQuantity(quantity)
    .mul(positiveQuantity(targetBase))
    .div(positiveQuantity(recipeOutputBase));
  return {
    quantity: exact.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(),
    rounded: exact.decimalPlaces() > 6,
  };
}
