#!/usr/bin/env bash
# nginx/generate-certs.sh
#
# Generates a self-signed TLS certificate for local HTTPS development.
# The certificate is placed in nginx/ssl/ where nginx.conf expects it.
#
# Usage:
#   bash nginx/generate-certs.sh
#
# After running, start the full stack with HTTPS:
#   docker compose -f docker-compose.yml up --build
#
# To revert to HTTP-only development (the default):
#   docker compose up --build   # docker-compose.override.yml is applied automatically

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="${SCRIPT_DIR}/ssl"

echo "Creating SSL directory: ${SSL_DIR}"
mkdir -p "${SSL_DIR}"

# Check if certificates already exist
if [[ -f "${SSL_DIR}/cert.pem" && -f "${SSL_DIR}/key.pem" ]]; then
    echo "Certificates already exist at ${SSL_DIR}/"
    echo "  cert.pem  — $(openssl x509 -noout -enddate -in "${SSL_DIR}/cert.pem" 2>/dev/null || echo 'unreadable')"
    echo "  key.pem   — present"
    read -r -p "Overwrite? [y/N] " confirm
    [[ "${confirm}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

echo "Generating self-signed certificate (365 days)..."
openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "${SSL_DIR}/key.pem" \
    -out    "${SSL_DIR}/cert.pem" \
    -days   365 \
    -subj   "/C=US/ST=Dev/L=Local/O=QRP/OU=Dev/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "${SSL_DIR}/key.pem"
chmod 644 "${SSL_DIR}/cert.pem"

echo ""
echo "Done. Files written to ${SSL_DIR}/"
echo "  cert.pem"
echo "  key.pem"
echo ""
echo "To start with HTTPS:"
echo "  docker compose -f docker-compose.yml up --build"
echo ""
echo "NOTE: Your browser will show a security warning for self-signed certs."
echo "      Add nginx/ssl/cert.pem to your browser/OS trusted roots to suppress it."
