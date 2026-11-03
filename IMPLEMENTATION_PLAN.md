# Teh Coyo — Rencana Implementasi Awal

Status: **rancangan fase**, bukan instruksi langsung membangun seluruh fitur. Baca bersama `PROJECT_CONTEXT.md` (aturan bisnis), `AGENTS.md` (aturan coding) dan `README.md` (cara jalan/batas fitur aktual). Stack disetujui: React + TypeScript + Vite PWA, NestJS REST API, PostgreSQL; satu pengembang, satu repository, modular monolith; Midtrans provider QRIS pertama. Paket pendukung Prisma, pnpm, Tailwind/pola shadcn, TanStack Query, Dexie, React Hook Form/Zod, Jest/Vitest, Compose lokal serta web auth access memori/refresh cookie telah disetujui. Hosting produksi dan aturan auth offline belum diputuskan.

`APPLICATION_BLUEPRINT.md` melengkapi rencana ini dengan ERD konseptual, status/transisi, rancangan hak akses scoped, daftar keputusan terbuka dan uji pilot. Dokumen tersebut **bukan migrasi/skema fisik final**; contoh resep/harga di sana hanya fixture test dan pemetaan FIFO tarif paket belum dikunci.

## 1. Bentuk repository (usulan)

```text
apps/
  web/                 # Web responsif dan PWA: stand, DC, pusat, mitra
  api/                 # NestJS REST API, modul domain, adapter Midtrans
packages/
  api-contract/        # Opsional: hanya bila perlu tipe/kontrak yang benar-benar dibagi
docs/                  # Workflow, kontrak API, keputusan arsitektur
```

Mulai dari `apps/web` dan `apps/api` saja; jangan membuat package bersama kosong. OpenAPI adalah kontrak lintas klien; klien Android masa depan tidak boleh bergantung pada paket TypeScript internal. Saat implementasi dimulai, tambah README untuk instalasi, env, migrasi, test dan deployment aktual.

## 2. Batas modul backend

| Modul                      | Tanggung jawab inti                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity & Access          | Pengguna, role, cakupan pusat/DC/stand/mitra, otorisasi dan identitas perangkat stand.                                                                                                                                                                                                                        |
| Organization               | Entitas dan riwayat profil, DC, stand, jenis kepemilikan, relasi stand–DC.                                                                                                                                                                                                                                    |
| Catalog & Pricing          | Item stok vs menu per cup/varian, satuan, harga dan resep berversi yang dapat diisi admin. Bedakan resep produksi teh dasar DC dari resep penyajian per varian dengan powder di stand; jumlah/komponen tidak hardcode. Takaran nyata dapat diisi kemudian sebelum resep diaktifkan. Lihat `RECIPE_DESIGN.md`. |
| Procurement/Purchasing     | Supplier eksternal, pembelian pusat/DC/stand berdasarkan entitas dan lokasi, penerimaan barang vs biaya non-stok, pembayaran/utang, bukti dan approval. Pembelian lokal mitra bukan belanja entitas Teh Coyo.                                                                                                 |
| Production                 | Resep berversi, bahan aktual, batch dan output teh dasar di DC, hasil aktual vs target, waste, keterkaitan ke stok dan kiriman. Powder varian ditambahkan stand saat pelanggan memesan, bukan otomatis dipakai dalam produksi DC.                                                                             |
| Inventory & Distribution   | Mutasi stok, transit, kirim/terima, selisih, retur fisik, opname.                                                                                                                                                                                                                                             |
| POS & Offline Sync         | Penjualan, item, nomor lokal/ID transaksi, impor idempoten dari perangkat, periode/shift penjualan.                                                                                                                                                                                                           |
| Payments                   | Cash/QRIS, konfigurasi per stand, status pembayaran dan rekonsiliasi; kontrak provider dengan adapter Midtrans, lalu Xendit bila diperlukan.                                                                                                                                                                  |
| Stand Closing & Settlement | Tutup stand, pertanggungjawaban stand sendiri, kewajiban barang **terjual** mitra, setoran/verifikasi DC.                                                                                                                                                                                                     |
| Finance & Tax              | Arus kas internal, transaksi eksternal, aturan entitas/pajak berversi dan snapshot; implementasi formal sesuai kebutuhan serta validasi akuntan.                                                                                                                                                              |
| Reporting & Audit          | Laporan stok, penjualan, uang dan selisih per cakupan; catatan aktor dan koreksi transaksi.                                                                                                                                                                                                                   |
| Import                     | Staging ekspor Accurate, pemetaan dan rekonsiliasi saldo saat cutover.                                                                                                                                                                                                                                        |

