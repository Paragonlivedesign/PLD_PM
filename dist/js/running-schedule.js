/* ============================================
   Running schedule grid — columns from event dates; cells in event.metadata.running_schedule
   ============================================ */

function rsCellStorageKey(rowKey, isoDate) {
  return rowKey + '|' + isoDate;
}

function getRunningScheduleMeta(ev) {
  const md = ev && ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {};
  const rs = md.running_schedule && typeof md.running_schedule === 'object' ? md.running_schedule : {};
  const cells =
    rs.cells && typeof rs.cells === 'object' && !Array.isArray(rs.cells) ? rs.cells : {};
  const phaseByDate =
    rs.phaseByDate && typeof rs.phaseByDate === 'object' && !Array.isArray(rs.phaseByDate)
      ? rs.phaseByDate
      : {};
  let showDate =
    typeof rs.showDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rs.showDate) ? rs.showDate : null;
  return { cells, phaseByDate, showDate };
}

function parseIsoDateLocal(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  const d = new Date(String(iso) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Build one column per calendar day from event start → end (inclusive).
 * @returns {{ iso: string, d: string, day: string, phase: string, highlight: boolean, isWeekend: boolean }[]}
 */
function buildRunningScheduleDateColumns(ev, rsMeta) {
  const phaseByDate = rsMeta.phaseByDate || {};
  let start = ev && ev.startDate ? String(ev.startDate) : '';
  let end = ev && ev.endDate ? String(ev.endDate) : '';
  if (!parseIsoDateLocal(start)) {
    const t = new Date();
    start = t.toISOString().slice(0, 10);
  }
  if (!parseIsoDateLocal(end)) end = start;
  if (start > end) {
    const x = start;
    start = end;
    end = x;
  }
  const showDateStr = rsMeta.showDate || end;
  const cols = [];
  const cur0 = parseIsoDateLocal(start);
  const end0 = parseIsoDateLocal(end);
  if (!cur0 || !end0) return cols;
  const cur = new Date(cur0);
  const endD = new Date(end0);
  for (; cur.getTime() <= endD.getTime(); cur.setDate(cur.getDate() + 1)) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const da = String(cur.getDate()).padStart(2, '0');
    const iso = y + '-' + mo + '-' + da;
    const wd = cur.toLocaleDateString('en-US', { weekday: 'short' });
    const phRaw = phaseByDate[iso];
    const phase = phRaw != null ? String(phRaw) : '';
    const dow = cur.getDay();
    const isWeekend = dow === 0 || dow === 6;
    cols.push({
      iso,
      d: formatDateShort(iso),
      day: wd,
      phase,
      highlight: iso === showDateStr,
      isWeekend,
    });
  }
  return cols;
}

/** True when column should use muted "off" styling (explicit phase off, or weekends when no OFF phases defined and checkbox off). */
function isRunningScheduleOffDayColumn(dc, allDateCols, showOffDays) {
  if (String(dc.phase).toLowerCase() === 'off') return true;
  const hasExplicitOff = allDateCols.some((x) => String(x.phase).toLowerCase() === 'off');
  if (!hasExplicitOff && !showOffDays && dc.isWeekend) return true;
  return false;
}

function rsEscapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

async function saveRunningScheduleCell(eventId, rowKey, isoDate, newText) {
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) {
    showToast('Event not found', 'error');
    return;
  }
  const md = ev.metadata && typeof ev.metadata === 'object' ? { ...ev.metadata } : {};
  const prevRs =
    md.running_schedule && typeof md.running_schedule === 'object' ? md.running_schedule : {};
  const rs = {
    ...prevRs,
    cells: {
      ...(prevRs.cells && typeof prevRs.cells === 'object' && !Array.isArray(prevRs.cells)
        ? prevRs.cells
        : {}),
    },
  };
  const key = rsCellStorageKey(rowKey, isoDate);
  const t = newText != null ? String(newText).trim() : '';
  if (t === '') delete rs.cells[key];
  else rs.cells[key] = t;
  md.running_schedule = rs;
  ev.metadata = md;
  await persistEventFields(eventId, { metadata: md });
  showToast('Saved', 'success');
  closeModal();
  renderPage(currentPage);
}

