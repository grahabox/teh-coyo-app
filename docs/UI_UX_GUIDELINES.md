# Teh Coyo — Pedoman Bahasa & Interaksi UI

Status: **scope Barang & Menu, Pusat/DC/Stand dan UX resep disetujui serta diimplementasikan**. Pengguna sudah berhasil login dan membuat barang. Keluhan utama: bahasa kaku/rancu dan halaman terasa sebagai kumpulan form; warna saat ini tidak menjadi masalah. Jeda penambahan modul untuk meninjau UX fondasi terlebih dahulu; rincian di luar scope yang disetujui tetap perlu persetujuan.

## 1. Bahasa pengguna, bukan nama tabel

**Feedback terbaru sesudah Pembelian dan impor supplier:** pengguna menilai pengelompokan rancu: supplier harus terpisah dari transaksi Pembelian, barang/item terkait supplier, dan Menu Minuman terpisah dari barang. Usulan kelompok navigasi Master Data → Supplier / Barang (Item) / Menu Minuman; transaksi → Pembelian / Stok & Mutasi. Ini menggantikan usulan lama Barang & Menu dan tab supplier dalam Pembelian untuk arah perbaikan berikut, **belum diimplementasikan/disetujui scope coding rinci**. Supplier detail dapat menampilkan barang yang dipasok; item detail dapat menampilkan supplier, tanpa menduplikasi master item. Supplier↔item many-to-many/default opsional adalah rekomendasi, belum aturan final/import mapping. Menu→resep→item tetap terpisah dari supplier dan saldo stok. Jangan otomatis menambahkan harga supplier/HPP/publikasi POS saat memisahkan navigasi.

- Gunakan bahasa Indonesia ringkas, sopan dan langsung; hindari jargon backend seperti scope, entity, base quantity atau mutation pada layar operasional.
- Label mengikuti tugas nyata. Nama model/API dapat tetap seperti sekarang; perubahan teks UI tidak otomatis mengubah aturan domain/skema data.
- Gunakan istilah lapangan seperti pusat, DC, stand, cup dan powder bila memang dipahami pengguna. Jelaskan istilah ambigu melalui bantuan singkat di dekat field, bukan instruksi panjang di semua layar.
- Status harus jujur: resep belum aktif, simulasi belum memutasi stok, fitur penjualan belum tersedia. Hindari badge/angka/tombol untuk fitur yang tidak bekerja.

Usulan istilah:

| Istilah saat ini  | Label yang diusulkan                          |
| ----------------- | --------------------------------------------- |
| Lokasi            | Pusat, DC & Stand                             |
| Katalog           | Barang & Menu                                 |
| Barang stok       | Daftar Barang                                 |
| Satuan dasar stok | Stok dihitung dalam (Gram / Mililiter / Buah) |
| Menu dan varian   | Menu Minuman; Rasa / Varian pada form         |
| Resep produksi    | Resep Produksi DC                             |
| Resep penyajian   | Takaran per Cup                               |
| Preview           | Hitung Kebutuhan Bahan                        |
| Scope             | Berlaku untuk                                 |
| Entitas           | Pemilik Usaha, dengan penjelasan bila perlu   |

Jangan menyebut parent DC/pemilik mitra sebagai hal yang sama. Jangan menghapus konsep kelompok menu dari data hanya demi tampilan sederhana; sembunyikan kompleksitas melalui urutan input yang jelas.

## 2. Daftar dulu, form saat diperlukan

