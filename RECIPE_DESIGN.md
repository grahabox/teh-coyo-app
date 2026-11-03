# Teh Coyo — Rancangan Resep & Perumusan

Status: **usulan desain** berdasarkan permintaan pengguna; belum ada implementasi atau takaran nyata yang disetujui. Rujuk `PROJECT_CONTEXT.md`, `IMPLEMENTATION_PLAN.md` dan `AGENTS.md`. Pengguna belum mengetahui rumus/takaran. Jangan mengarang SOP resep untuk produksi nyata; takaran diisi kemudian oleh admin berwenang, diuji dan disetujui sebelum dipakai operasional.

## 1. Kebutuhan dan prinsip

- Sediakan menu konfigurasi resep produksi **teh dasar di DC** dan resep penyajian **per cup/per varian di stand**, bukan hardcode daftar bahan atau angka takaran dalam aplikasi.
- Admin dapat menambah/menghapus baris bahan, memilih item stok dan satuan, mengisi jumlah dan parameter, serta menentukan output/target. Menu original bisa tanpa powder; varian rasa memakai komposisi berbeda (contoh bahan tambahan dari pengguna: powder dan susu kental manis). Jumlah teh dasar untuk tiap varian dapat berbeda; **jangan** mengasumsikan jumlah teh sama untuk semua varian.
- Rekomendasi MVP: editor tabel resep + scaling batch/jumlah cup + preview kebutuhan. Tidak perlu bahasa pemrograman atau formula bebas untuk mendapatkan fleksibilitas tersebut. Editor ekspresi matematis terbatas adalah kemampuan tambahan bila contoh aturan nyata membutuhkannya; detail grammar/library belum dipilih.
- Resep mengatur pemakaian standar stok dan estimasi biaya, **bukan otomatis tarif pasokan/tagihan mitra atau perlakuan pajak**. Tagihan mitra tetap per cup terjual; kaitan lapisan harga pasokan dengan penerimaan multi-bahan tetap perlu keputusan terpisah.

## 2. Resep produksi DC

Data konfigurasi minimal:

- Identitas resep, output item stok (mis. teh dasar), nomor versi dan tanggal efektif, lokasi/cakupan yang diizinkan.
- Jumlah output standar batch dan satuan (mis. L), komponen input (item, jumlah, satuan), petunjuk proses, dan aturan scaling jika berlaku.
- Parameter yang benar-benar diperlukan, batas nilai dan satuan; output standar diisi berdasarkan resep/hasil yang diuji, bukan hasil konversi fiktif semua bahan.

Untuk bahan yang dinyatakan proporsional, perencanaan produksi memakai:

```text
faktor skala = target output / output standar
kebutuhan standar bahan = jumlah bahan dalam resep × faktor skala
```

Scaling proporsional adalah asumsi perencanaan yang perlu dikonfirmasi untuk resep aktual, bukan jaminan yield/hasil aktual. Admin produksi mencatat bahan aktual yang dipakai dan output aktual yang diterima; ketika batch difinalkan, mutasi stok memakai aktual yang disetujui, bukan menganggap target selalu tercapai. Catat hasil/selisih/waste dengan referensi batch dan satuan; jangan merekayasa keseimbangan kg menjadi liter.

## 3. Resep penyajian stand

- Basis resep: **satu cup menu/varian**, ukuran sebagai atribut opsional jika bisnis memilikinya.
- Baris komponen dapat berupa teh dasar (ml), powder terkait (g), susu (g atau ml sesuai pencatatan nyata), kemasan (pcs), serta es/air/bahan lain yang benar-benar relevan. Jenis dan takaran belum ditentukan.
- Saat `n` cup terjual, kebutuhan teoritis setiap bahan = takaran standar per cup × `n`. Kasir cukup pilih menu dan jumlah; tidak mengedit resep/rumus di POS.
- Menu dan stok terpisah: tidak membuat stok minuman jadi per varian bila semua diracik saat dipesan. Jangan mengurangi bahan mentah yang sudah dipakai produksi DC lagi pada resep penyajian.
- Pengurangan bahan berdasarkan resep adalah pemakaian **teoritis**. Rekonsiliasi dengan fisik tetap memerlukan waste, opname, dan koreksi terotorisasi; bukan jaminan tidak ada manipulasi takaran.

## 4. Satuan dan formula yang aman