async function submitRunningScheduleCellFromModal(eventId, rowKey, isoDate) {
  const el = document.getElementById('rsCellEditText');
  const v = el ? el.value : '';
  await saveRunningScheduleCell(eventId, rowKey, isoDate, v);
}

async function clearRunningScheduleCellFromModal(eventId, rowKey, isoDate) {
  await saveRunningScheduleCell(eventId, rowKey, isoDate, '');
}

function openRunningScheduleCellModal(eventId, rowKey, linkType, linkId, isoDate) {
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) return;
  const rsMeta = getRunningScheduleMeta(ev);
  const key = rsCellStorageKey(rowKey, isoDate);
  const initial = String(rsMeta.cells[key] || '').trim();
  const showDateStr = rsMeta.showDate || ev.endDate;
  const dateLabel = formatDate(isoDate);
  const rowLabel =
    rowKey === 'show_day'
      ? 'Show Day'
      : (
          [
            { key: 'stage', label: 'Stage' },
            { key: 'rigging', label: 'Rigging' },
            { key: 'audio', label: 'Audio' },
            { key: 'a2', label: 'A2' },
            { key: 'cameras', label: 'Cameras' },
            { key: 'led', label: 'LED' },
            { key: 'delays', label: 'Delays' },
            { key: 's7aud', label: 'S7 AUD' },
            { key: 's7lxled', label: 'S7 LX/LED' },
            { key: 's7rigdelay', label: 'S7 RIG/Delay' },
            { key: 'j6truck', label: 'J6 Truck' },
            { key: 'hotel', label: 'Hotel' },
            { key: 'flights', label: 'Flights' },
            { key: 'van1', label: 'Van 1 LX' },
            { key: 'van2', label: 'Van 2 AUDIO/VX' },
            { key: 'personalVehicle', label: 'Personal Vehicle' },
            { key: 'localCrew', label: 'Local Crew' },
            { key: 'warehouse', label: 'Warehouse' },
            { key: 'truck', label: 'Truck' },
            { key: 'callTime', label: 'Call Time' },
            { key: 'drive', label: 'Drive' },
            { key: 'detail', label: 'Detail' },
          ].find((r) => r.key === rowKey) || { label: rowKey }
        ).label;
  const hint =
    rowKey === 'show_day' && isoDate === showDateStr && !initial
      ? '<p style="font-size:12px;color:var(--text-tertiary);margin:0 0 8px;">Default on show day: Doors 6PM / Show 8PM. Save to override.</p>'
      : '';
  const escapedDate = dateLabel.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const ctxBtn =
    linkType && linkType !== 'note' && linkType !== 'transport' && linkType !== 'logistics'
      ? `<button type="button" class="btn btn-ghost btn-sm" onclick="openRSCellContextFromModal('${linkType}','${linkId}','${escapedDate}')">Linked record context…</button>`
      : '';
  const body = `
    ${hint}
    <div class="form-group">
      <label class="form-label">Cell text — ${rsEscapeHtml(rowLabel)} · ${rsEscapeHtml(dateLabel)}</label>
      <textarea class="form-textarea" id="rsCellEditText" rows="5" style="min-height:100px;">${rsEscapeHtml(initial)}</textarea>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
      ${ctxBtn}
    </div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button type="button" class="btn btn-ghost" onclick="void clearRunningScheduleCellFromModal('${eventId}','${rowKey}','${isoDate}')">Clear cell</button>
    <button type="button" class="btn btn-primary" onclick="void submitRunningScheduleCellFromModal('${eventId}','${rowKey}','${isoDate}')">Save</button>
  `;
  openModal(rowLabel + ' — ' + dateLabel, body, footer);
}

/** Open context modal: reads textarea then opens detail (avoids broken escaping in inline onclick). */
function openRSCellContextFromModal(linkType, linkId, dateLabel) {
  const el = document.getElementById('rsCellEditText');
  const t = el ? el.value : '';
  closeModal();
  setTimeout(function () {
    openRSCellDetail(linkType, linkId, dateLabel, t);
  }, 0);
}

