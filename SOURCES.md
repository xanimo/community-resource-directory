# Mutual-aid data sources

This directory is built in the tradition of community survival programs, not the
charity/referral model. That shapes where its data should come from. Government
2-1-1 systems and county portals are the institutional model — often means-tested,
frequently *not* openly available, and structurally the opposite of mutual aid.
The data that fits this project lives in the decentralized mutual-aid world:
community fridges, free markets, Food Not Bombs, harm-reduction networks, tool
libraries, seed libraries, and the like.

The value this project adds is gathering that scattered, deliberately
decentralized data into **one open standard (HSDS) with a map** — something the
mutual-aid world doesn't do for itself (by design) and the institutional-standards
world won't do (wrong scope). Sitting in that gap is the point.

This document is an honest map of what's out there, how usable each source is, and
how to bring it in. It is deliberately frank about what is *not* cleanly available,
so no one wastes effort chasing a feed that doesn't exist.

## How to read the "ingest" column

- **Direct import** — publishes structured, downloadable data (CSV/JSON/API) that
  an importer can consume. Rare, but the gold standard.
- **Scrape + verify** — data is public but embedded in a web page or JS map with no
  open export. Requires extraction, then human verification before publishing.
- **Hand-curate** — a prose list or directory; read it, confirm each entry, enter
  by hand or via `/admin`. Slowest, most reliable.

Every source below, regardless of method, feeds the same rule this project already
follows: **entries are flagged `needs_verification` until a human confirms them.**
Mutual-aid data is especially volatile — fridges and servings appear and vanish —
so freshness matters more here than for institutional data.

## Food