Ini **batas domain**, bukan kewajiban membuat sepuluh modul penuh sebelum fitur pertama. Mulai dari irisan yang diperlukan; ekspose fungsi modul lewat application service/kontrak internal. Hindari controller/komponen UI yang menulis langsung ke tabel domain modul lain. Transfer internal tidak boleh menjadi omzet eksternal; laporan gabungan jangan menambah omzet mitra → pelanggan ke omzet Teh Coyo.

## 3. Tahap kerja yang diusulkan

**Update implementasi:** pengguna kemudian menyetujui scope Stok Dasar dan irisan itu sudah dibuat (lihat `docs/INVENTORY_BASELINE.md`): ledger jumlah, saldo awal, penerimaan supplier, adjustment dan transfer kirim/terima parsial. Ini menggantikan status "belum disetujui untuk coding" pada discovery di bawah; pembelian lengkap/produksi/POS/closing/import belum termasuk. Tidak ada saldo/transaksi dev otomatis; migrasi additive setelah backup dan fingerprint preservasi. Fase besar berikut masih perlu scope tersendiri.

**Update pembelian:** user meminta lanjut; irisan supplier/nota barang/terima aktual/link receipt/catatan bayar/sisa nota tersedia (lihat `docs/PURCHASING_BASELINE.md`). Shared inventory transaction, tanpa double receipt; bayar belum kas/bank ledger. Tidak mencakup PO/approval terpisah, tax/diskon/ongkir, biaya non-stok, retur/edit, mitra/kasir procurement atau HPP. Produksi/POS/closing tetap berikutnya, bukan sudah dibuat.

**Discovery tambahan (klarifikasi terbaru):** fungsi DC sudah berjalan di satu titik bersama pusat, meracik teh dan memasok stand; pengguna menyebut DC existing "bayangan"/masih menyatu dengan pusat dan data kurang lebih seperti Accurate. Targetnya beberapa DC wilayah dengan kelompok stand. **Jangan menunggu paper untuk development:** dokumen lama hanya referensi opsional; usulkan persamaan stok/kas serta dokumen standar untuk pencatatan ke depan. Scope awal yang disarankan adalah ledger/saldo awal/penerimaan/transfer, belum disetujui untuk coding. Batas stok/kas, kepemilikan/penugasan, saldo nyata dan aturan sensitif dikonfirmasi sebelum pilot terkait. PCS–PCS dapat dirancang tanpa mengarang isi kemasan; konversi diperlukan sebelum posting lintas PCS–g/ml. Jangan double count stok pusat/DC atau menafsirkan ekspor sebagai saldo terverifikasi. Ini bukan izin mengubah hierarki/DB, membuat DC aktual atau mengimpor histori; bypass tanpa DC belum diminta.

| Tahap                                       | Hasil yang dapat diuji                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Discovery & aturan                       | Contoh bahan/resep dan hasil produksi DC, satuan kirim/jual, dasar tagihan mitra, skema kontrak titip stok, pembelian lokal/sumber dana, saldo stok per lokasi, peran, contoh file Accurate, kebutuhan offline, definisi tutup dan setoran. Harga pasokan mitra dikunci saat penerimaan dan unit terjual dialokasikan FIFO; putuskan detail rusak/hilang, HP diganti, dan koreksi. |
| 1. Fondasi                                  | Workspace, database/migrasi, login & otorisasi scoped, pusat/DC/stand, katalog dan harga berversi, audit minimal, OpenAPI, lingkungan dev dan test.                                                                                                                                                                                                                                |
| 2. Pembelian, produksi, stok dan distribusi | Pembelian eksternal di pusat/DC/stand; penerimaan ke lokasi pembeli, pembayaran dengan sumber dana yang jelas; produksi teh di DC mengurangi bahan dan menambah output aktual. Pusat → DC → stand dengan permintaan, kirim, terima, barang dalam perjalanan, selisih; ledger per lokasi/batch dan uji invariannya. Internal transfer tidak menciptakan omzet eksternal.            |
| 3. Pilot POS cash online                    | UI HP Android yang cepat; transaksi cash per item, pemakaian stok, harga snapshot, laporan stand; mulai pilot di satu stand dengan satu HP.                                                                                                                                                                                                                                        |
| 4. Offline cash & sync                      | Instal PWA; IndexedDB berisi data minimum dan antrean tahan restart; sync idempoten, status pending dan review, simulasi koneksi putus/pulih, prosedur ganti HP. Selesaikan sebelum meluaskan pilot POS ke stand berkoneksi tidak stabil.                                                                                                                                          |
| 5. Tutup dan verifikasi                     | Stok sisa lintas hari, hitung kewajiban mitra dari unit terjual, setoran seluruh penerimaan stand sendiri, selisih kas/stok, verifikasi DC, laporan gabungan tanpa omzet ganda.                                                                                                                                                                                                    |
| 6. QRIS bertahap                            | Konfigurasi cash-only/cash+QRIS per stand, Midtrans QRIS dinamis untuk stand sendiri, webhook idempoten, rekonsiliasi status pembayaran vs pencairan; validasi model merchant mitra sebelum mengaktifkan QRIS mitra.                                                                                                                                                               |
| 7. Migrasi, keuangan, pajak                 | Impor rekonsiliasi data Accurate, kebutuhan laporan keuangan yang dikonfirmasi, profil hukum/status pajak berversi, aturan yang divalidasi konsultan, snapshot dan cutover eksplisit.                                                                                                                                                                                              |

