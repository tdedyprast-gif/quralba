# Sistem Pengelolaan Ibadah Idul Qurban

Aplikasi manajemen qurban end-to-end: pendaftaran shohibul, paket sapi (mandiri / patungan 1-7), pembayaran via **Doit.id** (dengan Webhook callback), distribusi realtime via **QR Code + WebSocket**, import Excel, dan export laporan **XLSX + PDF**.

## 🧱 Tech Stack

| Layer         | Tech                                   |
|---------------|----------------------------------------|
| Frontend      | React 18 + Vite + TailwindCSS + html5-qrcode + qrcode.react |
| Backend       | Golang 1.22 + Fiber v2 + pgx + gofiber/websocket + excelize + gofpdf |
| Database      | PostgreSQL 16                          |
| Deployment    | Docker + Docker Compose                |

---

## 🚀 Menjalankan Proyek

Pastikan Anda punya **Docker** dan **Docker Compose** terpasang.

```bash
cd qurban-system
docker compose up --build
```

Aplikasi akan berjalan di:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api/health
- **PostgreSQL**: `localhost:5432` (user: `qurban`, pass: `qurban`)

Login default panitia:
```
Email    : admin@qurban.local
Password : admin123
```

---

## 📂 Struktur Folder

```
qurban-system/
├─ backend/                    # Go + Fiber
│  ├─ cmd/main.go
│  ├─ internal/
│  │   ├─ config/              # Env loader
│  │   ├─ database/            # Postgres + migrations + seed
│  │   ├─ models/              # Struct models
│  │   ├─ middleware/          # JWT auth guard
│  │   ├─ handlers/            # HTTP handlers (auth, peserta, paket, penerima,
│  │   │                       #                distribusi, webhook doit, import, export)
│  │   ├─ services/            # Klien Doit.id + verifikasi signature
│  │   ├─ ws/                  # Hub WebSocket (broadcast realtime)
│  │   └─ utils/               # JWT, bcrypt
│  ├─ Dockerfile
│  └─ .env.example
├─ frontend/                   # React + Vite + Tailwind
│  ├─ src/
│  │   ├─ pages/               # Login, Dashboard, Paket, Peserta, Penerima,
│  │   │                       # Distribusi, QRScanner, Reports
│  │   ├─ components/Layout.jsx
│  │   ├─ context/AuthContext.jsx
│  │   ├─ services/api.js      # axios + WS URL helper
│  │   └─ App.jsx / main.jsx
│  ├─ Dockerfile + nginx.conf
│  └─ .env.example
├─ docs/ERD.md                 # Skema DB + relasi
└─ docker-compose.yml
```

---

## 🗄️ Database (ringkas)

Skema lengkap ada di `docs/ERD.md`. Enam tabel utama:

- **users** — panitia (login JWT, role `admin`/`panitia`)
- **paket_sapi** — jenis paket (sapi_penuh, patungan_1_7, mandiri) + harga
- **peserta** — shohibul qurban; menyimpan `doit_invoice_id`, `doit_invoice_url`, `status_bayar`
- **penerima_daging** — mustahiq; setiap orang punya `qr_token` unik
- **distribusi** — histori pemindaian QR (siapa & kapan diambil)
- **transaksi_doit** — audit log semua event webhook Doit.id (raw payload JSONB)

Auto-migrated saat backend pertama start (lihat `backend/internal/database/db.go`).

---

## 💳 Integrasi Doit.id

### Membuat tagihan
`POST /api/peserta/:id/invoice` → memanggil `services.CreateInvoice` yang POST ke
`{DOIT_BASE_URL}/invoices` dengan header `Authorization: Bearer {DOIT_API_KEY}`.

**Mode Stub**: bila `DOIT_API_KEY=SANDBOX_KEY_REPLACE_ME` (default), tidak ada
panggilan HTTP nyata — respons dummy dikembalikan agar frontend bisa dites end-to-end.
Ganti dengan key produksi Anda di `.env` / `docker-compose.yml`.

### Webhook callback
Endpoint public: `POST /api/webhook/doit`

Handler (`internal/handlers/webhook.go`):
1. Baca raw body & header `X-Doit-Signature`
2. Verifikasi HMAC-SHA256 dengan `DOIT_WEBHOOK_SECRET` (fungsi `services.VerifyWebhookSignature`)
3. Parse payload → cari peserta berdasarkan `external_id` (UUID) atau `doit_invoice_id`
4. Log ke tabel `transaksi_doit` (raw payload JSONB — audit trail)
5. Update `peserta.status_bayar` berdasarkan field `status`:
   - `PAID`/`SETTLED` → `lunas`
   - `PARTIAL` → `cicilan`
   - `EXPIRED`/`FAILED` → `belum_lunas`

Contoh payload masuk yang di-handle:
```json
{
  "event": "invoice.paid",
  "id": "inv_xxx",
  "external_id": "<peserta_uuid>",
  "status": "PAID",
  "amount": 3500000,
  "paid_amount": 3500000,
  "timestamp": "2026-05-01T10:00:00Z"
}
```

> **Catatan**: sesuaikan nama field & skema signature dengan dokumentasi resmi Doit.id yang Anda miliki. Struktur `DoitInvoiceRequest/Response` di `internal/services/doit.go` sudah didokumentasi dengan komentar.

---

## 📷 QR Code & WebSocket Realtime

**Panitia scan** (halaman `/scan` — `pages/QRScanner.jsx`):
- Menggunakan `html5-qrcode` untuk membuka kamera & decode
- Kirim `POST /api/distribusi/scan` dengan `{ qr_value }`
- Backend memvalidasi `qr_token`, insert ke tabel `distribusi`, lalu:

```go
hub.BroadcastJSON("distribusi.scan", payload)
```

**Dashboard** subscribe ke `ws://<host>/ws/distribusi`:
- Setiap event `distribusi.scan` → stats direfresh & aktivitas realtime muncul.

Implementasi hub: `internal/ws/hub.go` (channel-based pub/sub, thread-safe).

---

## 📥 Import Excel

Endpoint (multipart `file`):
- `POST /api/import/peserta` — header: `nama, no_hp, alamat, email, paket_nama`
- `POST /api/import/penerima` — header: `kode, nama, alamat, kategori`

Menggunakan `github.com/xuri/excelize/v2`. Lihat `handlers/importer.go`.

## 📤 Export Laporan
- `GET /api/export/rekap.xlsx` — multi-sheet: Peserta + Distribusi (excelize)
- `GET /api/export/rekap.pdf` — ringkasan + tabel peserta (gofpdf)

---

## 🔐 Autentikasi

JWT HS256 sederhana:
- `POST /api/auth/register` — daftar panitia baru
- `POST /api/auth/login` — dapatkan token
- Semua endpoint `/api/*` (kecuali auth & webhook) dilindungi middleware `JWTProtected`

---

## 🧪 Uji Cepat

```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qurban.local","password":"admin123"}'

# Simulasi webhook Doit.id (tanpa signature dev-mode)
curl -X POST http://localhost:8080/api/webhook/doit \
  -H "Content-Type: application/json" \
  -d '{"event":"invoice.paid","id":"inv_test","external_id":"<peserta_uuid>","status":"PAID","amount":3500000,"paid_amount":3500000}'
```

---

## 🛣️ Roadmap

- Multi-tenant (per masjid / DKM)
- Notifikasi WhatsApp saat status lunas
- Sertifikat digital penerima daging
- Peran granular (bendahara, koord. distribusi)

---

MIT © 2026 — Sistem Qurban Starter Kit
