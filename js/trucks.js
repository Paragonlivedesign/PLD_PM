/* ============================================
   Module: Trucks Page
   Depends on: state.js, data.js, modal.js, pld-api.js
   ============================================ */

/** @type {unknown[] | null} */
window.__pldTrucksApiRows = null;

async function fetchTrucksFromApiIfConfigured() {
  if (typeof window.pldApiFetch !== 'function') return;
  const r = await window.pldApiFetch('/api/v1/trucks?limit=100&sort_by=name&sort_order=asc');
  if (!r.ok || !r.body || !Array.isArray(r.body.data)) {
    window.__pldTrucksApiRows = null;
    return;
  }
  window.__pldTrucksApiRows = r.body.data;
  if (typeof TRUCKS !== 'undefined' && Array.isArray(TRUCKS)) {
    TRUCKS.length = 0;
    r.body.data.forEach((t) => {
      TRUCKS.push({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        location: t.home_base || '—',
        license_plate: t.license_plate != null ? String(t.license_plate) : '',
        home_base: t.home_base != null ? String(t.home_base) : '',
        custom_fields:
          t.custom_fields && typeof t.custom_fields === 'object' && !Array.isArray(t.custom_fields)
            ? t.custom_fields
            : {},
      });
    });
  }
  const el = document.querySelector('.page-title');
  if (el && el.textContent === 'Trucks' && typeof renderPage === 'function') {
    renderPage('trucks', { skipModuleDataFetch: true });
  }
}

function pldContextMenuTruckRow(domEvent, truckId) {
  if (typeof window.pldShowContextMenu !== 'function') return;
  const id = String(truckId || '');
  if (!id) return;
  window.pldShowContextMenu(domEvent.clientX, domEvent.clientY, [
    { label: 'View truck', action: function () { openTruckDetail(id); } },
    { label: 'Assign to event…', action: function () { openAssignTruckToEventModal(id); } },
  ]);
}

function trucksContractStatusColors() {
  return {
    available: 'var(--accent-green)',
    in_use: 'var(--accent-blue)',
    maintenance: 'var(--accent-red)',
    retired: 'var(--text-tertiary)',
    deployed: 'var(--accent-blue)',
    in_transit: 'var(--accent-amber)',
  };
}

function trucksContractStatusLabels() {
  return {
    available: 'Available',
    in_use: 'In use',
    maintenance: 'Maintenance',
    retired: 'Retired',
    deployed: 'Deployed',
    in_transit: 'In Transit',
  };
}

function getFleetRows() {
  if (Array.isArray(window.__pldTrucksApiRows)) {
    return window.__pldTrucksApiRows.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      location: t.home_base || t.location || '—',
      source: 'api',
    }));
  }
  return TRUCKS.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    status: t.status,
    location: t.location,
    source: 'demo',
  }));
}

