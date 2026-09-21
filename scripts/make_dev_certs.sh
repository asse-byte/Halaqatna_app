#!/usr/bin/env bash
# Generates the self-signed TLS certificate the nginx container needs.
#
# NFR4 requires TLS 1.2 or higher on every client-server connection, so nginx is configured
# to listen on 443 only and refuses to start without a certificate and key. Real certificates
# are never committed, which left `docker compose up` failing on a fresh clone with nothing to
# say why. This produces a throwaway pair so the stack comes up locally.
#
#   bash scripts/make_dev_certs.sh
#
# The browser will warn that the certificate is not trusted. That is correct and expected:
# it is self-signed. Accept it for the demo. For anything a real user can reach, replace
# these two files with a certificate from a certificate authority — the filenames are what
# docker/nginx/default.conf expects, so nothing else changes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT/docker/nginx/certs"
DAYS="${DAYS:-365}"

command -v openssl >/dev/null || {
  printf '\033[1;31mxx\033[0m  openssl is not installed, and it is what generates the certificate.\n' >&2
  exit 1
}

mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  printf '\033[1;33m!!\033[0m  %s already has a certificate. Delete both .pem files first to replace it.\n' "$CERT_DIR"
  exit 0
fi

# subjectAltName, not just a common name: browsers have ignored CN for host matching for
# years, and without a SAN the certificate is rejected outright rather than merely distrusted.
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -days "$DAYS" \
  -subj "/CN=localhost/O=Halaqtna (development only)" \
  -addext "subjectAltName=DNS:localhost,DNS:halaqtna.local,IP:127.0.0.1" \
  2>/dev/null

chmod 600 "$CERT_DIR/privkey.pem"

printf '\n\033[1;32m==>\033[0m Self-signed certificate written to docker/nginx/certs (valid %s days).\n' "$DAYS"
printf '    Development only. Your browser will warn that it is not trusted — that is expected.\n\n'
