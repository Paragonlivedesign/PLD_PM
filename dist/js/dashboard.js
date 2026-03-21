// ============================================
// DASHBOARD
// ============================================
const DASHBOARD_ROLES = [
  { id: 'pm', label: 'Production Manager' },
  { id: 'dept', label: 'Department Head' },
  { id: 'crew', label: 'Crew Member' },
  { id: 'finance', label: 'Finance' },
  { id: 'exec', label: 'Executive' },
];

function renderDashboard() {
  const role = dashboardRole || 'pm';
  const roleLabel = DASHBOARD_ROLES.find(r => r.id === role)?.label || 'Production Manager';

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Operations Dashboard</h1>
        <p class="page-subtitle">${role === 'pm' ? 'Real-time overview of all production operations' : role === 'dept' ? 'Department schedule and crew' : role === 'crew' ? 'Your assignments and documents' : role === 'finance' ? 'Financial overview and invoices' : 'High-level utilization and revenue'}</p>
      </div>
      <div class="page-actions" style="display:flex;align-items:center;gap:12px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">View as</label>
          <select class="form-select" style="min-width:160px;padding:6px 10px;font-size:13px;" onchange="dashboardRole=this.value;renderPage('dashboard');">
            ${DASHBOARD_ROLES.map(r => `<option value="${r.id}" ${role === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary" onclick="openRefreshModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
        <button class="btn btn-primary" onclick="openNewEventModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Event
        </button>
      </div>
    </div>
    ${role === 'pm' ? renderDashboardPM() : role === 'dept' ? renderDashboardDept() : role === 'crew' ? renderDashboardCrew() : role === 'finance' ? renderDashboardFinance() : renderDashboardExec()}
  `;
}

function renderDashboardPM() {
  const activeEvents = EVENTS.filter(e => !isTerminalEventPhase(e.phase)).length;
  const liveEvents = EVENTS.filter(e => e.phase === 'production').length;
  const liveEv = EVENTS.find((e) => e.phase === 'production');
  const totalBudget = EVENTS.reduce((s, e) => s + e.budget, 0);
  const totalSpent = EVENTS.reduce((s, e) => s + e.spent, 0);
  const availableCrew = PERSONNEL.filter(p => p.status === 'available').length;

  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
        <div class="stat-label">Active Events</div>
        <div class="stat-value">${activeEvents}</div>
        <div class="stat-change">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
        <div class="stat-label">Live Now</div>
        <div class="stat-value">${liveEvents}</div>
        <div class="stat-change">${liveEvents > 0 ? (liveEv && liveEv.name) || 'Live' : 'No live events'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
        <div class="stat-label">Available Crew</div>
        <div class="stat-value">${availableCrew}<span style="font-size:14px;color:var(--text-tertiary);">/${PERSONNEL.length}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="stat-label">Total Budget</div>
        <div class="stat-value">${formatCurrency(totalBudget)}</div>
        <div class="stat-change">${Math.round(totalSpent / totalBudget * 100)}% utilized</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">Event Lifecycle Pipeline</span>
        <span style="font-size:12px;color:var(--text-tertiary);">${EVENTS.length} total events</span>
      </div>
      <div class="lifecycle-pipeline">
        ${PHASES.map((phase, i) => `
          <div class="lifecycle-stage ${phase} ${selectedPhaseFilter === phase ? 'active' : ''}" onclick="filterByPhase('${phase}')">
            ${PHASE_LABELS[phase]}
            <span class="stage-count">${getPhaseCount(phase)}</span>
          </div>
          ${i < PHASES.length - 1 ? '<span class="lifecycle-arrow">'+uiIcon('arrowRight')+'</span>' : ''}
        `).join('')}
      </div>
    </div>

    <div class="grid-2-1">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Upcoming Events</span>
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('events')">View all →</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Event</th><th>Phase</th><th>Date</th><th>Budget</th></tr></thead>
            <tbody>
              ${EVENTS.filter(e => !isTerminalEventPhase(e.phase)).sort((a,b) => a.startDate.localeCompare(b.startDate)).slice(0, 6).map(ev => `
                <tr onclick="navigateToEvent('${ev.id}')">
                  <td><div style="font-weight:500;">${ev.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${getVenue(ev.venue).city}</div></td>
                  <td><span class="phase-badge ${ev.phase}">${PHASE_LABELS[ev.phase]}</span></td>
                  <td style="white-space:nowrap;">${formatDateShort(ev.startDate)}</td>
                  <td>${formatCurrency(ev.budget)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        <div class="activity-feed">
          ${ACTIVITY_LOG.map(a => `
            <div class="activity-item">
              <div class="activity-dot" style="background: ${a.color};"></div>
              <div class="activity-content">
                <strong>${a.user}</strong> ${a.action} <strong>${a.target}</strong> ${a.detail}
                <div class="activity-time">${a.time}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:24px;">
      <div class="card-header">
        <span class="card-title">Schedule overview</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="view-toggle" style="border-radius:var(--radius-md);">
            <button class="view-toggle-btn ${dashboardScheduleView === 'calendar' ? 'active' : ''}" onclick="dashboardScheduleView='calendar';renderPage('dashboard');">Calendar</button>
            <button class="view-toggle-btn ${dashboardScheduleView === 'timeline' ? 'active' : ''}" onclick="dashboardScheduleView='timeline';renderPage('dashboard');">Timeline</button>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('scheduling')">Open Scheduling →</button>
        </div>
      </div>
      <div id="dashboardScheduleWrap">${dashboardScheduleView === 'timeline' ? renderScheduleTimeline({ embedded: true }) : renderScheduleCalendar({ embedded: true })}</div>
    </div>
  `;
}

function renderDashboardDept() {
  const deptId = DEPARTMENTS[0]?.id || 'd1';
  const deptName = DEPARTMENTS[0]?.name || 'Audio';
  const deptCrew = PERSONNEL.filter(p => p.dept === deptId);
  const deptEvents = EVENTS.filter(e => !isTerminalEventPhase(e.phase) && e.crew.some(c => deptCrew.some(d => d.id === c)));
  const workload = deptCrew.filter(p => p.status === 'on_event').length;

  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div><div class="stat-label">Events (${deptName})</div><div class="stat-value">${deptEvents.length}</div></div>
      <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="stat-label">Dept Crew</div><div class="stat-value">${deptCrew.length}</div></div>
      <div class="stat-card"><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></div><div class="stat-label">On assignment this week</div><div class="stat-value">${workload}</div></div>
    </div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-header"><span class="card-title">Department Schedule (${deptName})</span><button class="btn btn-ghost btn-sm" onclick="navigateTo('scheduling')">Full schedule →</button></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Crew</th><th>Role</th><th>Event</th><th>Dates</th></tr></thead>
            <tbody>
              ${deptCrew.slice(0, 6).map(p => {
                const ev = EVENTS.find(e => e.crew.includes(p.id));
                const evName = ev ? ev.name : '—';
                const dates = ev ? formatDateShort(ev.startDate) + (ev.startDate !== ev.endDate ? ' — ' + formatDateShort(ev.endDate) : '') : '—';
                return `<tr><td><div style="font-weight:500;">${p.name}</div></td><td>${p.role}</td><td>${evName}</td><td style="white-space:nowrap;">${dates}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Events I'm involved in</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Event</th><th>Phase</th><th>Date</th></tr></thead>
            <tbody>
              ${deptEvents.slice(0, 5).map(ev => `<tr onclick="navigateToEvent('${ev.id}')"><td style="font-weight:500;">${ev.name}</td><td><span class="phase-badge ${ev.phase}">${PHASE_LABELS[ev.phase]}</span></td><td>${formatDateShort(ev.startDate)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardCrew() {
  const myId = PERSONNEL[0]?.id || 'p1';
  const me = getPersonnel(myId);
  const myEvents = EVENTS.filter(e => e.crew.includes(myId) && !isTerminalEventPhase(e.phase)).sort((a,b) => a.startDate.localeCompare(b.startDate));
  const nextEv = myEvents[0];
  const myDocs = DOCUMENTS.filter(d => nextEv && d.event === nextEv.id).slice(0, 3);

  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div><div class="stat-label">My assignments</div><div class="stat-value">${myEvents.length}</div></div>
      <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><div class="stat-label">Next call</div><div class="stat-value" style="font-size:16px;">${nextEv ? formatDateShort(nextEv.startDate) + ' 08:00' : '—'}</div></div>
      <div class="stat-card"><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></div><div class="stat-label">Pending documents</div><div class="stat-value">${myDocs.length}</div></div>
    </div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-header"><span class="card-title">Upcoming assignments</span><button class="btn btn-ghost btn-sm" onclick="navigateTo('personnel')">Personnel →</button></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Event</th><th>Venue</th><th>Date</th><th>Call</th></tr></thead>
            <tbody>
              ${myEvents.slice(0, 6).map(ev => `<tr onclick="navigateToEvent('${ev.id}')"><td style="font-weight:500;">${ev.name}</td><td>${getVenue(ev.venue).city}</td><td>${formatDateShort(ev.startDate)}</td><td>08:00</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">My documents</span></div>
        <div class="table-wrap">
          ${myDocs.length > 0 ? `<table class="data-table"><thead><tr><th>Document</th><th>Event</th></tr></thead><tbody>${myDocs.map(d => `<tr onclick="openDocPreview('${d.id}')"><td style="font-weight:500;">${d.name}</td><td>${nextEv?.name || ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><p style="color:var(--text-tertiary);">No documents assigned</p></div>'}
        </div>
      </div>
    </div>
  `;
}

function renderDashboardFinance() {
  const totalBudget = EVENTS.reduce((s, e) => s + e.budget, 0);
  const totalSpent = EVENTS.reduce((s, e) => s + e.spent, 0);
  const margin = totalBudget - totalSpent;
  const overdueCount =
    typeof INVOICES !== 'undefined' ? INVOICES.filter((inv) => inv.status === 'overdue').length : 0;

  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Total budget</div><div class="stat-value">${formatCurrency(totalBudget)}</div></div>
      <div class="stat-card"><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Total spent</div><div class="stat-value">${formatCurrency(totalSpent)}</div><div class="stat-change">${Math.round(totalSpent/totalBudget*100)}% utilized</div></div>
      <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Margin</div><div class="stat-value" style="color:var(--accent-green);">${formatCurrency(margin)}</div></div>
      <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div><div class="stat-label">Overdue invoices</div><div class="stat-value">${overdueCount}</div><div class="stat-change" style="color:var(--accent-red);">Requires action</div></div>
    </div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-header"><span class="card-title">Budget vs actual (by event)</span><button class="btn btn-ghost btn-sm" onclick="navigateTo('financial')">Financial →</button></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Event</th><th>Budget</th><th>Spent</th><th>Remaining</th></tr></thead>
            <tbody>
              ${EVENTS.filter(e => e.budget > 0).slice(0, 6).map(ev => {
                const rem = ev.budget - ev.spent;
                return `<tr onclick="navigateToEvent('${ev.id}')"><td style="font-weight:500;">${ev.name}</td><td>${formatCurrency(ev.budget)}</td><td>${formatCurrency(ev.spent)}</td><td style="color:${rem >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${formatCurrency(rem)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Invoice status</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              ${typeof INVOICES !== 'undefined' && INVOICES.length
                ? INVOICES.slice(0, 8)
                    .map((inv) => {
                      const client = getClient(inv.client);
                      const st = inv.status || 'draft';
                      const bg =
                        st === 'paid'
                          ? 'var(--accent-green)'
                          : st === 'overdue'
                            ? 'var(--accent-red)'
                            : 'var(--accent-amber)';
                      return `<tr><td style="font-weight:500;">${inv.number || '—'}</td><td>${client.name || '—'}</td><td><span class="phase-badge" style="font-size:10px;background:${bg};color:#fff;">${st}</span></td><td>${formatDateShort(inv.dueDate)}</td></tr>`;
                    })
                    .join('')
                : '<tr><td colspan="4" style="color:var(--text-tertiary);font-size:13px;">No invoices in catalog.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardExec() {
  const totalBudget = EVENTS.reduce((s, e) => s + e.budget, 0);
  const totalSpent = EVENTS.reduce((s, e) => s + e.spent, 0);
  const utilization = PERSONNEL.length ? Math.round(PERSONNEL.filter(p => p.status === 'on_event').length / PERSONNEL.length * 100) : 0;
  const activeEvents = EVENTS.filter(e => !isTerminalEventPhase(e.phase)).length;

  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></div><div class="stat-label">Crew utilization</div><div class="stat-value">${utilization}%</div></div>
      <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Revenue (budget)</div><div class="stat-value">${formatCurrency(totalBudget)}</div></div>
      <div class="stat-card"><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div><div class="stat-label">Active events</div><div class="stat-value">${activeEvents}</div></div>
      <div class="stat-card"><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Margin</div><div class="stat-value" style="color:var(--accent-green);">${formatCurrency(totalBudget - totalSpent)}</div></div>
    </div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-header"><span class="card-title">Event pipeline</span><button class="btn btn-ghost btn-sm" onclick="navigateTo('events')">Events →</button></div>
        <div class="lifecycle-pipeline" style="padding:12px;">
          ${PHASES.slice(0, 6).map(phase => `<div class="lifecycle-stage ${phase}" style="padding:8px 12px;"><span class="stage-count">${getPhaseCount(phase)}</span> ${PHASE_LABELS[phase]}</div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Financial summary</span><button class="btn btn-ghost btn-sm" onclick="navigateTo('financial')">Financial →</button></div>
        <div style="padding:16px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span style="color:var(--text-tertiary);">Budget</span><span style="font-weight:600;">${formatCurrency(totalBudget)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span style="color:var(--text-tertiary);">Spent</span><span style="font-weight:600;color:var(--accent-amber);">${formatCurrency(totalSpent)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-tertiary);">Remaining</span><span style="font-weight:600;color:var(--accent-green);">${formatCurrency(totalBudget - totalSpent)}</span></div>
        </div>
      </div>
    </div>
  `;
}

function filterByPhase(phase) {
  selectedPhaseFilter = selectedPhaseFilter === phase ? null : phase;
  if (currentPage === 'dashboard') renderPage('dashboard');
  else navigateTo('events');
}
