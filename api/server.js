// Community Resource Directory — API + admin
// Plain Node, zero framework. SQLite via node:sqlite (Node 22+).
// Serves HSDS-shaped services, a distance-sorted /nearby endpoint, and a
// password-gated admin API that persists edits back to data/seed.json.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_ENABLED, checkPassword, issueToken, verifyToken, bearerFrom } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED_PATH = join(ROOT, 'data', 'seed.json');
const PORT = process.env.PORT || 8080;

const COLS = ['id','name','organization','category','description','address','latitude','longitude','phone','hours','website'];

// ---- DB: in-memory SQLite, source of truth is data/seed.json ----
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE services (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, organization TEXT, category TEXT,
    description TEXT, address TEXT, latitude REAL, longitude REAL,
    phone TEXT, hours TEXT, website TEXT
  );
`);

let seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
let CATEGORIES = seed.meta?.taxonomy ?? [];

const insertStmt = db.prepare(`INSERT INTO services (${COLS.join(',')}) VALUES (${COLS.map(()=>'?').join(',')})`);
function rowVals(s){ return [s.id, s.name, s.organization??'', s.category??'', s.description??'', s.address??'', s.latitude??null, s.longitude??null, s.phone??'', s.hours??'', s.website??'']; }
function loadDB(){ db.exec('DELETE FROM services'); for (const s of seed.services) insertStmt.run(...rowVals(s)); }
loadDB();

function persist(){ writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + '\n'); }

// ---- Haversine distance in miles ----
function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
function json(res, code, body){ res.writeHead(code, {'content-type':'application/json','access-control-allow-origin':'*'}); res.end(JSON.stringify(body)); }

function readBody(req){
  return new Promise((resolve, reject) => {
    let data = ''; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new Error('body too large')); req.destroy(); } data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

// Validate/normalize an incoming service record. Returns {ok, record|error}.
function normalize(input, existingId){
  const r = {};
  r.name = String(input.name || '').trim();
  if (!r.name) return { ok:false, error:'name is required' };
  r.category = String(input.category || 'other').trim();
  r.organization = String(input.organization || '').trim();
  r.description = String(input.description || '').trim();
  r.address = String(input.address || '').trim();
  r.phone = String(input.phone || '').trim();
  r.hours = String(input.hours || '').trim();
  r.website = String(input.website || '').trim();
  const lat = Number(input.latitude), lon = Number(input.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok:false, error:'latitude and longitude must be numbers' };
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ok:false, error:'coordinates out of range' };
  r.latitude = lat; r.longitude = lon;
  r.id = existingId || String(input.id || '').trim() || r.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return { ok:true, record:r };
}

function requireAuth(req, res){
  if (!ADMIN_ENABLED) { json(res, 503, { error:'admin is disabled: set ADMIN_PASSWORD to enable' }); return false; }
  if (!verifyToken(bearerFrom(req))) { json(res, 401, { error:'unauthorized' }); return false; }
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // ---------- public read API ----------
  if (path === '/api/categories') return json(res, 200, { categories: CATEGORIES });

  if (path === '/api/services' && method === 'GET') {
    const cat = url.searchParams.get('category');
    const rows = cat ? db.prepare('SELECT * FROM services WHERE category = ?').all(cat)
                     : db.prepare('SELECT * FROM services').all();
    return json(res, 200, { services: rows });
  }

  if (path === '/api/nearby' && method === 'GET') {
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    const cat = url.searchParams.get('category');
    if (Number.isNaN(lat) || Number.isNaN(lon)) return json(res, 400, { error:'lat and lon query params are required' });
    const rows = (cat ? db.prepare('SELECT * FROM services WHERE category = ?').all(cat)
                      : db.prepare('SELECT * FROM services').all())
      .map((s) => ({ ...s, distance_miles: Math.round(distanceMiles(lat, lon, s.latitude, s.longitude)*100)/100 }))
      .sort((a,b) => a.distance_miles - b.distance_miles);
    return json(res, 200, { origin:{lat,lon}, services: rows });
  }

  // ---------- admin ----------
  if (path === '/api/admin/status') return json(res, 200, { enabled: ADMIN_ENABLED });

  if (path === '/api/admin/login' && method === 'POST') {
    if (!ADMIN_ENABLED) return json(res, 503, { error:'admin is disabled: set ADMIN_PASSWORD to enable' });
    let body; try { body = await readBody(req); } catch { return json(res, 400, { error:'bad request' }); }
    if (!checkPassword(body.password)) return json(res, 401, { error:'wrong password' });
    return json(res, 200, { token: issueToken() });
  }

  if (path === '/api/admin/services' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    let body; try { body = await readBody(req); } catch { return json(res, 400, { error:'bad request' }); }
    const n = normalize(body);
    if (!n.ok) return json(res, 400, { error:n.error });
    if (seed.services.some((s) => s.id === n.record.id)) return json(res, 409, { error:'a service with this id already exists' });
    seed.services.push(n.record);
    if (n.record.category && !CATEGORIES.includes(n.record.category)) { CATEGORIES.push(n.record.category); seed.meta.taxonomy = CATEGORIES; }
    persist(); loadDB();
    return json(res, 201, { service:n.record });
  }

  const editMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
  if (editMatch) {
    if (!requireAuth(req, res)) return;
    const id = decodeURIComponent(editMatch[1]);
    const idx = seed.services.findIndex((s) => s.id === id);
    if (idx < 0) return json(res, 404, { error:'not found' });
    if (method === 'DELETE') { const [removed] = seed.services.splice(idx,1); persist(); loadDB(); return json(res, 200, { deleted:removed.id }); }
    if (method === 'PUT') {
      let body; try { body = await readBody(req); } catch { return json(res, 400, { error:'bad request' }); }
      const n = normalize(body, id);
      if (!n.ok) return json(res, 400, { error:n.error });
      seed.services[idx] = n.record;
      if (n.record.category && !CATEGORIES.includes(n.record.category)) { CATEGORIES.push(n.record.category); seed.meta.taxonomy = CATEGORIES; }
      persist(); loadDB();
      return json(res, 200, { service:n.record });
    }
  }

  // ---------- static ----------
  let file = path === '/' ? '/index.html' : path === '/admin' ? '/admin.html' : path;
  try {
    const full = join(ROOT, 'web', file);
    if (!full.startsWith(join(ROOT, 'web'))) throw new Error('bad path');
    const bodyBuf = readFileSync(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] ?? 'application/octet-stream' });
    return res.end(bodyBuf);
  } catch {
    res.writeHead(404, { 'content-type':'text/plain' });
    return res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Community Resource Directory running on http://localhost:${PORT}`);
  console.log(`  ${seed.services.length} services loaded across ${CATEGORIES.length} categories`);
  console.log(`  admin: ${ADMIN_ENABLED ? 'enabled (/admin)' : 'disabled (set ADMIN_PASSWORD to enable)'}`);
});
