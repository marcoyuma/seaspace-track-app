# Seaspace — konteks untuk codebase admin panel

> Dokumen ini ditulis **untuk repo lain**: aplikasi admin panel yang mengelola data villa.
> Pembacanya (developer maupun AI agent) tidak punya akses ke repo situs customer, jadi
> semua yang perlu diketahui ada di sini — tidak ada rujukan ke file yang tidak bisa Anda buka.
>
> Terakhir diverifikasi terhadap database live dan codebase: **2026-08-16**.
>
> **Sejak versi 2026-08-12 dokumen ini, situs customer sudah bertambah jauh:** sistem
> auth penuh (email/password + OAuth GitHub/Google), halaman akun (profil, avatar,
> hapus akun), dan **seluruh alur booking** — kalender ketersediaan, checkout, simulasi
> pembayaran, self check-in lewat QR/kode akses, dan cron job yang menjalankan siklus
> hidup booking setiap jam. Tidak satu pun dari ini menambah wewenang admin panel —
> `stays`/`stay_images`/`amenities`/`stay_amenities` tetap satu-satunya yang boleh
> ditulis admin panel — tapi skema `public.bookings`, `public.guests`, dan
> `public.reviews` sudah jauh lebih detail dari yang pertama kali didokumentasikan.
> Baca [Batas wewenang admin panel](#batas-wewenang-admin-panel) sebelum menulis apa
> pun, karena bekerja dari kontrak yang usang berarti menulis ke skema yang salah.
>
> **`bookings` mengubah apa yang boleh Anda hapus.** Villa yang pernah dipesan tidak
> bisa lagi di-DELETE — lihat
> [Villa yang punya booking tidak bisa dihapus](#villa-yang-punya-booking-tidak-bisa-dihapus).
>
> **Sejak 2026-08-15, admin panel punya akses BACA (bukan tulis) ke sebagian data
> `public.guests`.** Tiga fungsi `security definer` baru — `admin_booking_roster()`,
> `admin_guest_nationality_stats()`, `admin_export_guests()` — plus tabel `public.staff`
> memberi sesi staf yang sah jalur baca terbatas, tanpa membuka `guests` itu sendiri.
> Ini pengecualian pertama pada batas di
> [Batas wewenang admin panel](#batas-wewenang-admin-panel); larangan **menulis** ke
> `guests`/`reviews`/`bookings` sama sekali tidak berubah. Detail lengkap ada di
> [Akses baca staf ke data guest](#akses-baca-staf-ke-data-guest).
>
> **Sejak 2026-08-16, jalur tulis admin panel sudah diputuskan — dan berubah dari yang
> tertulis di versi sebelumnya.** Admin panel **tidak lagi memerlukan service role key
> sama sekali**. Menulis katalog sekarang lewat anon/publishable key + sesi login staff,
> dengan policy RLS baru di `0015_staff_catalog_writes.sql`. Kalau Anda membaca dokumen
> ini untuk membangun jalur tulis, baca
> [Keputusan: jalur tulis admin panel](#keputusan-jalur-tulis-admin-panel) lebih dulu.
> Penyebutan "service role" yang tersisa di dokumen ini semuanya menjelaskan **sejarahnya**,
> bukan arsitektur yang berlaku sekarang.
>
> **Fitur "tambah villa baru" punya bagiannya sendiri:**
> [Menambahkan villa baru — alur lengkap](#menambahkan-villa-baru--alur-lengkap). Baca itu
> utuh sebelum menulis form create, karena separuh aturannya adalah konvensi isi yang
> **tidak** dijaga constraint database — jadi tidak akan muncul sebagai error, cuma sebagai
> halaman yang salah.

## Daftar Isi

- [Peta sistem](#peta-sistem)
- [Batas wewenang admin panel](#batas-wewenang-admin-panel)
- [Villa yang punya booking tidak bisa dihapus](#villa-yang-punya-booking-tidak-bisa-dihapus)
- [Akses baca staf ke data guest](#akses-baca-staf-ke-data-guest)
- [Keputusan: jalur tulis admin panel](#keputusan-jalur-tulis-admin-panel)
- [Kenapa perubahan Anda tidak langsung terlihat customer](#kenapa-perubahan-anda-tidak-langsung-terlihat-customer)
- [Villa baru belum bisa dibuka sampai situs di-deploy ulang](#villa-baru-belum-bisa-dibuka-sampai-situs-di-deploy-ulang)
- [Kontrak data — skema tabel](#kontrak-data--skema-tabel)
- [Menambahkan villa baru — alur lengkap](#menambahkan-villa-baru--alur-lengkap)
- [Lampiran: tabel di luar wewenang, untuk konteks debugging](#lampiran-tabel-di-luar-wewenang-untuk-konteks-debugging)
- [⚠️ Kontrak upload gambar](#-kontrak-upload-gambar)
- [Kontrak revalidasi](#kontrak-revalidasi)
- [Yang tidak bisa dilakukan admin panel](#yang-tidak-bisa-dilakukan-admin-panel)
- [Cara menguji dari sisi Anda](#cara-menguji-dari-sisi-anda)
- [Template `CLAUDE.md` untuk repo admin panel](#template-claudemd-untuk-repo-admin-panel)

---

## Peta sistem

Dua aplikasi, satu database. Keduanya **tidak saling import apa pun** — Supabase adalah
satu-satunya titik temu.

```
┌──────────────────────┐         ┌──────────────────────┐
│  Situs customer      │         │  Admin panel         │
│  Next.js 16, Vercel  │         │  (repo Anda)         │
│  READ-ONLY           │         │  READ-WRITE          │
│  anon key, tanpa sesi│         │  anon key + sesi staf│
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │   ┌────────────────────────┐   │
           └──▶│  Supabase              │◀──┘
               │  Postgres + Storage    │
               └────────────────────────┘
```

**Kedua aplikasi memakai key yang sama** — anon/publishable key, yang memang dirancang untuk
dikirim ke browser. Yang membedakan bukan key-nya, tapi **sesinya**: pengunjung situs customer
tidak login sebagai staf, jadi RLS cuma membukakan `SELECT`. Admin panel login sebagai user
Supabase yang punya baris di `public.staff`, dan policy di
[`0015_staff_catalog_writes.sql`](#keputusan-jalur-tulis-admin-panel) membukakan tulis untuk
sesi itu saja.

> **Admin panel tidak membutuhkan service role key.** Kalau repo Anda masih memegangnya,
> ia bisa dicabut — dan sebaiknya dicabut, karena key itu setara akses penuh ke database
> dan tidak punya tempat aman di aplikasi tanpa server sendiri. Versi lama dokumen ini
> mensyaratkannya; itu sudah tidak berlaku.

---

## Batas wewenang admin panel

Ditetapkan pemilik proyek, dan ini **keputusan produk**, bukan sekadar keadaan sementara:

> **Admin panel tidak membuat akun. Tidak membuat guest. Tidak membuat booking.**
> Akun sepenuhnya tanggung jawab user yang ingin memesan.
>
> Admin panel akan disesuaikan dengan aplikasi customer belakangan, dan penyesuaian itu didahului
> riset tersendiri. Sampai riset itu selesai, jangan mengasumsikan wewenang apa pun di luar
> katalog villa.

### Wewenang admin panel

| Boleh ditulis                                         | Tidak boleh disentuh                          |
| ----------------------------------------------------- | --------------------------------------------- |
| `stays`, `stay_images`, `amenities`, `stay_amenities` | `auth.users`                                  |
| bucket `stays`                                        | `public.guests`, bucket `guests`              |
|                                                       | `public.reviews`                              |
|                                                       | `public.bookings`                             |
|                                                       | `public.staff` (dibuat manual pemilik proyek) |

Di dalam kolom kiri itu izinnya rata: punya baris di `public.staff` = boleh semua aksi di
bawah ini. Tidak ada tingkatan di dalam `public.staff` — pembagian dua tingkat yang dulu ada
(`staff` vs `manager`) sudah dihapus lewat `0018_drop_manager_role.sql`.

| Aksi                                                                | Sesi staf |
| ------------------------------------------------------------------- | --------- |
| Insert/update `stays`, `stay_images`, `amenities`, `stay_amenities` | ✅        |
| Upload/ganti/hapus file di bucket `stays`                           | ✅        |
| Delete baris `stay_images`, `stay_amenities`                        | ✅        |
| Delete villa (`stays`)                                              | ✅        |
| Delete baris `amenities`                                            | ✅        |

**Menghapus tetap butuh konfirmasi di UI.** Menghapus satu villa bukan aksi seukuran mengedit
villa: `stay_images` dan `stay_amenities` ikut terhapus (`on delete cascade`), dan review-review
villa itu **diputus diam-diam** dari villa manapun (`reviews.stay_id` `on delete set null`).
Baris `amenities` sama — satu baris bisa dipakai bersama semua villa (`is_shared`), jadi
menghapusnya menjangkau ke luar villa yang sedang Anda buka. Semua staf boleh melakukannya,
tapi tidak boleh terjadi tanpa dialog konfirmasi.

**Pemanggil yang tidak berhak dapat 0 baris terhapus, bukan error** — sama seperti pola
fungsi `admin_*`. User yang sudah login tapi tidak punya baris di `public.staff` akan melihat
operasi "berhasil" tanpa ada yang hilang. Tangani di UI (sembunyikan entry point-nya), jangan
andalkan pesan error dari Postgres, karena tidak akan ada.

> **Kolom "Tidak boleh disentuh" di atas soal MENULIS, dan itu masih berlaku 100% untuk
> `public.guests`.** Sejak 2026-08-15 ada satu pengecualian **baca saja**: tiga fungsi
> `security definer` yang bisa dipanggil sesi staf yang sah — lihat
> [Akses baca staf ke data guest](#akses-baca-staf-ke-data-guest). Admin
> panel tetap tidak pernah `SELECT * FROM public.guests` langsung, dan tetap tidak bisa
> menulis satu baris pun ke tabel ini.

### Kenapa, dan apa yang rusak kalau dilanggar

**`public.guests` hanya lahir dari trigger signup.** Primary key-nya **adalah** `auth.users.id` —
satu identitas, bukan dua yang bisa melenceng. Baris `guests` dibuat oleh trigger
`on_auth_guest_confirmed` saat `email_confirmed_at` terisi, dan tidak oleh jalur lain mana pun.

Menyisipkan baris `guests` secara manual dari admin panel **mustahil tanpa membuat akun lebih
dulu**, karena foreign key-nya menolak uuid yang tidak ada di `auth.users`. Kalaupun akunnya ikut
dibuat lewat admin API, hasilnya adalah akun yang tidak pernah dimiliki siapa pun — dan seluruh
alasan desainnya (tamu tidak pernah ada sebelum akunnya) runtuh.

**`public.reviews` ditulis tamu, bukan admin.** Setiap baris menunjuk `guests.id`, dan sebuah
review yang tidak berasal dari tamu sungguhan menghilangkan seluruh maknanya. Moderasi (menyembunyikan
atau menolak review) belum dirancang; kalau nanti dibutuhkan, itu kolom status baru — **bukan**
izin menulis baris.

**`public.bookings` ditulis tamu lewat checkout, bukan admin.** Jalur checkout **sudah dibangun**
dan live (kalender ketersediaan → pilih tanggal/tamu → checkout → simulasi pembayaran → self
check-in via QR/kode akses). Tapi itu tidak mengubah batasnya — sebaliknya, batasnya sekarang
ditegakkan lebih ketat dari sebelumnya:

- Tabel `bookings` **tidak punya policy INSERT/UPDATE/DELETE apa pun**, persis seperti sebelumnya.
- Semua tulisan sekarang lewat **tiga fungsi `security definer`** di sisi situs customer —
  `create_booking()`, `settle_booking_payment()`, `check_in_booking()` — bukan tulis baris
  langsung, bahkan dari kode situs customer sendiri. Statusnya bertransisi lewat fungsi-fungsi
  ini plus satu **cron job per jam** (`advance_booking_lifecycle()`, lihat migrasi
  `0013_booking_lifecycle_cron.sql`) yang menutup stay yang sudah selesai, membatalkan booking
  belum-dibayar setelah 30 menit, dan menandai `no_show`.
- Sejak admin panel tidak lagi memegang service role key, batas ini **ditegakkan database**,
  bukan sekadar disepakati: `0015_staff_catalog_writes.sql` hanya membuka policy tulis di empat
  tabel katalog, jadi sesi staff yang mencoba menulis `bookings` benar-benar ditolak. Dulu key
  itu mem-bypass RLS dan bisa menulis apa saja — larangannya bergantung pada disiplin. Sekarang
  tidak lagi. Kalau admin suatu hari perlu membuat booking manual (mis.
  telepon), itu perlu fungsi `security definer` baru yang disetujui dulu di repo situs customer —
  sama seperti guest, bukan jalan pintas lewat tulis baris langsung.

**Kalau arah ini berubah** — misalnya admin suatu hari boleh mendaftarkan tamu untuk booking
telepon — maka `guests` harus dirombak lebih dulu: primary key sendiri plus `auth_user_id` yang
nullable. Itu perubahan skema, bukan perubahan izin, dan harus dikerjakan di repo situs customer
sebelum admin panel menulis apa pun ke sana.

### Villa yang punya booking tidak bisa dihapus

**Ini akan muncul sebagai error di admin panel, jadi tangani sebagai aturan bisnis, bukan bug.**

`bookings.stay_id` memakai `on delete restrict`. Artinya:

```sql
delete from stays where slug = 'riverside-stone-lodge';
-- ERROR: update or delete on table "stays" violates foreign key constraint
--        "bookings_stay_id_fkey" on table "bookings"
```

Villa yang **belum pernah** dipesan tetap bisa dihapus persis seperti sekarang. Yang diblokir
hanya villa yang punya minimal satu baris booking.

**Kenapa bukan cascade.** Booking adalah catatan keuangan yang umumnya wajib disimpan untuk
keperluan pajak. Cascade akan menghapusnya bersama villanya — persis alasan yang sama yang
membuat `bookings.guest_id` memakai `on delete set null` alih-alih cascade. Dan `set null` juga
ditolak di sini: catatan keuangan yang tidak bisa menjawab "menginap di mana" tidak ada gunanya
sebagai catatan.

**Konsekuensi yang belum terselesaikan, dan ini pekerjaan repo situs customer, bukan Anda.**
`stays` tidak punya kolom yang berarti "tidak lagi bisa dipesan" — hanya `is_new` dan
`is_featured`. Jadi hari ini tidak ada cara melepas villa yang sudah pernah dipesan dari situs
tanpa menghapusnya, dan menghapusnya diblokir. Kalau admin panel membutuhkan itu, mintalah
kolom `is_listed`/`archived_at` ditambahkan di sisi situs customer; jangan mengakalinya dengan
menghapus baris `bookings` lebih dulu, karena itu justru menghancurkan hal yang dilindungi
constraint ini.

---

## Akses baca staf ke data guest

**Dibangun dan live sejak 2026-08-15** (`0014_admin_staff_access.sql` di repo situs customer —
repo admin panel tidak dan tidak perlu punya file migrasi apa pun untuk ini; skemanya dimiliki
sepenuhnya oleh situs customer, admin panel hanya memanggil fungsinya). Lahir dari kebutuhan
nyata: admin panel perlu menampilkan siapa yang booking dan tanggal in/out-nya, yang berarti nama
tamu (dan telepon) memang harus terlihat staff — bukan sekadar statistik.

### Jalur yang sama dengan tulis katalog — satu client saja

Ketiga fungsi ini dipanggil lewat **anon/publishable key + sesi `authenticated`**:
staf login sebagai user Supabase biasa (email/password atau metode lain), dan
`auth.uid()` sesi itu yang dicek fungsinya sendiri terhadap tabel `public.staff`. Bukan RLS di
`guests` (tetap tanpa policy untuk siapa pun selain guest itu sendiri, tidak berubah).

```ts
// Client yang sama yang dipakai menulis katalog. Yang penting sesi staff-nya.
const { data } = await supabaseClient.rpc("admin_booking_roster", {
    p_from: "2026-08-01",
    p_to: "2026-08-31",
});
```

> **Ini berubah sejak 2026-08-16.** Versi sebelumnya dokumen ini bilang fitur ini butuh
> "client kedua" karena tulis katalog diasumsikan lewat service role key dari server.
> Setelah [keputusan jalur tulis](#keputusan-jalur-tulis-admin-panel), keduanya memakai
> jalur yang persis sama — **satu client, satu sesi staff, cukup untuk baca guest maupun
> tulis katalog.**

### `public.staff` — siapa yang boleh memanggil

Tabel identitas terpisah dari `guests`, pola sama (`id` uuid **adalah** `auth.users.id`).
Isinya murni daftar keanggotaan — tidak ada kolom `role`, jadi ada baris di sini artinya
wewenang penuh. **Provisioning manual, bukan self-signup** —
tidak ada trigger otomatis seperti `handle_new_guest()`. Akun staff dibuat oleh pemilik proyek
situs customer langsung lewat dashboard Supabase / SQL Editor. **Admin panel tidak bisa membuat
baris `staff` sendiri** — tidak ada policy INSERT untuk siapa pun. Kalau admin panel butuh staff
baru, itu permintaan ke repo situs customer, bukan sesuatu yang bisa dilakukan sepihak dari sini.

### Empat fungsi

| Fungsi                                         | Siapa boleh panggil                                                                                    | Mengembalikan                                                                                                                           | Yang sengaja TIDAK dikembalikan                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `admin_booking_roster(p_from date, p_to date)` | Sesi staf manapun                                                                                      | `booking_id, stay_name, guest_name, phone_country_code, phone, start_date, end_date, status, num_guests, guest_notes, created_at, paid_at, cancelled_at` untuk booking yang overlap rentang tanggal | `nationality`, `avatar_path`, `access_code`              |
| `admin_booking_access_code(p_booking_id)`      | Sesi staf manapun, setiap panggilan dicatat ke `public.admin_access_code_log` (siapa, booking mana, kapan) | `access_code` satu booking saja                                                                                                      | apa pun selain kode itu sendiri                          |
| `admin_guest_nationality_stats()`              | Sesi staf manapun                                                                                      | `nationality, guest_count` teragregasi, nationality dengan < 5 guest digabung `'Other'`                                                 | nationality per-baris individu                           |
| `admin_export_guests()`                        | Sesi staf manapun, setiap panggilan dicatat ke `public.admin_export_log` (siapa, kapan, berapa baris)  | `guest_id, full_name, phone_country_code, phone, nationality, created_at` untuk seluruh guests                                          | `avatar_path` — tidak pernah keluar lewat fungsi manapun |

**`admin_booking_roster()` di-scope lewat booking, bukan direktori guest terbuka.** Guest yang
belum pernah booking tidak pernah muncul di hasilnya — ini bukan `SELECT * FROM guests` yang
kolomnya difilter, tapi join ke `bookings` yang membatasi _baris_-nya juga.

**Pemanggil yang tidak berhak mendapat 0 baris, bukan error.** User login yang tidak punya baris
di `public.staff` memanggil fungsi manapun di atas akan dapat hasil kosong — tangani itu di UI
sebagai "tidak ada akses", bukan sebagai bug yang perlu di-debug.

**`access_code` sengaja dipisah jadi fungsi sendiri, bukan satu kolom tambahan di roster.**
Bukan karena staf tidak boleh melihatnya — mereka memang butuh (tamu kehilangan kode lalu
menelepon), dan tool PMS di industri juga menampilkannya ke staf. Masalahnya ada di bentuk
pengirimannya: `admin_booking_roster()` mengembalikan rentang tanggal sekaligus — tabel Bookings
menarik satu rentang penuh, kalender dashboard menarik sebulan penuh — jadi satu kolom kode di
sana berarti **seluruh kode dalam rentang ikut terkirim ke browser tiap page load** dan mengendap
di cache React Query, termasuk untuk booking yang tidak pernah dibuka siapa pun. Karena Seaspace
cuma punya satu tingkatan staf, tidak ada peran yang bisa dibatasi — jadi `admin_access_code_log`
adalah satu-satunya kontrol yang tersisa, dan itu membuatnya penting, bukan sekadar formalitas.

**`avatar_path` (foto profil tamu) tidak pernah tersedia untuk admin panel lewat jalur apa pun.**
Tetap PII murni — ini keputusan sadar, bukan sesuatu yang lupa ditambahkan.

**`nationality` per-baris juga tidak pernah tersedia**, untuk siapa pun — hanya versi
teragregasi dengan ambang minimal 5 guest per kelompok. Alasannya: nationality yang dipasangkan
dengan `display_name` dan kutipan review publik (mis. "Amara L." + "Swedish" + kutipannya) bisa
mengidentifikasi satu orang di properti sekecil ini — situs customer sudah menganggap ini serius
cukup untuk ikut menganonimkan `nationality` saat sebuah akun dihapus.

---

## Keputusan: jalur tulis admin panel

**Diputuskan 2026-08-16. Opsi A (RLS staff-role) yang dipakai.** Migrasinya sudah ditulis di
repo situs customer sebagai `0015_staff_catalog_writes.sql` dan dijalankan manual lewat
Supabase SQL Editor, setelah `0014`.

### Apa yang berubah untuk Anda

|                             | Sebelumnya (asumsi dokumen lama) | Sekarang                                            |
| --------------------------- | -------------------------------- | --------------------------------------------------- |
| Key untuk menulis katalog   | service role key                 | anon/publishable key                                |
| Di mana tulisannya berjalan | wajib di server admin panel      | boleh langsung dari browser                         |
| Syarat                      | —                                | sesi login staff yang punya baris di `public.staff` |
| Jumlah Supabase client      | dua (service role + sesi staff)  | **satu**                                            |

Jadi SPA murni tanpa backend — persis bentuk repo admin panel sekarang — sudah cukup. Ini
bukan kompromi: menaruh service role key di aplikasi tanpa server justru satu-satunya opsi
yang benar-benar berbahaya di antara keduanya, karena key itu mem-bypass seluruh RLS dan
tidak punya tempat sembunyi di bundle browser.

### Cara kerjanya

Staff login sebagai user Supabase biasa. Setiap policy tulis di keempat tabel katalog
mencocokkan `auth.uid()` sesi itu ke `public.staff` — tabel yang sama yang sudah dipakai tiga
fungsi [`admin_*`](#akses-baca-staf-ke-data-guest). Tidak ada tabel staff kedua, tidak ada
mekanisme identitas baru.

Predikatnya cuma "ada baris di `public.staff`", tanpa cek tingkatan apa pun — daftar aksi
lengkapnya di [Wewenang admin panel](#wewenang-admin-panel).

Bucket `stays` dibuka di migrasi terpisah, `0021_admin_staff_stays_bucket_writes.sql`
(insert/update/delete untuk sesi staff, tanpa pembatasan folder per-user seperti bucket
`guests` — foto villa milik tim, bukan milik satu pengunggah). Sampai 0021 dijalankan, 0016
hanya membuka tabel: villa berhasil dibuat tapi setiap upload foto ditolak RLS.

### Yang tetap belum beres: project ref admin panel

**Ini prasyarat, dan belum dikerjakan.** JWT admin panel menunjuk `ref: ixlapibfddubweqrmtgh`.
`.env.local` repo situs customer menunjuk ref `aoedxrhwzjracosjcmzo`. **Dua project Supabase
yang berbeda.** Dikonfirmasi ini salah konfigurasi di sisi admin panel (seharusnya menunjuk
project yang sama dengan situs customer), bukan disengaja.

Selama ini belum dibetulkan, admin panel tidak menyentuh database yang benar sama sekali —
jadi seluruh kontrak di dokumen ini, termasuk policy tulis baru di atas, tidak akan terbukti
apa pun saat diuji. **Betulkan ref-nya ke `aoedxrhwzjracosjcmzo` sebelum menguji fitur tulis.**
Perbaikannya ada di repo admin panel, bukan di sini.

**Prinsip yang disepakati ke depan:** nilai koneksi Supabase (URL, anon/publishable key,
project ref) untuk kedua repo **semestinya dirujuk dari satu sumber yang sama**, bukan disalin
manual ke masing-masing `.env`. Drift seperti temuan di atas persis jenis kesalahan yang muncul
kalau nilainya di-copy-paste satu kali lalu dibiarkan menua sendiri-sendiri (mis. saat project
di-rotate atau pindah environment, satu repo ter-update dan repo lain tidak). Mekanisme "satu
sumber rujukan" yang konkret — env template terpusat, secrets manager, atau sekadar checklist
manual saat rotasi — **belum diputuskan**; ini prinsip yang disepakati, bukan solusi teknis
yang sudah dipilih.

### Kronologi, supaya sesi berikutnya tidak membongkar ulang

- Dokumen ini awalnya mengasumsikan admin panel punya server sendiri yang memegang service
  role key (opsi B).
- Ternyata repo admin panel adalah SPA murni (`VITE_SUPABASE_KEY`, tanpa backend), dan key
  yang dipakainya memang anon — payload JWT-nya berisi `"role":"anon"`. Jadi itu **bukan**
  kebocoran secret, tapi memang bertentangan dengan asumsi dokumen.
- Dua opsi dipertimbangkan: **A** RLS staff-role, **B** admin panel menambah server tipis
  untuk memegang service role key.
- **A dipilih**, karena `public.staff` sudah ada dan sudah divalidasi live sejak `0014`, dan
  karena B berarti menambah seluruh backend hanya demi memegang satu key yang justru ingin
  dihindari. Tidak perlu tabel staff kedua.

---

## Kenapa perubahan Anda tidak langsung terlihat customer

**Ini bagian yang paling sering disalahpahami saat testing. Baca sebelum melapor bug.**

Situs customer di-prerender dan hasilnya di-cache. Setelah Anda menyimpan perubahan di admin
panel, **customer masih melihat data lama sampai cache-nya disegarkan.** Itu desain, bukan bug.

Ekspektasi waktu saat ini:

| Kondisi                          | Lag admin → customer |
| -------------------------------- | -------------------- |
| **Sekarang** (hanya time-based)  | maksimal **1 jam**   |
| Setelah webhook dipasang (belum) | hitungan **detik**   |

### Kenapa tidak dibuat selalu segar saja?

Karena situs customer adalah halaman marketing berat gambar yang tujuannya cepat. Mematikan
cache berarti setiap kunjungan halaman memicu query database (±113 ms terukur) untuk data
yang berubah paling sering beberapa kali seminggu. Itu menukar kecepatan yang dirasakan
ribuan pengunjung demi kesegaran yang dibutuhkan satu admin.

### Kenapa tidak on-demand saja (webhook), tanpa timer?

Karena Supabase Database Webhook berjalan di atas `pg_net`, yang bersifat **fire-and-forget**.
Kalau satu webhook gagal terkirim — situs sedang re-deploy, network blip, secret sudah
dirotasi tapi lupa diperbarui — dan timer dimatikan, maka data **basi selamanya tanpa alarm
apa pun**. Tidak ada yang memberi tahu Anda.

### Karena itu: hybrid

- **On-demand (webhook)** = jalur cepat. Perubahan tampil dalam hitungan detik.
- **Time-based 1 jam** = jaring pengaman. Kalau webhook gagal, sistem sembuh sendiri.

Timer bukan redundansi yang bisa dibuang — ia yang mengubah "gagal senyap selamanya" menjadi
"terlambat maksimal 1 jam".

> **Status saat ini: webhook BELUM dibangun.** Satu-satunya mekanisme hari ini adalah timer
> 1 jam. Jangan menunggu invalidasi instan — ia belum ada.

---

## Villa baru belum bisa dibuka sampai situs di-deploy ulang

**Ini masalah yang berbeda dari cache 1 jam di atas, dan lebih parah.** Baca sebelum menguji
fitur tambah villa, supaya tidak membuang waktu men-debug sesuatu yang bukan bug Anda.

Mengedit villa yang sudah ada = telat maksimal 1 jam, lalu muncul. Menambah villa **baru** =
`/stays/{slug}` **belum ada sama sekali** — bukan halaman lama yang tampil, tapi 404 — sampai
situs customer di-build ulang atau ISR-nya berjalan.

**Kenapa.** Situs customer membuat halaman detail villa dari daftar slug yang diambil saat
build (`generateStaticParams()`). Slug yang belum ada waktu build itu berjalan tidak punya
halaman yang dibuatkan untuknya.

### Apa artinya untuk UI admin panel

- **Jangan tampilkan link "Lihat di situs" yang seolah-olah langsung jadi** setelah villa
  disimpan. Kalau tetap mau ada, beri label yang jujur, mis. "Tersedia setelah situs
  di-deploy berikutnya".
- **Jangan buka bug report** untuk 404 di villa yang baru dibuat. Itu perilaku yang sudah
  diketahui.
- Villa baru yang sudah tersimpan **tetap benar di database** — tidak ada yang perlu
  disimpan ulang. Yang kurang cuma halamannya.

### Ini permintaan terbuka ke repo situs customer

Perbaikannya ada di sisi situs customer dan **belum dikerjakan**. Perlu diselidiki dulu mana
yang cukup: mengizinkan slug di luar daftar `generateStaticParams()` dirender saat diminta,
atau menyambungkannya ke jalur revalidasi on-demand yang juga belum dibangun. Dicatat di sini
sebagai permintaan, **bukan** rencana teknis yang sudah disetujui — jangan mengakalinya dari
sisi admin panel.

**Bukan hal yang sama dengan cache tag `stays`.** Ini soal `generateStaticParams()` yang cuma
tahu slug yang ada _saat build_ — bukan soal cache data yang dibahas webhook-nya di [Kontrak
revalidasi](#kontrak-revalidasi). Situs ini juga bukan static export murni (tidak ada
`output: "export"` di `next.config.ts`) — yang dipakai adalah deployment server biasa dengan
`cacheComponents: true`, jadi perbaikannya bukan soal "mengaktifkan server", tapi soal
menyambungkan jalur render/revalidasi untuk slug yang belum ada saat build.

---

## Kontrak data — skema tabel

Empat tabel. Semua nama kolom `snake_case`.

### `stays`

| Kolom             | Tipe              | Catatan                                                                                          |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `id`              | `bigint` identity | PK internal. **Tidak pernah muncul di URL.**                                                     |
| `created_at`      | `timestamptz`     | default `now()`                                                                                  |
| `slug`            | `text` unique     | **Segmen URL publik**: `/stays/{slug}`                                                           |
| `name`            | `text`            |                                                                                                  |
| `location`        | `text`            | mis. `"Canggu, Bali"` — **komanya wajib**, situs memakai bagian sebelum koma untuk teks "by car" |
| `price_per_night` | `integer`         | **Rupiah bulat**, bukan sen. `2800000` = Rp2.800.000                                             |
| `discount`        | `integer`         | Rupiah bulat, default `0`. **Ikut menentukan tagihan tamu** — lihat catatan di bawah             |
| `capacity`        | `smallint`        | jumlah tamu. **Ikut divalidasi saat booking** — lihat catatan di bawah                           |
| `beds`            | `smallint`        |                                                                                                  |
| `area`            | `smallint`        | m²                                                                                               |
| `is_new`          | `boolean`         | menampilkan badge "New" di kartu                                                                 |
| `is_featured`     | `boolean`         | **menentukan 2 kartu di landing page**                                                           |
| `description`     | `text`            | paragraf panjang, ditampilkan utuh                                                               |
| `lat` / `lng`     | `numeric(9,6)`    | pin peta Leaflet                                                                                 |

> **Sejak `0016_stays_drop_unvalidated_fields.sql` (2026-08-16), lima kolom sudah dihapus:**
> `bed_type_label`, `bed_type_note`, `capacity_label`, `airport_code`, `airport_city`. Kalau
> repo Anda masih punya field form untuk kolom-kolom ini, hapus — insert/update yang menyertakan
> kolom itu akan ditolak Postgres (`column does not exist`). Detail lengkap kenapa dan apa
> penggantinya ada di `STAYS-INPUT-DECISIONS.md` di repo situs customer; ringkasnya: halaman
> detail villa sekarang merender `capacity`/`beds`/`area` langsung (bukan lagi teks bebas), dan
> kartu "by air" di halaman lokasi sudah generik (bukan lagi per-villa).

**Constraint yang akan menolak tulisan Anda** — tangani sebagai validasi form, bukan sebagai
error tak terduga:

| Constraint                            | Aturan                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `stays_slug_format`                   | `^[a-z0-9]+(-[a-z0-9]+)*$` — huruf kecil, angka, tanda hubung. Tanpa spasi/kapital            |
| `stays_price_pos`                     | `price_per_night > 0`                                                                         |
| `stays_discount_ok`                   | `discount >= 0 AND discount < price_per_night` — **`<` bukan `<=`**, jadi diskon 100% ditolak |
| `stays_capacity_pos`                  | `capacity`, `beds`, `area` semuanya `> 0`                                                     |
| `stays_lat_range` / `stays_lng_range` | lat −90..90, lng −180..180                                                                    |

### ⚠️ Dua kolom yang bukan sekadar tampilan

**`discount` menentukan uang yang ditagih.** Versi lama dokumen ini menulis "belum dirender di
UI mana pun" — **itu salah sekarang**. Diskon dirender sebagai baris tersendiri di ringkasan
booking (hanya kalau `> 0`), selalu dikurangkan dari total, dan **disnapshot ke
`bookings.discount_per_night`** saat tamu checkout. Jadi salah menulis angka di sini bukan
salah tampilan, tapi salah tagih. Semua nilai hari ini `0`.

Efek samping yang perlu disadari: harga dan diskon dibaca ulang dari `stays` **pada saat tamu
menekan bayar**, bukan saat ia membuka halaman. Mengubah harga di tengah-tengah seseorang
checkout akan mengubah yang tersimpan — dan cache 1 jam justru memperlebar jendela itu, bukan
mempersempitnya. Kalau bisa, ubah harga di jam sepi.

**`capacity` memblokir booking.** Angka ini dipakai tiga lapis: stepper tamu berhenti di
situ, tombol bayar disabled kalau lebih, dan fungsi `create_booking()` menolaknya di database.
Menurunkan `capacity` **tidak** membatalkan booking yang sudah ada (tidak ada pengecekan
surut), tapi langsung memblokir booking baru yang lebih besar.

> ⚠️ **Mengubah `slug` = mengubah URL publik.** Link yang sudah dibagikan atau ter-index
> Google akan 404. Kalau admin panel mengizinkan rename, minimal beri peringatan; idealnya
> kunci setelah villa dipublikasikan.

### Cara mengisi `slug` — jangan ketik manual

**Latar belakang:** slug yang diketik manual pernah gagal insert dengan error `unique
violation` yang tidak spesifik (constraint `stays_slug_format` **dan** `unique` sama-sama bisa
memicu error generik dari Postgres) tiap kali dua villa kebetulan dapat slug sama persis.
Diputuskan 2026-08-16, ditulis lengkap di `STAYS-INPUT-DECISIONS.md` (repo situs customer):

1. Form **tidak** punya input teks bebas untuk `slug`. Slug diturunkan otomatis dari `name`:
   huruf kecil semua, spasi jadi `-`, karakter selain `[a-z0-9-]` dibuang — supaya otomatis lolos
   constraint `stays_slug_format` tanpa staff perlu tahu regex-nya.
2. **Sebelum insert**, admin panel cek apakah slug hasil turunan itu sudah dipakai
   (`select 1 from stays where slug = ...`). Kalau bentrok, tambahkan angka urut di belakang:
   `villa-sunset` → `villa-sunset-2` → `villa-sunset-3`, dst. — bukan id acak, supaya slug tetap
   terbaca sebagai nama villa dan bentroknya bisa direproduksi/diverifikasi.
3. Slug yang sudah dibuat **tidak bisa diedit lagi setelah villa dipublikasikan** — field
   ditampilkan read-only di form edit. Sebelum publish (mis. masih draft), boleh regenerate
   dengan mengubah `name` lalu menjalankan ulang langkah 1–2.

### Cara mengisi `lat` / `lng` — jangan ketik manual

**Latar belakang:** `location` (mis. `"Canggu, Bali"`) dan `lat`/`lng` selama ini diisi terpisah
tanpa saling terhubung, jadi typo di salah satunya menghasilkan pin di tempat salah — dan peta
situs customer di-render di **zoom 18** (level jalan), jadi pin yang meleset langsung kelihatan.
Diputuskan 2026-08-16:

1. Form location punya kotak pencarian tempat yang dipanggil ke **Nominatim (OpenStreetMap
   Search API)**, `https://nominatim.openstreetmap.org/search` — gratis, tanpa API key/akun,
   sama seperti tile map (CARTO + OSM) yang sudah dipakai situs customer justru dengan alasan
   yang sama. **Wajib** kirim header `User-Agent` yang identitas jelas (bukan default library)
   dan batasi ke maksimal 1 request/detik — itu syarat pemakaian Nominatim, bukan saran.
2. Staff ketik nama tempat, pilih satu dari daftar saran → `lat`/`lng` terisi otomatis dari
   titik yang dikembalikan Nominatim.
3. **Langkah ini tidak boleh dilewati:** geocoding by nama tempat cuma mengembalikan titik
   tengah kota/kecamatan, bukan titik villa yang sebenarnya. Form menampilkan mini-map (Leaflet
   sudah jadi dependency lewat paket yang sama dengan situs customer) dengan pin yang bisa
   digeser staff untuk mengoreksi ke posisi villa sesungguhnya sebelum disimpan.
4. `location` (teks) tetap diisi terpisah dari hasil pencarian ini — **tetap wajib format
   `"{Daerah}, Bali"` dengan koma**, lihat baris `location` di atas. Pencarian Nominatim boleh
   dipakai untuk menyarankan nilainya, tapi staff tetap yang menentukan teks akhir yang tampil.

### `stay_images`

| Kolom              | Tipe                      | Catatan                                                           |
| ------------------ | ------------------------- | ----------------------------------------------------------------- |
| `stay_id`          | `bigint` FK → `stays.id`  | `ON DELETE CASCADE`                                               |
| `storage_path`     | `text` unique             | **relatif ke bucket**, bukan URL penuh                            |
| `alt`              | `text` **wajib**          | teks alt aksesibilitas. **Harus unik per villa** — lihat di bawah |
| `blur_data_url`    | `text` **nullable di DB** | tapi **wajib diisi dalam praktik** — lihat di bawah               |
| `width` / `height` | `integer`                 | dimensi **setelah** resize, keduanya `> 0`                        |
| `sort_order`       | `smallint`                | unique per stay, `>= 0`. **`0` = gambar cover**                   |

Situs merakit URL publiknya sendiri:
`{SUPABASE_URL}/storage/v1/object/public/stays/{storage_path}`
Jangan simpan URL penuh di kolom itu — pindah project/region akan membatalkannya.

> ⚠️ **`blur_data_url` nullable di database tapi tidak boleh NULL.** Kartu villa merender
> `placeholder="blur"` tanpa pengaman apa pun, jadi baris tanpa blur **membuat halaman error**,
> bukan sekadar menghilangkan efek blur. Database tidak akan menolak baris itu — validasinya
> harus ada di admin panel. Lihat [Kontrak upload gambar](#-kontrak-upload-gambar).

> ⚠️ **`alt` yang sama dua kali dalam satu villa memicu bug render.** Situs memakai teks `alt`
> sebagai identitas tiap titik di indikator carousel, jadi dua foto ber-`alt` identik dianggap
> foto yang sama. Wajibkan alt unik per villa di form upload — database tidak mengeceknya.

### `amenities` + `stay_amenities`

| `amenities` | Tipe          | Catatan                                 |
| ----------- | ------------- | --------------------------------------- |
| `slug`      | `text` unique | format sama dengan slug stay            |
| `label`     | `text`        | judul baris yang bisa dibuka            |
| `detail`    | `text`        | isi yang muncul saat dibuka             |
| `is_shared` | `boolean`     | fasilitas yang dimiliki **semua** villa |

| `stay_amenities`           | Catatan                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| PK `(stay_id, amenity_id)` |                                                                    |
| `sort_order`               | **0–9 khusus villa, 10+ shared.** Situs merender sesuai urutan ini |

**Kenapa `is_shared` penting:** enam fasilitas (housekeeping, wifi, kitchen,
air-conditioning, safe, airport-transfer) memakai **satu baris yang dipakai bersama**
keempat villa. Mengedit teks Wi-Fi sekali akan mengubahnya di semua villa — itu memang
tujuannya. Jangan menduplikasi baris shared per villa; keanggotaannya tetap eksplisit di
`stay_amenities`, jadi sebuah villa boleh tidak memilikinya.

**Karena itu baris `is_shared = true` sebaiknya read-only di UI admin panel.** Mengeditnya dari
halaman satu villa terlihat seperti mengubah villa itu saja, padahal mengubah keempatnya
sekaligus — jenis kesalahan yang baru ketahuan belakangan. Kalau memang perlu diedit, beri
peringatan eksplisit "teks ini dipakai N villa".

**Villa baru tidak otomatis mendapat fasilitas shared.** Admin panel harus menyisipkan baris
`stay_amenities` untuk keenamnya, atau villa baru akan tampil tanpa fasilitas dasar.

---

## Menambahkan villa baru — alur lengkap

Bagian ini menggabungkan semua yang tersebar di dokumen ini menjadi satu urutan kerja, plus
konvensi isi yang **tidak dijaga constraint** — yang terakhir ini yang paling sering bikin
villa baru terlihat salah tanpa satu pun error muncul.

### Urutan langkah

| #   | Langkah                                                                               | Kenapa urutannya begini                                                 |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Insert baris `stays`                                                                  | Semua langkah berikutnya butuh `id` yang dihasilkan di sini             |
| 2   | Upload file foto ke bucket `stays`                                                    | `stay_images.storage_path` harus menunjuk file yang sudah ada           |
| 3   | Insert baris `stay_images`                                                            | Butuh `id` dari (1) dan path dari (2)                                   |
| 4   | Insert **6** baris `stay_amenities` shared, `sort_order` 10–15                        | **Tidak otomatis.** Tanpa ini villa tampil tanpa Wi-Fi, dapur, AC, dst. |
| 5   | Insert amenity khas villa: baris `amenities` baru + `stay_amenities` `sort_order` 0–9 | Opsional, tapi semua villa yang ada punya                               |

Villa baru **tetap tidak bisa dibuka** setelah kelima langkah ini sampai situs di-deploy ulang
— lihat [Villa baru belum bisa dibuka sampai situs di-deploy
ulang](#villa-baru-belum-bisa-dibuka-sampai-situs-di-deploy-ulang). Itu normal.

### Langkah 1 — kolom apa saja saat insert `stays`

**9 kolom wajib** (tidak punya default, insert gagal tanpa ini):

`slug`, `name`, `location`, `price_per_night`, `capacity`, `beds`, `area`, `description`,
`lat`, `lng`

**Punya default, boleh dilewat:** `discount` (`0`), `is_new` (`false`), `is_featured`
(`false`), `created_at` (`now()`), `id` (identity).

**Tidak ada kolom nullable lagi di tabel ini** sejak `bed_type_note` dihapus di
`0016_stays_drop_unvalidated_fields.sql`.

Contoh baris yang benar — ini salah satu villa yang sungguhan ada, dikutip utuh sebagai
patokan bentuk data yang bagus:

```sql
insert into public.stays (
    slug, name, location, price_per_night, capacity, beds, area, is_new,
    description, lat, lng
) values (
    'tuscan-twilight-villa', 'Tuscan Twilight Villa', 'Ubud, Bali',
    3500000, 6, 3, 220, true,
    'Set into the terraced slope above the Petanu river, Tuscan Twilight Villa pairs warm limewashed walls with floor-to-ceiling glass that opens the whole living pavilion to the valley. Three bedrooms sit along a quiet garden corridor, each with its own outdoor shower. Mornings arrive with mist over the rice fields; evenings belong to the infinity pool and the long teak dining table under the pergola.',
    -8.506900, 115.262500
);
```

### Konvensi isi yang TIDAK dijaga constraint

Ini bagian yang paling berguna: database menerima semuanya, situs yang menampilkannya salah.

| Kolom                        | Aturan tak tertulis                                                                                                                   | Yang rusak kalau dilanggar                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slug`                       | **Diturunkan otomatis dari `name`, jangan diketik manual** — lihat [Cara mengisi `slug`](#kontrak-data--skema-tabel) di atas          | Bentrok slug dulu gagal dengan error generik; alur auto-generate + suffix angka menghilangkan masalah ini di sisi admin panel                                                                                      |
| `name`                       | Title Case, 3 kata, tanpa nama daerah di belakang                                                                                     | —                                                                                                                                                                                                                  |
| `location`                   | **Wajib `"{Daerah}, Bali"` dengan koma**                                                                                              | Situs mengambil bagian sebelum koma untuk kalimat arah "by car". Tanpa koma, seluruh string masuk ke kalimat itu dan bacaannya jadi janggal                                                                        |
| `description`                | Satu paragraf, tanpa baris baru, 3–4 kalimat (±340–400 karakter di data yang ada)                                                     | Dirender **utuh tanpa dipotong**. Tidak ada pengaman kalau kepanjangan — layout halaman yang menanggung                                                                                                            |
| `capacity` / `beds` / `area` | Angka yang mencerminkan villa sesungguhnya                                                                                            | Sejak `0016`, ketiganya dirender **langsung** di halaman detail (bukan lagi lewat `capacity_label` bebas) — salah angka di sini sekarang langsung salah tampil, bukan cuma salah tulis di teks bebas yang terpisah |
| `lat` / `lng`                | **Isi lewat alur geocoding + pin manual** — lihat [Cara mengisi `lat`/`lng`](#kontrak-data--skema-tabel) di atas, jangan ketik manual | Peta dirender di zoom 18 (level jalan) — meleset ratusan meter langsung kelihatan salah                                                                                                                            |
| `is_featured`                | Persis **2** villa yang `true`                                                                                                        | Landing page dirancang untuk 2 kartu. Menandai villa ketiga mengubah layout landing page; tidak ada constraint yang mencegahnya                                                                                    |

**Dua hal yang tidak bisa diatur sama sekali:**

- **Urutan villa di halaman `/stays` mengikuti `id`.** Villa baru selalu muncul paling akhir,
  dan tidak ada cara mengurutkan ulang. Kalau butuh, itu permintaan kolom baru ke repo situs
  customer.
- **Villa di luar jangkauan DPS butuh amenity transfer sendiri**, karena teks amenity shared
  `airport-transfer` menyebut "Ngurah Rai International (DPS)" secara hardcode. Jangan pasang
  amenity shared itu ke villa yang bandaranya beda — buat versi khas villa (`is_shared = false`).

### Langkah 2–3 — gambar: dua aturan yang tidak boleh dilanggar

Pipeline teknisnya (resize, strip EXIF, WebP q80, blur 16px) ada utuh di
[Kontrak upload gambar](#-kontrak-upload-gambar) — jangan diringkas, ikuti persis. Dua hal di
luar pipeline yang khusus soal villa baru:

**1. `sort_order` harus rapat mulai dari 0** (`0, 1, 2, 3, …`), bukan sekadar unik. Alasannya
dua tempat memilih foto cover dengan cara berbeda:

- daftar villa & landing page mengambil **`sort_order` terkecil** yang ada;
- kartu trip tamu & halaman checkout mencari **`sort_order = 0` persis**.

Jadi villa yang foto terkecilnya bernomor `1` akan tetap punya cover di daftar villa, tapi
**foto-nya hilang di kartu trip dan halaman checkout**. Ini kegagalan senyap: tidak ada error,
cuma kotak kosong di tempat yang jarang dilihat admin.

**2. Nol gambar = halaman villa crash.** Bukan "tampil tanpa foto" — halaman detail villa
benar-benar error. Jadi jangan pernah mempublikasikan villa tanpa minimal satu foto.

Sebagai pelengkap catatan batch di [Upload sekarang batch di admin
panel](#upload-sekarang-batch-di-admin-panel--dan-status-1-gambar-sudah-dicek-aman):
**1 gambar aman, 0 gambar fatal.** Kalau alur upload batch bisa berhenti di tengah, pastikan
baris `stays`-nya tidak dianggap "siap tayang" sebelum ada minimal satu `stay_images`.

Sebagai patokan: keempat villa yang ada punya **5–6 foto**, selalu mencakup eksterior, kamar
tidur, kamar mandi, ruang keluarga, dan satu foto area luar. Penamaan path-nya
`{slug}/{sort_order}-{peran}.webp` — mis. `tuscan-twilight-villa/0-exterior.webp`.

### Langkah 4 — enam amenity shared, angkanya hardcode

Villa baru **tidak** mewarisi apa pun secara otomatis. Pasang keenamnya persis di nomor ini —
jangan dinomori ulang, karena keempat villa lain memakai nomor yang sama:

| `sort_order` | slug amenity       |
| ------------ | ------------------ |
| 10           | `housekeeping`     |
| 11           | `wifi`             |
| 12           | `kitchen`          |
| 13           | `air-conditioning` |
| 14           | `safe`             |
| 15           | `airport-transfer` |

Rujuk baris `amenities` yang **sudah ada** lewat `slug`-nya — jangan bikin baris baru untuk
keenam ini, karena justru itu yang merusak sifat "satu teks untuk semua villa".

### Langkah 5 — amenity khas villa

Boleh dibuat baru, dan memang begitu polanya. Aturannya:

- **`is_shared` harus `false`.** Menandai `true` membuatnya terlihat seperti bagian paket dasar
  padahal ia tidak otomatis terpasang ke villa lain — menyesatkan pembaca berikutnya.
- **`slug` pakai regex yang sama** dengan slug villa: `^[a-z0-9]+(-[a-z0-9]+)*$`
  (constraint `amenities_slug_format` akan menolak selain itu).
- **`sort_order` 0–9** di `stay_amenities`. Villa yang ada punya 2–3 amenity khas.
- **Tiap villa punya baris kolamnya sendiri**, bukan satu amenity "Pool" bersama:
  `infinity-pool`, `clifftop-pool`, `plunge-pool`, `ocean-pool` — masing-masing dengan detail
  spesifik (panjang kolam, letaknya, sifat airnya). Ikuti pola ini: detail yang spesifik justru
  yang bikin halaman villa terasa berbeda satu sama lain.
- Secara teknis satu amenity non-shared **bisa** dipakai beberapa villa (tabelnya global,
  relasinya many-to-many), tapi di data yang ada tidak pernah — dan detailnya terlalu spesifik
  untuk dipakai bersama.

### Checklist sebelum villa dianggap siap tayang

1. Baris `stays` lengkap, `location` punya koma.
2. Minimal 1 baris `stay_images`, `sort_order` rapat mulai dari `0`.
3. Setiap baris gambar punya `blur_data_url`, `width`, `height`.
4. Tidak ada `alt` yang kembar di dalam satu villa.
5. Enam baris `stay_amenities` shared di `sort_order` 10–15.
6. `capacity`, `beds`, `area` mencerminkan villa sesungguhnya — dirender langsung, tidak ada
   lagi lapisan teks bebas yang bisa berbeda dari angkanya.

Query untuk memeriksa 2–5 ada di [Cara menguji dari sisi Anda](#cara-menguji-dari-sisi-anda).

---

## Lampiran: tabel di luar wewenang, untuk konteks debugging

Bukan sesuatu yang admin panel tulis — tapi ini bentuk baris yang **akan Anda temui** kalau
menyelidiki kenapa sebuah villa tidak bisa dihapus, atau kenapa sebuah review muncul dengan
nama "Former guest". Baca sebagai referensi, bukan sebagai kontrak yang boleh ditulis.

### `public.guests`

PK-nya **adalah** `auth.users.id` (bukan PK sendiri). Kolom: `display_name`, `full_name`
(nullable), `phone_country_code`/`phone` (nullable — baru terisi saat tamu checkout booking
pertamanya), `nationality` (nullable), `avatar_path` (nullable, path relatif ke bucket
`guests`), `created_at`/`updated_at`. Tidak ada kolom `email` — itu tetap di `auth.users`.
RLS: baris hanya bisa dibaca/diedit oleh pemiliknya sendiri (`auth.uid() = id`); **tidak ada
policy untuk `anon` sama sekali**, karena tabel ini menyimpan nomor telepon.

Sejak 2026-08-15, sebagian kolom ini (semua kecuali `nationality` dan `avatar_path`) bisa
terlihat admin panel — tapi hanya lewat `admin_booking_roster()`, di-scope ke guest yang punya
booking, tidak pernah lewat query langsung ke tabel ini. Lihat
[Akses baca staf ke data guest](#akses-baca-staf-ke-data-guest).

### `public.reviews`

Menunjuk `stay_id` (nullable, `on delete set null`) dan `guest_id` (nullable, `on delete set
null` — review bertahan setelah akun tamunya dihapus). Kalau `guest_id` bernilai `null`, ada
constraint yang mewajibkan `author_display_name = 'Former guest'` dan `author_avatar_path`
kosong — ini hasil dari alur hapus akun (lihat opsi "anonymize" di
`ACCOUNT-DELETION-POLICY.md`, gitignored di repo situs customer). Belum ada kolom `booking_id`
untuk menandai "verified review" — direncanakan tapi belum dibangun.

### `public.bookings`

`stay_id` wajib (`on delete restrict` — sumber aturan "villa tidak bisa dihapus" di atas).
`guest_id` nullable (`on delete set null`, catatan keuangan tetap ada walau akun tamunya hilang).
`status` salah satu dari `confirmed | checked_in | checked_out | cancelled | no_show` — hanya
berubah lewat fungsi `security definer` di situs customer atau cron per jam, tidak pernah lewat
tulis baris langsung. `total_price` dan `num_nights` adalah **generated column** (dihitung
Postgres, tidak bisa di-override). `access_code` (8 karakter hex, unique) adalah kode yang
dipindai tamu untuk self check-in — perlakukan seperti data sensitif ringan (siapa pun yang punya
kode bisa check-in tanpa login).

Kolom lain yang **ada tapi sempat tidak tercatat di dokumen ini** (diverifikasi langsung ke
project live, September 2026) — jangan menyimpulkan sebuah kolom tidak ada hanya karena tidak
tertulis di sini:

| Kolom          | Tipe          | Catatan                                                              |
| -------------- | ------------- | -------------------------------------------------------------------- |
| `num_guests`   | `smallint`    | Jumlah tamu yang dipesan. **Bukan `integer`** — fungsi yang mengembalikannya harus cast, kalau tidak error tiap dipanggil |
| `guest_notes`  | `text`        | Teks bebas yang ditulis tamu saat checkout. Sering satu-satunya tempat permintaan kedatangan tercatat |
| `paid_at`      | `timestamptz` | Kosong kalau belum dibayar                                            |
| `cancelled_at` | `timestamptz` | Kosong kalau tidak dibatalkan                                         |

Kelimanya (bersama `created_at`) dibuka ke admin panel lewat `admin_booking_roster()` di
`0019_admin_booking_roster_guest_details.sql`. Kolom `observations` dan `numGuests` yang terlihat
di `src/supabase/types/database.types.ts` dan `features/check-in-out/` **bukan bagian skema
Seaspace** — itu sisa skema demo wild-oasis yang lama.

---

## ⚠️ Kontrak upload gambar

**Ini bagian yang paling mudah dilanggar, dan pelanggarannya tidak membuat halaman jelek —
membuatnya error.**

Situs customer merender setiap foto villa dengan `<Image placeholder="blur">`. Di Next.js,
`placeholder="blur"` pada gambar **remote** mewajibkan `blurDataURL`; tanpa itu render
**melempar error**, bukan sekadar menghilangkan efek blur. Gambar statis mendapatkannya
otomatis saat build — gambar dari Storage tidak.

Artinya: **setiap baris `stay_images` yang Anda tulis wajib mengisi `blur_data_url`,
`width`, dan `height`.** Baris tanpa itu akan merusak halaman villa.

### Pipeline yang harus direplikasi

Foto yang ada sekarang di-upload sekali oleh script sekali-pakai yang **sudah dihapus**
bersama foto sumbernya — jadi dokumen ini adalah satu-satunya catatan pipeline-nya yang
tersisa. Admin panel perlu melakukan hal yang sama untuk setiap upload:

1. **Resize** sisi terpanjang ke maksimal **2560 px**, tanpa upscale.
2. **Terapkan orientasi EXIF lalu buang tag-nya** (`sharp().rotate()` tanpa argumen). Tanpa
   ini, foto portrait dari ponsel akan tersimpan miring — WebP membuang tag EXIF yang tadinya
   diandalkan browser.
3. **Encode WebP quality 80.** Situs meminta `quality={80}` ke image optimizer-nya agar cocok;
   sumber yang lebih tinggi hanya membuang byte.
4. **Catat `width`/`height` dari hasil resize**, bukan dari file asli.
5. **Buat blur**: salinan selebar **16 px**, WebP quality 20, jadikan
   `data:image/webp;base64,…`. Hasilnya ±115–220 karakter. Jangan lebih besar — string ini
   dikirim inline di HTML setiap halaman.
6. **Upload** dengan `cacheControl: "31536000"` dan `contentType: "image/webp"`.

Contoh dengan `sharp` (Node):

```js
const resized = sharp(input).rotate().resize({
    width: 2560,
    height: 2560,
    fit: "inside",
    withoutEnlargement: true,
});
const { data, info } = await resized
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

const blur = await sharp(input)
    .rotate()
    .resize({ width: 16 })
    .webp({ quality: 20 })
    .toBuffer();

// info.width / info.height → kolom width / height
// `data:image/webp;base64,${blur.toString("base64")}` → kolom blur_data_url
```

### Konvensi path dan setelan bucket

Path: `{stay_slug}/{sort_order}-{peran}.webp` — mis. `tuscan-twilight-villa/0-exterior.webp`.

Bucket `stays` (terverifikasi live):

| Setelan              | Nilai                                                 |
| -------------------- | ----------------------------------------------------- |
| public               | `true`                                                |
| `file_size_limit`    | **2 MB**                                              |
| `allowed_mime_types` | `image/webp`, `image/jpeg`, `image/png`, `image/avif` |

Kedua batasan itu ditegakkan **oleh Storage**, bukan oleh validasi aplikasi. Upload di luar
batas ditolak dengan error dari Supabase — tangani dan tampilkan ke admin, jangan biarkan
gagal senyap. Pipeline di atas menghasilkan ±60–690 KB per file, jadi jauh di bawah batas.

### Menghapus gambar

Menghapus baris `stay_images` **tidak** menghapus objek di Storage. Hapus keduanya, atau
bucket akan terisi file yatim yang tetap ditagih.

Ini juga berlaku saat menghapus **villa**: `stay_images` ikut terhapus otomatis
(`on delete cascade`), tapi file-file di Storage tidak. Kumpulkan `storage_path`-nya dulu
sebelum menghapus barisnya, atau folder `{slug}/` akan tertinggal selamanya tanpa ada baris
yang menunjukkan keberadaannya.

Sesi staff boleh mengunggah, mengganti, dan menghapus file di bucket `stays` sejak
`0021_admin_staff_stays_bucket_writes.sql` — sebelumnya bucket ini hanya punya policy baca.
Policy bucket lama dari repo situs customer memanggil `public.is_staff(min_role)`; fungsi itu
membaca `staff.role` yang dihapus `0018`, sehingga Storage membalas 503
`DatabaseSchemaMismatch`. `0022_is_staff_membership_only.sql` menulis ulang body-nya menjadi
cek keanggotaan saja.

### Upload sekarang batch di admin panel — dan status 1-gambar sudah dicek aman

Admin panel sekarang meng-upload beberapa gambar sekaligus per stay (batch), bukan satu-per-satu
seperti yang tersirat di pipeline manual di atas. **Pipeline resize/strip-EXIF/blur/upload-nya
sendiri tidak berubah** — yang berbeda hanya jumlah file yang diproses dalam satu operasi.

Pertanyaan terbuka yang muncul dari ini: kalau sebuah batch berhenti di tengah jalan (mis. admin
membatalkan, atau sengaja hanya meng-upload cover dulu) dan sebuah stay berakhir dengan **cuma
satu** baris `stay_images`, apa yang terjadi di UI situs customer? Sudah diriset langsung ke
kode ini (bukan dugaan):

- **DB**: tidak ada constraint yang mewajibkan lebih dari satu gambar per stay. Satu baris
  `sort_order = 0` (cover) sudah state yang valid — lihat constraint di
  [`stay_images`](#stay_images) di atas (`unique(stay_id, sort_order)`, `sort_order >= 0`,
  `width/height > 0`; tidak ada `count(*) >= 2` atau sejenisnya).
- **UI**: hanya satu komponen yang mengonsumsi array `gallery` penuh —
  `StayImageCarousel` (`features/stays/components/stay-image-carousel.tsx`, dipakai di
  `app/(stay-list)/stays/[stayId]/page.tsx:56`). Komponen kartu (`stay-card.tsx`,
  `stay-card-preview.tsx`) cuma memakai gambar cover tunggal — jumlah gambar total tidak
  memengaruhinya sama sekali.
- **Verdict dengan tepat 1 gambar**: **tidak crash, tidak tampil kosong.** Semua aritmetika
  index di carousel generic terhadap jumlah gambar, tidak ada divide-by-zero. Tapi ada
  **inkonsistensi UX** yang sudah dikonfirmasi di kode: tombol prev/next
  (`stay-image-carousel.tsx:417-433`) dan baris dot indicator (`:438-447`) tetap dirender
  **tanpa syarat**, walau `images.length === 1` — jadi tamu melihat kontrol navigasi yang
  terlihat interaktif tapi klik/drag-nya cuma kembali ke foto yang sama.

**Kesimpulan untuk admin panel:** upload dengan hasil 1 gambar per stay **tidak merusak**
halaman villa — aman dari sisi fungsional. Tapi kalau ini bukan state yang disengaja (mis. batch
gagal separuh jalan tanpa admin sadar), sebaiknya admin panel memvalidasi/memperingatkan di
sisi UI-nya sendiri sebelum publish, karena situs customer tidak akan menolaknya. Membersihkan
UX arrow/dot untuk kasus 1-gambar adalah pekerjaan **repo situs customer**, bukan admin panel —
belum ada keputusan apakah itu perlu dikerjakan.

---

## Kontrak revalidasi

> **Status: belum dibangun.** Bagian ini adalah spesifikasi yang disepakati untuk saat
> endpoint-nya dibuat di sisi situs customer. Sampai itu ada, satu-satunya mekanisme adalah
> timer berbasis `cacheLife`.
>
> Mekanisme cache-nya sendiri sudah berganti sejak dokumen ini pertama ditulis — situs customer
> sekarang memakai **Cache Components** Next 16 (`cacheComponents: true`), bukan lagi opsi
> `fetch` bawaan. Query katalog (`getStays`/`getStay`/`getFeaturedStays` di
> `features/stays/actions.ts`) ditandai `"use cache"` + `cacheTag("stays")` + `cacheLife("hours")`.
> **Nama tag-nya tidak berubah** (`"stays"`), jadi spesifikasi endpoint webhook di bawah masih
> berlaku persis seperti tertulis. Yang berubah hanya implementasi timer-nya, bukan kontraknya.

Saat aktif nanti:

| Hal               | Nilai                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Cache tag         | `stays` — satu tag untuk semua: listing, featured, gambar, amenity                           |
| Pemicu            | **Supabase Database Webhook**, bukan panggilan dari admin panel                              |
| Autentikasi       | Shared secret di HTTP header (tidak ada HMAC bawaan seperti Stripe)                          |
| Method            | `POST` saja                                                                                  |
| Penerima          | **Route Handler** di situs customer (bukan Server Action) — path filenya belum diputuskan    |
| Pemanggilan cache | `revalidateTag("stays", "max")` — argumen kedua `"max"` ikut disebut di `supabase/README.md` |

Profile timer 1 jam di atas juga punya nama identifier di kode:
`cacheLife("hours")` / `STAYS_CACHE_PROFILE = "hours"` (`lib/supabase.ts`) — sama-sama dipakai di
`getStays`/`getStay`/`getFeaturedStays` (`features/stays/actions.ts`).

### Kenapa admin panel sebaiknya TIDAK memanggil endpoint-nya sendiri

Terdengar lebih langsung, tapi lebih rapuh. Database Webhook dipicu oleh **perubahan baris**,
jadi ia menangkap **semua** jalur tulis:

- perubahan lewat admin panel ✓
- perbaikan manual lewat Supabase SQL Editor ✓
- script upload gambar di sisi situs customer ✓
- migrasi atau perbaikan data apa pun ✓

Panggilan dari admin panel hanya menangkap jalurnya sendiri. Begitu ada orang menyentuh data
lewat cara lain, cache jadi salah tanpa ada yang sadar.

**Konsekuensi untuk Anda:** admin panel **tidak perlu melakukan apa-apa** soal revalidasi.
Cukup tulis ke database. Konfigurasi webhook dikerjakan sekali di dashboard Supabase.

### Catatan pengelolaan secret

Secret akan hidup di dua tempat: environment situs customer dan konfigurasi webhook di
dashboard Supabase. Rotasi harus mengubah **keduanya** — kalau hanya satu, webhook gagal
senyap. Inilah persis skenario yang membuat timer 1 jam tetap dipertahankan.

**Bukan solusi untuk villa baru.** Webhook ini menyegarkan **data** villa yang sudah ada
halamannya — bukan solusi untuk villa **baru** yang belum di-build, lihat [Villa baru belum
bisa dibuka sampai situs di-deploy ulang](#villa-baru-belum-bisa-dibuka-sampai-situs-di-deploy-ulang).

---

## Yang tidak bisa dilakukan admin panel

| Tidak bisa                                                                          | Kenapa                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import { revalidateTag } from "next/cache"`                                        | Khusus runtime Next.js. Tidak berfungsi dari aplikasi lain, bahkan kalau admin panel juga Next.js — cache-nya milik proses yang berbeda                      |
| `updateTag()`                                                                       | Hanya bisa dipanggil dari Server Action di aplikasi yang sama                                                                                                |
| Menulis **tanpa sesi login staff**                                                  | Anon key saja hanya dapat `SELECT`. Policy tulis mensyaratkan `auth.uid()` yang punya baris di `public.staff` — [detail](#keputusan-jalur-tulis-admin-panel) |
| Membuat baris `public.staff` sendiri                                                | Tidak ada policy INSERT untuk siapa pun. Akun staff dibuat manual pemilik proyek situs customer                                                              |
| Mengandalkan `id` numerik di URL                                                    | Situs merutekan berdasarkan `slug`                                                                                                                           |
| Mengatur urutan villa di halaman `/stays`                                           | Urutannya mengikuti `id`. Villa baru selalu paling akhir; belum ada kolom untuk mengurutkan                                                                  |
| Membuka halaman villa yang baru dibuat                                              | Butuh deploy ulang situs — [penjelasan](#villa-baru-belum-bisa-dibuka-sampai-situs-di-deploy-ulang)                                                          |
| Membuat akun, guest, atau booking                                                   | Keputusan produk — lihat [Batas wewenang admin panel](#batas-wewenang-admin-panel). Akun adalah tanggung jawab user yang memesan                             |
| Menulis ke `public.guests` / `public.reviews` / `public.bookings` / bucket `guests` | Di luar wewenang. `guests` hanya lahir dari trigger signup; `reviews` dan `bookings` ditulis tamu                                                            |
| `SELECT * FROM public.guests` langsung, dengan cara apa pun                         | Baca guests hanya lewat tiga fungsi tertentu, sesi staf — [detail](#akses-baca-staf-ke-data-guest)                                          |
| Menghapus villa yang punya booking                                                  | `bookings.stay_id` memakai `on delete restrict` — [penjelasan lengkap](#villa-yang-punya-booking-tidak-bisa-dihapus)                                         |

Satu-satunya jalur komunikasi antar kedua aplikasi adalah **database** dan (nanti) **satu
HTTP endpoint**.

---

## Cara menguji dari sisi Anda

Tanpa akses ke repo situs customer, ini yang bisa diperiksa:

**Apakah baris gambar lengkap?** Harus mengembalikan 0 baris — kalau tidak, halaman villa
terkait akan error:

```sql
select stay_id, storage_path
from stay_images
where blur_data_url is null or width is null or height is null;
```

**Apakah setiap villa punya cover?** Harus 0 baris:

```sql
select slug from stays s
where not exists (
    select 1 from stay_images i where i.stay_id = s.id and i.sort_order = 0
);
```

**Apakah `sort_order` gambar rapat mulai dari 0?** Harus 0 baris. Villa yang muncul di sini
punya lubang penomoran — cover-nya akan hilang di kartu trip dan halaman checkout:

```sql
select s.slug, count(i.*) as jumlah_gambar,
       min(i.sort_order) as terkecil, max(i.sort_order) as terbesar
from stays s
join stay_images i on i.stay_id = s.id
group by s.slug
having min(i.sort_order) <> 0
    or max(i.sort_order) <> count(i.*) - 1;
```

**Apakah ada villa tanpa gambar sama sekali?** Harus 0 baris — kalau ada, halaman villa itu
**error**, bukan sekadar tampil tanpa foto:

```sql
select s.slug from stays s
where not exists (select 1 from stay_images i where i.stay_id = s.id);
```

**Apakah ada `alt` kembar dalam satu villa?** Harus 0 baris:

```sql
select stay_id, alt, count(*)
from stay_images
group by stay_id, alt having count(*) > 1;
```

**Apakah villa baru mendapat fasilitas shared?** Harus 6 untuk setiap villa:

```sql
select s.slug, count(*) filter (where a.is_shared) as shared_count
from stays s
left join stay_amenities sa on sa.stay_id = s.id
left join amenities a on a.id = sa.amenity_id
group by s.slug order by shared_count;
```

**Apakah gambar benar-benar bisa diakses publik?** Gunakan GET, **bukan** `curl -I` —
Supabase Storage melayani HEAD lewat jalur berbeda yang selalu membalas `no-cache` dan
membuat objek yang sehat terlihat rusak:

```bash
curl -s -o /dev/null -D - \
  "https://<project-ref>.supabase.co/storage/v1/object/public/stays/<path>.webp"
# harap: 200, content-type: image/webp, cache-control: public, max-age=31536000
```

**Apakah policy tulis sudah terpasang?** Jalankan setelah `0015_staff_catalog_writes.sql`.
Harap: 4 policy `SELECT` + 12 policy tulis di keempat tabel:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('stays','stay_images','amenities','stay_amenities')
order by tablename, cmd;
```

**Apakah sesi login Anda benar-benar dikenali sebagai staff?** Jalankan dari sesi staff
(bukan SQL Editor, yang berjalan sebagai service role dan selalu menjawab dengan cara berbeda):

```sql
select exists (select 1 from public.staff where id = auth.uid()) as boleh_tulis;
```

Kalau `boleh_tulis` bernilai `false`, akun itu belum punya baris di `public.staff` — dan setiap
INSERT dari sesinya akan ditolak. Ini penyebab paling mungkin dari "kenapa simpan villa selalu
gagal padahal datanya benar".

**Apakah webhook terkirim?** (setelah dibangun) — pg_net mencatat setiap respons:

```sql
select created, status_code, error_msg
from net._http_response
order by created desc
limit 20;
```

---

## Ringkasan invariant

Hal-hal yang kalau dilanggar akan merusak situs customer:

1. Setiap `stay_images` punya `blur_data_url`, `width`, `height` — **kalau tidak, halaman error**
2. Setiap stay punya **minimal satu** gambar, dan tepat satu dengan `sort_order = 0` —
   **nol gambar membuat halaman villa error**, bukan sekadar kosong
3. `sort_order` gambar rapat mulai dari 0 (`0,1,2,…`), tanpa lubang penomoran
4. `alt` tidak pernah kembar di dalam satu villa
5. `slug` mengikuti `^[a-z0-9]+(-[a-z0-9]+)*$` dan stabil setelah dipublikasikan
6. `price_per_night` dan `discount` dalam rupiah bulat, bukan sen — **keduanya menentukan
   uang yang ditagih tamu**
7. `location` selalu punya koma (`"{Daerah}, Bali"`)
8. Villa baru diberi keenam fasilitas `is_shared` secara eksplisit, di `sort_order` 10–15
9. Objek Storage dihapus bersama baris `stay_images`-nya

---

## Template `CLAUDE.md` untuk repo admin panel

Blok di bawah ini dirancang untuk **ditempel langsung** sebagai `CLAUDE.md` di root repo admin
panel. Dua langkah sebelum dipakai:

1. Salin file dokumen ini (`ADMIN-PANEL-CONTEXT.md`) ke root repo admin panel — tanpa filenya
   ada di sana, baris `@ADMIN-PANEL-CONTEXT.md` di bawah tidak akan ter-resolve.
2. Isi bagian yang ditandai `<!-- ISI: ... -->` dengan detail repo admin panel yang sebenarnya
   (stack, struktur folder, dll). Dokumen ini sengaja tidak menebaknya — repo admin panel belum
   ada isinya saat dokumen ini ditulis.

```markdown
# CLAUDE.md — Admin Panel (Seaspace)

@ADMIN-PANEL-CONTEXT.md

## Apa aplikasi ini

Admin panel internal untuk mengelola katalog villa Seaspace. Read-write ke Supabase lewat
anon/publishable key **plus sesi login staff**, dipakai staf internal (bukan customer publik).
Lihat `ADMIN-PANEL-CONTEXT.md` (di-import di atas) untuk kontrak lengkap dengan situs
customer — skema tabel, wewenang, pipeline upload gambar, dan alasan di balik tiap batasan.

<!-- ISI: satu-dua kalimat tambahan kalau ada konteks produk yang tidak tercakup
     ADMIN-PANEL-CONTEXT.md, mis. siapa penggunanya, berapa staf, dll. -->

## Aturan tegas — jangan dilanggar tanpa membaca alasannya di ADMIN-PANEL-CONTEXT.md

- **Hanya menulis ke `stays`, `stay_images`, `amenities`, `stay_amenities`, dan bucket `stays`.**
  Jangan menulis ke `auth.users`, `public.guests`, `public.reviews`, `public.bookings`, atau
  bucket `guests`. Baca
  [Batas wewenang admin panel](./ADMIN-PANEL-CONTEXT.md#batas-wewenang-admin-panel) sebelum
  menambah fitur yang mendekati batas ini.
- **Menulis butuh sesi login staff, bukan service role key.** Aplikasi ini memakai
  anon/publishable key (aman di browser) dan mengandalkan RLS: policy tulis hanya terbuka untuk
  `auth.uid()` yang punya baris di `public.staff`. **Jangan menambahkan service role key ke repo
  ini** — ia mem-bypass seluruh RLS dan tidak punya tempat aman di aplikasi tanpa server.
  Latar belakangnya di [Keputusan: jalur tulis admin panel](./ADMIN-PANEL-CONTEXT.md#keputusan-jalur-tulis-admin-panel).
- **Tulis yang ditolak RLS tidak memunculkan error** — cuma 0 baris terpengaruh. Jadi UI wajib
  menyembunyikan entry point-nya dari user yang bukan staf, karena tanpa itu operasinya terlihat
  "berhasil" padahal tidak terjadi apa-apa.
- **Setiap upload gambar wajib mengisi `blur_data_url`, `width`, `height`.** Replikasi pipeline
  di [Kontrak upload gambar](./ADMIN-PANEL-CONTEXT.md#-kontrak-upload-gambar) persis — resize,
  strip EXIF, WebP quality 80, generate blur 16px. Baris yang lolos tanpa ini akan meng-crash
  halaman villa di situs customer.
- **Villa baru wajib: ≥1 gambar, `sort_order` rapat mulai 0, `alt` unik, dan 6 amenity shared
  di `sort_order` 10–15.** Tidak satu pun dijaga database — semua harus divalidasi di sini.
  Checklist lengkapnya di
  [Menambahkan villa baru](./ADMIN-PANEL-CONTEXT.md#menambahkan-villa-baru--alur-lengkap).
- **Villa yang punya booking tidak bisa dihapus** (`on delete restrict`). Tangani error dari
  Postgres sebagai aturan bisnis di UI (mis. tombol "Delete" disabled + tooltip), bukan sebagai
  bug yang perlu di-debug tiap kali muncul.
- **Perubahan tidak langsung terlihat customer** — cache situs customer bertahan sampai
  ~1 jam (time-based) sampai webhook revalidasi dibangun. Jangan buka bug report untuk ini;
  lihat [penjelasan lengkapnya](./ADMIN-PANEL-CONTEXT.md#kenapa-perubahan-anda-tidak-langsung-terlihat-customer).
- **Villa yang baru dibuat belum punya halaman** sampai situs customer di-deploy ulang — beda
  dari cache 1 jam di atas. Jangan janjikan link "lihat di situs" yang langsung jadi;
  [kenapa](./ADMIN-PANEL-CONTEXT.md#villa-baru-belum-bisa-dibuka-sampai-situs-di-deploy-ulang).
- **`price_per_night` dan `discount` menentukan uang yang ditagih tamu**, bukan sekadar
  tampilan. Rupiah bulat, bukan sen. Perlakukan form harga seperti form keuangan.
- **Mengubah `slug` mengubah URL publik villa.** Beri peringatan di UI edit, atau kunci field
  ini setelah villa dipublikasikan.

## Stack

<!-- ISI: framework, versi Next/lainnya, styling, state management, dsb.
     Kalau admin panel juga Next.js, catat versi dan apakah cacheComponents dipakai —
     itu tidak relevan buat admin panel (read-write, bukan cache pembaca), tapi berguna
     supaya agent tidak salah asumsi menyamakan pola dengan situs customer. -->

## Struktur folder

<!-- ISI: konvensi folder repo ini (feature-based? domain-based? flat?). -->

## Environment variables

Hanya dua yang dibutuhkan: **URL Supabase** dan **anon/publishable key**. Keduanya memang
dirancang untuk sampai ke browser, jadi tidak ada secret yang perlu disembunyikan di aplikasi
ini. **Tidak ada `SERVICE_ROLE_KEY` di repo ini, dan jangan menambahkannya** — semua wewenang
tulis datang dari sesi login staff, bukan dari key.

<!-- ISI: nama variabel sebenarnya di framework ini (mis. VITE_SUPABASE_URL /
     VITE_SUPABASE_KEY) dan di mana file .env-nya. -->

**Sebelum mengasumsikan "satu database" dengan situs customer, verifikasi project ref-nya
cocok.** Ini bukan basa-basi — pernah ditemukan kasus nyata di mana env var Supabase admin
panel menunjuk ke project ref yang berbeda dari situs customer (`aoedxrhwzjracosjcmzo`), yang
berarti seluruh kontrak di `ADMIN-PANEL-CONTEXT.md` tidak berlaku sampai itu dibetulkan. Cara
cek cepat: decode payload JWT dari anon/publishable key (`ref` di dalamnya) atau bandingkan
langsung host di `SUPABASE_URL`, lalu cocokkan dengan ref di atas. Baca
[Keputusan: jalur tulis admin panel](./ADMIN-PANEL-CONTEXT.md#keputusan-jalur-tulis-admin-panel)
untuk kronologi lengkapnya.

## Testing & verifikasi sebelum menganggap selesai

Sebelum menandai perubahan tulis-ke-database selesai, jalankan query verifikasi di
[Cara menguji dari sisi Anda](./ADMIN-PANEL-CONTEXT.md#cara-menguji-dari-sisi-anda) — baris
gambar lengkap, setiap villa punya cover, `sort_order` rapat mulai 0, `alt` tidak kembar, dan
villa baru dapat 6 fasilitas shared.

Kalau menulis selalu gagal padahal datanya benar, cek dulu apakah sesi login-nya dikenali:
`select exists (select 1 from public.staff where id = auth.uid());` dari sesi itu. `false` berarti akunnya belum punya baris di
`public.staff` — dan baris itu **hanya bisa dibuat pemilik proyek situs customer**, bukan dari
sini.

<!-- ISI: perintah test/build/lint spesifik repo ini, mis. `pnpm test`, `pnpm build`. -->

## Kalau ragu soal wewenang atau skema

Jangan menebak. `ADMIN-PANEL-CONTEXT.md` di root repo ini adalah kontrak yang disepakati
dengan repo situs customer — kalau sesuatu tidak tercakup di sana (mis. kolom baru yang
sepertinya berguna untuk fitur admin), itu artinya perlu perubahan skema di repo situs
customer dulu, bukan sesuatu yang boleh ditambahkan sepihak dari sini.
```
