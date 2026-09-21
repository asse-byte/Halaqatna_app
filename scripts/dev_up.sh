#!/usr/bin/env bash
# Halaqtna — start the whole thing locally with one command.
#
# This is the demo path: SQLite instead of MySQL, no Docker, no ML container. It exists
# because the production path in docker/ needs MySQL, four images and a TLS certificate, and
# none of that is worth setting up just to look at the system or show it to a supervisor.
#
# What you need installed: PHP 8.2+, Composer, and Node 18+. Nothing else.
#
#   bash scripts/dev_up.sh
#
# Then open http://localhost:3000. Ctrl-C stops both servers.
#
# The forecast (FR10) needs the Python service, which this script does not start. Without it
# the API behaves exactly as UC13 says it must: it keeps working and shows the last stored
# forecast with a staleness notice. Everything else — sessions, metrics, reports, PDFs,
# the leaderboards — runs fully.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

say()  { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$1"; }
die()  { printf '\n\033[1;31mxx\033[0m  %s\n\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- prerequisites
for cmd in php composer node npm; do
  command -v "$cmd" >/dev/null || die "'$cmd' is not installed. Install PHP 8.2+, Composer and Node 18+, then run this again."
done

PHP_OK=$(php -r 'echo PHP_VERSION_ID >= 80200 ? 1 : 0;')
[ "$PHP_OK" = "1" ] || die "PHP 8.2 or newer is required; found $(php -r 'echo PHP_VERSION;')."

# Both ports are checked before anything starts. Vite quietly moves to the next free port
# when its own is taken, which would leave the address printed below pointing at nothing.
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- && return 0 || return 1; }
for p in "$API_PORT:API_PORT" "$WEB_PORT:WEB_PORT"; do
  port="${p%%:*}"; var="${p##*:}"
  ! port_busy "$port" || die "Port $port is already in use. Close whatever is holding it, or choose another: ${var}=$((port + 100)) bash scripts/dev_up.sh"
done

# mPDF needs these to shape Arabic and to subset the embedded font. Without them the Arabic
# report fails at generation rather than silently coming out unreadable, so check up front.
for ext in mbstring gd pdo_sqlite; do
  php -m | grep -qix "$ext" || die "The PHP extension '$ext' is missing. It is required (mbstring and gd for the Arabic PDF, pdo_sqlite for the demo database)."
done

# ---------------------------------------------------------------- backend
say "Backend — dependencies"
cd "$ROOT/api"
[ -d vendor ] || composer install --no-interaction

if [ ! -f .env ]; then
  say "Backend — first run, writing api/.env for the demo"
  cp .env.example .env

  # SQLite: a single file, no server to install or a password to invent.
  sqlite_path="$ROOT/api/database/dev.sqlite"
  touch "$sqlite_path"
  php -r '
    $p = ".env"; $s = file_get_contents($p);
    $set = function ($k, $v) use (&$s) {
      // Values are quoted: unquoted, dotenv reads # as a comment and silently truncates,
      // which is how a strong-looking password becomes five characters.
      $line = $k."=\"".$v."\"";
      $s = preg_match("/^".preg_quote($k, "/")."=/m", $s)
        ? preg_replace("/^".preg_quote($k, "/")."=.*$/m", $line, $s)
        : $s.PHP_EOL.$line.PHP_EOL;
    };
    $set("DB_CONNECTION", "sqlite");
    $set("DB_DATABASE", $argv[1]);
    $set("JWT_SECRET", bin2hex(random_bytes(32)));
    $set("SYS_ADMIN_EMAIL", "admin@halaqtna.local");
    $set("SYS_ADMIN_PASSWORD", "DemoAdmin2026");
    file_put_contents($p, $s);
  ' "$sqlite_path"
  php artisan key:generate --ansi >/dev/null
fi

say "Backend — database (fresh demo data)"
php artisan migrate:fresh --seed --force

# ---------------------------------------------------------------- frontend
say "Web client — dependencies"
cd "$ROOT/frontend"
[ -f .env ] || cp .env.example .env
if [ ! -d node_modules ]; then
  npm ci 2>/dev/null || npm install
fi

# ---------------------------------------------------------------- run
cleanup() { trap - INT TERM EXIT; say "Stopping"; kill 0 2>/dev/null || true; }
trap cleanup INT TERM EXIT

cd "$ROOT/api"
php artisan serve --host=127.0.0.1 --port="$API_PORT" >/tmp/halaqtna-api.log 2>&1 &

# Wait for the API rather than assuming it is up: the web client's first call is /auth/me.
for _ in $(seq 1 40); do
  curl -fsS -m 2 "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS -m 2 "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 \
  || { warn "The API did not come up. Last lines of /tmp/halaqtna-api.log:"; tail -20 /tmp/halaqtna-api.log; exit 1; }

cat <<BANNER

  ───────────────────────────────────────────────────────────────
   حلقتنا — Halaqtna is running

   Open:  http://localhost:$WEB_PORT

   Circle supervisor   admin.nafi@halaqtna.sa       Pass#2026
   Teacher             teacher.ahmad@halaqtna.sa    Pass#2026
   Student             access code  NUR482
   System admin        admin@halaqtna.local         DemoAdmin2026

   Ctrl-C stops both servers.
  ───────────────────────────────────────────────────────────────

BANNER

cd "$ROOT/frontend"
# --strictPort so it fails loudly rather than moving to another port behind the address
# printed above. The check at the top should have caught this already; this is the backstop.
npm run dev -- --port "$WEB_PORT" --host 127.0.0.1 --strictPort
