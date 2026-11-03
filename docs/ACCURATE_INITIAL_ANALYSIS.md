# Accurate Online — Hasil Pembacaan Awal Ekspor Teh Coyo

Status: **analisis awal read-only atas 5 file yang diberikan pengguna**. Saat analisis dilakukan tidak ada impor/posting/pembersihan. **Pembaruan terpisah yang kemudian diizinkan:** 4 master supplier kode/nama dari `daftar-pemasok.xlsx` dimasukkan create-only sesudah backup/dry-run; tidak kontak, saldo atau transaksi (lihat `docs/PURCHASING_BASELINE.md`). File sumber tetap read-only/hash sama. Temuan ini bukan audit kecurangan atau pengesahan saldo; izin supplier tidak mengizinkan import domain lain.

## 1. Sumber dan metode

Sumber asli berada di `.local/accurate-exports/` (ignored Git). Workbook dibaca sebagai ZIP/XML XLSX dengan Python standard library, tanpa dependency aplikasi baru, tanpa Excel/macro/formula evaluation. Semua sheet/baris populated diperiksa, tidak mengandalkan metadata `dimension` yang pada file ini hanya mencantumkan `A1` walaupun data lebih luas. Tidak ada formula sel pada kelima file; angka penyesuaian menggunakan nilai XML asli, bukan sekadar pembulatan tampilan.

SHA-256 file sebelum dan setelah pembacaan sama. Hasil ekstraksi mentah, metadata tipe/satuan sel, dan ringkasan lokal ada di `.local/accurate-analysis/`; tidak dimasukkan ke source/database. Kontak, alamat pribadi dan identitas pajak tidak disalin ke dokumen ini. Skrip inspeksi lokal di `.local/inspect_accurate.py` hanya membaca ekspor.

| File                                               | Sheet                  | Data yang benar-benar terbaca                                    |
| -------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `daftar-barang.xlsx`                               | Barang & Jasa          | 55 baris data, **53 kode/master barang unik**, 81 kolom template |
| `daftar-pelanggan.xlsx`                            | Daftar Pelanggan       | **183 ID pelanggan unik**, 79 kolom template                     |
| `daftar-pemasok.xlsx`                              | Daftar Pemasok         | **4 ID pemasok unik**, 61 kolom template                         |
| `penyesuaian_persediaan_tehcoyo_261006213533.xlsx` | Penyesuaian Persediaan | **1 dokumen, 2 baris barang**; format cetak dengan merged cells  |
| `penyesuaian_persediaan_tehcoyo_261006213555.xlsx` | Penyesuaian Persediaan | **1 dokumen, 28 baris barang**; format cetak dengan merged cells |

Jumlah kolom besar bukan bukti fitur itu dipakai: banyak field template kosong. Belum ada ekspor faktur/penerimaan pembelian, penjualan atau pembayaran dalam paket yang diterima. Dua file adjustment bukan seluruh histori persediaan.

## 2. Konteks dari pengguna

Pengguna mengonfirmasi sesudah membuka Accurate bahwa pusat ramai/tidak tertib: terutama master supplier dan stand (sendiri/mitra), pembelian/penjualan tidak lengkap, dan penambahan/pengurangan stok sering manual tidak berdasarkan hasil belanja. **Keterangan ini berasal dari pengguna**, bukan kesimpulan kelengkapan semua database Accurate berdasarkan lima file.

**Klarifikasi terbaru pengguna (mengoreksi pemahaman sebelumnya):** DC **sudah ada sebagai fungsi operasional**, meracik teh lalu memasok stand, tetapi masih berlokasi di **satu titik bersama pusat**. Data operasional dan keuangan DC masih manual di kertas. Yang akan dikembangkan adalah beberapa DC terpisah dengan kelompok stand masing-masing. Jadi ketidaklengkapan ekspor Accurate bukan bukti tidak adanya proses produksi/distribusi atau pembukuan DC. Semua stand tetap memakai prefix MITRA, baik sendiri maupun pihak lain. Nama CABANG CIREBON tidak otomatis membuktikan DC terpisah aktif.

Rekomendasi pemodelan: pusat dan DC yang berlokasi bersama dapat dipisah secara **unit/logika pencatatan** (bukan entitas hukum baru) bila batas stok/kas dan tanggung jawab disepakati. Jangan membuat DC fiktif atau menyalin saldo penuh gudang pusat menjadi saldo DC kedua. **Arah terbaru pengguna:** DC existing dianggap "bayangan"/menyatu dengan pusat, data kurang lebih seperti Accurate; pengembangan tidak perlu menunggu paper. Catatan kertas adalah sumber tambahan **opsional**, bukan prasyarat rancangan alur standar. Ini tidak menjadikan saldo/histori ekspor terverifikasi dan tidak mengizinkan pembuatan transaksi lama tanpa bukti.

