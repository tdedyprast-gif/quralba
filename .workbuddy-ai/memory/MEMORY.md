# MEMORY.md — Project Quralba (Sistem Qurban)

## Stack
- **qurban-system/** = sistem produksi (Dockerized): Go 1.22 + Fiber v2 + PostgreSQL 16 (backend), React 18 + Vite 5 + Tailwind + Nginx (frontend).
- **backend/** (Python FastAPI + MongoDB) dan **frontend/** (React 19 CRA + CRACO) = legacy/prototype, TIDAK dipakai docker-compose.
- Docker Compose: `qurban-system/docker-compose.yml`. Port: frontend 3000 → Nginx (80), backend 8080, db 5432 (internal saja).

## Konvensi penting
- **Kredensial di `.env`** (bukan hardcoded). Selalu baca `.env` saat testing — user sudah mengkustomisasi POSTGRES_USER/POSTGRES_DB/ADMIN_PASS. `.env` masuk `.gitignore`.
- **Akses aplikasi**: http://localhost:3000 (frontend). Jangan akses :8080 di browser — itu API saja.
- **API call frontend pakai relative URL** (VITE_API_URL kosong) → lewat Nginx reverse proxy `/api/` dan `/ws/` ke backend. Jangan hardcode `http://localhost:8080` di kode frontend; pakai `?? ''` bukan `||`.
- **Skema DB idempotent** — `schemaSQL` di `internal/database/db.go` dijalankan tiap startup, jadi semua perubahan pakai `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.

## Role (5) — arsitektur akses
| Role | Tanggung jawab | Akses route |
|------|----------------|-------------|
| `admin` | Super User + validasi & kelola akun | semua |
| `bendahara` | Paket sapi + pencatatan pembayaran | /paket, /peserta, /pembayaran |
| `pembagian` | Data penerima + distribusi | /penerima, /distribusi, /import, /export |
| `peserta` | Shohibul qurban (self-service) | /akun (tagihan + riwayat bayar) |
| `penerima` | Penerima daging (self-service) | /akun (kartu QR) |

- Guard: `middleware.RequireRole(...)` dipasang setelah `JWTProtected()`. Daftar role valid ada di `allowedRoles` (`handlers/admin.go`).
- Alur pendaftaran: `POST /api/auth/register` (role peserta/penerima) → status `pending` → admin `POST /api/admin/users/:id/approve` → otomatis membuat record `peserta` / `penerima_daging` + link ke akun → status `active` → baru bisa login.
- Admin juga bisa buat akun langsung (`POST /api/admin/users`) — dipakai untuk panitia (admin/bendahara/pembagian) yang tidak bisa self-register.
- `PUT /api/admin/users/:id` — ubah nama/email/no_hp/alamat/role/status. Ganti role otomatis menautkan/melepas record lewat `ensurePesertaRecord()` / `ensurePenerimaRecord()` (idempotent). Admin dilarang menurunkan role dirinya sendiri.

## Status pembayaran
`belum_lunas` (terbayar 0) → `cicilan` (0 < terbayar < tagihan) → `lunas` (terbayar >= tagihan). Dihitung ulang otomatis oleh `recalcPeserta()` di `handlers/pembayaran.go`.

## Format import Excel penerima
Header (baris 1, urutan wajib): `kode | nama | alamat | kategori | no_hp | latitude | longitude`
- `nama` wajib; `kode` kosong → auto `PN-xxxx`; kode duplikat dilewati; `kategori` default `fakir`.
- Template bisa diunduh dari UI (tombol "Template Excel") atau `GET /api/import/template/penerima` — berisi 2 sheet: Penerima + Panduan.

## Build & test
- Go tidak ada di host — kompilasi lewat Docker: `docker run --rm -v "$PWD":/src -w /src golang:1.22-alpine sh -c "go mod tidy && CGO_ENABLED=0 go build -o /tmp/server ./cmd"`.
- Rebuild stack: `cd qurban-system && docker compose up -d --build`.
- CI: `.github/workflows/ci.yml` (build/test) + `deploy.yml` (GHCR + SSH).
