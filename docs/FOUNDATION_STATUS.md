# Status Fondasi v0.1

## Implementasi aktual

- Workspace pnpm: `apps/api` NestJS dan `apps/web` React/Vite.
- Prisma 7/PostgreSQL dengan lima migrasi (fondasi + constraints + stok + urutan ledger + pembelian). Prisma client generated diabaikan Git dan dibuat lewat `pnpm db:generate`.
- Login/refresh/logout, password scrypt bersalt, token akses 15 menit, refresh hash di database dan cookie HttpOnly, rotasi kondisional, sesi diperiksa server pada request authenticated, rate limit dan Origin check.
- Master organisasi/katalog create-only dan read scoped; admin pusat dapat membuat entitas/lokasi/barang/menu/varian. DC hanya membaca lokasi sendiri dan stand langsung; partner/kasir hanya stand sendiri.
- Draft resep produksi/penyajian, komponen dinamis, preview decimal (kg/g dan L/ml dalam dimensi yang sama). Pusat mengelola draft global/per DC, DC hanya draft sendiri. Tidak ada fungsi publikasi/edit atau perubahan stok.
- UI responsif dengan navigasi mobile/tablet/desktop, form, state loading/error, status draft; lazy-load halaman master/resep. Tidak ada UI pengguna/role yet.
- Perbaikan UX **Barang & Menu**: daftar/tab/search, dialog tambah barang/kelompok/rasa, bantuan dan validasi inline, feedback sukses, dirty cancel, fokus keyboard serta footer HP. Pusat, DC & Stand menggantikan label navigasi Lokasi; perluasannya tercatat di bawah. Data/skema dipertahankan. Lihat `docs/UI_UX_GUIDELINES.md`.
- Perluasan **Pusat, DC & Stand**: tab, daftar server-paged/search/filter, detail/drill-down DC → stand, dialog tambah/pemilih paged dengan owner sendiri diwariskan dari induk. User setuju tetap Create+Read; edit/nonaktifkan dan RBAC configurable belum dibuat. Tidak ada perubahan skema/reset data.
- Perluasan **Resep**: daftar server-paged → editor draft baru → read-only detail/simulasi; tab produksi/takaran cup, paged options, unit-compatible choices, inline validation, dirty leave guard/navigation/logout/beforeunload dan stale-result handling. Tanpa edit/publish/approval, stok, autosave/offline editor atau migrasi/reset data.
- PWA shell/manifest/icons pada build. Dexie schema awal belum dipakai untuk penjualan; **offline POS/sync belum diimplementasikan**.
- Dataset dummy opt-in telah dimasukkan sesuai permintaan pengguna; master/11 draft resep marked, create-only/idempotent, tanpa transaksi stok/uang/harga/akun baru. Backup dan preservasi data lama diverifikasi; rincian jumlah/angka ilustrasi di `docs/DUMMY_DATA.md`.
- `README.md` berisi setup dev/DB, seed opt-in dan batas fitur. Docker Compose database tersedia tetapi belum dijalankan di lingkungan pengerjaan karena Docker tidak tersedia.

## Verifikasi yang dijalankan

**Impor supplier terbaru (izin eksplisit):** 4 master kode/nama dari workbook pemasok masuk sesudah dry-run tanpa konflik/backup; code asli bertitik, tidak transaksi/kontak/tax/COD. Fingerprint semua master/akun/resep/stok/pembelian terjaga; source hash sama; rerun create0/matched4/no new audit; live authenticated paged API supplier4/nota0. Validator code supplier web/backend diperluas ke titik dan unit/typecheck lulus. User menghentikan perluasan modul untuk diskusi UI, layout belum diubah. Histori "supplier0/no import" di bawah adalah keadaan saat modul awal dibuat, bukan status terbaru. Rincian `docs/PURCHASING_BASELINE.md`.

**Perluasan terbaru Pembelian:** user meminta lanjut tanpa menunggu review stok dan restart service. Supplier, nota barang/harga snapshot/konfirmasi, terima aktual/shared ledger/link existing tanpa stok ulang, declared partial payments/sisa nota tersedia; belum kas/bank/GL/HPP/tax/retur/edit (lihat `docs/PURCHASING_BASELINE.md`). Migrasi additive backup+fingerprint membuktikan seluruh master/akun/resep dan stok existing tidak berubah; tidak seed supplier/invoice/payment dev. PostgreSQL service existing aktif; API/web direstart tanpa reseed/reset.