File membuktikan adanya master barang/pelanggan/pemasok dan contoh penyesuaian, tetapi belum memungkinkan rekonstruksi alur kas/barang lengkap atau penilaian apakah satu penyesuaian tertentu sah/tidak sah. Sistem Accurate sendiri tidak dinilai tidak mampu; proses pemakaiannya perlu ditertibkan.

## 3. Daftar barang

### 3.1 Master dan saldo per gudang tidak boleh dicampur

- Terdapat **53 kode barang**, bukan 55 master.
- Kode `100048` (apron) muncul pada dua baris untuk **GUDANG REJECT** dan **GUDANG UTAMA**; kode `100015` (sirup melon) demikian juga. Baris lanjutan tidak mengulang seluruh konfigurasi master.
- Importer kelak perlu memisahkan **master unik per kode sumber** dan **baris saldo/gudang**, bukan membuat item kedua atau membuang baris gudang sebagai duplikat.
- 33 baris mempunyai GUDANG UTAMA, 2 baris GUDANG REJECT, 20 baris gudang kosong dengan kuantitas nol. Tidak ada kuantitas positif bergudang kosong pada file ini. Ini jumlah **baris file**, bukan jumlah gudang/lokasi operasional atau pernyataan stok lengkap.
- Field `Per Tanggal` seluruhnya berisi `06/10/2026` (teks tanggal sumber). Field kuantitas bernama **Kuantitas Saldo Awal**; belum dikonfirmasi apakah ekspor merepresentasikan saldo buku terkini yang dikemas sebagai format saldo awal atau saldo pembukaan lain. Tidak menyebutnya hasil opname fisik atau saldo cutover final.

### 3.2 Jenis, kategori dan status

- Semua 53 master bertipe sumber **INV**.
- Kategori: **22 Umum, 23 Serbuk, 8 Squash**. Untuk 35 item yang bertanda tidak nonaktif: **14 Umum, 13 Serbuk, 8 Squash**.
- Field `Non Aktif`: **35 TIDAK, 18 YA**. Seluruh 18 item nonaktif mempunyai prefix literal `[NULL]` pada nama. `[NULL]` adalah teks pada nama, bukan nilai XML kosong/null; jangan otomatis dibuang/diubah.
- **Dua barang nonaktif masih mempunyai saldo tercatat nonzero**: kode `100033` dan `100035` (varian kecil), masing-masing 1.052 dan 1.000 PCS. Perlu review fisik/status, bukan langsung dihapus atau dianggap rusak.
- Barang tidak hanya bahan minuman: terdapat cup, plastik, sedotan, lid, apron, kaos, banner, logo dan topi. Item bernama **MENU BARU 2 PCS** belum boleh otomatis dibuat menjadi menu POS; dari daftar/rasionya perlu konfirmasi apakah materi cetak/display.
- Ada 8 sirup kategori Squash selain serbuk. Resep penyajian perlu tetap generik untuk powder/sirup/bahan lain, bukan menganggap seluruh rasa memakai powder.
- Field pemakaian tanggal kedaluwarsa kosong untuk semua master; file ini tidak memberikan SOP masa simpan.

### 3.3 Satuan adalah temuan paling menentukan

**Seluruh master memakai satuan dasar PCS**, termasuk TEH, serbuk dan sirup. Belum ada gram/ml/kapasitas isi yang menjelaskan satu PCS bahan. Kemungkinan PCS berarti sachet/kemasan/botol/roll untuk item tertentu, tetapi itu **belum dikonfirmasi**.

Pengguna kemudian memperkirakan PCS TEH adalah satu kemasan teh tubruk dan PCS serbuk satu kemasan hasil packing. Ini **dugaan, bukan konfirmasi ukuran isi**. Jangan menetapkan berat per kemasan, volume hasil seduhan atau satu sachet = satu cup dari keterangan ini. Stok kemasan dapat dianalisis dalam PCS sambil menunggu konversi; pemakaian resep gram/ml terhadap stok PCS memerlukan ukuran isi yang disetujui.

Enam barang memiliki satuan kedua **PAX** beserta rasio:

