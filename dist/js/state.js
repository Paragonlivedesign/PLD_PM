/* ============================================
   Module: Global State
   Depends on: none
   ============================================ */

let currentPage = 'dashboard';
let selectedPhaseFilter = null;
/** Events list: client filter (client UUID or '' for all) — UI + optional REST refetch */
let eventsClientFilterId = '';
let eventsSearchText = '';
/** 'start_date' | 'name' | 'budget' */
let eventsSortBy = 'start_date';
let eventsSortOrder = 'asc';
let scheduleView = 'timeline';
let scheduleWeekOffset = 0;
let travelTab = 'all';
let financialTab = 'overview';
let documentsTab = 'all';
let settingsTab = 'appearance';
let notificationsOpen = false;
let profileOpen = false;
let runningScheduleTab = 'running'; // default tab
let rsSettingsOpen = false;
let selectedEventId = null;
let eventPageTab = 'overview';
/** CRM org profile pages (client / vendor / venue) */
let selectedClientId = null;
let selectedVendorId = null;
let selectedVenueId = null;
let clientProfileTab = 'overview';
let vendorProfileTab = 'overview';
let venueProfileTab = 'overview';
/** Venue CRM profile: 'view' (read-only) vs 'edit' (forms) */
let venueProfileViewMode = 'view';
/** Contact profile: parent kind client | vendor | venue */
let selectedContactParentKind = '';
let selectedContactParentId = '';
let selectedContactId = '';
let contactProfileTab = 'overview';
/** Personnel full profile page */
let selectedPersonnelId = null;
let personnelProfileTab = 'basic';
let personnelView = 'directory';
let trucksView = 'fleet'; // 'fleet' | 'routes'
let calendarMonth = new Date(2026, 1); // Feb 2026 (shared by Scheduling and Dashboard calendar)
let dashboardScheduleView = 'calendar'; // 'calendar' | 'timeline' for dashboard overview card
let dashboardRole = 'pm'; // 'pm' | 'dept' | 'crew' | 'finance' | 'exec' — role-based dashboard layout
let eventEditingField = null; // 'name' | 'client' | 'venue' | 'dates' | 'priority' | 'all' — header edit mode
let csvImportStep = 1; // 1=upload, 2=map, 3=preview, 4=confirm — personnel CSV import wizard
/** Tasks / roadmap */
let selectedTaskId = null;
/** 'list' | 'console' | 'calendar' */
let tasksViewMode = 'list';
let taskDetailTab = 'overview';
let rsConfig = {
  sections: {
    departments: { visible: true, label: 'Departments' },
    notes: { visible: true, label: 'Notes' },
    trucks: { visible: true, label: 'Trucks' },
    flights: { visible: true, label: 'Flights' },
    crewTransport: { visible: true, label: 'Crew Transport' },
    logistics: { visible: true, label: 'Logistics' },
  },
  rows: {
    stage: true, rigging: true, audio: true, a2: true, cameras: true, led: true, delays: true,
    s7aud: true, s7lxled: true, s7rigdelay: true, j6truck: true, hotel: true,
    flights: true,
    van1: true, van2: true, personalVehicle: true, localCrew: true,
    warehouse: true, truck: true, callTime: true, drive: true, detail: true,
  },
  showOffDays: true,
  showEmptyCols: true,
  highlightShowDay: true,
  compactMode: false,
};

/**
 * When tenant context changes (JWT / login), drop in-memory selections and per-event caches
 * so we do not show another tenant's data or stale UUIDs.
 */
function pldClearTenantScopedClientState() {
  selectedEventId = null;
  selectedClientId = null;
  selectedVendorId = null;
  selectedVenueId = null;
  selectedPersonnelId = null;
  selectedTaskId = null;
  selectedContactId = '';
  selectedContactParentKind = '';
  selectedContactParentId = '';
  eventsClientFilterId = '';
  eventsSearchText = '';
  selectedPhaseFilter = null;
  eventEditingField = null;
  if (typeof window !== 'undefined' && window.__pldEventTravelByEventId) {
    window.__pldEventTravelByEventId = {};
  }
}
window.pldClearTenantScopedClientState = pldClearTenantScopedClientState;
