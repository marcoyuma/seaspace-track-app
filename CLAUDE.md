# CLAUDE.md — Admin Panel (Seaspace)

## Apa aplikasi ini

Admin panel internal untuk mengelola katalog villa Seaspace. Dipakai staf internal (bukan
customer publik) untuk mengelola katalog 4 villa: `stays`, `stay_images`, `amenities`,
`stay_amenities`, plus bucket storage `stays`. Jumlah staf pengguna belum diketahui — jangan
menebak.

Repo ini separuh dari sistem dua-repo. Separuh lainnya adalah situs booking Seaspace yang
publik — codebase terpisah yang tidak pernah saling impor. Satu-satunya yang dibagi adalah
project Supabase, jadi batas antar keduanya ditegakkan di database, bukan di kode aplikasi.

**Akses tulis lewat anon key + RLS, bukan service role key.** Staf login sebagai user Supabase
biasa; setiap policy tulis di empat tabel katalog mencocokkan `auth.uid()` sesi itu ke tabel
`public.staff`. Hanya ada satu Supabase client di app ini.

**Cuma ada satu tingkatan staf.** Punya baris di `public.staff` = wewenang penuh di app ini.
Tidak ada kolom `role`, tidak ada tier di atas atau di bawah — lihat
`0018_drop_manager_role.sql`. Yang masih dibedakan hanya staf vs bukan-staf.

## Aturan tegas — jangan dilanggar

- **Hanya menulis ke `stays`, `stay_images`, `amenities`, `stay_amenities`, dan bucket `stays`.**
  Jangan menulis ke `auth.users`, `public.guests`, `public.reviews`, `public.bookings`, bucket
  `guests`, atau `public.staff`. Ini keputusan produk, bukan keadaan sementara: baris `guests`
  hanya lahir dari trigger signup dan primary key-nya **adalah** `auth.users.id`, sementara
  `bookings` tidak punya policy INSERT/UPDATE/DELETE sama sekali — bahkan situs customer
  menulisnya lewat fungsi `security definer`. Kalau suatu hari admin perlu membuat booking
  manual, itu butuh fungsi `security definer` baru yang disetujui dulu di repo situs customer,
  bukan jalan pintas menulis baris langsung.
- **Ada satu pengecualian baca-saja.** Empat fungsi `security definer` —
  `admin_booking_roster()`, `admin_guest_nationality_stats()`, `admin_export_guests()`,
  `admin_booking_access_code()` — memberi sesi staf yang sah jalur baca terbatas ke data guest
  untuk layar Bookings dan Check-in. Jangan pernah `SELECT * FROM public.guests` langsung.
  Larangan **menulis** ke `guests`/`reviews`/`bookings` tidak berubah sedikit pun.
- **`access_code` diambil satu baris sekali, dan selalu dicatat.** Kode self check-in tidak
  pernah ikut `admin_booking_roster()` — fungsi itu mengembalikan rentang tanggal sekaligus,
  jadi satu kolom kode di sana berarti seluruh kode dalam rentang ikut mengendap di cache
  browser untuk booking yang tidak pernah dibuka siapa pun. Ambil lewat
  `admin_booking_access_code(p_booking_id)`, yang menulis satu baris ke
  `public.admin_access_code_log` tiap kali dipanggil. Karena cuma ada satu tingkatan staf,
  log itulah satu-satunya kontrol yang tersisa — jangan dilewati, dan jangan menaruh kodenya
  di URL. Lihat `0020_admin_booking_access_code.sql`.
- **Jangan pernah menaruh service role key di repo ini.** Ini SPA murni tanpa server runtime —
  tidak ada tempat menyembunyikan secret, dan Vite akan meng-inline-nya ke bundle browser. Key
  itu mem-bypass seluruh RLS, jadi justru ia opsi paling berbahaya di app tanpa server.
- **Menghapus villa itu aksi yang menjangkau jauh** — semua staf boleh, tapi tetap wajib pakai
  dialog konfirmasi. `stay_images` dan `stay_amenities` ikut terhapus (`on delete cascade`), dan
  review villa itu diputus diam-diam dari villa mana pun (`reviews.stay_id`
  `on delete set null`).
- **Tulis yang tidak berhak mengembalikan 0 baris, BUKAN error.** User yang sudah login tapi
  tidak punya baris di `public.staff` akan melihat operasi "berhasil" tanpa ada yang berubah.
  Karena itu entry point-nya wajib disembunyikan di UI — jangan mengandalkan pesan error dari
  Postgres, karena tidak akan ada. RLS adalah batas keamanan sebenarnya; `StaffOnlyRoute` dan
  link nav yang disembunyikan itu lapisan UX supaya user tidak pernah ditawari aksi yang
  diam-diam tidak melakukan apa pun.