| Item sumber           | PCS → satuan kedua PAX: rasio tercatat |
| --------------------- | -------------------------------------: |
| Banner                |                                      2 |
| Menu baru 2 pcs       |                                      2 |
| Plastik besar         |                                     46 |
| Plastik kecil         |                                     88 |
| Sedotan               |                                    250 |
| Yakult PAX (nonaktif) |                                      5 |

Rasio perlu dijelaskan arah dan arti fisiknya oleh admin; jangan mengubahnya berdasarkan perkiraan. Satuan beli 52 master **PCS**, satu master **PAX** (plastik kecil). Harga satuan kedua kosong; beberapa harga pada field satuan pertama dapat memerlukan konfirmasi apakah admin sebenarnya memakainya untuk satu kemasan. Ini risiko **mapping**, bukan bukti angka harga pasti salah.

Implikasi untuk aplikasi baru:

1. Pertahankan kode sumber dan unit sumber sebagai referensi.
2. Tentukan **satuan isi/recipe** dan **satuan pembelian/distribusi** per item.
3. Baru setelah jumlah isi diketahui, buat konversi kemasan spesifik item (misal sachet → gram atau botol → ml). Angka isi contoh tidak diberikan di sini.
4. **Jangan mengganti label PCS ke g/ml sambil mempertahankan angka kuantitas lama.** Mengganti 100 PCS menjadi 100 g tanpa konversi mengubah makna stok.
5. Gram ke ml tetap tidak dikonversi bebas; konversi kemasan dengan isi terukur berbeda dari asumsi massa↔volume cairan/bubuk.

### 3.4 Harga dan nilai persediaan

Ekspor memuat harga beli, default harga jual dan nilai satuan saldo, yang tidak selalu sama. Nilai satuan mempunyai presisi desimal hingga 6 tempat; terdapat nilai mendekati bilangan bulat seperti `39999.999999`. Simpan/rekonsiliasi memakai decimal, bukan dibulatkan diam-diam pada migrasi.

Harga jual barang pusat **bukan otomatis harga jual cup pelanggan atau tarif paket mitra**. Nilai satuan saldo bukan bukti pembayaran supplier atau metode HPP yang telah disepakati. Field pajak barang kosong juga tidak otomatis berarti kewajiban pajak tidak ada.

## 4. Pelanggan dan struktur stand/DC

- **183 baris, 183 ID unik**, nama juga tidak duplikat setelah trim/casefold pada paket ini.
- 142 nama berawalan `MITRA`, 38 berawalan `[NULL] MITRA`, dan 3 pihak lain: **1 bernama CABANG CIREBON, 1 pihak OWNER, 1 Pelanggan Umum**. Total 180 nama memakai label MITRA bila marker nama disisihkan. **Ini hitungan label teks, bukan pengesahan 180 stand mitra/stand aktif. Pengguna mengklarifikasi label ini juga dipakai untuk stand milik sendiri.**
- Semua kategori **Umum**, mata uang **IDR**, syarat pembayaran **C.O.D**, kategori harga/diskon **Umum**. Tidak ada kolom khusus kepemilikan stand atau relasi DC pembina, dan tidak ada kolom `Non Aktif` pada sheet ini.
- Field `Dipakai di Cabang` terisi **Kantor Pusat** pada 182 baris, kosong pada 1. Ini belum berarti semua stand berada di pusat atau berada di DC yang sama; relasi organisasi baru belum tersedia dari field ini.
- Tidak menyimpulkan `[NULL]` pelanggan pasti nonaktif hanya dari nama, walaupun marker pada master barang berhubungan dengan status nonaktif. Minta status actual tersendiri.
- Field konsinyasi dan gudang default kosong. Termin COD dalam Accurate tidak otomatis menggantikan kesepakatan tempo malam/barang-terjual pada operasional baru.
- Kontak HP ada pada 167 baris; alamat hanya sebagian kecil. Nilainya tetap pada hasil ekstraksi lokal, tidak dipublikasikan dalam ringkasan.
- **Satu baris memiliki saldo awal beserta referensi faktur/tanggal** (tanggal sumber `30/06/2026`). Tidak cukup untuk menyimpulkan saldo piutang terkini/lunas/tidak lunas tanpa histori atau laporan outstanding.

Mapping yang diperlukan sebelum import organisasi:

```text
ID Pelanggan sumber
  → klasifikasi: DC / stand sendiri / stand mitra / pihak lain
  → status aktual
  → DC pembina (untuk stand)
  → pemilik usaha yang sah (untuk mitra)
  → lokasi aplikasi / counterparty, bukan user login otomatis
```

