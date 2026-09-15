# PRD — Sistem Pengelolaan Ibadah Idul Qurban

## Problem Statement
Bangun aplikasi manajemen ibadah qurban end-to-end untuk panitia masjid: pendaftaran shohibul, paket sapi (mandiri / patungan 1-7), pembayaran via Doit.id (dengan webhook callback status), distribusi realtime lewat QR Code + WebSocket, import Excel, export laporan XLSX & PDF.

## Tech Stack (per permintaan user)
- Frontend: React 18 + Vite + TailwindCSS (+ html5-qrcode, qrcode.react, axios)
- Backend: Go 1.22 + Fiber v2 + pgx + gofiber/websocket + excelize + gofpdf
- Database: PostgreSQL 16
- Infra: Docker + Docker Compose (3 service: db, backend, frontend/nginx)

## User Personas
- **Admin/Panitia**: login JWT, kelola paket sapi, daftarkan peserta, generate invoice, cetak QR untuk penerima, scan QR saat distribusi, unduh laporan.
- **Shohibul Qurban**: menerima link invoice Doit.id (dibuat panitia), membayar; status auto-sync via webhook.
- **Penerima Daging (mustahiq)**: menerima tiket QR fisik, ditukar saat pengambilan.

## Arsitektur & Skema DB
Skema 6 tabel: `users`, `paket_sapi`, `peserta`, `penerima_daging`, `distribusi`, `transaksi_doit` (audit log webhook). Detail lengkap di `docs/ERD.md`. Auto-migrated saat backend start.

## Implemented (Jan 2026 — v0.1)
- ✅ Auth JWT (register/login) + seed admin
- ✅ CRUD Paket Sapi, Peserta, Penerima
- ✅ Doit.id integration (client + webhook handler + HMAC signature verify + stub mode)
- ✅ Endpoint create invoice (`POST /api/peserta/:id/invoice`)
- ✅ Webhook callback (`POST /api/webhook/doit`) → update `status_bayar`, log ke `transaksi_doit`
- ✅ QR generation (per penerima) + QRScanner page (html5-qrcode)
- ✅ WebSocket hub broadcast event `distribusi.scan` → Dashboard realtime
- ✅ Import XLSX (peserta, penerima)
- ✅ Export XLSX (multi-sheet) & PDF (ringkasan)
- ✅ Dashboard: stats + live feed
- ✅ Dockerfile backend + frontend + docker-compose.yml

## Backlog / Next
- P1: Multi-tenant per masjid
- P1: Notifikasi WhatsApp / email saat status lunas (integrasi Twilio/Fonnte)
- P1: Sertifikat digital penerima daging (PDF per orang)
- P2: Role granular (bendahara vs koord distribusi)
- P2: Peta distribusi (geolokasi penerima)
- P2: Landing page publik untuk pendaftaran mandiri shohibul

## Cara Menjalankan
```bash
cd /app/qurban-system
docker compose up --build
```
Frontend: http://localhost:3000 · Backend: http://localhost:8080

Login default: `admin@qurban.local` / `admin123`

## Catatan Testing
Karena container Emergent tidak menyediakan Go/PostgreSQL/Docker native, aplikasi ini adalah **starter proyek siap `docker compose up`** di mesin lokal user. Semua kode telah ditulis lengkap dan konsisten (route ↔ handler ↔ frontend calls), lint-friendly. Verifikasi runtime dilakukan user di mesin sendiri.
