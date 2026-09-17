# Sistem Pengelolaan Ibadah Idul Qurban

Aplikasi manajemen qurban end-to-end: **landing page publik** dengan katalog paket, **pendaftaran mandiri** shohibul & penerima dengan validasi panitia, pengelolaan **paket sapi** (mandiri / patungan 1-7) lengkap dengan gambar, **pencatatan pembayaran** (manual + invoice **Doit.id** dengan webhook), **distribusi realtime** via QR Code + WebSocket, import Excel, dan export laporan **XLSX + PDF**.

## 🧱 Tech Stack

| Layer         | Tech                                   |
|---------------|----------------------------------------|
| Frontend      | React 18 + Vite + TailwindCSS + html5-qrcode + qrcode.react |
| Backend       | Golang 1.22 + Fiber v2 + pgx + gofiber/websocket + excelize + gofpdf |
| Database      | PostgreSQL 16                          |
| Deployment    | Docker + Docker Compose + Nginx (reverse proxy) |

---

## 🚀 Menjalankan Proyek

Pastikan Anda punya **Docker** dan **Docker Compose** terpasang.

```bash
cd qurban-system
cp .env.example .env      # lalu sesuaikan kredensial
docker compose up --build
```

Aplikasi berjalan di:
- **Aplikasi (frontend)**: http://localhost:3000 ← **buka ini di browser**
- **Backend API**: http://localhost:8080/api/health — khusus API/testing, jangan dibuka sebagai aplikasi
- **PostgreSQL**: hanya di jaringan internal Docker (tidak dibuka ke host)

> Frontend memanggil API lewat **relative URL** melalui Nginx reverse proxy (`/api/`, `/ws/`, `/uploads/`).
> Karena itu `VITE_API_URL` sengaja **dibiarkan kosong** di `.env`.

Kredensial admin diambil dari `.env` (`ADMIN_EMAIL` / `ADMIN_PASS`); akun admin dibuat otomatis saat backend pertama kali start.

---

## 👥 Role & Alur Akses

Lima role dengan hak akses berbeda:

| Role | Tanggung jawab | Halaman |
|------|----------------|---------|
| `admin` | Super User + validasi & kelola akun | semua halaman |
| `bendahara` | Paket sapi, peserta, pencatatan pembayaran | `/bendahara` (3 tab), `/paket`, `/peserta` |
| `pembagian` | Data penerima + distribusi | `/pembagian`, `/penerima`, `/distribusi`, `/scan`, `/peta`, `/laporan` |
| `peserta` | Shohibul qurban (self-service) | `/akun` — pilih paket, tagihan, riwayat bayar |
| `penerima` | Penerima daging (self-service) | `/akun` — kartu QR pengambilan |

### Alur pendaftaran

```
Landing page → pilih paket → /register?paket=<id>
   → akun dibuat dengan status `pending`
   → admin menyetujui di /validasi
   → otomatis dibuat record peserta/penerima + ditautkan ke akun
   → status `active` → baru bisa login
```

- Akun `pending` / `rejected` **tidak bisa login** (ditolak dengan pesan yang jelas).
- Panitia (`admin`/`bendahara`/`pembagian`) tidak bisa self-register — dibuat admin lewat **Validasi & Kelola Akun**.
- Ganti role lewat halaman validasi otomatis menautkan/melepas record terkait (idempotent).

### Pemilihan paket

| Siapa | Bagaimana |
|-------|-----------|
| Calon peserta (belum punya akun) | Pilih paket di landing page → terbawa ke form pendaftaran |
| Peserta (sudah login) | Menu **Akun Saya** → kartu "Pendaftaran Paket Qurban" → tombol **Daftar Paket Ini** / **Ganti Paket** |
| Panitia bendahara | Tab **Pendaftar Qurban** → dropdown paket inline di tabel, atau modal Edit |

Kuota (`max_shohibul`) ditegakkan di semua jalur. Kalau paket pilihan pendaftar sudah penuh saat
admin menyetujui, akun tetap diaktifkan tetapi paket **tidak** ditetapkan dan admin menerima
peringatan — peserta tinggal memilih paket lain dari **Akun Saya**.

### Status pembayaran

