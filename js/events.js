// ============================================
// EVENTS
// ============================================

function phaseDisplayLabel(phase) {
  return PHASE_LABELS[phase] || (phase ? String(phase).replace(/_/g, ' ') : '—');
}

/** Sentinel values for new-event modal pickers. */
var NEW_EVENT_CLIENT_CREATE_VALUE = '__pld_create_client__';
var NEW_EVENT_VENUE_CREATE_VALUE = '__pld_create_venue__';
var NEW_EVENT_CONTACT_CREATE_VALUE = '__pld_create_contact__';
/** Picker "none" row — non-empty id avoids empty data-id and Map key collisions. */
var PLD_PICKER_NONE_ID = '__pld_pick_none__';

function pldFormatEventDeleteBlockersPlain(blockers) {
  if (!blockers || typeof blockers !== 'object') return '';
  const pairs = [
    ['crew_assignments', 'Crew assignments'],
    ['truck_assignments', 'Truck assignments'],
    ['truck_routes', 'Truck routes'],
    ['travel_records', 'Travel records'],
    ['financial_records', 'Financial rows'],
    ['invoices_committed', 'Invoices (not draft/void)'],
    ['documents', 'Documents'],
    ['rider_items', 'Rider items'],
    ['email_drafts', 'Email drafts'],
    ['time_entries_linked', 'Time entries linked'],
    ['tasks_linked', 'Tasks linked'],
  ];
  const lines = [];
  for (let i = 0; i < pairs.length; i++) {
    const n = blockers[pairs[i][0]];
    if (typeof n === 'number' && n > 0) lines.push(pairs[i][1] + ': ' + n);
  }
  return lines.length ? lines.join('\n') : 'Related data is still attached to this event.';
}

/**
 * Delete via API; on 409 shows a second confirm to force-delete related rows.
 * @param {string} eventId
 * @param {{ closeModalAfter?: boolean, afterOk?: () => void }} opts
 */
async function pldRunEventDeleteUi(eventId, opts) {
  const o = opts || {};
  if (typeof PLD_EVENTS_FROM_REST === 'undefined' || !PLD_EVENTS_FROM_REST) {
    if (typeof showToast === 'function') showToast('Event delete requires API mode.', 'error');
    return;
  }
  const first = await pldDeleteEventViaApi(eventId, {});
  if (first.ok) {
    if (typeof showToast === 'function') showToast('Event deleted', 'success');
    if (typeof pldRefetchEventsListFromApi === 'function') await pldRefetchEventsListFromApi();
    if (o.closeModalAfter && typeof closeModal === 'function') closeModal();
    if (typeof o.afterOk === 'function') o.afterOk();
    else if (typeof renderPage === 'function') renderPage(currentPage);
    return;
  }
  if (first.status === 409 && first.details && first.details.blockers) {
    const plain = pldFormatEventDeleteBlockersPlain(first.details.blockers);
    if (typeof showConfirm !== 'function') {
      if (typeof showToast === 'function') showToast(plain || first.message || 'Delete blocked', 'warning');
      return;
    }
    showConfirm(
      'Still linked data',
      plain +
        '\n\nForce delete removes those rows, then deletes the event. This cannot be undone.',
      function () {
        void (async () => {
          const second = await pldDeleteEventViaApi(eventId, { force: true });
          if (second.ok) {
            if (typeof showToast === 'function') showToast('Event deleted', 'success');
            if (typeof pldRefetchEventsListFromApi === 'function') await pldRefetchEventsListFromApi();
            if (o.closeModalAfter && typeof closeModal === 'function') closeModal();
            if (typeof o.afterOk === 'function') o.afterOk();
            else if (typeof renderPage === 'function') renderPage(currentPage);
          } else if (second.message && typeof showToast === 'function') {
            showToast(second.message, 'error');
          }
        })();
      },
    );
    return;
  }
  if (first.message && typeof showToast === 'function') showToast(first.message, 'error');
}

