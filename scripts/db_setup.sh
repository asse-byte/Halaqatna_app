#!/usr/bin/env bash
# Halaqtna (CPIT-499) — fresh database.
#
#   migrate as the DB admin  ->  apply the least-privilege grants  ->  seed demo data
#
# The API never migrates as itself: it runs as `halaqtna_api`, which by design has no
# UPDATE/DELETE grant on audit_log or xp_ledger (rule 4) and so cannot alter schema.
#
# Usage:
#   bash scripts/db_setup.sh                     # local MySQL on 127.0.0.1:3306
#   DB_HOST=db GRANT_HOST='%' bash scripts/db_setup.sh    # inside Docker Compose
#
# Override any of these:
#   DB_HOST DB_PORT DB_NAME GRANT_HOST
#   DB_ADMIN_USER DB_ADMIN_PASSWORD DB_ROOT_USER DB_ROOT_PASSWORD
#   API_DB_PASSWORD ML_DB_PASSWORD MYSQL_CLIENT
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-halaqtna}"
# Host part of the grants: '127.0.0.1' for a local server, '%' when api/ml are other containers.
GRANT_HOST="${GRANT_HOST:-127.0.0.1}"

DB_ROOT_USER="${DB_ROOT_USER:-root}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-}"
DB_ADMIN_USER="${DB_ADMIN_USER:-halaqtna_admin}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:?set DB_ADMIN_PASSWORD}"
API_DB_PASSWORD="${API_DB_PASSWORD:?set API_DB_PASSWORD (must match DB_PASSWORD in api/.env)}"
ML_DB_PASSWORD="${ML_DB_PASSWORD:?set ML_DB_PASSWORD (must match ML_DATABASE_URL)}"

# `mysql` on MySQL 8, `mariadb` on a MariaDB host.
MYSQL_CLIENT="${MYSQL_CLIENT:-mysql}"
command -v "$MYSQL_CLIENT" >/dev/null || { echo "'$MYSQL_CLIENT' not found; set MYSQL_CLIENT" >&2; exit 1; }

root_sql() { "$MYSQL_CLIENT" --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ROOT_USER" ${DB_ROOT_PASSWORD:+--password="$DB_ROOT_PASSWORD"} "$@"; }

echo "==> creating database and users on $DB_HOST:$DB_PORT (grant host '$GRANT_HOST')"
root_sql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_ADMIN_USER}'@'${GRANT_HOST}' IDENTIFIED BY '${DB_ADMIN_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_ADMIN_USER}'@'${GRANT_HOST}';
CREATE USER IF NOT EXISTS 'halaqtna_api'@'${GRANT_HOST}' IDENTIFIED BY '${API_DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'halaqtna_ml'@'${GRANT_HOST}' IDENTIFIED BY '${ML_DB_PASSWORD}';
FLUSH PRIVILEGES;
SQL

echo "==> migrating as ${DB_ADMIN_USER} (§2 dependency order)"
cd "$REPO_ROOT/api"
DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_DATABASE="$DB_NAME" \
  DB_USERNAME="$DB_ADMIN_USER" DB_PASSWORD="$DB_ADMIN_PASSWORD" \
  php artisan migrate:fresh --force

echo "==> applying least-privilege grants (rule 4: audit_log and xp_ledger stay append-only)"
sed "s/__HOST__/${GRANT_HOST}/g" "$REPO_ROOT/scripts/db_grants.sql" | root_sql "$DB_NAME"

echo "==> seeding reference data and demo circles"
DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_DATABASE="$DB_NAME" \
  DB_USERNAME="$DB_ADMIN_USER" DB_PASSWORD="$DB_ADMIN_PASSWORD" \
  php artisan db:seed --force

echo "==> verifying the append-only guarantee"
root_sql -N -B -e "SHOW GRANTS FOR 'halaqtna_api'@'${GRANT_HOST}';" \
  | grep -E "ON \`?${DB_NAME}\`?\.\`?(audit_log|xp_ledger)\`?" \
  | grep -qE "(UPDATE|DELETE)" \
  && { echo "FAIL: halaqtna_api holds UPDATE/DELETE on an append-only table" >&2; exit 1; } \
  || echo "OK: no UPDATE/DELETE grant on audit_log or xp_ledger"

echo "database ready"
