#!/usr/bin/env bash
# Halaqtna — start the whole thing locally with one command.
#
# This is the demo path: SQLite instead of MySQL, no Docker, no ML container. It exists
# because the production path in docker/ needs MySQL, four images and a TLS certificate, and
# none of that is worth setting up just to look at the system or show it to a supervisor.
#
# What you need installed: PHP 8.2+, Composer, and Node 20.19+ (or 22.12+). Nothing else.
# On Windows, run it from Git Bash, not PowerShell or cmd.
#
#   bash scripts/dev_up.sh
#
# Then open http://127.0.0.1:3000. Ctrl-C stops both servers.
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
for cmd in php composer node npm curl; do
  command -v "$cmd" >/dev/null || die "'$cmd' is not installed (or not on PATH). Install PHP 8.2+, Composer and Node 20.19+, then open a new terminal and run this again."
done

PHP_OK=$(php -r 'echo PHP_VERSION_ID >= 80200 ? 1 : 0;')
[ "$PHP_OK" = "1" ] || die "PHP 8.2 or newer is required; found $(php -r 'echo PHP_VERSION;')."

# The web client's Vite 8 refuses older Node outright, and it would only say so after the
# backend had already been installed and seeded. Its own range: ^20.19.0 || >=22.12.0.
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  process.exit((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22 ? 0 : 1);
' || die "Node $(node -v) is too old for the web client. Install Node 22 LTS (or 20.19+) from nodejs.org, open a new terminal, and run this again."

# Both ports are checked before anything starts. Vite quietly moves to the next free port
# when its own is taken, which would leave the address printed below pointing at nothing.
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- && return 0 || return 1; }
for p in "$API_PORT:API_PORT" "$WEB_PORT:WEB_PORT"; do
  port="${p%%:*}"; var="${p##*:}"
  ! port_busy "$port" || die "Port $port is already in use. Close whatever is holding it, or choose another: ${var}=$((port + 100)) bash scripts/dev_up.sh"
done

# Every extension the locked dependencies declare, plus pdo_sqlite for the demo database
# (mbstring and gd are also what mPDF needs to shape the Arabic report). Checked here, all at
# once, because otherwise Composer stops on the first one with a message that names a package
# rather than the fix. Asked of PHP itself rather than parsed from `php -m`, whose output
# differs across platforms.
REQUIRED_EXTS="ctype dom fileinfo filter gd iconv mbstring openssl pdo_sqlite tokenizer xml zlib"
# shellcheck disable=SC2086 # one argument per extension is the point
MISSING_EXTS=$(php -r 'echo implode(" ", array_filter(array_slice($argv, 1), fn ($e) => !extension_loaded($e)));' $REQUIRED_EXTS)
if [ -n "$MISSING_EXTS" ]; then
  die "PHP is missing these extensions: $MISSING_EXTS

    Windows:  run 'php --ini' to find php.ini. If it says '(none)', copy php.ini-development
              to php.ini in the same folder. In php.ini, remove the ';' at the start of
              'extension_dir = \"ext\"' and of each 'extension=NAME' line for the names above.
    Ubuntu:   sudo apt install php-mbstring php-gd php-sqlite3 php-xml
    macOS:    brew install php   (includes all of them)

    Then open a new terminal and run this again."
fi

# ---------------------------------------------------------------- backend
say "Backend — dependencies"
cd "$ROOT/api"
# vendor/autoload.php, not vendor/: an install cut short leaves the folder without it.
[ -f vendor/autoload.php ] || composer install --no-interaction

if [ ! -f .env ]; then
  say "Backend — first run, writing api/.env for the demo"
  cp .env.example .env

  # SQLite: a single file, no server to install or a password to invent. Its path is set
  # below, on every run.
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
    $set("JWT_SECRET", bin2hex(random_bytes(32)));
    $set("SYS_ADMIN_EMAIL", "admin@halaqtna.local");
    $set("SYS_ADMIN_PASSWORD", "DemoAdmin2026");
    file_put_contents($p, $s);
  '
  php artisan key:generate --ansi >/dev/null
fi

# The step below wipes and reseeds whatever database api/.env names, so it only ever runs on
# the demo's SQLite file — never on a MySQL database an api/.env from elsewhere points at.
db_connection=$(grep -E '^DB_CONNECTION=' .env | tail -1 | cut -d= -f2- | tr -d "\"' \r")
[ "$db_connection" = "sqlite" ] || die "api/.env uses the '${db_connection:-unset}' database, not the demo's SQLite file. This script erases and reseeds the database it runs on, so it stops rather than touch that one. To run the demo, rename api/.env (for example to api/.env.mine) and run this again."

# The path is written as an absolute one, so a project folder moved or renamed since the first
# run leaves it pointing at nothing. Re-pointing it costs nothing: the demo data is reseeded
# below either way. PHP works the path out itself, from the folder it runs in: on Windows
# that is the real C:\... path, which bash would only know as /c/..., and its backslashes
# become forward slashes because dotenv reads \n, \t and friends in a quoted value as escapes.
php -r '
  $db = str_replace("\\", "/", getcwd())."/database/dev.sqlite";
  touch($db);
  $p = ".env"; $s = file_get_contents($p);
  $line = "DB_DATABASE=\"".$db."\"";
  $s = preg_match("/^DB_DATABASE=/m", $s)
    ? preg_replace_callback("/^DB_DATABASE=.*$/m", fn () => $line, $s)
    : $s.PHP_EOL.$line.PHP_EOL;
  file_put_contents($p, $s);
'

say "Backend — database (fresh demo data)"
php artisan migrate:fresh --seed --force

# ---------------------------------------------------------------- frontend
say "Web client — dependencies"
cd "$ROOT/frontend"
[ -f .env ] || cp .env.example .env
# Same reasoning as vendor/: a node_modules left by an interrupted install has no vite in it.
if [ ! -e node_modules/.bin/vite ]; then
  npm ci || npm install
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

   Open:  http://127.0.0.1:$WEB_PORT

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
