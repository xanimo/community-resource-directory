#!/usr/bin/env node
// Build a static snapshot of the directory for GitHub Pages (or any dumb host).
//
// Pages serves files, not Node, so the read endpoints the front-end uses
// (/api/place, /api/categories, /api/services, /api/nearby) are baked to JSON at
// build time and answered in the browser by a fetch shim. The shim also fakes
// the admin API against sessionStorage, so /admin is clickable in the demo and
// edits last until the tab closes. Same web/*.html, same data/seed.json.
//
// Usage:
//   node bin/build-static.js                    # -> dist/
//   node bin/build-static.js --out public
//   node bin/build-static.js --admin-password letmein
//   node bin/build-static.js --repo-url https://github.com/you/your-fork

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED_PATH = join(ROOT, 'data', 'seed.json');
const PLACE_PATH = join(ROOT, 'data', 'place.json');
const WEB = join(ROOT, 'web');

// Same defaults api/server.js falls back to, so the snapshot and the served app
// answer /api/place identically.
const DEFAULT_PLACE = { name:'Your Community', tagline:'Find help near you',
  center:{lat:39.8283,lon:-98.5795}, zoom:4, fallback:{lat:39.8283,lon:-98.5795},
  default_language:'en', languages:['en','es'], categories:[] };

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[k.slice(2)] = true;
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}
function opt(a, name, fallback) { return a[name] && a[name] !== true ? a[name] : fallback; }
function die(msg) { console.error('build-static: ' + msg); process.exit(1); }

// The server hands out rows read back from SQLite, so empty strings and 0/1
// flags rather than undefined. Match that shape.
function row(s) {
  return { id:s.id, name:s.name, organization:s.organization ?? '', category:s.category ?? '',
    description:s.description ?? '', address:s.address ?? '',
    latitude:s.latitude ?? null, longitude:s.longitude ?? null,
    phone:s.phone ?? '', hours:s.hours ?? '', website:s.website ?? '',
    needs_verification:s.needs_verification ? 1 : 0, contact_only:s.contact_only ? 1 : 0 };
}

