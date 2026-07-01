// HSDS exporter — turns this app's flat seed.json into real OpenReferral / HSDS 3.x
// output that other systems (ORServices, a 2-1-1, any HSDS tool) can ingest.
//
// Our storage is denormalized: one record per service with organization name,
// address, phone, and hours inline. HSDS is normalized across linked tables.
// This exporter re-splits each record into the canonical HSDS objects and wires
// up the foreign keys, minting DETERMINISTIC ids (derived from the service id)
// so re-exports of unchanged data are byte-stable.
//
// Emits either serialization the spec allows:
//   --format tabular  (default) -> a datapackage: datapackage.json + one CSV per
//                                   HSDS table, written to an output directory
//                                   (optionally zipped with --zip).
//   --format json               -> a single dereferenced HSDS JSON service list.
//
// Column names below are the canonical HSDS 3.x fields (from the Open Referral
// specification datapackage.json), so output validates against the standard.
//
// Usage:
//   node importer/export-hsds.js                       # tabular into ./hsds-export/
//   node importer/export-hsds.js --out /tmp/pkg        # tabular into a chosen dir
//   node importer/export-hsds.js --zip                 # also write hsds-export.zip
//   node importer/export-hsds.js --format json > out.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mapCategory, OE_PARENTS } from './openeligibility-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED_PATH = join(ROOT, 'data', 'seed.json');

// ---- canonical HSDS 3.x columns (subset we can populate; others emitted empty) ----
const COLUMNS = {
  organizations: ['id','name','alternate_name','description','email','website','tax_status','tax_id','year_incorporated','legal_status','logo','uri','parent_organization_id'],
  services: ['id','organization_id','program_id','name','alternate_name','description','url','email','status','interpretation_services','application_process','fees_description','wait_time','fees','accreditations','eligibility_description','minimum_age','maximum_age','assured_date','assurer_email','licenses','alert','last_modified'],
  service_at_location: ['id','service_id','location_id','description'],
  locations: ['id','location_type','url','organization_id','name','alternate_name','description','transportation','latitude','longitude','external_identifier','external_identifier_type'],
  phones: ['id','location_id','service_id','organization_id','contact_id','service_at_location_id','number','extension','type','description'],
  addresses: ['id','location_id','attention','address_1','address_2','city','region','state_province','postal_code','country','address_type'],
  schedules: ['id','service_id','location_id','service_at_location_id','valid_from','valid_to','dtstart','timezone','until','count','wkst','freq','interval','byday','byweekno','bymonthday','byyearday','description','opens_at','closes_at','schedule_link','attending_type','notes'],
  taxonomy_terms: ['id','code','name','description','parent_id','taxonomy','language','taxonomy_id','term_uri'],
};

// Parse an inline address string ("121 Golden Gate Ave, San Francisco, CA 94102")
// back into HSDS address parts. Best-effort; unknown pieces left blank.
function splitAddress(addr) {
  const out = { address_1:'', city:'', state_province:'', postal_code:'', country:'US' };
  if (!addr) return out;
  const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length) out.address_1 = parts[0];
  if (parts.length >= 2) out.city = parts[1];
  // last chunk may be "CA 94102" or "CA" or "San Francisco, CA"
  const tail = parts.slice(2).join(' ').trim() || (parts.length === 2 ? '' : '');
  const m = (tail || parts[parts.length - 1] || '').match(/([A-Z]{2})\s*(\d{5})?/);
  if (m) { out.state_province = m[1]; if (m[2]) out.postal_code = m[2]; }
  return out;
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(cols, rows) {
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
  return lines.join('\n') + '\n';
}