function renderTrucks() {
  const statusColors = trucksContractStatusColors();
  const statusLabels = trucksContractStatusLabels();
  const fleet = getFleetRows();
  const apiLabel = window.__pldTrucksApiRows ? ' · API' : '';
  return `
    <div class="page-header">
      <div><h1 class="page-title">Trucks</h1><p class="page-subtitle">${trucksView === 'routes' ? (TRUCK_ROUTES || []).length + ' routes' : fleet.length + ' units in fleet' + apiLabel}</p></div>
      <div class="page-actions">${
        trucksView === 'routes'
          ? '<button class="btn btn-primary" onclick="openAddTruckRouteModal()">+ Add route</button>'
          : '<button class="btn btn-primary" onclick="openAddTruckModal()">+ Add Truck</button>'
      }</div>
    </div>
    <div class="schedule-controls" style="margin-bottom:16px;">
      <div class="view-toggle">
        <button class="view-toggle-btn ${trucksView === 'fleet' ? 'active' : ''}" onclick="trucksView='fleet'; renderPage('trucks');">Fleet</button>
        <button class="view-toggle-btn ${trucksView === 'routes' ? 'active' : ''}" onclick="trucksView='routes'; renderPage('trucks');">Routes</button>
      </div>
    </div>
    ${trucksView === 'routes' ? renderTrucksRoutes() : `
    <div class="stats-row" style="margin-bottom:24px;">
      ${['available', 'in_use', 'maintenance', 'retired'].map((key) => {
        const label = statusLabels[key] || key;
        const n = fleet.filter((t) => t.status === key).length;
        const col = statusColors[key] || 'var(--text-secondary)';
        return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value" style="color:${col};">${n}</div></div>`;
      }).join('')}
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Unit</th><th>Type</th><th>Status</th><th title="Venue, warehouse, street address, or GPS (lat,lng)">Home base</th><th>Actions</th></tr></thead>
        <tbody>${fleet.map(t => `<tr oncontextmenu="event.preventDefault();event.stopPropagation();pldContextMenuTruckRow(event,'${String(t.id).replace(/'/g, "\\'")}');">
          <td><strong>${t.name}</strong></td><td>${t.type}</td>
          <td><span class="phase-badge" style="background:${statusColors[t.status] ? statusColors[t.status] + '20' : 'var(--bg-tertiary)'};color:${statusColors[t.status] || 'var(--text-secondary)'};">${statusLabels[t.status] || t.status}</span></td>
          <td>${t.location}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="openTruckDetail('${t.id}')">View</button><button class="btn btn-ghost btn-sm" onclick="openAssignTruckToEventModal('${t.id}')">Assign</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    `}
  `;
}

function truckRouteMapsDirUrl(r) {
  const o = encodeURIComponent(r.origin || '');
  const d = encodeURIComponent(r.destination || '');
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`;
}

function renderTrucksRoutes() {
  const routes = TRUCK_ROUTES || [];
  return `
    <div class="routes-list" style="display:flex;flex-direction:column;gap:16px;">
      ${routes.map(r => {
        const t = getTruck(r.truck_id);
        const ev = r.event_id ? EVENTS.find(e => e.id === r.event_id) : null;
        const wps = Array.isArray(r.waypoints) ? r.waypoints : [];
        const path = [r.origin].concat(wps).concat(r.destination);
        const dep = r.departure_datetime ? String(r.departure_datetime).slice(0, 16).replace('T', ' ') : '—';
        const eta = r.estimated_arrival ? String(r.estimated_arrival).slice(0, 16).replace('T', ' ') : '—';
        const geom = r.route_geometry && r.route_geometry.encoded_polyline;
        const hint = r.schedule_conflict_hint
          ? `<div style="margin-top:8px;font-size:11px;color:var(--accent-amber);">${String(r.schedule_conflict_hint)}</div>`
          : '';
        return `
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="display:grid;grid-template-columns:1fr 280px;gap:0;min-height:120px;">
            <div style="padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                <span style="font-weight:600;">${t ? t.name : 'Unassigned'}</span>
                ${ev ? `<span class="phase-badge" style="font-size:10px;">${ev.name}</span>` : ''}
                <span class="phase-badge" style="font-size:10px;background:var(--bg-tertiary);">${r.status}</span>
                ${r.traffic_aware ? '<span class="phase-badge" style="font-size:10px;background:var(--accent-blue-muted);color:var(--accent-blue);">Traffic</span>' : ''}
              </div>
              <div style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                ${path.map((p, i) => `${i > 0 ? '<span style="color:var(--text-tertiary);">→</span>' : ''} <span>${p}</span>`).join(' ')}
              </div>
              <div style="margin-top:8px;font-size:12px;color:var(--text-tertiary);">${r.distance_miles || '—'} mi · Driver: ${r.driver || 'TBD'}</div>
              <div style="margin-top:4px;font-size:11px;color:var(--text-tertiary);">Depart ${dep} · ETA ${eta}</div>
              ${hint}
              <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
                <a class="btn btn-ghost btn-sm" href="${truckRouteMapsDirUrl(r)}" target="_blank" rel="noopener">Maps</a>
                <button type="button" class="btn btn-ghost btn-sm" onclick="pldComputeTruckRoute('${r.id}')">Compute route</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="pldShareTruckRoute('${r.id}')">Share link</button>
              </div>
            </div>
            <a href="${truckRouteMapsDirUrl(r)}" target="_blank" rel="noopener" style="background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;padding:16px;text-decoration:none;color:inherit;" title="Open in Google Maps">
              <div style="font-size:11px;color:var(--text-tertiary);text-align:center;">
                ${geom ? 'Route computed<br><span style="font-size:10px;">(open Maps for turn-by-turn)</span>' : 'Route map<br><span style="font-size:10px;">(Compute route for geometry)</span>'}
              </div>
            </a>
          </div>
        </div>`;
      }).join('')}
      ${routes.length === 0 ? '<div class="empty-state"><p>No routes yet. Create a route and assign a truck to an event.</p></div>' : ''}
    </div>
  `;
}

function openAddTruckRouteModal() {
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API client not loaded', 'error');
    return;
  }
  const fleet = typeof getFleetRows === 'function' ? getFleetRows() : [];
  const evOpts = (typeof EVENTS !== 'undefined' ? EVENTS : [])
    .map((e) => `<option value="${e.id}">${e.name}</option>`)
    .join('');
  const truckOpts = fleet
    .map((t) => `<option value="${t.id}">${t.name}</option>`)
    .join('');
  const body = `
    <div class="form-group"><label class="form-label">Event</label>
      <select id="pldRouteEventId" class="form-select">${evOpts || '<option value="">No events</option>'}</select></div>
    <div class="form-group"><label class="form-label">Truck</label>
      <select id="pldRouteTruckId" class="form-select">${truckOpts || '<option value="">No trucks</option>'}</select></div>
    <div class="form-group"><label class="form-label">Origin</label>
      <input id="pldRouteOrigin" class="form-input" placeholder="Address or label"></div>
    <div class="form-group"><label class="form-label">Destination</label>
      <input id="pldRouteDest" class="form-input" placeholder="Address or label"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">Departure (ISO)</label>
        <input id="pldRouteDep" class="form-input" type="datetime-local"></div>
      <div class="form-group"><label class="form-label">Est. arrival (ISO)</label>
        <input id="pldRouteEta" class="form-input" type="datetime-local"></div>
    </div>
    <p style="font-size:12px;color:var(--text-tertiary);margin:0;">After saving, use <strong>Compute route</strong> on the card for miles, map geometry, and traffic-aware ETA (when configured).</p>
  `;
  const dep = new Date();
  dep.setMinutes(dep.getMinutes() - (dep.getTimezoneOffset()));
  const eta = new Date(dep.getTime() + 2 * 3600 * 1000);
  const toLocal = (d) => d.toISOString().slice(0, 16);
  openModal('Add truck route', body, `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="void window.pldSubmitTruckRouteFromModal()">Save route</button>
  `);
  setTimeout(() => {
    const de = document.getElementById('pldRouteDep');
    const ea = document.getElementById('pldRouteEta');
    if (de) de.value = toLocal(dep);
    if (ea) ea.value = toLocal(eta);
  }, 0);
}