function renderRunningSchedule() {
  const ev = selectedEventId
    ? EVENTS.find((e) => e.id === selectedEventId)
    : EVENTS.find((e) => !isTerminalEventPhase(e.phase)) || EVENTS[0];
  if (!ev) {
    return '<div class="empty-state"><p>No event selected</p></div>';
  }
  const venue = getVenue(ev.venue);
  const client = getClient(ev.client);

  let tabContent = '';
  if (runningScheduleTab === 'running') tabContent = renderRunningScheduleGrid(ev, venue, client);
  else if (runningScheduleTab === 'schedule') tabContent = renderDailySchedule(ev, venue, client);
  else if (runningScheduleTab === 'crewlist') tabContent = renderEventCrewList(ev, venue, client);
  else if (runningScheduleTab === 'radios') tabContent = renderRadiosTab(ev);

  return `
    <div class="running-schedule-wrapper">
      <!-- Event Header Bar -->
      <div class="rs-event-header">
        <div class="rs-event-info">
          <h2 style="margin:0;font-size:16px;font-weight:700;">${ev.name}</h2>
          <div style="display:flex;gap:16px;margin-top:4px;font-size:12px;color:var(--text-tertiary);">
            <span>${venue.name}, ${venue.city}</span>
            <span>Client: ${client.name}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="filter-select" style="font-size:11px;padding:4px 8px;" onchange="showToast('Switched event','success')">
            <option>${ev.name}</option>
            ${EVENTS.filter((e) => !isTerminalEventPhase(e.phase) && e.id !== ev.id)
              .map((e) => `<option>${e.name}</option>`)
              .join('')}
          </select>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Exported to PDF','success')">Export</button>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Print view opened','info')">Print</button>
          <button class="btn btn-ghost btn-sm rs-settings-btn ${rsSettingsOpen ? 'active' : ''}" onclick="rsSettingsOpen=!rsSettingsOpen;renderPage(currentPage);" title="Configure Running Schedule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      <!-- Workbook Tabs -->
      <div class="rs-workbook-tabs">
        <button class="rs-wb-tab ${runningScheduleTab === 'running' ? 'active' : ''}" onclick="runningScheduleTab='running';renderPage(currentPage);">Running Schedule</button>
        <button class="rs-wb-tab ${runningScheduleTab === 'schedule' ? 'active' : ''}" onclick="runningScheduleTab='schedule';renderPage(currentPage);">Schedule</button>
        <button class="rs-wb-tab ${runningScheduleTab === 'crewlist' ? 'active' : ''}" onclick="runningScheduleTab='crewlist';renderPage(currentPage);">Crew List</button>
        <button class="rs-wb-tab ${runningScheduleTab === 'radios' ? 'active' : ''}" onclick="runningScheduleTab='radios';renderPage(currentPage);">Radios</button>
      </div>

      <!-- Tab Content + Settings Panel -->
      <div class="rs-content-layout ${rsSettingsOpen ? 'settings-open' : ''}">
        <div class="rs-tab-content">
          ${tabContent}
        </div>
        ${rsSettingsOpen ? renderRSSettingsPanel(ev) : ''}
      </div>
    </div>
  `;
}