**Verifikasi pembelian:** 25 unit API + 18 web; 19 alur integrasi PostgreSQL disposable `_test` (7 procurement), termasuk invoice/duplicate/retry, receiving 8+2, link existing tanpa movement, partial/concurrent payment bounds, atomic multi-line rollback, scope DC/mitra dan snapshot/exact math. Browser mock suite diperluas supplier/nota/required/pickers/dirty/network/confirmation/partial receive/pay dan link; screenshot HP/desktop dibaca, bukan Android fisik/live end-to-end. `db:generate`, typecheck, test, build dan format/check final lulus. Live proxy login/GET supplier/nota/inventory dan logout existing berhasil; supplier/invoice development nol, tidak ada posting stok/uang. Health/web 200, OpenAPI procurement routes tersedia. Backup restore/load/security/offline belum diuji. Histori hasil stok/fondasi di bawah bukan total terbaru.

**Perluasan Stok Dasar:** scope disetujui dan UI/API sudah dibuat; lihat `docs/INVENTORY_BASELINE.md`. Saldo/mutasi per lokasi, draft/post saldo awal/penerimaan/adjustment, transfer kirim/terima parsial, exact decimal, idempotensi, audit dan concurrency lock. Migrasi lokal additive sesudah dump/fingerprint preservasi; tidak memasukkan stok/seed/reset otomatis. Bukan HPP, produksi/POS atau impor.

**Verifikasi terbaru stok:** 21 unit API + 15 unit web; 12 integration flows real PostgreSQL pada database `_test` khusus (termasuk 7 inventory). Browser mock existing diperluas untuk required/pickers/dirty navigation/network failure/post/transfer/partial receipt dan overflow HP. Hasil fondasi lama di bawah adalah riwayat, bukan total terbaru. Build/typecheck/formatter dilaporkan sesuai run terakhir, belum Android fisik/offline/full browser→API live E2E.

**Run akhir perluasan stok:** `db:generate`, `typecheck`, `test`, `build`, `format:check` lulus; browser mock lulus dan screenshot HP/desktop dibaca. Live proxy web 5173 → API 3000: health/OpenAPI 200, login akun existing lalu GET saldo/dokumen/mutasi Dummy berhasil, logout sesi smoke; stok/dokumen tetap kosong (15 barang belum opening). Tidak reset kredensial atau menulis transaksi stok dev. Backup dump tersedia tetapi restore belum diuji. Peringatan build waktu plugin PWA serta deprecation `pg` pada test fondasi lama tidak menggagalkan run, bukan klaim load/performance readiness.

- Prisma schema validate, generate client, migrasi ke PostgreSQL lokal **cluster test terisolasi** (bukan service/database pengguna yang sudah ada).
- `pnpm typecheck` web/API.
- Jest API: 17 unit test (scope, password, konversi/scaling, environment, query organisasi/recipe serta safety/validasi fixture dummy).
- Vitest web: 13 unit test (UI class composition, request/refresh/field issues, katalog/lokasi, recipe required/quantity/duplicates/dimensi/target).
- Jest integration: 5 alur test real DB (4 foundation + 1 dummy). Foundation meliputi auth, isolasi lintas DC/mitra, paging/filter/detail/count, master, resep/preview, Origin/sesi/OpenAPI; dummy menguji idempotensi/preservasi/audit/relasi dan preview semua fixture. Query organisasi diuji juga di luar 500 stand fixture. Test memakai database terisolasi; injection dummy pengguna dilakukan terpisah sesuai permintaannya.
- Seed development dijalankan dua kali untuk menguji ulang tanpa reset password. Tidak memasukkan resep/harga/pajak operasional.
- `pnpm build` web/API dan format check. Build tidak menggantikan pengujian browser.
- Smoke test API hasil build: endpoint health berhasil dan OpenAPI dapat dibaca. Browser Edge headless pada viewport 390×844 berhasil merender layar login melalui Vite/proxy lokal; belum menguji interaksi seluruh form atau layout di Android fisik.
- Browser smoke Barang & Menu dengan API mock menguji modal/error/success/search, submit pending dan cancel, fokus/Escape/backdrop, viewport desktop 1280×900, HP 390×844 dan tablet 768×1024, serta tombol tambah tidak tersedia bagi DC. Integration test backend juga memeriksa field error kode/nama duplikat dan satuan tidak valid. Tidak ada test write pada katalog pengguna.
- Browser suite yang sama diperluas ke organisasi dengan 60 DC/63 stand mock: paging/search/filter, detail/DC drill-down, owner/parent picker, tambah sendiri/mitra, dirty cancel dan scope UI. No database write pada data asli dan belum full live browser→API E2E.
- Suite browser diperluas ke UX resep dengan 31 draft mock: list search di luar halaman awal, editor/dialog leaving, pending/success/network, required/positive/duplicate ingredient, original tanpa powder/draft kosong, readonly detail, simulasi produksi/cup, invalid fractional cup/stale result dan DC scope. Integration real DB juga memverifikasi additive recipe list/detail/pickers dan error per field. Tidak menulis draft pengguna.
- Sesudah injection dummy: run pertama menambah 79 master/header, run kedua menambah 0; fingerprint master/draft/komponen/unit/akun lama tetap sama. Live API memverifikasi jumlah serta 11 detail/preview berstatus planningOnly. Backup pre-dummy tersedia lokal (restore belum diuji); tidak membuat transaksi operasional.

