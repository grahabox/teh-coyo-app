import { useCallback, useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coffee, FlaskConical, Plus, Search, X } from 'lucide-react';
import { api, type SessionUser } from '../lib/api';
import type { PageResult, Recipe, RecipeRow } from '../lib/types';
import { useDebounced } from '../lib/use-debounced';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Empty, ErrorNotice } from '../components/forms';
import { Pagination } from '../components/pagination';
import { SuccessNotice } from '../components/ui/success-notice';
import { RecipeEditor } from './recipes/recipe.editor';
import { RecipeDetail } from './recipes/recipe.detail';
import type { RegisterLeaveGuard } from './recipes/leave-guard';

export function Recipes({
  user,
  registerLeaveGuard,
}: {
  user: SessionUser;
  registerLeaveGuard: RegisterLeaveGuard;
}) {
  const [kind, setKind] = useState<Recipe['kind']>('PRODUCTION');
  const [screen, setScreen] = useState<'list' | 'create' | 'detail'>('list');
  const [recipeId, setRecipeId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState('');
  const q = useDebounced(search);
  const id = useId();
  const client = useQueryClient();
  const writer = user.role === 'CENTRAL_ADMIN' || user.role === 'DC_ADMIN';
  const data = useQuery({
    queryKey: ['recipe-page', kind, q, page],
    enabled: writer && screen === 'list',
    queryFn: () =>
      api<PageResult<RecipeRow>>(
        `recipes/page?kind=${kind}&q=${encodeURIComponent(q)}&page=${page}&perPage=25`,
      ),
  });
  const dismiss = useCallback(() => setSuccess(''), []);
  useEffect(() => {
    if (data.data && !data.isFetching && page > Math.max(1, data.data.totalPages))
      setPage(Math.max(1, data.data.totalPages));
  }, [data.data, data.isFetching, page]);
  if (!writer)
    return (
      <Empty>
        Pengaturan draft resep hanya tersedia untuk admin pusat dan DC. Resep operasional stand
        belum diterbitkan.
      </Empty>
    );
  function saved(recipe: Recipe) {
    setKind(recipe.kind);
    setPage(1);
    setSearch('');
    setScreen('list');
    setSuccess(
      `Draft “${recipe.name}” berhasil disimpan. Resep belum aktif dan stok tidak berubah.`,
    );
    void client.invalidateQueries({ queryKey: ['recipe-page'] });
    void client.invalidateQueries({ queryKey: ['recipes'] });
  }
  function open(recipe: RecipeRow) {
    setRecipeId(recipe.id);
    setScreen('detail');
    setSuccess('');
  }
  if (screen === 'create')
    return (
      <RecipeEditor
        kind={kind}
        user={user}
        onBack={() => setScreen('list')}
        onSaved={saved}
        registerLeaveGuard={registerLeaveGuard}
      />
    );
  if (screen === 'detail')
    return <RecipeDetail recipeId={recipeId} onBack={() => setScreen('list')} />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Atur resep produksi teh dasar dan takaran minuman per cup. Buka resep untuk melihat bahan
        atau menghitung kebutuhan.
      </p>
      <div
        role="tablist"
        aria-label="Jenis resep"
        className="inline-flex max-w-full gap-1 rounded-xl border border-border bg-white p-1"
      >
        {(
          [
            { kind: 'PRODUCTION', label: 'Produksi DC', icon: FlaskConical },
            { kind: 'SERVING', label: 'Takaran per Cup', icon: Coffee },
          ] as const
        ).map(({ kind: value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`${id}-${value}-tab`}
            aria-selected={kind === value}
            aria-controls={`${id}-${value}-panel`}
            tabIndex={kind === value ? 0 : -1}
            onClick={() => {
              setKind(value);
              setPage(1);
              setSearch('');
            }}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'PRODUCTION'
                    : event.key === 'End'
                      ? 'SERVING'
                      : kind === 'PRODUCTION'
                        ? 'SERVING'
                        : 'PRODUCTION';
                setKind(next);
                setPage(1);
                setSearch('');
                document.getElementById(`${id}-${next}-tab`)?.focus();
              }
            }}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${kind === value ? 'bg-emerald-50 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`${id}-${kind}-panel`}
        aria-labelledby={`${id}-${kind}-tab`}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {kind === 'PRODUCTION' ? 'Resep produksi DC' : 'Takaran minuman per cup'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Semua resep saat ini masih draft, belum dipakai untuk stok atau transaksi.
            </p>
          </div>
          <Button
            onClick={() => {
              setSuccess('');
              setScreen('create');
            }}
          >
            <Plus size={18} />
            Buat resep
          </Button>
        </div>
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Cari resep"
            maxLength={100}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nama resep…"
            className="pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              aria-label="Hapus pencarian resep"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-0 top-0 grid size-11 place-items-center"
            >
              <X size={17} />
            </button>
          )}
        </div>
        {data.error && (
          <div className="space-y-2">
            <ErrorNotice error={data.error} />
            <Button variant="outline" onClick={() => void data.refetch()}>
              Coba lagi
            </Button>
          </div>
        )}
        {data.isPending && <p role="status">Memuat daftar resep…</p>}
        {data.data && !data.data.items.length && (
          <Empty>
            {q
              ? 'Tidak ada resep yang cocok. Coba nama lain.'
              : 'Belum ada resep di daftar ini. Gunakan “Buat resep” untuk menyusun draft pertama.'}
          </Empty>
        )}
        {!!data.data?.items.length && (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-white sm:block">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">Daftar resep</caption>
                <thead className="border-b border-border bg-muted">
                  <tr>
                    <th scope="col" className="w-[27%] px-4 py-3">
                      Nama resep
                    </th>
                    <th scope="col" className="w-[23%] px-4 py-3">
                      {kind === 'PRODUCTION' ? 'Hasil standar' : 'Menu'}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Berlaku untuk
                    </th>
                    <th scope="col" className="w-32 px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="w-28">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.items.map((recipe) => (
                    <tr key={recipe.id}>
                      <td className="break-words px-4 py-4">
                        <strong>{recipe.name}</strong>
                        <small className="mt-1 block text-muted-foreground">
                          {recipe._count.components} bahan
                        </small>
                      </td>
                      <td className="break-words px-4 py-4">
                        <RecipeBasis recipe={recipe} />
                      </td>
                      <td className="break-words px-4 py-4 text-muted-foreground">
                        {recipe.scopeLocation?.name ?? 'Semua DC'}
                      </td>
                      <td className="px-4 py-4">
                        <DraftBadge />
                      </td>
                      <td className="px-2 py-3">
                        <Button
                          variant="ghost"
                          className="px-2 text-primary"
                          aria-label={`Buka resep ${recipe.name}`}
                          onClick={() => open(recipe)}
                        >
                          Buka resep
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border bg-white sm:hidden">
              {data.data.items.map((recipe) => (
                <li key={recipe.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-semibold">{recipe.name}</h3>
                    <DraftBadge />
                  </div>
                  <p className="text-sm">
                    <RecipeBasis recipe={recipe} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {recipe.scopeLocation?.name ?? 'Semua DC'} · {recipe._count.components} bahan
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    aria-label={`Buka resep ${recipe.name}`}
                    onClick={() => open(recipe)}
                  >
                    Buka resep
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        {data.data && (
          <Pagination {...data.data} busy={data.isFetching || q !== search} onPage={setPage} />
        )}
      </section>
      {success && <SuccessNotice key={success} message={success} onDismiss={dismiss} />}
    </div>
  );
}
function DraftBadge() {
  return (
    <span className="inline-block shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      Belum aktif
    </span>
  );
}
function RecipeBasis({ recipe }: { recipe: RecipeRow }) {
  return recipe.kind === 'PRODUCTION' ? (
    <>
      {recipe.outputItem?.name}
      <small className="block text-muted-foreground">
        {recipe.outputQuantity} {recipe.outputUnitCode} / batch
      </small>
    </>
  ) : (
    <>
      {recipe.menuVariant?.name}
      <small className="block text-muted-foreground">1 cup</small>
    </>
  );
}