window.pldSubmitTruckRouteFromModal = async function pldSubmitTruckRouteFromModal() {
  const event_id = (document.getElementById('pldRouteEventId') || {}).value || '';
  const truck_id = (document.getElementById('pldRouteTruckId') || {}).value || '';
  const origin = (document.getElementById('pldRouteOrigin') || {}).value || '';
  const destination = (document.getElementById('pldRouteDest') || {}).value || '';
  let departure_datetime = (document.getElementById('pldRouteDep') || {}).value || '';
  let estimated_arrival = (document.getElementById('pldRouteEta') || {}).value || '';
  if (departure_datetime && !departure_datetime.endsWith('Z') && !departure_datetime.includes('+')) {
    departure_datetime = new Date(departure_datetime).toISOString();
  }
  if (estimated_arrival && !estimated_arrival.endsWith('Z') && !estimated_arrival.includes('+')) {
    estimated_arrival = new Date(estimated_arrival).toISOString();
  }
  if (!event_id || !truck_id || !origin.trim() || !destination.trim()) {
    showToast('Event, truck, origin, and destination are required', 'error');
    return;
  }
  const r = await window.pldApiFetch('/api/v1/truck-routes', {
    method: 'POST',
    body: JSON.stringify({
      event_id,
      truck_id,
      origin: origin.trim(),
      destination: destination.trim(),
      departure_datetime,
      estimated_arrival,
      status: 'planned',
    }),
  });
  if (!r.ok) {
    const err = r.body && r.body.errors && r.body.errors[0];
    showToast((err && err.message) || 'Could not create route', 'error');
    return;
  }
  closeModal();
  showToast('Route created', 'success');
  if (typeof globalThis.pldHydrateFromEventsApi === 'function') {
    await globalThis.pldHydrateFromEventsApi();
  }
  if (typeof renderPage === 'function') renderPage('trucks');
};

