// Community Resource Directory — v0 API
// Plain Node, zero framework. SQLite via node:sqlite (Node 22+).
// Serves HSDS-shaped services and a distance-sorted /nearby endpoint.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = process.env.PORT || 8080;

// ---- DB: in-memory SQLite seeded from data/seed.json ----
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organization TEXT,
    category TEXT,
    description TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    phone TEXT,
    hours TEXT,
    website TEXT
  );
`);

const seed = JSON.parse(readFileSync(join(ROOT, 'data', 'seed.json'), 'utf8'));
const insert = db.prepare(`
  INSERT INTO services (id, name, organization, category, description, address, latitude, longitude, phone, hours, website)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const s of seed.services) {
  insert.run(s.id, s.name, s.organization ?? '', s.category ?? '', s.description ?? '',
    s.address ?? '', s.latitude ?? null, s.longitude ?? null, s.phone ?? '', s.hours ?? '', s.website ?? '');
}
const CATEGORIES = seed.meta?.taxonomy ?? [];

// ---- Haversine distance in miles ----
function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // --- API ---
  if (path === '/api/categories') {
    return json(res, 200, { categories: CATEGORIES });
  }

  if (path === '/api/services') {
    const cat = url.searchParams.get('category');
    const rows = cat
      ? db.prepare('SELECT * FROM services WHERE category = ?').all(cat)
      : db.prepare('SELECT * FROM services').all();
    return json(res, 200, { services: rows });
  }

  if (path === '/api/nearby') {
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    const cat = url.searchParams.get('category');
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return json(res, 400, { error: 'lat and lon query params are required' });
    }
    const rows = (cat
      ? db.prepare('SELECT * FROM services WHERE category = ?').all(cat)
      : db.prepare('SELECT * FROM services').all())
      .map((s) => ({ ...s, distance_miles: Math.round(distanceMiles(lat, lon, s.latitude, s.longitude) * 100) / 100 }))
      .sort((a, b) => a.distance_miles - b.distance_miles);
    return json(res, 200, { origin: { lat, lon }, services: rows });
  }

  // --- static front-end ---
  let file = path === '/' ? '/index.html' : path;
  try {
    const full = join(ROOT, 'web', file);
    if (!full.startsWith(join(ROOT, 'web'))) throw new Error('bad path'); // no traversal
    const body = readFileSync(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] ?? 'application/octet-stream' });
    return res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Community Resource Directory v0 running on http://localhost:${PORT}`);
  console.log(`  ${seed.services.length} services loaded across ${CATEGORIES.length} categories`);
});
