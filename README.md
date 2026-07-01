# Community Resource Directory

A mobile-first directory that connects people to nearby community services — food, shelter, showers, medical care, legal aid. **Free to use, free to host, no account, no questions.**

## Why this exists

This kind of tool keeps getting built and keeps dying. Ohana (Code for America, 2013) rotted when the fellowship ended. Link-SF (Zendesk + St. Anthony's, 2014) was archived in February 2026. Each time, the *need* stayed and the *maintained tool* vanished, because each depended on one company or one grant.

This is built to not die that way: one repo, one command, no proprietary backend, no single vendor who can switch it off. The communities that use it can host and maintain it themselves.

## Run it

With Docker:

    docker compose up

Or with Node 22+ directly:

    node api/server.js

Then open http://localhost:8080.

## What v0 does

- Distance-sorted list of nearby services, closest first, filterable by category.
- Map view via MapLibre + OpenStreetMap tiles — **no Google key required**.
- Works from browser geolocation, or falls back to a default location; the list works even if the map fails.
- Data served in an HSDS-inspired (OpenReferral) shape from `data/seed.json`.
- Open data endpoint at `/api/services`.

## What v0 is not (yet)

No admin/editing UI, no accounts, no multi-community hosting. Those come later. v0 exists to prove the shape: a community can stand up a working "find help near me" from a data file, with nothing proprietary underneath.

## Loading your community's data
> **Data accuracy:** the bundled Bay Area seed was compiled from public sources and every entry is flagged `needs_verification`. Addresses, hours, and phone numbers change often — confirm each with the provider before relying on it. This mirrors how Link-SF operated: a human partner verified entries.


Two ways to get services in.

**Import real HSDS / OpenReferral data** (recommended). If your community already publishes data in the [Human Service Data Specification](https://docs.openreferral.org) — from a 2-1-1, an Ohana instance, or any HSDS source — import it directly, no re-typing:

    # HSDS 3.0 JSON (a dereferenced service list)
    node importer/import-hsds.js path/to/hsds.json --write

    # HSDS tabular data package (a folder of CSVs: organizations.csv,
    # services.csv, locations.csv, service_at_location.csv, addresses.csv, ...)
    node importer/import-hsds.js path/to/package_dir --write

The importer joins the HSDS relational model (service → organization, service → location → address, with phones and schedules) and flattens it into what the app serves. Records without coordinates are skipped, since they can't be placed on a map or distance-sorted. Categories are inferred from HSDS taxonomy terms and text. Drop `--write` to preview on stdout instead of overwriting `data/seed.json`.

**Export your data as HSDS.** The directory is a full ecosystem citizen: it can publish its data back out in the same standard, so another system — ORServices, a 2-1-1, any HSDS tool — can ingest it.

    # HSDS 3.x tabular data package (datapackage.json + one CSV per table)
    node importer/export-hsds.js --out ./hsds-export

    # bundle it as a single portable .zip
    node importer/export-hsds.js --out ./hsds-export --zip

    # or a dereferenced HSDS JSON service list
    node importer/export-hsds.js --format json > hsds.json

The exporter re-splits the app's flat records into the canonical HSDS 3.x tables. The exporter maps each service category to the [Open Eligibility](https://github.com/openreferral/openeligibility) taxonomy — the standard vocabulary HSDS recommends — using real term codes (e.g. food→1102, medical→1206 Medical Care, legal→1111) with their parent chain, so categories line up with other HSDS systems. Where no Open Eligibility term fits (e.g. free computer access), the term is kept local rather than forced into a bad match. It re-splits records
(organizations, services, service_at_location, locations, addresses, phones,
schedules, taxonomy_terms) with deterministic ids, so re-exports of unchanged
data are byte-stable. Because import and export use the same standard, the loop
is closed: **import real HSDS → edit in `/admin` → export real HSDS.**

**Or hand-edit** `data/seed.json` for a small directory: each service needs a name, category, address, `latitude`, `longitude`, and ideally phone/hours/website. Categories are listed under `meta.taxonomy`. Restart and your data is live.

## Editing data in the browser (admin)

There's a password-gated editor at `/admin` for adding, editing, and deleting services without touching files. It's **off by default** and only turns on when you set a password:

    ADMIN_PASSWORD='choose-a-strong-password' node api/server.js

Then open http://localhost:8080/admin and sign in. Edits are written straight to `data/seed.json` and take effect immediately. With Docker, set the variable in your shell or a `.env` file before `docker compose up` (the compose file reads `ADMIN_PASSWORD` and mounts `./data` writable so saves persist).

**What the gate is and isn't.** The password is compared in constant time and exchanged for a short-lived signed token, so it's real access control for a self-hosted box. It is **not** a replacement for HTTPS: over plain `http://` the password crosses the wire in the clear. If you expose this instance beyond localhost, put it behind a reverse proxy with TLS. If `ADMIN_PASSWORD` is unset, the admin API is fully closed (fail-shut) and the site runs read-only.

## Deploying on your own domain with HTTPS

To put this on a real domain with a Let's Encrypt certificate — which is what
makes the `/admin` editor safe to expose — see [`deploy/`](deploy/). The quickest
path is Docker + Caddy (automatic HTTPS, no certbot):

    cp deploy/env.example .env        # set SITE_ADDRESS and ADMIN_PASSWORD
    docker compose -f docker-compose.tls.yml up -d

There's also a bare-host installer (`deploy/install-baremetal.sh`) and an
nginx + certbot alternative. Full instructions in [deploy/README.md](deploy/README.md).

## Stack

Plain Node (built-in `http` + `node:sqlite`), a static HTML/JS front-end, MapLibre for the map. No framework, no build step — chosen so it stays maintainable by many hands over many years. That longevity is the whole point.

## License

MIT.
