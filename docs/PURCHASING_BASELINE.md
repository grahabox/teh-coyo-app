# Pembelian — irisan supplier/nota/terima/catatan bayar

Pengguna meminta lanjut modul pembelian sekaligus menyalakan layanan setelah restart. Modul ini dibuat di atas stok existing, tanpa import Accurate, seed supplier nyata/dummy otomatis, perubahan saldo awal atau transaksi dev otomatis.

## Scope aktual

1. **Supplier:** daftar server-paged/search, tambah kode/nama oleh pusat. Nama dan ID supplier di-snapshot pada nota; bukan importer/contact/bank-master.
2. **Nota pembelian barang:** pilih lokasi sendiri, supplier, nomor nota/faktur, tanggal, jatuh tempo opsional, keterangan dan barang/jumlah/harga per satuan dasar. Simpan draft → baca rincian → konfirmasi. Draft/konfirmasi **tidak mengubah stok/kas**. Total nota bukan PO atau biaya non-stok.
3. **Penerimaan aktual:** setelah nota dikonfirmasi, masukkan jumlah tambahan yang benar-benar diterima, tanggal, nomor bukti terima dan catatan. Penerimaan bertahap tersedia, sisa jumlah jelas, melebihi nota ditolak. Stok masuk ke lokasi pembeli melalui application service inventory dalam transaksi yang sama dengan counters/audit pembelian. Opening setiap barang harus sudah ditetapkan (nol bila kosong).
4. **Tautkan penerimaan existing:** bila barang sudah diterima lewat Stok & Mutasi, pilih dokumen RECEIPT POSTED di lokasi yang sama. Nama supplier snapshot, tanggal, seluruh barang/jumlah harus sesuai sisa nota. Seluruh satu dokumen ditautkan sekali (bukan dibagi lintas nota). **Tidak membuat mutasi stok baru**. Penerimaan yang sudah diklaim nota lain ditolak. Paged picker menampilkan referensi/tanggal; verifikasi dokumen dan bukti fisik sebelum menautkan.
5. **Catatan pembayaran:** setelah nota dikonfirmasi, input nominal rupiah, tanggal, tunai/transfer bank, sumber dana/kas/rekening pembayar, nomor bukti dan keterangan. Bayar parsial/lunas dan sisa tagihan terhitung. Bukan integrasi provider, verifikasi rekening, atau mutasi saldo kas/bank. Buku kas/jurnal belum dibuat. Status barang diterima dan pembayaran **independen**.

Nota dikonfirmasi merupakan dasar kontrol tagihan supplier dalam modul, bukan penetapan formal pengakuan biaya/utang/pajak pada general ledger. Barang belum diterima tidak dianggap tersedia walaupun nota lunas. Tagihan mitra/cup atau transfer internal pusat→DC tidak dibuat lewat nota supplier.

## Hak akses baseline

- Supplier read: admin pusat/DC; supplier create: pusat saja.
- Nota/terima/bayar: pusat dapat mencatat untuk pusat/DC/stand **milik sendiri**, admin DC hanya DC sendiri. Read admin DC mencakup DC/stand sendiri binaannya sesuai scope existing.
- Kasir/partner admin tidak dapat mengakses harga beli/catatan bayar melalui endpoint procurement. Master katalog/quantity inventory tetap mengikuti scope lama.
- Pembelian stand mitra ditolak bahkan untuk pusat agar tidak mengakui biaya mitra sebagai Teh Coyo. Belanja stand sendiri oleh kasir, mitra lokal, approval threshold, sumber dana otomatis dan configurable RBAC belum ditentukan/diaktifkan.

## Perhitungan dan histori

