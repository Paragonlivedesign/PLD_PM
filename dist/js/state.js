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
let personnelView = 'directory';
let trucksView = 'fleet'; // 'fleet' | 'routes'
let calendarMonth = new Date(2026, 1); // Feb 2026 (shared by Scheduling and Dashboard calendar)
let dashboardScheduleView = 'calendar'; // 'calendar' | 'timeline' for dashboard overview card
let dashboardRole = 'pm'; // 'pm' | 'dept' | 'crew' | 'finance' | 'exec' — role-based dashboard layout
let eventEditingField = null; // 'name' | 'client' | 'venue' | 'dates' | 'priority' — which header field is being edited
let csvImportStep = 1; // 1=upload, 2=map, 3=preview, 4=confirm — personnel CSV import wizard
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