- **Setiap upload gambar wajib mengisi `blur_data_url`, `width`, `height`.** Pipeline-nya harus
  direplikasi persis: resize, strip EXIF, WebP quality 80, generate blur 16px. Situs customer
  me-render foto villa dengan blur placeholder dan dimensi tetap — baris yang lolos tanpa salah
  satu dari tiga kolom itu akan meng-crash halaman villa terkait.
- **Villa yang punya booking tidak bisa dihapus** (`bookings.stay_id` `on delete restrict`).
  Postgres akan melempar foreign-key error. Tangani sebagai aturan bisnis di UI (mis. tombol
  "Delete" disabled + tooltip), bukan sebagai bug yang perlu di-debug tiap kali muncul.
- **Perubahan tidak langsung terlihat customer** — situs customer di-prerender dan di-cache,
  saat ini hanya time-based sampai ~1 jam; webhook revalidasi belum dibangun. Ini desain:
  situs itu halaman marketing berat gambar untuk ribuan pengunjung, dan mematikan cache berarti
  menukar kecepatan mereka demi kesegaran satu admin. Jangan buka bug report untuk ini.
- **Mengubah `slug` mengubah URL publik villa.** Link yang sudah beredar akan rusak. Beri
  peringatan di UI edit, atau kunci field ini setelah villa dipublikasikan.
  ini setelah villa dipublikasikan.

## Stack

- **React 19 + TypeScript (strict)**, build tool **Vite 6** (`@vitejs/plugin-react-swc`).
  **Bukan Next.js** — repo ini adalah SPA murni, tidak ada server/SSR runtime sama sekali.
- **Routing**: `react-router-dom` v7, data router (`createBrowserRouter`/`RouterProvider`)
  didefinisikan di `src/App.tsx`.
- **Data fetching & cache**: `@tanstack/react-query` v5.
- **Styling**: `styled-components` v6 — **bukan Tailwind**, beda dari situs customer.
- **Form & validasi**: `react-hook-form` + `zod`.
- **Auth**: Supabase Auth, rute terproteksi dibungkus `ProtectedRoute`.

**Kenapa bukan Next.js App Router.** Ini sudah dipertimbangkan dan sengaja tidak dipakai:
admin panel ini internal, di belakang auth, tidak pernah diindeks — nilai jual utama App
Router (SSR/ISR, SEO, image optimization untuk pengunjung publik) tidak relevan di sini.
Migrasi berarti menulis ulang routing, pola fetching, dan `styled-components` (butuh
registry khusus di bawah React Server Components) untuk aplikasi yang sudah jalan, tanpa
manfaat fungsional. Jangan mengusulkan migrasi ke Next.js tanpa alasan baru yang konkret.

## Planning & Language

- When presenting a plan, summary, or explanation in chat, use everyday, common Indonesian language
  words. Avoid stiff, overly technical, or academic terms when a simpler word says the same
  thing.
- Don't make something that's already complex sound more complicated — break it into small,
  easy-to-follow steps instead of dense paragraphs.
- Write explanations clearly enough that someone else could follow them, or that I could
  re-read them later without losing context. Don't assume I'll remember the reasoning behind
  a decision.
- This only applies to conversational replies (plans, summaries, explanations in chat always indonesian absolutely).
  Code comments, docs, and markdown files always stay in English — see "Code Comments" below.

## Code Comments

- Comment on _why_, not _what_ — don't restate what the code already makes obvious.
  Avoid: `// increment counter` above `count++`
- Prioritize comments for:
    - Non-trivial or easily misunderstood business logic
    - Reasoning behind a technical choice, especially when there's a trade-off
      (e.g. why a Server Component was used instead of a Client Component)
    - Workarounds for library limitations/bugs — link the related issue if one exists
    - Important assumptions about data shape/format from an API or database
    - Side effects that aren't obvious from the function/variable name
- Don't comment every line — skip anything self-explanatory.
- Use JSDoc for functions, custom hooks, and components exported across files
  (params, return value, and a short usage example if needed).

## Struktur folder

Feature-based di bawah `src/`:

- `features/{authentication,bookings,check-in-out,dashboard,stays}` — masing-masing punya
  `components/`, `hooks/`, `types/`, sebagian `services/`. Layering di dalam tiap fitur selalu
  sama: `services/` (panggilan Supabase) → `hooks/` (pembungkus React Query) → `types/` (skema
  Zod, sekaligus sumber tipe TypeScript lewat `z.infer<>`) → `components/`.
