import Dexie, { type EntityTable } from 'dexie';

// Foundation only. No sale is captured or synced until the POS protocol is implemented.
// Version changes must migrate, never delete pending records.
interface PendingCashSale {
  clientSaleId: string;
  standId: string;
  deviceId: string;
  payload: string;
  state: 'pending' | 'syncing' | 'synced' | 'needs_review';
  createdAt: string;
}

export const offlineDb = new Dexie('tehcoyo-pos') as Dexie & {
  pendingCashSales: EntityTable<PendingCashSale, 'clientSaleId'>;
};
offlineDb.version(1).stores({ pendingCashSales: 'clientSaleId, standId, deviceId, state' });
