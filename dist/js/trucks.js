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
      });
    });
  }
  const el = document.querySelector('.page-title');
  if (el && el.textContent === 'Trucks' && typeof renderPage === 'function') {
    renderPage('trucks', { skipModuleDataFetch: true });
  }
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
      <div class="page-actions"><button class="btn btn-primary" onclick="openAddTruckModal()">+ Add Truck</button></div>
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
        <tbody>${fleet.map(t => `<tr>
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

function renderTrucksRoutes() {
  const routes = TRUCK_ROUTES || [];
  return `
    <div class="routes-list" style="display:flex;flex-direction:column;gap:16px;">
      ${routes.map(r => {
        const t = getTruck(r.truck_id);
        const ev = r.event_id ? EVENTS.find(e => e.id === r.event_id) : null;
        const path = [r.origin].concat(r.waypoints || []).concat(r.destination);
        return `
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="display:grid;grid-template-columns:1fr 280px;gap:0;min-height:120px;">
            <div style="padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-weight:600;">${t ? t.name : 'Unassigned'}</span>
                ${ev ? `<span class="phase-badge" style="font-size:10px;">${ev.name}</span>` : ''}
                <span class="phase-badge" style="font-size:10px;background:var(--bg-tertiary);">${r.status}</span>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                ${path.map((p, i) => `${i > 0 ? '<span style="color:var(--text-tertiary);">→</span>' : ''} <span>${p}</span>`).join(' ')}
              </div>
              <div style="margin-top:8px;font-size:12px;color:var(--text-tertiary);">${r.distance_miles} mi · Driver: ${r.driver || 'TBD'}</div>
            </div>
            <div style="background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;padding:16px;" title="Route map">
              <div style="font-size:11px;color:var(--text-tertiary);text-align:center;">Route map<br><span style="font-size:10px;">(visualization)</span></div>
            </div>
          </div>
        </div>`;
      }).join('')}
      ${routes.length === 0 ? '<div class="empty-state"><p>No routes yet. Assign trucks to events to see routes.</p></div>' : ''}
    </div>
  `;
}

function openTruckDetail(truckId) {
  const t = typeof getTruck === 'function' ? getTruck(truckId) : TRUCKS.find((x) => x.id === truckId);
  if (!t) return;
  const statusColors = trucksContractStatusColors();
  const statusLabels = trucksContractStatusLabels();
  const assignedEvents = EVENTS.filter(e => e.trucks.includes(t.id));

  const body = `
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
      <div class="form-group"><label class="form-label">Home base</label><input type="text" class="form-input" value="${t.location}" placeholder="Venue, warehouse, address, or lat,lng"><div class="form-hint">Free text: linked venue, warehouse, driver address, or GPS coordinates.</div></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-select">${Object.entries(statusLabels).map(([k,v]) => `<option ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="form-group"><label class="form-label">License Plate</label><input type="text" class="form-input" value="NY-${t.name.replace('-','')}-2026"></div>
      <div class="form-group"><label class="form-label">Last Service Date</label><input type="date" class="form-input" value="2026-01-15"></div>
    </div>
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
    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" onclick="showToast('${t.name} updated!','success');closeModal();">Save</button>
  `);
}

const PLD_TRUCK_TYPE_OPTIONS = [
  { value: 'box_truck', label: 'Box truck' },
  { value: 'semi_trailer', label: 'Semi trailer' },
  { value: 'sprinter_van', label: 'Sprinter van' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'other', label: 'Other' },
];

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
      <div class="form-group"><label class="form-label">Home base</label><input type="text" id="pldAddTruckHome" class="form-input" placeholder="Venue name, warehouse, address, or lat,lng"><div class="form-hint">Venue, warehouse, street address, or GPS — stored as you enter it.</div></div>
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
