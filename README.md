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

## Adding your community's services

Edit `data/seed.json`. Each service needs a name, category, address, `latitude`, `longitude`, and ideally phone/hours/website. Categories are listed under `meta.taxonomy`. Restart and your data is live.

## Stack

Plain Node (built-in `http` + `node:sqlite`), a static HTML/JS front-end, MapLibre for the map. No framework, no build step — chosen so it stays maintainable by many hands over many years. That longevity is the whole point.

## License

MIT.
