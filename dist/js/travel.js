/* ============================================
   Module: Travel Page
   Depends on: state.js, data.js, modal.js, router.js
   ============================================ */
function renderTravel() {
  return `
    <div class="page-header">
      <div><h1 class="page-title">Travel & Logistics</h1><p class="page-subtitle">Flight, hotel, and ground transport management</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openAddTravelModal()">+ Add Travel Record</button></div>
    </div>
    <div class="tabs">
      ${tabBtn('All Records', 'travelTab', 'all', 'travel')}
      ${tabBtn('Rooming Lists', 'travelTab', 'rooming', 'travel')}
      ${tabBtn('Per Diem', 'travelTab', 'perdiem', 'travel')}
    </div>
    ${travelTab === 'all' ? renderTravelAll() : travelTab === 'rooming' ? renderTravelRooming() : renderTravelPerDiem()}
  `;
}

function renderTravelAll() {
  const typeIconKeys = { flight: 'travelFlight', hotel: 'travelHotel', self_drive: 'travelSelfDrive', bus: 'travelLocation', train: 'travelLocation' };
  const statusColors = { booked: 'var(--accent-blue)', confirmed: 'var(--accent-green)', pending: 'var(--accent-amber)', cancelled: 'var(--accent-red)' };
  const apiList = typeof window !== 'undefined' && window.__pldGlobalTravelList && window.__pldGlobalTravelList.rows;
  const apiBanner = apiList && apiList.length
    ? `<div class="card" style="margin-bottom:20px;padding:14px 16px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--text-secondary);">Live travel records (API)</div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Type</th><th>Route</th><th>Personnel</th><th>Event</th><th>Departs</th><th>Status</th><th>Cost</th></tr></thead><tbody>
          ${apiList.map((tr) => {
            const esc = (s) => String(s == null ? '' : s).replace(/</g, '&lt;');
            const cost = tr.cost != null ? formatCurrency(Number(tr.cost)) : '—';
            return `<tr><td>${esc(tr.travel_type)}</td><td>${esc(tr.departure_location)} → ${esc(tr.arrival_location)}</td><td>${esc(tr.personnel_name)}</td><td>${esc(tr.event_name)}</td><td style="white-space:nowrap;font-size:12px;">${esc((tr.departure_datetime || '').slice(0, 16))}</td><td>${esc(tr.status)}</td><td>${cost}</td></tr>`;
          }).join('')}
        </tbody></table></div>
        <p style="margin:10px 0 0;font-size:11px;color:var(--text-tertiary);">${typeof PLD_DATA_FROM_REST !== 'undefined' && PLD_DATA_FROM_REST ? 'Counts below use the same API-loaded travel list.' : 'Demo cards below remain from local sample data.'}</p>
      </div>`
    : (typeof window !== 'undefined' && window.__pldGlobalTravelList && window.__pldGlobalTravelList.error
      ? '<div class="card" style="margin-bottom:16px;padding:12px;font-size:13px;color:var(--accent-amber);">Travel list API unavailable.</div>'
      : '');
  return `
    ${apiBanner}
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card"><div class="stat-label">Total Records</div><div class="stat-value">${TRAVEL_RECORDS.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Cost</div><div class="stat-value">${formatCurrency(TRAVEL_RECORDS.reduce((s, t) => s + t.cost, 0))}</div></div>
      <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value" style="color:var(--accent-amber);">${TRAVEL_RECORDS.filter(t => t.status === 'pending').length}</div></div>
      <div class="stat-card"><div class="stat-label">Flights</div><div class="stat-value">${TRAVEL_RECORDS.filter(t => t.type === 'flight').length}</div></div>
    </div>
    <div class="filter-bar">
      <select class="filter-select"><option>All Types</option><option>Flights</option><option>Hotels</option><option>Self-Drive</option></select>
      <select class="filter-select"><option>All Events</option>${EVENTS.filter(e => TRAVEL_RECORDS.some(t => t.event === e.id)).map(e => `<option>${e.name}</option>`).join('')}</select>
      <select class="filter-select"><option>All Statuses</option><option>Booked</option><option>Confirmed</option><option>Pending</option></select>
    </div>
    ${TRAVEL_RECORDS.map(tr => { const person = getPersonnel(tr.personnel); const ev = EVENTS.find(e => e.id === tr.event); return `
      <div class="travel-card" onclick="openTravelDetailModal('${tr.id}')">
        <div class="travel-card-header">
          <div class="travel-route"><span>${uiIcon(typeIconKeys[tr.type] || 'travelLocation')}</span><span>${tr.from}</span>${tr.to ? `<span class="travel-arrow">→</span><span>${tr.to}</span>` : ''}</div>
          <span class="phase-badge" style="background:${statusColors[tr.status]}20;color:${statusColors[tr.status]};">${tr.status}</span>
        </div>
        <div class="travel-details">
          <div><div class="travel-detail-label">Crew</div><div class="travel-detail-value">${person.name}</div></div>
          <div><div class="travel-detail-label">Event</div><div class="travel-detail-value">${ev.name}</div></div>
          <div><div class="travel-detail-label">Date</div><div class="travel-detail-value">${formatDate(tr.date)}</div></div>
          <div><div class="travel-detail-label">Cost</div><div class="travel-detail-value">${formatCurrency(tr.cost)}</div></div>
        </div>
      </div>
    `; }).join('')}
  `;
}

