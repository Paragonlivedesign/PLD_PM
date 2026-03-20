function renderRunningSchedule() {
  const ev = EVENTS.find(e => e.id === 'e5');
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
            ${EVENTS.filter(e => e.phase !== 'archived' && e.phase !== 'settled' && e.id !== ev.id).map(e => `<option>${e.name}</option>`).join('')}
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
        ${rsSettingsOpen ? renderRSSettingsPanel() : ''}
      </div>
    </div>
  `;
}

function renderRSSettingsPanel() {
  const secs = rsConfig.sections;
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
      { key: 'stage', label: 'Stage' }, { key: 'rigging', label: 'Rigging' },
      { key: 'audio', label: 'Audio' }, { key: 'a2', label: 'A2' },
      { key: 'cameras', label: 'Cameras' }, { key: 'led', label: 'LED' },
      { key: 'delays', label: 'Delays' },
    ],
    trucks: [
      { key: 's7aud', label: 'S7 AUD' }, { key: 's7lxled', label: 'S7 LX/LED' },
      { key: 's7rigdelay', label: 'S7 RIG/Delay' }, { key: 'j6truck', label: 'J6 Truck' },
      { key: 'hotel', label: 'Hotel' },
    ],
    flights: [
      { key: 'flights', label: 'Flights' },
    ],
    crewTransport: [
      { key: 'van1', label: 'Van 1 LX' }, { key: 'van2', label: 'Van 2 AUDIO/VX' },
      { key: 'personalVehicle', label: 'Personal Vehicle' }, { key: 'localCrew', label: 'Local Crew' },
    ],
    logistics: [
      { key: 'warehouse', label: 'Warehouse' }, { key: 'truck', label: 'Truck' },
      { key: 'callTime', label: 'Call Time' }, { key: 'drive', label: 'Drive' },
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
          <span>Show off/empty days</span>
        </label>
        <label class="rss-check-row">
          <input type="checkbox" ${rsConfig.showEmptyCols ? 'checked' : ''} onchange="rsConfig.showEmptyCols=this.checked;renderPage(currentPage);">
          <span>Show empty columns</span>
        </label>
        <label class="rss-check-row">
          <input type="checkbox" ${rsConfig.compactMode ? 'checked' : ''} onchange="rsConfig.compactMode=this.checked;renderPage(currentPage);">
          <span>Compact mode</span>
        </label>
      </div>

      <!-- Sections -->
      <div class="rss-section">
        <div class="rss-section-title">Sections</div>
        ${Object.entries(secs).map(([key, sec]) => `
          ${sectionToggle(key, sec)}
          <div class="rss-row-list" id="rss-rows-${key}" style="display:none;">
            ${(rowsBySection[key] || []).map(r => `
              <label class="rss-check-row rss-indent">
                <input type="checkbox" ${rsConfig.rows[r.key] ? 'checked' : ''} onchange="rsConfig.rows['${r.key}']=this.checked;renderPage(currentPage);">
                <span>${r.label}</span>
              </label>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <!-- Add Row -->
      <div class="rss-section">
        <div class="rss-section-title">Custom Rows</div>
        <button class="btn btn-secondary btn-sm" style="width:100%;" onclick="openAddCustomRowModal()">+ Add Custom Row</button>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;" onclick="openAddCustomSectionModal()">+ Add Section</button>
      </div>

      <!-- Date Range -->
      <div class="rss-section">
        <div class="rss-section-title">Date Range</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:10px;">Start</label><input type="date" class="form-input" value="2026-02-23" style="font-size:11px;padding:4px 8px;"></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:10px;">End</label><input type="date" class="form-input" value="2026-03-12" style="font-size:11px;padding:4px 8px;"></div>
        </div>
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
  Object.keys(rsConfig.rows).forEach(k => rsConfig.rows[k] = true);
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
  const allDateCols = [
    { d: 'Feb 23', day: 'Mon', phase: '' },
    { d: 'Feb 24', day: 'Tue', phase: '' },
    { d: 'Feb 25', day: 'Wed', phase: '' },
    { d: 'Feb 26', day: 'Thu', phase: 'off' },
    { d: 'Feb 27', day: 'Fri', phase: 'off' },
    { d: 'Feb 28', day: 'Sat', phase: '' },
    { d: 'Mar 1', day: 'Sun', phase: 'Shop Prep' },
    { d: 'Mar 2', day: 'Mon', phase: 'Prep/Load' },
    { d: 'Mar 3', day: 'Tue', phase: 'Travel' },
    { d: 'Mar 4', day: 'Wed', phase: 'Load In' },
    { d: 'Mar 5', day: 'Thu', phase: 'Load In' },
    { d: 'Mar 6', day: 'Fri', phase: 'Rehearsal' },
    { d: 'Mar 7', day: 'Sat', phase: 'SHOW', highlight: true },
    { d: 'Mar 8', day: 'Sun', phase: 'Load Out' },
    { d: 'Mar 9', day: 'Mon', phase: 'Travel/Rtg' },
    { d: 'Mar 10', day: 'Tue', phase: 'Hold' },
    { d: 'Mar 11', day: 'Wed', phase: 'Hold' },
    { d: 'Mar 12', day: 'Thu', phase: 'Hold' },
  ];

  const dateCols = rsConfig.showOffDays ? allDateCols : allDateCols.filter(dc => dc.phase !== 'off');
  const compact = rsConfig.compactMode;
  const hlShow = rsConfig.highlightShowDay;

  const allDeptRows = [
    { key: 'stage', label: 'Stage', dept: 'Staging', linkType: 'dept', linkId: 'd4', cells: ['','','','','','','LX Prep','Placement Start','','Pre-rig 10am','','','10:00 PM','','8:00 AM','','',''] },
    { key: 'rigging', label: 'Rigging', dept: 'Rigging', linkType: 'dept', linkId: 'd7', cells: ['','','','','','','','','','Pre-rig 10am','','','10:00 PM','','8:00 AM','','',''] },
    { key: 'audio', label: 'Audio', dept: 'Audio', linkType: 'dept', linkId: 'd1', cells: ['','PA Prep','','','','','','','6:30 AM','10:00 PM','10:00 PM','9:00 AM','10:00 PM','','8:00 AM','','',''] },
    { key: 'a2', label: 'A2', dept: 'Audio', linkType: 'crew', linkId: 'p2', cells: ['','','','','','','','Travel Day','6:30 AM','10:00 PM','10:00 PM','9:00 AM','10:00 PM','','8:00 AM','','',''] },
    { key: 'cameras', label: 'Cameras', dept: 'Video', linkType: 'dept', linkId: 'd2', cells: ['','','','','','','','Travel Day','Load In 9am','10:00 PM','10:00 PM','10:00 PM','10:00 PM','','','','',''] },
    { key: 'led', label: 'LED', dept: 'Lighting', linkType: 'dept', linkId: 'd3', cells: ['','','','','','','','','8:00 AM Video Builders','','','','10:00 PM','','','','',''] },
    { key: 'delays', label: 'Delays', dept: 'Audio', linkType: 'dept', linkId: 'd1', cells: ['','','','','','','','','Build/Hang - 10am','','','','','','','','',''] },
  ];

  const allTruckRows = [
    { key: 's7aud', label: 'S7 AUD', linkType: 'truck', linkId: 't1', cells: ['','','','','','','','PHX to venue 9am','PHX to venue 9am','','','Arrive 8am','storage full','storage full','storage full','storage full','storage full','RE prep'] },
    { key: 's7lxled', label: 'S7 LX/LED', linkType: 'truck', linkId: 't3', cells: ['','','','','','','','PHX to venue 9am','','','','Arrive 8am','storage full','storage full','storage full','storage full','storage full',''] },
    { key: 's7rigdelay', label: 'S7 RIG/Delay', linkType: 'truck', linkId: 't5', cells: ['','','','','','PHX to venue','9am','','','Arrive 8am','','','','','','','',''] },
    { key: 'j6truck', label: 'J6 Truck', linkType: 'truck', linkId: 't6', cells: ['','','','','Pick Up / FT LED 9AM','','','','','','','','','','','','','Load'] },
    { key: 'hotel', label: 'Hotel', linkType: 'hotel', linkId: 'hotel', cells: ['','','','','','','','Check in LX/VIDEO','','Check in: All','','','','','','','',''] },
  ];

  const allFlightRows = [
    { key: 'flights', label: 'Flights', linkType: 'travel', linkId: 'tr1', cells: ['','','','','','','','Cody/Tia land: 9am','OUT','','','','','','','','','Cody/Tia land:'] },
  ];

  const allTransportRows = [
    { key: 'van1', label: 'Van 1 LX', linkType: 'transport', linkId: 'van1', cells: ['','','','','','','','','Depart from Camping #223 V. Sullivan Rd, Phoenix AZ 85013','','','','','','','','',''] },
    { key: 'van2', label: 'Van 2 AUDIO/VX', linkType: 'transport', linkId: 'van2', cells: ['','','','','','','','','Van—Depart from Chandong 4105 W. Buckeye Rd. Phoenix AZ 85009','','','','','','','','',''] },
    { key: 'personalVehicle', label: 'Personal Vehicle', linkType: 'transport', linkId: 'pv', cells: ['','','','','','','','','Levi, Max','','','','','','','','',''] },
    { key: 'localCrew', label: 'Local Crew', linkType: 'transport', linkId: 'lc', cells: ['','','','','','','','','','','','','','','','','',''] },
  ];

  const allLogisticsRows = [
    { key: 'warehouse', label: 'Warehouse', linkType: 'logistics', linkId: 'wh', cells: ['','','','','','','','','','','','','','','','','',''] },
    { key: 'truck', label: 'Truck', linkType: 'logistics', linkId: 'tk', cells: ['','','','','','','','','','','','','','','','','',''] },
    { key: 'callTime', label: 'Call Time', linkType: 'logistics', linkId: 'ct', cells: ['','','','','','','','','','','','','','','','','',''] },
    { key: 'drive', label: 'Drive', linkType: 'logistics', linkId: 'dr', cells: ['','','','','','','','','','','','','','','','','',''] },
    { key: 'detail', label: 'Detail', linkType: 'logistics', linkId: 'dt', cells: ['','','','','','','','','','','','','','','','','',''] },
  ];

  const deptRows = allDeptRows.filter(r => rsConfig.rows[r.key]);
  const truckRows = allTruckRows.filter(r => rsConfig.rows[r.key]);
  const flightRows = allFlightRows.filter(r => rsConfig.rows[r.key]);
  const transportRows = allTransportRows.filter(r => rsConfig.rows[r.key]);
  const logisticsRows = allLogisticsRows.filter(r => rsConfig.rows[r.key]);

  function filterCells(cells) {
    if (rsConfig.showOffDays) return cells;
    return cells.filter((_, i) => allDateCols[i].phase !== 'off');
  }

  function renderCells(cells, rowClass, linkType, linkId) {
    const filtered = filterCells(cells);
    return filtered.map((c, i) => {
      const dc = dateCols[i];
      const isShowDay = dc && dc.highlight && hlShow;
      const isOff = dc && dc.phase === 'off';
      let cellClass = 'rs-cell';
      if (isShowDay && c) cellClass += ' show-day';
      if (isOff) cellClass += ' off-day';
      if (rowClass) cellClass += ' ' + rowClass;
      if (c) cellClass += ' rs-clickable';
      const onclick = c ? `onclick="openRSCellDetail('${linkType}','${linkId}','${dc.d}','${c.replace(/'/g, "\\'")}')"` : '';
      return `<div class="${cellClass}" ${onclick}>${c || ''}</div>`;
    }).join('');
  }

  const secs = rsConfig.sections;

  return `
    <div class="rs-grid ${compact ? 'rs-compact' : ''}" style="grid-template-columns: 140px repeat(${dateCols.length}, minmax(${compact ? '70px' : '90px'}, 1fr));">
      <div class="rs-cell rs-header rs-corner"></div>
      ${dateCols.map(dc => `<div class="rs-cell rs-header rs-date-header ${dc.highlight && hlShow ? 'show-day' : ''} ${dc.phase === 'off' ? 'off-day' : ''}">${dc.d}<br><span style="font-weight:400;opacity:0.7;">${dc.day}</span></div>`).join('')}

      <div class="rs-cell rs-header rs-corner" style="font-size:9px;">PHASE</div>
      ${dateCols.map(dc => `<div class="rs-cell rs-phase-cell ${dc.highlight && hlShow ? 'show-day' : ''} ${dc.phase === 'off' ? 'off-day' : ''}">${dc.phase || ''}</div>`).join('')}

      ${secs.departments.visible ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">DEPARTMENTS</div>
        ${deptRows.map(row => `
          <div class="rs-cell rs-row-label rs-clickable" onclick="openRSCellDetail('${row.linkType}','${row.linkId}','','')"><span class="rs-dept-dot" style="background:${DEPARTMENTS.find(d => d.name === row.dept)?.color || '#666'};"></span>${row.label}</div>
          ${renderCells(row.cells, '', row.linkType, row.linkId)}
        `).join('')}
      ` : ''}

      ${secs.notes.visible ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">NOTES</div>
        <div class="rs-cell rs-row-label">Show Day</div>
        ${dateCols.map((dc, i) => `<div class="rs-cell ${dc.highlight && hlShow ? 'show-day' : ''} ${filterCells(allDeptRows[0].cells)[i] === undefined ? '' : ''}">${(rsConfig.showOffDays ? i : -1) === 12 || (!rsConfig.showOffDays && dc.phase === 'SHOW') ? 'Doors 6PM / Show 8PM' : ''}</div>`).join('')}
      ` : ''}

      ${secs.trucks.visible ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">TRUCKS</div>
        ${truckRows.map(row => `
          <div class="rs-cell rs-row-label rs-clickable" onclick="openRSCellDetail('${row.linkType}','${row.linkId}','','')">${row.label}</div>
          ${renderCells(row.cells, row.key === 'hotel' ? 'hotel-cell' : '', row.linkType, row.linkId)}
        `).join('')}
      ` : ''}

      ${secs.flights.visible ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">FLIGHTS</div>
        ${flightRows.map(row => `
          <div class="rs-cell rs-row-label rs-clickable" onclick="openRSCellDetail('${row.linkType}','${row.linkId}','','')">${row.label}</div>
          ${renderCells(row.cells, 'flight-cell', row.linkType, row.linkId)}
        `).join('')}
      ` : ''}

      ${secs.crewTransport.visible ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">CREW TRANSPORT</div>
        ${transportRows.map(row => `
          <div class="rs-cell rs-row-label">${row.label}</div>
          ${renderCells(row.cells, '', row.linkType, row.linkId)}
        `).join('')}
      ` : ''}

      ${secs.logistics.visible ? `
        <div class="rs-cell rs-section-label" style="grid-column: 1 / -1;">LOGISTICS</div>
        ${logisticsRows.map(row => `
          <div class="rs-cell rs-row-label">${row.label}</div>
          ${renderCells(row.cells, '', row.linkType, row.linkId)}
        `).join('')}
      ` : ''}
    </div>
  `;
}

// --- Cell detail deep-link modal ---
function openRSCellDetail(linkType, linkId, date, cellContent) {
  let title = '';
  let body = '';
  let footer = '';

  if (linkType === 'dept') {
    const dept = DEPARTMENTS.find(d => d.id === linkId);
    const crewInDept = PERSONNEL.filter(p => p.dept === linkId);
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
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Click to edit this entry</div>
      </div>` : ''}
      <div class="form-section-title">Assigned Crew</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${crewInDept.map(p => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-md);cursor:pointer;" onclick="closeModal();setTimeout(()=>openPersonnelDetail('${p.id}'),200)">
          <div style="width:28px;height:28px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;">${p.initials}</div>
          <div style="flex:1;"><div style="font-size:12px;font-weight:600;">${p.name}</div><div style="font-size:10px;color:var(--text-tertiary);">${p.role}</div></div>
          <div style="font-size:11px;color:var(--text-secondary);">${formatCurrency(p.rate)}/day</div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`).join('')}
      </div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="showToast('Opening department schedule','info');closeModal();">View Full Schedule</button>`;

  } else if (linkType === 'truck') {
    const truck = TRUCKS.find(t => t.id === linkId);
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
        <div class="form-group"><label class="form-label">Status</label><div style="font-size:13px;font-weight:500;">${truck ? truck.status.replace('_',' ') : '—'}</div></div>
        <div class="form-group"><label class="form-label">Current Location</label><div style="font-size:13px;font-weight:500;">${truck ? truck.location : '—'}</div></div>
      </div>
      <div class="form-group"><label class="form-label">Route Notes</label><textarea class="form-textarea" placeholder="Add route details, driver assignment, load list...">${cellContent || ''}</textarea></div>
    `;
    footer = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="closeModal();setTimeout(()=>openTruckDetail('${linkId}'),200);">View Truck Detail</button>`;

  } else if (linkType === 'travel' || linkType === 'crew') {
    const person = linkType === 'crew' ? PERSONNEL.find(p => p.id === linkId) : null;
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

// --- Daily Schedule (Call Sheet / Show Paperwork) ---
function renderDailySchedule(ev, venue, client) {
  const days = [
    {
      date: 'Sunday 3/1', title: 'Shop Prep — Lighting', showDay: false,
      rows: [
        { start: '8:30 AM', end: '', location: 'PHX Shop', dept: 'Lighting', action: 'CREW CALL', notes: '', truck: false },
        { start: '8:00 AM', end: '', location: '', dept: '', action: '', notes: '', truck: false },
      ]
    },
    {
      date: 'Monday 3/2', title: 'Shop Prep Continued', showDay: false,
      rows: [
        { start: '8:30 AM', end: '', location: 'PHX Shop', dept: 'Lighting', action: 'CREW CALL', notes: '', truck: false },
        { start: '8:30 AM', end: '', location: 'PHX Shop', dept: 'Audio', action: 'CREW CALL', notes: '', truck: false },
        { start: '8:00 AM', end: '', location: '', dept: '', action: '', notes: '', truck: false },
      ]
    },
    {
      date: 'Tuesday 3/3', title: 'Norco — Place Stage & PHX Shop Prep', showDay: false,
      rows: [
        { start: '8:00 AM', end: '5:00 PM', location: 'Stage Build', dept: 'Stage Hands', action: 'CREW CALL — LOAD IN', notes: '8 Stage Hands + 1 Fork', truck: false },
        { start: '8:30 AM', end: '', location: 'PHX Shop', dept: 'SOUND IMAGE — Trucking', action: '1x 53\' Semi — Pre Rigging / Delay Towers', notes: 'Loaded and rolling in AM', truck: true },
        { start: '8:00 AM', end: '', location: '', dept: '', action: '', notes: '', truck: false },
      ]
    },
    {
      date: 'Wednesday 3/4', title: 'Stage Build & Pre-rig / Lighting Crew Travel Day', showDay: false,
      rows: [
        { start: '8:00 AM', end: '5:00 PM', location: 'Stage Build', dept: 'Stage Hands', action: 'CREW CALL — LOAD IN', notes: '', truck: false },
        { start: '11:00 AM', end: '5:00 PM', location: 'Stage 1', dept: 'SOUND IMAGE — Trucking', action: '1x 53\' Semi — Pre Rigging w/ Delay Towers', notes: 'Delivery to NORCO', truck: true },
        { start: '11:00 AM', end: '5:00 PM', location: 'Stage 1', dept: 'SOUND IMAGE — Rigging', action: 'CREW CALL — LOAD IN', notes: '8 Stage Hands + 1 Fork', truck: false },
        { start: '12:00 PM', end: '', location: 'TBD', dept: '', action: '', notes: 'Place Trailers', truck: false },
      ]
    },
    {
      date: 'Thursday 3/5', title: 'Lighting & Video Load In / Audio Travel Day', showDay: false,
      rows: [
        { start: '8:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE — Lighting', action: '1x 53\' Semi — Lighting', notes: 'Delivery to NORCO', truck: true },
        { start: '8:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE — Lighting', action: 'CREW CALL', notes: 'Lighting Vendor Leads', truck: false },
        { start: '8:00 AM', end: '', location: 'Stage 1', dept: 'Stage Hands — Lighting', action: 'CREW CALL', notes: '14 Stage Hands + 2 Fork Op', truck: false },
        { start: '8:30 AM', end: '', location: 'PHX Shop', dept: 'SOUND IMAGE — Trucking', action: '1x 53\' Semi — Audio', notes: 'Loaded and rolling in AM', truck: true },
        { start: '10:00 AM', end: '', location: 'PHX Shop', dept: 'SOUND IMAGE — Audio Travel', action: '', notes: '', truck: false },
        { start: '10:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE — Video', action: 'CREW CALL', notes: 'LED Load In', truck: false },
        { start: '10:00 AM', end: '', location: 'Structures', dept: 'SOUND IMAGE — Delay Tower', action: 'CREW CALL', notes: 'Audio Vendor Leads', truck: false },
        { start: '10:00 AM', end: '', location: 'Structures', dept: 'Stage Hands — Delay Tower', action: 'CREW CALL', notes: '8 Stage Hands + 1 Fork Op', truck: false },
      ]
    },
    {
      date: 'Friday 3/6', title: 'Production Load In Continued — Audio', showDay: false,
      rows: [
        { start: '8:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE — Audio Load', action: 'CREW CALL', notes: 'Audio Leads', truck: false },
        { start: '8:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE — Trucking', action: '1x 53\' Semi — Audio', notes: 'Deliver to NORCO', truck: true },
        { start: '8:00 AM', end: '', location: '', dept: 'SOUND IMAGE — Lighting', action: 'CREW CALL', notes: '', truck: false },
        { start: '12:00 PM', end: '', location: 'Delays', dept: 'US Film & Production — Trucking', action: 'CREW CALL', notes: 'Park and place video delay trailers', truck: false },
      ]
    },
    {
      date: 'Saturday 3/7', title: 'Show Day', showDay: true,
      rows: [
        { start: '7:00 AM', end: '12:00 AM', location: 'Stage 1', dept: 'SOUND IMAGE — All Departments', action: 'CREW CALL', notes: '', truck: false },
        { start: '7:00 AM', end: '12:00 PM', location: 'Stage 1', dept: 'Stagehands', action: 'CREW CALL', notes: '', truck: false },
        { start: '7:00 AM', end: '12:00 AM', location: 'Stage 1', dept: 'Stagehands', action: 'CREW CALL', notes: '8 Stagehands — Show (2 Shifts)', truck: false },
        { start: '6:30 AM', end: '12:00 AM', location: 'Stage 1', dept: 'Stagehands', action: 'CREW CALL', notes: '4 Stagehands — Spot Ops + Strike', truck: false },
      ]
    },
    {
      date: 'Sunday 3/8', title: 'Load Out', showDay: false,
      rows: [
        { start: '9:00 AM', end: '2:00 PM', location: 'Stage 1', dept: 'SOUND IMAGE — All Departments', action: 'CREW CALL — LOAD OUT', notes: '', truck: false },
        { start: '9:00 AM', end: '2:00 PM', location: 'Stage 1', dept: 'Stagehands', action: 'CREW CALL — LOAD OUT', notes: '', truck: false },
        { start: '10:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE', action: '(1) 53\' Semi — Audio', notes: 'Pick Up Norco', truck: true },
        { start: '10:00 AM', end: '', location: 'Stage 1', dept: 'SOUND IMAGE', action: '(1) 53\' Semi — Lighting / Video', notes: 'Pick Up Norco', truck: true },
        { start: '10:00 AM', end: '', location: 'Structures', dept: 'SOUND IMAGE', action: '(1) 53\' Semi — Rigging / Delay Tower', notes: 'Pick Up Norco', truck: true },
      ]
    },
    {
      date: 'Monday 3/9', title: 'Travel Day', showDay: false,
      rows: []
    },
  ];

  return `
    <div class="ds-container">
      <!-- Column Headers -->
      <div class="ds-header-row">
        <div class="ds-col ds-col-start">Start</div>
        <div class="ds-col ds-col-end">End</div>
        <div class="ds-col ds-col-location">Location</div>
        <div class="ds-col ds-col-dept">Department</div>
        <div class="ds-col ds-col-action">Action and Details</div>
        <div class="ds-col ds-col-notes">Notes</div>
      </div>

      ${days.map(day => `
        <div class="ds-day-header ${day.showDay ? 'show-day' : ''}">${day.date} ${day.title}</div>
        ${day.rows.length === 0 ? '<div class="ds-empty-day"></div>' : day.rows.map(row => `
          <div class="ds-row ${day.showDay ? 'show-day-row' : ''} ${row.truck ? 'truck-row' : ''}">
            <div class="ds-col ds-col-start">${row.start}</div>
            <div class="ds-col ds-col-end">${row.end}</div>
            <div class="ds-col ds-col-location">${row.location}</div>
            <div class="ds-col ds-col-dept">${row.dept}</div>
            <div class="ds-col ds-col-action">${row.action}</div>
            <div class="ds-col ds-col-notes">${row.notes}</div>
          </div>
        `).join('')}
      `).join('')}
    </div>
  `;
}

// --- Event Crew List ---
function renderEventCrewList(ev, venue, client) {
  const crewData = [
    { num: 1, name: 'Charly Brems', position: 'Production Coordinator — Load In', phone: '602-380-1151', email: 'cbrems@clairglobal.com', checkIn: '3/4/2026', checkOut: '3/7/2026', confirm: 'B6H4ES8', van: true, fly: false, drive: false },
    { num: 2, name: 'Cody Lisle', position: 'Production Coordinator — Show', phone: '520-870-1988', email: 'clisle@clairglobal.com', checkIn: '3/4/2026', checkOut: '3/9/2026', confirm: 'DG0EPTX', van: false, fly: true, drive: false },
    { num: 3, name: 'Bryan Leno', position: 'Audio — System Engineer', phone: '623-285-9948', email: 'bleno@clairglobal.com', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '', van: true, fly: false, drive: false },
    { num: 4, name: 'Aharon Lund', position: 'Audio — Monitor Engineer', phone: '520-668-2965', email: 'eaaronlund@gmail.com', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '', van: true, fly: false, drive: false },
    { num: 5, name: 'TBD', position: 'Audio — Patch', phone: '', email: '', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '', van: true, fly: false, drive: false },
    { num: 0, name: '', position: '', phone: '', email: '', checkIn: '', checkOut: '', confirm: '', van: false, fly: false, drive: false },
    { num: 7, name: 'Max Ferreyra', position: 'Lighting — LD/L1', phone: '407-404-9036', email: 'mfiksm@gmail.com', checkIn: '3/4/2026', checkOut: '3/9/2026', confirm: 'PAEJOML', van: false, fly: true, drive: false },
    { num: 8, name: 'Matthew Marqulis', position: 'Lighting — L2', phone: '314-640-5636', email: 'reddletproductions@gmail.com', checkIn: '3/4/2026', checkOut: '3/9/2026', confirm: 'P50QXW2', van: false, fly: true, drive: false },
    { num: 0, name: '', position: '', phone: '', email: '', checkIn: '', checkOut: '', confirm: '', van: false, fly: false, drive: false },
    { num: 9, name: 'Tia Purcell', position: 'Video — TD', phone: '518-429-8365', email: 'TPurcell@Clairglobal.com', checkIn: '3/4/2026', checkOut: '3/9/2026', confirm: 'DG0EPTX', van: false, fly: true, drive: false },
    { num: 10, name: 'Levi Elzgas', position: 'Video — V1/PTZ Operator', phone: '480-773-1753', email: 'levielzgas81@gmail.com', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '1ZGBA8T', van: false, fly: false, drive: true },
    { num: 11, name: 'Eric Adams', position: 'Video — FOH 1', phone: '623-273-4109', email: 'eadamserit136@gmail.com', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '', van: false, fly: false, drive: true },
    { num: 12, name: 'Jacob Long', position: 'Video — FOH 2', phone: '623-633-1786', email: 'jakelong200@gmail.com', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '', van: false, fly: false, drive: true },
    { num: 13, name: 'Julian Green', position: 'Video — PIT SR', phone: '817-879-6741', email: 'CobraStarGreen20@gmail.com', checkIn: '3/5/2026', checkOut: '3/9/2026', confirm: '', van: false, fly: false, drive: true },
    { num: 14, name: 'Shane Lloyd', position: 'LED tech/Video — PIT SL', phone: '602-688-3565', email: 'shane.print@gmail.com', checkIn: '3/4/2026', checkOut: '3/9/2026', confirm: 'UJW9PET', van: false, fly: true, drive: false },
    { num: 15, name: 'Randy Stearman', position: 'LED tech Lead', phone: '480-236-5110', email: 'r.stearman@gmail.com', checkIn: '3/4/2026', checkOut: '3/9/2026', confirm: '1ZGBA8T', van: false, fly: false, drive: true },
  ];

  function checkIcon(val) {
    return val ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  }

  return `
    <div class="cl-container">
      <!-- Crew List Title -->
      <div class="cl-title-bar">
        <h3 style="margin:0;font-size:15px;font-weight:700;">Boots in the Park — Norco Crew List</h3>
      </div>

      <!-- Crew Roster Table -->
      <div class="cl-table-wrap">
        <table class="cl-table">
          <thead>
            <tr>
              <th class="cl-th-num">#</th>
              <th class="cl-th-name">Name</th>
              <th class="cl-th-pos">Position</th>
              <th class="cl-th-phone">Phone</th>
              <th class="cl-th-email">Email</th>
              <th class="cl-th-hotel" colspan="2">HOTEL</th>
              <th class="cl-th-confirm">Confirmation #</th>
              <th class="cl-th-transport" colspan="3">TRANSPORTATION</th>
            </tr>
            <tr class="cl-subheader">
              <th></th><th></th><th></th><th></th><th></th>
              <th>Check In</th><th>Check Out</th><th></th>
              <th>Van</th><th>Flying</th><th>Driving</th>
            </tr>
          </thead>
          <tbody>
            ${crewData.map(c => c.num === 0
              ? `<tr class="cl-separator"><td colspan="11"></td></tr>`
              : `<tr class="cl-row">
                  <td class="cl-num">${c.num}</td>
                  <td class="cl-name">${c.name}</td>
                  <td class="cl-pos">${c.position}</td>
                  <td class="cl-phone">${c.phone}</td>
                  <td class="cl-email">${c.email}</td>
                  <td class="cl-date">${c.checkIn}</td>
                  <td class="cl-date">${c.checkOut}</td>
                  <td class="cl-confirm">${c.confirm}</td>
                  <td class="cl-check">${checkIcon(c.van)}</td>
                  <td class="cl-check">${checkIcon(c.fly)}</td>
                  <td class="cl-check">${checkIcon(c.drive)}</td>
                </tr>`
            ).join('')}
          </tbody>
        </table>
      </div>

      <!-- Reference Info Section -->
      <div class="cl-reference-section">
        <div class="cl-ref-grid">
          <div class="cl-ref-card">
            <div class="cl-ref-title">Hotel Information</div>
            <div class="cl-ref-name">Tru by Hilton Norco Eastvale</div>
            <div class="cl-ref-detail">3481 Hamner Ave, Norco, CA 92860</div>
            <div class="cl-ref-meta">
              <span>Self-parking</span>
              <span>Breakfast included</span>
            </div>
            <a href="#" class="cl-ref-link" onclick="event.preventDefault();showToast('Opening hotel map','info')">HOTEL MAP LINK</a>
          </div>
          <div class="cl-ref-card">
            <div class="cl-ref-title">Venue Information</div>
            <div class="cl-ref-name">Silverlakes Equestrian and Sports Park</div>
            <div class="cl-ref-detail">5555 Hamner Ave, Norco, CA 92860</div>
            <div class="cl-ref-meta">
              <span>Min. drive from hotel</span>
            </div>
            <a href="#" class="cl-ref-link" onclick="event.preventDefault();showToast('Opening venue map','info')">VENUE MAP LINK</a>
          </div>
          <div class="cl-ref-card">
            <div class="cl-ref-title">Nearest Coin Op / Wash and Fold</div>
            <div class="cl-ref-name">Casper Convenient Cleaners</div>
            <div class="cl-ref-detail">2666 Hamner Ave, Norco, CA 92860</div>
            <a href="#" class="cl-ref-link" onclick="event.preventDefault();showToast('Opening map','info')">MAP LINK</a>
          </div>
          <div class="cl-ref-card">
            <div class="cl-ref-title">Emergency Room / Urgent Care</div>
            <div class="cl-ref-name">—</div>
            <div class="cl-ref-detail">Address TBD</div>
            <div class="cl-ref-meta"><span>Phone: —</span></div>
          </div>
        </div>
        <div class="cl-ref-grid" style="margin-top:12px;">
          <div class="cl-ref-card">
            <div class="cl-ref-title">Nearest Airport: SNA</div>
            <div class="cl-ref-name">John Wayne Airport</div>
            <div class="cl-ref-detail">18601 Airport Way, Santa Ana, CA 92707</div>
            <a href="#" class="cl-ref-link" onclick="event.preventDefault();showToast('Opening map','info')">MAP LINK</a>
          </div>
          <div class="cl-ref-card">
            <div class="cl-ref-title">Nearest Airport: ONT</div>
            <div class="cl-ref-name">Ontario International Airport</div>
            <div class="cl-ref-detail">International Arrivals Terminal, International Wy, Ontario, CA 91761</div>
            <a href="#" class="cl-ref-link" onclick="event.preventDefault();showToast('Opening map','info')">MAP LINK</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- Radios Tab ---
function renderRadiosTab(ev) {
  const channels = [
    { ch: '1', label: 'Production', color: '#ef4444' },
    { ch: '2', label: 'Audio', color: '#3b82f6' },
    { ch: '3', label: 'Lighting', color: '#f59e0b' },
    { ch: '4', label: 'Video', color: '#8b5cf6' },
    { ch: '5', label: 'Stage / Rigging', color: '#22c55e' },
    { ch: '6', label: 'Trucking / Transport', color: '#ec4899' },
    { ch: '7', label: 'Security', color: '#06b6d4' },
    { ch: '8', label: 'Emergency', color: '#f97316' },
  ];

  const radioAssignments = [
    { name: 'Charly Brems', role: 'Production Coordinator — Load In', dept: 'Production', ch1: '1', ch2: '5', radioId: 'R-101', radioType: 'Motorola CP200d' },
    { name: 'Cody Lisle', role: 'Production Coordinator — Show', dept: 'Production', ch1: '1', ch2: '2', radioId: 'R-102', radioType: 'Motorola CP200d' },
    { name: 'Bryan Leno', role: 'Audio — System Engineer', dept: 'Audio', ch1: '2', ch2: '1', radioId: 'R-201', radioType: 'Motorola CP200d' },
    { name: 'Aharon Lund', role: 'Audio — Monitor Engineer', dept: 'Audio', ch1: '2', ch2: '', radioId: 'R-202', radioType: 'Motorola CP200d' },
    { name: 'TBD', role: 'Audio — Patch', dept: 'Audio', ch1: '2', ch2: '', radioId: 'R-203', radioType: 'Motorola CP200d' },
    { name: 'Max Ferreyra', role: 'Lighting — LD/L1', dept: 'Lighting', ch1: '3', ch2: '1', radioId: 'R-301', radioType: 'Motorola CP200d' },
    { name: 'Matthew Marqulis', role: 'Lighting — L2', dept: 'Lighting', ch1: '3', ch2: '', radioId: 'R-302', radioType: 'Motorola CP200d' },
    { name: 'Tia Purcell', role: 'Video — TD', dept: 'Video', ch1: '4', ch2: '1', radioId: 'R-401', radioType: 'Motorola CP200d' },
    { name: 'Levi Elzgas', role: 'Video — V1/PTZ Operator', dept: 'Video', ch1: '4', ch2: '', radioId: 'R-402', radioType: 'Motorola CP200d' },
    { name: 'Eric Adams', role: 'Video — FOH 1', dept: 'Video', ch1: '4', ch2: '', radioId: 'R-403', radioType: 'Motorola CP200d' },
    { name: 'Shane Lloyd', role: 'LED tech/Video — PIT SL', dept: 'Video', ch1: '4', ch2: '3', radioId: 'R-404', radioType: 'Motorola CP200d' },
    { name: 'Randy Stearman', role: 'LED tech Lead', dept: 'Video', ch1: '4', ch2: '', radioId: 'R-405', radioType: 'Motorola CP200d' },
  ];

  const depts = [...new Set(radioAssignments.map(r => r.dept))];

  function chBadge(ch) {
    if (!ch) return '';
    const c = channels.find(x => x.ch === ch);
    const color = c ? c.color : '#666';
    return `<span class="radio-ch-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${ch}</span>`;
  }

  return `
    <div class="ds-container">
      <!-- Channel Legend + Per-Crew Table -->
      <div style="display:flex;gap:20px;flex-wrap:wrap;">

        <!-- Main: Per-Crew Radio Assignments -->
        <div style="flex:1;min-width:500px;">
          <div class="cl-title-bar" style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:15px;font-weight:700;">Radio Assignments — Per Crew Member</h3>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="showToast('Exported radio list','success')">Export</button>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Print radio list','info')">Print</button>
            </div>
          </div>

          <table class="cl-table" style="margin-top:0;">
            <thead>
              <tr>
                <th style="width:160px;">Name</th>
                <th style="width:200px;">Position</th>
                <th style="width:70px;text-align:center;">Primary Ch</th>
                <th style="width:70px;text-align:center;">Secondary Ch</th>
                <th style="width:80px;">Radio ID</th>
                <th>Radio Type</th>
              </tr>
            </thead>
            <tbody>
              ${depts.map(dept => `
                <tr class="cl-separator"><td colspan="6" style="padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary);background:var(--bg-primary);">${dept}</td></tr>
                ${radioAssignments.filter(r => r.dept === dept).map(r => `
                  <tr class="cl-row">
                    <td class="cl-name">${r.name}</td>
                    <td class="cl-pos">${r.role}</td>
                    <td style="text-align:center;">${chBadge(r.ch1)}</td>
                    <td style="text-align:center;">${chBadge(r.ch2)}</td>
                    <td style="font-family:monospace;font-size:11px;color:var(--text-secondary);">${r.radioId}</td>
                    <td style="font-size:11px;color:var(--text-tertiary);">${r.radioType}</td>
                  </tr>
                `).join('')}
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Sidebar: Channel Legend -->
        <div style="width:240px;flex-shrink:0;">
          <div class="cl-title-bar">
            <h3 style="margin:0;font-size:13px;font-weight:700;">Channel Directory</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:0;">
            ${channels.map(c => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-subtle);">
                <span class="radio-ch-badge" style="background:${c.color}20;color:${c.color};border:1px solid ${c.color}40;font-size:13px;width:28px;text-align:center;">${c.ch}</span>
                <span style="font-size:12px;font-weight:600;color:var(--text-primary);">${c.label}</span>
              </div>
            `).join('')}
          </div>
          <div style="padding:12px 14px;font-size:11px;color:var(--text-tertiary);border-top:1px solid var(--border-subtle);">
            All radios set to primary channel before call time. Emergency Ch 8 must remain clear.
          </div>

          <div style="padding:12px 14px;border-top:1px solid var(--border-default);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary);margin-bottom:8px;">Inventory Summary</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div style="background:var(--bg-tertiary);padding:8px;border-radius:var(--radius-md);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:var(--text-primary);">${radioAssignments.length}</div>
                <div style="font-size:10px;color:var(--text-tertiary);">Assigned</div>
              </div>
              <div style="background:var(--bg-tertiary);padding:8px;border-radius:var(--radius-md);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:var(--accent-green);">4</div>
                <div style="font-size:10px;color:var(--text-tertiary);">Spare</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