- `pages/` — komponen halaman yang dipetakan router: `Dashboard`, `Stays`, `Bookings`,
  `Checkin`, `Account`, `Login`, `PageNotFound`.
- `ui/` — komponen generik dipakai lintas fitur (`Modal`, `Table`, `Menus`, `ProtectedRoute`,
  `StaffOnlyRoute`, `ErrorFallback`, dll).
- `services/` — hanya `apiSettings.ts`. Panggilan Supabase lain tinggal di `services/` milik
  fitur masing-masing, bukan di sini.
- `hooks/`, `shared/utils/`, `types/` — util dan state lintas fitur.
- `styles/` — global styles dan breakpoints.
- `data/` — data seed untuk pengembangan.
- `supabase/` — client (`supabase.ts`), `types/database.types.ts` hasil generate, dan migrasi.

## Environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` — ini **anon/publishable key**, bukan service role key. Ini keputusan
  final (bukan pertanyaan terbuka): wewenang tulis datang dari sesi staf yang login plus policy
  RLS, bukan dari key yang istimewa. Jangan pernah menggantinya dengan service role key.

Dibaca lewat `import.meta.env.*` (konvensi Vite — wajib prefix `VITE_` agar ter-expose ke
client bundle). Karena di-inline saat build, mengubah nilainya di Vercel butuh redeploy —
mengganti value saja tidak mengubah bundle yang sudah jadi.

## Testing & verifikasi sebelum menganggap selesai

**Belum ada test suite** — tidak ada vitest/jest/testing-library/cypress/playwright terpasang,
tidak ada file `*.test.ts(x)`. Yang tersedia:

- `npm run build` — `tsc -b && vite build`, dipakai sebagai pengecekan tipe.
- `npm run lint` — eslint.

Karena tidak ada test otomatis yang menjaga invariant database, perubahan tulis-ke-database
wajib diverifikasi manual di Supabase SQL Editor. Empat query berikut harus mengembalikan
**nol baris**:

```sql
-- 1. Baris gambar lengkap. Kurang satu kolom saja = halaman villa itu crash.
select stay_id, storage_path
from stay_images
where blur_data_url is null or width is null or height is null;

-- 2. Setiap villa punya cover (sort_order = 0).
select slug from stays s
where not exists (
    select 1 from stay_images i where i.stay_id = s.id and i.sort_order = 0
);

-- 3. Tidak ada villa tanpa gambar sama sekali — ini error, bukan sekadar tampil polos.
select s.slug from stays s
where not exists (select 1 from stay_images i where i.stay_id = s.id);

-- 4. Tidak ada `alt` kembar dalam satu villa.
select stay_id, alt, count(*)
from stay_images
group by stay_id, alt having count(*) > 1;
```

Dua query lagi yang **tidak** mengembalikan nol baris:

```sql
-- 5. Setiap villa dapat 6 amenity shared. shared_count harus 6 untuk tiap baris.
select s.slug, count(*) filter (where a.is_shared) as shared_count
from stays s
left join stay_amenities sa on sa.stay_id = s.id
left join amenities a on a.id = sa.amenity_id
group by s.slug order by shared_count;

-- 6. Jalankan dari sesi staff yang login (BUKAN SQL Editor, yang berjalan sebagai
--    service role dan selalu menjawab beda) untuk memastikan sesinya dikenali.
select exists (select 1 from public.staff where id = auth.uid()) as boleh_tulis;
```

Kalau `boleh_tulis` bernilai `false`, akun itu belum punya baris di `public.staff` dan setiap
INSERT dari sesinya akan ditolak. Ini penyebab paling mungkin dari "kenapa simpan villa selalu
gagal padahal datanya benar".

Untuk memastikan gambar yang diupload benar-benar bisa diakses publik, pakai `GET`, **bukan**
`curl -I` — Supabase Storage melayani HEAD lewat jalur berbeda yang selalu membalas `no-cache`
dan membuat objek yang sehat terlihat rusak.

## Kalau ragu soal wewenang atau skema

Jangan menebak. Batas wewenang di bagian "Aturan tegas" di atas adalah kontrak yang disepakati
dengan repo situs customer, bukan preferensi yang bisa dilonggarkan sepihak. Kalau sesuatu
tidak tercakup di sana — misalnya kolom baru yang sepertinya berguna untuk fitur admin — itu
artinya perlu perubahan skema di repo situs customer dulu, bukan sesuatu yang boleh ditambahkan
dari sini.