function renderRSSettingsPanel(ev) {
  const secs = rsConfig.sections;
  const evSafe = ev && ev.id ? ev : null;
  const startDisp = evSafe && evSafe.startDate ? String(evSafe.startDate) : '—';
  const endDisp = evSafe && evSafe.endDate ? String(evSafe.endDate) : '—';

  function sectionToggle(key, sec) {
    return `<div class="rss-toggle-row">
      <label class="rss-toggle-label">
        <input type="checkbox" ${sec.visible ? 'checked' : ''} onchange="rsConfig.sections['${key}'].visible=this.checked;renderPage(currentPage);">
        <span>${sec.label}</span>
      </label>
      <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="toggleRSRowDetails('${key}')">Rows</button>
    </div>`;
  }

  const rowsBySection = {
    departments: [
      { key: 'stage', label: 'Stage' },
      { key: 'rigging', label: 'Rigging' },
      { key: 'audio', label: 'Audio' },
      { key: 'a2', label: 'A2' },
      { key: 'cameras', label: 'Cameras' },
      { key: 'led', label: 'LED' },
      { key: 'delays', label: 'Delays' },
    ],
    trucks: [
      { key: 's7aud', label: 'S7 AUD' },
      { key: 's7lxled', label: 'S7 LX/LED' },
      { key: 's7rigdelay', label: 'S7 RIG/Delay' },
      { key: 'j6truck', label: 'J6 Truck' },
      { key: 'hotel', label: 'Hotel' },
    ],
    flights: [{ key: 'flights', label: 'Flights' }],
    crewTransport: [
      { key: 'van1', label: 'Van 1 LX' },
      { key: 'van2', label: 'Van 2 AUDIO/VX' },
      { key: 'personalVehicle', label: 'Personal Vehicle' },
      { key: 'localCrew', label: 'Local Crew' },
    ],
    logistics: [
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'truck', label: 'Truck' },
      { key: 'callTime', label: 'Call Time' },
      { key: 'drive', label: 'Drive' },
      { key: 'detail', label: 'Detail' },
    ],
  };

  return `
    <div class="rs-settings-panel">
      <div class="rss-header">
        <h4 style="margin:0;font-size:13px;font-weight:700;">Configure View</h4>
        <button class="btn btn-ghost btn-sm" onclick="rsSettingsOpen=false;renderPage(currentPage);" style="font-size:16px;padding:2px 6px;">&times;</button>
      </div>

      <!-- Display Options -->
      <div class="rss-section">
        <div class="rss-section-title">Display Options</div>
        <label class="rss-check-row">
          <input type="checkbox" ${rsConfig.highlightShowDay ? 'checked' : ''} onchange="rsConfig.highlightShowDay=this.checked;renderPage(currentPage);">
          <span>Highlight show day</span>
        </label>
        <label class="rss-check-row">
          <input type="checkbox" ${rsConfig.showOffDays ? 'checked' : ''} onchange="rsConfig.showOffDays=this.checked;renderPage(currentPage);">
          <span>Show off / weekend styling</span>
        </label>
        <p style="font-size:10px;color:var(--text-tertiary);margin:4px 0 8px 12px;line-height:1.35;">When any column has phase <strong>OFF</strong>, unchecking hides those columns. If none, unchecking dims weekend columns.</p>
        <label class="rss-check-row">
          <input type="checkbox" ${rsConfig.showEmptyCols ? 'checked' : ''} onchange="rsConfig.showEmptyCols=this.checked;renderPage(currentPage);">
          <span>Show empty columns</span>
        </label>
        <p style="font-size:10px;color:var(--text-tertiary);margin:4px 0 8px 12px;">Reserved for future filtering.</p>
        <label class="rss-check-row">
          <input type="checkbox" ${rsConfig.compactMode ? 'checked' : ''} onchange="rsConfig.compactMode=this.checked;renderPage(currentPage);">
          <span>Compact mode</span>
        </label>
      </div>

      <!-- Sections -->
      <div class="rss-section">
        <div class="rss-section-title">Sections</div>
        ${Object.entries(secs)
          .map(
            ([key, sec]) => `
          ${sectionToggle(key, sec)}
          <div class="rss-row-list" id="rss-rows-${key}" style="display:none;">
            ${(rowsBySection[key] || [])
              .map(
                (r) => `
              <label class="rss-check-row rss-indent">
                <input type="checkbox" ${rsConfig.rows[r.key] ? 'checked' : ''} onchange="rsConfig.rows['${r.key}']=this.checked;renderPage(currentPage);">
                <span>${r.label}</span>
              </label>
            `,
              )
              .join('')}
          </div>
        `,
          )
          .join('')}
      </div>

      <!-- Add Row -->
      <div class="rss-section">
        <div class="rss-section-title">Custom Rows</div>
        <button class="btn btn-secondary btn-sm" style="width:100%;" onclick="openAddCustomRowModal()">+ Add Custom Row</button>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;" onclick="openAddCustomSectionModal()">+ Add Section</button>
      </div>

      <!-- Date Range -->
      <div class="rss-section">
        <div class="rss-section-title">Date range</div>
        <p style="font-size:11px;color:var(--text-tertiary);margin:0 0 8px;line-height:1.4;">Grid columns use this event’s start and end dates (<strong>${startDisp}</strong> → <strong>${endDisp}</strong>). Edit them from the event header (click the date range).</p>
      </div>

      <!-- Reset -->
      <div class="rss-section" style="border-top:1px solid var(--border-default);padding-top:12px;">
        <button class="btn btn-ghost btn-sm" style="width:100%;color:var(--accent-red);" onclick="resetRSConfig();showToast('Settings reset to default','info');">Reset to Defaults</button>
        <button class="btn btn-primary btn-sm" style="width:100%;margin-top:6px;" onclick="showToast('Template saved','success');">Save as Template</button>
      </div>
    </div>
  `;
}