- Mata uang **IDR**, harga/nominal pembayaran berupa string rupiah utuh tanpa pemisah ribuan, maksimal 12 digit input. Quantity string maksimal 9+6 digit dalam satuan dasar existing (pcs/g/ml), bukan konversi kemasan.
- `lineAmount = quantity × unitPrice`, **HALF_UP per baris ke rupiah utuh**; `totalAmount = sum(lineAmount)` dan `outstanding = total - paid`. Backend decimal precision 40 untuk perkalian; UI bigint untuk preview. Harga positif, nilai hasil tiap baris minimal Rp1; total maksimal kapasitas Decimal(18,0). Tidak menerima total client sebagai otoritas.
- Ini nilai **barang saja**: belum diskon, ongkir, biaya non-stok, pajak/PPN/PPh atau input harga desimal rupiah. Jangan memaksakan nota dengan komponen tersebut agar seolah jumlahnya sudah cocok. HPP/valuasi/FIFO akuntansi belum ada dan harga nota tidak menjadi tarif cup mitra otomatis.
- Harga, supplierName, pemilik (`entityId`) dan ownership snapshot; transaksi lama tidak dihitung ulang dari nota/master baru. Edit/delete/batal/retur/kredit/koreksi payment/invoice belum tersedia, jangan konfirmasi dokumen keliru.
- Nomor nota normalized (trim, ruang ganda→satu, uppercase), unik supplier+entitas pembeli, termasuk lintas lokasi sendiri. Ini guard duplicate dasar, bukan OCR atau jaminan supplier tak memakai nomor sama; kebijakan pembatalan/reuse nomor belum tersedia.
- UUID nota/terima/tautan/payment mengikat payload+actor; retry sama mengembalikan hasil existing, isian berbeda 409. Bukti terima normalized dicegah berulang **per nota**, bukti bayar unik per nota. Saat menerima dari nota, referensi+supplier+lokasi yang sudah POSTED di buku stok ditolak agar pengguna memakai tautan existing. Ini guard dasar, bukan jaminan dedup bukti yang diberi nomor/nama berbeda; tidak ada idempotensi lintas perangkat/offline tahan restart. Setelah hasil ambigu, periksa dokumen sebelum membuat ID baru.
- Semua write memakai transaction + advisory lock inventory existing. Invoice receipt, balance/ledger/audit semuanya berhasil atau rollback. Pembayaran bersamaan tidak bisa membuat `paid > total`.
- Tanggal kejadian tidak boleh masa depan (Asia/Jakarta); terima/bayar tidak sebelum tanggal nota; jatuh tempo boleh masa depan tetapi tidak sebelum nota. Stok mengikuti batas tanggal ledger yang sudah ada. Uang muka sebelum nota/rebuild historis/closing period belum didukung.
- Ledger stock, event terima pembelian, dan catatan pembayaran append-only (DB triggers); application API tidak menyediakan edit/delete. Bukan audit tahan DBA/backup pengganti.

## API aktual

Prefix `/api/v1/purchasing`, authenticated dan role/scoped:

- `GET /suppliers?q=&page=&perPage=`, `POST /suppliers {id,code,name}`.
- `GET /invoices?locationId=&q=&page=&perPage=` (search nomor nota/supplier), `GET /invoices/:id`.
- `POST /invoices {id,locationId,supplierId,invoiceReference,businessDate,dueDate?,note,lines:[{stockItemId,quantity,unitPrice}]}`.
- `POST /invoices/:id/confirm`.
- `POST /invoices/:id/receive {id,businessDate,reference,note,lines:[{lineId,quantity}]}`: quantity **tambahan aktual**, kosong/0 tidak dikirim.
- `GET /invoices/:id/receipt-options?q=&page=&perPage=` dan `POST /invoices/:id/link-receipt {id,stockDocumentId,note}`.
- `POST /invoices/:id/payments {id,businessDate,amount,method,fundingSource,reference,note}`, method CASH/BANK_TRANSFER.

Paged responses `{items,total,page,perPage,totalPages}`, maksimal perPage 100. Request OpenAPI tersedia; response/native SDK lengkap belum diterbitkan.

## Uji dengan Dummy existing

1. Pembelian → Supplier → tambah **Dummy Supplier** memakai kode unik.
2. Siapkan saldo awal nol barang Dummy berunit pcs pada Dummy Pusat/DC jika belum ditetapkan. Jangan ulangi opening yang sudah ada.
3. Pembelian → pilih Dummy lokasi → nota `TEST-BUY-...`: 10 pcs × Rp5.000 = Rp50.000. Simpan draft lalu konfirmasi.
4. Terima 8 pcs dengan nomor bukti `TEST-GR-...`; stok bertambah 8 dan sisa nota 2. Jangan juga menerima lewat Stok & Mutasi.
5. Catat pembayaran Rp20.000 dengan sumber dana/bukti berlabel simulasi; sisa nota Rp30.000. Ini **bukan** perubahan saldo kas.
6. Jika sebelumnya ada receipt stok, gunakan tautkan existing, jangan terima ulang. Semua percobaan tersimpan; belum ada cleanup otomatis. Pakai hanya Dummy, jangan nota/supplier nyata untuk demo.

## Migrasi, verifikasi dan batas