- Tampilan utama master data: judul, deskripsi singkat, pencarian, tombol tambah sesuai izin, daftar data dan state loading/empty/error. Jangan menampilkan semua form pembuatan secara permanen.
- Usulan halaman Barang & Menu: tab **Barang** dan **Menu Minuman**, dengan aksi tambah sesuai tab. Desktop/tablet memakai tabel atau daftar terstruktur; HP memakai daftar/card ringkas tanpa tabel lebar yang memaksa horizontal scroll.
- Form pendek (barang/menu/lokasi): modal/dialog di desktop dan tampilan sheet/dialog yang nyaman di HP. Form panjang seperti resep: halaman/editor khusus, bukan semua dipaksa masuk modal.
- Tambah menu/rasa harus mengikuti langkah pengguna, bukan memaksa memahami relasi tabel. Kombinasi pembuatan menu+rasa membutuhkan kontrak transaksi yang aman; bila API belum mendukung operasi atomik, tampilkan langkah/status parsial secara eksplisit dan jangan mengklaim gagal total setelah sebagian tersimpan.
- Pencarian awal atas daftar yang dimuat boleh client-side; tidak mengaku mencari seluruh database jika endpoint masih membatasi hasil 500. Pagination/filter server akan dirinci saat skala membutuhkannya.
- Jangan menampilkan aksi edit/hapus/import/detail stok jika endpoint/aturan belum dibuat. Tidak menghapus atau mengubah barang yang telah ditambahkan pengguna untuk keperluan demo.

## 3. Validasi yang membantu

- Frontend memvalidasi sebelum submit dan saat blur/field dikoreksi setelah error; jangan memberi error merah pada field yang belum disentuh. Backend tetap otoritas final.
- Tampilkan pesan di bawah field terkait, label wajib, contoh input dan bantuan satuan yang relevan. Contoh: "Isi nama barang", "Pilih satuan pencatatan", "Kode sudah digunakan; gunakan kode lain".
- Pertahankan input ketika API gagal, petakan `issues` backend ke field, fokus ke error pertama. Kesalahan umum/network tetap ditampilkan dekat form; toast saja tidak cukup untuk error yang perlu diperbaiki.
- Status kode duplikat diperiksa final di backend/unique constraint; cek frontend hanya bantuan, bukan jaminan. Jangan mengarang auto-number/code generation tanpa desain server yang disepakati.
- Submit pending: tampilkan "Menyimpan…", cegah submit ganda dan jangan menutup form sampai hasil server diterima. Field/button status dapat dijelaskan jika tidak tersedia; pending bukan pengganti idempotensi transaksi.

## 4. Hasil aksi dan pembatalan

- Sukses: tampilkan pesan singkat yang spesifik (mis. "Barang berhasil ditambahkan"), perbarui daftar setelah respons server, lalu tutup dialog. Jangan menyamakan tersimpan lokal dengan diterima server saat offline POS nanti dibuat.
- Batal/tutup/Escape/backdrop: jika form berubah dan belum disimpan, konfirmasi sebelum membuang. Jangan menutup saat request belum selesai tanpa desain yang menangani hasil tertunda.
- Dialog harus mengelola focus trap, fokus awal, mengembalikan fokus ke pemicu, accessible title/description, scroll di layar kecil, dan label tombol tutup. Keyboard dan pembaca layar tetap didukung.
- Gunakan feedback ringan (toast/status live) untuk hasil, bukan popup konfirmasi sukses berulang. Konfirmasi untuk aksi berisiko, bukan setiap klik biasa.

## 5. Scope dan penerimaan perbaikan pertama

Scope pertama yang disetujui: **Barang & Menu**, komponen dialog/field/error/success yang reusable, dan penyesuaian label navigasi yang terkait. Resep/lokasi dirapikan sesudah pola ini ditinjau pengguna; tidak sekaligus menambah inventory atau fitur bisnis baru. Backend hanya diubah untuk feedback field yang jelas; tidak ada reset/migrasi data untuk perbaikan ini.

Uji penerimaan:

- Halaman tidak menampilkan form permanen; tombol tambah hanya bagi pengguna yang berwenang.
- Submit kosong/salah satuan/kode duplikat memberi error spesifik; input tetap ada saat API gagal.
- Sukses terlihat sekali, data muncul tanpa refresh manual dan form ditutup setelah konfirmasi server.
- Cancel form kosong, cancel dengan perubahan, pending request, Escape/fokus dan ukuran HP/tablet diuji.
- Data barang existing tetap ada; warna utama dipertahankan.
- Backend permission tetap menolak akses tanpa hak meskipun request dikirim di luar UI.

