# Accurate Online — Checklist Ekspor untuk Analisis

Status: **checklist referensi pengumpulan data**. Lima file XLSX sudah diterima dan dipelajari read-only: master barang/pelanggan/pemasok serta dua adjustment cetak; hasil di `ACCURATE_INITIAL_ANALYSIS.md`. Belum ada import. Pengguna menjelaskan transaksi pembelian/penjualan lama tidak lengkap; jangan menuntut seluruh paket seolah data pasti tersedia. Checklist berikut membantu mengidentifikasi data yang bisa diperoleh, bukan alasan membuat transaksi historis fiktif.

## 1. Tempat menyimpan

Simpan file di:

```text
C:\teh-coyo-app\.local\accurate-exports\
```

Folder `.local` diabaikan Git. Jangan pindahkan ekspor mentah ke folder dokumentasi/source yang di-commit. Penamaan file bebas; lebih mudah jika jelas, misalnya `barang.xlsx`, `supplier.xlsx`, `rincian_pembelian_2026-09.xlsx`. Periode tersebut hanya contoh.

- Utamakan **Excel (.xlsx) atau CSV**, bukan screenshot/PDF saja. PDF laporan ringkas boleh menjadi pembanding total, bukan pengganti baris transaksi.
- Simpan **hasil ekspor asli** tanpa menghapus/menamai ulang kolom. Pembersihan dilakukan pada salinan/staging sesudah analisis, bukan mengubah file sumber.
- Pertahankan kode/ID, nomor dokumen, tanggal, satuan, nominal, dan relasi. Jangan membiarkan Excel mengubah kode bernol di depan atau nomor panjang menjadi angka/scientific notation.
- Catat tanggal ekspor, periode laporan, lokasi/gudang/cabang yang dipilih dan filter lain. Bila data besar, pecah file dengan periode yang tidak tumpang tindih; beri tahu jika daftar terpotong oleh batas ekspor.
- Hanya bagikan data yang diizinkan owner. Password Accurate, OTP, token API dan secret **tidak diperlukan**. Informasi pribadi yang tidak relevan dapat disamarkan pada salinan, dengan penggantian kode konsisten agar relasi tetap bisa diuji. Jangan menaruh nilai rekening/NPWP pribadi dalam ringkasan publik/repository.

## 2. Paket awal — tidak harus semua histori

### Wajib diusahakan terlebih dahulu

| File/data                                           | Tujuan dan kolom yang dicari (jika tersedia)                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Daftar barang                                       | Kode/ID, nama, jenis/kategori, status aktif, satuan beli/jual/stok, konversi kemasan, harga yang tersedia. Memastikan barang mentah/kemasan/hasil olahan tidak tertukar dengan menu cup POS.           |
| Daftar supplier/pemasok                             | Kode/ID, nama, status, termin pembayaran bila digunakan; informasi kontak seperlunya.                                                                                                                  |
| Daftar pelanggan (jika dipakai)                     | Kode/ID dan nama, terutama bila DC/mitra dicatat sebagai pelanggan di Accurate. Jangan menganggap pelanggan Accurate selalu end-user.                                                                  |
| Rincian pembelian **satu bulan yang sudah selesai** | Nomor/tanggal dokumen, supplier, kode barang, kuantitas, satuan, harga, diskon/pajak, total, serta lokasi/gudang jika ada. Butuh baris item, bukan hanya rekap total per supplier.                     |
| Rincian penjualan **bulan yang sama**               | Nomor/tanggal dokumen, pihak pembeli, kode barang, kuantitas, satuan, harga, diskon/pajak, total dan lokasi jika ada. Akan dikaji apakah ini pasokan pusat ke DC, penjualan eksternal atau jenis lain. |

Jika satu file tidak memuat header dan rincian sekaligus, kirim keduanya dengan **nomor dokumen sebagai penghubung**. Nama/jenis laporan dapat berbeda sesuai fitur Accurate yang dipakai; tidak diasumsikan semua format/kolom di atas pasti tersedia.

### Tambahan jika modul/data itu memang digunakan

- Penerimaan barang dan invoice/tagihan pembelian (jika dicatat terpisah).
- Pembayaran pembelian dan penerimaan pembayaran penjualan untuk bulan yang sama; sertakan referensi invoice/tagihan bila tersedia.
- Retur/pembatalan/koreksi pada bulan yang sama supaya total bisa direkonsiliasi.
- Daftar gudang/cabang, mutasi stok, atau penyesuaian/opname yang benar-benar ada.
- Rekap pembelian/penjualan bulanan sebagai pembanding jumlah dan nominal rincian.

Tidak perlu membuat dokumen yang belum pernah dicatat hanya untuk melengkapi ekspor. Catat keterbatasannya agar aplikasi baru tidak menganggap data itu lengkap.

## 3. Saldo dan histori lengkap — tahap berikutnya

Untuk mempelajari kebutuhan migrasi, jika mudah diperoleh kirim juga snapshot **pada satu tanggal yang konsisten**, misalnya akhir bulan yang dipilih:

- Saldo stok dan nilai persediaan per barang/gudang jika tersedia.
- Daftar utang/piutang yang masih terbuka.
- Saldo/akun kas-bank dan daftar akun, jika diperlukan untuk mengganti pencatatan keuangan pusat.

Tanggal snapshot analisis **bukan otomatis tanggal cutover/go-live**. Saldo awal final dan histori yang dipindahkan baru ditentukan bersama owner/akuntan setelah mapping jelas. Jangan mengimpor saldo awal dan transaksi lama sebagai posting stok/uang yang sama dua kali.

Karena Accurate saat ini terutama mencatat pusat, ekspornya mungkin **tidak** mempunyai stok fisik/penjualan stand, batch produksi DC, resep atau tagihan konsinyasi mitra. Data lapangan/manual ini dikumpulkan terpisah nanti. Jangan menyebarkan stok pusat menjadi stok DC/stand atau mengarang takaran resep dari data yang tidak memuatnya.

## 4. Hasil analisis yang akan dibuat sesudah file diterima

1. Inventaris file/sheet, periode, kolom, jumlah baris dan keterbatasan kelengkapan.
2. Mapping sumber → model aplikasi: barang/satuan/supplier/pelanggan/dokumen/keuangan; tandai data yang masih membutuhkan konfirmasi bisnis.
3. Temuan kualitas: kode duplikat/kosong, konversi satuan, tanggal/angka, relasi dokumen, retur dan pihak yang tidak jelas.
4. Rekonsiliasi total rincian dengan rekap (jangan menjumlahkan total header yang berulang di setiap baris sebagai omzet tambahan).
5. Rekomendasi perubahan model serta urutan implementasi pembelian/penerimaan/ledger/keuangan berdasarkan proses nyata.
6. Rancangan migrasi/dry-run dan daftar keputusan cutover; **tidak langsung melakukan impor**.

Nama kolom dan format impor belum dikunci sebelum melihat file nyata. Eksplorasi dilakukan read-only terhadap sumber; hasil analisis tidak memasukkan dummy sebagai saldo awal atau menimpa master pengguna. Untuk go-live, gunakan lingkungan data bersih/terpisah atau cleanup terotorisasi yang ditinjau dependensinya.

## 5. Langkah pengguna sekarang

Mulai dari **daftar barang, supplier, pelanggan jika dipakai, rincian pembelian dan penjualan satu bulan**. Simpan file dalam folder di atas lalu beri tahu nama file dan periode. Tidak perlu menunggu paket besar lengkap; barang dan supplier saja sudah cukup untuk mulai analisis awal, tetapi belum cukup untuk menjanjikan migrasi keuangan/stok final.
