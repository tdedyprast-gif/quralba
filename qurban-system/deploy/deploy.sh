#!/bin/bash
# ============================================
# deploy.sh — Automasi Deploy ke Production VPS
# ============================================
# Usage: ./deploy.sh
#
# Prasyarat:
#   - Berada di folder qurban-system/
#   - .env.production sudah dibuat dan diisi
#   - Docker & Docker Compose terpasang
#   - Git repo sudah di-clone

set -euo pipefail

# Warna output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo -e "${GREEN}🚀 Qurban System Production Deploy${NC}"
echo "================================================"
echo "Project: $PROJECT_DIR"
echo "Domain:  quralba.dwijacode.my.id"
echo ""

# ─── Step 1: Cek .env.production ───
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ ERROR: .env.production tidak ditemukan!${NC}"
    echo "   Copy dari template: cp .env.production.example .env.production"
    echo "   Lalu edit semua nilai placeholder."
    exit 1
fi

# Cek apakah masih ada placeholder
if grep -q "GANTI_DENGAN" .env.production; then
    echo -e "${YELLOW}⚠️  PERINGATAN: .env.production masih mengandung placeholder!${NC}"
    echo "   Silakan edit file tersebut dan ganti semua nilai default."
    grep -n "GANTI_DENGAN" .env.production | head -5
    read -p "Lanjutkan deploy? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deploy dibatalkan."
        exit 1
    fi
fi

echo -e "${GREEN}✅ .env.production OK${NC}"

# ─── Step 2: Git Pull (opsional) ───
read -p "Pull perubahan terbaru dari Git? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
    git pull origin main || true
fi

# ─── Step 3: Build Images ───
echo ""
echo -e "${YELLOW}🔨 Building production images...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache

# ─── Step 4: Start Services ───
echo ""
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose -f docker-compose.prod.yml up -d

# ─── Step 5: Wait for DB ───
echo ""
echo -e "${YELLOW}⏳ Waiting for database to be healthy...${NC}"
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml ps db | grep -q "healthy"; then
        echo -e "${GREEN}✅ Database is healthy${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# ─── Step 6: Health Check ───
echo ""
echo -e "${YELLOW}🏥 Health check...${NC}"

# Cek backend health (dari internal network via frontend container)
if docker compose -f docker-compose.prod.yml exec -T frontend wget -qO- http://backend:8004/api/health 2>/dev/null | grep -q "ok"; then
    echo -e "${GREEN}✅ Backend health: OK${NC}"
else
    echo -e "${RED}❌ Backend health: FAILED${NC}"
    echo "   Logs:"
    docker compose -f docker-compose.prod.yml logs --tail=20 backend
fi

# Cek frontend (dari host via localhost)
if curl -s http://localhost:3000/api/health 2>/dev/null | grep -q "ok"; then
    echo -e "${GREEN}✅ Frontend proxy: OK${NC}"
else
    echo -e "${RED}❌ Frontend proxy: FAILED${NC}"
    echo "   Logs:"
    docker compose -f docker-compose.prod.yml logs --tail=20 frontend
fi

# ─── Step 7: Status ───
echo ""
echo -e "${GREEN}📊 Container Status:${NC}"
docker compose -f docker-compose.prod.yml ps

# ─── Step 8: Cleanup ───
echo ""
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f

# ─── Step 9: Tunnel Check ───
echo ""
echo -e "${YELLOW}🌐 Cloudflare Tunnel Check:${NC}"
if systemctl is-active --quiet qurban-tunnel 2>/dev/null; then
    echo -e "${GREEN}✅ qurban-tunnel service is running${NC}"
else
    echo -e "${YELLOW}⚠️  qurban-tunnel service is NOT running${NC}"
    echo "   Start with: sudo systemctl start qurban-tunnel"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 Deploy selesai!${NC}"
echo ""
echo "Akses aplikasi: https://quralba.dwijacode.my.id"
echo "Health check:   curl https://quralba.dwijacode.my.id/api/health"
echo ""
echo -e "${YELLOW}Commands berguna:${NC}"
echo "  View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:      docker compose -f docker-compose.prod.yml restart"
echo "  Stop:         docker compose -f docker-compose.prod.yml down"
echo "  Backup DB:    ./backup-db.sh"
echo "  Tunnel logs:  sudo journalctl -u qurban-tunnel -f"
