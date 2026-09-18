#!/bin/bash
# ============================================
# backup.sh — Backup Database & Uploads
# ============================================
# Usage: ./backup.sh [retention_days]
# Default retention: 7 hari
#
# Setup cron (jalankan setiap hari jam 2 pagi):
#   0 2 * * * /opt/qurban-system/qurban-system/deploy/backup.sh >> /var/log/qurban-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Config
RETENTION_DAYS="${1:-7}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/qurban-system}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DB="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"
BACKUP_UPLOADS="$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"

# Load environment variables
set -a
source .env.production
set +a

mkdir -p "$BACKUP_DIR"

echo "=== Qurban System Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Retention: $RETENTION_DAYS days"
echo ""

# ─── Backup Database ───
echo "📦 Backing up database..."
docker exec qurban_db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_DB"

DB_SIZE=$(du -h "$BACKUP_DB" | cut -f1)
echo "   Database: $BACKUP_DB ($DB_SIZE)"

# ─── Backup Uploads ───
echo "📦 Backing up uploads..."
docker run --rm \
  -v qurban_uploads:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:latest \
  tar czf "/backup/uploads_$TIMESTAMP.tar.gz" -C /data .

UPLOADS_SIZE=$(du -h "$BACKUP_UPLOADS" | cut -f1)
echo "   Uploads:  $BACKUP_UPLOADS ($UPLOADS_SIZE)"

# ─── Cleanup old backups ───
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# ─── Summary ───
echo ""
echo "=== Backup Complete ==="
echo "Files in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" | tail -5
echo ""
echo "Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
