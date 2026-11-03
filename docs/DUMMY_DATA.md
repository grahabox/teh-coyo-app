# Data Dummy Development — Teh Coyo

Pengguna meminta data contoh dimasukkan agar tidak perlu mengisi manual. Dataset **`tehcoyo-foundation-dummy-v1`** telah ditambahkan ke database lokal `teh_coyo`. Data ini untuk mencoba UI/relasi/simulasi, **bukan data usaha, SOP produksi, takaran yang disahkan, atau saldo awal**.

## Isi dataset tambahan

| Data                  | Jumlah | Keterangan                                                                  |
| --------------------- | -----: | --------------------------------------------------------------------------- |
| Pemilik usaha         |      4 | 1 entitas Teh Coyo dummy dan 3 pemilik mitra dummy                          |
| Pusat                 |      1 | Pusat Utama — Dummy                                                         |
| DC                    |      6 | Cirebon, Kuningan, Majalengka, Indramayu, Bandung, Tasikmalaya              |
| Stand                 |     36 | 6 per DC: 4 sendiri + 2 mitra, total 24 sendiri dan 12 mitra                |
| Barang                |     14 | Bahan teh, gula, air, teh dasar, 5 powder, susu, es, cup, tutup dan sedotan |
| Kelompok menu         |      1 | Es Teh — Dummy                                                              |
| Rasa/menu             |      6 | Original, Coklat, Melon, Matcha, Taro, Stroberi                             |
| Draft produksi        |      4 | Teh dasar standar 10/20/40 L global serta 10 L untuk DC Cirebon dummy       |
| Draft takaran per cup |      7 | 6 rasa global dan contoh Coklat khusus DC Cirebon dummy                     |

Ini **jumlah yang ditambahkan**, bukan jumlah keseluruhan database. Data DEMO dari seed awal dan isian pengguna tetap ada. Semua nama baru memuat “Dummy”, kode master memakai prefix `DUMMY-`; resep memakai ID deterministik per dataset/key karena belum mempunyai field kode unik. Pencarian `Dummy`/`DUMMY-` membantu menemukan data ini.

## Contoh simulasi yang bisa langsung dicoba

1. **Resep → Produksi DC → Teh Dasar 10 L — Dummy → Buka resep**.
   Target 25 L menghasilkan kebutuhan standar bahan teh 250 g, gula 2.000 g, air 25.000 ml. Hasil resep hanya target ilustrasi; jangan menganggap semua input pasti menghasilkan volume tersebut di produksi nyata.
2. **Resep → Takaran per Cup → Takaran Original — Dummy**.
   Target 10 cup membutuhkan teh dasar 1.800 ml, es 800 g, cup/tutup/sedotan masing-masing 10 pcs. Original tidak memakai powder/susu pada fixture ini.
3. **Takaran Coklat — Dummy**, target 10 cup: teh dasar 1.200 ml, powder coklat 200 g, susu 150 g, es 800 g, cup/tutup/sedotan masing-masing 10 pcs. Ini komposisi uji, bukan perhitungan penggantian ml teh oleh gram powder/susu.
4. **Pusat, DC & Stand → DC → DC Cirebon — Dummy → Detail → Lihat stand binaan**.
   Coba filter sendiri/mitra dan halaman Stand (36 data, lebih dari satu halaman 25).

Semua resep masih **DRAFT/Belum aktif**, hanya create/read/simulasi. Tidak ada posting stok, pemakaian bahan nyata, penjualan, pembelian, saldo uang, harga pasokan/retail, pajak, merchant gateway atau akun demo tambahan. Modul supplier/transaksi yang belum tersedia tidak dipalsukan dengan tabel baru.

## Menjalankan ulang (opsional)

Data **sudah dimasukkan**; cukup refresh browser, tidak perlu menjalankan lagi. Untuk development berikutnya:

```sh
pnpm db:seed:dummy --confirm-development-data
```

Prerequisites: migrasi telah diterapkan, satuan standar tersedia, admin pusat aktif sesuai `SEED_ADMIN_EMAIL` dan `.env` API sudah benar. Bila database baru, jalankan setup biasa (generate/deploy/seed admin) terlebih dahulu. Command dummy tidak mengganti kredensial atau membuat akun baru.

## Perlindungan

- CLI membutuhkan flag konfirmasi eksplisit, `NODE_ENV=development/test`, host PostgreSQL lokal dan nama database `teh_coyo` atau `*_test`; produksi/remote/nama database lain ditolak. Penanda development bukan pengganti kontrol akses server produksi; jangan menjalankan fixture di data operasional.
- Seluruh run dalam satu transaksi database dengan advisory lock; gagal berarti rollback run tersebut. ID stabil/prefix tersendiri, **create-only**, data existing—including dummy yang pernah berubah—tidak ditimpa. Collision kode/ID constraints menggagalkan transaksi, bukan memodifikasi data pengguna.
- Setiap record baru mempunyai audit `dummy.seed_created`, dataset, jenis dan flag illustration. Command ulang tidak membuat resep/audit ganda untuk record existing. Command tidak memulihkan komponen dummy yang dihapus manual dari database; jangan menganggap rerun sebagai repair tool.
- Takaran memakai decimal/conversion yang sama dengan preview domain; resep konfigurasi diperiksa terhadap skema, relasi/satuan/yield standar. Tidak ada formula bebas.
- Backup sebelum injection tersedia lokal di `.local/backups/before-dummy-v1.dump` (format custom pg_dump; archive list diperiksa, **restore belum diuji**). Fingerprint data existing sebelum/sesudah sudah cocok; tidak menulis nilai secret/password ke dokumentasi. Backup bisa memuat data sensitif, jangan commit/share. Folder `.local` diabaikan Git.
- Belum ada tombol/command hapus dummy. Sebelum cutover produksi gunakan database terpisah dan migrasi data yang direkonsiliasi, atau rencanakan cleanup terotorisasi berdasarkan ID/audit/ref dependency. Jangan memakai `deleteMany` seluruh tabel atau sekadar prefix untuk menghapus data tanpa review.

## Verifikasi nyata

- Unit fixture: penanda/unik/stable ID, relasi jenis resep, validasi komponen/satuan, guard produksi/remote/flag, Original tanpa powder.
- Integration PostgreSQL terisolasi: create semua dataset, rerun tidak duplikat, field dummy yang diubah tetap tidak ditimpa, data unrelated tetap sama, audit, struktur parent/ownership dan preview seluruh 11 resep. Fixture test dibersihkan berdasarkan ID audit suite, bukan data pengguna.
- Database pengguna: backup diambil, command dijalankan dua kali; run pertama menambah 79 record master/header (komponen resep tersimpan sebagai anak), run kedua menambah 0 dan melewati 79. Fingerprint data existing termasuk draft/komponen/user/unit diverifikasi tidak berubah.
- Live API melalui proxy web: jumlah dummy organisasi/katalog sesuai tabel, detail+preview seluruh 11 draft berhasil, `planningOnly=true`. Tidak ada transaksi keuangan/stok atau saldo fiktif.