Prefix MITRA tidak dapat menjadi saran kepemilikan karena pengguna mengonfirmasi labelnya dipakai untuk kedua jenis stand. Label boleh membantu menemukan kandidat lokasi untuk ditinjau, tetapi field **kepemilikan harus belum terklasifikasi dalam staging sampai dikonfirmasi**, bukan default mitra maupun sendiri. Status aktif, pemilik legal, DC target/assignment dan akun login tidak dibuat dari nama. Pemilik yang mempunyai lebih dari satu stand perlu dipisahkan dari identitas tiap lokasi. Pihak OWNER/Pelanggan Umum tidak otomatis menjadi stand.

## 5. Pemasok

- **4 pemasok unik**: pemasok cup, serbuk, sirup dan teh, dengan ID sumber `V.*`.
- Semua kategori Umum, mata uang IDR dan termin COD. Informasi kontak/alamat dan saldo awal tidak terisi dalam file ini; kosong bukan bukti tidak ada utang.
- 22 master barang mempunyai `Pemasok Utama`, dan semua nama referensinya cocok dengan salah satu empat pemasok: 12 serbuk, 8 sirup, 1 cup, 1 teh. Tidak semua barang sudah terhubung pemasok.
- Cukup untuk calon master supplier minimal dengan mapping kode asli. Belum cukup untuk membentuk histori pembelian atau saldo utang; supplier lokal es/air mungkin memang belum dicatat.

**Impor terbatas berikutnya atas permintaan pengguna:** 4 pasangan ID Pemasok→code dan Nama→name sudah dimasukkan, kode `V.000xx` tidak diubah. Supplier DB sebelumnya kosong, dry-run tanpa konflik; create-only atomic + audit source hash/row/code, backup dan fingerprint master/akun/resep/stok/pembelian. Rerun menambah nol, live API 4 supplier. COD/IDR sumber bukan aturan pembayaran otomatis; kontak/pajak/saldo/transaksi tidak diimpor. Catatan private/source mapping tetap ignored, bukan importer umum.

## 6. Dua dokumen penyesuaian persediaan

File merupakan **layout cetak**, bukan daftar seluruh mutasi. Nomor dokumen, tanggal Excel serial, jenis perubahan, jumlah dan total biaya per item dapat dibaca. Tanggal serial diinterpretasikan memakai date system workbook 1900 (bukan waktu export dalam nama file).

| Dokumen            | Tanggal dokumen       | Isi                                                                                 |
| ------------------ | --------------------- | ----------------------------------------------------------------------------------- |
| `IA.2026.10.00001` | **5 Oktober 2026**    | 2 penambahan: serbuk greentea 1.000 dan teh 3.900 (satuan per baris tidak tercetak) |
| `IA.2026.09.00017` | **30 September 2026** | 28 item: **14 penambahan + 14 pengurangan**                                         |

- Nomor/kode serta nama seluruh 30 baris item cocok dengan master barang sumber; jumlah perubahan positif, tanda masuk/keluar ditentukan tipe Penambahan/Pengurangan, bukan angka kuantitas negatif.
- Label kolom `Satuan` ada tetapi **nilainya kosong pada semua baris**. Master PCS membantu dugaan, tetapi belum mengesahkan satuan transaksi pada dokumen cetak itu.
- Tidak terlihat nilai alasan/keterangan yang diisi, lokasi gudang per baris, bukti supplier atau aktor/approval pada kedua export cetak. Ini keterbatasan file, bukan bukti field/detail lain pasti tidak ada di Accurate.
- `Total Biaya` dokumen Oktober secara aritmetika berjumlah **Rp65.850.000**, dengan 2 penambahan. Dokumen September memuat total Penambahan **Rp461.700**, Pengurangan **Rp2.285.061,663217**, selisih bertanda **−Rp1.823.361,663217**. Angka berasal dari nilai sel asli; tampilan format cetak membulatkan hingga 2 desimal.
- Total biaya adjustment **bukan omzet, total belanja cash, pembayaran supplier, atau bukti kerugian/kecurangan**. Jangan memasukkannya ke transaksi pembelian/penjualan tanpa dokumen sumber dan review.
- Jangan menambahkan angka adjustment ke field saldo awal barang saat migrasi secara otomatis: tanggal/master basis berbeda dan bisa terhitung dua kali.

## 7. Dampak pada model yang sudah dibangun