## 6. Implementasi dan verifikasi scope pertama

- `apps/web/src/features/catalog.tsx`: tab Barang/Menu Minuman, pencarian daftar termuat, tabel desktop/card HP, kelompok/rasa berurutan, tombol tambah sesuai izin; tidak ada form permanen atau aksi edit/hapus palsu.
- `features/catalog/catalog.forms.tsx` dan `catalog.schemas.ts`: modal tambah barang, kelompok dan menu/rasa memakai React Hook Form/Zod. Label dan bantuan sederhana, validasi inline saat blur/submit, input dipertahankan pada kegagalan, field issues server dipetakan dan fokus dikembalikan setelah request gagal.
- `components/ui/form-dialog.tsx`: native dialog tanpa dependency tambahan, focus trap/restore, judul/deskripsi aksesibel, Escape/backdrop/Batal konsisten, konfirmasi buang isian, tidak menutup selama submit; fullscreen HP dengan footer tetap dan scroll konten. Pembukaan ditunda satu animation frame agar replay effect StrictMode tidak menyebabkan blur/error pada form yang belum disentuh.
- `components/ui/success-notice.tsx`: notifikasi ringan/live setelah konfirmasi server. Daftar langsung diperbarui dari record terkonfirmasi; refresh daftar gagal tidak mengubah penyimpanan sukses menjadi alasan submit ulang.
- `lib/api.ts` dan backend catalog service: `issues` aman diteruskan ke field; kode duplikat, kelompok/nama rasa duplikat dan satuan tidak valid memperoleh pesan spesifik, tetap memakai constraint database dan authorization backend.
- Navigasi `Katalog → Barang & Menu`, `Lokasi → Pusat, DC & Stand`. Warna tidak diganti, tidak ada perubahan skema/reset data. Kelompok minuman dan rasa tetap dua operasi terpisah; sukses kelompok menyatakan langkah berikutnya, tidak menyamar sebagai pembuatan seluruh paket menu atomik.
- Test unit, typecheck/build dan integration PostgreSQL dijalankan. Browser smoke Edge/Chromium via CDP dengan **API mock**, bukan data pengguna, menguji tab/search, required/duplicate/unit/network error, state pending/deduplikasi submit, success/refetch gagal, cancel kosong/dirty/Escape/backdrop, fokus, scope UI dan viewport desktop/HP/tablet.
- Test browser belum menggantikan pengujian Android fisik (keyboard virtual/touch/back Android), screen reader, atau integrasi browser→server penuh. User perlu mencoba pola baru sebelum memperluas ke lokasi/resep.

## 7. Perluasan organisasi (scope disetujui)

- Pengguna menerima perbaikan Pusat/DC/Stand dan menunda edit/hapus/nonaktifkan; role/cakupan baseline tetap aktif, manajemen RBAC configurable belum dibuat. Tidak menganggap RBAC UI belum ada berarti backend bebas akses.
- Ganti box/form permanen dengan tab Pusat, DC, Stand dan Pemilik Usaha. Daftar tabel desktop/baris HP dengan pencarian dan pagination server, filter induk/kepemilikan, serta detail yang bisa membawa ke daftar DC atau stand binaan. Tidak ada status aktif/nonaktif palsu.
- Dialog tambah sesuai tab (tidak meminta jenis lokasi berulang), helper field/error/footer/save sama dengan katalog. Pemilik lokasi sendiri mengikuti induk; stand mitra memilih pemilik berbeda. Pengaturan pemilik usaha dipisah dalam tab, bukan form harian yang selalu terbuka.
- Pemilih induk/pemilik mencari dan memaginasi server, bukan dropdown ratusan data. Error/empty/loading tersedia, Escape pemilih menutup pilihan dahulu, lalu modal mengikuti perlindungan isian. Pemilik yang belum ada ditambahkan sebagai langkah terpisah, tidak membuat entity/lokasi parsial diam-diam.
- Endpoint additive `/locations/page`, `/entities/page`, `/locations/:id/detail`; tidak memutus editor resep yang masih memakai endpoint lama. Data dan skema tetap, no reset/migration. Detail hanya data organisasi, bukan tombol saldo/keuangan yang belum berfungsi.
- Uji browser memakai fixture 60 DC/63 stand untuk paging/search/filter/drill-down/parent picker/create dan read-only DC. Integration test real PostgreSQL memverifikasi total/offset/filter/scope/count/detail, duplicate code dan kepemilikan mitra, ditambah 505 stand fixture untuk query di luar first-500. Tetap bukan uji Android fisik atau load test produksi.

