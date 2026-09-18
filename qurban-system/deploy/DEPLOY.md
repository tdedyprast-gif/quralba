# 🚀 Deployment Guide — Qurban System ke VPS Production

> **Arsitektur**: Cloudflare Tunnel (Zero Trust) → VPS → Docker Compose
> **Domain**: `quralba.dwijacode.my.id`
> **Stack**: Go 1.22 + Fiber | React 18 + Vite | PostgreSQL 16 | Docker + Compose

---

## 1. Prerequisites (di VPS)

Pastikan sudah terpasang:
- Docker & Docker Compose
- Git
- `cloudflared` (Cloudflare Tunnel daemon)

```bash
# Verifikasi
docker --version
docker compose version
git --version
cloudflared --version
```

---

## 2. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/<user>/<repo>.git qurban-system
cd qurban-system/qurban-system  # masuk ke folder aktif
```

> ⚠️ Pastikan berada di folder `qurban-system/qurban-system/` (bukan root repo).

---

## 3. Konfigurasi Environment

```bash
# Copy template environment production
cp .env.production .env

# Edit dengan nano/vim — GANTI semua nilai default!
nano .env
```

**Nilai yang WAJIB diganti:**

| Variable | Cara Generate | Contoh |
|----------|---------------|--------|
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` | `a3f7c...` |
| `JWT_SECRET` | `openssl rand -hex 64` | `8d2e1...` |
| `ADMIN_PASS` | Password kuat manual | (min 12 karakter, campuran) |

> ⚠️ **JANGAN** pakai nilai default dari template — itu hanya placeholder!

---

## 4. Build & Start Services

```bash
# Build semua image (backend, frontend, db)
docker compose -f docker-compose.prod.yml build

# Jalankan semua service
#   - db: PostgreSQL (internal network only)
#   - backend: Go API (internal network only, tidak expose ke publik)
#   - frontend: Nginx + React SPA (localhost:3000 saja)
docker compose -f docker-compose.prod.yml up -d

# Verifikasi semua container running
docker compose -f docker-compose.prod.yml ps
```

Output yang diharapkan:
```
NAME              STATUS
qurban_db         Up 5 seconds (healthy)
qurban_backend    Up 3 seconds
qurban_frontend   Up 2 seconds
```

---

## 5. Setup Cloudflare Tunnel

### 5a. Login & Create Tunnel

```bash
# Login ke Cloudflare (buka URL yang muncul di browser)
cloudflared tunnel login

# Buat tunnel baru
cloudflared tunnel create qurban-tunnel

# Output akan menampilkan Tunnel UUID, contoh:
# Tunnel credentials written to /root/.cloudflared/<UUID>.json
# ✅ Save UUID tersebut!
```

### 5b. Konfigurasi Tunnel

```bash
# Copy config file
sudo mkdir -p /root/.cloudflared
sudo cp deploy/cloudflared-config.yml /root/.cloudflared/config.yml

# Edit config — GANTI <TUNNEL_UUID> dengan UUID dari langkah 5a
sudo nano /root/.cloudflared/config.yml
```

Isi file `config.yml`:
```yaml
tunnel: <TUNNEL_UUID_YANG_ANDA_DAPATKAN>
credentials-file: /root/.cloudflared/<TUNNEL_UUID_YANG_ANDA_DAPATKAN>.json

ingress:
  - hostname: quralba.dwijacode.my.id
    service: http://localhost:3000
  - service: http_status:404
```

### 5c. Route DNS

```bash
# Arahkan domain ke tunnel
cloudflared tunnel route dns qurban-tunnel quralba.dwijacode.my.id
```

### 5d. Install sebagai Service (Auto-start)

```bash
# Copy systemd service
sudo cp deploy/qurban-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable & start
sudo systemctl enable qurban-tunnel
sudo systemctl start qurban-tunnel

# Cek status
sudo systemctl status qurban-tunnel
```

---

