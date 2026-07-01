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

Two ways to get services in.

**Import real HSDS / OpenReferral data** (recommended). If your community already publishes data in the [Human Service Data Specification](https://docs.openreferral.org) — from a 2-1-1, an Ohana instance, or any HSDS source — import it directly, no re-typing:

    # HSDS 3.0 JSON (a dereferenced service list)
    node importer/import-hsds.js path/to/hsds.json --write

    # HSDS tabular data package (a folder of CSVs: organizations.csv,
    # services.csv, locations.csv, service_at_location.csv, addresses.csv, ...)
    node importer/import-hsds.js path/to/package_dir --write

The importer joins the HSDS relational model (service → organization, service → location → address, with phones and schedules) and flattens it into what the app serves. Records without coordinates are skipped, since they can't be placed on a map or distance-sorted. Categories are inferred from HSDS taxonomy terms and text. Drop `--write` to preview on stdout instead of overwriting `data/seed.json`.

**Or hand-edit** `data/seed.json` for a small directory: each service needs a name, category, address, `latitude`, `longitude`, and ideally phone/hours/website. Categories are listed under `meta.taxonomy`. Restart and your data is live.

## Editing data in the browser (admin)

There's a password-gated editor at `/admin` for adding, editing, and deleting services without touching files. It's **off by default** and only turns on when you set a password:

    ADMIN_PASSWORD='choose-a-strong-password' node api/server.js

Then open http://localhost:8080/admin and sign in. Edits are written straight to `data/seed.json` and take effect immediately. With Docker, set the variable in your shell or a `.env` file before `docker compose up` (the compose file reads `ADMIN_PASSWORD` and mounts `./data` writable so saves persist).

**What the gate is and isn't.** The password is compared in constant time and exchanged for a short-lived signed token, so it's real access control for a self-hosted box. It is **not** a replacement for HTTPS: over plain `http://` the password crosses the wire in the clear. If you expose this instance beyond localhost, put it behind a reverse proxy with TLS. If `ADMIN_PASSWORD` is unset, the admin API is fully closed (fail-shut) and the site runs read-only.

## Stack

Plain Node (built-in `http` + `node:sqlite`), a static HTML/JS front-end, MapLibre for the map. No framework, no build step — chosen so it stays maintainable by many hands over many years. That longevity is the whole point.

## License

MIT.