Urutan dapat disesuaikan: jangan tunda pengumpulan **contoh ekspor Accurate dan saldo awal** sampai tahap 7; lakukan discovery sejak tahap 0. Jangan go-live ke banyak stand sebelum recovery offline, rekonsiliasi dan pengujian kontrol minimal siap. Untuk penggunaan produksi sejak tahap awal, evaluasi kewajiban tutup/verifikasi lebih cepat sesuai kebutuhan owner.

## 4. Kontrak sinkronisasi POS cash offline (rancangan)

### Prasyarat perangkat

- Satu stand = satu HP kasir menurut kebutuhan saat ini. Perangkat diikat ke stand dan pengguna sesuai kebijakan login. Sebelum offline, aplikasi harus berhasil memuat katalog/harga/izin/versi aturan yang diperlukan dari server dan menyimpannya secara lokal; offline pertama kali tanpa data awal tidak didukung.
- Kasir hanya bisa menjual barang dan pilihan cash yang telah diizinkan di konfigurasi tersimpan; tampilkan kapan data terakhir diperbarui dan jumlah transaksi belum tersinkron. Jangka berlaku otorisasi offline, batas jam/jumlah, dan prosedur bila hak akses dicabut saat HP offline **belum diputuskan**.
- IndexedDB menyimpan data transaksi secara persisten **sebelum** menampilkan bukti `Tersimpan di perangkat`. Hindari menyimpan kunci rahasia gateway di browser; jangan mengandalkan hanya event `online` atau browser Background Sync.

### Satu transaksi

```text
Kasir menjual cash
  → client_sale_id unik (dibuat sekali dan tidak berubah saat retry)
  → simpan atomik transaksi + item + snapshot harga/aturan + status lokal di IndexedDB
  → tampilkan bukti/nomor transaksi dan label MENUNGGU SINKRON
  → saat online: POST /api/v1/pos/offline-sales/sync
  → server validasi izin, binding stand/perangkat, ID, item, nominal, versi aturan
  → simpan penjualan dan dampak stok secara atomik atau tandai PERLU DITANGANI
  → balas hasil **per transaksi**; klien update status lokal tanpa menghapus bukti terlalu dini
```

Contoh bentuk data konseptual (nama field/endpoints belum final):

```json
{
  "device_id": "device-terdaftar",
  "sales": [
    {
      "client_sale_id": "uuid-tetap-per-transaksi",
      "local_sequence": 12,
      "sold_at_device": "timestamp-dengan-offset-zona",
      "catalog_version": "versi-yang-diunduh",
      "items": [{ "product_id": "id", "quantity": 2, "unit_price": 5000 }],
      "total": 10000,
      "method": "CASH"
    }
  ]
}
```

Stand dan cakupan pengguna **ditentukan dari otorisasi server dan binding perangkat**, bukan dipercaya begitu saja dari isi request. Sertakan versi harga/pajak, diskon yang diizinkan dan rincian yang diperlukan agar server dapat memverifikasi total; contoh di atas sengaja minimal. Jangan gunakan waktu dari HP sebagai satu-satunya penentu periode keuangan/pajak, karena jam HP dapat diubah.

### Perilaku API dan antrean