- Migrasi additive `20261008080000_purchasing`; backup lokal `.local/backups/pre-purchasing-...dump` dan fingerprint membuktikan master/akun/resep serta seluruh stok existing tidak berubah saat migrasi. Tidak reseed/reset/import. Restore backup belum diuji.
- Apply: backup → `pnpm db:generate` → `pnpm db:deploy`. Bila perlu rollback, hentikan write, restore ke database recovery terpisah dan verifikasi dahulu; jangan menimpa kerja baru/drop histori. Sesudah transaksi baru lebih aman perbaikan forward + rekonsiliasi.
- Unit perhitungan/validasi backend/web dan real PostgreSQL dedicated `_test`: invoice draft/no stock, normalized duplicate/retry, actual 8+2 receiving, tautan existing tanpa movement, partial/concurrent payment guards, multi-item rollback, cross-DC/partner isolation, snapshot dan rekonsiliasi payment totals. Suite membersihkan tabel transactional dengan TRUNCATE **hanya explicit disposable `_test`**, serial, bukan dev.
- Browser Chromium dengan API **mock** menguji supplier/dialog, daftar/pickers, required, preview exact, dirty/network, konfirmasi, parsial receiving dan payment, overflow HP. Bukan full browser→API live E2E/Android fisik/load/security audit/offline proof.
- Selanjutnya produksi aktual/approval resep dan buku kas/closing memerlukan scope tersendiri. Retur/kredit, PO/approval terpisah, gudang/batch/expiry, HPP, pajak, import Accurate, mitra buying, edit/batal dan offline purchasing belum dibuat.

Run akhir: generate/typecheck/unit/build/format lulus; 25 unit API + 18 web, 19 alur integrasi. Browser mock terima/bayar parsial dan link existing lulus, screenshot dibaca. Service lokal web 5173/API 3000 HTTP 200; proxy login/read/logout existing berhasil, nol supplier/nota development otomatis dan 8 route procurement OpenAPI. Database existing tidak reset/reseed. Layanan launcher/log setelah restart di `.local/dev-session.json`, `.local/dev-output.log`, `.local/dev-error.log` (ignored).

## Impor master supplier terbatas — izin setelah modul dibuat

Pengguna meminta memasukkan pemasok XLSX lalu **berdiskusi tampilan dahulu**, bukan lanjut produksi/refactor UI. File tersedia bernama `daftar-pemasok.xlsx` (pengguna menyebut data-pemasok), sheet Daftar Pemasok. Workbook dibaca read-only dengan XML stdlib, tanpa evaluate formula/dependency baru; hash sama dengan analisis sebelumnya.

- Mapping **ID Pemasok → Supplier.code**, **Nama → Supplier.name**; 4 master ditambahkan create-only. Kode asli `V.000xx` dipertahankan, validasi supplier backend/web kini menerima titik selain A–Z/angka/-/_. Aturan kode domain lain tetap.
- Tidak mengimpor kontak, alamat, identitas pajak, termin COD, saldo utang atau transaksi/relasi barang. Data di luar scope tetap di file sumber ignored. Supplier minimal nyata, bukan dataset Dummy.
- Dry-run DB awal 0 supplier, create 4, konflik 0. Duplicate/name/ID conflicts menghentikan proses, tidak overwrite. Backup `.local/backups/pre-supplier-import-...dump` diambil sebelum write; atomic+lock, deterministic ID/source mapping dan audit tiap row (`accurate.supplier.imported`, hash/file/sheet/row/code) tanpa salin raw kontak.
- Fingerprint master/account/recipe dan seluruh stock/purchase table sebelum/sesudah sama. Repeat menambah 0/no audit baru; live supplier count 4, nota masih 0. Login/logout smoke hanya sesi pengujian; kredensial dipertahankan.
- Script/staging/report private `.local` merupakan maintenance sekali atas izin ini, **bukan UI/API importer umum**. Tidak reseed/migrasi/reset. Restore backup belum diuji; bila perlu koreksi review referensi/relasi dahulu, jangan hapus supplier yang sudah dipakai atau restore massal menimpa pekerjaan lain.
- Percobaan pembelian tetap memakai **Dummy Supplier**, bukan supplier nyata di sini. Sebelum go-live, pemisahan dummy/real dan saldo cutover masih perlu persetujuan.

Scope berikut hanya **diskusi tampilan**; tidak ada perubahan layout melalui permintaan impor ini. Validasi kode bertitik diuji unit backend/web, import counts/hash/preservation/rerun serta live paged API diverifikasi.
