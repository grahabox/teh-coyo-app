# Teh Coyo — Fondasi aplikasi

Web responsif React/TypeScript/Vite PWA + NestJS REST API + PostgreSQL/Prisma dalam satu pnpm workspace. **Tahap fondasi untuk development, belum siap mencatat operasional produksi nyata.**

## Yang sudah dibuat

- Login, access token 15 menit di memori frontend, refresh token terrotasi dalam cookie HttpOnly/SameSite=Strict (Secure pada production), logout/revocation, rate limit dan pengecekan Origin pada endpoint cookie.
- Pembatasan akses backend untuk admin pusat, admin DC, kasir stand dan pengelola mitra. DC melihat lokasi sendiri/stand binaan; stand hanya lokasinya. Penambahan entitas/lokasi/katalog oleh pusat.
- Master entitas, lokasi sendiri/mitra, satuan dasar g/ml/pcs dan konversi kg/L, barang stok, kelompok menu dan varian per cup.
- Draft resep produksi/penyajian dengan komponen dinamis; preview scaling berbasis decimal, validasi dimensi dan pembulatan terlihat. Draft kosong boleh disimpan tetapi tidak bisa dipreview; tidak ada posting stok. Pusat membuat draft global/per DC; admin DC hanya draft DC sendiri.
- Audit pembuatan master/draft, migrasi SQL, seed development opt-in dan dokumentasi OpenAPI development.
- Tampilan mobile-first untuk lokasi/katalog/draft resep; shell PWA/manifest/icon tersedia pada build. IndexedDB/Dexie baru merupakan fondasi skema antrean: **belum ada POS cash offline atau sinkronisasi yang bekerja**.
- Halaman **Barang & Menu**: tab daftar barang/menu minuman, pencarian, dialog tambah dengan validasi per field, bantuan satuan, notifikasi sukses, konfirmasi buang isian dan kontrol pending. Desktop memakai tabel barang, HP memakai daftar ringkas. Kelompok minuman dibuat dahulu lalu rasa/menu ditambahkan; tidak ada reset data atau aksi edit/hapus yang belum didukung.
- Halaman **Pusat, DC & Stand**: tab pusat/DC/stand/pemilik usaha, pencarian/filter/pagination server (25 data per halaman), detail DC dan daftar stand binaan, dialog tambah, pemilih pusat/DC/pemilik usaha yang searchable dan paged. Lokasi sendiri mengikuti pemilik induk, mitra memilih pemilik berbeda. Tetap tambah/lihat saja; edit/hapus/nonaktifkan dan UI RBAC configurable ditunda. Role/cakupan dasar backend tetap bekerja.
- Halaman **Resep**: daftar paged/search dengan tab Produksi DC/Takaran per Cup → editor draft baru sebagai halaman → rincian read-only dan Hitung Kebutuhan Bahan. Bahan/menu/DC dipilih lewat paged search, satuan hanya yang kompatibel; field error dan confirm keluar tanpa simpan tersedia. Save kembali ke daftar, hasil simulasi menampilkan target dan tidak stale saat target diubah. Draft tanpa bahan valid boleh disimpan tetapi tidak disimulasikan. Tidak ada stok/publikasi/edit; tidak ada autosave/offline editor. Leave guard melindungi navigasi menu/logout dan beforeunload, bukan router/history aplikasi native.

**Stok Dasar sudah ditambahkan:** menu Stok & Mutasi, saldo per lokasi (belum ditetapkan ≠ nol), buku mutasi dan dokumen scoped/server-paged. Draft → konfirmasi saldo awal/penerimaan supplier/penyesuaian; transfer kirim/terima aktual bertahap dengan sisa transit. Posting atomik, decimal eksak, retry idempoten dan audit. Tidak ada saldo otomatis atau impor Accurate; panduan mencoba dengan Dummy dan API di `docs/INVENTORY_BASELINE.md`.

**Pembelian sudah ditambahkan:** supplier, nota barang draft/konfirmasi dengan harga/total IDR snapshot, penerimaan aktual bertahap memakai buku stok yang sama, tautan penerimaan existing tanpa mutasi ulang, catatan pembayaran bersumber dana/bukti dan sisa tagihan. Pusat semua lokasi sendiri, admin DC di DC sendiri; belanja mitra/kasir belum diaktifkan. Catatan bayar **belum mengubah saldo kas/bank**, belum pajak/diskon/ongkir/HPP/retur/edit. Panduan, API dan batas lengkap di `docs/PURCHASING_BASELINE.md`.

