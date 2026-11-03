export interface Entity {
  id: string;
  code: string;
  name: string;
}
export interface Location {
  id: string;
  code: string;
  name: string;
  type: 'CENTER' | 'DC' | 'STAND';
  ownership: 'OWNED' | 'PARTNER';
  entityId: string;
  entity: Entity;
  parentId: string | null;
}
export interface LocationRow extends Location {
  parent: { id: string; name: string; code: string; type: Location['type'] } | null;
  _count: { children: number };
}
export interface PageResult<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
export interface Unit {
  id: string;
  code: string;
  name: string;
  dimension: 'MASS' | 'VOLUME' | 'COUNT';
  factor: string;
}
export interface Item {
  id: string;
  code: string;
  name: string;
  baseUnitId: string;
  baseUnit: Unit;
}
export interface Menu {
  id: string;
  name: string;
}
export interface Variant {
  id: string;
  code: string;
  name: string;
  menuId: string;
  menu: Menu;
}
export interface Catalog {
  units: Unit[];
  items: Item[];
  menus: Menu[];
  variants: Variant[];
}
export interface Recipe {
  id: string;
  name: string;
  kind: 'PRODUCTION' | 'SERVING';
  version: number;
  status: 'DRAFT';
  scopeLocationId: string | null;
  scopeLocation?: { id: string; name: string; code: string } | null;
  outputQuantity: string;
  outputUnitCode: string;
  outputItem: Item | null;
  menuVariant: Variant | null;
  components: { stockItemId: string; quantity: string; unitCode: string; stockItem: Item }[];
}
export interface RecipeRow extends Omit<Recipe, 'components'> {
  _count: { components: number };
}
export interface Preview {
  recipeId: string;
  version: number;
  planningOnly: boolean;
  warning: string;
  targetQuantity: string;
  targetUnitCode: string;
  components: { name: string; quantity: string; unitCode: string; rounded: boolean }[];
}
