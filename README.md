# Sagala Bimbel – Website CPNS/Kedinasan (React + Supabase)

Website lengkap dengan landing page, paket dalam bentuk card, testimoni alumni, video testimoni, informasi event, alur pembelian paket, autentikasi (login/daftar), serta dashboard admin untuk mengelola paket. Arsitektur mengacu referensi gaya AutoCPNS namun tetap sederhana saat dipakai sehari‑hari.

## Fitur Utama

- Navbar sederhana: Home, Paket, Kontak + tombol Masuk/Daftar.
- Landing/beranda: alumni dalam card (nama, foto, pernyataan, instansi), testimoni, video testimoni, info/event.
- Paket: data dinamis dari Supabase, detail paket, beli paket, checkout terintegrasi payment gateway Midtrans (Snap) via Supabase Edge Function.
- Autentikasi: Daftar dengan nama lengkap, panggilan, email, HP, provinsi, kota, password. Verifikasi email via Supabase.
- Pendaftaran: setelah daftar, user bisa beli paket, status pendaftaran tersimpan di tabel `enrollments`.
- Admin Dashboard: tambah/aktif/nonaktif paket, lihat perkembangan secara ringkas. Akses khusus profil dengan role `admin`.
- Footer sesuai versi sebelumnya, tidak diubah.

## Prasyarat

- Node.js 18+ dan npm
- Akun Supabase (project aktif)
- Supabase CLI (opsional tapi disarankan) – https://supabase.com/docs/guides/cli

## Konfigurasi Supabase

1) Hubungkan project ke kode ini

- Buka `src/integrations/supabase/client.ts` dan pastikan `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY (anon key)` milik project Anda.

2) Terapkan migrasi database

Pilihan A – via CLI (direkomendasikan):

```sh
supabase login                         # login ke Supabase
supabase link --project-ref <PROJECT_REF>
supabase db push                       # jalankan semua migrasi di folder supabase/migrations
```

Pilihan B – manual via SQL Editor di Supabase:

- Buka SQL Editor dan jalankan file berikut (urutkan sesuai timestamp):
  - `supabase/migrations/20250915052507_69082d21-81b6-4d0e-992e-3a182a417c7d.sql`
  - `supabase/migrations/20250915060000_admin_role_and_program_policies.sql`

3) Jadikan akun admin (opsional)

- Daftarkan akun Anda lewat website, lalu di Supabase SQL Editor jalankan:

```sql
update public.profiles set role = 'admin' where email = 'email-anda@example.com';
```

5) Akun Admin (disarankan)

- Buat user admin melalui Supabase Dashboard → Authentication → Users → Add user
  - Email: admin@sagalabimbel.com
  - Password (sementara, ganti setelah login): S4gala!2025
  - Centang “Email confirmed” (agar bisa langsung login)
- Lalu di SQL Editor jalankan:

```sql
update public.profiles set role = 'admin' where email = 'admin@sagalabimbel.com';
```

- Login ke website dengan email dan password di atas, kemudian segera ubah password dari menu pengaturan akun (atau via Reset Password) untuk keamanan produksi.

4) Verifikasi email

- Aktifkan verifikasi email di Authentication > Providers > Email. Supabase akan mengirim email verifikasi otomatis saat sign‑up.

## Menjalankan di VS Code (lokal)

```sh
npm install
npm run dev
```

- Buka alamat yang ditampilkan (biasanya `http://localhost:5173`).
- Uji alur:
  - Daftar akun (Auth dialog di navbar)
  - Buka bagian Paket dan klik “Beli Paket” → lihat detail → “Beli Sekarang” → (jika belum login diminta login/daftar) → pilih metode pembayaran → “Tandai Sudah Bayar” (simulasi) → paket aktif.
  - Akses Admin Dashboard di `/admin` (hanya untuk profil `role=admin`). Tambah paket baru, atur aktif/nonaktif.

## Integrasi Payment Gateway (Midtrans Snap – eWallet, VA Bank, QRIS)

Website ini kini menggunakan Midtrans (Snap) via Supabase Edge Functions, mencakup:

- E‑Wallet: GoPay, ShopeePay (DANA/OVO/LinkAja dapat melalui QRIS)
- Transfer Antar Bank (Virtual Account): BCA, BNI, BRI, Mandiri (echannel), Permata, CIMB
- QRIS (termasuk pembayaran via SeaBank melalui QRIS)

Alur yang diterapkan:

1) Client membuat `enrollments` (status pending)
2) Client memanggil Edge Function `midtrans-create-transaction` untuk membuat Snap transaction (mendapatkan `token`)
3) Frontend memuat script Snap dan memanggil `window.snap.pay(token)` (atau redirect `redirect_url`)
4) Midtrans mengirim notifikasi (webhook) ke `midtrans-webhook`
5) Fungsi webhook mengubah `enrollments.payment_status='paid'` dan `status='active'`

### File fungsi (serverless)

- `supabase/functions/midtrans-create-transaction/index.ts`: membuat transaksi Snap, menyimpan `order_id` ke `enrollments.payment_id`, mengembalikan `token`/`redirect_url`
- `supabase/functions/midtrans-webhook/index.ts`: memverifikasi `signature_key` dan update status pembayaran/aktivasi

### Langkah Setup Midtrans

