// HSDS importer — turns real OpenReferral / HSDS 3.0 data into this app's seed.json.
//
// Accepts either serialization the spec allows:
//   1. HSDS JSON       — a dereferenced service list (services with nested
//                        organization / locations / service_at_locations), OR a
//                        top-level {services:[...]} / {organizations,services,locations,...}.
//   2. Tabular package — a directory of CSVs (organizations.csv, services.csv,
//                        locations.csv, service_at_location.csv, addresses.csv),
//                        the "HSDS Zip"/datapackage form.
//
// It joins the relational model (service -> organization, service -> location via
// service_at_location -> location -> address) and flattens to the simple shape the
// v0 API serves: {id,name,organization,category,description,address,latitude,longitude,phone,hours,website}.
//
// Usage:
//   node importer/import-hsds.js path/to/hsds.json            > data/seed.json
//   node importer/import-hsds.js path/to/tabular_package_dir  > data/seed.json
//   node importer/import-hsds.js path/to/hsds.json --write    (writes data/seed.json in place)

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'data', 'seed.json');

// ---- tiny RFC4180-ish CSV parser (handles quotes, commas, newlines in quotes) ----
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function readCSVIfExists(dir, name) {
  const p = join(dir, name);
  return existsSync(p) ? parseCSV(readFileSync(p, 'utf8')) : [];
}

// ---- HSDS category: derived from service_taxonomy/taxonomy or category-ish fields ----
const KNOWN = ['food', 'housing', 'hygiene', 'medical', 'legal', 'technology'];
function guessCategory(...texts) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  const map = {
    food: ['food', 'meal', 'grocer', 'pantry', 'nutrition', 'breakfast', 'lunch', 'dinner'],
    housing: ['housing', 'shelter', 'homeless', 'bed', 'lodging', 'rent'],
    hygiene: ['hygiene', 'shower', 'laundry', 'restroom', 'bathe', 'sanitation'],
    medical: ['medical', 'health', 'clinic', 'dental', 'doctor', 'nurse', 'behavioral', 'mental'],
    legal: ['legal', 'law', 'attorney', 'advoca', 'rights', 'immigration'],
    technology: ['technology', 'computer', 'internet', 'wifi', 'digital', 'device'],
  };
  for (const [cat, words] of Object.entries(map)) {
    if (words.some((w) => hay.includes(w))) return cat;
  }
  return 'other';
}

// ---- format an HSDS address object/row into one line ----
function formatAddress(a) {
  if (!a) return '';
  const parts = [a.address_1, a.address_2, a.city, a.state_province, a.postal_code].filter(Boolean);
  return parts.join(', ');
}

// ---- format an HSDS schedule/regular_schedule into a short hours string ----
function formatHours(schedules) {
  if (!Array.isArray(schedules) || !schedules.length) return '';
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const out = schedules
    .map((s) => {
      const day = s.weekday || s.byday || (typeof s.wkst === 'number' ? DAYS[s.wkst] : '');
      const open = (s.opens_at || '').slice(0, 5);
      const close = (s.closes_at || '').slice(0, 5);
      if (open && close) return `${day ? day + ' ' : ''}${open}-${close}`.trim();
      return (s.description || '').trim();
    })
    .filter(Boolean);
  return out.join('; ');
}

