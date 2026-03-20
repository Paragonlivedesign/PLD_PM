// ============================================
// EVENTS
// ============================================
function renderEvents() {
  const filtered = selectedPhaseFilter ? EVENTS.filter(e => e.phase === selectedPhaseFilter) : EVENTS;
  return `
    <div class="page-header">
      <div><h1 class="page-title">Events</h1><p class="page-subtitle">Manage production events across the full lifecycle</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="openCloneEventModal()">Clone Event</button>
        <button class="btn btn-primary" onclick="openNewEventModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Event
        </button>
      </div>
    </div>
    <div class="lifecycle-pipeline">
      <div class="lifecycle-stage ${!selectedPhaseFilter ? 'active' : ''}" onclick="selectedPhaseFilter = null; renderPage('events');" style="background:var(--bg-tertiary);color:var(--text-secondary);">
        All <span class="stage-count">${EVENTS.length}</span>
      </div>
      <span class="lifecycle-arrow">${uiIcon('arrowRight')}</span>
      ${PHASES.map((phase, i) => `
        <div class="lifecycle-stage ${phase} ${selectedPhaseFilter === phase ? 'active' : ''}" onclick="selectedPhaseFilter = '${phase}'; renderPage('events');">
          ${PHASE_LABELS[phase]} <span class="stage-count">${getPhaseCount(phase)}</span>
        </div>
        ${i < PHASES.length - 1 ? '<span class="lifecycle-arrow">'+uiIcon('arrowRight')+'</span>' : ''}
      `).join('')}
    </div>
    <div class="filter-bar">
      <select class="filter-select" onchange="if(this.value!=='All Clients'){showToast('Filtering by '+this.value,'success');}"><option>All Clients</option>${CLIENTS.map(c => `<option>${c.name}</option>`).join('')}</select>
      <select class="filter-select" onchange="showToast('Sorted by '+this.value.replace('Sort by ',''),'success')"><option>Sort by Date</option><option>Sort by Name</option><option>Sort by Budget</option><option>Sort by Priority</option></select>
      <input type="text" class="filter-input" placeholder="Search events…" style="min-width:200px;">
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Event</th><th>Client</th><th>Venue</th><th>Phase</th><th>Dates</th><th>Crew</th><th>Budget</th><th>Priority</th></tr></thead>
        <tbody>
          ${filtered.sort((a,b) => a.startDate.localeCompare(b.startDate)).map(ev => {
            const client = getClient(ev.client);
            const venue = getVenue(ev.venue);
            const priorityColors = { critical: 'var(--accent-red)', high: 'var(--accent-orange)', medium: 'var(--accent-amber)', low: 'var(--text-tertiary)' };
            return `<tr onclick="navigateToEvent('${ev.id}')">
              <td><div style="font-weight:600;">${ev.name}</div></td>
              <td>${client.name}</td>
              <td><div>${venue.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${venue.city}</div></td>
              <td><span class="phase-badge ${ev.phase}">${PHASE_LABELS[ev.phase]}</span></td>
              <td style="white-space:nowrap;">${formatDateShort(ev.startDate)}${ev.startDate !== ev.endDate ? ' — ' + formatDateShort(ev.endDate) : ''}</td>
              <td><div style="display:flex;">${ev.crew.slice(0, 3).map(cid => { const p = getPersonnel(cid); return `<div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;border:2px solid var(--bg-secondary);margin-left:-4px;">${p.initials}</div>`; }).join('')}${ev.crew.length > 3 ? `<div style="width:24px;height:24px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:var(--text-tertiary);border:2px solid var(--bg-secondary);margin-left:-4px;">+${ev.crew.length - 3}</div>` : ''}${ev.crew.length === 0 ? '<span style="color:var(--text-tertiary);font-size:12px;">'+uiIcon('crewEmpty')+'</span>' : ''}</div></td>
              <td><div style="font-weight:500;">${formatCurrency(ev.budget)}</div>${ev.spent > 0 ? `<div style="font-size:11px;color:var(--text-tertiary);">${Math.round(ev.spent / ev.budget * 100)}% spent</div>` : ''}</td>
              <td><span style="color:${priorityColors[ev.priority]};font-size:12px;font-weight:600;text-transform:uppercase;">${ev.priority}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openEventDetail(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const client = getClient(ev.client);
  const venue = getVenue(ev.venue);
  const currentIdx = PHASES.indexOf(ev.phase);
  const prevPhase = currentIdx > 0 ? PHASES[currentIdx - 1] : null;
  const nextPhase = currentIdx < PHASES.length - 1 ? PHASES[currentIdx + 1] : null;
  const relatedDocs = DOCUMENTS.filter(d => d.event === ev.id);
  const relatedTravel = TRAVEL_RECORDS.filter(t => t.event === ev.id);

  const body = `
    <div class="event-detail-header">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span class="phase-badge ${ev.phase}">${PHASE_LABELS[ev.phase]}</span>
          <span style="font-size:12px;font-weight:600;text-transform:uppercase;color:${ev.priority === 'critical' ? 'var(--accent-red)' : ev.priority === 'high' ? 'var(--accent-orange)' : 'var(--text-tertiary)'};">${ev.priority} priority</span>
        </div>
        <h2 class="event-detail-title">${ev.name}</h2>
        <div class="event-detail-meta">
          <span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>${client.name} (${client.contact})</span>
          <span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${venue.name}, ${venue.city}</span>
          <span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${formatDate(ev.startDate)}${ev.startDate !== ev.endDate ? ' — ' + formatDate(ev.endDate) : ''}</span>
        </div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">PHASE TRANSITION</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${prevPhase ? `<button class="btn btn-secondary btn-sm" onclick="transitionPhase('${ev.id}', '${prevPhase}')">← Back to ${PHASE_LABELS[prevPhase]}</button>` : ''}
        <span class="phase-badge ${ev.phase}" style="font-size:13px;padding:6px 14px;">${PHASE_LABELS[ev.phase]}</span>
        ${nextPhase ? `<button class="btn btn-primary btn-sm" onclick="transitionPhase('${ev.id}', '${nextPhase}')">Advance to ${PHASE_LABELS[nextPhase]} →</button>` : '<span style="font-size:12px;color:var(--text-tertiary);">Final phase</span>'}
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">BUDGET</div>
      <div class="budget-bar-container">
        <div class="budget-bar-label"><span>Spent: ${formatCurrency(ev.spent)}</span><span>Budget: ${formatCurrency(ev.budget)}</span></div>
        <div class="budget-bar"><div class="budget-bar-fill ${ev.spent / ev.budget > 0.9 ? 'red' : ev.spent / ev.budget > 0.7 ? 'amber' : 'blue'}" style="width:${Math.min(100, Math.round(ev.spent / ev.budget * 100))}%;"></div></div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">CREW (${ev.crew.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="closeModal();setTimeout(()=>openAssignCrewModal('${ev.id}'),150)">+ Add</button>
      </div>
      ${ev.crew.length > 0 ? `<div style="display:flex;flex-direction:column;gap:8px;">${ev.crew.map(cid => { const p = getPersonnel(cid); const dept = getDepartment(p.dept); return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);"><div style="width:32px;height:32px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;">${p.initials}</div><div style="flex:1;"><div style="font-weight:500;font-size:13px;">${p.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${p.role} · ${dept.name}</div></div><div style="font-size:12px;color:var(--text-secondary);">${formatCurrency(p.rate)}/day</div><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showConfirm('Remove Crew','Remove ${p.name} from this event?',()=>showToast('${p.name} removed','warning'))">✖</button></div>`; }).join('')}</div>` : '<div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px;">No crew assigned yet</div>'}
    </div>

    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">TRUCKS (${ev.trucks.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="closeModal();setTimeout(()=>openAssignTruckModal('${ev.id}'),150)">+ Assign</button>
      </div>
      ${ev.trucks.length > 0 ? ev.trucks.map(tid => { const t = getTruck(tid); return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:6px;"><div style="width:32px;height:32px;background:var(--accent-amber-muted);color:var(--accent-amber);display:flex;align-items:center;justify-content:center;font-size:14px;">${uiIcon('truck')}</div><div style="flex:1;"><div style="font-weight:500;font-size:13px;">${t.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${t.type}</div></div></div>`; }).join('') : '<div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px;">No trucks assigned yet</div>'}
    </div>

    ${relatedDocs.length > 0 ? `<div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">DOCUMENTS (${relatedDocs.length})</div>
      ${relatedDocs.map(d => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>openDocPreview('${d.id}'),150)"><div style="font-size:14px;">${uiIcon('docPreview')}</div><div style="flex:1;"><div style="font-weight:500;font-size:12px;">${d.name}</div><div style="font-size:11px;color:var(--text-tertiary);">v${d.version} · ${d.size}</div></div></div>`).join('')}
    </div>` : ''}

    ${relatedTravel.length > 0 ? `<div>
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">TRAVEL (${relatedTravel.length} records)</div>
      ${relatedTravel.map(tr => { const p = getPersonnel(tr.personnel); return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>openTravelDetailModal('${tr.id}'),150)"><div style="font-size:14px;">${uiIcon({flight:'travelFlight',hotel:'travelHotel',self_drive:'travelSelfDrive'}[tr.type]||'travelLocation')}</div><div style="flex:1;"><div style="font-weight:500;font-size:12px;">${p.name} — ${tr.from}${tr.to ? ' → '+tr.to : ''}</div><div style="font-size:11px;color:var(--text-tertiary);">${formatDate(tr.date)} · ${formatCurrency(tr.cost)}</div></div></div>`; }).join('')}
    </div>` : ''}
  `;

  openModal(ev.name, body, `
    <button class="btn btn-danger btn-sm" onclick="showConfirm('Delete Event','Are you sure you want to delete ${ev.name}? This cannot be undone.', () => showToast('Event deleted','error'))">Delete</button>
    <div style="flex:1;"></div>
    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" onclick="showToast('Event saved!', 'success'); closeModal();">Save Changes</button>
  `);
}

function transitionPhase(eventId, newPhase) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (ev) {
    const oldPhase = ev.phase;
    ev.phase = newPhase;
    showToast(`${ev.name}: ${PHASE_LABELS[oldPhase]} → ${PHASE_LABELS[newPhase]}`, 'success');
    closeModal();
    renderPage(currentPage);
  }
}

function openNewEventModal(prefillStart, prefillEnd) {
  const startVal = prefillStart || '';
  const endVal = prefillEnd || prefillStart || '';
  const body = `
    <div class="form-group"><label class="form-label">Event Name</label><input type="text" class="form-input" placeholder="e.g. Super Bowl LXII Pre-Show"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Client</label><select class="form-select"><option value="">Select client…</option>${CLIENTS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Venue</label><select class="form-select"><option value="">Select venue…</option>${VENUES.map(v => `<option value="${v.id}">${v.name} — ${v.city}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" id="newEventStart" value="${startVal}"></div>
      <div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-input" id="newEventEnd" value="${endVal}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Budget</label><input type="number" class="form-input" placeholder="$0"></div>
      <div class="form-group"><label class="form-label">Priority</label><select class="form-select"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Any additional details…"></textarea></div>
  `;
  openModal('Create New Event', body, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="showToast('Event created successfully!', 'success'); closeModal();">Create Event</button>
  `);
}