1) Buat akun di Midtrans Dashboard (Sandbox terlebih dahulu)
2) Aktifkan channel:
   - E‑Wallet: GoPay, ShopeePay
   - Virtual Account: BCA, BNI, BRI, Permata, CIMB, Mandiri (via echannel)
   - QRIS
3) Catat Server Key (Sandbox/Production) dan Client Key (untuk Snap script di frontend)
4) Pasang Notification URL (webhook) di dashboard Midtrans ke fungsi `midtrans-webhook`
5) Set environment untuk fungsi:

```sh
supabase login
supabase link --project-ref <PROJECT_REF>

# Set secrets fungsi
supabase functions secrets set \
  SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> \
  MIDTRANS_SERVER_KEY=<MIDTRANS_SERVER_KEY> \
  MIDTRANS_IS_PRODUCTION=false

# Deploy fungsi Midtrans
supabase functions deploy midtrans-create-transaction
supabase functions deploy midtrans-webhook
```

### Konfigurasi Frontend (Snap)

- Tambahkan env Vite untuk Client Key Midtrans:

```env
VITE_MIDTRANS_CLIENT_KEY=<MIDTRANS_CLIENT_KEY_SANDBOX>
VITE_MIDTRANS_IS_PRODUCTION=false
```

- Frontend memuat script Snap on‑demand saat membayar, lalu memanggil `snap.pay(token)`:
  - Implementasi sudah ada di `src/components/sections/programs-section.tsx` (fungsi `loadSnap()` dan handler pembayaran)

### Wiring di Frontend

Pada `ProgramsSection`:

- Saat user klik “Lanjutkan Pembayaran”, kode akan:
  - Membuat baris `enrollments` jika belum ada
  - Memanggil `supabase.functions.invoke('midtrans-create-transaction', { body: { enrollmentId, programId, amount, preferred_method, customer } })`
  - Memuat Snap script dan memanggil `window.snap.pay(token)`
- Setelah user bayar, webhook mengubah status menjadi aktif (final source of truth), dan UI memberi notifikasi.

Preferensi metode (UI → Snap):

- Nilai `preferred_method` dari UI akan membatasi channel Snap (via `enabled_payments`):
  - `ewallet` → GoPay, ShopeePay
  - `bank` → BCA VA, BNI VA, BRI VA, Permata VA, CIMB VA, Mandiri (echannel)
  - `qris` → QRIS
  Mapping terdapat di `supabase/functions/midtrans-create-transaction/index.ts` pada fungsi `enabledPayments`.

### Penjelasan Channel

- E‑Wallet: DANA, OVO, LinkAja (aktifkan di Xendit Dashboard)
- VA Bank: BCA, BNI, BRI, Mandiri, Permata, CIMB, BSI (aktifkan di Dashboard)
- SeaBank: gunakan QRIS (user SeaBank dapat membayar dengan scan QRIS)
- QRIS: aktifkan di Dashboard untuk pembayaran instan dari berbagai aplikasi

### Testing End‑to‑End (Sandbox)

1) Jalankan lokal: `npm run dev`
2) Login/Daftar, pilih paket → Beli → Lanjutkan Pembayaran
3) Pada halaman Xendit invoice pilih metode (mis. DANA/OVO/LinkAja, VA BCA/BNI/BRI/Mandiri/Permata, QRIS)
4) Lakukan simulasi/sandbox payment sesuai panduan Xendit
5) Pastikan webhook berhasil (cek `enrollments.payment_status='paid'`, `status='active'` di Supabase)


## Build untuk Produksi

```sh
npm run build
```

Hasil build ada di folder `dist/`.

## Hosting di DomaiNesia

Pilihan A – Cloud/Shared Hosting (cPanel, statis)

- Website ini adalah SPA statis (React) yang terhubung ke Supabase, jadi cukup unggah hasil build ke hosting.
- Langkah:
  1. `npm run build`
  2. Masuk cPanel DomaiNesia → File Manager → `public_html/`
  3. Upload semua isi folder `dist/` ke `public_html/`
  4. Pastikan file `.htaccess` untuk SPA sudah ada. Repo ini menyertakan `public/.htaccess` yang akan ikut ter‑copy ke `dist/`. Isinya melakukan rewrite seluruh route ke `index.html`.
  5. Aktifkan SSL (AutoSSL) dari cPanel.

Pilihan B – VPS (Node/PM2 + Nginx) jika Anda menambahkan backend sendiri

- Setup ringkas:
  1. SSH ke VPS, install Node.js LTS dan Nginx
  2. Clone repo, `npm ci && npm run build`
  3. Konfigurasi Nginx untuk serve folder `dist/` sebagai static site (atau reverse proxy ke Node jika punya server)
  4. Pasang SSL dengan Certbot

DNS

- Arahkan domain ke IP hosting/VPS via A record di panel domain.

## Catatan

- Role admin diatur pada kolom `profiles.role`. Secara default `user`. Gunakan query SQL di atas untuk mengubah jadi `admin`.
- Pembayaran masih simulasi. Integrasi gateway membutuhkan key rahasia di sisi server/Edge Function.
- Email verifikasi dihandle otomatis oleh Supabase. Untuk notifikasi tambahan (kirim struk/paket via email/WA) gunakan webhook/Edge Function atau layanan email pihak ketiga.

## Teknologi

- Vite + React + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres/RLS)
