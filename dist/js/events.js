// ============================================
// EVENTS
// ============================================

function phaseDisplayLabel(phase) {
  return PHASE_LABELS[phase] || (phase ? String(phase).replace(/_/g, ' ') : '—');
}

function getFilteredSortedEvents() {
  let list = EVENTS.slice();
  if (selectedPhaseFilter) {
    list = list.filter(function (e) {
      return e.phase === selectedPhaseFilter;
    });
  }
  if (eventsClientFilterId) {
    list = list.filter(function (e) {
      return e.client === eventsClientFilterId;
    });
  }
  const q = (eventsSearchText || '').trim().toLowerCase();
  if (q) {
    list = list.filter(function (e) {
      return (e.name || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  const dir = eventsSortOrder === 'desc' ? -1 : 1;
  list.sort(function (a, b) {
    if (eventsSortBy === 'name') {
      return dir * String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (eventsSortBy === 'budget') {
      return dir * (Number(a.budget || 0) - Number(b.budget || 0));
    }
    return dir * String(a.startDate || '').localeCompare(String(b.startDate || ''));
  });
  return list;
}

function onEventsClientFilterChange(value) {
  eventsClientFilterId = value || '';
  renderPage('events');
}

function onEventsSortChange(value) {
  if (value === 'Sort by Name') {
    eventsSortBy = 'name';
    eventsSortOrder = 'asc';
  } else if (value === 'Sort by Budget') {
    eventsSortBy = 'budget';
    eventsSortOrder = 'asc';
  } else if (value === 'Sort by Priority') {
    eventsSortBy = 'name';
    eventsSortOrder = 'asc';
  } else {
    eventsSortBy = 'start_date';
    eventsSortOrder = 'asc';
  }
  renderPage('events');
}

function onEventsSearchInput(value) {
  eventsSearchText = value || '';
  renderPage('events');
}

function renderEvents() {
  const filtered = getFilteredSortedEvents();
  const sortSelectVal =
    eventsSortBy === 'name'
      ? 'Sort by Name'
      : eventsSortBy === 'budget'
        ? 'Sort by Budget'
        : 'Sort by Date';
  const restHint =
    typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST
      ? '<span style="font-size:11px;color:var(--text-tertiary);margin-left:8px;">Live data from API</span>'
      : '';
  return `
    <div class="page-header">
      <div><h1 class="page-title">Events</h1><p class="page-subtitle">Manage production events across the full lifecycle${restHint}</p></div>
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
        ${i < PHASES.length - 1 ? '<span class="lifecycle-arrow">' + uiIcon('arrowRight') + '</span>' : ''}
      `).join('')}
    </div>
    <div class="filter-bar">
      <select class="filter-select" onchange="onEventsClientFilterChange(this.value)">
        <option value="">All Clients</option>
        ${CLIENTS.map((c) => `<option value="${c.id}" ${eventsClientFilterId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="onEventsSortChange(this.value)">
        <option ${sortSelectVal === 'Sort by Date' ? 'selected' : ''}>Sort by Date</option>
        <option ${sortSelectVal === 'Sort by Name' ? 'selected' : ''}>Sort by Name</option>
        <option ${sortSelectVal === 'Sort by Budget' ? 'selected' : ''}>Sort by Budget</option>
        <option>Sort by Priority</option>
      </select>
      <input type="text" class="filter-input" placeholder="Search events…" style="min-width:200px;" value="${String(eventsSearchText || '').replace(/"/g, '&quot;')}"
        oninput="onEventsSearchInput(this.value)" />
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Event</th><th>Client</th><th>Venue</th><th>Phase</th><th>Dates</th><th>Crew</th><th>Budget</th><th>Priority</th></tr></thead>
        <tbody>
          ${filtered
            .map((ev) => {
              const client = getClient(ev.client) || { name: '—', contact: '' };
              const venue = getVenue(ev.venue);
              const priorityColors = {
                critical: 'var(--accent-red)',
                high: 'var(--accent-orange)',
                medium: 'var(--accent-amber)',
                low: 'var(--text-tertiary)',
              };
              const pr = ev.priority || 'medium';
              const crew = Array.isArray(ev.crew) ? ev.crew : [];
              const pctSpent =
                ev.budget > 0 ? Math.round((Number(ev.spent) / Number(ev.budget)) * 100) : 0;
              return `<tr onclick="navigateToEvent('${ev.id}')">
              <td><div style="font-weight:600;">${ev.name}</div></td>
              <td>${client.name}</td>
              <td><div>${venue.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${venue.city}</div></td>
              <td><span class="phase-badge ${ev.phase}">${phaseDisplayLabel(ev.phase)}</span></td>
              <td style="white-space:nowrap;">${formatDateShort(ev.startDate)}${ev.startDate !== ev.endDate ? ' — ' + formatDateShort(ev.endDate) : ''}</td>
              <td><div style="display:flex;">${crew
                .slice(0, 3)
                .map((cid) => {
                  const p = getPersonnel(cid);
                  if (!p)
                    return `<div style="width:24px;height:24px;border-radius:50%;background:var(--bg-tertiary);margin-left:-4px;"></div>`;
                  return `<div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;border:2px solid var(--bg-secondary);margin-left:-4px;">${p.initials}</div>`;
                })
                .join('')}${
                  crew.length > 3
                    ? `<div style="width:24px;height:24px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:var(--text-tertiary);border:2px solid var(--bg-secondary);margin-left:-4px;">+${crew.length - 3}</div>`
                    : ''
                }${
                  crew.length === 0
                    ? '<span style="color:var(--text-tertiary);font-size:12px;">' + uiIcon('crewEmpty') + '</span>'
                    : ''
                }</div></td>
              <td><div style="font-weight:500;">${formatCurrency(ev.budget)}</div>${
                ev.spent > 0 && ev.budget > 0
                  ? `<div style="font-size:11px;color:var(--text-tertiary);">${pctSpent}% spent</div>`
                  : ''
              }</td>
              <td><span style="color:${priorityColors[pr] || 'var(--text-tertiary)'};font-size:12px;font-weight:600;text-transform:uppercase;">${pr}</span></td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function eventPhaseTransitionRowHtml(ev) {
  const currentIdx = PHASES.indexOf(ev.phase);
  const inOrder = currentIdx >= 0;
  const nextPhase = inOrder && currentIdx < PHASES.length - 1 ? PHASES[currentIdx + 1] : null;
  let backBtn = '';
  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    if (ev.phase !== 'planning') {
      backBtn = `<button type="button" class="btn btn-secondary btn-sm" onclick="transitionPhase('${ev.id}', 'planning')">Reset to Planning</button>`;
    }
  } else {
    const prevPhase = inOrder && currentIdx > 0 ? PHASES[currentIdx - 1] : null;
    if (prevPhase) {
      backBtn = `<button type="button" class="btn btn-secondary btn-sm" onclick="transitionPhase('${ev.id}', '${prevPhase}')">← Back to ${PHASE_LABELS[prevPhase]}</button>`;
    }
  }
  const nextBlock = nextPhase
    ? `<button type="button" class="btn btn-primary btn-sm" onclick="transitionPhase('${ev.id}', '${nextPhase}')">Advance to ${PHASE_LABELS[nextPhase]} →</button>`
    : '<span style="font-size:12px;color:var(--text-tertiary);">Final phase</span>';
  return `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      ${backBtn}
      <span class="phase-badge ${ev.phase}" style="font-size:13px;padding:6px 14px;">${phaseDisplayLabel(ev.phase)}</span>
      ${nextBlock}
    </div>
  `;
}

function openEventDetail(eventId) {
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) return;
  const client = getClient(ev.client) || { name: '—', contact: '' };
  const venue = getVenue(ev.venue);
  const relatedDocs = DOCUMENTS.filter((d) => d.event === ev.id);
  const relatedTravel = TRAVEL_RECORDS.filter((t) => t.event === ev.id);
  const budgetPct =
    ev.budget > 0 ? Math.min(100, Math.round((Number(ev.spent) / Number(ev.budget)) * 100)) : 0;
  const pr = ev.priority || 'medium';

  const body = `
    <div class="event-detail-header">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span class="phase-badge ${ev.phase}">${phaseDisplayLabel(ev.phase)}</span>
          <span style="font-size:12px;font-weight:600;text-transform:uppercase;color:${pr === 'critical' ? 'var(--accent-red)' : pr === 'high' ? 'var(--accent-orange)' : 'var(--text-tertiary)'};">${pr} priority</span>
        </div>
        <h2 class="event-detail-title">${ev.name}</h2>
        <div class="event-detail-meta">
          <span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>${client.name} (${client.contact || '—'})</span>
          <span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${venue.name}, ${venue.city}</span>
          <span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${formatDate(ev.startDate)}${ev.startDate !== ev.endDate ? ' — ' + formatDate(ev.endDate) : ''}</span>
        </div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">PHASE TRANSITION</div>
      ${eventPhaseTransitionRowHtml(ev)}
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">BUDGET</div>
      <div class="budget-bar-container">
        <div class="budget-bar-label"><span>Spent: ${formatCurrency(ev.spent)}</span><span>Budget: ${formatCurrency(ev.budget)}</span></div>
        <div class="budget-bar"><div class="budget-bar-fill ${budgetPct > 90 ? 'red' : budgetPct > 70 ? 'amber' : 'blue'}" style="width:${budgetPct}%;"></div></div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">CREW (${(ev.crew || []).length})</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal();setTimeout(()=>openAssignCrewModal('${ev.id}'),150)">+ Add</button>
      </div>
      ${(ev.crew || []).length > 0 ? `<div style="display:flex;flex-direction:column;gap:8px;">${(ev.crew || []).map((cid) => { const p = getPersonnel(cid); if (!p) return ''; const dept = getDepartment(p.dept); return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);"><div style="width:32px;height:32px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;">${p.initials}</div><div style="flex:1;"><div style="font-weight:500;font-size:13px;">${p.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${p.role} · ${dept ? dept.name : '—'}</div></div><div style="font-size:12px;color:var(--text-secondary);">${formatCurrency(p.rate)}/day</div><button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showConfirm('Remove Crew','Remove ${p.name} from this event?',()=>showToast('${p.name} removed','warning'))">✖</button></div>`; }).join('')}</div>` : '<div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px;">No crew assigned yet</div>'}
    </div>

    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">TRUCKS (${(ev.trucks || []).length})</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal();setTimeout(()=>openAssignTruckModal('${ev.id}'),150)">+ Assign</button>
      </div>
      ${(ev.trucks || []).length > 0 ? (ev.trucks || []).map((tid) => { const t = getTruck(tid); if (!t) return ''; return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:6px;"><div style="width:32px;height:32px;background:var(--accent-amber-muted);color:var(--accent-amber);display:flex;align-items:center;justify-content:center;font-size:14px;">${uiIcon('truck')}</div><div style="flex:1;"><div style="font-weight:500;font-size:13px;">${t.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${t.type}</div></div></div>`; }).join('') : '<div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px;">No trucks assigned yet</div>'}
    </div>

    ${relatedDocs.length > 0 ? `<div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">DOCUMENTS (${relatedDocs.length})</div>
      ${relatedDocs.map((d) => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>openDocPreview('${d.id}'),150)"><div style="font-size:14px;">${uiIcon('docPreview')}</div><div style="flex:1;"><div style="font-weight:500;font-size:12px;">${d.name}</div><div style="font-size:11px;color:var(--text-tertiary);">v${d.version} · ${d.size}</div></div></div>`).join('')}
    </div>` : ''}

    ${relatedTravel.length > 0 ? `<div>
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">TRAVEL (${relatedTravel.length} records)</div>
      ${relatedTravel.map((tr) => { const p = getPersonnel(tr.personnel); if (!p) return ''; return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>openTravelDetailModal('${tr.id}'),150)"><div style="font-size:14px;">${uiIcon({ flight: 'travelFlight', hotel: 'travelHotel', self_drive: 'travelSelfDrive' }[tr.type] || 'travelLocation')}</div><div style="flex:1;"><div style="font-weight:500;font-size:12px;">${p.name} — ${tr.from}${tr.to ? ' → ' + tr.to : ''}</div><div style="font-size:11px;color:var(--text-tertiary);">${formatDate(tr.date)} · ${formatCurrency(tr.cost)}</div></div></div>`; }).join('')}
    </div>` : ''}
  `;

  const deleteFn =
    typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST
      ? `showConfirm('Delete Event','Are you sure you want to delete ${String(ev.name).replace(/'/g, "\\'")}?', () => { void (async () => { const ok = await pldDeleteEventViaApi('${ev.id}'); if (ok) { showToast('Event deleted','success'); closeModal(); renderPage(currentPage); } })(); })`
      : `showConfirm('Delete Event','Are you sure you want to delete ${String(ev.name).replace(/'/g, "\\'")}? This cannot be undone.', () => showToast('Event deleted','error'))`;

  openModal(
    ev.name,
    body,
    `
    <button type="button" class="btn btn-danger btn-sm" onclick="${deleteFn}">Delete</button>
    <div style="flex:1;"></div>
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button type="button" class="btn btn-primary" onclick="showToast('Event saved!', 'success'); closeModal();">Save Changes</button>
  `,
  );
}

function pldNewEventOptEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

window.pldRefreshNewEventPrimaryContactOptions = async function pldRefreshNewEventPrimaryContactOptions() {
  const sel = document.getElementById('newEventPrimaryContact');
  if (!sel || typeof pldListContactsForParent !== 'function') return;
  const clientEl = document.getElementById('newEventClient');
  const venueEl = document.getElementById('newEventVenue');
  let client_id =
    clientEl && clientEl.value && clientEl.value !== NEW_EVENT_CLIENT_CREATE_VALUE
      ? String(clientEl.value)
      : '';
  const venue_id = venueEl && venueEl.value ? String(venueEl.value) : '';
  const prev = sel.value || '';
  let html = '<option value="">None</option>';
  if (client_id) {
    const clientRows = await pldListContactsForParent('client', client_id);
    clientRows.forEach(function (r) {
      const id = String(r.id);
      const lab = 'Client: ' + String(r.name || '') + (r.email ? ' · ' + r.email : '');
      html +=
        '<option value="' +
        pldNewEventOptEsc(id) +
        '">' +
        pldNewEventOptEsc(lab) +
        '</option>';
    });
  }
  if (venue_id) {
    const venueRows = await pldListContactsForParent('venue', venue_id);
    venueRows.forEach(function (r) {
      const id = String(r.id);
      const lab = 'Venue: ' + String(r.name || '') + (r.email ? ' · ' + r.email : '');
      html +=
        '<option value="' +
        pldNewEventOptEsc(id) +
        '">' +
        pldNewEventOptEsc(lab) +
        '</option>';
    });
  }
  sel.innerHTML = html;
  if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) {
    sel.value = prev;
  }
};

function transitionPhase(eventId, newPhase) {
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) return;

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      const oldPhase = ev.phase;
      const ok = await pldTransitionEventPhaseViaApi(eventId, newPhase, null);
      if (ok) {
        showToast(`${ev.name}: ${phaseDisplayLabel(oldPhase)} → ${phaseDisplayLabel(newPhase)}`, 'success');
        closeModal();
        renderPage(currentPage);
      }
    })();
    return;
  }

  const oldPhase = ev.phase;
  ev.phase = newPhase;
  persistEventFields(eventId, { phase: newPhase });
  showToast(`${ev.name}: ${phaseDisplayLabel(oldPhase)} → ${phaseDisplayLabel(newPhase)}`, 'success');
  closeModal();
  renderPage(currentPage);
}

function submitNewEventForm() {
  const nameEl = document.getElementById('newEventName');
  const clientEl = document.getElementById('newEventClient');
  const venueEl = document.getElementById('newEventVenue');
  const startEl = document.getElementById('newEventStart');
  const endEl = document.getElementById('newEventEnd');
  const budgetEl = document.getElementById('newEventBudget');
  const priorityEl = document.getElementById('newEventPriority');
  const descEl = document.getElementById('newEventDescription');
  const name = nameEl && nameEl.value ? nameEl.value.trim() : '';
  let client_id = clientEl && clientEl.value ? clientEl.value : '';
  if (client_id === NEW_EVENT_CLIENT_CREATE_VALUE) client_id = '';
  const venue_id = venueEl && venueEl.value ? venueEl.value : '';
  const start_date = startEl && startEl.value ? startEl.value : '';
  const end_date = endEl && endEl.value ? endEl.value : '';
  const budgetRaw = budgetEl && budgetEl.value !== '' ? Number(budgetEl.value) : 0;
  const priority = priorityEl && priorityEl.value ? priorityEl.value : 'medium';
  const description = descEl && descEl.value ? descEl.value.trim() : null;

  if (!name) {
    showToast('Event name is required', 'error');
    return;
  }
  if (!client_id) {
    showToast('Select a client, or use + New client / Create new client… to add one', 'error');
    return;
  }
  if (!start_date || !end_date) {
    showToast('Start and end dates are required', 'error');
    return;
  }

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      let custom_fields = {};
      if (typeof window.pldCollectCustomFieldValuesFromContainer === 'function') {
        const mount = document.getElementById('newEventCustomFieldsMount');
        if (mount) {
          try {
            const defs = await loadCustomFieldsDefinitions('event');
            custom_fields = window.pldCollectCustomFieldValuesFromContainer(mount, defs);
          } catch (e) {
            console.warn(e);
          }
        }
      }
      const metadata = {};
      if (budgetRaw > 0) metadata.budget = budgetRaw;
      metadata.priority = priority;
      const pcEl = document.getElementById('newEventPrimaryContact');
      const primaryRaw = pcEl && pcEl.value ? String(pcEl.value).trim() : '';
      const payload = {
        name: name,
        client_id: client_id,
        venue_id: venue_id || null,
        start_date: start_date,
        end_date: end_date,
        description: description,
        tags: [],
        metadata: metadata,
        custom_fields: custom_fields,
      };
      if (primaryRaw) payload.primary_contact_id = primaryRaw;
      const created = await pldCreateEventViaApi(payload);
      if (created) {
        showToast('Event created', 'success');
        closeModal();
        renderPage('events');
      }
    })();
    return;
  }

  showToast('Event created successfully! (demo — enable API for real save)', 'success');
  closeModal();
}

/** Header phase controls on full event page (ghost/primary buttons). */
function eventPhaseHeaderButtons(ev) {
  const currentIdx = PHASES.indexOf(ev.phase);
  const inOrder = currentIdx >= 0;
  const nextPhase = inOrder && currentIdx < PHASES.length - 1 ? PHASES[currentIdx + 1] : null;
  let left = '';
  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    if (ev.phase !== 'planning') {
      left = `<button type="button" class="btn btn-ghost btn-sm" onclick="transitionPhase('${ev.id}','planning')">${uiIcon('arrowLeft')} Reset to Planning</button>`;
    }
  } else {
    const prevPhase = inOrder && currentIdx > 0 ? PHASES[currentIdx - 1] : null;
    if (prevPhase) {
      left = `<button type="button" class="btn btn-ghost btn-sm" onclick="transitionPhase('${ev.id}','${prevPhase}')">${uiIcon('arrowLeft')} ${PHASE_LABELS[prevPhase]}</button>`;
    }
  }
  const right = nextPhase
    ? `<button type="button" class="btn btn-primary btn-sm" onclick="transitionPhase('${ev.id}','${nextPhase}')">${PHASE_LABELS[nextPhase]} →</button>`
    : '';
  return left + right;
}

/** Sentinel: choosing this opens the quick-add panel (also in dropdown for discoverability). */
var NEW_EVENT_CLIENT_CREATE_VALUE = '__pld_create_client__';

function newEventModalClientOptionsHtml() {
  return `<option value="">Select client…</option><option value="${NEW_EVENT_CLIENT_CREATE_VALUE}">+ Create new client…</option>${CLIENTS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}`;
}

function onNewEventClientSelectChange(sel) {
  if (!sel || sel.value !== NEW_EVENT_CLIENT_CREATE_VALUE) return;
  sel.value = '';
  const row = document.getElementById('newClientQuickRow');
  if (row) row.hidden = false;
  const q = document.getElementById('newClientQuickName');
  if (q) {
    q.focus();
    q.select();
  }
}

/** Expand inline "new client" when the catalog is empty; keep open after add failures. */
function toggleNewClientQuickRow() {
  const row = document.getElementById('newClientQuickRow');
  if (!row) return;
  row.hidden = !row.hidden;
}

/**
 * Create a client from the new-event modal, select it, and refresh the dropdown.
 */
function submitQuickNewClientFromEventModal() {
  const nameEl = document.getElementById('newClientQuickName');
  const name = nameEl && nameEl.value ? nameEl.value.trim() : '';
  if (!name) {
    showToast('Client name is required', 'error');
    return;
  }

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      if (typeof pldCreateClientViaApi !== 'function') {
        showToast('Client API not available', 'error');
        return;
      }
      const created = await pldCreateClientViaApi({ name: name });
      if (!created) return;
      const sel = document.getElementById('newEventClient');
      if (sel) {
        sel.innerHTML = newEventModalClientOptionsHtml();
        sel.value = created.id;
      }
      if (nameEl) nameEl.value = '';
      const row = document.getElementById('newClientQuickRow');
      if (row && CLIENTS.length > 0) row.hidden = true;
      showToast('Client added', 'success');
      if (typeof pldRefreshNewEventPrimaryContactOptions === 'function') {
        setTimeout(function () {
          void pldRefreshNewEventPrimaryContactOptions();
        }, 0);
      }
    })();
    return;
  }

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'cl-' + String(Date.now());
  CLIENTS.push({ id: id, name: name, contact: '', email: '' });
  const sel = document.getElementById('newEventClient');
  if (sel) {
    sel.innerHTML = newEventModalClientOptionsHtml();
    sel.value = id;
  }
  if (nameEl) nameEl.value = '';
  const row = document.getElementById('newClientQuickRow');
  if (row) row.hidden = true;
  showToast('Client added (local demo)', 'success');
}

