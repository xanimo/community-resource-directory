#!/usr/bin/env bash
#
# Alternative to install-baremetal.sh for people who specifically want
# nginx + certbot instead of Caddy. Debian/Ubuntu, run as root.
#
#   sudo DOMAIN=help.example.org EMAIL=you@example.org \
#     ./deploy/install-certbot-nginx.sh
#
# Assumes the app is already installed and running as a systemd service on
# 127.0.0.1:8080 (run install-baremetal.sh first, or set up the service
# yourself). This script only handles nginx + the TLS certificate.

set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "Run as root (sudo)." >&2; exit 1; fi
: "${DOMAIN:?Set DOMAIN}"
: "${EMAIL:?Set EMAIL for Lets Encrypt renewal notices}"
APP_PORT="${APP_PORT:-8080}"
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

# Write a minimal reverse-proxy vhost. nginx uses its own $variables; we build
# the file with printf so those dollar signs are written literally, never
# touched by the shell.
VHOST="/etc/nginx/sites-available/${DOMAIN}"
# The %s slots take DOMAIN and APP_PORT; the nginx $variables are in the
# single-quoted format string, so the shell leaves them alone.
# shellcheck disable=SC2059
printf 'server {
    listen 80;
    server_name %s;
    location / {
        proxy_pass http://127.0.0.1:%s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
' "${DOMAIN}" "${APP_PORT}" > "${VHOST}"

ln -sf "${VHOST}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t && systemctl reload nginx

# Obtain + install the cert and enable HTTP->HTTPS redirect. certbot sets up
# automatic renewal (a systemd timer) on install.
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect

echo ""
echo "==> Done. https://${DOMAIN} is live. Renewal is automatic (certbot timer)."
echo "    Test renewal: certbot renew --dry-run"
