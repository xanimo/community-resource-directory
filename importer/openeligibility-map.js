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
  garden:     { code: '1127', name: 'Community Gardens', taxonomy: 'Open Eligibility', parent_id: '1102' },
  housing:    { code: '1135', name: 'Emergency Shelter', taxonomy: 'Open Eligibility', parent_id: '1103' },
  medical:    { code: '1206', name: 'Medical Care',    taxonomy: 'Open Eligibility', parent_id: '1106' },
  hygiene:    { code: '1218', name: 'Personal Hygiene', taxonomy: 'Open Eligibility', parent_id: '1206' },
  dental:     { code: '1184', name: 'Dental Care',     taxonomy: 'Open Eligibility', parent_id: '1106' },
  transportation: { code: '1175', name: 'Transportation', taxonomy: 'Open Eligibility', parent_id: '1105' },
  // CSA / farm shares are a purchasing model, not a standard service term; local.
  csa: { code: 'csa', name: 'Farm Share (CSA)', taxonomy: 'local', parent_id: '' },
  // Domestic violence and sexual assault map to Open Eligibility "Help Escape
  // Violence" under Immediate Safety / Emergency.
  domestic_violence: { code: '1124', name: 'Help Escape Violence', taxonomy: 'Open Eligibility', parent_id: '1123' },
  // No dedicated Open Eligibility term for sexual-assault crisis services; keep local
  // (do NOT reuse the domestic-violence code — they are distinct services).
  sexual_assault:    { code: 'sexual_assault', name: 'Sexual Assault Support', taxonomy: 'local', parent_id: '' },
  // Mental-health crisis lines map to Counseling (verified OE 1220 under Prevent & Treat).
  mental_health_crisis: { code: '1220', name: 'Counseling', taxonomy: 'Open Eligibility', parent_id: '1219' },
  reentry: { code: 'reentry', name: 'Reentry', taxonomy: 'local', parent_id: '' },
  // Open Eligibility has no accurate term for abortion access (its closest,
  // "Family Planning" under Health Education, is a different thing) or for public
  // restrooms ("Personal Hygiene" means hygiene services/showers, not toilets).
  // Keep both local rather than force a misleading fit.
  abortion: { code: 'abortion', name: 'Abortion Access', taxonomy: 'local', parent_id: '' },
  bathroom: { code: 'bathroom', name: 'Public Restroom', taxonomy: 'local', parent_id: '' },
  legal:      { code: '1111', name: 'Legal',           taxonomy: 'Open Eligibility', parent_id: '' },
  legal_aid:  { code: '1375', name: 'Advocacy & Legal Aid', taxonomy: 'Open Eligibility', parent_id: '1111' },
  // Rapid-response / immigration-enforcement hotlines have no Open Eligibility
  // equivalent; keep local rather than force a bad fit.
  rapid_response: { code: 'rapid_response', name: 'Rapid Response', taxonomy: 'local', parent_id: '' },
  // Harm reduction / syringe services: Open Eligibility has no dedicated term
  // (it's health-adjacent but distinct); keep local.
  harm_reduction: { code: 'harm_reduction', name: 'Harm Reduction', taxonomy: 'local', parent_id: '' },
  // LGBTQ+ is an audience/population, not a service type — HSDS models that via
  // attributes, not the service taxonomy. Keep as a local findability tag.
  lgbtq: { code: 'lgbtq', name: 'LGBTQ+', taxonomy: 'local', parent_id: '' },
  // Infoshops, co-ops, and community commons have no Open Eligibility term; local.
  community_space: { code: 'community_space', name: 'Community Space', taxonomy: 'local', parent_id: '' },
  // No suitable Open Eligibility parent for general tech/computer access; keep local.
  technology: { code: 'technology', name: 'Technology Access', taxonomy: 'local', parent_id: '' },
};

// Open Eligibility parent terms we should also emit so exported taxonomy_terms
// form a valid tree (a child references a parent_id that must resolve).
export const OE_PARENTS = {
  '1111': { code: '1111', name: 'Legal',       taxonomy: 'Open Eligibility', parent_id: '' },
  '1102': { code: '1102', name: 'Food',        taxonomy: 'Open Eligibility', parent_id: '' },
  '1101': { code: '1101', name: 'Emergency',   taxonomy: 'Open Eligibility', parent_id: '' },
  '1123': { code: '1123', name: 'Immediate Safety', taxonomy: 'Open Eligibility', parent_id: '1101' },
  '1105': { code: '1105', name: 'Transit',     taxonomy: 'Open Eligibility', parent_id: '' },
  '1103': { code: '1103', name: 'Housing',     taxonomy: 'Open Eligibility', parent_id: '' },
  '1106': { code: '1106', name: 'Health',      taxonomy: 'Open Eligibility', parent_id: '' },
  '1206': { code: '1206', name: 'Medical Care', taxonomy: 'Open Eligibility', parent_id: '1106' },
  '1219': { code: '1219', name: 'Prevent & Treat', taxonomy: 'Open Eligibility', parent_id: '1206' },
};

// Resolve a local category to its taxonomy term descriptor.
export function mapCategory(category) {
  return CATEGORY_TO_OE[category] || { code: category, name: category, taxonomy: 'local', parent_id: '' };
}
