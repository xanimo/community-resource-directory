# Community Resource Directory

A mobile-first "find help near you" directory — food, shelter, showers, medical
care, legal aid, immigration rapid-response, LGBTQ+ services, harm reduction,
mutual-aid meals, community gardens, co-ops, infoshops, farm-share CSAs, free
clinics, free dental, and free rides — that a community can stand up
in an afternoon and maintain itself. **Free to use, free to host, no account, no
tracking.**

It imports and exports real [OpenReferral / HSDS](https://docs.openreferral.org)
data, runs bilingual (English/Spanish), deploys with automatic HTTPS in about
fifteen minutes, and keeps no logs of the people who use it.

## Why this exists

This kind of tool keeps getting built and keeps dying. Ohana (Code for America,
2013) rotted when the fellowship ended. Link-SF (Zendesk + St. Anthony's, 2014)
was archived in 2022. Each time the *need* stayed and the *maintained tool*
vanished, because each depended on one company or one grant.

This is built to not die that way: one small repo, one command, no proprietary
backend, no single vendor who can switch it off. The communities that use it can
host and maintain it themselves. See [MANIFESTO.md](MANIFESTO.md) for the fuller
why — it's meant to be forked and run by mutual-aid networks and organizers, not
just agencies.

## Quick start

This ships **blank** — a working app with no data, ready to become yours. Point
it at your town:

    node bin/bootstrap.js --name "Your County" --lat 38.29 --lon -122.46 --zoom 10

Then run it, with Docker:

    docker compose up

Or with Node 22+ directly:

    node api/server.js

Then open http://localhost:8080. To see a fully populated instance first, load
the bundled Bay Area example with `node bin/bootstrap.js --example bay-area`.
Full setup guide: [SETUP.md](SETUP.md). To go live on a real domain with HTTPS,
see [Deploying](#deploying), below.

## What it does

- **Distance-sorted list** of nearby services, closest first, filterable by
  category. Works from browser geolocation or a sensible fallback; the list
  still works if the map fails.
- **Map view** via MapLibre + OpenStreetMap tiles — no Google key, no Google.
- **Know Your Rights** panel built into the UI, with immigration-enforcement
  guidance and a pointer to rapid-response and legal-aid resources.
- **Bilingual (English / Spanish)** with a language toggle; the translation
  table is one object in `web/index.html` that anyone can extend.
- **Password-gated admin editor** at `/admin` for adding, editing, and deleting
  services in the browser (off by default; see [Editing data](#editing-data-in-the-browser)).
- **Real HSDS import and export** — a full ecosystem citizen, not a silo (see
  [Loading data](#loading-your-communitys-data)).
- **Privacy by default** — no analytics, no trackers, no search logs; the
  recommended deploy also turns off web-server access logs and strips referrers.
  See [deploy/PRIVACY.md](deploy/PRIVACY.md).
- **Open data endpoint** at `/api/services`.

> **Data accuracy:** the bundled Bay Area seed was compiled from public sources,
> and every entry is flagged `needs_verification`. Addresses, hours, and phone
> numbers change often — confirm each with the provider before relying on it,
> especially the rapid-response and legal-aid entries. This mirrors how Link-SF
> operated: a human verifies entries. A wrong address on a survival directory
> sends someone to a locked door.

## Loading your community's data

Three ways to get services in.

### Import real HSDS / OpenReferral data (recommended)

If your community already publishes data in the
[Human Service Data Specification](https://docs.openreferral.org) — from a 2-1-1,
an Ohana instance, or any HSDS source — import it directly, no re-typing:

    # HSDS 3.x JSON (a dereferenced service list)
    node importer/import-hsds.js path/to/hsds.json --write

    # HSDS tabular data package (a folder of CSVs: organizations.csv,
    # services.csv, locations.csv, service_at_location.csv, addresses.csv, ...)
    node importer/import-hsds.js path/to/package_dir --write

The importer joins the HSDS relational model (service → organization, service →
location → address, with phones and schedules) and flattens it into what the app
serves. Records without coordinates are skipped, since they can't be placed on a
map. Categories are inferred from HSDS taxonomy terms and text. Drop `--write` to
preview on stdout instead of overwriting `data/seed.json`.

### Export your data as HSDS

The directory can publish its data back out in the same standard, so another
system — ORServices, a 2-1-1, any HSDS tool — can ingest it:

    # HSDS 3.x tabular data package (datapackage.json + one CSV per table)
    node importer/export-hsds.js --out ./hsds-export

    # bundle it as a single portable .zip
    node importer/export-hsds.js --out ./hsds-export --zip

    # or a dereferenced HSDS JSON service list
    node importer/export-hsds.js --format json > hsds.json

The exporter re-splits the app's flat records into the canonical HSDS 3.x tables
(organizations, services, service_at_location, locations, addresses, phones,
schedules, taxonomy_terms) with deterministic ids, so re-exports of unchanged
data are byte-stable. Categories map to the
[Open Eligibility](https://github.com/openreferral/openeligibility) taxonomy —
the standard vocabulary HSDS recommends — using real term codes (e.g. food→1102,
medical→1206, legal→1111) with their parent chain, so categories line up with
other HSDS systems. Where no Open Eligibility term fits (e.g. rapid-response
hotlines, free computer access), the term is kept local rather than forced into a
bad match.

Because import and export use the same standard, the loop is closed:
**import real HSDS → edit in `/admin` → export real HSDS.**

### Or hand-edit

For a small directory, edit `data/seed.json` directly: each service needs a
name, category, address, `latitude`, `longitude`, and ideally phone/hours/
website. Categories are listed under `meta.taxonomy`. Restart and it's live.

## Editing data in the browser

There's a password-gated editor at `/admin` for adding, editing, and deleting
services without touching files. It's **off by default** and only turns on when
you set a password:

    ADMIN_PASSWORD='choose-a-strong-password' node api/server.js

Then open http://localhost:8080/admin and sign in. Edits are written straight to
`data/seed.json` and take effect immediately. With Docker, set the variable in
your shell or a `.env` file before `docker compose up` (the compose file reads
`ADMIN_PASSWORD` and mounts `./data` writable so saves persist).

**What the gate is and isn't.** The password is compared in constant time and
exchanged for a short-lived signed token, so it's real access control for a
self-hosted box. It is **not** a replacement for HTTPS: over plain `http://` the
password crosses the wire in the clear. If you expose this instance beyond
localhost, put it behind TLS (the deploy below does this). If `ADMIN_PASSWORD`
is unset, the admin API is fully closed and the site runs read-only.

## Deploying

To put this on a real domain with a Let's Encrypt certificate — which is what
makes the `/admin` editor safe to expose — see [`deploy/`](deploy/). The quickest
path is Docker + Caddy (automatic HTTPS, no certbot):

    cp deploy/env.example .env        # set SITE_ADDRESS and ADMIN_PASSWORD
    docker compose -f docker-compose.tls.yml up -d

There's also a bare-host installer (`deploy/install-baremetal.sh`) and an
nginx + certbot alternative. Full step-by-step for a fresh VM is in
[deploy/PUBLISHING.md](deploy/PUBLISHING.md); privacy guidance for at-risk
communities is in [deploy/PRIVACY.md](deploy/PRIVACY.md).

## For organizers

This is built to be forked and run by communities. Clone it, load your own local
resources through the admin editor or an HSDS import, deploy it on a $5 VM, and
share the link — no permission needed. The pieces most useful to movement work:
the Know Your Rights panel, the rapid-response and legal-aid categories (seeded
with real Bay Area hotlines and deportation-defense orgs, flagged for
verification), Spanish support, and the privacy-by-default posture. See
[MANIFESTO.md](MANIFESTO.md).

## Stack

Plain Node (built-in `http` + `node:sqlite`), a static HTML/JS front-end, and
MapLibre for the map. No framework, no build step — chosen so it stays
maintainable by many hands over many years. That longevity is the whole point.

## License

MIT — see [LICENSE](LICENSE).