**Tidak ada perubahan aplikasi dalam analisis ini.** Rekomendasi berikut perlu scope/keputusan sebelum implementasi:

| Temuan nyata                                              | Kebutuhan desain/mapping                                                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PCS/PAX bahan, resep membutuhkan g/ml                     | Konversi kemasan **per item**, pemisahan satuan beli/kirim/pakai, presisi dan harga per unit yang jelas                                   |
| Barang yang sama pada gudang utama/reject                 | Gudang/sub-lokasi atau kondisi stok terkait lokasi operasional; jangan mengubah gudang reject menjadi DC/stand fiktif atau stok siap jual |
| Barang nonaktif bersaldo                                  | Status item dan arsip/mapping historis, review saldo fisik sebelum cleanup; jangan hard delete                                            |
| Pelanggan bukan klasifikasi legal stand/DC                | Tabel mapping sumber → lokasi/pemilik/counterparty yang ditinjau owner/admin                                                              |
| Kategori dan barang sirup/kemasan/perlengkapan            | Master kategori/item type generik serta resep bisa memakai sirup; biaya/aset ditetapkan sesuai penggunaan nyata, tidak otomatis dari nama |
| Penyesuaian manual tanpa sumber belanja pada praktik lama | Penerimaan pembelian, produksi, distribusi dan penjualan sebagai sumber mutasi; adjustment tetap ada dengan alasan/approval/audit         |
| Data transaksi tidak lengkap                              | Master terverifikasi + saldo awal yang disepakati saat cutover; arsip histori parsial terpisah dari posting operasional baru              |

Pada waktu analisis awal model baru fondasi. **Pembaruan implementasi:** quantity ledger, supplier dan nota/terima/catatan bayar sudah dibuat (lihat `docs/INVENTORY_BASELINE.md` dan `docs/PURCHASING_BASELINE.md`), tetapi warehouse status/conversion packaging/tarif produksi/GL tetap belum. Tidak ada import atau penggunaan saldo/harga ekspor otomatis. Menemukan field ekspor tidak berarti semuanya harus langsung ditambahkan; prioritaskan **arti stok dan hubungan pihak**.

## 8. Batas kesimpulan dan langkah berikutnya

Yang **sudah bisa dipelajari**: struktur master, kode/relasi, kategori/satuan, baris saldo per gudang, nama counterparties dan contoh adjustment. Yang **belum bisa dipastikan**: saldo fisik, keuangan/laba lama, kelengkapan histori, DC pembina tiap stand, siapa mitra legal, isi satu kemasan, resep nyata dan tagihan per cup.

Langkah realistis sebelum import:

1. Konfirmasi **arti satu PCS TEH/serbuk/sirup/lid**, ukuran isi dan arti rasio PAX/harga yang dipakai.
2. Cocokkan daftar pelanggan dengan stand yang benar-benar aktif dan kepemilikannya; prefix MITRA digunakan untuk kedua jenis. Pisahkan **DC existing yang berlokasi bersama pusat** dari rencana DC wilayah. Catatan paper boleh melengkapi jika tersedia, tetapi bukan syarat development. Jangan membuat parent DC palsu atau mengarang histori; jika penugasan berubah kelak, pertahankan relasi saat kejadian.
3. Konfirmasi fungsi GUDANG UTAMA/REJECT dan basis field Kuantitas Saldo Awal per 06/10/2026; lakukan opname/saldo terverifikasi saat tanggal cutover kelak.
4. **Tidak wajib menunggu satu hari lengkap catatan paper.** Rancang pencatatan stok, penerimaan/transfer dan kas ke depan dengan aturan standar yang diusulkan; gunakan dummy untuk pengujian. Contoh paper/detail adjustment boleh menyusul sebagai referensi, bukan syarat merekonstruksi seluruh histori. Saldo awal, konversi yang digunakan dan aturan tagihan nyata tetap diverifikasi sebelum pilot terkait.
5. Buat mapping/staging dan laporan validasi/dry-run, lalu minta persetujuan sebelum import. Data nyata tidak dicampur ke dummy untuk go-live; gunakan lingkungan bersih/terpisah atau cleanup terotorisasi berdasarkan relasi.

**Kesimpulan:** ekspor berhasil dibaca dan cukup menjadi dasar analisis master. Penggantian aplikasi lebih aman diposisikan sebagai pembenahan pencatatan ke depan dengan titik awal yang diverifikasi, bukan janji merekonstruksi seluruh masa lalu dari dua adjustment dan master yang tersedia.