## 6. Verifikasi Deployment

### 6a. Cek Container

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### 6b. Cek Health Endpoints

```bash
# Dari VPS
 curl http://localhost:3000/api/health
# → {"status":"ok"}

# Dari internet (via Cloudflare Tunnel)
curl https://quralba.dwijacode.my.id/api/health
# → {"status":"ok"}
```

### 6c. Cek Landing Page & Paket Publik

```bash
curl -s https://quralba.dwijacode.my.id/api/public/paket | head -c 200
# → [{"id":"...","nama":"Paket Sapi",...}]
```

### 6d. Login Admin

Buka browser: `https://quralba.dwijacode.my.id/login`

Gunakan kredensial dari `.env` (`ADMIN_EMAIL` / `ADMIN_PASS`).

---

## 7. Update / Redeploy

```bash
cd /opt/qurban-system/qurban-system

# Pull perubahan terbaru
git pull origin main

# Rebuild & restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Cleanup image lama
docker image prune -f
```

---

## 8. Backup Database & Uploads

### Manual backup

```bash
# Backup database + uploads
./deploy/backup.sh

# Atau backup manual
docker exec qurban_db pg_dump -U <POSTGRES_USER> -d <POSTGRES_DB> | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Automated backup (cron)

```bash
# Setup cron job — backup setiap hari jam 2 pagi, retention 7 hari
sudo crontab -e

# Tambahkan baris:
0 2 * * * /opt/qurban-system/qurban-system/deploy/backup.sh 7 >> /var/log/qurban-backup.log 2>&1
```

Backup tersimpan di `/var/backups/qurban-system/`:
- `db_YYYYMMDD_HHMMSS.sql.gz` — dump PostgreSQL
- `uploads_YYYYMMDD_HHMMSS.tar.gz` — gambar paket & file uploads

---

## 9. GitHub Actions Auto-Deploy

Workflow `deploy.yml` sudah dikonfigurasi:

1. **Push ke `main`** → CI pass → Build image → Push ke GHCR → Deploy ke VPS via SSH
2. **Rolling restart**: backend dulu (health check) → frontend

**Secrets yang perlu di-set di GitHub:**

| Secret | Nilai |
|--------|-------|
| `DEPLOY_HOST` | IP VPS Anda |
| `DEPLOY_USER` | username SSH (biasanya `root`) |
| `DEPLOY_SSH_KEY` | Private key SSH (isi penuh, termasuk `-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `DEPLOY_PORT` | 22 (default, bisa dihapus kalau port standar) |
| `DEPLOY_PATH` | `/opt/qurban-system/qurban-system` |

**Cara set secret:**
GitHub repo → Settings → Secrets and variables → Actions → New repository secret

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `502 Bad Gateway` di browser | Cek `docker compose logs backend` — kemungkinan DB belum ready. Tunggu 10 detik lalu refresh. |
| Tunnel tidak connect | `sudo systemctl restart qurban-tunnel` + `sudo journalctl -u qurban-tunnel -f` |
| Gambar paket tidak muncul | Cek volume `qurban_uploads` ter-mount: `docker volume ls` |
| SSL error di browser | Cloudflare Tunnel handle SSL otomatis. Pastikan DNS record di Cloudflare sudah proxied (orange cloud). |

---

## 🛡️ Security Checklist

- [ ] `.env` tidak masuk Git (sudah di `.gitignore`)
- [ ] `JWT_SECRET` diganti dari default (min 64 hex chars)
- [ ] `ADMIN_PASS` password kuat (min 12 chars, campuran)
- [ ] `POSTGRES_PASSWORD` password kuat
- [ ] Backend tidak expose port ke publik (hanya internal network)
- [ ] Frontend hanya listen di `127.0.0.1:3000` (tidak 0.0.0.0)
- [ ] Cloudflare Tunnel aktif dan running sebagai systemd service
- [ ] Doit.id API key diganti dari sandbox ke production saat go-live
