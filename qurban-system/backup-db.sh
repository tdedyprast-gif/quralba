#!/bin/bash
# Backup PostgreSQL qurban database
# Usage: ./backup-db.sh  (jalankan manual atau via cron)
# Backup disimpan di ./backups/ dengan timestamp

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
CONTAINER="qurban_db"

# Baca kredensial dari .env
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  source "${SCRIPT_DIR}/.env"
  set +a
fi

DB_USER="${POSTGRES_USER:-qurban}"
DB_NAME="${POSTGRES_DB:-qurban}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="qurban_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "Backing up database '${DB_NAME}' from container '${CONTAINER}'..."

docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_DIR}/${FILENAME}"

# Simpan maksimal 7 backup terakhir
cd "${BACKUP_DIR}"
ls -t qurban_backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "Backup selesai: ${BACKUP_DIR}/${FILENAME}"
echo "Ukuran: $(du -h ${FILENAME} | cut -f1)"

echo ""
echo "Untuk restore:"
echo "  gunzip < ${BACKUP_DIR}/${FILENAME} | docker exec -i ${CONTAINER} psql -U ${DB_USER} ${DB_NAME}"
