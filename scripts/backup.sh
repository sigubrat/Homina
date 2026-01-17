#!/bin/bash
# Database backup script for Homina
# Add to crontab for automated backups:
# 0 2 * * * /path/to/Homina/scripts/backup.sh >> /var/log/homina-backup.log 2>&1

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Load environment variables if .env exists
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$DATE] Starting database backup..."

# Database backup using docker exec
if docker ps --format '{{.Names}}' | grep -q "homina-db"; then
    docker exec homina-db pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/homina_$DATE.sql"
    
    # Compress the backup
    gzip "$BACKUP_DIR/homina_$DATE.sql"
    
    echo "[$DATE] Backup completed: homina_$DATE.sql.gz"
    
    # Calculate backup size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/homina_$DATE.sql.gz" | cut -f1)
    echo "[$DATE] Backup size: $BACKUP_SIZE"
else
    echo "[$DATE] ERROR: homina-db container is not running"
    exit 1
fi

# Cleanup old backups
echo "[$DATE] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "homina_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# List remaining backups
echo "[$DATE] Current backups:"
ls -lh "$BACKUP_DIR"/homina_*.sql.gz 2>/dev/null || echo "No backups found"

echo "[$DATE] Backup process completed"
