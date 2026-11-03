// Illustrations only: not Teh Coyo SOP, real stock, actual yield or agreed tariffs.
export const dummyEntities = [
  { key: 'company', code: 'DUMMY-COYO', name: 'Teh Coyo — Dummy' },
  { key: 'partner-a', code: 'DUMMY-MITRA-A', name: 'Usaha Mitra A — Dummy' },
  { key: 'partner-b', code: 'DUMMY-MITRA-B', name: 'Usaha Mitra B — Dummy' },
  { key: 'partner-c', code: 'DUMMY-MITRA-C', name: 'Usaha Mitra C — Dummy' },
];

export const dummyCities = [
  { key: 'cirebon', code: 'CRB', name: 'Cirebon' },
  { key: 'kuningan', code: 'KNG', name: 'Kuningan' },
  { key: 'majalengka', code: 'MJL', name: 'Majalengka' },
  { key: 'indramayu', code: 'IDM', name: 'Indramayu' },
  { key: 'bandung', code: 'BDG', name: 'Bandung' },
  { key: 'tasikmalaya', code: 'TSK', name: 'Tasikmalaya' },
];

export const dummyItems = [
  { key: 'tea-leaf', code: 'DUMMY-BAHAN-TEH', name: 'Bahan Teh — Dummy', unit: 'g' },
  { key: 'sugar', code: 'DUMMY-GULA', name: 'Gula — Dummy', unit: 'g' },
  { key: 'water', code: 'DUMMY-AIR', name: 'Air — Dummy', unit: 'ml' },
  { key: 'tea-base', code: 'DUMMY-TEH-DASAR', name: 'Teh Dasar — Dummy', unit: 'ml' },
  { key: 'chocolate', code: 'DUMMY-POWDER-COKLAT', name: 'Powder Coklat — Dummy', unit: 'g' },
  { key: 'melon', code: 'DUMMY-POWDER-MELON', name: 'Powder Melon — Dummy', unit: 'g' },
  { key: 'matcha', code: 'DUMMY-POWDER-MATCHA', name: 'Powder Matcha — Dummy', unit: 'g' },
  { key: 'taro', code: 'DUMMY-POWDER-TARO', name: 'Powder Taro — Dummy', unit: 'g' },
  { key: 'strawberry', code: 'DUMMY-POWDER-STROBERI', name: 'Powder Stroberi — Dummy', unit: 'g' },
  { key: 'milk', code: 'DUMMY-SUSU-KENTAL', name: 'Susu Kental Manis — Dummy', unit: 'g' },
  { key: 'ice', code: 'DUMMY-ES-BATU', name: 'Es Batu — Dummy', unit: 'g' },
  { key: 'cup', code: 'DUMMY-CUP', name: 'Cup Kosong — Dummy', unit: 'pcs' },
  { key: 'lid', code: 'DUMMY-TUTUP-CUP', name: 'Tutup Cup — Dummy', unit: 'pcs' },
  { key: 'straw', code: 'DUMMY-SEDOTAN', name: 'Sedotan — Dummy', unit: 'pcs' },
] as const;

export const dummyFlavors = [
  {
    key: 'original',
    code: 'DUMMY-ORIGINAL',
    name: 'Original — Dummy',
    teaMl: '180',
    powder: null,
    powderG: null,
    milkG: null,
  },
  {
    key: 'chocolate',
    code: 'DUMMY-COKLAT',
    name: 'Coklat — Dummy',
    teaMl: '120',
    powder: 'chocolate',
    powderG: '20',
    milkG: '15',
  },
  {
    key: 'melon',
    code: 'DUMMY-MELON',
    name: 'Melon — Dummy',
    teaMl: '140',
    powder: 'melon',
    powderG: '15',
    milkG: '10',
  },
  {
    key: 'matcha',
    code: 'DUMMY-MATCHA',
    name: 'Matcha — Dummy',
    teaMl: '130',
    powder: 'matcha',
    powderG: '18',
    milkG: '15',
  },
  {
    key: 'taro',
    code: 'DUMMY-TARO',
    name: 'Taro — Dummy',
    teaMl: '120',
    powder: 'taro',
    powderG: '20',
    milkG: '15',
  },
  {
    key: 'strawberry',
    code: 'DUMMY-STROBERI',
    name: 'Stroberi — Dummy',
    teaMl: '140',
    powder: 'strawberry',
    powderG: '15',
    milkG: '10',
  },
] as const;

export interface DummyRecipe {
  key: string;
  name: string;
  kind: 'PRODUCTION' | 'SERVING';
  scopeDc?: string;
  outputItem?: string;
  menuFlavor?: string;
  outputQuantity: string;
  outputUnitCode: string;
  components: { item: string; quantity: string; unitCode: string }[];
}

export function dummyRecipeDefinitions(): DummyRecipe[] {
  const production = (
    key: string,
    liters: string,
    leafG: string,
    sugarG: string,
    scopeDc?: string,
  ): DummyRecipe => ({
    key,
    name: `Teh Dasar ${liters} L${scopeDc ? ' · Cirebon' : ''} — Dummy`,
    kind: 'PRODUCTION',
    scopeDc,
    outputItem: 'tea-base',
    outputQuantity: liters,
    outputUnitCode: 'L',
    components: [
      { item: 'tea-leaf', quantity: leafG, unitCode: 'g' },
      { item: 'sugar', quantity: sugarG, unitCode: 'g' },
      { item: 'water', quantity: liters, unitCode: 'L' },
    ],
  });
  const serving: DummyRecipe[] = dummyFlavors.map((flavor) => ({
    key: `serving-${flavor.key}`,
    name: `Takaran ${flavor.name}`,
    kind: 'SERVING',
    menuFlavor: flavor.key,
    outputQuantity: '1',
    outputUnitCode: 'pcs',
    components: [
      { item: 'tea-base', quantity: flavor.teaMl, unitCode: 'ml' },
      ...(flavor.powder ? [{ item: flavor.powder, quantity: flavor.powderG!, unitCode: 'g' }] : []),
      ...(flavor.milkG ? [{ item: 'milk', quantity: flavor.milkG, unitCode: 'g' }] : []),
      { item: 'ice', quantity: '80', unitCode: 'g' },
      { item: 'cup', quantity: '1', unitCode: 'pcs' },
      { item: 'lid', quantity: '1', unitCode: 'pcs' },
      { item: 'straw', quantity: '1', unitCode: 'pcs' },
    ],
  }));
  return [
    production('production-10', '10', '100', '800'),
    production('production-20', '20', '200', '1600'),
    production('production-40', '40', '400', '3200'),
    production('production-cirebon-10', '10', '100', '800', 'cirebon'),
    ...serving,
    {
      ...serving[1],
      key: 'serving-cirebon-chocolate',
      name: 'Takaran Coklat · Cirebon — Dummy',
      scopeDc: 'cirebon',
    },
  ];
}