**Impor supplier atas izin terpisah:** 4 master kode/nama dari `daftar-pemasok.xlsx` sudah tersedia di Pembelian → Supplier; kode asli bertitik dipertahankan, create-only dengan backup/audit/rerun tanpa duplikat. Tidak kontak/COD/pajak/saldo/nota/pembayaran atau domain Accurate lain. Sumber/scripts private `.local`; bukan importer umum. User meminta diskusi tampilan sebelum pengembangan lanjut. Supplier tersebut nyata, jangan dipakai pada transaksi percobaan Dummy.

## Belum dibuat / batas penting

- Pembelian dengan PO/approval terpisah, biaya non-stok/diskon/ongkir/pajak, retur/kredit, buku kas/bank/jurnal akuntansi, produksi aktual, nilai stok/HPP, harga efektif, penerapan tarif paket FIFO, POS, tutup/setoran, QRIS, migrasi Accurate dan modul pajak. Stok dasar bukan laporan laba/nilai aset; sisa tagihan nota bukan general ledger utang. Edit/batal draft dan penyelesaian kehilangan/retur transit belum ada.
- Publikasi/approval/edit versi resep. Penyimpanan saat ini membuat **draft terpisah**, bukan versi terbit. Untuk melengkapi komposisi, susun draft baru; jangan menganggap versi draft adalah resep operasional aktif.
- UI pembuatan pengguna/perangkat/role; seed hanya satu admin pusat. Pengujian membuat akun scoped terpisah di database test. Multi-role/permission configurable dan histori perubahan induk lokasi masih tahap rancangan; lokasi saat ini create-only agar tidak menimpa histori.
- Konversi kemasan/satuan khusus dari admin belum dibuat. Satuan dasar/konversi standar disediakan seed; tidak ada konversi g↔ml.
- Editor ekspresi matematis bebas tidak disediakan; preview hanya perhitungan proporsional resep yang telah diisi.
- Hosting produksi belum dipilih. Konfigurasi Docker hanya menjalankan PostgreSQL lokal; tidak menjalankan web/API di production.

## Prasyarat

- Node.js **24 LTS** (disarankan versi patch yang masih didukung); `.node-version` menunjukkan versi development yang ditargetkan. Runtime lingkungan pengerjaan Node 26 juga dipakai untuk pemeriksaan, bukan keputusan hosting.
- pnpm **12.6.0**, sesuai `packageManager` dan lockfile.
- PostgreSQL **18**, melalui Docker Compose atau instalasi PostgreSQL lokal.

```sh
pnpm install --frozen-lockfile
```

pnpm workspace mempunyai allowlist install script. Jangan mengaktifkan seluruh script dependency secara otomatis; review paket baru sebelum memberikan izin. TypeScript 5.9 dan Prisma 7 digunakan karena kompatibilitas dependency yang diuji; tidak menggunakan Prisma prerelease terbaru.

## Setup development

1. Salin `.env.example` root ke `.env`, dan `apps/api/.env.example` ke `apps/api/.env`.
2. Ganti password PostgreSQL, `JWT_SECRET` (minimal 32 karakter acak), dan kredensial admin seed. Jangan commit file `.env`. Password seed minimal 12 karakter, tidak ada password login default.
3. Samakan password di URL database API dengan password Compose. Bila memakai PostgreSQL lokal, buat database/user development sendiri dan sesuaikan URL; tidak wajib memakai Docker.
4. Jalankan database. Untuk Compose:

