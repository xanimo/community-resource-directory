# Publishing on a VM (step by step)

This gets the directory live on the public internet on your own domain, with
HTTPS, on any cheap Linux VM (DigitalOcean, Hetzner, Vultr, Linode, a Fly.io
machine, etc.). Budget: a $4–6/month instance is plenty. ~15 minutes.

## 1. Get a VM and a domain

- Create the smallest Ubuntu 22.04 or 24.04 VM your provider offers (1 vCPU /
  1 GB RAM is fine). Note its public IP.
- Point a domain (or subdomain) at that IP: add a **DNS A record**, e.g.
  `help.yourdomain.org  →  203.0.113.10`. If you have IPv6, add an **AAAA**
  record too. Wait a few minutes for it to propagate (`dig help.yourdomain.org`
  should return your VM's IP).

## 2. Install Docker on the VM

SSH in (`ssh root@your-vm-ip`) and run:

    curl -fsSL https://get.docker.com | sh

That installs Docker Engine + the Compose plugin.

## 3. Get the code onto the VM

    git clone https://github.com/xanimo/community-resource-directory.git
    cd community-resource-directory

## 4. Configure your instance

    cp deploy/env.example .env
    nano .env          # set SITE_ADDRESS and a strong ADMIN_PASSWORD

`.env` should look like:

    SITE_ADDRESS=help.yourdomain.org
    ADMIN_PASSWORD=some-long-random-password
    ADMIN_TOKEN_SECRET=another-long-random-string

(`.env` is gitignored — it stays on the VM and is never committed.)

## 5. Launch with automatic HTTPS

    docker compose -f docker-compose.tls.yml up -d

Caddy fetches a Let's Encrypt certificate for your domain automatically. Give
it ~30 seconds, then open `https://help.yourdomain.org` — you should see the
directory, and `https://help.yourdomain.org/admin` should let you sign in with
your `ADMIN_PASSWORD`.

## 6. Verify it's healthy

    docker compose -f docker-compose.tls.yml ps      # both services "running"
    docker compose -f docker-compose.tls.yml logs -f caddy   # watch cert issuance

If the cert doesn't issue: almost always DNS isn't pointing at the VM yet, or
port 80/443 is blocked by the provider's firewall. Let's Encrypt validates over
port 80 — make sure it's open in your provider's control panel.

## Updating later

    git pull
    docker compose -f docker-compose.tls.yml up -d --build

Remember: **code changes need `--build`**; edits made through the `/admin`
editor persist in `data/` (mounted as a volume) and survive restarts and
rebuilds without one.

## Firewall (recommended)

If your provider has a firewall, allow **22** (SSH), **80**, and **443**;
block everything else. On the VM itself with ufw:

    ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

## A note before you share the URL widely

The bundled seed is flagged `needs_verification`. Before promoting this to
people who'll actually rely on it, confirm the addresses, hours, and phone
numbers with each provider (or bring on a local partner to do a verification
pass through the `/admin` editor). A wrong address on a homeless-services
directory sends someone to a shuttered building — worse than no listing.
