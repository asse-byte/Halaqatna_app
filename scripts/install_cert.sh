#!/usr/bin/env bash
# Halaqtna — copy a Let's Encrypt certificate to where the nginx container reads it.
#
# certbot runs this as its --deploy-hook after every successful issue or renewal, and sets
# RENEWED_LINEAGE to /etc/letsencrypt/live/<domain>. Run by hand with that variable set if
# you ever need to reinstall the files. See docs/DEPLOY_AR.md for the certbot command.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINEAGE="${RENEWED_LINEAGE:?RENEWED_LINEAGE is not set: run this through certbot --deploy-hook}"
DEST="$ROOT/docker/nginx/certs"

mkdir -p "$DEST"
umask 077
# cp -L follows certbot's symlinks, so nginx gets real files rather than dangling links.
cp -L "$LINEAGE/fullchain.pem" "$DEST/fullchain.pem"
cp -L "$LINEAGE/privkey.pem" "$DEST/privkey.pem"
# certbot runs as root, but docker_setup.sh runs as the person who owns the checkout and
# checks that these files exist, so they belong to that person (mode stays 600).
chown "$(stat -c %u:%g "$ROOT")" "$DEST" "$DEST/fullchain.pem" "$DEST/privkey.pem"
echo "Installed the certificate from $LINEAGE into $DEST"
