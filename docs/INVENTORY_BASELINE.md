# Stok Dasar — tahap pertama

Scope disetujui: jumlah stok per lokasi, buku mutasi, saldo awal, penerimaan supplier, transfer kirim/terima dan penyesuaian beralasan. Paper opsional. Tidak mengimpor Accurate, menggandakan stok pusat/DC bayangan atau mengisi saldo operasional otomatis.

## Fitur dan kontrol

- Menu **Stok & Mutasi**: pemilih lokasi scoped/server-paged, tab saldo/dokumen/riwayat, pencarian dan pagination server. Semua barang terlihat meski belum punya saldo.
- Editor → simpan draft → rincian read-only → konfirmasi posting/kirim. Draft tidak mengubah stok. Jumlah dalam satuan dasar barang; tidak ada konversi kemasan/PCS–g/ml otomatis.
- Saldo awal per lokasi/barang hanya sekali, **termasuk nol eksplisit**. Belum ditetapkan mengembalikan `quantity: null`, bukan nol. Mutasi berikutnya memerlukan saldo awal, termasuk di tujuan transfer.
- Penerimaan supplier wajib nama supplier (snapshot sumber) dan referensi nota/surat jalan. **Modul pembelian kemudian dibuat** (`docs/PURCHASING_BASELINE.md`): supplier/nota/harga/sisa tagihan dan catatan bayar, terima dari nota memakai service stok yang sama, existing RECEIPT POSTED dapat ditautkan tanpa mutasi baru. Jika ada nota, terima dari Pembelian, jangan mencatat kedua kali lewat stok. Bukti terima supplier/lokasi yang sama ditolak saat mencoba menerima dari nota jika sudah posted. PO/biaya/tax/kas-bank belum ada.
- Penyesuaian adalah **delta bertanda**, bukan stok akhir; alasan/referensi wajib, saldo negatif ditolak. Koreksi tidak menghapus histori.
- Transfer hanya **pusat → DC binaan** dan **DC → stand binaan**, bukan retur/antar-DC. Kirim mengurangi sumber; terima menambah tujuan **sesuai aktual**. `quantity - receivedQuantity` adalah sisa perjalanan/selisih terbuka. Penerimaan bertahap tersedia; tidak otomatis write-off atau retur.
- Ledger dan event penerimaan append-only di DB; snapshot saldo, mutasi dan audit atomik. `sequence` membedakan urutan posting pada waktu sama. Bukan audit tahan administrator DB.

| Aksi                           | Hak akses baseline                                                |
| ------------------------------ | ----------------------------------------------------------------- |
| Lihat saldo/riwayat            | Pusat semua; DC sendiri/stand langsung; kasir/mitra stand sendiri |
| Saldo awal/penyesuaian         | Admin pusat                                                       |
| Draft/post penerimaan supplier | Admin pusat; admin DC untuk DC sendiri                            |
| Draft/kirim transfer           | Admin pusat; admin DC dari DC sendiri ke stand binaan             |
| Terima transfer                | Admin pusat atau akun yang ditugaskan pada lokasi tujuan          |

Draft transfer masuk belum terlihat pada akun tujuan. Setelah kirim, sumber/tujuan dapat melihat sesuai scope. Admin DC pembina tidak otomatis mengkonfirmasi terima atas nama stand; gunakan akun tujuan/admin pusat. Ini role baseline, bukan RBAC configurable baru.

## Angka, retry dan tanggal

- Decimal string maksimal 9 digit sebelum titik/6 sesudahnya untuk input; saldo akumulasi `Decimal(18,6)`. Arithmetic stok eksak; UI sisa memakai bigint.
- UUID draft klien mengikat isian+actor. Retry sama mengembalikan dokumen existing; isi berbeda 409. Konfirmasi post/ship berulang tidak mengubah stok dua kali.
- Penerimaan memakai UUID event tersendiri; ID+isian sama tidak menggandakan penerimaan. ID sama dengan isi/actor/dokumen berbeda 409. Ini **bukan antrean offline tahan restart**; setelah respons ambigu, periksa dokumen/riwayat sebelum membuat ID baru.
- Semua write melalui transaction + satu advisory lock PostgreSQL. Pengiriman bersamaan tidak dapat menghabiskan saldo yang sama dua kali. Lock global sederhana untuk tahap awal, bukan klaim throughput produksi; timeout dapat dicoba ulang dengan ID sama.
- Batas hari ini memakai **Asia/Jakarta**. Masa depan ditolak; posting tidak boleh mendahului saldo awal atau mutasi terakhir barang/lokasi. Terima tidak boleh sebelum kirim/penerimaan sebelumnya. Koreksi mundur/rebuild ledger dan closing period belum tersedia.

## API

Prefix `/api/v1/inventory`, authenticated:

