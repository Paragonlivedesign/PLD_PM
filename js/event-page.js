// ============================================
// EVENT / PROJECT PAGE — Command Center
// ============================================
function navigateToEvent(eventId) {
  selectedEventId = eventId;
  if (!eventPageTab) eventPageTab = 'overview';
  navigateTo('event');
}

function switchEventTab(tab) {
  eventPageTab = tab;
  renderPage('event');
}

function saveEventHeaderField(eventId, field, value) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  if (field === 'name') ev.name = value;
  else if (field === 'client') ev.client = value;
  else if (field === 'venue') ev.venue = value;
  else if (field === 'startDate') ev.startDate = value;
  else if (field === 'endDate') ev.endDate = value;
  else if (field === 'priority') ev.priority = value;
  eventEditingField = null;
  renderPage('event');
  showToast('Saved', 'success');
}

function beginEditEventHeader(field) {
  eventEditingField = field;
  renderPage('event');
}

function renderEventPage() {
  const ev = EVENTS.find(e => e.id === selectedEventId);
  if (!ev) return '<div class="empty-state"><h3>Event not found</h3><button class="btn btn-primary" onclick="navigateTo(\'events\')">Back to Events</button></div>';
  const client = getClient(ev.client);
  const venue = getVenue(ev.venue);
  const currentIdx = PHASES.indexOf(ev.phase);
  const prevPhase = currentIdx > 0 ? PHASES[currentIdx - 1] : null;
  const nextPhase = currentIdx < PHASES.length - 1 ? PHASES[currentIdx + 1] : null;
  const priorityColors = { critical: 'var(--accent-red)', high: 'var(--accent-orange)', medium: 'var(--accent-amber)', low: 'var(--text-tertiary)' };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'crew', label: `Crew (${ev.crew.length})` },
    { key: 'trucks', label: `Trucks (${ev.trucks.length})` },
    { key: 'running', label: 'Running Schedule' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'crewlist', label: 'Crew List' },
    { key: 'radios', label: 'Radios' },
    { key: 'travel', label: 'Travel' },
    { key: 'financial', label: 'Financial' },
    { key: 'documents', label: 'Documents' },
    { key: 'riders', label: `Riders (${(RIDER_ITEMS || []).filter(r => r.event_id === ev.id).length})` },
  ];

  let tabContent = '';
  switch (eventPageTab) {
    case 'overview': tabContent = renderEventOverviewTab(ev, client, venue); break;
    case 'crew': tabContent = renderEventCrewTab(ev, client, venue); break;
    case 'trucks': tabContent = renderEventTrucksTab(ev, client, venue); break;
    case 'running': tabContent = renderRunningScheduleGrid(ev, venue, client); break;
    case 'schedule': tabContent = renderDailySchedule(ev, venue, client); break;
    case 'crewlist': tabContent = renderEventCrewList(ev, venue, client); break;
    case 'radios': tabContent = renderRadiosTab(ev); break;
    case 'travel': tabContent = renderEventTravelTab(ev, client, venue); break;
    case 'financial': tabContent = renderEventFinancialTab(ev, client, venue); break;
    case 'documents': tabContent = renderEventDocumentsTab(ev, client, venue); break;
    case 'riders': tabContent = renderEventRidersTab(ev, client, venue); break;
    default: tabContent = renderEventOverviewTab(ev, client, venue);
  }

  return `
    <div class="event-page">
      <!-- Persistent Header (inline editable) -->
      <div class="ep-header">
        <div class="ep-header-left">
          <div class="ep-title-row">
            ${eventEditingField === 'name' ? `
              <input type="text" class="form-input ep-title-inline" value="${ev.name.replace(/"/g, '&quot;')}" style="font-size:24px;font-weight:700;max-width:400px;"
                onkeydown="if(event.key==='Enter'){saveEventHeaderField('${ev.id}','name',this.value);}"
                onblur="saveEventHeaderField('${ev.id}','name',this.value);"
                onclick="event.stopPropagation();" />
            ` : `<h1 class="ep-title ep-clickable" title="Click to edit" onclick="beginEditEventHeader('name')">${ev.name}</h1>`}
            <span class="phase-badge ${ev.phase}">${PHASE_LABELS[ev.phase]}</span>
            ${eventEditingField === 'priority' ? `
              <select class="form-select ep-priority-inline" style="max-width:120px;padding:4px 8px;font-size:13px;"
                onchange="saveEventHeaderField('${ev.id}','priority',this.value);" onclick="event.stopPropagation();">
                ${['low','medium','high','critical'].map(p => `<option value="${p}" ${ev.priority===p?'selected':''}>${p}</option>`).join('')}
              </select>
            ` : `<span class="ep-priority ep-clickable" style="color:${priorityColors[ev.priority]};" title="Click to edit" onclick="beginEditEventHeader('priority')">${ev.priority}</span>`}
          </div>
          <div class="ep-meta-row">
            ${eventEditingField === 'client' ? `
              <span class="ep-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>
              <select class="form-select" style="max-width:180px;padding:4px 8px;font-size:13px;display:inline-block;" onchange="saveEventHeaderField('${ev.id}','client',this.value);" onclick="event.stopPropagation();">
                ${CLIENTS.map(c => `<option value="${c.id}" ${ev.client===c.id?'selected':''}>${c.name}</option>`).join('')}
              </select>
            ` : `<span class="ep-meta-item ep-clickable" title="Click to edit client" onclick="beginEditEventHeader('client')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${client.name}</span>`}
            ${eventEditingField === 'venue' ? `
              <span class="ep-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
              <select class="form-select" style="max-width:220px;padding:4px 8px;font-size:13px;display:inline-block;" onchange="saveEventHeaderField('${ev.id}','venue',this.value);" onclick="event.stopPropagation();">
                ${VENUES.map(v => `<option value="${v.id}" ${ev.venue===v.id?'selected':''}>${v.name}, ${v.city}</option>`).join('')}
              </select>
            ` : `<span class="ep-meta-item ep-clickable" title="Click to edit venue" onclick="beginEditEventHeader('venue')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${venue.name}, ${venue.city}</span>`}
            ${eventEditingField === 'dates' ? `
              <span class="ep-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
              <input type="date" class="form-input" value="${ev.startDate}" style="max-width:130px;padding:4px 8px;font-size:13px;display:inline-block;" onchange="saveEventHeaderField('${ev.id}','startDate',this.value);" onclick="event.stopPropagation();" />
              <input type="date" class="form-input" value="${ev.endDate}" style="max-width:130px;padding:4px 8px;font-size:13px;display:inline-block;margin-left:4px;" onchange="saveEventHeaderField('${ev.id}','endDate',this.value);" onclick="event.stopPropagation();" />
              <button class="btn btn-ghost btn-sm" style="margin-left:4px;" onclick="eventEditingField=null;renderPage('event');">Done</button>
            ` : `<span class="ep-meta-item ep-clickable" title="Click to edit dates" onclick="beginEditEventHeader('dates')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${formatDate(ev.startDate)}${ev.startDate !== ev.endDate ? ' — ' + formatDate(ev.endDate) : ''}</span>`}
          </div>
        </div>
        <div class="ep-header-right">
          ${prevPhase ? `<button class="btn btn-ghost btn-sm" onclick="transitionPhase('${ev.id}','${prevPhase}')">${uiIcon('arrowLeft')} ${PHASE_LABELS[prevPhase]}</button>` : ''}
          ${nextPhase ? `<button class="btn btn-primary btn-sm" onclick="transitionPhase('${ev.id}','${nextPhase}')">${PHASE_LABELS[nextPhase]} →</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="openExportModal('${ev.name}')">Export</button>
          <button class="btn btn-ghost btn-sm" onclick="openPrintModal('${ev.id}')">Print</button>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="ep-tabs">
        ${tabs.map(t => `<button class="ep-tab ${eventPageTab === t.key ? 'active' : ''}" onclick="switchEventTab('${t.key}')">${t.label}</button>`).join('')}
      </div>

      <!-- Tab Content -->
      <div class="ep-content ${eventPageTab === 'running' || eventPageTab === 'schedule' || eventPageTab === 'crewlist' || eventPageTab === 'radios' ? 'ep-content-full' : ''}">
        ${(eventPageTab === 'running' && rsSettingsOpen) ? `
          <div class="rs-content-layout settings-open">
            <div class="rs-tab-content">${tabContent}</div>
            ${renderRSSettingsPanel()}
          </div>
        ` : tabContent}
      </div>

      ${eventPageTab === 'running' ? `
        <div class="ep-floating-settings">
          <button class="btn btn-ghost btn-sm rs-settings-btn ${rsSettingsOpen ? 'active' : ''}" onclick="rsSettingsOpen=!rsSettingsOpen;renderPage('event');" title="Configure Running Schedule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderEventOverviewTab(ev, client, venue) {
  const relatedDocs = DOCUMENTS.filter(d => d.event === ev.id);
  const relatedTravel = TRAVEL_RECORDS.filter(t => t.event === ev.id);
  const budgetPct = ev.budget > 0 ? Math.round(ev.spent / ev.budget * 100) : 0;
  const daysUntil = Math.ceil((new Date(ev.startDate) - new Date()) / (1000 * 60 * 60 * 24));
  const daysLabel = daysUntil > 0 ? `${daysUntil} days away` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`;

  return `
    <div class="ep-overview-grid">
      <!-- Stats Row -->
      <div class="ep-stats-row">
        <div class="stat-card"><div class="stat-label">Budget</div><div class="stat-value">${formatCurrency(ev.budget)}</div></div>
        <div class="stat-card"><div class="stat-label">Spent</div><div class="stat-value" style="color:var(--accent-amber);">${formatCurrency(ev.spent)}</div></div>
        <div class="stat-card"><div class="stat-label">Crew</div><div class="stat-value">${ev.crew.length}</div></div>
        <div class="stat-card"><div class="stat-label">Trucks</div><div class="stat-value">${ev.trucks.length}</div></div>
        <div class="stat-card"><div class="stat-label">Start</div><div class="stat-value" style="font-size:16px;">${daysLabel}</div></div>
      </div>

      <!-- Budget Bar -->
      <div class="ep-section">
        <div class="ep-section-header">Budget</div>
        <div class="budget-bar-container">
          <div class="budget-bar-label"><span>Spent: ${formatCurrency(ev.spent)} (${budgetPct}%)</span><span>Budget: ${formatCurrency(ev.budget)}</span></div>
          <div class="budget-bar"><div class="budget-bar-fill ${budgetPct > 90 ? 'red' : budgetPct > 70 ? 'amber' : 'blue'}" style="width:${Math.min(100, budgetPct)}%;"></div></div>
        </div>
      </div>

      <div style="margin-bottom:16px;"><button class="btn btn-secondary btn-sm" onclick="openSendEmailModal('overview', '${ev.id}')">✉ Send Email</button></div>

      <div class="ep-two-col">
        <!-- Crew Summary -->
        <div class="ep-section">
          <div class="ep-section-header">
            <span>Crew (${ev.crew.length})</span>
            <button class="btn btn-ghost btn-sm" onclick="switchEventTab('crew')">Manage →</button>
          </div>
          ${ev.crew.length > 0 ? ev.crew.slice(0, 5).map(cid => {
            const p = getPersonnel(cid); const dept = getDepartment(p.dept);
            return `<div class="ep-list-item" onclick="openPersonnelDetail('${p.id}')"><div class="ep-avatar" style="background:${p.avatar};">${p.initials}</div><div class="ep-list-info"><div class="ep-list-name">${p.name}</div><div class="ep-list-sub">${p.role} · ${dept.name}</div></div><div class="ep-list-extra">${formatCurrency(p.rate)}/day</div></div>`;
          }).join('') + (ev.crew.length > 5 ? `<div class="ep-list-more" onclick="switchEventTab('crew')">+${ev.crew.length - 5} more</div>` : '') : '<div class="ep-empty">No crew assigned</div>'}
        </div>

        <!-- Trucks Summary -->
        <div class="ep-section">
          <div class="ep-section-header">
            <span>Trucks (${ev.trucks.length})</span>
            <button class="btn btn-ghost btn-sm" onclick="switchEventTab('trucks')">Manage →</button>
          </div>
          ${ev.trucks.length > 0 ? ev.trucks.map(tid => {
            const t = getTruck(tid);
            return `<div class="ep-list-item"><div class="ep-avatar" style="background:var(--accent-amber-muted);color:var(--accent-amber);font-size:16px;">${uiIcon('docPreview')}</div><div class="ep-list-info"><div class="ep-list-name">${t.name}</div><div class="ep-list-sub">${t.type}</div></div></div>`;
          }).join('') : '<div class="ep-empty">No trucks assigned</div>'}
        </div>
      </div>

      <div class="ep-two-col">
        <!-- Documents -->
        <div class="ep-section">
          <div class="ep-section-header">
            <span>Documents (${relatedDocs.length})</span>
            <button class="btn btn-ghost btn-sm" onclick="switchEventTab('documents')">View all →</button>
          </div>
          ${relatedDocs.length > 0 ? relatedDocs.map(d => `<div class="ep-list-item" onclick="openDocPreview('${d.id}')"><div style="font-size:16px;">${uiIcon('docPreview')}</div><div class="ep-list-info"><div class="ep-list-name">${d.name}</div><div class="ep-list-sub">v${d.version} · ${d.size}</div></div></div>`).join('') : '<div class="ep-empty">No documents yet</div>'}
        </div>

        <!-- Travel -->
        <div class="ep-section">
          <div class="ep-section-header">
            <span>Travel (${relatedTravel.length})</span>
            <button class="btn btn-ghost btn-sm" onclick="switchEventTab('travel')">View all →</button>
          </div>
          ${relatedTravel.length > 0 ? relatedTravel.map(tr => {
            const p = getPersonnel(tr.personnel);
            return `<div class="ep-list-item" onclick="openTravelDetailModal('${tr.id}')"><div style="font-size:16px;">${uiIcon({flight:'travelFlight',hotel:'travelHotel',self_drive:'travelSelfDrive'}[tr.type]||'travelLocation')}</div><div class="ep-list-info"><div class="ep-list-name">${p.name} — ${tr.from}${tr.to?' → '+tr.to:''}</div><div class="ep-list-sub">${formatDate(tr.date)} · ${formatCurrency(tr.cost)}</div></div></div>`;
          }).join('') : '<div class="ep-empty">No travel records</div>'}
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="ep-section">
        <div class="ep-section-header">Recent Activity</div>
        ${ACTIVITY_LOG.slice(0, 5).map(l => `
          <div class="ep-list-item">
            <div class="ep-avatar" style="background:${l.color}20;color:${l.color};font-size:11px;font-weight:700;">${l.user.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
            <div class="ep-list-info"><div class="ep-list-name">${l.user} ${l.action} ${l.target}</div><div class="ep-list-sub">${l.detail}</div></div>
            <div class="ep-list-extra" style="font-size:11px;">${l.time}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderEventCrewTab(ev, client, venue) {
  const assignedCrew = ev.crew.map(cid => getPersonnel(cid)).filter(Boolean);
  const deptGroups = {};
  assignedCrew.forEach(p => {
    const dept = getDepartment(p.dept);
    if (!deptGroups[dept.name]) deptGroups[dept.name] = { color: dept.color, members: [] };
    deptGroups[dept.name].members.push(p);
  });

  return `
    <div class="ep-crew-tab">
      <div class="ep-tab-header">
        <div class="ep-tab-header-left">
          <h3>${ev.crew.length} Crew Members</h3>
          <span style="color:var(--text-tertiary);font-size:13px;">${Object.keys(deptGroups).length} departments</span>
        </div>
        <div class="ep-tab-header-right">
          <button class="btn btn-ghost btn-sm" onclick="openSendEmailModal('crew', '${ev.id}')">Send Email</button>
          <button class="btn btn-secondary btn-sm" onclick="openExportCrewListModal('${ev.id}')">Export</button>
          <button class="btn btn-primary btn-sm" onclick="openAssignCrewModal('${ev.id}')">+ Assign Crew</button>
        </div>
      </div>

      ${Object.entries(deptGroups).map(([deptName, group]) => `
        <div class="ep-dept-group">
          <div class="ep-dept-header" style="border-left:3px solid ${group.color};">
            <span style="font-weight:600;">${deptName}</span>
            <span style="color:var(--text-tertiary);font-size:12px;">${group.members.length} members</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Role</th><th>Rate</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${group.members.map(p => `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:28px;height:28px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;">${p.initials}</div>
                      <span style="font-weight:500;" onclick="openPersonnelDetail('${p.id}')" class="ep-clickable">${p.name}</span>
                    </div></td>
                    <td>${p.role}</td>
                    <td>${formatCurrency(p.rate)}/day</td>
                    <td><span style="color:${p.status === 'available' ? 'var(--accent-green)' : p.status === 'on_event' ? 'var(--accent-blue)' : 'var(--accent-red)'};font-size:12px;font-weight:500;">${p.status === 'on_event' ? 'On Event' : p.status}</span></td>
                    <td><button class="btn btn-ghost btn-sm" style="color:var(--accent-red);" onclick="showConfirm('Remove','Remove ${p.name}?',()=>showToast('Removed','warning'))">Remove</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}

      ${ev.crew.length === 0 ? '<div class="ep-empty-state"><h3>No crew assigned</h3><p>Add crew members to get started.</p><button class="btn btn-primary" onclick="openAssignCrewModal(\'' + ev.id + '\')">+ Assign Crew</button></div>' : ''}
    </div>
  `;
}

function renderEventTrucksTab(ev, client, venue) {
  const assignedTrucks = ev.trucks.map(tid => getTruck(tid)).filter(Boolean);
  const eventRoutes = (typeof TRUCK_ROUTES !== 'undefined' ? TRUCK_ROUTES : []).filter(r => r.event_id === ev.id);

  return `
    <div class="ep-trucks-tab">
      <div class="ep-tab-header">
        <div class="ep-tab-header-left">
          <h3>${ev.trucks.length} Trucks Assigned</h3>
        </div>
        <div class="ep-tab-header-right">
          <button class="btn btn-primary btn-sm" onclick="openAssignTruckModal('${ev.id}')">+ Assign Truck</button>
        </div>
      </div>

      ${assignedTrucks.length > 0 ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Unit</th><th>Type</th><th>Status</th><th>Location</th><th>Driver</th><th></th></tr></thead>
            <tbody>
              ${assignedTrucks.map(t => `
                <tr>
                  <td><span style="font-weight:600;">${t.name}</span></td>
                  <td>${t.type}</td>
                  <td><span class="phase-badge" style="font-size:10px;">${t.status}</span></td>
                  <td>${t.location}</td>
                  <td><span style="color:var(--text-tertiary);font-size:12px;">TBD</span></td>
                  <td><button class="btn btn-ghost btn-sm" style="color:var(--accent-red);" onclick="showConfirm('Remove','Remove ${t.name}?',()=>showToast('Removed','warning'))">Remove</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="ep-empty-state"><h3>No trucks assigned</h3><p>Assign trucks for this event.</p><button class="btn btn-primary" onclick="openAssignTruckModal(\'' + ev.id + '\')">+ Assign Truck</button></div>'}

      <div class="ep-section" style="margin-top:24px;">
        <div class="ep-section-header">Routes</div>
        ${eventRoutes.length > 0 ? eventRoutes.map(r => {
          const t = getTruck(r.truck_id);
          const path = [r.origin].concat(r.waypoints || []).concat(r.destination);
          return `<div class="card" style="padding:12px 16px;margin-bottom:8px;display:grid;grid-template-columns:1fr 200px;gap:16px;align-items:center;">
            <div>
              <div style="font-weight:600;font-size:13px;">${t ? t.name : 'Unassigned'}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${path.join(' → ')}</div>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${r.distance_miles} mi · ${r.driver || 'Driver TBD'}</div>
            </div>
            <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);height:60px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-tertiary);">Route map</div>
          </div>`;
        }).join('') : '<div style="padding:16px;color:var(--text-tertiary);font-size:13px;">No routes for this event. Add routes from the Trucks page or when assigning trucks.</div>'}
      </div>
    </div>
  `;
}

function renderEventTravelTab(ev, client, venue) {
  const records = TRAVEL_RECORDS.filter(t => t.event === ev.id);
  const totalCost = records.reduce((s, t) => s + t.cost, 0);
  const flights = records.filter(t => t.type === 'flight');
  const hotels = records.filter(t => t.type === 'hotel');
  const drives = records.filter(t => t.type === 'self_drive');

  return `
    <div class="ep-travel-tab">
      <div class="ep-tab-header">
        <div class="ep-tab-header-left">
          <h3>${records.length} Travel Records</h3>
          <span style="color:var(--text-tertiary);font-size:13px;">Total: ${formatCurrency(totalCost)}</span>
        </div>
        <div class="ep-tab-header-right">
          <button class="btn btn-ghost btn-sm" onclick="openSendEmailModal('travel', '${ev.id}')">Send Email</button>
          <button class="btn btn-primary btn-sm" onclick="openBookTravelModal('${ev.id}')">+ Book Travel</button>
        </div>
      </div>

      <div class="ep-stats-row" style="margin-bottom:16px;">
        <div class="stat-card"><div class="stat-label">Flights</div><div class="stat-value">${flights.length}</div></div>
        <div class="stat-card"><div class="stat-label">Hotels</div><div class="stat-value">${hotels.length}</div></div>
        <div class="stat-card"><div class="stat-label">Ground</div><div class="stat-value">${drives.length}</div></div>
        <div class="stat-card"><div class="stat-label">Total Cost</div><div class="stat-value">${formatCurrency(totalCost)}</div></div>
      </div>

      ${records.length > 0 ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Type</th><th>Person</th><th>Details</th><th>Date</th><th>Cost</th><th>Status</th></tr></thead>
            <tbody>
              ${records.map(tr => {
                const p = getPersonnel(tr.personnel);
                const travelIconKey = {flight:'travelFlight',hotel:'travelHotel',self_drive:'travelSelfDrive'}[tr.type]||'travelLocation';
                return `<tr onclick="openTravelDetailModal('${tr.id}')" style="cursor:pointer;">
                  <td>${uiIcon(travelIconKey)} ${tr.type === 'self_drive' ? 'Drive' : tr.type.charAt(0).toUpperCase() + tr.type.slice(1)}</td>
                  <td><span class="ep-clickable">${p.name}</span></td>
                  <td>${tr.from}${tr.to ? ' → '+tr.to : ''}${tr.airline ? ` (${tr.airline} ${tr.flight})` : ''}</td>
                  <td>${formatDateShort(tr.date)}</td>
                  <td>${formatCurrency(tr.cost)}</td>
                  <td><span class="phase-badge" style="font-size:10px;">${tr.status}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="ep-empty-state"><h3>No travel booked</h3><p>Book flights, hotels, and ground transport for your crew.</p></div>'}
    </div>
  `;
}

function renderEventFinancialTab(ev, client, venue) {
  const budgetPct = ev.budget > 0 ? Math.round(ev.spent / ev.budget * 100) : 0;
  const remaining = ev.budget - ev.spent;
  const laborCost = Math.round(ev.spent * 0.45);
  const travelCost = Math.round(ev.spent * 0.18);
  const equipCost = Math.round(ev.spent * 0.22);
  const otherCost = ev.spent - laborCost - travelCost - equipCost;

  const categories = [
    { label: 'Labor', amount: laborCost, color: 'var(--accent-blue)', pct: ev.spent > 0 ? Math.round(laborCost/ev.spent*100) : 0 },
    { label: 'Equipment', amount: equipCost, color: 'var(--accent-amber)', pct: ev.spent > 0 ? Math.round(equipCost/ev.spent*100) : 0 },
    { label: 'Travel', amount: travelCost, color: 'var(--accent-purple)', pct: ev.spent > 0 ? Math.round(travelCost/ev.spent*100) : 0 },
    { label: 'Other', amount: otherCost, color: 'var(--accent-cyan)', pct: ev.spent > 0 ? Math.round(otherCost/ev.spent*100) : 0 },
  ];

  return `
    <div class="ep-financial-tab">
      <div class="ep-tab-header">
        <div class="ep-tab-header-left"><h3>Financial Summary</h3></div>
        <div class="ep-tab-header-right">
          <button class="btn btn-secondary btn-sm" onclick="openExportModal('${ev.name} Financial')">Export</button>
          <button class="btn btn-primary btn-sm" onclick="openAddExpenseModal('${ev.id}')">+ Add Expense</button>
        </div>
      </div>

      <div class="ep-stats-row" style="margin-bottom:20px;">
        <div class="stat-card"><div class="stat-label">Budget</div><div class="stat-value">${formatCurrency(ev.budget)}</div></div>
        <div class="stat-card"><div class="stat-label">Spent</div><div class="stat-value" style="color:var(--accent-amber);">${formatCurrency(ev.spent)}</div></div>
        <div class="stat-card"><div class="stat-label">Remaining</div><div class="stat-value" style="color:${remaining >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${formatCurrency(Math.abs(remaining))}</div></div>
        <div class="stat-card"><div class="stat-label">Utilization</div><div class="stat-value">${budgetPct}%</div></div>
      </div>

      <div class="ep-section">
        <div class="ep-section-header">Budget Progress</div>
        <div class="budget-bar-container">
          <div class="budget-bar"><div class="budget-bar-fill ${budgetPct > 90 ? 'red' : budgetPct > 70 ? 'amber' : 'blue'}" style="width:${Math.min(100, budgetPct)}%;"></div></div>
        </div>
      </div>

      <div class="ep-section">
        <div class="ep-section-header">Cost Breakdown</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Category</th><th>Amount</th><th>% of Total</th><th>Bar</th></tr></thead>
            <tbody>
              ${categories.map(c => `
                <tr>
                  <td><span style="font-weight:500;">${c.label}</span></td>
                  <td>${formatCurrency(c.amount)}</td>
                  <td>${c.pct}%</td>
                  <td><div style="width:100%;max-width:200px;height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${c.pct}%;background:${c.color};border-radius:4px;"></div></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderEventDocumentsTab(ev, client, venue) {
  const docs = DOCUMENTS.filter(d => d.event === ev.id);

  return `
    <div class="ep-documents-tab">
      <div class="ep-tab-header">
        <div class="ep-tab-header-left"><h3>${docs.length} Documents</h3></div>
        <div class="ep-tab-header-right">
          <button class="btn btn-secondary btn-sm" onclick="openGenerateDocModal('${ev.id}')">Generate</button>
          <button class="btn btn-primary btn-sm" onclick="openUploadDocModal()">+ Upload</button>
        </div>
      </div>

      ${docs.length > 0 ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Document</th><th>Type</th><th>Format</th><th>Size</th><th>Updated</th><th>Version</th></tr></thead>
            <tbody>
              ${docs.map(d => `
                <tr onclick="openDocPreview('${d.id}')" style="cursor:pointer;">
                  <td><span style="font-weight:500;">${d.name}</span></td>
                  <td><span style="font-size:12px;text-transform:capitalize;">${d.type.replace(/_/g,' ')}</span></td>
                  <td style="text-transform:uppercase;font-size:11px;font-weight:600;">${d.format}</td>
                  <td>${d.size}</td>
                  <td>${formatDate(d.updated)}</td>
                  <td>v${d.version}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="ep-empty-state"><h3>No documents yet</h3><p>Upload or generate documents for this event.</p></div>'}
    </div>
  `;
}

const RIDER_STATUS_OPTIONS = ['pending', 'confirmed', 'in_progress', 'completed', 'n/a'];

const RIDER_STATUS_STYLES = { pending: 'background:var(--bg-tertiary);color:var(--text-secondary);', confirmed: 'background:var(--accent-blue);color:#fff;', in_progress: 'background:var(--accent-amber);color:#000;', completed: 'background:var(--accent-green);color:#fff;', 'n/a': 'background:var(--bg-secondary);color:var(--text-tertiary);' };

function renderEventRidersTab(ev, client, venue) {
  const items = (RIDER_ITEMS || []).filter(r => r.event_id === ev.id);
  const statusLabel = s => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

  return `
    <div class="ep-riders-tab">
      <div class="ep-tab-header">
        <div class="ep-tab-header-left"><h3>Rider Items</h3></div>
        <div class="ep-tab-header-right">
          <button class="btn btn-primary btn-sm" onclick="showToast('Add rider item — coming soon','info')">+ Add Item</button>
        </div>
      </div>

      ${items.length > 0 ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Category</th><th>Description</th><th>Qty</th><th>Department</th><th>Status</th><th>Assigned to</th><th>Notes</th></tr></thead>
            <tbody>
              ${items.map(ri => {
                const dept = getDepartment(ri.department_id);
                const person = ri.assigned_to ? getPersonnel(ri.assigned_to) : null;
                const statusStyle = RIDER_STATUS_STYLES[ri.status] || RIDER_STATUS_STYLES.pending;
                return `<tr>
                  <td><span style="font-weight:500;">${ri.category || '—'}</span></td>
                  <td>${(ri.description || '—').replace(/"/g, '&quot;')}</td>
                  <td>${ri.quantity ?? '—'}</td>
                  <td>${dept ? dept.name : '—'}</td>
                  <td><span class="phase-badge" style="font-size:10px;${statusStyle}">${statusLabel(ri.status)}</span></td>
                  <td>${person ? person.name : '—'}</td>
                  <td style="font-size:12px;color:var(--text-secondary);">${(ri.notes || '—').replace(/"/g, '&quot;')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="ep-empty-state"><h3>No rider items yet</h3><p>Add items manually or extract from an uploaded rider document in the Documents tab.</p></div>'}
    </div>
  `;
}