**Ada dua file `.env` dengan fungsi berbeda:** root `.env` untuk Compose (`POSTGRES_PASSWORD`), sedangkan `apps/api/.env` untuk Prisma, seed, dan API (`DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, dll.). Perintah `pnpm db:*` dijalankan di workspace `apps/api`; `.env` root tidak otomatis menjadi konfigurasi API. Variabel environment dari shell/deployment tetap mempunyai prioritas atas file `.env`.

Untuk membuat file API di **Windows Command Prompt** dari root proyek (jalankan hanya jika file belum ada agar konfigurasi existing tidak tertimpa):

```bat
if not exist apps\api\.env copy apps\api\.env.example apps\api\.env
notepad apps\api\.env
```

Pastikan ekstensi benar-benar `.env`, bukan `.env.txt`, dan ganti seluruh placeholder sebelum menggunakan aplikasi. URL PostgreSQL harus mengarah ke database yang sudah dibuat dan role yang memiliki hak akses; karakter khusus pada username/password URL harus di-percent-encode (misalnya `@` menjadi `%40` pada bagian password), bukan meng-encode seluruh URL.

```sh
docker compose up -d postgres
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

- Web: `http://localhost:5173`.
- API health: `http://localhost:3000/api/v1/health`.
- Swagger development: `http://localhost:3000/api/docs`.
- OpenAPI JSON development: `http://localhost:3000/api/openapi.json`.

`db:deploy` menerapkan migrasi yang sudah ada. Saat **mengembangkan perubahan skema baru** gunakan `pnpm db:migrate`; review SQL sebelum commit. Seed menolak `NODE_ENV=production`, tidak mereset password admin yang sudah ada, tidak membuat harga/resep/pajak/penjualan contoh. Lokasi bernama DEMO hanya data development.

Login menggunakan `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` yang kamu isi. Mulai dari katalog barang/menu/varian, lalu resep draft dan preview.

### Data dummy tambahan (opsional, development-only)

Untuk mencoba UI tanpa input manual tersedia dataset terpisah:

```sh
pnpm db:seed:dummy --confirm-development-data
```

Command menambah data bertanda **Dummy** (1 pusat, 6 DC, 36 stand, 4 pemilik, 14 barang, 6 rasa dan 11 draft resep), create-only/idempotent tanpa mengganti data existing/password. Memerlukan admin aktif dan satuan dari seed awal, `NODE_ENV=development/test`, database lokal `teh_coyo` atau `*_test`. Tidak menambah penjualan/saldo stok/uang/harga/pajak/akun baru. Semua resep ilustrasi, bukan SOP dan belum aktif. Dataset sudah dimasukkan pada sesi development pengguna; cukup refresh untuk mencoba. Lihat `docs/DUMMY_DATA.md` untuk contoh simulasi, guard, backup dan batas cleanup. Seed awal `db:seed` tetap tidak memasukkan resep dummy secara otomatis.

### Troubleshooting konfigurasi database/seed

- Jika keluaran versi lama menyebut database **`unused`**, `DATABASE_URL` belum terbaca dan konfigurasi lama memakai URL dummy. Implementasi sekarang menolak konfigurasi yang hilang **sebelum koneksi**, menyebut variabel yang perlu diisi, dan tidak memakai database dummy lagi.
- Jika seed menolak konfigurasi, periksa `DATABASE_URL`, `SEED_ADMIN_EMAIL` (format email), dan `SEED_ADMIN_PASSWORD` (12–200 karakter) dalam `apps/api/.env`. Tidak perlu mengirim nilai secret ke chat/log.
- `pnpm db:generate` (serta Prisma validate/format) tetap dapat berjalan tanpa URL database. Migrasi/seed membutuhkan URL asli. Migrasi tidak membuat database PostgreSQL atau role untukmu; buat dahulu melalui pgAdmin/psql/Compose dan pastikan akses role ke database/schema sesuai.
- Jika setelah URL sudah terbaca muncul P1010/P1000, barulah periksa kredensial dan hak akses role PostgreSQL; jangan mereset/menghapus database. Bila muncul P1001, periksa service, host dan port.

### Mengakses dari Android dalam jaringan lokal

Vite development bind ke `0.0.0.0`. Buka `http://IP-KOMPUTER:5173` dari HP dan set `APP_ORIGIN` API menjadi origin tersebut, kemudian restart API. Frontend memakai proxy `/api` Vite, sehingga login/cookie tetap same-origin; jangan memanggil port API langsung dari frontend. Pastikan firewall dan jaringan mengizinkan akses.

**PWA/service worker membutuhkan secure context** (HTTPS, atau localhost). HTTP IP LAN cukup untuk meninjau UI, tetapi bukan pengujian instalasi/offline PWA. Untuk pengujian PWA di HP gunakan HTTPS yang dipercaya perangkat. Jangan menonaktifkan keamanan browser untuk mengakali pengujian.

## Perintah kualitas

```sh
pnpm db:generate
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

- Jest API: scope/permission, hash password, konversi/scaling.
- Vitest web: komposisi kelas UI dan perilaku request/refresh.
- Browser smoke UI: jalankan Vite development terlebih dahulu, lalu `pnpm --filter @tehcoyo/web test:browser`. Script memakai Chromium/Edge headless dan API **mock** sebelum membuka halaman, tanpa menulis katalog pengguna. Bila executable tidak ditemukan, set `BROWSER_PATH`; URL web default localhost:5173 atau `WEB_TEST_URL`. Menguji dialog/validasi/search/feedback/fokus pada viewport desktop/HP/tablet; bukan Android fisik atau full E2E API live. Screenshot opsional melalui `UI_SCREENSHOT_DIR` ke folder lokal yang diabaikan Git.
- Integration test API membutuhkan **database khusus dengan nama berakhiran `_test`**. Tidak memakai database development/production otomatis.

Contoh PowerShell setelah database test dibuat:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/teh_coyo_test'
pnpm db:deploy
$env:TEST_DATABASE_URL = $env:DATABASE_URL
pnpm test:integration
Remove-Item Env:DATABASE_URL, Env:TEST_DATABASE_URL
```

Contoh bash:

```sh
DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/teh_coyo_test' pnpm db:deploy
TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/teh_coyo_test' pnpm test:integration
```

Integration suite membuat fixture acak kemudian membersihkannya; satuan test tetap dapat ada. Suite skip jika `TEST_DATABASE_URL` tidak tersedia. Belum ada test browser Android/E2E/ketahanan antrean offline, sehingga hasil unit/integration **bukan** bukti siap go-live.

## API tahap fondasi

Daftar organisasi memakai endpoint additive berikut; endpoint array lama tetap tersedia untuk konsumen lama (termasuk editor resep):

- `GET /api/v1/locations/page?q=&page=1&perPage=25&type=DC`: pencarian nama/kode, page/perPage (maksimum 100), filter `type`, `parentId`, `ownership`; respons `{ items, total, page, perPage, totalPages }`, hanya data dalam scope actor. Detail baris menyertakan induk dan jumlah anak (DC→stand, pusat→DC).
- `GET /api/v1/locations/:id/detail`: detail terotorisasi dengan pemilik/induk/jumlah anak, bukan saldo stok/keuangan.
- `GET /api/v1/entities/page`: admin pusat-only, paging dan q serta `excludeEntityId` untuk pilihan pemilik mitra. Pemilik usaha bukan pengaturan profil pajak.

Pagination/search lokasi tidak dibatasi array 500. Query tetap di-intersect dengan scope actor, sehingga `parentId`/pencarian tidak dapat membuka DC atau mitra lain. Uji integrasi menggunakan 505 stand fixture untuk memverifikasi pencarian di luar batas lama; ini bukan klaim beban maksimum produksi. Endpoint array lama `/locations` masih dibatasi 500 untuk kompatibilitas; editor resep baru memakai pemilih paged.

API additive untuk UX resep:

- `GET /api/v1/recipes/page?kind=PRODUCTION&q=&page=1&perPage=25`: daftar header resep dengan output/menu, scope dan jumlah bahan; pencarian nama serta paginasi server. Admin DC hanya draft DC sendiri, kasir/partner mendapat daftar kosong. Tidak menggantikan endpoint legacy `/recipes`.
- `GET /api/v1/recipes/:id/detail`: rincian beserta bahan/satuan/menu/scope, terotorisasi untuk pusat/DC penulis sesuai scope. Tidak ada update/delete/publish endpoint.
- `GET /api/v1/catalog/units`, `/catalog/items/page`, `/catalog/variants/page`: pilihan satuan/bahan/menu untuk editor. Paged options memakai q/page/perPage (maksimum 100) dan tetap membutuhkan autentikasi.
- `POST /api/v1/recipes` / `POST /recipes/:id/preview` tetap memakai decimal string. Error domain per field/komponen dikembalikan dalam `issues`; detail/preview hanya membaca, create hanya menyimpan draft/audit, tidak posting stok. Simulasi output standar bukan hasil aktual.

Prefix `/api/v1`; master/recipe endpoint memerlukan Bearer access token. Request mutasi strict, field tambahan ditolak; angka resep **string decimal** (maksimum 6 desimal), bukan float.

| Endpoint                                                     | Fungsi                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `POST /auth/login`, `/auth/refresh`, `/auth/logout`          | Login/session melalui cookie dan Origin terpercaya.                   |
| `GET /auth/me`                                               | Identitas sesi terverifikasi.                                         |
| `GET /locations`, `/locations/:id`                           | Lokasi sesuai scope.                                                  |
| `GET/POST /entities`, `POST /locations`                      | Master organisasi, pusat-only.                                        |
| `GET /catalog`                                               | Satuan, barang, kelompok menu dan varian (tanpa harga/biaya pribadi). |
| `POST /catalog/items`, `/catalog/menus`, `/catalog/variants` | Master katalog, pusat-only.                                           |
| `GET/POST /recipes`                                          | Draft untuk pusat atau DC sesuai scope.                               |
| `POST /recipes/:id/preview`                                  | Target quantity/unit → kebutuhan bahan, tidak memutasi stok.          |

OpenAPI mencantumkan request endpoint saat ini. Typed response schemas/SDK klien akan dilengkapi sebelum kontrak POS/native dipublikasikan; dokumentasi ini tidak mengklaim API seluruh blueprint sudah ada.

## Struktur

```text
apps/api/
  prisma/                 # schema, migrasi, seed development
  src/access/             # scope/permission baseline
  src/auth/               # session, JWT, cookie, password
  src/organization/       # entitas dan lokasi
  src/catalog/            # satuan, barang, menu/varian
  src/recipes/            # draft dan kalkulasi preview
  src/inventory/          # saldo jumlah, ledger, draft/post/kirim/terima
  src/procurement/        # supplier, nota, terima/link stock, declared payment
  src/database/           # adapter Prisma/PostgreSQL
  test/                   # unit dan integration
apps/web/
  src/features/           # login, lokasi, katalog, resep
  src/components/ui/      # komponen lokal pola shadcn, Tailwind
  src/lib/                # API, types, Dexie foundation
```

Komponen UI lokal mengikuti pola shadcn dan `components.json`; tidak menjalankan generator seluruh library. Bila menambah komponen, review accessibility/bundle dan jangan mengganti komponen existing otomatis. Data API bukan sumber stok offline; cache TanStack Query berbeda dari antrean Dexie.

## Catatan keamanan/deployment

- Produksi membutuhkan HTTPS, `NODE_ENV=production`, secret acak, database berpassword/akses minimum, backup+restore test, monitoring dan reverse proxy `/api` **same-origin**. Detail deployment belum dibuat.
- Secure/HttpOnly cookie di produksi; Origin API harus cocok origin frontend. Endpoint browser-cookie saat ini bukan desain login Android native: REST/domain reusable, adapter autentikasi native dibuat saat klien native benar-benar dibangun.
- Jangan cache respons API terautentikasi di service worker. Cache query dihapus saat logout/sesi berakhir; refresh token tidak tersimpan di localStorage/IndexedDB.
- Role baseline bukan jaminan anti-kecurangan lengkap. Audit app belum tahan perubahan langsung oleh DBA; kontrol admin server dan backup tetap diperlukan.
- Saat nanti offline POS dibuat, update PWA/schema IndexedDB tidak boleh menghapus antrean pending, dan revoke izin saat offline membutuhkan batas masa berlaku/proses review.

## Pegangan lanjutan

Baca `PROJECT_CONTEXT.md`, `IMPLEMENTATION_PLAN.md`, `RECIPE_DESIGN.md`, `APPLICATION_BLUEPRINT.md`, `docs/INVENTORY_BASELINE.md`, `docs/PURCHASING_BASELINE.md` dan `AGENTS.md`. Stok Dasar/Pembelian sudah tersedia; uji dengan Dummy lalu sepakati produksi aktual/approval resep serta buku kas. Tarif paket sebelum tagihan mitra; lanjut per irisan, bukan semua modul sekaligus.