// ---- build normalized HSDS tables from the flat seed ----
function build(seed) {
  const t = { organizations:[], services:[], service_at_location:[], locations:[], phones:[], addresses:[], schedules:[], taxonomy_terms:[] };
  const orgByName = new Map();       // dedupe organizations by name
  const taxSeen = new Map();         // dedupe taxonomy terms by category value

  for (const s of seed.services) {
    const sid = s.id;
    // organization (dedupe by name; synth id if repeated)
    let orgId;
    const orgName = s.organization || s.name;
    if (orgByName.has(orgName)) {
      orgId = orgByName.get(orgName);
    } else {
      orgId = `org-${sid}`;
      orgByName.set(orgName, orgId);
      t.organizations.push({ id: orgId, name: orgName, description: '', website: s.website || '', uri: '' });
    }
    // location
    const locId = `loc-${sid}`;
    t.locations.push({ id: locId, organization_id: orgId, name: s.name,
      latitude: s.latitude ?? '', longitude: s.longitude ?? '', location_type: 'physical' });
    // address
    const a = splitAddress(s.address);
    t.addresses.push({ id: `addr-${sid}`, location_id: locId, address_type: 'physical', ...a });
    // service
    t.services.push({ id: sid, organization_id: orgId, name: s.name,
      description: s.description || '', url: s.website || '', status: 'active',
      alert: s.needs_verification ? 'Unverified: confirm details with provider.' : '' });
    // service_at_location
    const salId = `sal-${sid}`;
    t.service_at_location.push({ id: salId, service_id: sid, location_id: locId, description: '' });
    // phone (attach to service_at_location)
    if (s.phone) t.phones.push({ id: `ph-${sid}`, service_at_location_id: salId, service_id: sid, location_id: locId, number: s.phone, type: 'voice' });
    // schedule (we only have a human string -> put it in description)
    if (s.hours) t.schedules.push({ id: `sch-${sid}`, service_at_location_id: salId, service_id: sid, location_id: locId, description: s.hours });
    // taxonomy term for the category, mapped to Open Eligibility where possible.
    // Key terms by their resolved code so the same OE term isn't emitted twice
    // (e.g. a 'medical' category and a 'hygiene' parent both resolving to 1206).
    if (s.category) {
      const oe = mapCategory(s.category);
      const termId = (code) => `tax-${code}`;
      // emit Open Eligibility parent chain first, deduped by code
      let pid = oe.parent_id;
      while (pid && OE_PARENTS[pid] && !taxSeen.has(pid)) {
        taxSeen.set(pid, termId(pid));
        const p = OE_PARENTS[pid];
        t.taxonomy_terms.push({ id: termId(pid), code: p.code, name: p.name,
          parent_id: p.parent_id ? termId(p.parent_id) : '', taxonomy: p.taxonomy, language: 'en' });
        pid = p.parent_id;
      }
      if (!taxSeen.has(oe.code)) {
        taxSeen.set(oe.code, termId(oe.code));
        t.taxonomy_terms.push({ id: termId(oe.code), code: oe.code, name: oe.name,
          parent_id: oe.parent_id ? termId(oe.parent_id) : '', taxonomy: oe.taxonomy, language: 'en' });
      }
    }
  }
  return t;
}

// ---- dereferenced JSON (service-oriented) ----
function toDereferencedJSON(seed) {
  return seed.services.map((s) => ({
    id: s.id, name: s.name, description: s.description || '', url: s.website || '', status: 'active',
    organization: { id: `org-${s.id}`, name: s.organization || s.name, website: s.website || '' },
    phones: s.phone ? [{ number: s.phone, type: 'voice' }] : [],
    service_at_locations: [{
      id: `sal-${s.id}`,
      location: {
        id: `loc-${s.id}`, name: s.name, latitude: s.latitude ?? null, longitude: s.longitude ?? null,
        addresses: [{ ...splitAddress(s.address), address_type: 'physical' }],
        schedules: s.hours ? [{ description: s.hours }] : [],
      },
    }],
    service_taxonomies: s.category ? [{ taxonomy_term: (() => { const oe = mapCategory(s.category); return { code: oe.code, name: oe.name, taxonomy: oe.taxonomy }; })() }] : [],
  }));
}

function main() {
  const args = process.argv.slice(2);
  const fmt = (args.includes('--format') ? args[args.indexOf('--format')+1] : 'tabular');
  const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out')+1] : join(ROOT, 'hsds-export'));
  const doZip = args.includes('--zip');
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));

  if (fmt === 'json') {
    process.stdout.write(JSON.stringify(toDereferencedJSON(seed), null, 2) + '\n');
    return;
  }

  const tables = build(seed);
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const SINGULAR = { organizations:'organization', services:'service', service_at_location:'service_at_location', locations:'location', phones:'phone', addresses:'address', schedules:'schedule', taxonomy_terms:'taxonomy_term' };
  const resources = [];
  for (const [name, cols] of Object.entries(COLUMNS)) {
    const file = `${name}.csv`;
    writeFileSync(join(outDir, file), toCSV(cols, tables[name]));
    resources.push({ name: SINGULAR[name] || name, path: file, profile: 'tabular-data-resource',
      schema: { fields: cols.map((c) => ({ name: c, type: 'string' })) } });
  }
  // datapackage descriptor
  writeFileSync(join(outDir, 'datapackage.json'), JSON.stringify({
    name: 'community-resource-directory-export',
    title: 'Community Resource Directory — HSDS export',
    description: 'HSDS 3.x tabular data package exported from the Community Resource Directory.',
    profile: 'tabular-data-package', version: '3.0.0',
    homepage: 'https://docs.openreferral.org',
    license: { name: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    resources,
  }, null, 2) + '\n');

  const counts = Object.entries(tables).map(([k, v]) => `${v.length} ${k}`).join(', ');
  console.error(`Wrote HSDS tabular package to ${outDir}\n  ${counts}`);

  if (doZip) {
    const zipPath = outDir + '.zip';
    if (existsSync(zipPath)) rmSync(zipPath);
    execFileSync('zip', ['-jrq', zipPath, outDir]);
    console.error(`Zipped -> ${zipPath}`);
  }
}

main();