`belum_lunas` (terbayar 0) → `cicilan` (0 < terbayar < tagihan) → `lunas` (terbayar ≥ tagihan).
Dihitung ulang otomatis setiap ada perubahan pembayaran atau perubahan paket.

---

## 📂 Struktur Folder

```
qurban-system/
├─ backend/                    # Go + Fiber
│  ├─ cmd/main.go              # definisi route + guard role
│  ├─ internal/
│  │   ├─ config/              # Env loader
│  │   ├─ database/            # Postgres + migrations + seed
│  │   ├─ models/              # Struct models
│  │   ├─ middleware/          # JWTProtected + RequireRole
│  │   ├─ handlers/            # auth, admin, saya, paket, peserta, pembayaran,
│  │   │                       # penerima, upload, distribusi, webhook, import, export
│  │   ├─ services/            # Klien Doit.id + verifikasi signature
│  │   ├─ ws/                  # Hub WebSocket (broadcast realtime)
│  │   └─ utils/               # JWT, bcrypt
│  ├─ uploads/paket/           # Gambar paket (volume, disajikan publik)
│  └─ Dockerfile
├─ frontend/                   # React + Vite + Tailwind
│  ├─ src/
│  │   ├─ pages/               # Landing, Login, Register, Dashboard, AkunSaya,
│  │   │                       # ValidasiUser, Bendahara, Paket, Peserta,
│  │   │                       # Pembagian, Penerima, Distribusi, QRScanner, Peta, Reports
│  │   ├─ components/Layout.jsx
│  │   ├─ context/AuthContext.jsx
│  │   ├─ services/api.js      # axios + WS URL helper
│  │   └─ App.jsx / main.jsx
│  ├─ Dockerfile + nginx.conf
│  └─ .env.example
├─ docs/ERD.md                 # Skema DB + relasi
├─ docker-compose.yml
└─ docker-compose.prod.yml     # override untuk image GHCR
```

---

## 🗄️ Database (ringkas)

- **users** — akun & role; menyimpan `status` (pending/active/rejected), `no_hp`, `alamat`,
  `paket_id` (pilihan saat mendaftar), `peserta_id`/`penerima_id` (tautan ke record)
- **paket_sapi** — jenis paket (sapi_penuh, patungan_1_7, mandiri), harga, `max_shohibul`, `gambar`
- **peserta** — shohibul qurban; `paket_id`, `slot_ke`, `total_bayar`, `total_terbayar`,
  `status_bayar`, `doit_invoice_id`, `doit_invoice_url`
- **penerima_daging** — mustahiq; setiap orang punya `kode` (PN-xxxx) + `qr_token` unik
- **pembayaran** — catatan setoran (tunai/transfer/qris/doit) + petugas
- **distribusi** — histori pemindaian QR (siapa & kapan diambil)
- **transaksi_doit** — audit log semua event webhook Doit.id (raw payload JSONB)

Skema di-`schemaSQL` idempotent di `backend/internal/database/db.go` dan dijalankan setiap startup,
jadi semua perubahan memakai `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.

---

## 🖼️ Gambar Paket (folder publik)

- Upload: `POST /api/upload/paket` (multipart `file`) → disimpan ke `./uploads/paket/paket-<random>.{jpg|jpeg|png}`
- Validasi berlapis: ekstensi → MIME → **magic bytes** (JPEG `FF D8 FF`, PNG `89 50 4E 47`) → maks 5 MB
- Disajikan publik lewat `app.Static("/uploads", ...)` + Nginx `location /uploads/`
- Persisten karena memakai Docker volume `qurban_uploads`

---

## 💳 Integrasi Doit.id

### Membuat tagihan
`POST /api/peserta/:id/invoice` → memanggil `services.CreateInvoice` yang POST ke
`{DOIT_BASE_URL}/invoices` dengan header `Authorization: Bearer {DOIT_API_KEY}`.

**Mode Stub**: bila `DOIT_API_KEY=SANDBOX_KEY_REPLACE_ME` (default), tidak ada
panggilan HTTP nyata — respons dummy dikembalikan agar frontend bisa dites end-to-end.

### Webhook callback
Endpoint public: `POST /api/webhook/doit`

Handler (`internal/handlers/webhook.go`):
1. Baca raw body & header `X-Doit-Signature`
2. Verifikasi HMAC-SHA256 dengan `DOIT_WEBHOOK_SECRET`
3. Parse payload → cari peserta berdasarkan `external_id` (UUID) atau `doit_invoice_id`
4. Log ke tabel `transaksi_doit` (audit trail)
5. Update `peserta.status_bayar`: `PAID`/`SETTLED` → `lunas`, `PARTIAL` → `cicilan`, `EXPIRED`/`FAILED` → `belum_lunas`

> **Catatan**: sesuaikan nama field & skema signature dengan dokumentasi resmi Doit.id yang Anda miliki.

---

## 📷 QR Code & WebSocket Realtime

**Panitia scan** (halaman `/scan` — `pages/QRScanner.jsx`):
- `html5-qrcode` membuka kamera & decode → `POST /api/distribusi/scan` dengan `{ qr_value }`
- Backend memvalidasi `qr_token`, insert ke tabel `distribusi`, lalu `hub.BroadcastJSON("distribusi.scan", payload)`
- QR yang sama di-scan dua kali → **409** (sudah pernah diambil)

**Dashboard** subscribe ke `ws://<host>/ws/distribusi` untuk update realtime.

