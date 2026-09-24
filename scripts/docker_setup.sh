#!/usr/bin/env bash
# Halaqtna (CPIT-499) — database setup for the Docker Compose stack.
#
#   migrate as halaqtna_admin  ->  apply the least-privilege grants  ->  seed  ->  start
#
# scripts/db_setup.sh does the same for a MySQL server on the host. It cannot reach the
# `db` container, which publishes no port (rule 6), so this script runs each step inside
# the Compose network instead: the migrations through a one-off `api` container that
# connects as halaqtna_admin, and the grants through the mysql client in `db`.
#
# Usage (from the repository root, with the passwords docker/mysql/init.sql was edited to):
#
#   DB_ROOT_PASSWORD=... DB_ADMIN_PASSWORD=... ML_DB_PASSWORD=... bash scripts/docker_setup.sh
#   FRESH=1 ... bash scripts/docker_setup.sh      # drop every table first (demo reset)
#
# Safe to run again. Only FRESH=1 drops data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="halaqtna"   # fixed by MYSQL_DATABASE in docker/docker-compose.yml

: "${DB_ROOT_PASSWORD:?set DB_ROOT_PASSWORD (the root password the db container was created with)}"
: "${DB_ADMIN_PASSWORD:?set DB_ADMIN_PASSWORD (halaqtna_admin in docker/mysql/init.sql)}"
: "${ML_DB_PASSWORD:?set ML_DB_PASSWORD (halaqtna_ml in docker/mysql/init.sql)}"
export DB_ROOT_PASSWORD ML_DB_PASSWORD   # interpolated by docker-compose.yml

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
die() { printf '\n\033[1;31mxx\033[0m  %s\n\n' "$1" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not installed."
cd "$ROOT/docker"
[ -f nginx/certs/fullchain.pem ] || die "No TLS certificate yet. Run: bash scripts/make_dev_certs.sh"
[ -f "$ROOT/frontend/dist/index.html" ] || die "The web client is not built yet. Run: (cd frontend && npm install && npm run build)"

compose() { docker compose "$@"; }
root_sql() { compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" "$@"; }
# A one-off api container with the admin account: the running api never holds it.
as_admin() { compose run --rm --no-deps -e DB_USERNAME=halaqtna_admin -e DB_PASSWORD="$DB_ADMIN_PASSWORD" api php artisan "$@"; }

say "Starting the database"
compose up -d --build db
for _ in $(seq 1 60); do
  compose exec -T db mysqladmin ping -h 127.0.0.1 -uroot -p"$DB_ROOT_PASSWORD" --silent >/dev/null 2>&1 && break
  sleep 2
done
compose exec -T db mysqladmin ping -h 127.0.0.1 -uroot -p"$DB_ROOT_PASSWORD" --silent >/dev/null 2>&1 \
  || die "MySQL did not become ready. Check: docker compose -f docker/docker-compose.yml logs db"

say "Building the api image"
compose build api

MIGRATE="migrate"
[ "${FRESH:-0}" = "1" ] && MIGRATE="migrate:fresh"
say "${MIGRATE} as halaqtna_admin"
as_admin "$MIGRATE" --force

say "Applying the least-privilege grants (rule 4: audit_log and xp_ledger stay append-only)"
sed -e "s/__HOST__/%/g" "$ROOT/scripts/db_grants.sql" | root_sql "$DB_NAME"

say "Seeding reference data, the System Administrator and the demo circles"
as_admin db:seed --force

say "Verifying the append-only guarantee"
if root_sql -N -B -e "SHOW GRANTS FOR 'halaqtna_api'@'%';" \
  | grep -E "ON \`?${DB_NAME}\`?\.\`?(audit_log|xp_ledger)\`?" | grep -qE "(UPDATE|DELETE)"; then
  die "halaqtna_api holds UPDATE/DELETE on an append-only table"
fi
echo "OK: no UPDATE/DELETE grant on audit_log or xp_ledger"

say "Starting the stack"
compose up -d --build
printf '\n    Open https://localhost — the certificate is self-signed, so the browser will warn.\n\n'
