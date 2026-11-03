import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  LogOut,
  Package,
  WifiOff,
} from 'lucide-react';
import { logout, restoreSession, type SessionUser } from './lib/api';
import { Login } from './features/login';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { ErrorNotice } from './components/forms';
import type { LeaveGuard } from './features/recipes/leave-guard';

const Locations = lazy(() =>
  import('./features/locations').then((module) => ({ default: module.Locations })),
);
const Catalog = lazy(() =>
  import('./features/catalog').then((module) => ({ default: module.Catalog })),
);
const Recipes = lazy(() =>
  import('./features/recipes').then((module) => ({ default: module.Recipes })),
);
const Inventory = lazy(() =>
  import('./features/inventory').then((module) => ({ default: module.Inventory })),
);
const Purchasing = lazy(() =>
  import('./features/purchasing').then((module) => ({ default: module.Purchasing })),
);

const pages = [
  { id: 'home', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'locations', label: 'Pusat, DC & Stand', icon: Building2 },
  { id: 'catalog', label: 'Barang & Menu', icon: Package },
  { id: 'recipes', label: 'Resep', icon: FlaskConical },
  { id: 'inventory', label: 'Stok & Mutasi', icon: Package },
  { id: 'purchasing', label: 'Pembelian', icon: Package },
] as const;
const roleNames = {
  CENTRAL_ADMIN: 'Admin pusat',
  DC_ADMIN: 'Admin DC',
  STAND_CASHIER: 'Kasir stand',
  PARTNER_ADMIN: 'Pengelola mitra',
};

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState<string>('home');
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState<unknown>(null);
  const [signingOut, setSigningOut] = useState(false);
  const client = useQueryClient();
  const leaveGuard = useRef<LeaveGuard | null>(null);
  const registerLeaveGuard = useCallback((guard: LeaveGuard | null) => {
    leaveGuard.current = guard;
  }, []);
  function navigate(next: string) {
    if (next === page) return;
    const proceed = () => setPage(next);
    if (leaveGuard.current) leaveGuard.current(proceed);
    else proceed();
  }
  useEffect(() => {
    let mounted = true;
    void restoreSession()
      .then((session) => {
        if (mounted) setUser(session?.user ?? null);
      })
      .catch((error) => {
        if (mounted) setError(error);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    const update = () => setOnline(navigator.onLine);
    const expired = () => {
      client.clear();
      setUser(null);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('tehcoyo:session-expired', expired);
    return () => {
      mounted = false;
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('tehcoyo:session-expired', expired);
    };
  }, [client]);
  if (checking)
    return (
      <main className="grid min-h-dvh place-items-center">
        <p role="status">Menyiapkan sesi…</p>
      </main>
    );
  if (!user)
    return (
      <>
        <ErrorNotice error={error} />
        <Login
          onLogin={(user) => {
            client.clear();
            setUser(user);
            setError(null);
            setPage('home');
          }}
        />
      </>
    );
  const title = pages.find((item) => item.id === page)?.label ?? 'Ringkasan';
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="rounded-xl bg-primary p-2 text-white">
            <Leaf size={24} />
          </div>
          <div>
            <p className="font-bold">Teh Coyo</p>
            <p className="text-xs text-muted-foreground">Workspace operasional</p>
          </div>
        </div>
        <nav
          aria-label="Navigasi utama"
          className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col"
        >
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              aria-current={page === id ? 'page' : undefined}
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium ${page === id ? 'bg-emerald-50 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="hidden px-5 py-4 lg:block">
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Fondasi v0.1
            <br />
            Belum untuk transaksi penjualan.
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-4 sm:px-7">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {user.name} · {roleNames[user.role]}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={signingOut}
            onClick={async () => {
              const proceed = async () => {
                setSigningOut(true);
                setError(null);
                try {
                  await logout();
                  client.clear();
                  setUser(null);
                } catch (error) {
                  setError(error);
                } finally {
                  setSigningOut(false);
                }
              };
              if (leaveGuard.current)
                leaveGuard.current(() => {
                  void proceed();
                });
              else await proceed();
            }}
          >
            <LogOut size={17} />
            {signingOut ? 'Keluar…' : 'Keluar'}
          </Button>
        </header>
        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-7">
          {!online && (
            <p
              role="status"
              className="flex gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
            >
              <WifiOff size={19} />
              Koneksi perangkat terputus. Pada tahap fondasi, perubahan master memerlukan koneksi;
              POS cash offline belum diaktifkan.
            </p>
          )}
          <ErrorNotice error={error} />
          {page === 'home' && (
            <>
              <div className="rounded-2xl bg-primary p-6 text-white">
                <p className="text-sm text-emerald-100">Mulai dari data yang rapi</p>
                <h2 className="mt-2 text-2xl font-bold">Satu alur, dari pusat sampai stand.</h2>
                <p className="mt-3 max-w-xl text-sm text-emerald-50">
                  Siapkan lokasi, bahan, varian dan draft resep sebelum pencatatan produksi serta
                  penjualan diaktifkan.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {pages
                  .filter((item) => item.id !== 'home')
                  .map(({ id, label, icon: Icon }) => (
                    <Card key={id} className="space-y-3">
                      <Icon className="text-primary" />
                      <h3 className="font-bold">{label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {id === 'locations'
                          ? 'Pusat, DC, stand sendiri dan mitra sesuai cakupan akun.'
                          : id === 'catalog'
                            ? 'Kelola bahan, kemasan, dan rasa minuman yang dijual per cup.'
                            : id === 'purchasing'
                              ? 'Nota supplier, penerimaan aktual dan catatan pembayaran.'
                              : id === 'inventory'
                                ? 'Saldo awal, penerimaan, transfer dan penyesuaian barang.'
                                : 'Susun komposisi dan preview kebutuhan tanpa mengubah stok.'}
                      </p>
                      <Button variant="outline" onClick={() => navigate(id)}>
                        Buka {label.toLowerCase()}
                      </Button>
                    </Card>
                  ))}
              </div>
              <Card>
                <h3 className="font-bold">Batas tahap ini</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Stok dasar tersedia untuk pengujian. Posting produksi, POS online/offline,
                  setoran, tagihan mitra, QRIS dan pajak belum tersedia. Saldo nyata tidak diisi
                  otomatis; pilot operasional memerlukan verifikasi data awal dan kontrol terkait.
                </p>
              </Card>
            </>
          )}
          <Suspense fallback={<p role="status">Memuat halaman…</p>}>
            {page === 'locations' && <Locations user={user} />}
            {page === 'catalog' && <Catalog user={user} />}
            {page === 'recipes' && <Recipes user={user} registerLeaveGuard={registerLeaveGuard} />}
            {page === 'purchasing' && (
              <Purchasing user={user} registerLeaveGuard={registerLeaveGuard} />
            )}
            {page === 'inventory' && (
              <Inventory user={user} registerLeaveGuard={registerLeaveGuard} />
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