## 8. UX resep — scope disetujui dan diimplementasikan

Pengguna menyatakan organisasi sudah lebih baik dan menyetujui perbaikan resep berikut. Daftar/editor/detail/simulasi telah dibuat; tetap create dan read/preview saja, tanpa edit/publikasi/approval/stok. Draft existing tidak diubah.

- Usulan daftar utama: tab **Produksi DC** dan **Takaran per Cup**, pencarian nama, keterangan berlaku untuk, output/menu, status jelas **Belum aktif**, dan aksi **Buka resep** / **Buat resep** sesuai hak akses. Hindari menampilkan setiap tabel bahan dan form simulasi dalam kartu daftar. Jika daftar dipaginasi, gunakan endpoint additive server dengan scope; jangan mengklaim pencarian seluruh database dari array 500 lama.
- Membuat resep memakai editor halaman tersendiri, bukan modal panjang. Jenis sudah mengikuti tab; bagian informasi/output, daftar bahan/takaran, serta ringkasan dipisahkan secara visual. Produksi memilih barang hasil dan jumlah standar batch; penyajian memilih menu/rasa dan basis tetap satu cup. Dropdown satuan dibatasi dimensi bahan/output yang kompatibel; field error tetap spesifik dan backend tetap otoritas.
- Resep kosong bahan boleh disimpan sebagai draft bila header/output valid; baris yang sudah ditambahkan tetapi tidak valid harus diberi error, bukan diabaikan atau diberi takaran nol. Jangan memasukkan angka contoh sebagai takaran operasional default.
- Simpan draft baru menunggu konfirmasi server, memberi feedback dan kembali ke daftar; jangan tetap berada di editor yang mendorong klik simpan berulang menjadi beberapa draft. Keluar dengan perubahan belum disimpan memerlukan perlindungan; tidak ada klaim autosave/offline editor tanpa implementasi.
- Buka resep existing menampilkan rincian **read-only** dan aksi **Hitung Kebutuhan Bahan** untuk simulasi target liter/unit produksi atau jumlah cup. Hasil menyebut target yang dihitung dan bahwa stok tidak berubah; hasil lama perlu disembunyikan/ditandai jika input target berubah. Tidak menyediakan tombol edit/aktifkan/hapus yang belum bekerja. Penyimpanan draft baru bukan otomatis versi terbit dari draft lama.
- Gunakan warna dan helper UI yang sudah ada. Tetap membedakan target yield standar vs hasil produksi aktual, satuan massa vs volume, serta resep dari tarif paket mitra. Data draft/komponen existing tidak diubah atau dihapus untuk refactor tampilan.
- Scope telah disepakati dan diuji: required/decimal/satuan/duplikat bahan, cancel editor/navigasi, pending/success/error, original tanpa powder vs varian dengan komposisi berbeda, scope admin DC dan viewport HP/tablet. Refactor ini tidak sekaligus menambah production posting, approval, CRUD atau formula bebas.

