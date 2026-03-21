/* ============================================
   Module: Page Router
   Depends on: all page render modules (dashboard, events, etc.)
   ============================================ */

/**
 * @param {string} page
 * @param {{ skipModuleDataFetch?: boolean }} [opts] Pass `{ skipModuleDataFetch: true }` after async
 *   page data loads so we do not re-schedule the same fetch (infinite loop with documents/trucks/etc.).
 */
function renderPage(page, opts) {
  opts = opts || {};
  const content = document.getElementById('pageContent');
  if (!content) return;
  content.scrollTop = 0;
  var html = '';
  switch (page) {
    case 'dashboard': html = typeof renderDashboard === 'function' ? renderDashboard() : ''; break;
    case 'events': html = typeof renderEvents === 'function' ? renderEvents() : ''; break;
    case 'scheduling': html = typeof renderScheduling === 'function' ? renderScheduling() : ''; break;
    case 'event': html = typeof renderEventPage === 'function' ? renderEventPage() : ''; break;
    case 'personnel': html = typeof renderPersonnel === 'function' ? renderPersonnel() : ''; break;
    case 'trucks': html = typeof renderTrucks === 'function' ? renderTrucks() : ''; break;
    case 'travel': html = typeof renderTravel === 'function' ? renderTravel() : ''; break;
    case 'financial': html = typeof renderFinancial === 'function' ? renderFinancial() : ''; break;
    case 'documents': html = typeof renderDocuments === 'function' ? renderDocuments() : ''; break;
    case 'clients': html = typeof renderClients === 'function' ? renderClients() : ''; break;
    case 'venues': html = typeof renderVenues === 'function' ? renderVenues() : ''; break;
    case 'vendors': html = typeof renderVendors === 'function' ? renderVendors() : ''; break;
    case 'settings': html = typeof renderSettings === 'function' ? renderSettings() : ''; break;
    case 'platform-admin':
      html = typeof renderPlatformAdmin === 'function' ? renderPlatformAdmin() : '';
      break;
    case 'login': html = typeof renderAuthLogin === 'function' ? renderAuthLogin() : ''; break;
    case 'forgot-password': html = typeof renderAuthForgotPassword === 'function' ? renderAuthForgotPassword() : ''; break;
    case 'reset-password': html = typeof renderAuthResetPassword === 'function' ? renderAuthResetPassword() : ''; break;
    case 'invite-accept': html = typeof renderAuthInviteAccept === 'function' ? renderAuthInviteAccept() : ''; break;
    case 'account': html = typeof renderAuthAccount === 'function' ? renderAuthAccount() : ''; break;
    case 'invite-user': html = typeof renderAuthInviteAdmin === 'function' ? renderAuthInviteAdmin() : ''; break;
    default: html = '<div class="empty-state"><h3>Page not found</h3></div>';
  }
  content.innerHTML = html;
  if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
  // Post-render: make dashboard stat cards clickable
  if (page === 'dashboard') {
    setTimeout(() => {
      const cards = content.querySelectorAll('.stat-card');
      const pages = ['events','events','personnel','financial'];
      cards.forEach((card, i) => { if (pages[i]) { card.style.cursor = 'pointer'; card.addEventListener('click', () => navigateTo(pages[i])); } });
      if (typeof dashboardScheduleView !== 'undefined' && dashboardScheduleView === 'timeline' && typeof initScheduleTimelineDraw === 'function') {
        initScheduleTimelineDraw();
        if (typeof initScheduleTimelineBarDnD === 'function') initScheduleTimelineBarDnD();
      }
      if (typeof pldHydrateDashboardFromApi === 'function') pldHydrateDashboardFromApi();
    }, 0);
  }
  if (page === 'scheduling') {
    setTimeout(() => {
      if (scheduleView === 'api') {
        if (typeof pldHydrateSchedulingSheet === 'function') pldHydrateSchedulingSheet();
      } else if (scheduleView === 'timeline') {
        initScheduleTimelineDraw();
        if (typeof initScheduleTimelineBarDnD === 'function') initScheduleTimelineBarDnD();
      } else initScheduleCalendarClickAndDraw();
    }, 0);
  }
  if (!opts.skipModuleDataFetch) {
    if (page === 'trucks' && typeof fetchTrucksFromApiIfConfigured === 'function') {
      setTimeout(() => fetchTrucksFromApiIfConfigured(), 0);
    }
    if (page === 'personnel' && typeof fetchPersonnelFromApiIfConfigured === 'function') {
      setTimeout(() => {
        void (async () => {
          await fetchPersonnelFromApiIfConfigured();
          if (
            typeof personnelView !== 'undefined' &&
            personnelView === 'availability' &&
            typeof loadPersonnelAvailabilityGridFromApi === 'function'
          ) {
            loadPersonnelAvailabilityGridFromApi();
          }
        })();
      }, 0);
    }
    if (page === 'documents' && typeof fetchDocumentsFromApiIfConfigured === 'function') {
      setTimeout(() => fetchDocumentsFromApiIfConfigured(), 0);
    }
    if (page === 'travel' && typeof pldFetchGlobalTravelIfConfigured === 'function') {
      setTimeout(() => pldFetchGlobalTravelIfConfigured(), 0);
    }
    if (page === 'clients' && typeof pldFetchClientsFromApiIfConfigured === 'function') {
      setTimeout(() => {
        const q =
          typeof window.__pldClientsListSearch === 'string' ? window.__pldClientsListSearch : '';
        void pldFetchClientsFromApiIfConfigured(q);
      }, 0);
    }
    if (page === 'financial' && typeof pldHydrateFinancialFromApi === 'function') {
      setTimeout(() => pldHydrateFinancialFromApi(), 0);
    }
    if (page === 'vendors' && typeof window.pldRefreshVendorsFromApiIfConfigured === 'function') {
      setTimeout(() => {
        void (async () => {
          await window.pldRefreshVendorsFromApiIfConfigured();
          if (typeof renderPage === 'function') renderPage('vendors', { skipModuleDataFetch: true });
        })();
      }, 0);
    }
    if (page === 'platform-admin' && typeof pldHydratePlatformAdmin === 'function') {
      setTimeout(() => pldHydratePlatformAdmin(), 0);
    }
  }
  if (page === 'settings' && typeof settingsTab !== 'undefined' && settingsTab === 'customfields') {
    setTimeout(() => {
      if (typeof loadCustomFieldsSettingsContent === 'function') loadCustomFieldsSettingsContent();
    }, 0);
  }
  if (page === 'settings' && typeof settingsTab !== 'undefined' && settingsTab === 'general') {
    setTimeout(async () => {
      if (typeof window.pldRefreshTenantShell === 'function') await window.pldRefreshTenantShell();
      const inp = document.getElementById('pldSettingsTenantName');
      if (inp && window.__pldTenant && window.__pldTenant.name) {
        inp.value = String(window.__pldTenant.name);
      }
    }, 0);
  }
  if (page === 'settings' && typeof settingsTab !== 'undefined' && settingsTab === 'workforce') {
    setTimeout(() => {
      if (typeof window.pldHydrateSettingsWorkforceTab === 'function') void window.pldHydrateSettingsWorkforceTab();
    }, 0);
  }
  if (
    page === 'event' &&
    typeof eventPageTab !== 'undefined' &&
    eventPageTab === 'overview' &&
    typeof PLD_EVENTS_FROM_REST !== 'undefined' &&
    PLD_EVENTS_FROM_REST &&
    typeof selectedEventId !== 'undefined' &&
    selectedEventId
  ) {
    setTimeout(() => {
      const ev = typeof EVENTS !== 'undefined' && EVENTS.find ? EVENTS.find((e) => e.id === selectedEventId) : null;
      if (!ev || typeof pldMountCustomFieldsInContainer !== 'function') return;
      void pldMountCustomFieldsInContainer('epCustomFieldsMount', 'event', ev.custom_fields || {});
      if (typeof window.pldPopulateEventPrimaryContactSelect === 'function') {
        void window.pldPopulateEventPrimaryContactSelect(selectedEventId);
      }
    }, 0);
  }
}

// ============================================
// Helper: Tab rendering
// ============================================
/** Tab state uses top-level `let` (e.g. documentsTab), not `window.*` — read current value for active styling. */
function pldTabVarRead(name) {
  try {
    return new Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : ""')();
  } catch (e) {
    return '';
  }
}

function tabBtn(label, tabVar, tabVal, renderFn) {
  const cur = pldTabVarRead(tabVar);
  return `<button type="button" class="tab ${cur === tabVal ? 'active' : ''}" onclick="${tabVar}='${tabVal}'; renderPage('${renderFn}');">${label}</button>`;
}
