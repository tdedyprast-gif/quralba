# MEMORY.md — Project Quralba (Sistem Qurban)

## Stack
- **qurban-system/** = sistem produksi (Dockerized): Go 1.22 + Fiber v2 + PostgreSQL 16 (backend), React 18 + Vite 5 + Tailwind + Nginx (frontend).
- **backend/** (Python FastAPI + MongoDB) dan **frontend/** (React 19 CRA + CRACO) = legacy/prototype, TIDAK dipakai docker-compose.
- Docker Compose: `qurban-system/docker-compose.yml`. Port: frontend 3000 → Nginx (80), backend 8080, db 5432 (internal saja).

## Konvensi penting
- **Kredensial di `.env`** (bukan hardcoded). Selalu baca `.env` saat testing — user sudah mengkustomisasi POSTGRES_USER/POSTGRES_DB/ADMIN_PASS. `.env` masuk `.gitignore`.
- **Akses aplikasi**: http://localhost:3000 (frontend). Jangan akses :8080 di browser — itu API saja.
- **API call frontend pakai relative URL** (VITE_API_URL kosong) → lewat Nginx reverse proxy `/api/` dan `/ws/` ke backend. Jangan hardcode `http://localhost:8080` di kode frontend; pakai `?? ''` bukan `||`. Termasuk untuk header callback (`X-Callback-Base`) — pakai `window.location.origin` apa adanya, jangan ganti port.
- **Skema DB idempotent** — `schemaSQL` di `internal/database/db.go` dijalankan tiap startup, jadi semua perubahan pakai `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.

## ⚠️ Guard role: JANGAN pakai Group("", middleware)
Di Fiber v2, `api.Group("", mw)` mendaftarkan `Use("/api", mw)` di app — middleware itu lalu berlaku untuk **semua** route `/api` yang didaftarkan sesudahnya (urutan registrasi menentukan). Ini pernah membuat `/api/admin/users` balas 403 "akses ditolak untuk role admin" hanya karena ada `Group("", RequireRole("peserta"))` di atasnya.
**Aturan**: pasang guard sebagai handler **per-route**:
```go
kasir := middleware.RequireRole("admin", "bendahara")
api.Get("/paket", kasir, handlers.ListPaket)
```
`cmd/main.go` sudah dikonversi penuh ke pola ini.

## Endpoint self-service paket (role peserta)
- `GET /api/saya/paket` → `{peserta_id, paket_id, paket:[{id,nama,jenis,harga_per_orang,max_shohibul,deskripsi,gambar,terisi,sisa,penuh,dipakai}]}`
- `POST /api/saya/paket` body `{paket_id}` → validasi kuota (peserta lain saja), set `total_bayar = harga_per_orang`, `recalcPeserta()`.
- `/api/saya` (role peserta) mengembalikan `paket_id` + `paket_nama`.
- Bendahara menetapkan/mengganti paket pendaftar lewat `PUT /api/peserta/:id` → tagihan ikut disesuaikan otomatis.
- Kuota (`max_shohibul`) ditegakkan di `CreatePeserta`, `UpdatePeserta`, `PilihPaketSaya`, dan saat admin approve (`paketHargaKuota()` di `admin.go`) → 409 "kuota paket sudah penuh".
- Kalau paket pilihan pendaftar sudah penuh saat approve, akun tetap diaktifkan tapi paket **tidak** ditetapkan dan respons berisi `paket_penuh: true` + `peringatan` (ditampilkan sebagai toast ⚠️ di `ValidasiUser.jsx`). Peserta memilih sendiri lewat "Akun Saya".

## ⚠️ Postgres: jangan bandingkan kolom uuid dengan string kosong
`WHERE id <> $2` dengan `$2 = ''` → Postgres gagal cast `''` ke `uuid` → query error. Kalau error-nya ditelan (`_ = ...Scan()`), variabel hitungan tetap 0 dan logika jadi salah (mis. kuota selalu dianggap tersedia). Pola aman (dipakai di `paketHargaKuota`): pisahkan query dengan/tanpa exclude, dan **fail closed** — kalau query hitung gagal, anggap sumber daya tidak tersedia.

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

## Routing frontend
- `/` = Landing publik (`pages/Landing.jsx`) — daftar paket qurban, klik paket → `/register?paket=<id>`, akses login di navbar + footer.
- `/dashboard` = Home berbasis role; route lain dibungkus `Layout` + `Protected` (role tak berhak → redirect `/dashboard`).

## Gambar paket (folder publik)
- Upload: `POST /api/upload/paket` → simpan `./uploads/paket/paket-<random>.{jpg|jpeg|png}`, balas `{"url":"/uploads/paket/..."}`. Validasi ekstensi + MIME + magic bytes + maks 5 MB.
- Serve: `app.Static("/uploads", "./uploads")` + Nginx `location /uploads/` → backend:8080. Volume `qurban_uploads:/app/uploads`; `backend/uploads/` & `uploads/` di `.gitignore`.

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
