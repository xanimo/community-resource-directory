# Deploying with your own domain + HTTPS

> New to this? **[PUBLISHING.md](PUBLISHING.md)** is a full step-by-step VM walkthrough (get a server, point DNS, launch with HTTPS). The sections below are the reference for each option.

Everything here gets the directory onto a real domain with a Let's Encrypt
certificate, so the site (and the password-gated `/admin` editor) run over
HTTPS instead of plaintext.

**Before you start:** point your domain's DNS **A** record (and **AAAA** if you
have IPv6) at your server's public IP, and make sure ports **80** and **443**
are reachable. Let's Encrypt validates over port 80, so it must be open.

## Option 1 — Docker + Caddy (recommended)

Caddy obtains and auto-renews the certificate for you. No certbot, no cron.

    cp deploy/env.example .env        # set SITE_ADDRESS and ADMIN_PASSWORD
    docker compose -f docker-compose.tls.yml up -d

`docker-compose.tls.yml` is a complete standalone stack (use it *instead of*
`docker-compose.yml`, not merged). Caddy publishes 80/443 and proxies to the
app on the internal network; the app is never exposed to the host directly.

To update after a `git pull`: `docker compose -f docker-compose.tls.yml up -d --build`.

## Option 2 — Bare host / VM + Caddy

For a plain Debian/Ubuntu box with no Docker. Installs Node 22, Caddy, and the
app as a hardened systemd service, then configures automatic HTTPS. Idempotent.

    sudo DOMAIN=help.example.org ADMIN_PASSWORD='a-strong-password' \
      ./deploy/install-baremetal.sh

Manage it afterward with `systemctl status community-resource-directory` and
`systemctl status caddy`.

## Option 3 — nginx + certbot (alternative)

If you specifically need nginx instead of Caddy. Run the bare-host installer
first (for the app + systemd service), then:

    sudo DOMAIN=help.example.org EMAIL=you@example.org \
      ./deploy/install-certbot-nginx.sh

certbot installs the cert, enables the HTTP→HTTPS redirect, and sets up
automatic renewal (test it with `certbot renew --dry-run`).

## Why this matters

The `/admin` editor authenticates with a password. Over plain HTTP that
password crosses the wire in the clear — so if you expose this instance to the
internet at all, terminate TLS in front of it. Every option here does that.
Once you are on HTTPS and certain you will stay there, you can enable HSTS by
uncommenting the `Strict-Transport-Security` line in `deploy/Caddyfile`.