- Simpan satuan dasar setiap bahan dan konversi eksplisit seperti kg↔g, L↔ml, kemasan↔pcs/gram apabila ukuran kemasan diketahui. Gunakan presisi desimal yang ditetapkan dan aturan pembulatan yang konsisten, bukan angka uang/kuantitas floating point tanpa kontrol.
- **Gram powder/susu tidak boleh langsung dikurangkan dari ml teh.** Konversi massa–volume memerlukan data densitas yang relevan; volume akhir minuman/teh tidak otomatis sama dengan jumlah input karena pelarutan, penyaringan, penyusutan dan es. Untuk MVP lebih aman memasukkan takaran teh tiap varian secara eksplisit.
- Bila editor formula diperlukan, izinkan hanya variabel bertipe/satuan diketahui, konstanta, operasi aritmetika dan kurung yang ditentukan; tidak ada JavaScript/PHP/SQL bebas, `eval`, akses file, jaringan, atau fungsi arbitrer. Gunakan parser/AST tervalidasi dengan batas panjang/kedalaman/perhitungan dan pemeriksaan referensi siklik.
- Validasi: bahan/output valid, satuan kompatibel, nilai wajar/non-negatif, output dan penyebut tidak nol, variabel lengkap, referensi tidak berulang/siklik, serta hasil tidak di luar batas. Beri preview untuk satu cup/satu batch dan jumlah lain sebelum publikasi. Pembulatan hanya dilakukan sesuai kebijakan yang disetujui agar total tidak melenceng diam-diam.
- Formula/hasil dari frontend tidak langsung dipercaya: backend tetap memvalidasi definisi versi dan pemakaian. Fitur offline hanya memakai resep/parameter yang sudah disahkan dan tersedia di perangkat; jangan mengunduh atau mengeksekusi skrip baru untuk formula.

## 5. Versi, otorisasi dan offline

- Usulan alur: draft → preview/uji → approval → aktif pada tanggal efektif. Versi yang sudah dipakai transaksi tidak ditimpa; perubahan membuat versi baru. Peran pembuat/pemberi approval dan cakupan DC perlu disepakati; kasir tidak boleh mengubah takaran untuk menghapus selisih.
- Resep tidak lengkap dapat disimpan draft. Penjualan/produksi yang memerlukan pemakaian stok akurat hanya memakai versi resep valid/aktif; proses bisnis manual sementara atau item yang belum punya resep tidak boleh diam-diam memakai takaran nol.
- Transaksi/batch menyimpan versi dan snapshot parameter/pemakaian yang relevan. IndexedDB menyimpan resep penyajian yang disahkan untuk transaksi offline. Saat sync, server memvalidasi versi asli dan tidak menghitung kembali transaksi lama dengan resep terbaru; aturan menerima versi offline yang sudah usang tetap perlu keputusan.
- Perubahan resep, output standar, satuan/konversi dan waktu berlaku diaudit. Perubahan tidak mengubah pemakaian historis, laporan stok atau batch produksi lama secara diam-diam; koreksi memakai dokumen penyesuaian/reversal yang ditelusuri.

## 6. Uji minimum sebelum produksi

- Original tanpa powder vs dua varian dengan takaran berbeda; beberapa varian menggunakan teh dasar/cup kemasan yang sama.
- Scaling produksi, hasil aktual di bawah target, pemakaian dan yield aktual; tidak ada pengurangan bahan dua kali.
- Konversi ml/L dan g/kg/kemasan; satuan tidak kompatibel, output nol dan hasil negatif harus gagal dengan pesan jelas.
- Perubahan resep saat perangkat offline; retry sync tidak menggandakan konsumsi stok dan resep historis tidak berubah.
- Penolakan perubahan dari kasir/tanpa cakupan izin; preview/approval; jika ekspresi diaktifkan, uji pembagian nol, siklus, input berbahaya dan batas kompleksitas.

## 7. Data dan keputusan yang masih diperlukan

- Daftar bahan/menu/satuan, takaran nyata dan hasil output standar beserta aktual, masa simpan/SOP penanganan teh, aturan waste.
- Kewenangan konfigurasi/approval, cakupan resep seragam atau per DC, tanggal efektif dan toleransi versi lama offline.
- Apakah operasi proporsional sederhana cukup atau ada formula nyata yang perlu ekspresi; pilih implementasi paling sederhana dahulu.
- Model FIFO harga paket per cup, yang tidak otomatis dapat diturunkan dari resep atau batch teh dasar yang dipakai lintas varian.
