#!/usr/bin/env node
// Bootstrap a new Community Resource Directory instance for your location.
//
// Two things make an instance local: a place config (where the map centers) and
// the services in it. This command sets up both:
//
//   1. Writes data/place.json from your inputs (name, center lat/lon, zoom).
//   2. Optionally imports starting data from an HSDS / OpenReferral source
//      (a local file/dir, or a URL to a hosted HSDS JSON or tabular package),
//      by handing off to importer/import-hsds.js.
//
// Nothing here is Bay Area specific. Run it once when you stand up your town.
//
// Usage:
//   node bin/bootstrap.js --name "Sonoma County" --lat 38.29 --lon -122.46 --zoom 10
//   node bin/bootstrap.js --name "Athens, GA" --lat 33.96 --lon -83.38 --zoom 12 \
//        --import ./athens-hsds.json
//   node bin/bootstrap.js --name "Springfield" --lat 39.80 --lon -89.64 \
//        --import https://example.org/hsds/springfield.json
//   node bin/bootstrap.js --example bay-area        # load the bundled example instance
//
// Flags:
//   --name <str>       Display name for your area (header + title).
//   --tagline <str>    Optional tagline (default "Find help near you").
//   --lat <num> --lon <num>   Map center (decimal degrees). Required unless --example.
//   --zoom <num>       Initial zoom (city ~12, county ~10, region ~8). Default 11.
//   --lang <code>      Default language (default "en").
//   --import <path|url>  HSDS source to seed data from (file, dir, or URL).
//   --example <name>   Load a bundled example (currently: bay-area). Ignores other flags.
//   --dry-run          Print what would be written without writing.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = join(ROOT, 'data');
const PLACE_PATH = join(DATA, 'place.json');
const SEED_PATH = join(DATA, 'seed.json');
const EXAMPLES = join(DATA, 'examples');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { a[key] = true; }
      else { a[key] = next; i++; }
    }
  }
  return a;
}

function die(msg) { console.error('bootstrap: ' + msg); process.exit(1); }

async function fetchToTemp(url) {
  // Node 22 has global fetch. Save to a temp file the importer can read.
  const res = await fetch(url);
  if (!res.ok) die(`could not fetch ${url} (HTTP ${res.status})`);
  const text = await res.text();
  const tmp = join(ROOT, '.bootstrap-import.json');
  writeFileSync(tmp, text);
  return tmp;
}

function runImporter(source, dryRun) {
  // Hand off to the existing, tested importer. --write unless dry-run.
  const args = [join(ROOT, 'importer', 'import-hsds.js'), source];
  if (!dryRun) args.push('--write');
  const r = spawnSync(process.execPath, args, { stdio: dryRun ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (r.status !== 0) die('import failed:\n' + (r.stderr || r.stdout || 'unknown error'));
  if (dryRun && r.stdout) {
    try { const d = JSON.parse(r.stdout); console.log(`  would import ${d.services?.length ?? 0} services`); }
    catch { console.log('  (import preview produced output)'); }
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));

  // --- Example mode: copy a bundled instance verbatim. ---
  if (a.example) {
    const seedSrc = join(EXAMPLES, `${a.example}.seed.json`);
    const placeSrc = join(EXAMPLES, `${a.example}.place.json`);
    if (!existsSync(seedSrc)) die(`no bundled example named "${a.example}" (looked for ${seedSrc})`);
    if (a['dry-run']) { console.log(`would copy ${a.example} example -> data/seed.json + data/place.json`); return; }
    copyFileSync(seedSrc, SEED_PATH);
    if (existsSync(placeSrc)) copyFileSync(placeSrc, PLACE_PATH);
    const n = JSON.parse(readFileSync(SEED_PATH, 'utf8')).services.length;
    console.log(`Loaded "${a.example}" example: ${n} services + place config.`);
    console.log('Start the server and open http://localhost:8080');
    return;
  }

  // --- Place config. ---
  if (a.lat === undefined || a.lon === undefined) {
    die('need --lat and --lon (or use --example). Try: node bin/bootstrap.js --name "My Town" --lat 40.7 --lon -74.0 --zoom 12');
  }
  const lat = Number(a.lat), lon = Number(a.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) die('lat/lon must be numbers (decimal degrees)');
  const zoom = a.zoom !== undefined ? Number(a.zoom) : 11;
  if (Number.isNaN(zoom)) die('zoom must be a number');

  const place = {
    name: a.name || 'Your Community',
    tagline: a.tagline || 'Find help near you',
    center: { lat, lon },
    zoom,
    fallback: { lat, lon },
    default_language: a.lang || 'en',
    languages: ['en', 'es'],
    categories: []
  };

  if (a['dry-run']) {
    console.log('would write data/place.json:');
    console.log(JSON.stringify(place, null, 2));
  } else {
    writeFileSync(PLACE_PATH, JSON.stringify(place, null, 2) + '\n');
    console.log(`Wrote data/place.json for "${place.name}" (center ${lat}, ${lon}, zoom ${zoom}).`);
  }

  // --- Optional data import. ---
  if (a.import && a.import !== true) {
    let source = a.import;
    if (/^https?:\/\//i.test(source)) {
      console.log(`Fetching HSDS data from ${source} ...`);
      source = await fetchToTemp(source);
    } else {
      source = resolve(process.cwd(), source);
      if (!existsSync(source)) die(`import source not found: ${source}`);
    }
    console.log('Importing services ...');
    runImporter(source, !!a['dry-run']);
  } else {
    console.log('No --import given: starting with a blank directory.');
    console.log('Add services via /admin, or import HSDS later with:');
    console.log('  node importer/import-hsds.js <file-or-dir> --write');
  }

  console.log('\nDone. Start the server (node api/server.js) and open http://localhost:8080');
}

main().catch((e) => die(e.message));