function toggleRSRowDetails(sectionKey) {
  const el = document.getElementById('rss-rows-' + sectionKey);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function resetRSConfig() {
  rsConfig.sections = {
    departments: { visible: true, label: 'Departments' },
    notes: { visible: true, label: 'Notes' },
    trucks: { visible: true, label: 'Trucks' },
    flights: { visible: true, label: 'Flights' },
    crewTransport: { visible: true, label: 'Crew Transport' },
    logistics: { visible: true, label: 'Logistics' },
  };
  Object.keys(rsConfig.rows).forEach((k) => (rsConfig.rows[k] = true));
  rsConfig.showOffDays = true;
  rsConfig.showEmptyCols = true;
  rsConfig.highlightShowDay = true;
  rsConfig.compactMode = false;
  renderPage(currentPage);
}

function switchRunningTab(tab) {
  runningScheduleTab = tab;
  renderPage(currentPage);
}

// --- Running Schedule Grid ---
function renderRunningScheduleGrid(ev, venue, client) {
  void venue;
  void client;
  const rsMeta = getRunningScheduleMeta(ev);
  const allDateCols = buildRunningScheduleDateColumns(ev, rsMeta);
  const dateCols = rsConfig.showOffDays
    ? allDateCols
    : allDateCols.filter((dc) => String(dc.phase).toLowerCase() !== 'off');
  const compact = rsConfig.compactMode;
  const hlShow = rsConfig.highlightShowDay;
  const eventId = ev.id;

  const allDeptRows = [
    { key: 'stage', label: 'Stage', dept: 'Staging', linkType: 'dept', linkId: 'd4' },
    { key: 'rigging', label: 'Rigging', dept: 'Rigging', linkType: 'dept', linkId: 'd7' },
    { key: 'audio', label: 'Audio', dept: 'Audio', linkType: 'dept', linkId: 'd1' },
    { key: 'a2', label: 'A2', dept: 'Audio', linkType: 'crew', linkId: 'p2' },
    { key: 'cameras', label: 'Cameras', dept: 'Video', linkType: 'dept', linkId: 'd2' },
    { key: 'led', label: 'LED', dept: 'Lighting', linkType: 'dept', linkId: 'd3' },
    { key: 'delays', label: 'Delays', dept: 'Audio', linkType: 'dept', linkId: 'd1' },
  ];

  const allTruckRows = [
    { key: 's7aud', label: 'S7 AUD', linkType: 'truck', linkId: 't1' },
    { key: 's7lxled', label: 'S7 LX/LED', linkType: 'truck', linkId: 't3' },
    { key: 's7rigdelay', label: 'S7 RIG/Delay', linkType: 'truck', linkId: 't5' },
    { key: 'j6truck', label: 'J6 Truck', linkType: 'truck', linkId: 't6' },
    { key: 'hotel', label: 'Hotel', linkType: 'hotel', linkId: 'hotel' },
  ];

  const allFlightRows = [{ key: 'flights', label: 'Flights', linkType: 'travel', linkId: 'tr1' }];

  const allTransportRows = [
    { key: 'van1', label: 'Van 1 LX', linkType: 'transport', linkId: 'van1' },
    { key: 'van2', label: 'Van 2 AUDIO/VX', linkType: 'transport', linkId: 'van2' },
    { key: 'personalVehicle', label: 'Personal Vehicle', linkType: 'transport', linkId: 'pv' },
    { key: 'localCrew', label: 'Local Crew', linkType: 'transport', linkId: 'lc' },
  ];

  const allLogisticsRows = [
    { key: 'warehouse', label: 'Warehouse', linkType: 'logistics', linkId: 'wh' },
    { key: 'truck', label: 'Truck', linkType: 'logistics', linkId: 'tk' },
    { key: 'callTime', label: 'Call Time', linkType: 'logistics', linkId: 'ct' },
    { key: 'drive', label: 'Drive', linkType: 'logistics', linkId: 'dr' },
    { key: 'detail', label: 'Detail', linkType: 'logistics', linkId: 'dt' },
  ];

  const deptRows = allDeptRows.filter((r) => rsConfig.rows[r.key]);
  const truckRows = allTruckRows.filter((r) => rsConfig.rows[r.key]);
  const flightRows = allFlightRows.filter((r) => rsConfig.rows[r.key]);
  const transportRows = allTransportRows.filter((r) => rsConfig.rows[r.key]);
  const logisticsRows = allLogisticsRows.filter((r) => rsConfig.rows[r.key]);

  const cells = rsMeta.cells;

  function renderCells(rowKey, rowClass, linkType, linkId) {
    return dateCols
      .map((dc) => {
        const key = rsCellStorageKey(rowKey, dc.iso);
        const c = (cells[key] || '').trim();
        const isShowDay = dc.highlight && hlShow;
        const isOff = isRunningScheduleOffDayColumn(dc, allDateCols, rsConfig.showOffDays);
        let cellClass = 'rs-cell rs-data-cell';
        if (isShowDay) cellClass += ' show-day';
        if (isOff) cellClass += ' off-day';
        if (rowClass) cellClass += ' ' + rowClass;
        if (c) cellClass += ' rs-has-content';
        const onclick = `onclick="openRunningScheduleCellModal('${eventId}','${rowKey}','${linkType}','${linkId}','${dc.iso}')"`;
        return `<div class="${cellClass}" ${onclick}>${c ? c : '<span class="rs-cell-placeholder"></span>'}</div>`;
      })
      .join('');
  }

  function renderShowDayNoteRow() {
    const showDateStr = rsMeta.showDate || ev.endDate;
    return dateCols
      .map((dc) => {
        const key = rsCellStorageKey('show_day', dc.iso);
        const raw = (cells[key] || '').trim();
        const isShowCol = dc.highlight && hlShow;
        const display = raw || (isShowCol ? 'Doors 6PM / Show 8PM' : '');
        const isShowDay = dc.highlight && hlShow;
        const isOff = isRunningScheduleOffDayColumn(dc, allDateCols, rsConfig.showOffDays);
        let cellClass = 'rs-cell rs-data-cell';
        if (isShowDay) cellClass += ' show-day';
        if (isOff) cellClass += ' off-day';
        if (raw) cellClass += ' rs-has-content';
        else if (isShowCol && display) cellClass += ' rs-default-show-day';
        const onclick = `onclick="openRunningScheduleCellModal('${eventId}','show_day','note','','${dc.iso}')"`;
        return `<div class="${cellClass}" ${onclick}>${display || '<span class="rs-cell-placeholder"></span>'}</div>`;
      })
      .join('');
  }

  const secs = rsConfig.sections;

  if (!dateCols.length) {
    return `<div class="ep-section" style="margin:16px;"><p style="font-size:13px;color:var(--text-tertiary);margin:0;">Set valid start and end dates on this event to build the running schedule grid.</p></div>`;
  }

  return `
    <div class="rs-grid ${compact ? 'rs-compact' : ''}" style="grid-template-columns: 140px repeat(${dateCols.length}, minmax(${compact ? '70px' : '90px'}, 1fr));">
      <div class="rs-cell rs-header rs-corner"></div>
      ${dateCols
        .map(
          (dc) =>
            `<div class="rs-cell rs-header rs-date-header ${dc.highlight && hlShow ? 'show-day' : ''} ${isRunningScheduleOffDayColumn(dc, allDateCols, rsConfig.showOffDays) ? 'off-day' : ''}">${dc.d}<br><span style="font-weight:400;opacity:0.7;">${dc.day}</span></div>`,
        )
        .join('')}

      <div class="rs-cell rs-header rs-corner" style="font-size:9px;">PHASE</div>
      ${dateCols
        .map(
          (dc) =>
            `<div class="rs-cell rs-phase-cell ${dc.highlight && hlShow ? 'show-day' : ''} ${isRunningScheduleOffDayColumn(dc, allDateCols, rsConfig.showOffDays) ? 'off-day' : ''}">${dc.phase || ''}</div>`,
        )
        .join('')}

      ${secs.departments.visible
        ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">DEPARTMENTS</div>
        ${deptRows
          .map(
            (row) => `
          <div class="rs-cell rs-row-label rs-clickable" onclick="openRSCellDetail('${row.linkType}','${row.linkId}','','')"><span class="rs-dept-dot" style="background:${DEPARTMENTS.find((d) => d.name === row.dept)?.color || '#666'};"></span>${row.label}</div>
          ${renderCells(row.key, '', row.linkType, row.linkId)}
        `,
          )
          .join('')}
      `
        : ''}

      ${secs.notes.visible
        ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">NOTES</div>
        <div class="rs-cell rs-row-label">Show Day</div>
        ${renderShowDayNoteRow()}
      `
        : ''}

      ${secs.trucks.visible
        ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">TRUCKS</div>
        ${truckRows
          .map(
            (row) => `
          <div class="rs-cell rs-row-label rs-clickable" onclick="openRSCellDetail('${row.linkType}','${row.linkId}','','')">${row.label}</div>
          ${renderCells(row.key, row.key === 'hotel' ? 'hotel-cell' : '', row.linkType, row.linkId)}
        `,
          )
          .join('')}
      `
        : ''}

      ${secs.flights.visible
        ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">FLIGHTS</div>
        ${flightRows
          .map(
            (row) => `
          <div class="rs-cell rs-row-label rs-clickable" onclick="openRSCellDetail('${row.linkType}','${row.linkId}','','')">${row.label}</div>
          ${renderCells(row.key, 'flight-cell', row.linkType, row.linkId)}
        `,
          )
          .join('')}
      `
        : ''}

      ${secs.crewTransport.visible
        ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">CREW TRANSPORT</div>
        ${transportRows
          .map(
            (row) => `
          <div class="rs-cell rs-row-label">${row.label}</div>
          ${renderCells(row.key, '', row.linkType, row.linkId)}
        `,
          )
          .join('')}
      `
        : ''}

      ${secs.logistics.visible
        ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">LOGISTICS</div>
        ${logisticsRows
          .map(
            (row) => `
          <div class="rs-cell rs-row-label">${row.label}</div>
          ${renderCells(row.key, '', row.linkType, row.linkId)}
        `,
          )
          .join('')}
      `
        : ''}
    </div>
  `;
}

// --- Cell detail deep-link modal ---
function openRSCellDetail(linkType, linkId, date, cellContent) {
  let title = '';
  let body = '';
  let footer = '';

  if (linkType === 'dept') {
    const dept = DEPARTMENTS.find((d) => d.id === linkId);
    const crewInDept = PERSONNEL.filter((p) => p.dept === linkId);
    title = (dept ? dept.name : 'Department') + (date ? ' — ' + date : '');
    body = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
        <div style="width:40px;height:40px;border-radius:50%;background:${dept ? dept.color : '#666'}30;color:${dept ? dept.color : '#666'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${dept ? dept.name.charAt(0) : '?'}</div>
        <div>
          <div style="font-size:15px;font-weight:700;">${dept ? dept.name : 'Unknown'} Department</div>
          <div style="font-size:12px;color:var(--text-tertiary);">${crewInDept.length} crew members</div>
        </div>
      </div>
      ${cellContent ? `<div class="form-section-title">Schedule Entry — ${date}</div>
      <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;">${cellContent}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">From running schedule cell</div>
      </div>` : ''}
      <div class="form-section-title">Assigned Crew</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${crewInDept
          .map(
            (p) => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-md);cursor:pointer;" onclick="closeModal();setTimeout(()=>openPersonnelDetail('${p.id}'),200)">
          <div style="width:28px;height:28px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;">${p.initials}</div>
          <div style="flex:1;"><div style="font-size:12px;font-weight:600;">${p.name}</div><div style="font-size:10px;color:var(--text-tertiary);">${p.role}</div></div>
          <div style="font-size:11px;color:var(--text-secondary);">${formatCurrency(p.rate)}/day</div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`,
          )
          .join('')}
      </div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="showToast('Opening department schedule','info');closeModal();">View Full Schedule</button>`;
  } else if (linkType === 'truck') {
    const truck = TRUCKS.find((t) => t.id === linkId);
    title = (truck ? truck.name : 'Truck') + (date ? ' — ' + date : '');
    body = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
        <div style="width:40px;height:40px;border-radius:8px;background:var(--accent-amber-muted);color:var(--accent-amber);display:flex;align-items:center;justify-content:center;font-size:20px;">${uiIcon('truck')}</div>
        <div>
          <div style="font-size:15px;font-weight:700;">${truck ? truck.name : 'Unknown'}</div>
          <div style="font-size:12px;color:var(--text-tertiary);">${truck ? truck.type : ''} · ${truck ? truck.location : ''}</div>
        </div>
      </div>
      ${cellContent ? `<div class="form-section-title">Route/Status — ${date}</div>
      <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;">${cellContent}</div>
      </div>` : ''}
      <div class="form-section-title">Truck Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Status</label><div style="font-size:13px;font-weight:500;">${truck ? truck.status.replace('_', ' ') : '—'}</div></div>
        <div class="form-group"><label class="form-label">Current Location</label><div style="font-size:13px;font-weight:500;">${truck ? truck.location : '—'}</div></div>
      </div>
      <div class="form-group"><label class="form-label">Route Notes</label><textarea class="form-textarea" placeholder="Add route details, driver assignment, load list...">${cellContent || ''}</textarea></div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="closeModal();setTimeout(()=>openTruckDetail('${linkId}'),200);">View Truck Detail</button>`;
  } else if (linkType === 'travel' || linkType === 'crew') {
    const person = linkType === 'crew' ? PERSONNEL.find((p) => p.id === linkId) : null;
    title = (person ? person.name : 'Travel') + (date ? ' — ' + date : '');
    body = `
      ${cellContent ? `<div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;">${cellContent}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${date}</div>
      </div>` : ''}
      <div class="form-section-title">Flight / Travel Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option>Flight</option><option>Self Drive</option><option>Van</option><option>Bus</option></select></div>
        <div class="form-group"><label class="form-label">Status</label><select class="form-select"><option>Booked</option><option>Confirmed</option><option>Pending</option></select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">From</label><input class="form-input" placeholder="City / Airport"></div>
        <div class="form-group"><label class="form-label">To</label><input class="form-input" placeholder="City / Airport"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Airline / Carrier</label><input class="form-input" placeholder="e.g. Delta"></div>
        <div class="form-group"><label class="form-label">Flight / Ref #</label><input class="form-input" placeholder="e.g. DL1247"></div>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Arrival time, pickup info...">${cellContent || ''}</textarea></div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="showToast('Travel record updated','success');closeModal();">Save Changes</button>`;
  } else if (linkType === 'hotel') {
    title = 'Hotel' + (date ? ' — ' + date : '');
    body = `
      ${cellContent ? `<div style="padding:12px;background:var(--accent-purple, #8b5cf6)10;border:1px solid var(--accent-purple, #8b5cf6)30;border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;color:var(--accent-purple, #8b5cf6);">${cellContent}</div>
      </div>` : ''}
      <div class="form-section-title">Hotel Information</div>
      <div class="form-group"><label class="form-label">Hotel Name</label><input class="form-input" value="Tru by Hilton Norco Eastvale"></div>
      <div class="form-group"><label class="form-label">Address</label><input class="form-input" value="3481 Hamner Ave, Norco, CA 92860"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Check-In Date</label><input type="date" class="form-input"></div>
        <div class="form-group"><label class="form-label">Check-Out Date</label><input type="date" class="form-input"></div>
      </div>
      <div class="form-group"><label class="form-label">Confirmation #</label><input class="form-input" placeholder="e.g. B6H4ES8"></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Group rate, room block info..."></textarea></div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="showToast('Hotel info updated','success');closeModal();">Save Changes</button>`;
  } else if (linkType === 'note') {
    title = 'Show day note' + (date ? ' — ' + date : '');
    body = `<p style="font-size:13px;color:var(--text-tertiary);margin:0 0 12px;">Edit this cell from the running schedule grid.</p>`;
    footer = `<button class="btn btn-primary" onclick="closeModal()">Close</button>`;
  } else {
    title = (cellContent || 'Cell') + (date ? ' — ' + date : '');
    body = `
      <div style="padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;">${cellContent || 'Empty cell'}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${date || 'No date'}</div>
      </div>
      <div class="form-group"><label class="form-label">Cell Content</label><textarea class="form-textarea">${cellContent || ''}</textarea></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Additional details..."></textarea></div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="showToast('Updated','success');closeModal();">Save</button>`;
  }

  openModal(title, body, footer);
}

// --- Daily Schedule: renderDailySchedule is defined in daily-schedule.js (loaded after this file).
// --- Crew List + Radios: renderEventCrewList / renderRadiosTab are in event-paperwork.js (loaded after daily-schedule.js).
