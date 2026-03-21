/* ============================================
   Travel REST (Wave 2) — event manifest + refresh
   Depends on: pld-api.js
   ============================================ */

(function (global) {
  global.__pldEventTravelByEventId = global.__pldEventTravelByEventId || {};
  global.__pldGlobalRoomingBlocks = global.__pldGlobalRoomingBlocks || [];

  /**
   * Groups travel API rows with accommodation into rooming list cards (mirrors backend rooming shape).
   * @param {unknown[]} rows
   * @returns {{ event: string; hotel: string; checkIn: string; checkOut: string; rooms: { crew: string; room: string; type: string; share: string }[] }[]}
   */
  global.pldBuildRoomingBlocksFromTravelRows = function pldBuildRoomingBlocksFromTravelRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const byEvent = new Map();
    for (let i = 0; i < rows.length; i++) {
      const tr = rows[i];
      const acc = tr && tr.accommodation;
      if (!acc) continue;
      const evId = String(tr.event_id || '');
      const evName = String(tr.event_name || '—');
      if (!byEvent.has(evId)) {
        byEvent.set(evId, { event: evName, hotelsMap: new Map() });
      }
      const em = byEvent.get(evId);
      const addr = acc.address != null && String(acc.address).trim() !== '' ? String(acc.address) : '';
      const hKey = String(acc.hotel_name || '') + '|||' + addr;
      if (!em.hotelsMap.has(hKey)) {
        const hn = String(acc.hotel_name || '—');
        em.hotelsMap.set(hKey, {
          hotelLine: addr ? hn + ', ' + addr : hn,
          roomsMap: new Map(),
        });
      }
      const hm = em.hotelsMap.get(hKey);
      const rKey =
        String(acc.check_in_date || '') +
        '|' +
        String(acc.check_out_date || '') +
        '|' +
        String(acc.room_type ?? '') +
        '|' +
        String(acc.confirmation_number ?? '') +
        '|' +
        String(acc.nightly_rate ?? '');
      if (!hm.roomsMap.has(rKey)) {
        hm.roomsMap.set(rKey, {
          room_type: acc.room_type != null ? String(acc.room_type) : null,
          confirmation_number: acc.confirmation_number != null ? String(acc.confirmation_number) : null,
          check_in_date: String(acc.check_in_date || ''),
          check_out_date: String(acc.check_out_date || ''),
          guests: [],
        });
      }
      const rm = hm.roomsMap.get(rKey);
      rm.guests.push({
        personnel_name: tr.personnel_name != null ? String(tr.personnel_name) : '—',
        sharing_with_name: acc.sharing_with_name != null ? String(acc.sharing_with_name) : null,
        sharing_with: acc.sharing_with != null ? String(acc.sharing_with) : null,
      });
    }
    const blocks = [];
    byEvent.forEach(function (ev) {
      ev.hotelsMap.forEach(function (h) {
        let minCi = '';
        let maxCo = '';
        const rooms = [];
        h.roomsMap.forEach(function (rm) {
          if (!minCi || rm.check_in_date < minCi) minCi = rm.check_in_date;
          if (!maxCo || rm.check_out_date > maxCo) maxCo = rm.check_out_date;
          for (let g = 0; g < rm.guests.length; g++) {
            const guest = rm.guests[g];
            let share = '—';
            if (guest.sharing_with_name != null && String(guest.sharing_with_name).trim() !== '') {
              share = String(guest.sharing_with_name);
            } else if (guest.sharing_with != null && String(guest.sharing_with).trim() !== '') {
              share = String(guest.sharing_with);
            }
            const roomLabel =
              rm.confirmation_number != null && String(rm.confirmation_number).trim() !== ''
                ? String(rm.confirmation_number)
                : '—';
            rooms.push({
              crew: guest.personnel_name,
              room: roomLabel,
              type: rm.room_type && String(rm.room_type).trim() !== '' ? String(rm.room_type) : '—',
              share: share,
            });
          }
        });
        if (rooms.length) {
          blocks.push({
            event: ev.event,
            hotel: h.hotelLine,
            checkIn: minCi,
            checkOut: maxCo,
            rooms: rooms,
          });
        }
      });
    });
    return blocks;
  };

  global.pldApplyRoomingBlocksFromTravelRows = function pldApplyRoomingBlocksFromTravelRows(rows) {
    global.__pldGlobalRoomingBlocks = global.pldBuildRoomingBlocksFromTravelRows(rows);
  };

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
      global.__pldGlobalRoomingBlocks = [];
    } else {
      const rows = r.body.data || [];
      global.__pldGlobalTravelList = { rows: rows, meta: r.body.meta };
      global.pldApplyRoomingBlocksFromTravelRows(rows);
    }
    const t = document.querySelector('.page-title');
    if (t && typeof global.renderPage === 'function' && t.textContent && t.textContent.indexOf('Travel') >= 0) {
      global.renderPage('travel', { skipModuleDataFetch: true });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
