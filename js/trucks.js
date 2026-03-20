/* ============================================
   Module: Trucks Page
   Depends on: state.js, data.js, modal.js
   ============================================ */
function renderTrucks() {
  const statusColors = { available: 'var(--accent-green)', deployed: 'var(--accent-blue)', in_transit: 'var(--accent-amber)', maintenance: 'var(--accent-red)' };
  const statusLabels = { available: 'Available', deployed: 'Deployed', in_transit: 'In Transit', maintenance: 'Maintenance' };
  return `
    <div class="page-header">
      <div><h1 class="page-title">Trucks</h1><p class="page-subtitle">${trucksView === 'routes' ? (TRUCK_ROUTES || []).length + ' routes' : TRUCKS.length + ' units in fleet'}</p></div>
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
      ${Object.entries(statusLabels).map(([key, label]) => `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value" style="color:${statusColors[key]};">${TRUCKS.filter(t => t.status === key).length}</div></div>`).join('')}
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Unit</th><th>Type</th><th>Status</th><th>Location</th><th>Actions</th></tr></thead>
        <tbody>${TRUCKS.map(t => `<tr>
          <td><strong>${t.name}</strong></td><td>${t.type}</td>
          <td><span class="phase-badge" style="background:${statusColors[t.status]}20;color:${statusColors[t.status]};">${statusLabels[t.status]}</span></td>
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
  const t = TRUCKS.find(x => x.id === truckId);
  if (!t) return;
  const statusColors = { available: 'var(--accent-green)', deployed: 'var(--accent-blue)', in_transit: 'var(--accent-amber)', maintenance: 'var(--accent-red)' };
  const statusLabels = { available: 'Available', deployed: 'Deployed', in_transit: 'In Transit', maintenance: 'Maintenance' };
  const assignedEvents = EVENTS.filter(e => e.trucks.includes(t.id));

  const body = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
      <div style="width:56px;height:56px;background:var(--accent-amber-muted);color:var(--accent-amber);display:flex;align-items:center;justify-content:center;font-size:28px;">${uiIcon('truck')}</div>
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:700;">${t.name}</div>
        <div style="font-size:13px;color:var(--text-tertiary);">${t.type}</div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <span class="personnel-tag" style="background:${statusColors[t.status]}20;color:${statusColors[t.status]};">${statusLabels[t.status]}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="form-group"><label class="form-label">Current Location</label><input type="text" class="form-input" value="${t.location}"></div>
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

function openAddTruckModal() {
  const body = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Unit Name</label><input type="text" class="form-input" placeholder="e.g. G-Unit"></div>
      <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option>53ft Audio</option><option>53ft Video</option><option>48ft Lighting</option><option>53ft Staging</option><option>28ft Support</option><option>53ft Multi</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">License Plate</label><input type="text" class="form-input" placeholder="XX-0000"></div>
      <div class="form-group"><label class="form-label">Home Location</label><input type="text" class="form-input" placeholder="Warehouse"></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Equipment inventory, special features…"></textarea></div>
  `;
  openModal('Add Truck', body, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Truck added!','success');closeModal();">Add Truck</button>`);
}

// ============================================
// TRAVEL (with sub-tabs)
