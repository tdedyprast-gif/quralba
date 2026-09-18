# ✅ Checklist Verifikasi Setelah Deploy

## Pre-Deploy

- [ ] `.env.production` sudah dibuat dari template
- [ ] `JWT_SECRET` diganti (bukan placeholder)
- [ ] `ADMIN_PASS` diganti (bukan placeholder)
- [ ] `POSTGRES_PASSWORD` diganti (bukan placeholder)
- [ ] Domain `quralba.dwijacode.my.id` sudah diarahkan ke Cloudflare Tunnel
- [ ] VPS sudah terpasang Docker, Docker Compose, Git, `cloudflared`

## Build & Start

- [ ] `docker compose -f docker-compose.prod.yml build` sukses tanpa error
- [ ] `docker compose -f docker-compose.prod.yml up -d` sukses
- [ ] Semua container `Up` dan `healthy`:
  ```bash
  docker compose -f docker-compose.prod.yml ps
  ```

## Endpoint Checks

- [ ] `curl https://quralba.dwijacode.my.id/api/health` → `{"status":"ok"}`
- [ ] `curl https://quralba.dwijacode.my.id/api/public/paket` → array paket
- [ ] `curl -I https://quralba.dwijacode.my.id/` → `200 OK`
- [ ] Landing page tampil di browser (gambar, paket, tombol Daftar)

## Functional Tests

- [ ] Registrasi akun baru (peserta) → sukses, status `pending`
- [ ] Login dengan akun `pending` → ditolak dengan pesan jelas
- [ ] Login admin → sukses
- [ ] Approve akun pending → sukses, peserta_id dibuat
- [ ] Login akun yang sudah di-approve → sukses
- [ ] Halaman `/akun` (peserta) → tampilkan paket yang bisa dipilih
- [ ] Pilih paket dari `/akun` → sukses, tagihan terisi
- [ ] Upload gambar paket (role bendahara) → sukses, gambar tampil
- [ ] Webhook Doit.id callable: `POST https://quralba.dwijacode.my.id/api/webhook/doit`

## Security

- [ ] Port backend (8004) tidak bisa diakses dari luar VPS
- [ ] Port frontend (3000) hanya listen di `127.0.0.1`
- [ ] Database port (5432) tidak expose ke host
- [ ] `.env` tidak ada di Git history
- [ ] JWT_SECRET unik dan kuat

## Cloudflare Tunnel

- [ ] `systemctl status qurban-tunnel` → `active (running)`
- [ ] `cloudflared tunnel info qurban-tunnel` → menampilkan tunnel info
- [ ] Domain `quralba.dwijacode.my.id` resolve ke Cloudflare (bukan IP VPS langsung)

## Backup

- [ ] Script `./backup-db.sh` bisa dijalankan
- [ ] File backup `.sql.gz` ter-generate
