/* ============================================
   REST sync: events, clients, venues when API is reachable (same-origin / Vite proxy or PLD_API_BASE).
   Sets PLD_EVENTS_FROM_REST and registers persist hooks for optimistic-lock updates.
   ============================================ */

(function (global) {
  /** @type {boolean} */
  global.PLD_EVENTS_FROM_REST = false;
  /** True when catalog was loaded from PostgreSQL API without Firestore (see pldTryBootstrapFromSql). */
  global.PLD_DATA_FROM_REST = false;

  function mapClientApiToUi(c) {
    const idRaw = c.id != null ? c.id : c.client_id != null ? c.client_id : '';
    const contactName = c.contact_name != null ? String(c.contact_name) : '';
    const contactEmail = c.contact_email != null ? String(c.contact_email) : '';
    const md =
      c.metadata && typeof c.metadata === 'object' && !Array.isArray(c.metadata)
        ? /** @type {Record<string, unknown>} */ (c.metadata)
        : {};
    return {
      id: idRaw !== '' && idRaw != null ? String(idRaw) : '',
      name: c.name,
      contact: contactName,
      email: contactEmail,
      contact_name: contactName,
      contact_email: contactEmail,
      phone: c.phone != null ? String(c.phone) : '',
      notes: c.notes != null ? String(c.notes) : '',
      metadata: md,
      updated_at: c.updated_at != null ? String(c.updated_at) : '',
      created_at: c.created_at != null ? String(c.created_at) : '',
    };
  }

  function mapVenueApiToUi(v) {
    const md =
      v.metadata && typeof v.metadata === 'object' && !Array.isArray(v.metadata)
        ? /** @type {Record<string, unknown>} */ (v.metadata)
        : {};
    return {
      id: v.id,
      name: v.name,
      city: v.city || '',
      address: v.address != null ? String(v.address) : '',
      latitude: v.latitude != null && v.latitude !== '' ? Number(v.latitude) : null,
      longitude: v.longitude != null && v.longitude !== '' ? Number(v.longitude) : null,
      timezone: v.timezone != null ? String(v.timezone) : '',
      notes: v.notes != null ? String(v.notes) : '',
      metadata: md,
      updated_at: v.updated_at != null ? String(v.updated_at) : '',
      created_at: v.created_at != null ? String(v.created_at) : '',
    };
  }

  function mapVendorApiToUi(v) {
    const md =
      v.metadata && typeof v.metadata === 'object' && !Array.isArray(v.metadata)
        ? /** @type {Record<string, unknown>} */ (v.metadata)
        : {};
    return {
      id: v.id,
      name: v.name,
      contact_name: v.contact_name != null ? String(v.contact_name) : '',
      contact_email: v.contact_email != null ? String(v.contact_email) : '',
      phone: v.phone != null ? String(v.phone) : '',
      notes: v.notes != null ? String(v.notes) : '',
      linked_client_id: v.linked_client_id != null ? String(v.linked_client_id) : '',
      metadata: md,
      updated_at: v.updated_at != null ? String(v.updated_at) : '',
      created_at: v.created_at != null ? String(v.created_at) : '',
    };
  }

  /**
   * @param {Record<string, unknown>} d
   * @param {{ crew?: string[]; trucks?: string[] } | null | undefined} mergeEv When merging a PUT/GET response into an existing event, preserve hydrated crew/truck ids (API does not embed them on events).
   */
  function mapEventApiToUi(d, mergeEv) {
    const md = d.metadata && typeof d.metadata === 'object' ? d.metadata : {};
    const budget = Number(md.budget != null ? md.budget : 0);
    const spent = Number(md.spent != null ? md.spent : 0);
    const pr = md.priority;
    const priority =
      pr === 'low' || pr === 'medium' || pr === 'high' || pr === 'critical' ? pr : 'medium';
    const dailySchedule =
      md.daily_schedule != null && typeof md.daily_schedule === 'object' ? md.daily_schedule : null;
    const eventPaperwork =
      md.event_paperwork != null && typeof md.event_paperwork === 'object' ? md.event_paperwork : null;
    const crew =
      mergeEv && Array.isArray(mergeEv.crew) ? mergeEv.crew.slice() : [];
    const trucks =
      mergeEv && Array.isArray(mergeEv.trucks) ? mergeEv.trucks.slice() : [];
    return {
      id: d.id,
      name: d.name,
      client: d.client_id,
      venue: d.venue_id || '',
      primary_contact_id: d.primary_contact_id != null ? String(d.primary_contact_id) : '',
      phase: d.phase,
      startDate: d.start_date,
      endDate: d.end_date,
      budget: budget,
      spent: spent,
      crew: crew,
      trucks: trucks,
      priority: priority,
      status: d.status,
      description: d.description,
      tags: Array.isArray(d.tags) ? d.tags : [],
      metadata: md,
      dailySchedule: dailySchedule,
      eventPaperwork: eventPaperwork,
      custom_fields: d.custom_fields && typeof d.custom_fields === 'object' ? d.custom_fields : {},
      load_in_date: d.load_in_date,
      load_out_date: d.load_out_date,
      updated_at: d.updated_at,
      created_at: d.created_at,
    };
  }

  async function fetchAllPaged(pathBase, mapRow) {
    const all = [];
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      const q = new URLSearchParams({ limit: '100' });
      if (cursor) q.set('cursor', cursor);
      const res = await global.pldApiFetch(pathBase + '?' + q.toString(), { method: 'GET' });
      if (!res.ok) {
        const msg =
          res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
        throw new Error(msg || 'HTTP ' + res.status);
      }
      const rows = (res.body && res.body.data) || [];
      for (let i = 0; i < rows.length; i++) all.push(mapRow(rows[i]));
      const meta = res.body && res.body.meta;
      if (!meta || !meta.cursor) break;
      cursor = meta.cursor;
    }
    return all;
  }

  async function fetchAllClientsFromApi(search) {
    const all = [];
    let cursor = '';
    const term = search && String(search).trim() ? String(search).trim() : '';
    for (let p = 0; p < 100; p++) {
      const q = new URLSearchParams({ limit: '100' });
      if (cursor) q.set('cursor', cursor);
      if (term) q.set('search', term);
      const res = await global.pldApiFetch('/api/v1/clients?' + q.toString(), { method: 'GET' });
      if (!res.ok) {
        const msg =
          res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
        throw new Error(msg || 'HTTP ' + res.status);
      }
      const rows = (res.body && res.body.data) || [];
      for (let i = 0; i < rows.length; i++) all.push(mapClientApiToUi(rows[i]));
      const meta = res.body && res.body.meta;
      if (!meta || !meta.cursor) break;
      cursor = meta.cursor;
    }
    return all;
  }

  async function fetchAllEventsPages(query) {
    const all = [];
    let cursor = '';
    const q0 = new URLSearchParams(query);
    for (let page = 0; page < 200; page++) {
      const q = new URLSearchParams(q0);
      q.set('limit', '100');
      if (cursor) q.set('cursor', cursor);
      const res = await global.pldApiFetch('/api/v1/events?' + q.toString(), { method: 'GET' });
      if (!res.ok) {
        const msg =
          res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
        throw new Error(msg || 'HTTP ' + res.status);
      }
      const rows = (res.body && res.body.data) || [];
      for (let i = 0; i < rows.length; i++) all.push(mapEventApiToUi(rows[i]));
      const meta = res.body && res.body.meta;
      if (!meta || !meta.cursor) break;
      cursor = meta.cursor;
    }
    return all;
  }

  async function fetchTravelAllPages() {
    const all = [];
    let cursor = '';
    for (let page = 0; page < 50; page++) {
      const q = new URLSearchParams({
        limit: '100',
        sort_by: 'departure_datetime',
        sort_order: 'desc',
      });
      if (cursor) q.set('cursor', cursor);
      const res = await global.pldApiFetch('/api/v1/travel?' + q.toString(), { method: 'GET' });
      if (!res.ok) throw new Error('travel list failed');
      const rows = (res.body && res.body.data) || [];
      for (let i = 0; i < rows.length; i++) all.push(rows[i]);
      const meta = res.body && res.body.meta;
      if (!meta || !meta.cursor) break;
      cursor = meta.cursor;
    }
    return all;
  }

  function mapDepartmentApiToUi(d) {
    return {
      id: d.id,
      name: d.name,
      color: d.color || '#6366f1',
    };
  }

  function mapPersonnelApiToUiPersonnel(p, deptById) {
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';
    const deptId = p.department_id ? String(p.department_id) : 'unassigned';
    const dept = deptById.get(deptId) || deptById.get(String(p.department_id));
    const color = dept && dept.color ? String(dept.color) : '#6366f1';
    const initials = name
      .split(/\s+/)
      .map(function (x) {
        return x[0];
      })
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const st = String(p.status || 'active');
    const uiStatus =
      st === 'active' ? 'available' : st === 'inactive' ? 'unavailable' : st === 'on_leave' ? 'on_event' : 'available';
    return {
      id: String(p.id),
      name: name,
      dept: deptId === 'unassigned' ? '' : deptId,
      role: String(p.role || ''),
      rate:
        p.day_rate != null
          ? Number(p.day_rate)
          : p.day_rate_amount != null
            ? Number(p.day_rate_amount)
            : 0,
      per_diem: p.per_diem != null && p.per_diem !== '' ? Number(p.per_diem) : null,
      avatar: color,
      initials: initials || '?',
      status: uiStatus,
      email: String(p.email || ''),
    };
  }

  function mapTravelApiToUi(tr) {
    const tt = String(tr.travel_type || 'other');
    const type =
      tt === 'flight'
        ? 'flight'
        : tt === 'hotel' || tt.includes('hotel')
          ? 'hotel'
          : tt === 'personal_vehicle' || tt === 'car_rental'
            ? 'self_drive'
            : 'flight';
    const dep = tr.departure_datetime ? String(tr.departure_datetime).slice(0, 10) : '';
    const cost = tr.cost != null && tr.cost !== '' ? Number(tr.cost) : 0;
    const st = String(tr.status || 'planned');
    const statusMap = { booked: 'booked', confirmed: 'confirmed', planned: 'pending', cancelled: 'cancelled' };
    return {
      id: String(tr.id),
      personnel: String(tr.personnel_id || ''),
      event: String(tr.event_id || ''),
      type: type,
      from: String(tr.departure_location || ''),
      to: String(tr.arrival_location || ''),
      date: dep,
      cost: cost,
      status: statusMap[st] || st,
      airline: tr.carrier ? String(tr.carrier) : '',
      flight: tr.booking_reference ? String(tr.booking_reference) : '',
    };
  }

  function mapAuditToActivity(a) {
    const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];
    const h =
      (String(a.entity_type || '').length + String(a.action || '').length) % colors.length;
    return {
      user: a.user_id ? 'User ' + String(a.user_id).slice(0, 8) : 'System',
      action: String(a.action || 'recorded'),
      target: String(a.entity_type || 'entity'),
      detail: a.changes ? JSON.stringify(a.changes).slice(0, 120) : String(a.entity_id || '').slice(0, 16),
      time: a.created_at ? String(a.created_at).replace('T', ' ').slice(0, 19) + ' UTC' : '—',
      color: colors[h],
    };
  }

  /**
   * Load all catalog globals from REST into data.js arrays (PostgreSQL-backed).
   * @returns {Promise<boolean>}
   */
  global.pldHydrateCatalogFromRest = async function pldHydrateCatalogFromRest() {
    if (typeof global.pldApiFetch !== 'function') return false;

    const health = await global.pldApiFetch('/api/v1/health', { method: 'GET' });
    if (!health.ok) return false;

    const [clients, venues, events] = await Promise.all([
      fetchAllPaged('/api/v1/clients', mapClientApiToUi),
      fetchAllPaged('/api/v1/venues', mapVenueApiToUi),
      fetchAllEventsPages(new URLSearchParams({ sort_by: 'start_date', sort_order: 'asc' })),
    ]);

    let vendorRows = [];
    try {
      const vr = await global.pldApiFetch('/api/v1/vendors?limit=200', { method: 'GET' });
      if (vr.ok && vr.body && Array.isArray(vr.body.data)) vendorRows = vr.body.data;
    } catch (e) {
      console.warn('[pld-hydrate] vendors', e);
    }

    CLIENTS.length = 0;
    clients.forEach(function (c) {
      CLIENTS.push(c);
    });
    VENUES.length = 0;
    venues.forEach(function (v) {
      VENUES.push(v);
    });
    if (typeof VENDORS !== 'undefined' && Array.isArray(VENDORS)) {
      VENDORS.length = 0;
      vendorRows.forEach(function (v) {
        VENDORS.push(mapVendorApiToUi(v));
      });
    }
    EVENTS.length = 0;
    events.forEach(function (e) {
      EVENTS.push(e);
    });
    global.PLD_EVENTS_FROM_REST = true;

    let deptRows = [];
    let personnelRows = [];
    try {
      const dr = await global.pldApiFetch('/api/v1/departments?include_counts=true', { method: 'GET' });
      if (dr.ok && dr.body && Array.isArray(dr.body.data)) deptRows = dr.body.data;
    } catch (e) {
      console.warn('[pld-hydrate] departments', e);
    }
    try {
      const pq =
        typeof global.pldBuildPersonnelListQueryString === 'function'
          ? global.pldBuildPersonnelListQueryString()
          : 'limit=100&sort_by=name&sort_order=asc';
      const pr = await global.pldApiFetch('/api/v1/personnel?' + pq, {
        method: 'GET',
      });
      if (pr.ok && pr.body && Array.isArray(pr.body.data)) personnelRows = pr.body.data;
    } catch (e) {
      console.warn('[pld-hydrate] personnel', e);
    }

    DEPARTMENTS.length = 0;
    const deptById = new Map();
    deptRows.forEach(function (d) {
      const u = mapDepartmentApiToUi(d);
      DEPARTMENTS.push(u);
      deptById.set(String(u.id), u);
    });
    global.__pldDepartmentsApiRows = deptRows;
    global.__pldPersonnelApiRows = personnelRows;

    PERSONNEL.length = 0;
    personnelRows.forEach(function (p) {
      PERSONNEL.push(mapPersonnelApiToUiPersonnel(p, deptById));
    });

    TRUCKS.length = 0;
    try {
      const tr = await global.pldApiFetch('/api/v1/trucks?limit=100&sort_by=name&sort_order=asc', {
        method: 'GET',
      });
      if (tr.ok && tr.body && Array.isArray(tr.body.data)) {
        tr.body.data.forEach(function (t) {
          TRUCKS.push({
            id: t.id,
            name: t.name,
            type: t.type,
            status: t.status,
            location: t.home_base || '—',
          });
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] trucks', e);
    }
    global.__pldTrucksApiRows = TRUCKS.slice();

    TRUCK_ROUTES.length = 0;
    try {
      const rr = await global.pldApiFetch('/api/v1/truck-routes?limit=500', {
        method: 'GET',
      });
      if (rr.ok && rr.body && Array.isArray(rr.body.data)) {
        rr.body.data.forEach(function (r) {
          const wps = Array.isArray(r.waypoints)
            ? r.waypoints.map(function (w) {
                return w && w.location ? String(w.location) : '';
              })
            : [];
          TRUCK_ROUTES.push({
            id: r.id,
            truck_id: r.truck_id,
            event_id: r.event_id,
            origin: r.origin || '',
            destination: r.destination || '',
            waypoints: wps.filter(Boolean),
            distance_miles: r.distance_miles != null ? Number(r.distance_miles) : 0,
            driver: r.driver_name || null,
            status: r.status || 'planned',
            departure_datetime: r.departure_datetime || null,
            estimated_arrival: r.estimated_arrival || null,
            route_geometry: r.route_geometry || null,
            traffic_aware: !!r.traffic_aware,
            driver_share_url: r.driver_share_url || null,
            schedule_conflict_hint: r.schedule_conflict_hint || null,
          });
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] truck routes', e);
    }

    TRAVEL_RECORDS.length = 0;
    var travelApiRows = [];
    try {
      travelApiRows = await fetchTravelAllPages();
      travelApiRows.forEach(function (tr) {
        TRAVEL_RECORDS.push(mapTravelApiToUi(tr));
      });
    } catch (e) {
      console.warn('[pld-hydrate] travel', e);
    }
    if (typeof global.__pldGlobalTravelList !== 'undefined') {
      global.__pldGlobalTravelList = {
        rows: travelApiRows.map(function (tr) {
          return {
            id: tr.id,
            travel_type: tr.travel_type,
            departure_location: tr.departure_location,
            arrival_location: tr.arrival_location,
            personnel_name: tr.personnel_name,
            event_name: tr.event_name,
            event_id: tr.event_id,
            personnel_id: tr.personnel_id,
            departure_datetime: tr.departure_datetime,
            status: tr.status,
            cost: tr.cost != null && tr.cost !== '' ? Number(tr.cost) : null,
            accommodation: tr.accommodation || null,
          };
        }),
        meta: {},
      };
      if (typeof global.pldApplyRoomingBlocksFromTravelRows === 'function') {
        global.pldApplyRoomingBlocksFromTravelRows(travelApiRows);
      }
    }

    DOCUMENTS.length = 0;
    try {
      const doc = await global.pldApiFetch('/api/v1/documents?limit=100&sort_by=created_at&sort_order=desc', {
        method: 'GET',
      });
      if (doc.ok && doc.body && Array.isArray(doc.body.data)) {
        doc.body.data.forEach(function (d) {
          DOCUMENTS.push({
            id: d.id,
            name: d.name,
            event: d.event_id || '',
            type: d.category || 'document',
            format: 'file',
            size: d.size_bytes != null ? String(d.size_bytes) + ' B' : '—',
            updated: d.updated_at ? String(d.updated_at).slice(0, 10) : '',
            version: d.version != null ? d.version : 1,
          });
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] documents', e);
    }

    EMAIL_TEMPLATES.length = 0;
    try {
      const tm = await global.pldApiFetch('/api/v1/templates?sort_by=name&sort_order=asc', { method: 'GET' });
      if (tm.ok && tm.body && Array.isArray(tm.body.data)) {
        tm.body.data.forEach(function (t) {
          EMAIL_TEMPLATES.push({
            id: t.id,
            name: t.name,
            context: t.category || 'general',
            body: t.description ? String(t.description) : '',
          });
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] templates', e);
    }

    RIDER_ITEMS.length = 0;
    try {
      const ri = await global.pldApiFetch('/api/v1/rider-items?limit=100', { method: 'GET' });
      if (ri.ok && ri.body && Array.isArray(ri.body.data)) {
        ri.body.data.forEach(function (x) {
          RIDER_ITEMS.push({
            id: x.id,
            event_id: x.event_id,
            description: x.description || x.title || '',
            status: x.status || 'open',
          });
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] rider-items', e);
    }

    INVOICES.length = 0;
    try {
      const inv = await global.pldApiFetch('/api/v1/invoices?limit=100', { method: 'GET' });
      if (inv.ok && inv.body && Array.isArray(inv.body.data)) {
        inv.body.data.forEach(function (x) {
          INVOICES.push({
            id: x.id,
            event_id: x.event_id,
            client_id: x.client_id,
            invoice_number: x.invoice_number,
            status: x.status,
            total: x.total != null ? Number(x.total) : 0,
          });
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] invoices', e);
    }

    ACTIVITY_LOG.length = 0;
    try {
      const al = await global.pldApiFetch('/api/v1/audit-logs?limit=25&offset=0', { method: 'GET' });
      if (al.ok && al.body && Array.isArray(al.body.data)) {
        al.body.data.forEach(function (a) {
          ACTIVITY_LOG.push(mapAuditToActivity(a));
        });
      }
    } catch (e) {
      console.warn('[pld-hydrate] audit-logs', e);
    }

    global.PLD_DATA_FROM_REST = true;
    if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
    return true;
  };

  /**
   * When PostgreSQL API is reachable, skip Firestore and fill globals from REST.
   * @returns {Promise<boolean>}
   */
  global.pldTryBootstrapFromSql = async function pldTryBootstrapFromSql() {
    if (typeof global.pldApiFetch !== 'function') return false;
    try {
      return await global.pldHydrateCatalogFromRest();
    } catch (e) {
      console.warn('[pld-bootstrap-sql]', e && e.message ? e.message : e);
      global.PLD_DATA_FROM_REST = false;
      global.PLD_EVENTS_FROM_REST = false;
      return false;
    }
  };

  /**
   * After a new JWT/session (tenant switch, sign-in), reload PostgreSQL catalog into globals
   * and refresh the travel list used by the Travel page.
   */
  global.pldRehydrateCatalogAfterTenantContextChange = async function pldRehydrateCatalogAfterTenantContextChange() {
    if (typeof global.pldClearTenantScopedClientState === 'function') {
      global.pldClearTenantScopedClientState();
    }
    try {
      if (typeof global.pldTryBootstrapFromSql === 'function') {
        const ok = await global.pldTryBootstrapFromSql();
        if (ok && typeof global.dispatchEvent === 'function') {
          global.dispatchEvent(new CustomEvent('pld-data-ready'));
          global.dispatchEvent(new CustomEvent('pld-rest-events-synced'));
        }
      }
    } catch (e) {
      console.warn('[pld-hydrate] tenant context', e && e.message ? e.message : e);
    }
    if (typeof global.pldFetchGlobalTravelIfConfigured === 'function') {
      try {
        await global.pldFetchGlobalTravelIfConfigured();
      } catch (e) {
        void e;
      }
    }
  };

  /**
   * Probe GET /api/v1/events; on success replace CLIENTS, VENUES, EVENTS from API.
   * @returns {Promise<boolean>}
   */
  global.pldTrySyncEventsStackFromRest = async function () {
    if (typeof global.pldApiFetch !== 'function') return false;
    try {
      const probe = await global.pldApiFetch('/api/v1/events?limit=1', { method: 'GET' });
      if (!probe.ok) return false;

      const [clients, venues, events] = await Promise.all([
        fetchAllPaged('/api/v1/clients', mapClientApiToUi),
        fetchAllPaged('/api/v1/venues', mapVenueApiToUi),
        fetchAllEventsPages(new URLSearchParams({ sort_by: 'start_date', sort_order: 'asc' })),
      ]);

      let vendorRows = [];
      try {
        const vr = await global.pldApiFetch('/api/v1/vendors?limit=200', { method: 'GET' });
        if (vr.ok && vr.body && Array.isArray(vr.body.data)) vendorRows = vr.body.data;
      } catch (e) {
        console.warn('[pld-sync] vendors', e);
      }

      CLIENTS.length = 0;
      clients.forEach(function (c) {
        CLIENTS.push(c);
      });
      VENUES.length = 0;
      venues.forEach(function (v) {
        VENUES.push(v);
      });
      if (typeof VENDORS !== 'undefined' && Array.isArray(VENDORS)) {
        VENDORS.length = 0;
        vendorRows.forEach(function (v) {
          VENDORS.push(mapVendorApiToUi(v));
        });
      }
      EVENTS.length = 0;
      events.forEach(function (e) {
        EVENTS.push(e);
      });

      global.PLD_EVENTS_FROM_REST = true;
      if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
      return true;
    } catch (e) {
      console.warn('[pld-events-sync] REST catalog not used:', e && e.message ? e.message : e);
      global.PLD_EVENTS_FROM_REST = false;
      return false;
    }
  };

  global.pldRefreshEventFromApi = async function (eventId) {
    const res = await global.pldApiFetch('/api/v1/events/' + encodeURIComponent(eventId), {
      method: 'GET',
    });
    if (!res.ok) return null;
    const d = res.body && res.body.data;
    if (!d) return null;
    const idx = EVENTS.findIndex(function (e) {
      return e.id === eventId;
    });
    const prev = idx >= 0 ? EVENTS[idx] : null;
    const ui = mapEventApiToUi(d, prev);
    if (idx >= 0) {
      EVENTS[idx] = Object.assign({}, EVENTS[idx], ui);
    }
    return ui;
  };

  /**
   * @param {string} eventId
   * @param {Record<string, unknown>} patch UI keys: name, client, venue, startDate, endDate, priority, metadata (full merged object for running schedule etc.)
   */
  global.pldPersistEventPatchViaApi = async function (eventId, patch) {
    const ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev || !ev.updated_at) {
      if (typeof showToast === 'function') showToast('Event out of sync — reload the page.', 'error');
      return;
    }
    const body = { updated_at: ev.updated_at };
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.client !== undefined) body.client_id = patch.client;
    if (patch.venue !== undefined) body.venue_id = patch.venue || null;
    if (patch.startDate !== undefined) body.start_date = patch.startDate;
    if (patch.endDate !== undefined) body.end_date = patch.endDate;
    if (patch.metadata !== undefined) {
      body.metadata = patch.metadata;
    } else if (
      patch.priority !== undefined ||
      patch.dailySchedule !== undefined ||
      patch.eventPaperwork !== undefined
    ) {
      body.metadata = {};
      if (patch.priority !== undefined) body.metadata.priority = patch.priority;
      if (patch.dailySchedule !== undefined) body.metadata.daily_schedule = patch.dailySchedule;
      if (patch.eventPaperwork !== undefined) body.metadata.event_paperwork = patch.eventPaperwork;
    }
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.tags !== undefined) body.tags = patch.tags;
    if (patch.custom_fields !== undefined) body.custom_fields = patch.custom_fields;
    if (patch.primary_contact_id !== undefined) {
      const pc = patch.primary_contact_id;
      body.primary_contact_id = pc === '' || pc === null ? null : pc;
    }
    if (patch.status !== undefined) body.status = patch.status;

    const bodyKeys = Object.keys(body);
    if (bodyKeys.length === 1 && bodyKeys[0] === 'updated_at') {
      return;
    }

    const res = await global.pldApiFetch('/api/v1/events/' + encodeURIComponent(eventId), {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      await global.pldRefreshEventFromApi(eventId);
      if (typeof showToast === 'function') {
        showToast('This event was updated elsewhere — data refreshed. Retry your edit.', 'warning');
      }
      if (typeof global.renderPage === 'function' && global.currentPage === 'event' && global.selectedEventId === eventId) {
        global.eventEditingField = null;
        global.renderPage('event');
      }
      return;
    }
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Could not save event', 'error');
      return;
    }
    const data = res.body && res.body.data;
    if (data) Object.assign(ev, mapEventApiToUi(data, ev));
  };

  global.pldTransitionEventPhaseViaApi = async function (eventId, newPhase, notes) {
    const res = await global.pldApiFetch(
      '/api/v1/events/' + encodeURIComponent(eventId) + '/phase',
      {
        method: 'PUT',
        body: JSON.stringify({ phase: newPhase, notes: notes || null }),
      },
    );
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Phase change failed', 'error');
      return false;
    }
    const data = res.body && res.body.data;
    const ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (data && ev) Object.assign(ev, mapEventApiToUi(data, ev));
    return true;
  };

  global.__pldClientsApiLoadError = global.__pldClientsApiLoadError ?? null;

  /**
   * Refill global CLIENTS from GET /api/v1/clients (optional search). No-op if PLD_API_BASE unset.
   * Sets __pldClientsApiLoadError on failure; does not clear CLIENTS on failure.
   * @param {string} [search]
   */
  global.pldFetchClientsFromApiIfConfigured = async function pldFetchClientsFromApiIfConfigured(
    search,
  ) {
    if (typeof global.pldApiFetch !== 'function') return;
    const baseOn =
      typeof global.PLD_API_BASE === 'string' && global.PLD_API_BASE.trim() !== '';
    if (!baseOn) {
      global.__pldClientsApiLoadError = null;
      return;
    }
    global.__pldClientsApiLoadError = null;
    try {
      const rows = await fetchAllClientsFromApi(search);
      CLIENTS.length = 0;
      rows.forEach(function (c) {
        CLIENTS.push(c);
      });
    } catch (e) {
      global.__pldClientsApiLoadError =
        e && /** @type {{ message?: string }} */ (e).message
          ? String(/** @type {{ message?: string }} */ (e).message)
          : 'Clients API unavailable';
    }
    const el = document.querySelector('.page-title');
    if (el && el.textContent === 'Clients' && typeof renderPage === 'function') {
      renderPage('clients', { skipModuleDataFetch: true });
    }
  };

  /**
   * POST /api/v1/clients — body: { name, contact_name?, contact_email?, phone?, notes?, metadata? }
   * @param {Record<string, unknown>} payload
   * @returns {Promise<ReturnType<typeof mapClientApiToUi> | null>}
   */
  global.pldCreateClientViaApi = async function (payload) {
    const res = await global.pldApiFetch('/api/v1/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Could not create client', 'error');
      return null;
    }
    const data = res.body && res.body.data;
    if (!data) return null;
    const ui = mapClientApiToUi(data);
    const dup = CLIENTS.some(function (c) {
      return c.id === ui.id;
    });
    if (!dup) CLIENTS.push(ui);
    return ui;
  };

  /**
   * PUT /api/v1/clients/:id — partial update per contract.
   * @param {string} id
   * @param {Record<string, unknown>} body
   * @returns {Promise<ReturnType<typeof mapClientApiToUi> | null>}
   */
  global.pldUpdateClientViaApi = async function pldUpdateClientViaApi(id, body) {
    const res = await global.pldApiFetch('/api/v1/clients/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Could not update client', 'error');
      return null;
    }
    const data = res.body && res.body.data;
    if (!data) return null;
    const ui = mapClientApiToUi(data);
    const idx = CLIENTS.findIndex(function (c) {
      return c.id === id;
    });
    if (idx >= 0) CLIENTS[idx] = ui;
    else CLIENTS.push(ui);
    return ui;
  };

  /**
   * DELETE /api/v1/clients/:id — soft-delete; 409 if events reference client.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  global.pldDeleteClientViaApi = async function pldDeleteClientViaApi(id) {
    const cid = String(id == null ? '' : id).trim();
    if (!cid) {
      if (typeof showToast === 'function')
        showToast('Cannot delete client (missing id). Try refreshing the list.', 'error');
      return false;
    }
    const res = await global.pldApiFetch('/api/v1/clients/' + encodeURIComponent(cid), {
      method: 'DELETE',
    });
    if (res.status === 409) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function')
        showToast(msg || 'Cannot delete client (events still reference it)', 'warning');
      return false;
    }
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Could not delete client', 'error');
      return false;
    }
    const pos = CLIENTS.findIndex(function (c) {
      return c.id === cid;
    });
    if (pos >= 0) CLIENTS.splice(pos, 1);
    return true;
  };

  global.pldCreateEventViaApi = async function (payload) {
    const res = await global.pldApiFetch('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Duplicate event', 'warning');
      return null;
    }
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Could not create event', 'error');
      return null;
    }
    const data = res.body && res.body.data;
    if (!data) return null;
    const ui = mapEventApiToUi(data);
    EVENTS.push(ui);
    if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
    return ui;
  };

  global.pldCloneEventViaApi = async function (sourceId, body) {
    const res = await global.pldApiFetch(
      '/api/v1/events/' + encodeURIComponent(sourceId) + '/clone',
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Clone failed', 'error');
      return null;
    }
    const data = res.body && res.body.data;
    if (!data) return null;
    const ui = mapEventApiToUi(data);
    EVENTS.push(ui);
    if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
    return ui;
  };

  /**
   * @param {string} eventId
   * @param {{ force?: boolean } | undefined} opts
   * @returns {Promise<{ ok: true } | { ok: false, message?: string, status?: number, details?: unknown }>}
   */
  global.pldDeleteEventViaApi = async function (eventId, opts) {
    const force = opts && opts.force === true;
    const url =
      '/api/v1/events/' + encodeURIComponent(eventId) + (force ? '?force=true' : '');
    const res = await global.pldApiFetch(url, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = res.body && res.body.errors && res.body.errors[0];
      const msg = err && err.message;
      const details = err && err.details;
      if (res.status !== 409 && typeof showToast === 'function') {
        showToast(msg || 'Delete failed', 'error');
      }
      return {
        ok: false,
        message: msg || 'Delete failed',
        status: res.status,
        details: details,
      };
    }
    const idx = EVENTS.findIndex(function (e) {
      return e.id === eventId;
    });
    if (idx >= 0) EVENTS.splice(idx, 1);
    if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
    return { ok: true };
  };

  /**
   * POST /api/v1/events/:id/restore — undelete soft-deleted event. Requires tenancy.settings.edit.
   * @param {string} eventId
   * @returns {Promise<ReturnType<typeof mapEventApiToUi> | null>}
   */
  global.pldRestoreEventViaApi = async function (eventId) {
    const res = await global.pldApiFetch(
      '/api/v1/events/' + encodeURIComponent(eventId) + '/restore',
      { method: 'POST' },
    );
    if (!res.ok) {
      const msg =
        res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Could not restore event', 'error');
      return null;
    }
    const data = res.body && res.body.data;
    if (!data) return null;
    const ui = mapEventApiToUi(data);
    const idx = EVENTS.findIndex(function (e) {
      return e.id === ui.id;
    });
    if (idx >= 0) {
      EVENTS[idx] = Object.assign({}, EVENTS[idx], ui);
    } else {
      EVENTS.push(ui);
    }
    if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
    return ui;
  };

  /**
   * Refetch event list from API (all pages) with optional filters; replaces EVENTS.
   */
  global.pldSaveOverviewCustomFields = async function (eventId) {
    const mount = document.getElementById('epCustomFieldsMount');
    if (!mount || typeof global.loadCustomFieldsDefinitions !== 'function') return;
    try {
      const defs = await global.loadCustomFieldsDefinitions('event');
      const custom_fields =
        typeof global.pldCollectCustomFieldValuesFromContainer === 'function'
          ? global.pldCollectCustomFieldValuesFromContainer(mount, defs)
          : {};
      await global.pldPersistEventPatchViaApi(eventId, { custom_fields: custom_fields });
      if (typeof global.renderPage === 'function' && global.currentPage === 'event') {
        global.renderPage('event');
      }
      if (typeof showToast === 'function') showToast('Custom fields saved', 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast(String(e.message || e), 'error');
    }
  };

  global.pldRefetchEventsListFromApi = async function (opts) {
    const o = opts || {};
    const q = new URLSearchParams({
      sort_by: o.sort_by || 'start_date',
      sort_order: o.sort_order || 'asc',
    });
    if (o.phase) q.set('phase', o.phase);
    if (o.client_id) q.set('client_id', o.client_id);
    if (o.search && String(o.search).trim()) q.set('search', String(o.search).trim());
    try {
      const events = await fetchAllEventsPages(q);
      EVENTS.length = 0;
      events.forEach(function (e) {
        EVENTS.push(e);
      });
      if (typeof global.updateSidebarNavCounts === 'function') global.updateSidebarNavCounts();
      return true;
    } catch (e) {
      console.warn(e);
      if (typeof showToast === 'function') showToast('Could not refresh events list', 'error');
      return false;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
