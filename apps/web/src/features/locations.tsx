import { useCallback, useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Store,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { api, type SessionUser } from '../lib/api';
import type { Entity, Location, LocationRow, PageResult } from '../lib/types';
import { useDebounced } from '../lib/use-debounced';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ErrorNotice, Select } from '../components/forms';
import { Pagination } from '../components/pagination';
import { PagedPicker } from '../components/paged-picker';
import { SuccessNotice } from '../components/ui/success-notice';
import { EntityDialog, LocationDetailDialog, LocationDialog } from './locations/location.dialogs';
import { locationLabel } from './locations/location.schemas';

type Tab = Location['type'] | 'ENTITY';
const tabs = [
  { key: 'CENTER', name: 'Pusat', icon: Building2 },
  { key: 'DC', name: 'DC', icon: Warehouse },
  { key: 'STAND', name: 'Stand', icon: Store },
  { key: 'ENTITY', name: 'Pemilik Usaha', icon: Users },
] as const;

export function Locations({ user }: { user: SessionUser }) {
  const central = user.role === 'CENTRAL_ADMIN';
  const [tab, setTab] = useState<Tab>(central ? 'DC' : user.role === 'DC_ADMIN' ? 'DC' : 'STAND');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [ownership, setOwnership] = useState('');
  const [parent, setParent] = useState<LocationRow | null>(null);
  const [openForm, setOpenForm] = useState<Tab | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const q = useDebounced(search);
  const queryClient = useQueryClient();
  const id = useId();
  const visibleTabs = central
    ? tabs
    : user.role === 'DC_ADMIN'
      ? tabs.filter((item) => item.key === 'DC' || item.key === 'STAND')
      : tabs.filter((item) => item.key === 'STAND');
  const query = new URLSearchParams({ page: String(page), perPage: '25', q });
  if (tab !== 'ENTITY') query.set('type', tab);
  if (tab === 'STAND' && ownership) query.set('ownership', ownership);
  if (tab !== 'ENTITY' && parent) query.set('parentId', parent.id);
  const endpoint = tab === 'ENTITY' ? 'entities/page' : 'locations/page';
  const data = useQuery({
    queryKey: ['organization-page', tab, q, page, ownership, parent?.id ?? null],
    queryFn: () => api<PageResult<LocationRow | Entity>>(`${endpoint}?${query}`),
  });
  const dismissSuccess = useCallback(() => setSuccess(''), []);
  const name = tab === 'ENTITY' ? 'pemilik usaha' : locationLabel(tab);
  const rows = data.data?.items ?? [];

  useEffect(() => {
    if (data.data && !data.isFetching && page > Math.max(1, data.data.totalPages))
      setPage(Math.max(1, data.data.totalPages));
  }, [data.data, data.isFetching, page]);

  function selectTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSearch('');
    setOwnership('');
    setParent(null);
  }
  function saved(record: Location | Entity) {
    setOpenForm(null);
    setPage(1);
    setSearch('');
    setOwnership('');
    // A user can choose a different parent inside the add dialog. Do not leave
    // the newly-created record hidden behind an incompatible list filter.
    if ('parentId' in record && parent && record.parentId !== parent.id) setParent(null);
    setSuccess(
      `${tab === 'ENTITY' ? 'Pemilik usaha' : tab === 'DC' ? 'DC' : tab === 'STAND' ? 'Stand' : 'Pusat'} “${record.name}” berhasil ditambahkan.`,
    );
    void queryClient.invalidateQueries({ queryKey: ['organization-page'] });
    void queryClient.invalidateQueries({ queryKey: ['organization-options'] });
    void queryClient.invalidateQueries({ queryKey: ['locations'] });
    void queryClient.invalidateQueries({ queryKey: ['entities'] });
    void queryClient.invalidateQueries({ queryKey: ['location-detail'] });
  }
  function viewChildren(location: LocationRow) {
    setDetailId(null);
    setTab(location.type === 'CENTER' ? 'DC' : 'STAND');
    setParent(location);
    setPage(1);
    setSearch('');
    setOwnership('');
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Kelola pusat, DC, dan stand. Cari lokasi atau lihat stand di bawah masing-masing DC.
      </p>
      <div
        role="tablist"
        aria-label="Jenis lokasi"
        className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 sm:inline-flex"
      >
        {visibleTabs.map(({ key, name, icon: Icon }, index) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            aria-selected={tab === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => selectTab(key)}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? visibleTabs[0]
                    : event.key === 'End'
                      ? visibleTabs[visibleTabs.length - 1]
                      : visibleTabs[
                          (index + (event.key === 'ArrowLeft' ? -1 : 1) + visibleTabs.length) %
                            visibleTabs.length
                        ];
                selectTab(next.key);
                document.getElementById(`${id}-${next.key}-tab`)?.focus();
              }
            }}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${tab === key ? 'bg-emerald-50 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Icon size={17} aria-hidden="true" />
            {name}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}-tab`}
        className="space-y-4"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold">
              {tab === 'ENTITY' ? 'Pemilik usaha' : `Daftar ${name}`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'ENTITY'
                ? 'Pemilik Teh Coyo dan mitra. Bukan pengaturan pajak.'
                : tab === 'DC'
                  ? 'Lihat DC dan jumlah stand yang ditangani.'
                  : tab === 'STAND'
                    ? 'Cari stand berdasarkan DC pembina dan kepemilikannya.'
                    : 'Lokasi pusat utama Teh Coyo.'}
            </p>
          </div>
          {central && (
            <Button
              onClick={() => {
                setSuccess('');
                setOpenForm(tab);
              }}
            >
              <Plus size={18} />
              Tambah {name}
            </Button>
          )}
        </div>
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="absolute left-3 top-3.5 text-muted-foreground"
            />
            <Input
              aria-label={`Cari ${name}`}
              value={search}
              maxLength={100}
              placeholder={`Cari nama atau kode ${name}…`}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-10 pr-10"
            />
            {search && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                className="absolute right-0 top-0 grid size-11 place-items-center"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {(tab === 'DC' || tab === 'STAND') && central && (
            <div>
              <label htmlFor={`${id}-filter`} className="sr-only">
                {tab === 'DC' ? 'Filter pusat' : 'Filter DC'}
              </label>
              <PagedPicker<LocationRow>
                id={`${id}-filter`}
                endpoint={`locations/page?type=${tab === 'DC' ? 'CENTER' : 'DC'}`}
                value={parent}
                placeholder={tab === 'DC' ? 'Semua pusat' : 'Semua DC'}
                onSelect={(location) => {
                  setParent(location);
                  setPage(1);
                }}
              />
              {parent && (
                <button
                  type="button"
                  className="mt-1 min-h-9 text-xs text-primary"
                  onClick={() => {
                    setParent(null);
                    setPage(1);
                  }}
                >
                  Hapus filter {tab === 'DC' ? 'pusat' : 'DC'}
                </button>
              )}
            </div>
          )}
          {tab === 'STAND' && (
            <div>
              <label htmlFor={`${id}-ownership`} className="sr-only">
                Filter kepemilikan stand
              </label>
              <Select
                id={`${id}-ownership`}
                value={ownership}
                onChange={(event) => {
                  setOwnership(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Semua kepemilikan</option>
                <option value="OWNED">Milik Teh Coyo</option>
                <option value="PARTNER">Milik mitra</option>
              </Select>
            </div>
          )}
        </div>
        {parent && !central && (
          <p className="text-sm text-primary">
            Stand di bawah {parent.name}{' '}
            <button
              className="ml-2 underline"
              type="button"
              onClick={() => {
                setParent(null);
                setPage(1);
              }}
            >
              Hapus filter
            </button>
          </p>
        )}
        {q !== search && (
          <p role="status" className="text-xs text-muted-foreground">
            Menyiapkan pencarian…
          </p>
        )}
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
          <div role="status" className="space-y-2">
            <p className="text-sm text-muted-foreground">Memuat daftar…</p>
            {[1, 2, 3].map((key) => (
              <div key={key} className="h-16 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        )}
        {data.data && !rows.length && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
            <MapPin size={28} className="mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold">
              {q || parent || ownership ? 'Tidak ada hasil yang cocok' : `Belum ada ${name}`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {q || parent || ownership
                ? 'Coba nama lain atau ubah filter yang digunakan.'
                : central
                  ? `Gunakan “Tambah ${name}” untuk mulai mendaftarkan data.`
                  : 'Belum ada data dalam cakupan akunmu.'}
            </p>
          </div>
        )}
        {!!rows.length && (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-white sm:block">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">Daftar {name}</caption>
                <thead className="border-b border-border bg-muted">
                  <tr>
                    <th className="w-[32%] px-4 py-3" scope="col">
                      Nama
                    </th>
                    <th className="w-[20%] px-4 py-3" scope="col">
                      Kode
                    </th>
                    <th className="px-4 py-3" scope="col">
                      {tab === 'ENTITY'
                        ? 'Keterangan'
                        : tab === 'DC'
                          ? 'Pusat / stand binaan'
                          : tab === 'STAND'
                            ? 'DC / kepemilikan'
                            : 'Pemilik / jumlah DC'}
                    </th>
                    {tab !== 'ENTITY' && (
                      <th className="w-24 px-4 py-3" scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/50">
                      <td className="break-words px-4 py-4 font-semibold">{row.name}</td>
                      <td className="break-all px-4 py-4 text-muted-foreground">{row.code}</td>
                      <td className="px-4 py-4">
                        <RowInfo row={row} tab={tab} />
                      </td>
                      {tab !== 'ENTITY' && (
                        <td className="px-2 py-3">
                          <Button
                            variant="ghost"
                            onClick={() => setDetailId(row.id)}
                            aria-label={`Lihat detail ${row.name}`}
                            className="px-2 text-primary"
                          >
                            Detail
                            <ChevronRight size={15} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white sm:hidden">
              {rows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{row.name}</h3>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{row.code}</p>
                      <div className="mt-2 text-xs">
                        <RowInfo row={row} tab={tab} />
                      </div>
                    </div>
                    {tab !== 'ENTITY' && (
                      <Button
                        variant="ghost"
                        className="shrink-0 px-2 text-primary"
                        aria-label={`Lihat detail ${row.name}`}
                        onClick={() => setDetailId(row.id)}
                      >
                        <ChevronRight size={19} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {data.data && (
          <Pagination {...data.data} busy={data.isFetching || q !== search} onPage={setPage} />
        )}
        <p className="text-xs text-muted-foreground">
          Pencarian dan halaman diproses server. Saat ini tersedia tambah dan lihat;
          edit/nonaktifkan belum diaktifkan.
        </p>
      </section>
      {central && openForm === 'ENTITY' && (
        <EntityDialog onClose={() => setOpenForm(null)} onSaved={saved} />
      )}
      {central && openForm && openForm !== 'ENTITY' && (
        <LocationDialog
          type={openForm}
          initialParent={parent ?? undefined}
          onClose={() => setOpenForm(null)}
          onSaved={saved}
        />
      )}
      {detailId && (
        <LocationDetailDialog
          id={detailId}
          onClose={() => setDetailId(null)}
          onViewChildren={viewChildren}
        />
      )}
      {success && <SuccessNotice key={success} message={success} onDismiss={dismissSuccess} />}
    </div>
  );
}

function RowInfo({ row, tab }: { row: LocationRow | Entity; tab: Tab }) {
  if (tab === 'ENTITY')
    return <span className="text-muted-foreground">Pemilik usaha terdaftar</span>;
  const location = row as LocationRow;
  return (
    <div className="space-y-1">
      <p className="break-words">
        {tab === 'CENTER' ? location.entity.name : (location.parent?.name ?? '—')}
      </p>
      <p className="text-xs text-muted-foreground">
        {tab === 'STAND'
          ? location.ownership === 'OWNED'
            ? 'Milik sendiri'
            : `Mitra · ${location.entity.name}`
          : `${location._count.children} ${tab === 'DC' ? 'stand binaan' : 'DC'}`}
      </p>
    </div>
  );
}