- Kunci idempotensi stabil minimal gabungan identitas stand/perangkat dan `client_sale_id`, ditegakkan oleh **unique constraint database**, bukan hanya pengecekan sebelum insert. Payload ulang identik mengembalikan hasil asli; ID sama dengan isi berbeda menghasilkan error konflik dan audit, bukan transaksi baru.
- Kirim batch kecil/berurutan; server memproses setiap transaksi dalam transaksi database tersendiri agar satu kasus bermasalah tidak menghapus transaksi lainnya. Respons per item: `accepted` (dengan ID server), `already_accepted`, `needs_review` (alasan), atau `rejected` (alasan yang bisa ditindaklanjuti). Tidak ada transaksi yang diam-diam dibuang. Definisi formal `needs_review` dan apakah menjadi pos pembukuan sementara ditentukan sebelum produksi.
- Pada timeout/ponsel keluar aplikasi, ulangi dengan ID dan payload yang sama. Status lokal sebaiknya `pending`, `syncing`, `synced`, `needs_review`; `syncing` yang tertinggal setelah crash kembali menjadi `pending`. Hanya konfirmasi server yang mengubah status menjadi `synced`.
- Coba sync saat app dibuka/kembali aktif, saat ada koneksi dan secara berkala selama aplikasi terbuka; sediakan tombol manual. Uji jaringan yang tampak online tetapi server tidak dapat dijangkau, logout, token kedaluwarsa, batch sebagian berhasil, timeout setelah commit, refresh/restart dan perpindahan hari.
- Harga produk, kebijakan pajak, dan izin mungkin berubah sewaktu HP offline: simpan snapshot data yang dipakai untuk transaksi, jangan menimpa harga lama dengan harga terbaru secara diam-diam. Validasi versi dan tentukan kebijakan bisnis (terima berdasarkan versi offline dengan batas tertentu atau `needs_review`) sebelum go-live. Jika stok sistem tampak tidak cukup, catat insiden untuk peninjauan; jangan hilangkan penjualan cash nyata hanya karena data offline sudah usang.
- Tutup harian final, setoran, void/refund, koreksi stok dan QRIS tidak dianggap tersedia offline tanpa desain terpisah. Untuk penjualan belum sync, laporan DC/pusat **sementara belum lengkap**; tutup final baru setelah antrean ditangani menurut kebijakan yang disetujui.
- Data lokal belum tersinkron dapat hilang karena HP rusak/di-reset atau data browser dihapus. Butuh SOP pemulihan (mis. catatan transaksi/bukti lokal, proses input ulang terotorisasi dengan deduplikasi) dan larangan menghapus data aplikasi sebelum antrean nol; tidak ada jaminan 100% data lokal selamat.

## 5. Keputusan yang perlu dikunci sebelum scaffold/implementasi produksi

0. Satuan bahan/output teh dasar DC/pasokan; resep produksi/hasil aktual DC, resep penyajian/takaran per cup di stand, ketahanan produk dan sumber dana/approval pembelian lokal. **Powder ditambahkan di stand saat pelanggan memesan sudah dikonfirmasi.** Pembelian lokal boleh dilakukan DC/stand, tetapi tidak otomatis berarti diizinkan memakai uang hasil penjualan atau beroperasi offline.
   Praktik saat ini: penjualan/tagihan dihitung **per cup minuman terjual**, dengan beberapa varian rasa, bukan breakdown setiap bahan. POS mencatat menu/varian dan jumlah cup; item stok kemasan cup kosong terpisah dari satuan minuman. Konfirmasi varian, ukuran (jika ada), harga pelanggan, tarif pasokan dan komponen yang termasuk, serta pemetaan lapisan penerimaan ke porsi untuk FIFO; hindari menagih komponen paket dua kali atau mengubahnya menjadi stok gelas fiktif.
   Teh dasar dapat dipakai lintas varian, sementara powder mempunyai penerimaan/stok sendiri: jangan memaksa batch teh/powder/cup menjadi satu batch harga menu tanpa aturan. Sinkronisasi POS membawa referensi versi resep penyajian; pemakaian transaksi historis tidak boleh berubah karena resep baru.
   Pengguna meminta menu perumusan yang dapat diisi admin karena takaran belum diketahui; resep produksi menentukan kebutuhan bahan/target L teh, resep per varian menentukan jumlah teh/powder/susu/kemasan per cup. Rancangan konfigurasi ada di `RECIPE_DESIGN.md`: rekomendasi awal tabel takaran dan scaling, formula tambahan aman bila diperlukan. Takaran belum diketahui **tidak menghalangi desain editor**, tetapi harus valid sebelum produksi/penjualan terkontrol berbasis resep.
1. Aturan kontrak stok titipan mitra, rusak/hilang, retur, koreksi harga stok yang belum terjual, serta saat timbulnya tagihan formal. **Harga pasokan dikunci saat mitra menerima stok dan unit terjual dialokasikan FIFO per produk/stand; jangan menetapkan ulang harga dari daftar harga terbaru saat tutup.**
2. Toleransi penjualan offline ketika harga/izin/katalog berubah; aturan periode laporan jika jam perangkat salah atau sinkron lewat tengah malam; prosedur pergantian HP.
3. Kebijakan autentikasi/perangkat offline, hosting/backup dan pengujian/deployment produksi sesuai anggaran pengembang tunggal. ORM/migrasi dan paket UI/testing development sudah dipilih; lihat `README.md`.
4. Contoh ekspor Accurate, tanggal cutover, definisi laporan keuangan/pajak yang diminta owner, dan validasi akuntan terkait pusat/DC/mitra.