- `GET /balances`, `/documents`, `/movements`: wajib `locationId`; opsional `q`, `stockItemId`, `page`, `perPage` (maks 100). Respons `{items,total,page,perPage,totalPages}`. Search saldo/mutasi nama-kode barang; dokumen referensi/keterangan.
- `GET /documents/:id`: header, rincian, sumber/tujuan dan catatan penerimaan.
- `POST /documents`: `{id,kind,locationId,destinationId?,businessDate,reference,reason,supplierName?,lines:[{stockItemId,quantity}]}`. Kind `OPENING|RECEIPT|ADJUSTMENT|TRANSFER`. Tanggal `YYYY-MM-DD`, jumlah string; barang tidak boleh duplikat.
- `POST /documents/:id/post`: saldo awal/penerimaan/penyesuaian.
- `POST /documents/:id/ship`: transfer.
- `POST /documents/:id/receive`: `{id,businessDate,note,lines:[{lineId,quantity}]}` berupa jumlah **tambahan aktual**, bukan total kumulatif. Lewati barang yang tidak diterima; minimal satu positif; melebihi sisa ditolak.

Request tersedia di OpenAPI; SDK native/typed response schemas lengkap belum diterbitkan. Transfer tidak menciptakan penjualan, cash atau kewajiban mitra.

## Mencoba dengan Dummy existing

1. Login admin pusat → **Stok & Mutasi** → pilih **Dummy Pusat**.
2. Buat saldo awal satu barang Dummy berunit pcs: **100**, referensi `TEST-AWAL-...`, alasan bahwa ini simulasi. Simpan draft; stok belum berubah sampai dikonfirmasi.
3. Pada **Dummy DC** tujuan, tetapkan saldo awal **0** barang yang sama.
4. Di Dummy Pusat, transfer **20** ke DC tersebut lalu konfirmasi kirim. Pusat **80**, DC masih **0**.
5. Buka transfer, terima **18** sebagai admin pusat. DC **18**, sisa perjalanan **2**, status belum lengkap.
6. Bila sisa benar-benar diterima dalam simulasi, catat tambahan **2**. DC **20**, transfer lengkap. Jangan menganggap barang hilang diterima hanya untuk menutup dokumen.

Gunakan **lokasi/barang Dummy saja**. Percobaan tersimpan, tanpa cleanup otomatis. Jika saldo awal sudah pernah ditetapkan, jangan ulangi; gunakan pasangan lain/lanjut saldo yang ada. Implementasi tidak memasukkan transaksi stok dummy otomatis ke database development.

## Migrasi dan pemulihan

- Migrasi additive `20261007080000_inventory` dan `20261007080100_stock_movement_order`; master, akun/secret dan resep existing tidak berubah. Pre-inventory dump serta fingerprint preservasi di `.local/backups` (ignored).
- `pnpm db:generate` lalu `pnpm db:deploy` setelah backup; tidak `migrate reset`/seed ulang. Database integrasi eksplisit `_test`.
- Rollback sebelum ada dokumen nyata: hentikan layanan, rollback kode, restore backup ke **database recovery terpisah**, verifikasi lalu alihkan koneksi setelah persetujuan. Jangan drop histori/restore menimpa pekerjaan baru. Jika ada dokumen baru, utamakan perbaikan forward dan rekonsiliasi; rollback perlu rencana preservasi. Restore backup belum diuji.
- Integration suite inventory membersihkan tabel stok dengan TRUNCATE hanya dalam database `_test` yang eksplisit. Gunakan DB test khusus/disposable, jangan arahkan ke DB berisi data penting. Suite dijalankan serial.

## Batas dan verifikasi

Belum edit/batal draft, pembalikan otomatis, penyelesaian kehilangan/retur transit, gudang reject/batch/expiry, antarwilayah, nilai stok/HPP, produksi aktual, POS/closing, tarif mitra/FIFO, impor Accurate atau offline inventory. Jumlah fisik di mitra bukan penetapan kepemilikan konsinyasi. Pilot nyata perlu saldo terverifikasi, penugasan/kepemilikan dan SOP terkait.

Unit web/API; integration PostgreSQL khusus `_test`: draft tanpa stok, nol opening, retry/409, 100→80→18→20, rollback multi-line, concurrent overspending, scope source/destination/cross-DC, tanggal/decimal, audit dan ledger vs saldo. Browser Chromium **API mock**: daftar/required fields/paged pickers, dirty navigation, network failure, posting, transfer, terima parsial dan overflow HP. Bukan Android fisik, offline, load/security audit atau full browser→API live E2E.

Run akhir: 21 unit API/15 web dan 12 alur integrasi (7 inventory), typecheck/build/format lulus. Health dan OpenAPI serta login existing melalui proxy web berhasil; GET inventory Dummy menunjukkan 15 barang belum opening, nol dokumen/mutasi. Sesi smoke logout, tidak ada posting stok dev. Screenshot mock HP/desktop tersimpan lokal/ignored dan dibaca. Restore backup belum diuji.