Implementasi: `features/recipes.tsx` daftar dengan paged search; `features/recipes/recipe.editor.tsx` editor per jenis; `recipe.detail.tsx` rincian/simulasi; `recipe.schemas.ts` validasi frontend; `leave-guard.tsx` + guard host app untuk keluar. Form bantuan memanfaatkan komponen existing. Backend paged/detail/catalog pickers additive dan field issues untuk takaran nol, duplikat bahan dan satuan tidak kompatibel. Unit test/real-DB integration/browser mock dijalankan. Browser mock memakai resep list 31 data, membuat original tanpa powder dan draft kosong, menjaga isian saat network gagal, serta menguji stale simulation dan cakupan DC. Tidak ada klaim Android fisik, browser-back router, persistent draft atau approval operasional sudah bekerja.

## 9. Stok Dasar — scope disetujui dan dibuat

- Menu **Stok & Mutasi**: pilih lokasi dahulu, tab saldo/dokumen/riwayat server-paged; belum opening tampil **Belum ditetapkan**, bukan nol palsu. Angka hanya jumlah barang, bukan laba/aset/tagihan mitra.
- Editor panjang halaman terpisah: header, barang/jumlah dalam satuan dasar; inline required/quantity/duplicate validation, searchable paged pickers, dirty leave guard/navigation/logout/beforeunload dari helper existing (label generik sesuai dokumen). Simpan draft kembali ke rincian; tidak mengubah stok sampai konfirmasi.
- Detail read-only + dialog konfirmasi posting/kirim; risiko stok jelas. Draft keliru tidak dikonfirmasi; edit/batal belum ada, tidak ada tombol palsu. Penerimaan aktual form terpisah di rincian kiriman, jumlah tambahan bukan kumulatif; kosong berarti tidak diterima, melebihi sisa ditolak. Selisih tetap terbuka tanpa dianggap hilang/diterima.
- Simpan/penerimaan memakai UUID stabil untuk retry selama form hidup, pending guard dan error mempertahankan isian. Tidak autosave/offline inventory. Setelah respons ambigu/perangkat reload, periksa dokumen dahulu sebelum membuat ID baru.
- Browser Chromium API mock diuji untuk list/editor/required/dirty/network/post/transfer terima parsial dan tidak overflow HP. Aturan stok atomik/concurrency/scope diuji terpisah pada PostgreSQL test. Panduan serta batas di `docs/INVENTORY_BASELINE.md`.

## 10. Pembelian — scope diminta dan dibuat

- Menu **Pembelian**: tab nota/supplier, pilih lokasi sendiri lalu list, server paging/search. Supplier form dialog pendek, nota editor halaman terpisah, read-only detail dan confirmation. Paged supplier/item/location choices; ID/retry stabil selama form hidup, pending guards, field errors, network preserves dan dirty navigation/logout/beforeunload.
- Harga rupiah per satuan dasar, total/baris preview eksak bigint HALF_UP, hasil final backend. Jelaskan belum pajak/discount/ongkir/HPP; jangan sebut nilai stok atau laba. Nota draft/confirm tidak menambah stok; status terima terpisah dari bayar.
- Form terima aktual dan catatan pembayaran hanya dibuka saat aksi dipilih, mode tunggal agar guard tidak saling menimpa. Terima jumlah tambahan bukan kumulatif, bukti wajib; melebihi sisa ditolak. Link existing memakai paged picker receipt posted, bukan mengetik ulang semua barang atau menambah stok kedua kali.
- Catatan bayar jelas **belum mengubah saldo kas/bank/verifikasi provider**; nominal tidak default sisa tagihan, wajib sumber dana/bukti. Hasil terima/pay/link memperbarui detail dan list/inventory; data tidak dihapus saat error. Edit/batal/retur tidak menampilkan tombol palsu.
- Browser mock desktop/HP/tablet menguji supplier/create, invoice/required/preview/dirty/network/confirm, partial receive/pay/link, overflow. Backend real `_test` menguji money/idempotency/concurrency/shared ledger; bukan Android fisik/offline/full live E2E. Batas/API di `docs/PURCHASING_BASELINE.md`.