function openNewEventModal(prefillStart, prefillEnd) {
  const startVal = prefillStart || '';
  const endVal = prefillEnd || prefillStart || '';
  const noClients = CLIENTS.length === 0;
  const quickRowHidden = !noClients;
  const body = `
    <div class="form-group"><label class="form-label">Event Name</label><input type="text" class="form-input" id="newEventName" placeholder="e.g. Super Bowl LXII Pre-Show"></div>
    <div class="form-group new-event-client-block">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <label class="form-label" style="margin:0;">Client</label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="toggleNewClientQuickRow()" title="Add a new organization">+ New client</button>
      </div>
      <select class="form-select" id="newEventClient" onchange="onNewEventClientSelectChange(this);if(typeof pldRefreshNewEventPrimaryContactOptions==='function')void pldRefreshNewEventPrimaryContactOptions();">${newEventModalClientOptionsHtml()}</select>
      <p class="form-hint" style="margin-top:6px;margin-bottom:0;">No client yet? Pick <strong>Create new client…</strong> in the list above, or use <strong>+ New client</strong>.
        <a href="javascript:void(0)" style="color:var(--accent-blue);margin-left:6px;" onclick="closeModal();setTimeout(function(){ navigateTo('clients'); }, 50);">Manage all clients</a></p>
      <div id="newClientQuickRow" class="new-client-quick-row" ${quickRowHidden ? 'hidden' : ''} style="margin-top:10px;padding:12px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-tertiary);">
        <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">${noClients ? 'No clients yet — add one to continue' : 'Quick add client'}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <div style="flex:1;min-width:140px;">
            <label class="form-label" style="font-size:11px;">Organization name</label>
            <input type="text" class="form-input" id="newClientQuickName" placeholder="e.g. Acme Productions" autocomplete="organization"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); submitQuickNewClientFromEventModal(); }">
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="submitQuickNewClientFromEventModal()">Add client</button>
        </div>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Venue</label><select class="form-select" id="newEventVenue" onchange="if(typeof pldRefreshNewEventPrimaryContactOptions==='function')void pldRefreshNewEventPrimaryContactOptions();"><option value="">Select venue…</option>${VENUES.map((v) => `<option value="${v.id}">${v.name} — ${v.city}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Primary contact</label><select class="form-select" id="newEventPrimaryContact"><option value="">None</option></select><p class="form-hint" style="margin-top:4px;font-size:11px;">Loads CRM contacts for the selected client and venue.</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" id="newEventStart" value="${startVal}"></div>
      <div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-input" id="newEventEnd" value="${endVal}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Budget</label><input type="number" class="form-input" id="newEventBudget" placeholder="0" min="0" step="1"></div>
      <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="newEventPriority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="newEventDescription" placeholder="Optional details…"></textarea></div>
    <div id="newEventCustomFieldsMount"></div>
  `;
  openModal(
    'Create New Event',
    body,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="submitNewEventForm()">Create Event</button>
  `,
  );
  if (typeof window.pldMountCustomFieldsInContainer === 'function') {
    setTimeout(function () {
      void window.pldMountCustomFieldsInContainer('newEventCustomFieldsMount', 'event', {});
    }, 0);
  }
  if (typeof window.pldRefreshNewEventPrimaryContactOptions === 'function') {
    setTimeout(function () {
      void window.pldRefreshNewEventPrimaryContactOptions();
    }, 0);
  }
  if (noClients) {
    setTimeout(function () {
      const q = document.getElementById('newClientQuickName');
      if (q) q.focus();
    }, 0);
  }
}
