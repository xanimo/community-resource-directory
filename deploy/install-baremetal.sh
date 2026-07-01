#!/usr/bin/env bash
#
# Install the Community Resource Directory on a bare Debian/Ubuntu host with
# automatic HTTPS via Caddy + Let's Encrypt. Idempotent: safe to re-run.
#
# Usage (run from the repo root, as root or with sudo):
#   sudo DOMAIN=help.example.org ADMIN_PASSWORD='a-strong-password' ./deploy/install-baremetal.sh
#
# What it does:
#   - installs Node.js 22 (if absent) and Caddy (if absent)
#   - installs the app as a systemd service running as an unprivileged user
#   - configures Caddy to terminate TLS for $DOMAIN and proxy to the app
#   - opens ports 80/443 if ufw is active
#
# It does NOT touch an existing Caddyfile without backing it up first.

set -euo pipefail

# ---- preconditions ----
if [[ "${EUID}" -ne 0 ]]; then echo "Please run as root (sudo)." >&2; exit 1; fi
: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=help.example.org}"
APP_USER="${APP_USER:-crdir}"
APP_DIR="${APP_DIR:-/opt/community-resource-directory}"
APP_PORT="${APP_PORT:-8080}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Domain:   ${DOMAIN}"
echo "==> App dir:  ${APP_DIR}"
echo "==> Run user: ${APP_USER}"
echo "==> Source:   ${REPO_DIR}"

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "WARNING: ADMIN_PASSWORD is not set — the /admin editor will be DISABLED (read-only site)."
fi

# ---- OS check ----
if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script targets Debian/Ubuntu (apt). For other distros, install Node 22 + Caddy manually and adapt." >&2
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update -y

# ---- Node.js 22 ----
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 22 ]]; then
  echo "==> Installing Node.js 22..."
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y && apt-get install -y nodejs
else
  echo "==> Node.js $(node -v) already present."
fi

# ---- Caddy ----
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
else
  echo "==> Caddy already present."
fi

# ---- app user + files ----
if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "==> Creating service user ${APP_USER}..."
  useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi
echo "==> Syncing app to ${APP_DIR}..."
mkdir -p "${APP_DIR}"
# copy repo contents (excluding .git) without deleting the live data dir
tar -C "${REPO_DIR}" --exclude=.git -cf - . | tar -C "${APP_DIR}" -xf -
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ---- systemd service ----
echo "==> Installing systemd service..."
cat > /etc/systemd/system/community-resource-directory.service << UNIT
[Unit]
Description=Community Resource Directory
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${APP_PORT}
Environment=ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
Environment=ADMIN_TOKEN_SECRET=${ADMIN_TOKEN_SECRET:-}
ExecStart=$(command -v node) ${APP_DIR}/api/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/data
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now community-resource-directory
systemctl restart community-resource-directory

# ---- Caddy config ----
CADDYFILE=/etc/caddy/Caddyfile
if [[ -f "${CADDYFILE}" ]] && ! grep -q "# managed-by: community-resource-directory" "${CADDYFILE}"; then
  echo "==> Backing up existing ${CADDYFILE} to ${CADDYFILE}.bak"
  cp "${CADDYFILE}" "${CADDYFILE}.bak.$(date +%s)"
fi
echo "==> Writing Caddy config for ${DOMAIN}..."
cat > "${CADDYFILE}" << CADDY
# managed-by: community-resource-directory
${DOMAIN} {
	encode zstd gzip
	reverse_proxy 127.0.0.1:${APP_PORT}
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy no-referrer-when-downgrade
		-Server
	}
}
CADDY
systemctl reload caddy || systemctl restart caddy

# ---- firewall (best effort) ----
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "==> Opening ports 80/443 in ufw..."
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

echo ""
echo "==> Done. https://${DOMAIN} should be live within ~30s once DNS resolves."
echo "    App service:  systemctl status community-resource-directory"
echo "    Caddy:        systemctl status caddy"
echo "    Admin editor: https://${DOMAIN}/admin  (enabled only if ADMIN_PASSWORD was set)"
