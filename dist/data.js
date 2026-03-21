/* ============================================
   Live data — populated at boot from either:
   - PostgreSQL via REST (pldHydrateCatalogFromRest in js/pld-events-sync.js) when API is reachable, or
   - Firestore emulator (js/pld-firebase.js) when API is unavailable.
   See docs/emulators-and-testing.md
   ============================================ */

/** Contract enums — see contracts/events.contract.md */
const PHASES = [
  'planning',
  'pre_production',
  'production',
  'post_production',
  'closed',
];

const PHASE_LABELS = {
  planning: 'Planning',
  pre_production: 'Pre-Production',
  production: 'Production',
  post_production: 'Post-Production',
  closed: 'Closed',
};

/** Phases treated as finished for dashboards / filters (global for other scripts) */
function isTerminalEventPhase(phase) {
  return phase === 'closed';
}

const FINANCIAL_CATEGORIES = [
  { label: 'Labor', key: 'labor', color: 'blue' },
  { label: 'Travel', key: 'travel', color: 'purple' },
  { label: 'Equipment', key: 'equipment', color: 'amber' },
  { label: 'Vendor', key: 'vendor', color: 'green' },
  { label: 'Per Diem', key: 'per_diem', color: 'cyan' },
  { label: 'Other', key: 'other', color: 'red' },
];

/** @type {Array<Record<string, unknown>>} */
let DEPARTMENTS = [];
/** @type {Array<Record<string, unknown>>} */
let CLIENTS = [];
/** @type {Array<Record<string, unknown>>} */
let VENUES = [];
/** @type {Array<Record<string, unknown>>} */
let VENDORS = [];
/** @type {Array<Record<string, unknown>>} */
let PERSONNEL = [];
/** @type {Array<Record<string, unknown>>} */
let TRUCKS = [];
/** @type {Array<Record<string, unknown>>} */
let TRUCK_ROUTES = [];
/** @type {Array<Record<string, unknown>>} */
let EVENTS = [];
/** @type {Array<Record<string, unknown>>} */
let TRAVEL_RECORDS = [];
/** @type {Array<Record<string, unknown>>} */
let DOCUMENTS = [];
/** @type {Array<Record<string, unknown>>} */
let EMAIL_TEMPLATES = [];
/** @type {Array<Record<string, unknown>>} */
let RIDER_ITEMS = [];
/** @type {Array<Record<string, unknown>>} */
let INVOICES = [];
/** @type {Array<Record<string, unknown>>} */
let ACTIVITY_LOG = [];

function getClient(id) {
  return CLIENTS.find((c) => c.id === id);
}
function getVenue(id) {
  if (id == null || id === '') {
    return { id: '', name: '—', city: '' };
  }
  return VENUES.find((v) => v.id === id) || { id, name: 'Unknown venue', city: '' };
}
function getVendor(id) {
  if (id == null || id === '') return null;
  return VENDORS.find((v) => v.id === id) || null;
}
function getPersonnel(id) {
  return PERSONNEL.find((p) => p.id === id);
}
function getDepartment(id) {
  const d = DEPARTMENTS.find((x) => x.id === id);
  if (d) return d;
  return {
    id: id == null ? '' : String(id),
    name: 'Unassigned',
    color: '#6366f1',
  };
}
function getTruck(id) {
  const t = TRUCKS.find((x) => x.id === id);
  if (t) return t;
  const rows =
    typeof window !== 'undefined' && Array.isArray(window.__pldTrucksApiRows)
      ? window.__pldTrucksApiRows
      : null;
  if (!rows) return undefined;
  const raw = rows.find((x) => x && x.id === id);
  if (!raw) return undefined;
  const loc =
    [raw.home_base, raw.location]
      .map((x) => (x != null ? String(x).trim() : ''))
      .find(Boolean) || '—';
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    status: raw.status,
    location: loc,
  };
}

function getPhaseCount(phase) {
  return EVENTS.filter((e) => e.phase === phase).length;
}

function formatCurrency(n) {
  return '$' + Number(n || 0).toLocaleString('en-US');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
