#!/usr/bin/env bash
# Halaqtna — one compressed dump of the whole database, keeping the newest 14.
#
#   bash scripts/backup_db.sh                # by hand
#   0 2 * * *  cd /home/<user>/Halaqatna_app && bash scripts/backup_db.sh >> backups/backup.log 2>&1   # cron
#
# The dumps hold every student's name and guardian number: they live in backups/ (not in git,
# readable by the owner only) and any copy taken off the server must be treated the same way.
# A backup that stays on the one server it protects is not a backup. Copy the newest one home
# regularly — see docs/DEPLOY_AR.md.
#
# Restore (docker/.env holds DB_ROOT_PASSWORD):
#   set -a; . docker/.env; set +a
#   gunzip -c backups/<file>.sql.gz | (cd docker && docker compose exec -T -e MYSQL_PWD="$DB_ROOT_PASSWORD" db mysql -uroot halaqtna)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$ROOT/docker/.env" ] && { set -a; . "$ROOT/docker/.env"; set +a; }
: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD is not set (docker/.env, written by scripts/prod_init.sh)}"

umask 077
mkdir -p "$ROOT/backups"
FILE="$ROOT/backups/halaqtna-$(date +%Y%m%d-%H%M%S).sql.gz"
cd "$ROOT/docker"

# MYSQL_PWD keeps the password out of the process list. --single-transaction dumps a consistent
# snapshot without locking the tables while teachers are saving sessions.
docker compose exec -T -e MYSQL_PWD="$DB_ROOT_PASSWORD" db \
  mysqldump -uroot --single-transaction --routines --no-tablespaces halaqtna | gzip > "$FILE.partial"

# A dump that is only a gzip header means mysqldump failed; do not keep it as if it were a backup.
[ "$(stat -c %s "$FILE.partial")" -gt 1000 ] || { rm -f "$FILE.partial"; echo "Backup failed: the dump is empty." >&2; exit 1; }
mv "$FILE.partial" "$FILE"
echo "$(date -Is) wrote $FILE ($(du -h "$FILE" | cut -f1))"

ls -1t "$ROOT"/backups/halaqtna-*.sql.gz | tail -n +15 | xargs -r rm --