// Replaces the whole API in the browser: reads come from the baked JSON, writes
// go to sessionStorage. Mirrors api/server.js closely enough that the same
// front-end code runs unmodified against it.
function shim(password) {
  return `// Answers the app's /api/* calls without a server. Reads come from the JSON
// baked next to this file; admin writes go to sessionStorage and are gone when
// the tab closes. Filtering and distance sorting happen here instead of SQLite.
(function () {
  var real = window.fetch.bind(window);
  var BASE = new URL('.', document.baseURI).href;
  var KEY = 'crd-demo-state';
  var PASSWORD = ${JSON.stringify(password)};
  var TOKEN = 'demo-session-token';
  var state = null;

  function baked() {
    return Promise.all([
      real(BASE + 'api/services.json').then(function (r) { return r.json(); }),
      real(BASE + 'api/categories.json').then(function (r) { return r.json(); })
    ]).then(function (d) { return { services: d[0].services, categories: d[1].categories }; });
  }
  function load() {
    if (state) return Promise.resolve(state);
    try {
      var raw = sessionStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); return Promise.resolve(state); }
    } catch (e) { /* private mode: fall through to the baked copy */ }
    return baked().then(function (s) { state = s; return s; });
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function reply(body, code) {
    return new Response(JSON.stringify(body), { status: code || 200, headers: { 'content-type': 'application/json' } });
  }
  function distanceMiles(lat1, lon1, lat2, lon2) {
    var toRad = function (d) { return d * Math.PI / 180; };
    var R = 3958.8;
    var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.pow(Math.sin(dLat / 2), 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  // Same validation the server applies before it writes a record.
  function normalize(input, existingId) {
    var r = {};
    r.name = String(input.name || '').trim();
    if (!r.name) return { ok: false, error: 'name is required' };
    r.category = String(input.category || 'other').trim();
    r.organization = String(input.organization || '').trim();
    r.description = String(input.description || '').trim();
    r.address = String(input.address || '').trim();
    r.phone = String(input.phone || '').trim();
    r.hours = String(input.hours || '').trim();
    r.website = String(input.website || '').trim();
    var lat = Number(input.latitude), lon = Number(input.longitude);
    if (!isFinite(lat) || !isFinite(lon)) return { ok: false, error: 'latitude and longitude must be numbers' };
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ok: false, error: 'coordinates out of range' };
    r.latitude = lat; r.longitude = lon;
    r.id = existingId || String(input.id || '').trim()
      || r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return { ok: true, record: r };
  }
  function authed(init) {
    var h = (init && init.headers) || {};
    var v = h.authorization || h.Authorization || '';
    return v === 'Bearer ' + TOKEN;
  }
  function body(init) {
    try { return init && init.body ? JSON.parse(init.body) : {}; } catch (e) { return null; }
  }

  window.fetch = function (input, init) {
    var href = typeof input === 'string' ? input : (input && input.url) || '';
    var url;
    try { url = new URL(href, location.href); } catch (e) { return real(input, init); }
    var p = url.pathname;
    var method = ((init && init.method) || 'GET').toUpperCase();
    var cat = url.searchParams.get('category');

    var edit = p.match(/\\/api\\/admin\\/services\\/([^/]+)$/);
    if (edit) {
      if (!authed(init)) return Promise.resolve(reply({ error: 'unauthorized' }, 401));
      var id = decodeURIComponent(edit[1]);
      return load().then(function (s) {
        var i = s.services.findIndex(function (x) { return x.id === id; });
        if (i < 0) return reply({ error: 'not found' }, 404);
        if (method === 'DELETE') { var gone = s.services.splice(i, 1)[0]; save(); return reply({ deleted: gone.id }); }
        if (method === 'PUT') {
          var b = body(init);
          if (!b) return reply({ error: 'bad request' }, 400);
          var n = normalize(b, id);
          if (!n.ok) return reply({ error: n.error }, 400);
          s.services[i] = n.record;
          if (n.record.category && s.categories.indexOf(n.record.category) < 0) s.categories.push(n.record.category);
          save();
          return reply({ service: n.record });
        }
        return reply({ error: 'not found' }, 404);
      });
    }

    if (/\\/api\\/admin\\/services$/.test(p) && method === 'POST') {
      if (!authed(init)) return Promise.resolve(reply({ error: 'unauthorized' }, 401));
      var nb = body(init);
      if (!nb) return Promise.resolve(reply({ error: 'bad request' }, 400));
      var na = normalize(nb);
      if (!na.ok) return Promise.resolve(reply({ error: na.error }, 400));
      return load().then(function (s) {
        if (s.services.some(function (x) { return x.id === na.record.id; }))
          return reply({ error: 'a service with this id already exists' }, 409);
        s.services.push(na.record);
        if (na.record.category && s.categories.indexOf(na.record.category) < 0) s.categories.push(na.record.category);
        save();
        return reply({ service: na.record }, 201);
      });
    }

    if (/\\/api\\/admin\\/status$/.test(p)) return Promise.resolve(reply({ enabled: true }));

    if (/\\/api\\/admin\\/login$/.test(p) && method === 'POST') {
      var lb = body(init) || {};
      if (lb.password !== PASSWORD) return Promise.resolve(reply({ error: 'wrong password' }, 401));
      return Promise.resolve(reply({ token: TOKEN }));
    }

    // Only the read endpoints, matched exactly so this shim's own .json loads
    // (and anything else) fall through to the network.
    var m = p.match(/\\/api\\/(place|categories|services|nearby)$/);
    if (!m) return real(input, init);

    if (m[1] === 'place') return real(BASE + 'api/place.json').then(function (r) { return r.json(); }).then(reply);
    if (m[1] === 'categories') return load().then(function (s) { return reply({ categories: s.categories }); });

    return load().then(function (s) {
      var rows = cat ? s.services.filter(function (x) { return x.category === cat; }) : s.services;
      if (m[1] === 'services') return reply({ services: rows });
      var lat = parseFloat(url.searchParams.get('lat')), lon = parseFloat(url.searchParams.get('lon'));
      if (isNaN(lat) || isNaN(lon)) return reply({ error: 'lat and lon query params are required' }, 400);
      rows = rows.map(function (x) {
        var o = Object.assign({}, x);
        o.distance_miles = Math.round(distanceMiles(lat, lon, x.latitude, x.longitude) * 100) / 100;
        return o;
      }).sort(function (a, b) { return a.distance_miles - b.distance_miles; });
      return reply({ origin: { lat: lat, lon: lon }, services: rows });
    });
  };
})();
`;
}

const DEMO_CSS = `<style>
  .demo-note { max-width: 40rem; margin: 0 auto 24px; padding: 12px 16px; font-size: 13px;
    line-height: 1.5; color: #5a5a5a; text-align: center; }
  .demo-note code { font-size: 12px; background: #f0f0ee; padding: 1px 5px; border-radius: 4px; }
  .demo-note a { color: #1f5c46; }
</style>`;