async function pldCancelEventStatus(eventId, opts) {
  const o = opts || {};
  if (typeof PLD_EVENTS_FROM_REST === 'undefined' || !PLD_EVENTS_FROM_REST) {
    if (typeof showToast === 'function') showToast('API mode required to change status.', 'error');
    return;
  }
  await pldPersistEventPatchViaApi(eventId, { status: 'cancelled' });
  if (typeof showToast === 'function') showToast('Event marked cancelled', 'success');
  if (typeof pldRefetchEventsListFromApi === 'function') await pldRefetchEventsListFromApi();
  if (typeof pldRefreshEventFromApi === 'function') await pldRefreshEventFromApi(eventId);
  if (o.closeModalAfter && typeof closeModal === 'function') closeModal();
  if (typeof renderPage === 'function') renderPage(currentPage);
}

async function pldUncancelEventStatus(eventId, opts) {
  const o = opts || {};
  if (typeof PLD_EVENTS_FROM_REST === 'undefined' || !PLD_EVENTS_FROM_REST) {
    if (typeof showToast === 'function') showToast('API mode required to change status.', 'error');
    return;
  }
  await pldPersistEventPatchViaApi(eventId, { status: 'confirmed' });
  if (typeof showToast === 'function') showToast('Status set to confirmed', 'success');
  if (typeof pldRefetchEventsListFromApi === 'function') await pldRefetchEventsListFromApi();
  if (typeof pldRefreshEventFromApi === 'function') await pldRefreshEventFromApi(eventId);
  if (o.closeModalAfter && typeof closeModal === 'function') closeModal();
  if (typeof renderPage === 'function') renderPage(currentPage);
}

function pldCancelEventFromHeader(eventId) {
  if (typeof showConfirm !== 'function') return;
  showConfirm(
    'Mark cancelled',
    'Set this event to cancelled status? The event stays in the list unless you delete it.',
    function () {
      void pldCancelEventStatus(eventId, {});
    },
  );
}

function pldUncancelEventFromHeader(eventId) {
  if (typeof showConfirm !== 'function') return;
  showConfirm(
    'Restore status',
    'Set status back to confirmed? Phase is unchanged — adjust phase separately if needed.',
    function () {
      void pldUncancelEventStatus(eventId, {});
    },
  );
}

function pldDeleteEventFromHeader(eventId) {
  if (typeof showConfirm !== 'function') return;
  showConfirm('Delete event', 'Delete this event permanently?', function () {
    void pldRunEventDeleteUi(eventId, {
      afterOk: function () {
        selectedEventId = null;
        navigateTo('events');
      },
    });
  });
}

window.pldRunEventDeleteUi = pldRunEventDeleteUi;
window.pldCancelEventStatus = pldCancelEventStatus;
window.pldUncancelEventStatus = pldUncancelEventStatus;
window.pldCancelEventFromHeader = pldCancelEventFromHeader;
window.pldUncancelEventFromHeader = pldUncancelEventFromHeader;
window.pldDeleteEventFromHeader = pldDeleteEventFromHeader;

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