## Belum diverifikasi / belum siap produksi

- Belum dilakukan review visual/UI interaktif menyeluruh, Android fisik, installability PWA di perangkat, full E2E form UI, jaringan LAN/HTTPS, ketahanan IndexedDB atau offline sales. Smoke DOM browser hanya memastikan layar login dirender.
- Tidak ada deployment produksi, backup/restore produksi, pemantauan, pengujian beban atau security audit menyeluruh.
- Ledger jumlah stok tersedia. Belum produksi aktual, pembelian/keuangan lengkap, HPP, penjualan, tutup/setoran, tagihan mitra/FIFO, QRIS, pajak atau impor Accurate; pilot end-to-end blueprint belum dapat dijalankan. Penyelesaian kehilangan/retur transit dan edit/batal draft stok belum ada.
- Uji integrasi memerlukan `TEST_DATABASE_URL` eksplisit dengan nama database `_test`; suite skip bila env tidak tersedia. Jangan menganggap skip sebagai integrasi sudah diuji di lingkungan baru.

## Setup development lokal (permintaan pengguna)

- Konfigurasi `apps/api/.env` telah dibuat dengan URL database lokal yang diberikan pengguna; secret JWT dan password admin dibuat acak. Nilai secret tidak dicatat di dokumentasi/repository.
- Database `teh_coyo` sebelumnya belum ada; telah dibuat sebagai database baru pada PostgreSQL lokal dan kedua migrasi berhasil diterapkan. Database lain dan konfigurasi autentikasi PostgreSQL tidak diubah.
- Seed development berhasil (satuan, entitas/lokasi contoh dan admin pusat). Tidak menambahkan resep/harga/pajak/penjualan operasional.
- `pnpm dev` dijalankan sebagai proses background untuk pengujian pengguna. Pada saat verifikasi, web `http://localhost:5173` merespons HTTP 200, API health `http://localhost:3000/api/v1/health` berstatus `ok`, dan login admin/request master/refresh/logout melalui proxy web berhasil. Proses bisa berhenti bila komputer/terminal launcher ditutup; status saat ini dapat dicek dari endpoint health.
- Log proses di `.local/dev-output.log` dan `.local/dev-error.log`; PID launcher tersimpan di `.local/dev-session.json`. Folder `.local` dan `.env` diabaikan Git. Jangan menjalankan launcher kedua selama port development masih dipakai.
- Ini tetap lingkungan development untuk uji fondasi, bukan perubahan status siap produksi atau bukti fitur POS/offline telah selesai.

## Kelanjutan

Perbaikan setup: Prisma tidak lagi memakai URL cadangan database `unused`; migrasi menolak `DATABASE_URL` yang tidak ada/tidak valid sebelum koneksi. Seed dan konfigurasi API menampilkan nama variabel yang bermasalah tanpa nilai secret. Generate client/validate/format tetap tidak membutuhkan koneksi database. Konfigurasi API dibaca dari `apps/api/.env` saat perintah workspace dijalankan; `.env` root hanya untuk Compose. Lihat troubleshooting README.

Review UI fondasi dan dukungan master/draft. Kemudian rancang ledger/penerimaan, pemakaian produksi, approval resep dan batas transaksi yang benar, sebelum mengaktifkan POS. Selesaikan algoritma tarif paket per cup terhadap penerimaan/FIFO dan kebijakan kas lokal sebelum fitur penyelesaian mitra dipakai produksi. Lanjut satu irisan teruji per tahap.