window.pldComputeTruckRoute = async function pldComputeTruckRoute(routeId) {
  if (typeof window.pldApiFetch !== 'function') return;
  showToast('Computing route…', 'info');
  const r = await window.pldApiFetch(`/api/v1/truck-routes/${encodeURIComponent(routeId)}/compute-route`, {
    method: 'POST',
    body: '{}',
  });
  if (!r.ok) {
    showToast('Could not compute route (need coordinates on venues or lat,lng in labels)', 'error');
    return;
  }
  showToast('Route updated', 'success');
  if (typeof globalThis.pldHydrateFromEventsApi === 'function') await globalThis.pldHydrateFromEventsApi();
  if (typeof renderPage === 'function') renderPage('trucks');
};

window.pldShareTruckRoute = async function pldShareTruckRoute(routeId) {
  if (typeof window.pldApiFetch !== 'function') return;
  const r = await window.pldApiFetch(`/api/v1/truck-routes/${encodeURIComponent(routeId)}/share`, {
    method: 'POST',
    body: JSON.stringify({ ttl_hours: 72 }),
  });
  if (!r.ok || !r.body || !r.body.data || !r.body.data.share_url) {
    showToast('Could not create share link', 'error');
    return;
  }
  const url = r.body.data.share_url;
  try {
    await navigator.clipboard.writeText(
      url.startsWith('http') ? url : `${window.location.origin}${url}`,
    );
    showToast('Share link copied', 'success');
  } catch {
    openModal('Driver link', `<p style="word-break:break-all;font-size:13px;">${url}</p>`, '<button class="btn btn-primary" onclick="closeModal()">OK</button>');
  }
};

function openTruckDetail(truckId) {
  const t = typeof getTruck === 'function' ? getTruck(truckId) : TRUCKS.find((x) => x.id === truckId);
  if (!t) return;
  const statusColors = trucksContractStatusColors();
  const statusLabels = trucksContractStatusLabels();
  const assignedEvents = EVENTS.filter(e => e.trucks.includes(t.id));
  const plateEsc = String(t.license_plate != null ? t.license_plate : '').replace(/"/g, '&quot;');
  const homeEsc = String(t.home_base != null ? t.home_base : t.location || '').replace(/"/g, '&quot;');

  const body = `
    <input type="hidden" id="pldTruckDetailId" value="${String(t.id).replace(/"/g, '&quot;')}">
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
      <div style="width:56px;height:56px;background:var(--accent-amber-muted);color:var(--accent-amber);display:flex;align-items:center;justify-content:center;font-size:28px;">${uiIcon('truck')}</div>
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:700;">${t.name}</div>
        <div style="font-size:13px;color:var(--text-tertiary);">${t.type}</div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <span class="personnel-tag" style="background:${statusColors[t.status]}20;color:${statusColors[t.status]};">${statusLabels[t.status] || t.status}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="form-group"><label class="form-label">Home base</label><div style="display:flex;gap:8px;align-items:stretch;"><input type="text" id="pldTruckDetailHome" class="form-input" style="flex:1;min-width:0" value="${homeEsc}" placeholder="Venue, warehouse, address, or lat,lng"><button type="button" class="btn btn-secondary" style="flex-shrink:0" onclick="void window.pldOpenTruckHomeBasePicker('pldTruckDetailHome')">Browse…</button></div><div class="form-hint">Venues, CRM contact addresses, warehouse, driver text, or GPS — or pick from directory.</div></div>
      <div class="form-group"><label class="form-label">Status</label><select id="pldTruckDetailStatus" class="form-select">${Object.entries(statusLabels).map(([k,v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="form-group"><label class="form-label">License Plate</label><input type="text" id="pldTruckDetailPlate" class="form-input" value="${plateEsc}"></div>
      <div class="form-group"><label class="form-label">Last Service Date</label><input type="date" class="form-input" value="2026-01-15"></div>
    </div>
    <div id="pldTruckCfMount"></div>
    ${assignedEvents.length > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">ASSIGNED EVENTS</div>${assignedEvents.map(ev => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>navigateToEvent('${ev.id}'),150)"><span class="phase-badge ${ev.phase}" style="font-size:10px;padding:2px 6px;">${PHASE_LABELS[ev.phase]}</span><div style="flex:1;font-weight:500;font-size:13px;">${ev.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${getVenue(ev.venue).city}</div></div>`).join('')}</div>` : '<div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px;">No events assigned</div>'}
    <div><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">MAINTENANCE LOG</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Cost</th></tr></thead><tbody>
        <tr><td>Jan 15</td><td>Scheduled</td><td>Full service — oil, tires, brakes</td><td>$2,400</td></tr>
        <tr><td>Dec 3</td><td>Repair</td><td>Hydraulic lift cylinder replacement</td><td>$1,800</td></tr>
        <tr><td>Nov 10</td><td>Inspection</td><td>DOT annual inspection — passed</td><td>$350</td></tr>
      </tbody></table></div>
    </div>
  `;
  openModal(t.name + ' — ' + t.type, body, `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button type="button" class="btn btn-primary" onclick="void window.pldSaveTruckDetailModal()">Save</button>
  `);
  void window.pldHydrateTruckDetailModal(t.id, t);
}

