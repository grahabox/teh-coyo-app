import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SessionUser } from '../lib/api';
import type { LocationRow, PageResult } from '../lib/types';
import { useDebounced } from '../lib/use-debounced';
import { PagedPicker } from '../components/paged-picker';
import { Pagination } from '../components/pagination';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ErrorNotice } from '../components/forms';
import type { RegisterLeaveGuard } from './recipes/leave-guard';
import {
  kindNames,
  statusNames,
  type Movement,
  type StockDocument,
  type StockKind,
  type StockRow,
} from './inventory/types';
import { StockEditor } from './inventory/stock.editor';
import { StockDetail } from './inventory/stock.detail';

export function Inventory({
  user,
  registerLeaveGuard,
}: {
  user: SessionUser;
  registerLeaveGuard: RegisterLeaveGuard;
}) {
  const client = useQueryClient();
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [tab, setTab] = useState<'balances' | 'documents' | 'movements'>('balances');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<StockKind | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const debounced = useDebounced(query);
  const path = `inventory/${tab}?locationId=${location?.id}&q=${encodeURIComponent(debounced)}&page=${page}&perPage=25`;
  const data = useQuery({
    queryKey: ['inventory', tab, location?.id, debounced, page],
    enabled: !!location && !editor && !detail,
    queryFn: () => api<PageResult<StockRow | StockDocument | Movement>>(path),
  });
  const own =
    user.role === 'CENTRAL_ADMIN' || (user.role === 'DC_ADMIN' && location?.id === user.locationId);
  if (editor && location)
    return (
      <StockEditor
        kind={editor}
        location={location}
        registerLeaveGuard={registerLeaveGuard}
        onBack={() => setEditor(null)}
        onSaved={(doc) => {
          setEditor(null);
          setDetail(doc.id);
          void client.invalidateQueries({ queryKey: ['inventory'] });
        }}
      />
    );
  if (detail)
    return (
      <StockDetail
        id={detail}
        user={user}
        onBack={() => setDetail(null)}
        registerLeaveGuard={registerLeaveGuard}
      />
    );
  const kinds: StockKind[] =
    user.role === 'CENTRAL_ADMIN'
      ? ['OPENING', 'RECEIPT', 'ADJUSTMENT', 'TRANSFER']
      : ['RECEIPT', 'TRANSFER'];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Stok & Mutasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jumlah barang per lokasi dan dokumen yang mengubahnya. Belum mencakup nilai stok,
          produksi, penjualan atau tagihan.
        </p>
      </div>
      <Card className="space-y-3">
        <label className="text-sm font-semibold" htmlFor="stock-location">
          Lokasi pencatatan
        </label>
        <PagedPicker<LocationRow>
          id="stock-location"
          endpoint="locations/page"
          value={location}
          placeholder="Pilih lokasi"
          onSelect={(value) => {
            setLocation(value);
            setPage(1);
            setQuery('');
          }}
        />
        {location && (
          <p className="text-xs text-muted-foreground">
            {location.ownership === 'PARTNER'
              ? 'Jumlah fisik di stand mitra; bukan pengakuan kepemilikan atau tagihan.'
              : 'Jangan mencatat stok fisik yang sama dua kali pada pusat dan DC yang menyatu.'}
          </p>
        )}
      </Card>
      {location ? (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Informasi stok">
            {(['balances', 'documents', 'movements'] as const).map((t) => (
              <Button
                key={t}
                role="tab"
                aria-selected={tab === t}
                variant={tab === t ? 'default' : 'outline'}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                  setQuery('');
                }}
              >
                {t === 'balances'
                  ? 'Saldo barang'
                  : t === 'documents'
                    ? 'Dokumen'
                    : 'Riwayat mutasi'}
              </Button>
            ))}
          </div>
          {own && (
            <div className="flex flex-wrap gap-2">
              {kinds
                .filter((k) => k !== 'TRANSFER' || location.type !== 'STAND')
                .map((kind) => (
                  <Button key={kind} variant="outline" onClick={() => setEditor(kind)}>
                    + {kindNames[kind]}
                  </Button>
                ))}
            </div>
          )}
          <Input
            aria-label="Cari stok atau dokumen"
            placeholder={
              tab === 'documents'
                ? 'Cari referensi atau keterangan…'
                : 'Cari nama atau kode barang…'
            }
            value={query}
            maxLength={100}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <ErrorNotice error={data.error} />
          {data.error && (
            <Button variant="outline" onClick={() => void data.refetch()}>
              Coba lagi
            </Button>
          )}
          {data.isFetching && <p role="status">Memuat…</p>}
          {data.data && !data.isFetching && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.data.items.map((row) => {
                  if (tab === 'balances') {
                    const r = row as StockRow;
                    return (
                      <Card key={r.id} className="space-y-2">
                        <h3 className="font-bold">{r.name}</h3>
                        <p className="text-xs text-muted-foreground">{r.code}</p>
                        <p className="text-lg font-semibold">
                          {r.quantity === null
                            ? 'Belum ditetapkan'
                            : `${r.quantity} ${r.baseUnit.code}`}
                        </p>
                        {r.openingDate && (
                          <p className="text-xs text-muted-foreground">
                            Saldo awal sejak {r.openingDate.slice(0, 10)}
                          </p>
                        )}
                      </Card>
                    );
                  }
                  if (tab === 'documents') {
                    const r = row as StockDocument;
                    return (
                      <Card key={r.id} className="space-y-2">
                        <h3 className="break-words font-bold">{r.reference}</h3>
                        <p className="text-sm">
                          {kindNames[r.kind]} · {statusNames[r.status]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.businessDate.slice(0, 10)} · {r.location.name}
                          {r.destination && ` → ${r.destination.name}`}
                        </p>
                        <Button variant="outline" onClick={() => setDetail(r.id)}>
                          Buka dokumen
                        </Button>
                      </Card>
                    );
                  }
                  const r = row as Movement;
                  return (
                    <Card key={r.id} className="space-y-2">
                      <h3 className="font-bold">{r.line.stockItem.name}</h3>
                      <p className="text-sm">
                        {r.kind === 'SHIPMENT'
                          ? 'Pengiriman'
                          : r.kind === 'TRANSFER_RECEIPT'
                            ? 'Penerimaan transfer'
                            : kindNames[r.kind as StockKind]}{' '}
                        · {r.businessDate.slice(0, 10)}
                      </p>
                      <p>
                        Perubahan {r.quantity} {r.line.stockItem.baseUnit.code}
                      </p>
                      <p className="text-sm">Saldo sesudah: {r.balanceAfter}</p>
                      <Button variant="outline" onClick={() => setDetail(r.line.document.id)}>
                        {r.line.document.reference}
                      </Button>
                    </Card>
                  );
                })}
              </div>
              {!data.data.items.length && (
                <Card>
                  <p>Belum ada {tab === 'documents' ? 'dokumen' : 'mutasi'} yang sesuai.</p>
                </Card>
              )}
              <Pagination {...data.data} busy={data.isFetching} onPage={setPage} />
            </>
          )}
        </>
      ) : (
        <Card>
          <p>
            Pilih lokasi untuk melihat barang, saldo dan dokumennya. Tidak ada saldo yang diisi
            otomatis.
          </p>
        </Card>
      )}
    </div>
  );
}
