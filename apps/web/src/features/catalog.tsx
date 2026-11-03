import { useCallback, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Coffee, Layers3, Package, Plus, RefreshCw, Search, X } from 'lucide-react';
import { api, type SessionUser } from '../lib/api';
import type { Catalog as CatalogData } from '../lib/types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ErrorNotice } from '../components/forms';
import { SuccessNotice } from '../components/ui/success-notice';
import {
  GroupDialog,
  ItemDialog,
  VariantDialog,
  type SavedCatalogRecord,
} from './catalog/catalog.forms';
import { matchesSearch, unitLabel } from './catalog/catalog.schemas';

type Tab = 'items' | 'menus';
type OpenForm = { kind: 'item' | 'group' | 'variant'; menuId?: string } | null;

export function Catalog({ user }: { user: SessionUser }) {
  const client = useQueryClient();
  const data = useQuery({ queryKey: ['catalog'], queryFn: () => api<CatalogData>('catalog') });
  const [tab, setTab] = useState<Tab>('items');
  const [queries, setQueries] = useState({ items: '', menus: '' });
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [success, setSuccess] = useState('');
  const dismissSuccess = useCallback(() => setSuccess(''), []);
  const id = useId();
  const canManage = user.role === 'CENTRAL_ADMIN';
  const catalog = data.data;
  const query = queries[tab];
  const items = catalog?.items.filter((item) => matchesSearch(query, item.name, item.code)) ?? [];
  const menuGroups =
    catalog?.menus
      .map((menu) => {
        const variants = catalog.variants.filter((variant) => variant.menuId === menu.id);
        return {
          ...menu,
          variants: matchesSearch(query, menu.name)
            ? variants
            : variants.filter((variant) => matchesSearch(query, variant.name, variant.code)),
          matches:
            matchesSearch(query, menu.name) ||
            variants.some((variant) => matchesSearch(query, variant.name, variant.code)),
        };
      })
      .filter((menu) => menu.matches) ?? [];

  function saved(value: SavedCatalogRecord) {
    // Confirmed records update the list immediately. Refetch failure after a
    // successful write must not invite submitting the same form a second time.
    client.setQueryData<CatalogData>(['catalog'], (current) => {
      if (!current) return current;
      if (value.kind === 'item')
        return {
          ...current,
          items: [
            ...current.items.filter((item) => item.id !== value.record.id),
            value.record,
          ].sort((a, b) => a.name.localeCompare(b.name, 'id')),
        };
      if (value.kind === 'group')
        return {
          ...current,
          menus: [
            ...current.menus.filter((menu) => menu.id !== value.record.id),
            value.record,
          ].sort((a, b) => a.name.localeCompare(b.name, 'id')),
        };
      return {
        ...current,
        variants: [
          ...current.variants.filter((variant) => variant.id !== value.record.id),
          value.record,
        ].sort((a, b) => a.name.localeCompare(b.name, 'id')),
      };
    });
    setOpenForm(null);
    setQueries((current) => ({ ...current, [value.kind === 'item' ? 'items' : 'menus']: '' }));
    setSuccess(
      value.kind === 'item'
        ? 'Barang berhasil ditambahkan.'
        : value.kind === 'group'
          ? 'Kelompok minuman berhasil ditambahkan. Selanjutnya tambahkan rasa dari kelompok tersebut.'
          : 'Menu minuman berhasil ditambahkan.',
    );
    void client.invalidateQueries({ queryKey: ['catalog'] });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Kelola bahan, kemasan, dan minuman yang dijual. Pilih daftar yang ingin kamu atur.
      </p>
      <div
        role="tablist"
        aria-label="Daftar barang dan menu"
        className="inline-flex max-w-full gap-1 rounded-xl border border-border bg-white p-1"
      >
        {(
          [
            { key: 'items', label: 'Barang', icon: Package, count: catalog?.items.length },
            { key: 'menus', label: 'Menu Minuman', icon: Coffee, count: catalog?.variants.length },
          ] as const
        ).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            aria-selected={tab === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={tab === key ? 0 : -1}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'items'
                    : event.key === 'End'
                      ? 'menus'
                      : tab === 'items'
                        ? 'menus'
                        : 'items';
                setTab(next);
                document.getElementById(`${id}-${next}-tab`)?.focus();
              }
            }}
            onClick={() => setTab(key)}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold sm:px-4 ${tab === key ? 'bg-emerald-50 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
            {count !== undefined && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}-tab`}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {tab === 'items' ? 'Daftar barang' : 'Menu minuman'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'items'
                ? 'Bahan dan kemasan, bukan jumlah stok yang tersedia.'
                : 'Susun rasa per kelompok minuman. Setiap menu dijual per cup.'}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {tab === 'menus' && catalog && catalog.menus.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccess('');
                    setOpenForm({ kind: 'group' });
                  }}
                >
                  <Layers3 size={17} />
                  Buat kelompok
                </Button>
              )}
              <Button
                disabled={!catalog}
                onClick={() => {
                  setSuccess('');
                  setOpenForm({
                    kind: tab === 'items' ? 'item' : catalog?.menus.length ? 'variant' : 'group',
                  });
                }}
              >
                <Plus size={18} />
                {tab === 'items'
                  ? 'Tambah barang'
                  : catalog?.menus.length
                    ? 'Tambah menu'
                    : 'Buat kelompok minuman'}
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground"
            />
            <Input
              aria-label={tab === 'items' ? 'Cari barang' : 'Cari menu minuman'}
              placeholder={
                tab === 'items'
                  ? 'Cari nama atau kode barang…'
                  : 'Cari kelompok, rasa, atau kode menu…'
              }
              value={query}
              onChange={(event) => setQueries({ ...queries, [tab]: event.target.value })}
              className="pl-11 pr-11"
            />
            {query && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setQueries({ ...queries, [tab]: '' })}
                className="absolute right-0 top-0 grid size-11 place-items-center rounded-r-xl text-muted-foreground"
              >
                <X size={17} />
              </button>
            )}
          </div>
          {data.isFetching && !data.isPending && (
            <span role="status" className="text-xs text-muted-foreground">
              Memperbarui…
            </span>
          )}
        </div>
        {data.error && (
          <div className="space-y-2">
            <ErrorNotice error={data.error} />
            <Button
              variant="outline"
              disabled={data.isFetching}
              onClick={() => void data.refetch()}
            >
              <RefreshCw size={16} />
              Coba lagi
            </Button>
          </div>
        )}
        {data.isPending && (
          <div role="status" aria-label="Memuat daftar" className="space-y-2">
            {[1, 2, 3].map((key) => (
              <div key={key} className="h-20 animate-pulse rounded-xl bg-white" />
            ))}
            <p className="text-sm text-muted-foreground">Memuat daftar…</p>
          </div>
        )}
        {catalog &&
          tab === 'items' &&
          (items.length ? (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-border bg-white sm:block">
                <table className="w-full table-fixed text-left text-sm">
                  <caption className="sr-only">Daftar bahan dan kemasan</caption>
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <th scope="col" className="w-[42%] px-5 py-3 font-medium">
                        Nama barang
                      </th>
                      <th scope="col" className="w-[28%] px-5 py-3 font-medium">
                        Kode barang
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Stok dihitung dalam
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50">
                        <td className="break-words px-5 py-4 font-semibold">{item.name}</td>
                        <td className="break-all px-5 py-4 text-muted-foreground">{item.code}</td>
                        <td className="px-5 py-4">{unitLabel(item.baseUnit.code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-2 sm:hidden">
                {items.map((item) => (
                  <li key={item.id}>
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-semibold">{item.name}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {item.code}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-xs">
                          {unitLabel(item.baseUnit.code)}
                        </span>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ListEmpty
              searched={!!query.trim()}
              title="Belum ada barang"
              description="Daftarkan bahan atau kemasan agar nanti bisa digunakan dalam resep."
            />
          ))}
        {catalog &&
          tab === 'menus' &&
          (menuGroups.length ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {menuGroups.map((menu) => (
                <Card key={menu.id} className="p-0">
                  <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <Coffee size={20} aria-hidden="true" className="shrink-0 text-primary" />
                      <h3 className="break-words font-bold">{menu.name}</h3>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        className="shrink-0 px-2 text-primary"
                        onClick={() => {
                          setSuccess('');
                          setOpenForm({ kind: 'variant', menuId: menu.id });
                        }}
                      >
                        <Plus size={16} />
                        Tambah rasa
                      </Button>
                    )}
                  </div>
                  {menu.variants.length ? (
                    <ul className="divide-y divide-border">
                      {menu.variants.map((variant) => (
                        <li
                          key={variant.id}
                          className="flex items-center justify-between gap-3 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{variant.name}</p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {variant.code}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-xs">
                            Per cup
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Kelompok ini belum punya rasa / menu.
                      </p>
                      {canManage && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-primary">
                          Gunakan “Tambah rasa” untuk melanjutkan.
                          <ChevronRight size={14} />
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <ListEmpty
              searched={!!query.trim()}
              title="Belum ada kelompok minuman"
              description="Mulai dengan kelompok seperti Es Teh, lalu tambahkan rasa Original, Coklat, atau rasa lainnya."
            />
          ))}
        {catalog && (
          <p className="text-xs text-muted-foreground">
            {tab === 'items'
              ? `${items.length} barang ditampilkan`
              : `${menuGroups.length} kelompok ditampilkan`}{' '}
            · Pencarian pada daftar yang sudah dimuat.
            {(tab === 'items'
              ? catalog.items.length >= 500
              : catalog.variants.length >= 500 || catalog.menus.length >= 500) &&
              ' Daftar dibatasi 500 data; pencarian belum mencakup seluruh database.'}
          </p>
        )}
      </section>
      {canManage && catalog && openForm?.kind === 'item' && (
        <ItemDialog catalog={catalog} onClose={() => setOpenForm(null)} onSaved={saved} />
      )}
      {canManage && openForm?.kind === 'group' && (
        <GroupDialog onClose={() => setOpenForm(null)} onSaved={saved} />
      )}
      {canManage && catalog && openForm?.kind === 'variant' && (
        <VariantDialog
          catalog={catalog}
          menuId={openForm.menuId}
          onClose={() => setOpenForm(null)}
          onSaved={saved}
        />
      )}
      {success && <SuccessNotice key={success} message={success} onDismiss={dismissSuccess} />}
    </div>
  );
}

function ListEmpty({
  searched,
  title,
  description,
}: {
  searched: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center">
      <Package className="mx-auto mb-3 text-muted-foreground" size={30} aria-hidden="true" />
      <h3 className="font-semibold">{searched ? 'Tidak ada hasil yang cocok' : title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {searched
          ? 'Coba nama atau kode lain, atau hapus pencarian untuk melihat daftar.'
          : description}
      </p>
    </div>
  );
}