window.pldHydrateTruckDetailModal = async function (truckId, localRow) {
  const mount = document.getElementById('pldTruckCfMount');
  if (!mount || typeof window.pldMountCustomFieldsInContainer !== 'function') return;
  if (typeof window.pldApiFetch !== 'function') {
    mount.innerHTML =
      '<p style="font-size:12px;color:var(--text-tertiary);">Connect to the API to edit truck custom fields.</p>';
    return;
  }
  let cf =
    localRow && localRow.custom_fields && typeof localRow.custom_fields === 'object'
      ? localRow.custom_fields
      : {};
  try {
    const r = await window.pldApiFetch('/api/v1/trucks/' + encodeURIComponent(truckId));
    if (r.ok && r.body && r.body.data) {
      const row = r.body.data;
      const hb = document.getElementById('pldTruckDetailHome');
      const st = document.getElementById('pldTruckDetailStatus');
      const pl = document.getElementById('pldTruckDetailPlate');
      if (hb && row.home_base != null) hb.value = String(row.home_base);
      if (st && row.status) st.value = String(row.status);
      if (pl && row.license_plate != null) pl.value = String(row.license_plate);
      if (row.custom_fields && typeof row.custom_fields === 'object') cf = row.custom_fields;
    }
  } catch {
    /* keep local cf */
  }
  await window.pldMountCustomFieldsInContainer('pldTruckCfMount', 'truck', cf);
};

window.pldSaveTruckDetailModal = async function () {
  const idEl = document.getElementById('pldTruckDetailId');
  const id = idEl && idEl.value;
  if (!id || typeof window.pldApiFetch !== 'function') {
    if (typeof showToast === 'function') showToast('API not configured', 'warning');
    return;
  }
  const home = (document.getElementById('pldTruckDetailHome') && document.getElementById('pldTruckDetailHome').value) || '';
  const status = (document.getElementById('pldTruckDetailStatus') && document.getElementById('pldTruckDetailStatus').value) || '';
  const plate = (document.getElementById('pldTruckDetailPlate') && document.getElementById('pldTruckDetailPlate').value) || '';
  let cfPayload = {};
  try {
    const defs = await window.loadCustomFieldsDefinitions('truck');
    const root = document.getElementById('pldTruckCfMount');
    if (root && defs && defs.length && typeof window.pldCollectCustomFieldValuesFromContainer === 'function') {
      cfPayload = window.pldCollectCustomFieldValuesFromContainer(root, defs);
    }
  } catch {
    /* no defs */
  }
  const body = {
    home_base: home.trim() || null,
    status: status || undefined,
    license_plate: plate.trim() || null,
    custom_fields: cfPayload,
  };
  try {
    const r = await window.pldApiFetch('/api/v1/trucks/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const msg = r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message;
      throw new Error(msg || String(r.status));
    }
    if (typeof showToast === 'function') showToast('Truck saved', 'success');
    if (typeof closeModal === 'function') closeModal();
    if (typeof fetchTrucksFromApiIfConfigured === 'function') void fetchTrucksFromApiIfConfigured();
    if (typeof renderPage === 'function') renderPage('trucks', { skipModuleDataFetch: true });
  } catch (e) {
    if (typeof showToast === 'function') showToast(String(e.message || e), 'error');
  }
};

