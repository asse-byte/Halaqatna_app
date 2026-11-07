#!/usr/bin/env bash
# Halaqtna (CPIT-499) — replace every placeholder secret before the first real deployment.
#
#   SYS_ADMIN_EMAIL=you@example.org bash scripts/prod_init.sh halaqtna.example.me
#
# Writes random values into api/.env.docker and docker/mysql/init.sql (the two files that ship
# with "change-me" placeholders), and the passwords docker compose and docker_setup.sh need
# into docker/.env (chmod 600, never committed). Prints nothing secret: read docker/.env.
#
# Run it ONCE, before the database container is first created. A second run does nothing,
# because the placeholders are gone; changing the database passwords of an existing
# volume is a different job (it needs ALTER USER, not a new init.sql).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVF="$ROOT/api/.env.docker"; INIT="$ROOT/docker/mysql/init.sql"; DOCKER_ENV="$ROOT/docker/.env"
DOMAIN="${1:-}"; EMAIL="${SYS_ADMIN_EMAIL:-}"

die() { printf '\n\033[1;31mxx\033[0m  %s\n\n' "$1" >&2; exit 1; }
command -v openssl >/dev/null || die "openssl is not installed."
[ -n "$DOMAIN" ] || die "Usage: SYS_ADMIN_EMAIL=you@example.org bash scripts/prod_init.sh your.domain"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "'$DOMAIN' does not look like a host name."
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "Set SYS_ADMIN_EMAIL to a real address: it is the System Administrator's sign-in."

if ! grep -q "change-me" "$ENVF" "$INIT"; then
  echo "Already initialised: no placeholder left in api/.env.docker or docker/mysql/init.sql. Nothing changed."
  exit 0
fi
[ ! -e "$DOCKER_ENV" ] || die "docker/.env already exists. Remove it only if you are sure this server has no data yet."

# Hex only: no '#', quote or '$' that dotenv, MySQL or sed could read as something else.
rand() { openssl rand -hex "$1"; }
DB_ROOT_PASSWORD=$(rand 24); DB_ADMIN_PASSWORD=$(rand 24); DB_API_PASSWORD=$(rand 24); ML_DB_PASSWORD=$(rand 24)
JWT_SECRET=$(rand 32); SYS_ADMIN_PASSWORD=$(rand 12); APP_KEY="base64:$(openssl rand -base64 32)"

umask 077
# '|' is the sed delimiter on purpose: the base64 APP_KEY contains '/'.
sed -i \
  -e "s|^APP_KEY=.*|APP_KEY=$APP_KEY|" \
  -e "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" \
  -e "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_API_PASSWORD|" \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" \
  -e "s|^SYS_ADMIN_EMAIL=.*|SYS_ADMIN_EMAIL=$EMAIL|" \
  -e "s|^SYS_ADMIN_PASSWORD=.*|SYS_ADMIN_PASSWORD=$SYS_ADMIN_PASSWORD|" \
  "$ENVF"
sed -i \
  -e "s|change-me-admin|$DB_ADMIN_PASSWORD|" \
  -e "s|change-me-api|$DB_API_PASSWORD|" \
  -e "s|change-me-ml|$ML_DB_PASSWORD|" \
  "$INIT"

cat > "$DOCKER_ENV" <<ENVEOF
# Written by scripts/prod_init.sh. Read by docker compose and scripts/docker_setup.sh.
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD
DB_ADMIN_PASSWORD=$DB_ADMIN_PASSWORD
ML_DB_PASSWORD=$ML_DB_PASSWORD
# The System Administrator's first password. Sign in once and change it on "My account".
SYS_ADMIN_EMAIL=$EMAIL
SYS_ADMIN_PASSWORD=$SYS_ADMIN_PASSWORD
ENVEOF
chmod 600 "$DOCKER_ENV" "$ENVF"

# These two tracked files now hold secrets: keep git from reporting or overwriting them.
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$ROOT" update-index --skip-worktree api/.env.docker docker/mysql/init.sql
fi

printf '\n\033[1;32m==>\033[0m Secrets written for https://%s\n' "$DOMAIN"
printf '    Read them in:  %s\n' "$DOCKER_ENV"
printf '    Copy that file to your password manager now: if it is lost, so is the database.\n\n'