---

## 📥 Import Excel

Endpoint (multipart `file`):

| Endpoint | Header (baris 1, urutan wajib) |
|----------|-------------------------------|
| `POST /api/import/penerima` | `kode \| nama \| alamat \| kategori \| no_hp \| latitude \| longitude` |
| `POST /api/import/peserta` | `nama \| no_hp \| alamat \| email \| paket_nama` |

Aturan import penerima:
- `nama` wajib; baris tanpa nama dilewati
- `kode` kosong → dibuat otomatis `PN-xxxx`; kode yang sudah ada **dilewati**
- `kategori` default `fakir`
- Respons berisi ringkasan `inserted` / `skipped` / `failed` + contoh error

Template siap pakai (2 sheet: Penerima + Panduan):
`GET /api/import/template/penerima` — juga tersedia lewat tombol **Template Excel** di UI.

## 📤 Export Laporan
- `GET /api/export/rekap.xlsx` — multi-sheet: Peserta + Distribusi (excelize)
- `GET /api/export/rekap.pdf` — ringkasan + tabel peserta (gofpdf)

---

## 🔐 Autentikasi & Otorisasi

JWT HS256:
- `POST /api/auth/register` — pendaftaran mandiri role `peserta` / `penerima` (status `pending`)
- `POST /api/auth/login` — dapatkan token; akun `pending`/`rejected` ditolak
- Semua endpoint `/api/*` (kecuali auth, paket publik, uploads, webhook) dilindungi `JWTProtected`
- Guard role dipasang **per-route** dengan `middleware.RequireRole(...)`

> ⚠️ **Jangan** memakai `api.Group("", middleware.RequireRole(...))`. Di Fiber v2, `Group` dengan
> prefix kosong mendaftarkan `Use("/api", ...)` yang berlaku lintas route dan bergantung urutan
> registrasi — pernah membuat `/api/admin/users` balas 403 untuk admin.

---

## 🧪 Uji Cepat

```bash
# Health
curl http://localhost:3000/api/health

# Login admin (ambil kredensial dari .env)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qurban.local","password":"<ADMIN_PASS>"}'

# Katalog paket publik (dipakai landing page)
curl http://localhost:3000/api/public/paket

# Simulasi webhook Doit.id
curl -X POST http://localhost:3000/api/webhook/doit \
  -H "Content-Type: application/json" \
  -d '{"event":"invoice.paid","id":"inv_test","external_id":"<peserta_uuid>","status":"PAID","amount":3500000,"paid_amount":3500000}'
```

Compile backend tanpa Go di host (lewat Docker):

```bash
docker run --rm -v "$PWD/backend":/src -w /src golang:1.22-alpine \
  sh -c "go mod tidy && CGO_ENABLED=0 go build -o /tmp/server ./cmd"
```

---

## 🛣️ Roadmap

- Multi-tenant (per masjid / DKM)
- Notifikasi WhatsApp saat status lunas
- Sertifikat digital penerima daging
- Pembayaran online langsung dari halaman Akun Saya

---

MIT © 2026 — Sistem Qurban Starter Kit