const PLD_TRUCK_TYPE_OPTIONS = [
  { value: 'box_truck', label: 'Box truck' },
  { value: 'semi_trailer', label: 'Semi trailer' },
  { value: 'sprinter_van', label: 'Sprinter van' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'other', label: 'Other' },
];

/** Address line from CRM contact `metadata` (same shape as contact forms). */
function pldContactAddressLineFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const m = /** @type {Record<string, unknown>} */ (metadata);
  const direct =
    m.address ||
    m.mailing_address ||
    m.street ||
    m.street_address ||
    m.line1 ||
    m.addr_line1;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim();
  const city = m.city != null ? String(m.city).trim() : '';
  const st = m.state != null ? String(m.state).trim() : '';
  const zip = m.postal_code != null ? String(m.postal_code) : m.zip != null ? String(m.zip) : '';
  const tail = [city, st, zip].filter(Boolean).join(', ');
  return tail || '';
}

async function pldBuildTruckHomeBasePickerItems() {
  let items = [];
  if (typeof pickerItemsHomeBaseFromVenues === 'function') {
    items = items.concat(
      pickerItemsHomeBaseFromVenues(typeof VENUES !== 'undefined' && Array.isArray(VENUES) ? VENUES : []),
    );
  }
  if (typeof pldListContactsForParent !== 'function') {
    return items;
  }
  const venues = typeof VENUES !== 'undefined' && Array.isArray(VENUES) ? VENUES.slice(0, 50) : [];
  const clients = typeof CLIENTS !== 'undefined' && Array.isArray(CLIENTS) ? CLIENTS.slice(0, 50) : [];
  const vendors = typeof VENDORS !== 'undefined' && Array.isArray(VENDORS) ? VENDORS.slice(0, 50) : [];
  const batchSize = 10;
  function pushFromContacts(rows, parentLabel, kind, parentId) {
    rows.forEach((c) => {
      const md = c.metadata;
      const line = pldContactAddressLineFromMetadata(
        md && typeof md === 'object' && !Array.isArray(md) ? md : {},
      );
      if (!line) return;
      const nm = c.name != null ? String(c.name) : 'Contact';
      items.push({
        id: 'hb:c:' + kind + ':' + String(parentId) + ':' + String(c.id),
        primary: nm,
        secondary: line + ' · ' + parentLabel,
        meta: { storageValue: line, kind: 'contact' },
      });
    });
  }
  for (let vi = 0; vi < venues.length; vi += batchSize) {
    const vslice = venues.slice(vi, vi + batchSize);
    await Promise.all(
      vslice.map((v) =>
        pldListContactsForParent('venue', String(v.id), { silent: true }).then((rows) => {
          const pl = v.name != null ? String(v.name) : 'Venue';
          pushFromContacts(rows, pl, 'venue', v.id);
        }),
      ),
    );
  }
  for (let ci = 0; ci < clients.length; ci += batchSize) {
    const cslice = clients.slice(ci, ci + batchSize);
    await Promise.all(
      cslice.map((cl) =>
        pldListContactsForParent('client', String(cl.id), { silent: true }).then((rows) => {
          const pl = cl.name != null ? String(cl.name) : 'Client';
          pushFromContacts(rows, pl, 'client', cl.id);
        }),
      ),
    );
  }
  for (let ui = 0; ui < vendors.length; ui += batchSize) {
    const uslice = vendors.slice(ui, ui + batchSize);
    await Promise.all(
      uslice.map((vd) =>
        pldListContactsForParent('vendor', String(vd.id), { silent: true }).then((rows) => {
          const pl = vd.name != null ? String(vd.name) : 'Vendor';
          pushFromContacts(rows, pl, 'vendor', vd.id);
        }),
      ),
    );
  }
  return items;
}

