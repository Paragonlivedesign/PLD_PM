/* ============================================
   Travel REST (Wave 2) — event manifest + refresh
   Depends on: pld-api.js
   ============================================ */

(function (global) {
  global.__pldEventTravelByEventId = global.__pldEventTravelByEventId || {};

  /**
   * Fetches GET /api/v1/events/:id/travel and caches under __pldEventTravelByEventId.
   * Re-renders the event page when done (same pattern as trucks).
   */
  global.pldRefreshEventTravel = async function pldRefreshEventTravel(eventId) {
    if (typeof global.pldApiFetch !== 'function') {
      if (typeof global.renderPage === 'function') global.renderPage('event');
      return;
    }
    const r = await global.pldApiFetch(
      '/api/v1/events/' + encodeURIComponent(eventId) + '/travel',
      { method: 'GET' },
    );
    if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) {
      global.__pldEventTravelByEventId[eventId] = { error: true, status: r.status };
    } else {
      global.__pldEventTravelByEventId[eventId] = {
        data: r.body.data,
        meta: r.body.meta,
      };
    }
    if (typeof global.renderPage === 'function') global.renderPage('event');
  };

  /**
   * Global Travel page: GET /api/v1/travel — sets __pldGlobalTravelList for renderTravel.
   */
  global.pldFetchGlobalTravelIfConfigured = async function pldFetchGlobalTravelIfConfigured() {
    if (typeof global.pldApiFetch !== 'function') return;
    const r = await global.pldApiFetch('/api/v1/travel?limit=50&sort_by=departure_datetime&sort_order=desc');
    if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) {
      global.__pldGlobalTravelList = { error: true };
    } else {
      global.__pldGlobalTravelList = { rows: r.body.data || [], meta: r.body.meta };
    }
    const t = document.querySelector('.page-title');
    if (t && typeof global.renderPage === 'function' && t.textContent && t.textContent.indexOf('Travel') >= 0) {
      global.renderPage('travel', { skipModuleDataFetch: true });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