function renderTravelRooming() {
  const rooms =
    typeof window !== 'undefined' && window.__pldGlobalRoomingBlocks && window.__pldGlobalRoomingBlocks.length
      ? window.__pldGlobalRoomingBlocks
      : [];
  if (!rooms.length) {
    return `
    <div class="empty-state" style="padding:32px;">
      <p style="color:var(--text-tertiary);margin:0 0 10px;">No rooming data yet. Lists are built from <strong>hotel accommodation</strong> on travel records (confirmation / room type / dates).</p>
      <p style="color:var(--text-tertiary);margin:0;font-size:13px;">Add or edit travel with accommodation on an event, or open this page while connected to the API so travel can load.</p>
    </div>`;
  }
  return `
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card"><div class="stat-label">Total Rooms</div><div class="stat-value">${rooms.reduce((s,r) => s + r.rooms.length, 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Events with Rooms</div><div class="stat-value">${rooms.length}</div></div>
      <div class="stat-card"><div class="stat-label">Shared Rooms</div><div class="stat-value">${rooms.reduce((s,r) => s + r.rooms.filter(rm => rm.share !== '—').length, 0)}</div></div>
    </div>
    ${rooms.map(rl => `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div><span class="card-title">${rl.event}</span><div style="font-size:12px;color:var(--text-tertiary);">${rl.hotel} · ${formatDateShort(rl.checkIn)} — ${formatDateShort(rl.checkOut)}</div></div>
          <button class="btn btn-ghost btn-sm" onclick="openExportModal('Rooming List — ${rl.event}')">Export</button>
        </div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Crew Member</th><th>Room #</th><th>Type</th><th>Sharing With</th></tr></thead><tbody>
          ${rl.rooms.map(rm => `<tr><td><strong>${rm.crew}</strong></td><td>${rm.room}</td><td>${rm.type}</td><td>${rm.share}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    `).join('')}
  `;
}

function renderTravelPerDiem() {
  const defaultRate = 75;
  const apiRows =
    typeof window !== 'undefined' &&
    window.__pldGlobalTravelList &&
    !window.__pldGlobalTravelList.error &&
    Array.isArray(window.__pldGlobalTravelList.rows)
      ? window.__pldGlobalTravelList.rows
      : [];
  const byPid = new Map();
  for (let i = 0; i < apiRows.length; i++) {
    const tr = apiRows[i];
    const pid = tr.personnel_id != null ? String(tr.personnel_id) : '';
    if (!pid) continue;
    const person = getPersonnel(pid);
    if (!person) continue;
    if (!byPid.has(pid)) {
      byPid.set(pid, { person: person, dates: new Set(), eventName: null });
    }
    const entry = byPid.get(pid);
    const dep = tr.departure_datetime != null ? String(tr.departure_datetime).slice(0, 10) : '';
    if (dep) entry.dates.add(dep);
    const en = tr.event_name != null && String(tr.event_name).trim() !== '' ? String(tr.event_name) : null;
    if (en) entry.eventName = en;
  }
  let rows = [];
  if (byPid.size > 0) {
    byPid.forEach(function (entry) {
      const p = entry.person;
      const days = Math.max(1, entry.dates.size);
      const rate =
        p.per_diem != null && !Number.isNaN(Number(p.per_diem)) ? Number(p.per_diem) : defaultRate;
      rows.push({
        person: p,
        eventName: entry.eventName || '—',
        days: days,
        rate: rate,
        total: days * rate,
      });
    });
  } else {
    const demoIds = ['p1', 'p2', 'p3', 'p5', 'p7', 'p8', 'p11'];
    for (let j = 0; j < demoIds.length; j++) {
      const p = getPersonnel(demoIds[j]);
      if (!p) continue;
      const days = p.id === 'p8' ? 4 : 3;
      const rate =
        p.per_diem != null && !Number.isNaN(Number(p.per_diem)) ? Number(p.per_diem) : defaultRate;
      const ev = EVENTS.find(function (e) {
        return Array.isArray(e.crew) && e.crew.includes(p.id);
      });
      rows.push({
        person: p,
        eventName: ev ? ev.name : '—',
        days: days,
        rate: rate,
        total: days * rate,
      });
    }
  }
  if (rows.length === 0) {
    return `
    <div class="empty-state" style="padding:32px;">
      <p style="color:var(--text-tertiary);margin:0 0 10px;">No per diem rows yet. This tab uses <strong>travel records</strong> (unique crew and travel days) and each person’s <strong>per diem</strong> from Personnel (default $${defaultRate}/day).</p>
      <p style="color:var(--text-tertiary);margin:0;font-size:13px;">Add travel while connected to the API, or load demo seed data when offline.</p>
    </div>`;
  }
  const totalPerDiem = rows.reduce(function (s, r) {
    return s + r.total;
  }, 0);
  const avgRate = rows.length ? rows.reduce(function (s, r) { return s + r.rate; }, 0) / rows.length : defaultRate;
  return `
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card"><div class="stat-label">Avg per diem rate</div><div class="stat-value">${formatCurrency(avgRate)}/day</div></div>
      <div class="stat-card"><div class="stat-label">Crew on Travel</div><div class="stat-value">${rows.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Per Diem</div><div class="stat-value">${formatCurrency(totalPerDiem)}</div></div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Crew Member</th><th>Event</th><th>Travel Days</th><th>Rate</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${rows.map(function (r) {
        const p = r.person;
        return `<tr>
        <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;">${p.initials}</div>${p.name}</div></td>
        <td>${r.eventName}</td>
        <td>${r.days} days</td><td>${formatCurrency(r.rate)}</td><td><strong>${formatCurrency(r.total)}</strong></td>
        <td><span class="phase-badge closed">Approved</span></td>
      </tr>`;
      }).join('')}
    </tbody></table></div>
  `;
}

function pldTravelAddUpdateLabels() {
  const sel = window.__pldTravelAddSel;
  if (!sel) return;
  const pl = document.getElementById('pldTravelAddPersonnelLabel');
  const el = document.getElementById('pldTravelAddEventLabel');
  if (pl) {
    if (!sel.personnelId) pl.textContent = 'Select…';
    else {
      const p = getPersonnel(sel.personnelId);
      pl.textContent = p ? p.name : 'Select…';
    }
  }
  if (el) {
    if (!sel.eventId) el.textContent = 'Select…';
    else {
      const ev = EVENTS.find((x) => x.id === sel.eventId);
      el.textContent = ev ? ev.name : 'Select…';
    }
  }
}

function pldOpenTravelAddPersonnelPicker() {
  if (typeof openPickerModal !== 'function') {
    if (typeof showToast === 'function') showToast('Picker not available', 'error');
    return;
  }
  const items =
    typeof pickerItemsFromPersonnel === 'function' ? pickerItemsFromPersonnel(PERSONNEL) : [];
  openPickerModal({
    title: 'Select crew member',
    items: items,
    onSelect: function (id) {
      window.__pldTravelAddSel = window.__pldTravelAddSel || { personnelId: '', eventId: '' };
      window.__pldTravelAddSel.personnelId = id;
      pldTravelAddUpdateLabels();
    },
  });
}

function pldOpenTravelAddEventPicker() {
  if (typeof openPickerModal !== 'function') {
    if (typeof showToast === 'function') showToast('Picker not available', 'error');
    return;
  }
  const items =
    typeof pickerItemsFromEvents === 'function'
      ? pickerItemsFromEvents(EVENTS, { excludeTerminal: true })
      : [];
  openPickerModal({
    title: 'Select event',
    items: items,
    pickerFilter: 'events',
    onSelect: function (id) {
      window.__pldTravelAddSel = window.__pldTravelAddSel || { personnelId: '', eventId: '' };
      window.__pldTravelAddSel.eventId = id;
      pldTravelAddUpdateLabels();
    },
  });
}

function openAddTravelModal() {
  window.__pldTravelAddSel = { personnelId: '', eventId: '' };
  const body = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Crew Member</label><button type="button" class="pld-picker-trigger" onclick="pldOpenTravelAddPersonnelPicker()"><span id="pldTravelAddPersonnelLabel">Select…</span><span style="opacity:0.55;font-size:10px;" aria-hidden="true">▾</span></button></div>
      <div class="form-group"><label class="form-label">Event</label><button type="button" class="pld-picker-trigger" onclick="pldOpenTravelAddEventPicker()"><span id="pldTravelAddEventLabel">Select…</span><span style="opacity:0.55;font-size:10px;" aria-hidden="true">▾</span></button></div>
    </div>
    <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option>Flight</option><option>Hotel</option><option>Self-Drive</option><option>Bus/Shuttle</option><option>Train</option></select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">From</label><input type="text" class="form-input" placeholder="Origin"></div>
      <div class="form-group"><label class="form-label">To</label><input type="text" class="form-input" placeholder="Destination"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input"></div>
      <div class="form-group"><label class="form-label">Cost ($)</label><input type="number" class="form-input" placeholder="0"></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Confirmation number, special requests…"></textarea></div>
  `;
  openModal('Add Travel Record', body, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Travel record added!','success');closeModal();">Add Record</button>`);
}

// ============================================
// FINANCIAL (with sub-tabs)
// ============================================