window.pldOpenTruckHomeBasePicker = async function (inputId) {
  const fid = inputId || 'pldAddTruckHome';
  if (typeof openPickerModal !== 'function') return;
  const el = document.getElementById(fid);
  if (typeof showToast === 'function') showToast('Loading venues and contact addresses…', 'info');
  let items = [];
  try {
    items = await pldBuildTruckHomeBasePickerItems();
  } catch (e) {
    if (typeof showToast === 'function') showToast(String(e && e.message ? e.message : e), 'error');
    return;
  }
  openPickerModal({
    title: 'Home base',
    items,
    searchPlaceholder: 'Search venue, address, or contact…',
    emptyMessage:
      'No venues or CRM contacts with an address in metadata. Type manually, or add address fields on contact records.',
    onSelect(_i, item) {
      const storage =
        item && item.meta && item.meta.storageValue != null ? String(item.meta.storageValue) : '';
      if (el && storage) el.value = storage;
    },
  });
};

function openAddTruckModal() {
  const typeOpts = PLD_TRUCK_TYPE_OPTIONS.map(
    (o) => `<option value="${o.value}">${o.label}</option>`,
  ).join('');
  const body = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Unit Name</label><input type="text" id="pldAddTruckName" class="form-input" placeholder="e.g. G-Unit"></div>
      <div class="form-group"><label class="form-label">Type</label><select id="pldAddTruckType" class="form-select">${typeOpts}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">License Plate</label><input type="text" id="pldAddTruckPlate" class="form-input" placeholder="XX-0000"></div>
      <div class="form-group"><label class="form-label">Home base</label><div style="display:flex;gap:8px;align-items:stretch;"><input type="text" id="pldAddTruckHome" class="form-input" style="flex:1;min-width:0" placeholder="Venue name, warehouse, address, or lat,lng"><button type="button" class="btn btn-secondary" style="flex-shrink:0" onclick="void window.pldOpenTruckHomeBasePicker('pldAddTruckHome')">Browse…</button></div><div class="form-hint">Venues, CRM contact addresses (metadata), warehouse, or GPS — or pick from directory.</div></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea id="pldAddTruckNotes" class="form-textarea" placeholder="Equipment inventory, special features…"></textarea></div>
  `;
  openModal(
    'Add Truck',
    body,
    `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="void window.pldSubmitAddTruckFromModal()">Add Truck</button>`,
  );
}

window.pldSubmitAddTruckFromModal = async function pldSubmitAddTruckFromModal() {
  const name = (document.getElementById('pldAddTruckName')?.value || '').trim();
  const type = (document.getElementById('pldAddTruckType')?.value || '').trim();
  const plate = (document.getElementById('pldAddTruckPlate')?.value || '').trim();
  const home = (document.getElementById('pldAddTruckHome')?.value || '').trim();
  const notes = (document.getElementById('pldAddTruckNotes')?.value || '').trim();
  if (!name) {
    showToast('Unit name is required', 'error');
    return;
  }
  if (!type) {
    showToast('Select a truck type', 'error');
    return;
  }
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API client not loaded', 'error');
    return;
  }
  const payload = {
    name,
    type,
    status: 'available',
    license_plate: plate || null,
    home_base: home || null,
    notes: notes || null,
  };
  const r = await window.pldApiFetch('/api/v1/trucks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = r.body && r.body.errors && r.body.errors[0];
    const msg =
      (err && err.message) ||
      (err && err.code) ||
      (r.status === 429 ? 'Too many requests — try again shortly' : 'Could not create truck');
    showToast(String(msg), 'error');
    return;
  }
  closeModal();
  showToast('Truck added', 'success');
  await fetchTrucksFromApiIfConfigured();
  if (typeof renderPage === 'function') renderPage('trucks');
};

// ============================================
// TRAVEL (with sub-tabs)