| Source | What it is | Coverage | Ingest | Volatility |
|---|---|---|---|---|
| [freedge.org](https://freedge.org/locations/) | Global community-fridge map + database (location, contact, hours) | Worldwide | Scrape + verify (JS map; no documented open API) | High — fridges move/close often; freedge asks for email reports of dead ones |
| [Food Not Bombs](https://foodnotbombs.net/) | Chapter list + serving times/locations | Worldwide, per-chapter | Hand-curate (prose per chapter; the site itself warns details drift) | High — volunteer-run, locations shift |
| Local community-fridge apps (e.g. NYC "Fridge Finder", regional maps) | City-specific fridge maps | Per-city | Scrape + verify | High |
| Really Really Free Markets | Free swap events | Local, event-based | Hand-curate | Very high — often one-off events |

## Harm reduction

| Source | What it is | Coverage | Ingest | Volatility |
|---|---|---|---|---|
| [NASEN directory](https://nasen.org/) | Opt-in national directory of syringe services programs; programs control their listing | US | Hand-curate / ask NASEN (opt-in data) | Medium |
| [NHRC / CA syringe programs](https://harmreduction.org/) | Harm-reduction program map/list | US / CA | Scrape + verify | Medium |
| Regional collabs (e.g. East Bay Getting to Zero) | Kept-current cross-org contact lists | Regional | Hand-curate (often the freshest local truth) | Medium |

## Reproductive & bodily-safety access

| Source | What it is | Coverage | Ingest | Volatility |
|---|---|---|---|---|
| [AbortionFinder](https://www.abortionfinder.org) | Largest directory of **verified** abortion providers; screens out fake "crisis pregnancy centers" (CPCs) | US | Hand-curate / link (their search is the safe entry point) | Medium |
| [ACCESS Reproductive Justice](https://accessrj.org) | California abortion fund + practical-support volunteer network (rides, funding, doula support) — mutual-aid model | CA | Hand-curate | Low |
| [National Abortion Federation hotline](https://prochoice.org) | Hotline to verified providers + financial aid | US | Hand-curate | Low |

> **CPC safety note.** Never map individual abortion-clinic addresses from an
> unverified source. Fake "crisis pregnancy centers" deliberately pose as clinics
> to dissuade people. Point only to directories that screen them out
> (AbortionFinder, NAF, Planned Parenthood's own finder). This is why this
> project's abortion entries link to *verified directories and funds*, not scraped
> clinic pins.

## Public restrooms

| Source | What it is | Coverage | Ingest | Volatility |
|---|---|---|---|---|
| [SF Public Bathroom Map (DataSF)](https://data.sfgov.org/City-Infrastructure/Map-of-Public-Bathrooms/sxtt-wsyn) | **Real open dataset** of city restrooms + drinking fountains (the county-portal exception) | San Francisco | **Direct import** via Socrata: `https://data.sfgov.org/resource/sxtt-wsyn.csv?$limit=999999` | Low–medium |
| [SF Pit Stop program](https://sfpublicworks.org/pitstop) | Staffed public toilets in high-need neighborhoods, some 24-hour | San Francisco | Hand-curate (page lists sites + hours) | Medium (sites/hours change) |
| OpenStreetMap `amenity=toilets` | Crowd-mapped public toilets worldwide | Worldwide | Direct import (Overpass API) | Medium |

## Tools, seeds, repair

| Source | What it is | Coverage | Ingest | Volatility |
|---|---|---|---|---|
| [Local Tools / localtools.org](https://localtools.org/find/) | Directory of tool-lending libraries | US + intl | Scrape + verify | Low — libraries are stable |
| Seed libraries (various registries) | Free seed-sharing at public libraries | Regional | Hand-curate | Low |
| Repair Café / iFixit repair directories | Community repair events/spaces | Worldwide | Scrape + verify | Medium (events) |

## Networks & aggregators

| Source | What it is | Coverage | Ingest | Volatility |
|---|---|---|---|---|
| Mutual Aid Hub / regional mutual-aid network maps | Directories of local mutual-aid groups | US | Scrape + verify | Medium |
| [Radical Guide](https://www.radical-guide.com/) | Directory of infoshops, co-ops, social centers | Worldwide | Hand-curate | Low–medium |
| Local "survive [city]" resource guides | Community-compiled resource lists | Per-city | Hand-curate | Medium |

## What is NOT cleanly available (don't chase these expecting a feed)

- **2-1-1 data.** Run regionally (in the Bay Area by several county operators). Most
  do **not** publish an open, downloadable HSDS dataset — access is via the 2-1-1
  phone/text service or a search UI, sometimes a licensed partner API. United Way's
  National 211 Data Platform aggregates 211 data as HSDS but is **partner-credentialed,
  not a public download**. If you want this data, the realistic path is to *ask* a
  local 211 for a data-sharing arrangement, not to fetch it.
- **County open-data portals** (data.sfgov.org, data.acgov.org, etc.) publish
  *government* datasets. Their "human services" data tends to be **finance** (e.g.
  nonprofit contract spending), not resource directories with addresses and hours.
  Occasionally a usable slice appears (a shelter or facilities list); those are
  one-off CSVs in their own schema, mappable individually via the Socrata API
  pattern `https://<portal>/resource/<id>.csv?$limit=999999` — but they are the
  exception, and they are institutional, not mutual-aid, data.

## Turning a source into entries

1. **Get the data.** Direct import → fetch it. Scrape → extract to CSV/JSON.
   Hand-curate → read the source.
2. **Map to this app's shape** (`id, name, organization, category, description,
   address, latitude, longitude, phone, hours, website`). If the source is already
   HSDS, use `importer/import-hsds.js`. If it's an arbitrary CSV, write a small
   mapping (see `importer/` for patterns) or enter via `/admin`.
3. **Flag `needs_verification: true`** on every record, and add a
   `verification_note` for anything mobile, volunteer-run, or event-based.
4. **Verify before promoting.** For mutual-aid data especially, confirm the entry
   is still live. A dead community fridge or a moved serving is exactly the "locked
   door" this project exists to prevent.

## A note on method

Hand-curation isn't a stopgap here — it's often the *correct* method, because the
freshest truth about a community fridge or a weekly serving lives with the people
who run it, not in any feed. Tooling helps at scale, but the human step of
confirming an entry is care work, not overhead. Build importers where a source is
genuinely structured and stable; hand-curate where it isn't; and don't fake a feed
that doesn't exist.