// ---- Flatten one HSDS service (JSON, dereferenced) into our record ----
function flattenServiceJSON(svc) {
  const org = svc.organization || {};
  // location: prefer service_at_locations[].location, else svc.locations[0]
  let loc = null, addr = null, sched = [];
  const sal = Array.isArray(svc.service_at_locations) ? svc.service_at_locations : [];
  if (sal.length && sal[0].location) loc = sal[0].location;
  if (!loc && Array.isArray(svc.locations) && svc.locations.length) loc = svc.locations[0];
  if (loc) {
    addr = (Array.isArray(loc.addresses) && loc.addresses[0]) || loc.address || null;
    sched = loc.regular_schedule || loc.schedules || [];
  }
  const svcSched = svc.regular_schedule || svc.schedules || [];
  const phone =
    (Array.isArray(svc.phones) && svc.phones[0] && svc.phones[0].number) ||
    (Array.isArray(org.phones) && org.phones[0] && org.phones[0].number) ||
    (loc && Array.isArray(loc.phones) && loc.phones[0] && loc.phones[0].number) || '';
  const taxonomyText = (Array.isArray(svc.service_taxonomies) ? svc.service_taxonomies : svc.taxonomies || [])
    .map((t) => (t.taxonomy_term && t.taxonomy_term.name) || t.name || t.term || '')
    .join(' ');
  return {
    id: svc.id || svc.slug || (svc.name || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: svc.name || '',
    organization: org.name || '',
    category: guessCategory(taxonomyText, svc.name, svc.description),
    description: (svc.description || svc.short_description || '').trim(),
    address: formatAddress(addr),
    latitude: loc ? Number(loc.latitude) : null,
    longitude: loc ? Number(loc.longitude) : null,
    phone,
    hours: formatHours(sched.length ? sched : svcSched),
    website: svc.url || org.website || org.url || '',
  };
}

// ---- Build records from a tabular package (CSV directory) ----
function fromTabular(dir) {
  const organizations = readCSVIfExists(dir, 'organizations.csv');
  const services = readCSVIfExists(dir, 'services.csv');
  const locations = readCSVIfExists(dir, 'locations.csv');
  const sals = readCSVIfExists(dir, 'service_at_location.csv');
  const addresses = readCSVIfExists(dir, 'addresses.csv');
  const phones = readCSVIfExists(dir, 'phones.csv');
  const schedules = readCSVIfExists(dir, 'schedules.csv');

  const orgById = Object.fromEntries(organizations.map((o) => [o.id, o]));
  const locById = Object.fromEntries(locations.map((l) => [l.id, l]));
  const addrByLoc = {};
  for (const a of addresses) (addrByLoc[a.location_id] ||= []).push(a);
  const salsBySvc = {};
  for (const s of sals) (salsBySvc[s.service_id] ||= []).push(s);
  const phoneBySvc = {}, phoneByOrg = {}, phoneByLoc = {};
  for (const p of phones) {
    if (p.service_id) (phoneBySvc[p.service_id] ||= []).push(p.number);
    if (p.organization_id) (phoneByOrg[p.organization_id] ||= []).push(p.number);
    if (p.location_id) (phoneByLoc[p.location_id] ||= []).push(p.number);
  }
  const schedByLoc = {}, schedBySvc = {};
  for (const s of schedules) {
    if (s.location_id) (schedByLoc[s.location_id] ||= []).push(s);
    if (s.service_id) (schedBySvc[s.service_id] ||= []).push(s);
  }

  return services.map((svc) => {
    const org = orgById[svc.organization_id] || {};
    const svcSals = salsBySvc[svc.id] || [];
    const loc = svcSals.length ? locById[svcSals[0].location_id] : null;
    const addr = loc ? (addrByLoc[loc.id] || [])[0] : null;
    const sched = loc ? (schedByLoc[loc.id] || []) : (schedBySvc[svc.id] || []);
    const phone =
      (phoneBySvc[svc.id] || [])[0] ||
      (phoneByOrg[svc.organization_id] || [])[0] ||
      (loc && (phoneByLoc[loc.id] || [])[0]) || '';
    return {
      id: svc.id || (svc.name || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: svc.name || '',
      organization: org.name || '',
      category: guessCategory(svc.name, svc.description),
      description: (svc.description || svc.short_description || '').trim(),
      address: formatAddress(addr),
      latitude: loc ? Number(loc.latitude) : null,
      longitude: loc ? Number(loc.longitude) : null,
      phone,
      hours: formatHours(sched),
      website: svc.url || org.website || org.url || '',
    };
  });
}

// ---- Build records from HSDS JSON ----
function fromJSON(obj) {
  // Accept: [service,...] | {services:[...]} | {service:[...]} | {organizations,services,locations,...}
  let services = Array.isArray(obj) ? obj : obj.services || obj.service || null;
  if (services) return services.map(flattenServiceJSON);

  // Relational JSON (separate arrays) — join like the tabular path.
  if (obj.organizations || obj.locations) {
    const orgById = Object.fromEntries((obj.organizations || []).map((o) => [o.id, o]));
    const locById = Object.fromEntries((obj.locations || []).map((l) => [l.id, l]));
    const sals = obj.service_at_locations || obj.service_at_location || [];
    const salsBySvc = {};
    for (const s of sals) (salsBySvc[s.service_id] ||= []).push(s);
    return (obj.services || []).map((svc) => {
      const svcSals = salsBySvc[svc.id] || [];
      const loc = svcSals.length ? locById[svcSals[0].location_id] : null;
      return flattenServiceJSON({
        ...svc,
        organization: orgById[svc.organization_id] || svc.organization,
        service_at_locations: loc ? [{ location: loc }] : svc.service_at_locations,
      });
    });
  }
  throw new Error('Unrecognized HSDS JSON shape: expected an array of services, {services:[...]}, or relational {organizations,services,locations,...}.');
}

// ---- main ----
function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const input = args.find((a) => !a.startsWith('--'));
  if (!input) {
    console.error('Usage: node importer/import-hsds.js <hsds.json | tabular_dir> [--write]');
    process.exit(2);
  }
  const p = resolve(input);
  if (!existsSync(p)) { console.error('No such path: ' + p); process.exit(2); }

  let records;
  if (statSync(p).isDirectory()) {
    records = fromTabular(p);
  } else {
    records = fromJSON(JSON.parse(readFileSync(p, 'utf8')));
  }

  // Drop records with no usable coordinates (can't place on a map / sort by distance).
  const usable = records.filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  const dropped = records.length - usable.length;

  const taxonomy = [...KNOWN];
  if (usable.some((r) => r.category === 'other')) taxonomy.push('other');

  const out = {
    meta: {
      spec: 'HSDS-inspired (OpenReferral) minimal profile',
      note: `Imported from ${statSync(p).isDirectory() ? 'HSDS tabular package' : 'HSDS JSON'} at ${new Date().toISOString()}.`,
      taxonomy,
    },
    services: usable,
  };

  const json = JSON.stringify(out, null, 2);
  if (write) {
    writeFileSync(SEED_PATH, json + '\n');
    console.error(`Wrote ${usable.length} services to ${SEED_PATH}` + (dropped ? ` (dropped ${dropped} without coordinates)` : ''));
  } else {
    process.stdout.write(json + '\n');
    if (dropped) console.error(`Note: dropped ${dropped} record(s) without coordinates.`);
  }
}

main();
