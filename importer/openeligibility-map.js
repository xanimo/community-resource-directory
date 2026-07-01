// Maps this app's local service categories to the Open Eligibility taxonomy
// (github.com/openreferral/openeligibility) — the standard vocabulary HSDS
// recommends by default. Codes/names/parents are taken verbatim from Open
// Eligibility's taxonomy.csv so exported data lines up with other HSDS systems.
//
// Where Open Eligibility has no clean equivalent (e.g. free computer/internet
// access), we keep the term local rather than force a bad fit — HSDS explicitly
// supports overlaying a standard taxonomy and extending it locally.

// local category -> Open Eligibility term (or a local fallback)
export const CATEGORY_TO_OE = {
  food:       { code: '1102', name: 'Food',            taxonomy: 'Open Eligibility', parent_id: '' },
  housing:    { code: '1135', name: 'Emergency Shelter', taxonomy: 'Open Eligibility', parent_id: '1103' },
  medical:    { code: '1206', name: 'Medical Care',    taxonomy: 'Open Eligibility', parent_id: '1106' },
  hygiene:    { code: '1218', name: 'Personal Hygiene', taxonomy: 'Open Eligibility', parent_id: '1206' },
  legal:      { code: '1111', name: 'Legal',           taxonomy: 'Open Eligibility', parent_id: '' },
  // No suitable Open Eligibility parent for general tech/computer access; keep local.
  technology: { code: 'technology', name: 'Technology Access', taxonomy: 'local', parent_id: '' },
};

// Open Eligibility parent terms we should also emit so exported taxonomy_terms
// form a valid tree (a child references a parent_id that must resolve).
export const OE_PARENTS = {
  '1103': { code: '1103', name: 'Housing',     taxonomy: 'Open Eligibility', parent_id: '' },
  '1106': { code: '1106', name: 'Health',      taxonomy: 'Open Eligibility', parent_id: '' },
  '1206': { code: '1206', name: 'Medical Care', taxonomy: 'Open Eligibility', parent_id: '1106' },
};

// Resolve a local category to its taxonomy term descriptor.
export function mapCategory(category) {
  return CATEGORY_TO_OE[category] || { code: category, name: category, taxonomy: 'local', parent_id: '' };
}