function pldContextMenuEventRow(domEvent, eventId) {
  if (typeof window.pldShowContextMenu !== 'function') return;
  const id = String(eventId || '');
  if (!id) return;
  window.pldShowContextMenu(domEvent.clientX, domEvent.clientY, [
    { label: 'Open event', action: function () { navigateToEvent(id); } },
    { label: 'Clone event…', action: function () { openCloneEventModal(id); } },
  ]);
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
              return `<tr onclick="navigateToEvent('${ev.id}')" oncontextmenu="event.preventDefault();event.stopPropagation();pldContextMenuEventRow(event,'${ev.id}');">
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
      ? `showConfirm('Delete Event','Are you sure you want to delete ${String(ev.name).replace(/'/g, "\\'")}?', () => { void pldRunEventDeleteUi('${ev.id}', { closeModalAfter: true }); })`
      : `showConfirm('Delete Event','Are you sure you want to delete ${String(ev.name).replace(/'/g, "\\'")}? This cannot be undone.', () => showToast('Event deleted','error'))`;

  const cancelBtn =
    typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST
      ? ev.status === 'cancelled'
        ? `<button type="button" class="btn btn-secondary btn-sm" onclick="void pldUncancelEventStatus('${ev.id}', { closeModalAfter: true })">Restore status</button>`
        : `<button type="button" class="btn btn-secondary btn-sm" onclick="void pldCancelEventStatus('${ev.id}', { closeModalAfter: true })">Mark cancelled</button>`
      : '';

  openModal(
    ev.name,
    body,
    `
    ${cancelBtn}
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

function pldUpdateNewEventPrimaryContactLabel() {
  const h = document.getElementById('newEventPrimaryContact');
  const span = document.getElementById('newEventPrimaryContactLabel');
  if (!h || !span) return;
  const v = h.value ? String(h.value) : '';
  if (!v) {
    span.textContent = 'None';
    return;
  }
  const items = window.__pldNewEventPrimaryContactItems;
  if (Array.isArray(items)) {
    const row = items.find(function (it) {
      return String(it.id) === v;
    });
    if (row && row.primary) {
      span.textContent = String(row.primary);
      return;
    }
  }
  span.textContent = 'Contact';
}

window.pldOpenNewEventPrimaryContactPicker = async function pldOpenNewEventPrimaryContactPicker() {
  if (typeof openPickerModal !== 'function') return;
  if (typeof window.pldRefreshNewEventPrimaryContactOptions === 'function') {
    await window.pldRefreshNewEventPrimaryContactOptions();
  }
  const raw = Array.isArray(window.__pldNewEventPrimaryContactItems)
    ? window.__pldNewEventPrimaryContactItems.slice()
    : [{ id: PLD_PICKER_NONE_ID, primary: '— None —', secondary: '' }];
  const clientEl = document.getElementById('newEventClient');
  const hasClient =
    clientEl &&
    clientEl.value &&
    String(clientEl.value) !== '' &&
    String(clientEl.value) !== NEW_EVENT_CLIENT_CREATE_VALUE;
  const createContactRow = {
    id: NEW_EVENT_CONTACT_CREATE_VALUE,
    primary: '+ Create new contact…',
    secondary: hasClient ? 'Saved under the selected client' : 'Select a client first',
  };
  if (raw.length && (String(raw[0].id) === '' || String(raw[0].id) === PLD_PICKER_NONE_ID)) {
    if (String(raw[0].id) === '') raw[0].id = PLD_PICKER_NONE_ID;
    raw.splice(1, 0, createContactRow);
  } else {
    raw.unshift(createContactRow);
  }
  openPickerModal({
    title: 'Primary contact',
    items: raw,
    searchPlaceholder: 'Search name or label…',
    emptyMessage: 'Choose a client (and optionally a venue), then pick or create a contact.',
    footerButtons: [
      {
        label: '+ Create new contact',
        className: 'btn btn-primary btn-sm',
        onClick: function () {
          if (!hasClient) {
            if (typeof showToast === 'function') {
              showToast('Select a client first, then add a contact.', 'warning');
            }
            return;
          }
          const row = document.getElementById('newContactQuickRow');
          if (row) row.hidden = false;
          const q = document.getElementById('newContactQuickName');
          if (q) {
            q.focus();
            q.select();
          }
        },
      },
    ],
    onSelect(id) {
      if (String(id) === NEW_EVENT_CONTACT_CREATE_VALUE) {
        if (!hasClient) {
          if (typeof showToast === 'function') {
            showToast('Select a client first, then add a contact.', 'warning');
          }
          return;
        }
        const row = document.getElementById('newContactQuickRow');
        if (row) row.hidden = false;
        const q = document.getElementById('newContactQuickName');
        if (q) {
          q.focus();
          q.select();
        }
        return;
      }
      const hi = document.getElementById('newEventPrimaryContact');
      if (hi) {
        hi.value =
          id == null || id === '' || String(id) === PLD_PICKER_NONE_ID ? '' : String(id);
      }
      pldUpdateNewEventPrimaryContactLabel();
    },
  });
};

window.pldRefreshNewEventPrimaryContactOptions = async function pldRefreshNewEventPrimaryContactOptions() {
  const hid = document.getElementById('newEventPrimaryContact');
  if (!hid || typeof pldListContactsForParent !== 'function') return;
  const clientEl = document.getElementById('newEventClient');
  const venueEl = document.getElementById('newEventVenue');
  const client_id =
    clientEl && clientEl.value && clientEl.value !== NEW_EVENT_CLIENT_CREATE_VALUE
      ? String(clientEl.value)
      : '';
  const venue_id = venueEl && venueEl.value ? String(venueEl.value) : '';
  const prev = hid.value ? String(hid.value) : '';

  const items = [{ id: PLD_PICKER_NONE_ID, primary: '— None —', secondary: '' }];
  const seen = new Set([PLD_PICKER_NONE_ID]);

  if (client_id) {
    const clientRows = await pldListContactsForParent('client', client_id, { silent: true });
    clientRows.forEach(function (r) {
      const id = String(r.id);
      if (seen.has(id)) return;
      seen.add(id);
      const lab = 'Client · ' + String(r.name || '') + (r.email ? ' · ' + r.email : '');
      items.push({
        id: id,
        primary: r.name || '—',
        secondary: lab,
      });
    });
  }
  if (venue_id) {
    const venueRows = await pldListContactsForParent('venue', venue_id, { silent: true });
    venueRows.forEach(function (r) {
      const id = String(r.id);
      if (seen.has(id)) return;
      seen.add(id);
      const lab = 'Venue · ' + String(r.name || '') + (r.email ? ' · ' + r.email : '');
      items.push({
        id: id,
        primary: r.name || '—',
        secondary: lab,
      });
    });
  }

  window.__pldNewEventPrimaryContactItems = items;

  const valid = new Set(items.map(function (it) { return String(it.id); }));
  if (prev && !valid.has(prev)) hid.value = '';

  pldUpdateNewEventPrimaryContactLabel();
};

function transitionPhase(eventId, newPhase) {
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) return;

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      const oldPhase = ev.phase;
      const ok = await pldTransitionEventPhaseViaApi(eventId, newPhase, null);
      if (ok) {
        if (typeof pldRefetchEventsListFromApi === 'function') await pldRefetchEventsListFromApi();
        if (typeof pldRefreshEventFromApi === 'function') await pldRefreshEventFromApi(eventId);
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

function pldUpdateNewEventClientLabel() {
  const h = document.getElementById('newEventClient');
  const span = document.getElementById('newEventClientLabel');
  if (!h || !span) return;
  const v = h.value ? String(h.value) : '';
  if (!v) {
    span.textContent = 'Select client…';
    return;
  }
  const c = CLIENTS.find((x) => String(x.id) === v);
  span.textContent = c ? c.name : 'Select client…';
}

function pldUpdateNewEventVenueLabel() {
  const h = document.getElementById('newEventVenue');
  const span = document.getElementById('newEventVenueLabel');
  if (!h || !span) return;
  const v = h.value ? String(h.value) : '';
  if (!v) {
    span.textContent = 'Select venue…';
    return;
  }
  const ven = VENUES.find((x) => String(x.id) === v);
  span.textContent = ven ? `${ven.name} — ${ven.city || ''}` : 'Select venue…';
}

function pldOpenNewEventClientPicker() {
  if (typeof openPickerModal !== 'function') return;
  const items = [
    {
      id: NEW_EVENT_CLIENT_CREATE_VALUE,
      primary: '+ Create new client…',
      secondary: 'Opens quick add below',
    },
  ];
  CLIENTS.forEach((c) => {
    items.push({ id: String(c.id), primary: c.name || '—', secondary: '' });
  });
  openPickerModal({
    title: 'Select client',
    items: items,
    onSelect: function (id) {
      if (id === NEW_EVENT_CLIENT_CREATE_VALUE) {
        const hi = document.getElementById('newEventClient');
        if (hi) hi.value = '';
        pldUpdateNewEventClientLabel();
        const row = document.getElementById('newClientQuickRow');
        if (row) row.hidden = false;
        const q = document.getElementById('newClientQuickName');
        if (q) {
          q.focus();
          q.select();
        }
        return;
      }
      const hi = document.getElementById('newEventClient');
      if (hi) hi.value = id;
      pldUpdateNewEventClientLabel();
      if (typeof pldRefreshNewEventPrimaryContactOptions === 'function') {
        void pldRefreshNewEventPrimaryContactOptions();
      }
    },
  });
}

function pldOpenNewEventVenuePicker() {
  if (typeof openPickerModal !== 'function') return;
  function openVenueQuickAdd() {
    const hi = document.getElementById('newEventVenue');
    if (hi) hi.value = '';
    pldUpdateNewEventVenueLabel();
    const row = document.getElementById('newVenueQuickRow');
    if (row) row.hidden = false;
    const q = document.getElementById('newVenueQuickName');
    if (q) {
      q.focus();
      q.select();
    }
  }
  const items = [
    { id: PLD_PICKER_NONE_ID, primary: '— No venue —', secondary: '' },
    {
      id: NEW_EVENT_VENUE_CREATE_VALUE,
      primary: '+ Create new venue…',
      secondary: 'Quick add name and city',
    },
  ];
  if (typeof pickerItemsFromVenues === 'function') {
    items.push.apply(items, pickerItemsFromVenues(VENUES));
  }
  openPickerModal({
    title: 'Select venue',
    items: items,
    searchPlaceholder: 'Search venue name or city…',
    emptyMessage: 'No venues match — use “Create new venue” below.',
    footerButtons: [
      {
        label: '+ Create new venue',
        className: 'btn btn-primary btn-sm',
        onClick: openVenueQuickAdd,
      },
    ],
    onSelect: function (id) {
      if (String(id) === NEW_EVENT_VENUE_CREATE_VALUE) {
        openVenueQuickAdd();
        return;
      }
      const hi = document.getElementById('newEventVenue');
      if (hi) {
        hi.value = id == null || id === '' || String(id) === PLD_PICKER_NONE_ID ? '' : String(id);
      }
      pldUpdateNewEventVenueLabel();
      if (typeof pldRefreshNewEventPrimaryContactOptions === 'function') {
        void pldRefreshNewEventPrimaryContactOptions();
      }
    },
  });
}

function pldUpdateCalendarQuickClientLabel() {
  const h = document.getElementById('calQuickClient');
  const span = document.getElementById('calQuickClientLabel');
  if (!h || !span) return;
  const v = h.value ? String(h.value) : '';
  if (!v) {
    span.textContent = 'Select client…';
    return;
  }
  const c = CLIENTS.find((x) => String(x.id) === v);
  span.textContent = c ? c.name : 'Select client…';
}

function pldUpdateCalendarQuickVenueLabel() {
  const h = document.getElementById('calQuickVenue');
  const span = document.getElementById('calQuickVenueLabel');
  if (!h || !span) return;
  const v = h.value ? String(h.value) : '';
  if (!v) {
    span.textContent = 'Select venue…';
    return;
  }
  const ven = VENUES.find((x) => String(x.id) === v);
  span.textContent = ven ? `${ven.name} — ${ven.city || ''}` : 'Select venue…';
}

function pldOpenCalendarQuickClientPicker() {
  if (typeof openPickerModal !== 'function') return;
  const items =
    typeof pickerItemsFromClients === 'function'
      ? pickerItemsFromClients(CLIENTS)
      : CLIENTS.map((c) => ({ id: String(c.id), primary: c.name || '—', secondary: '' }));
  openPickerModal({
    title: 'Select client',
    items,
    emptyMessage: 'No clients. Add one under Clients first.',
    onSelect(id) {
      const hi = document.getElementById('calQuickClient');
      if (hi) hi.value = id;
      pldUpdateCalendarQuickClientLabel();
    },
  });
}

function pldOpenCalendarQuickVenuePicker() {
  if (typeof openPickerModal !== 'function') return;
  const items = [{ id: PLD_PICKER_NONE_ID, primary: '— No venue —', secondary: '' }];
  if (typeof pickerItemsFromVenues === 'function') {
    items.push.apply(items, pickerItemsFromVenues(VENUES));
  }
  openPickerModal({
    title: 'Select venue',
    items,
    searchPlaceholder: 'Search venue name or city…',
    onSelect(id) {
      const hi = document.getElementById('calQuickVenue');
      if (hi) {
        hi.value = id == null || id === '' || String(id) === PLD_PICKER_NONE_ID ? '' : String(id);
      }
      pldUpdateCalendarQuickVenueLabel();
    },
  });
}

/** Quick Create Event from calendar day modal (`calQuick*` fields). */
function submitCalendarQuickEventForm() {
  const nameEl = document.getElementById('calQuickEventName');
  const clientEl = document.getElementById('calQuickClient');
  const venueEl = document.getElementById('calQuickVenue');
  const startEl = document.getElementById('calQuickStart');
  const endEl = document.getElementById('calQuickEnd');
  const budgetEl = document.getElementById('calQuickBudget');
  const priorityEl = document.getElementById('calQuickPriority');
  const name = nameEl && nameEl.value ? nameEl.value.trim() : '';
  const client_id = clientEl && clientEl.value ? clientEl.value : '';
  const venue_id = venueEl && venueEl.value ? venueEl.value : '';
  const start_date = startEl && startEl.value ? startEl.value : '';
  const end_date = endEl && endEl.value ? endEl.value : '';
  const budgetRaw = budgetEl && budgetEl.value !== '' ? Number(budgetEl.value) : 0;
  const priority = priorityEl && priorityEl.value ? priorityEl.value : 'medium';

  if (!name) {
    showToast('Event name is required', 'error');
    return;
  }
  if (!client_id) {
    showToast('Select a client', 'error');
    return;
  }
  if (!start_date || !end_date) {
    showToast('Start and end dates are required', 'error');
    return;
  }

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      const metadata = {};
      if (budgetRaw > 0) metadata.budget = budgetRaw;
      metadata.priority = priority;
      const payload = {
        name: name,
        client_id: client_id,
        venue_id: venue_id || null,
        start_date: start_date,
        end_date: end_date,
        description: null,
        tags: [],
        metadata: metadata,
        custom_fields: {},
      };
      const created = await pldCreateEventViaApi(payload);
      if (created) {
        showToast('Event created', 'success');
        closeModal();
        renderPage(typeof currentPage !== 'undefined' ? currentPage : 'scheduling');
      }
    })();
    return;
  }

  showToast('Event created successfully! (demo — enable API for real save)', 'success');
  closeModal();
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
function toggleNewVenueQuickRow() {
  const row = document.getElementById('newVenueQuickRow');
  if (!row) return;
  row.hidden = !row.hidden;
}

function toggleNewContactQuickRow() {
  const row = document.getElementById('newContactQuickRow');
  if (!row) return;
  row.hidden = !row.hidden;
}

function submitQuickNewVenueFromEventModal() {
  const nameEl = document.getElementById('newVenueQuickName');
  const cityEl = document.getElementById('newVenueQuickCity');
  const name = nameEl && nameEl.value ? nameEl.value.trim() : '';
  const city = cityEl && cityEl.value ? cityEl.value.trim() : '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Venue name is required', 'error');
    return;
  }

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      if (typeof window.pldApiFetch !== 'function') {
        if (typeof showToast === 'function') showToast('API not available', 'error');
        return;
      }
      const res = await window.pldApiFetch('/api/v1/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          city: city || undefined,
        }),
      });
      if (!res.ok) {
        const msg =
          res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
        if (typeof showToast === 'function') showToast(msg || 'Could not create venue', 'error');
        return;
      }
      const data = res.body && res.body.data;
      if (!data || !data.id) return;
      if (typeof window.pldFetchVenuesFromApiIfConfigured === 'function') {
        await window.pldFetchVenuesFromApiIfConfigured('');
      }
      const hi = document.getElementById('newEventVenue');
      if (hi) hi.value = String(data.id);
      pldUpdateNewEventVenueLabel();
      if (nameEl) nameEl.value = '';
      if (cityEl) cityEl.value = '';
      const row = document.getElementById('newVenueQuickRow');
      if (row) row.hidden = true;
      if (typeof showToast === 'function') showToast('Venue added', 'success');
      if (typeof pldRefreshNewEventPrimaryContactOptions === 'function') {
        void pldRefreshNewEventPrimaryContactOptions();
      }
    })();
    return;
  }

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'vn-' + String(Date.now());
  if (typeof VENUES !== 'undefined' && Array.isArray(VENUES)) {
    VENUES.push({ id: id, name: name, city: city, address: '', notes: '' });
  }
  const hi = document.getElementById('newEventVenue');
  if (hi) hi.value = String(id);
  pldUpdateNewEventVenueLabel();
  if (nameEl) nameEl.value = '';
  if (cityEl) cityEl.value = '';
  const row = document.getElementById('newVenueQuickRow');
  if (row) row.hidden = true;
  if (typeof showToast === 'function') showToast('Venue added (local demo)', 'success');
}

function submitQuickNewContactFromEventModal() {
  const nameEl = document.getElementById('newContactQuickName');
  const emailEl = document.getElementById('newContactQuickEmail');
  const name = nameEl && nameEl.value ? nameEl.value.trim() : '';
  const email = emailEl && emailEl.value ? emailEl.value.trim() : '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Contact name is required', 'error');
    return;
  }
  const clientEl = document.getElementById('newEventClient');
  const client_id =
    clientEl && clientEl.value && String(clientEl.value) !== NEW_EVENT_CLIENT_CREATE_VALUE
      ? String(clientEl.value).trim()
      : '';
  if (!client_id) {
    if (typeof showToast === 'function') showToast('Select a client first', 'warning');
    return;
  }

  if (typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST) {
    void (async () => {
      if (typeof window.pldCreateContact !== 'function') {
        if (typeof showToast === 'function') showToast('Contact API not available', 'error');
        return;
      }
      const created = await window.pldCreateContact('client', client_id, {
        name: name,
        email: email || null,
      });
      if (!created || !created.id) return;
      const hi = document.getElementById('newEventPrimaryContact');
      if (hi) hi.value = String(created.id);
      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      const row = document.getElementById('newContactQuickRow');
      if (row) row.hidden = true;
      if (typeof showToast === 'function') showToast('Contact added', 'success');
      if (typeof pldRefreshNewEventPrimaryContactOptions === 'function') {
        await pldRefreshNewEventPrimaryContactOptions();
      }
      pldUpdateNewEventPrimaryContactLabel();
    })();
    return;
  }

  if (typeof showToast === 'function') showToast('Sign in to API to save contacts', 'warning');
}

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
      const hi = document.getElementById('newEventClient');
      if (hi) hi.value = String(created.id);
      pldUpdateNewEventClientLabel();
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
  const hi = document.getElementById('newEventClient');
  if (hi) hi.value = String(id);
  pldUpdateNewEventClientLabel();
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
      <input type="hidden" id="newEventClient" value="">
      <button type="button" class="pld-picker-trigger" onclick="pldOpenNewEventClientPicker()"><span id="newEventClientLabel">Select client…</span><span style="opacity:0.55;font-size:10px;" aria-hidden="true">▾</span></button>
      <p class="form-hint" style="margin-top:6px;margin-bottom:0;">No client yet? Open the client selector above and pick <strong>+ Create new client…</strong>, or use <strong>+ New client</strong>.
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
    <div class="form-group new-event-venue-block">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <label class="form-label" style="margin:0;">Venue</label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="toggleNewVenueQuickRow()" title="Add a venue without leaving this form">+ New venue</button>
      </div>
      <input type="hidden" id="newEventVenue" value="">
      <button type="button" class="pld-picker-trigger" onclick="pldOpenNewEventVenuePicker()"><span id="newEventVenueLabel">Select venue…</span><span style="opacity:0.55;font-size:10px;" aria-hidden="true">▾</span></button>
      <p class="form-hint" style="margin-top:6px;margin-bottom:0;">Open the picker to search venues or choose <strong>+ Create new venue…</strong>. <a href="javascript:void(0)" style="color:var(--accent-blue);margin-left:4px;" onclick="closeModal();setTimeout(function(){ navigateTo('venues'); }, 50);">Manage all venues</a></p>
      <div id="newVenueQuickRow" class="new-venue-quick-row" hidden style="margin-top:10px;padding:12px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-tertiary);">
        <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">Quick add venue</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <div style="flex:1;min-width:140px;">
            <label class="form-label" style="font-size:11px;">Venue name</label>
            <input type="text" class="form-input" id="newVenueQuickName" placeholder="e.g. Madison Square Garden" autocomplete="organization"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); submitQuickNewVenueFromEventModal(); }">
          </div>
          <div style="flex:1;min-width:120px;">
            <label class="form-label" style="font-size:11px;">City (optional)</label>
            <input type="text" class="form-input" id="newVenueQuickCity" placeholder="e.g. New York" autocomplete="address-level2"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); submitQuickNewVenueFromEventModal(); }">
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="submitQuickNewVenueFromEventModal()">Add venue</button>
        </div>
      </div>
    </div>
    <div class="form-group new-event-contact-block">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <label class="form-label" style="margin:0;">Primary contact</label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="toggleNewContactQuickRow()" title="Add a CRM contact on the selected client">+ New contact</button>
      </div>
      <input type="hidden" id="newEventPrimaryContact" value="">
      <button type="button" class="pld-picker-trigger" onclick="void pldOpenNewEventPrimaryContactPicker()"><span id="newEventPrimaryContactLabel">None</span><span style="opacity:0.55;font-size:10px;" aria-hidden="true">▾</span></button>
      <p class="form-hint" style="margin-top:6px;margin-bottom:0;">Searchable picker of CRM contacts for the selected client and venue. Select a <strong>client</strong> first, then pick a contact or create one.</p>
      <div id="newContactQuickRow" class="new-contact-quick-row" hidden style="margin-top:10px;padding:12px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-tertiary);">
        <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">Quick add contact (on selected client)</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <div style="flex:1;min-width:120px;">
            <label class="form-label" style="font-size:11px;">Name</label>
            <input type="text" class="form-input" id="newContactQuickName" placeholder="Contact name" autocomplete="name"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); submitQuickNewContactFromEventModal(); }">
          </div>
          <div style="flex:1;min-width:140px;">
            <label class="form-label" style="font-size:11px;">Email (optional)</label>
            <input type="email" class="form-input" id="newContactQuickEmail" placeholder="name@company.com" autocomplete="email"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); submitQuickNewContactFromEventModal(); }">
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="submitQuickNewContactFromEventModal()">Add contact</button>
        </div>
      </div>
    </div>
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
  setTimeout(function () {
    pldUpdateNewEventClientLabel();
    pldUpdateNewEventVenueLabel();
    pldUpdateNewEventPrimaryContactLabel();
  }, 0);
  if (noClients) {
    setTimeout(function () {
      const q = document.getElementById('newClientQuickName');
      if (q) q.focus();
    }, 0);
  }
}