function indexNote(repoUrl, password) {
  return `<div class="demo-note">
  Static demo built from <code>data/seed.json</code>: no server, no tracking, nothing written down.
  Entries are unverified sample data, so confirm anything here with the provider before relying on it.
  The <a href="admin.html">admin editor</a> is live too (password <code>${password}</code>); its edits
  stay in this browser tab. <a href="${repoUrl}">Run your own</a>.
</div>
${DEMO_CSS}`;
}

function adminNote(password) {
  return `<p class="note">Demo instance: the password is <code>${password}</code>. There is no server
    behind this page, so edits live in this browser tab only and vanish when you close it. On a real
    instance this password is checked server-side and edits persist to <code>data/seed.json</code>.</p>`;
}

const a = parseArgs(process.argv.slice(2));
const OUT = resolve(process.cwd(), opt(a, 'out', 'dist'));
const REPO_URL = opt(a, 'repo-url', 'https://github.com/xanimo/community-resource-directory');
const PASSWORD = opt(a, 'admin-password', 'demo');

let seed, place, index, admin;
try { seed = JSON.parse(readFileSync(SEED_PATH, 'utf8')); } catch (e) { die('cannot read data/seed.json: ' + e.message); }
try { place = { ...DEFAULT_PLACE, ...JSON.parse(readFileSync(PLACE_PATH, 'utf8')) }; } catch { place = DEFAULT_PLACE; }
try { index = readFileSync(join(WEB, 'index.html'), 'utf8'); } catch (e) { die('cannot read web/index.html: ' + e.message); }
try { admin = readFileSync(join(WEB, 'admin.html'), 'utf8'); } catch (e) { die('cannot read web/admin.html: ' + e.message); }

const services = (seed.services ?? []).map(row);
const taxonomy = seed.meta?.taxonomy ?? [];
const pinned = Array.isArray(place.categories) ? place.categories.filter(Boolean) : [];
const categories = pinned.length ? pinned : taxonomy;

// Each rewrite below asserts first: a silently-skipped patch ships a demo that
// looks fine and 404s in the browser.
function must(html, needle, what) {
  if (!html.includes(needle)) die(`web/${what} no longer contains ${JSON.stringify(needle)}; update this script`);
  return html;
}

const SHIM_TAG = '<script src="static-api.js"></script>\n';

// index.html: the footer "Open data" link points at the live endpoint, and the
// baked file is the open data here.
index = must(index, 'href="/api/services"', 'index.html').replaceAll('href="/api/services"', 'href="api/services.json"');
const MAPLIBRE = '<script src="https://unpkg.com/maplibre-gl';
index = must(index, MAPLIBRE, 'index.html').replace(MAPLIBRE, SHIM_TAG + MAPLIBRE);
index = must(index, '</footer>', 'index.html').replace('</footer>', '</footer>\n' + indexNote(REPO_URL, PASSWORD));

// admin.html: absolute links break under a project-page subpath, and the
// plain-HTTP password warning is about a server this build doesn't have.
const VIEW_SITE = '<a href="/">View site';
admin = must(admin, VIEW_SITE, 'admin.html').replace(VIEW_SITE, '<a href="./">View site');
const HTTP_WARNING = '<p class="note">Note: over plain HTTP this password is sent in the clear. If this instance is exposed to the internet, put it behind an HTTPS reverse proxy.</p>';
admin = must(admin, HTTP_WARNING, 'admin.html').replace(HTTP_WARNING, adminNote(PASSWORD));
admin = must(admin, '<script>', 'admin.html').replace('<script>', SHIM_TAG + '<script>');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'api'), { recursive: true });
writeFileSync(join(OUT, 'index.html'), index);
writeFileSync(join(OUT, 'admin.html'), admin);
writeFileSync(join(OUT, 'static-api.js'), shim(PASSWORD));
writeFileSync(join(OUT, 'api', 'place.json'), JSON.stringify({ place }, null, 2) + '\n');
writeFileSync(join(OUT, 'api', 'categories.json'), JSON.stringify({ categories }, null, 2) + '\n');
writeFileSync(join(OUT, 'api', 'services.json'), JSON.stringify({ services }, null, 2) + '\n');
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`Built static snapshot in ${OUT}`);
console.log(`  ${services.length} services across ${categories.length} categories, centered on "${place.name}"`);
console.log(`  admin editor at admin.html, sandboxed, password "${PASSWORD}"`);
console.log('  Preview it with: npx serve dist   (or any static file server)');
