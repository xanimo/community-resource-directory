# Setting up for your community

This directory ships **blank** on purpose. Out of the box it's a working app with
no services and a map zoomed out to the whole country — a template, not someone
else's data. Two things make it *yours*: a **place config** (where the map lives)
and the **services** in it. Here's how to set both.

## The fastest path

```bash
node bin/bootstrap.js --name "Sonoma County" --lat 38.29 --lon -122.46 --zoom 10
```

That writes `data/place.json` for your area. Start the server and you'll have an
empty directory centered on your town, ready for you to add services.

To also pull in starting data from an HSDS / OpenReferral source in one step:

```bash
node bin/bootstrap.js --name "Athens, GA" --lat 33.96 --lon -83.38 --zoom 12 \
  --import ./athens-hsds.json
# or from a URL:
node bin/bootstrap.js --name "Springfield" --lat 39.80 --lon -89.64 \
  --import https://example.org/hsds/springfield.json
```

## The place config (`data/place.json`)

This is the **one file** that makes an instance local. Everything else in the app
is location-neutral. You can edit it by hand instead of using bootstrap:

```json
{
  "name": "Sonoma County",
  "tagline": "Find help near you",
  "center": { "lat": 38.29, "lon": -122.46 },
  "zoom": 10,
  "fallback": { "lat": 38.29, "lon": -122.46 },
  "default_language": "en",
  "languages": ["en", "es"],
  "categories": []
}
```

- **name** — shown in the header and browser title.
- **center / zoom** — where the map opens. City ~12–13, county ~10, region ~8.
- **fallback** — used to sort services when a visitor declines to share location.
  Usually the same as `center`.
- **categories** — leave `[]` to show every category present in your data, or
  list a subset (in the order you want the filter chips) to show only those.

## Getting services in

Three ways, smallest to largest:

1. **Hand-add** through the `/admin` editor (set `ADMIN_PASSWORD` first). Good for
   a few dozen entries you're verifying yourself.
2. **Import HSDS** — if your county 2-1-1 or a local open-data portal publishes
   [HSDS / OpenReferral](https://docs.openreferral.org) data, import it directly:
   ```bash
   node importer/import-hsds.js path/to/hsds.json --write
   node importer/import-hsds.js path/to/tabular_package_dir --write
   ```
   Many 2-1-1s will share an HSDS export if asked; this is how you go from empty
   to hundreds of real local records without hand-typing.
3. **Bootstrap with `--import`** — do the place config and the first import in one
   command (see above).

Every imported record is served as-is; if the source doesn't mark verification,
consider reviewing entries before promoting the site widely. A wrong address on a
survival directory sends someone to a locked door.

## Want to see a populated instance first?

The San Francisco Bay Area build (59 services across 15 categories) ships as a
bundled example so you can see what a filled-in directory looks like:

```bash
node bin/bootstrap.js --example bay-area
```

That copies the example into `data/seed.json` + `data/place.json`. Use it to
explore, then run your own bootstrap to reset to your town. (The example is also
just files in `data/examples/` you can read.)

## Deploying

Once your `place.json` and data are set, deploy as normal — see
[`deploy/`](deploy/) for the Docker + Caddy (automatic HTTPS) path and the
bare-host installer. Your `data/` directory (both `seed.json` and `place.json`)
is what makes the running instance yours; keep it mounted/persistent.
