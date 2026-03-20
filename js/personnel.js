// ============================================
// PERSONNEL
// ============================================
function renderPersonnel() {
  const statusColors = { available: 'var(--accent-green)', on_event: 'var(--accent-blue)', unavailable: 'var(--accent-red)' };
  const statusLabels = { available: 'Available', on_event: 'On Event', unavailable: 'Unavailable' };
  return `
    <div class="page-header">
      <div><h1 class="page-title">Personnel</h1><p class="page-subtitle">${PERSONNEL.length} crew members across ${DEPARTMENTS.length} departments</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="openPersonnelCSVImportModal()">Import CSV</button>
        <button class="btn btn-primary" onclick="openAddPersonnelModal()">+ Add Crew Member</button>
      </div>
    </div>
    <div class="schedule-controls" style="margin-bottom:16px;">
      <div class="view-toggle">
        <button class="view-toggle-btn ${personnelView === 'directory' ? 'active' : ''}" onclick="personnelView='directory'; renderPage('personnel');">Directory</button>
        <button class="view-toggle-btn ${personnelView === 'availability' ? 'active' : ''}" onclick="personnelView='availability'; renderPage('personnel');">Availability</button>
      </div>
      <select class="filter-select"><option>All Departments</option>${DEPARTMENTS.map(d => `<option>${d.name}</option>`).join('')}</select>
      <select class="filter-select"><option>All Statuses</option><option>Available</option><option>On Event</option><option>Unavailable</option></select>
      <input type="text" class="filter-input" placeholder="Search crew…" style="min-width:200px;">
    </div>
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card"><div class="stat-label">Total Crew</div><div class="stat-value">${PERSONNEL.length}</div></div>
      <div class="stat-card"><div class="stat-label">Available</div><div class="stat-value" style="color:var(--accent-green);">${PERSONNEL.filter(p => p.status === 'available').length}</div></div>
      <div class="stat-card"><div class="stat-label">On Event</div><div class="stat-value" style="color:var(--accent-blue);">${PERSONNEL.filter(p => p.status === 'on_event').length}</div></div>
      <div class="stat-card"><div class="stat-label">Unavailable</div><div class="stat-value" style="color:var(--accent-red);">${PERSONNEL.filter(p => p.status === 'unavailable').length}</div></div>
    </div>
    ${personnelView === 'availability' ? renderPersonnelAvailability() : `
    <div class="personnel-grid">
      ${PERSONNEL.map(p => { const dept = getDepartment(p.dept); return `
        <div class="personnel-card" onclick="openPersonnelDetail('${p.id}')">
          <div class="personnel-card-header">
            <div class="personnel-avatar" style="background:${p.avatar};">${p.initials}</div>
            <div style="flex:1;min-width:0;"><div class="personnel-name">${p.name}</div><div class="personnel-role">${p.role}</div></div>
            <div style="width:8px;height:8px;border-radius:50%;background:${statusColors[p.status]};" title="${statusLabels[p.status]}"></div>
          </div>
          <div class="personnel-meta">
            <span class="personnel-tag" style="background:${dept.color}20;color:${dept.color};">${dept.name}</span>
            <span class="personnel-tag" style="background:var(--bg-tertiary);color:var(--text-secondary);">${formatCurrency(p.rate)}/day</span>
            <span class="personnel-tag" style="background:${statusColors[p.status]}20;color:${statusColors[p.status]};">${statusLabels[p.status]}</span>
          </div>
        </div>
      `; }).join('')}
    </div>`}
  `;
}

function renderPersonnelAvailability() {
  const dates = ['Feb 14', 'Feb 15', 'Feb 16', 'Feb 17', 'Feb 18', 'Feb 19', 'Feb 20'];
  const crewForGrid = PERSONNEL.slice(0, 8);
  const assignments = {
    'p1-3': { event: 'UFC 310', eventId: 'e5', status: 'confirmed' }, 'p2-3': { event: 'UFC 310', eventId: 'e5', status: 'confirmed' },
    'p3-0': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p3-1': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p3-2': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' },
    'p4-0': { event: 'NBA All-Star', eventId: 'e2', status: 'pending' }, 'p4-1': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p4-2': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' },
    'p5-0': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p5-1': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p5-2': { event: 'NBA All-Star', eventId: 'e2', status: 'conflict' }, 'p5-3': { event: 'Super Bowl', eventId: 'e1', status: 'conflict' },
    'p6-0': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p6-1': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' },
    'p7-3': { event: 'UFC 310', eventId: 'e5', status: 'confirmed' }, 'p8-0': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p8-1': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' }, 'p8-2': { event: 'NBA All-Star', eventId: 'e2', status: 'confirmed' },
    'p11-3': { event: 'UFC 310', eventId: 'e5', status: 'pending' }
  };

  return `
    <div class="avail-grid-controls">
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)-1;renderPage('personnel');">← Prev Week</button>
      <span style="font-weight:600;font-size:13px;">${getScheduleWeekLabel()}</span>
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)+1;renderPage('personnel');">Next Week →</button>
    </div>
    <div class="schedule-grid" style="grid-template-columns: 200px repeat(${dates.length}, 1fr);">
      <div class="schedule-cell header">Crew Member</div>
      ${dates.map((d, i) => `<div class="schedule-cell header" ${i === 3 ? 'style="background:var(--accent-blue-muted);color:var(--accent-blue);"' : ''}>${d}${i === 3 ? ' (Today)' : ''}</div>`).join('')}
      ${crewForGrid.map(p => { const dept = getDepartment(p.dept); return `
        <div class="schedule-cell row-header"><div style="display:flex;align-items:center;gap:8px;"><div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;">${p.initials}</div><div><div style="font-size:12px;font-weight:500;" class="ep-clickable" onclick="openPersonnelDetail('${p.id}')">${p.name}</div><div style="font-size:10px;color:var(--text-tertiary);">${dept.name}</div></div></div></div>
        ${dates.map((_, di) => { const key = `${p.id}-${di}`; const asgn = assignments[key]; const isConflict = asgn && asgn.status === 'conflict'; return asgn ? `<div class="schedule-cell has-assignment ${isConflict ? 'has-conflict' : ''}" onclick="navigateToEvent('${asgn.eventId}')" title="${isConflict ? 'Double-booked conflict — click to resolve' : ''}"><span class="assignment-chip ${asgn.status}">${isConflict ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="flex-shrink:0;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : ''}${asgn.event}</span></div>` : `<div class="schedule-cell" onclick="openCreateAssignmentModal('${p.id}','${dates[di]}')"></div>`; }).join('')}
      `; }).join('')}
    </div>
  `;
}

function openPersonnelDetail(personId) {
  const p = PERSONNEL.find(x => x.id === personId);
  if (!p) return;
  const dept = getDepartment(p.dept);
  const statusColors = { available: 'var(--accent-green)', on_event: 'var(--accent-blue)', unavailable: 'var(--accent-red)' };
  const statusLabels = { available: 'Available', on_event: 'On Event', unavailable: 'Unavailable' };
  const assignedEvents = EVENTS.filter(e => e.crew.includes(p.id));
  const personTravel = TRAVEL_RECORDS.filter(t => t.personnel === p.id);

  const body = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
      <div style="width:56px;height:56px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#fff;">${p.initials}</div>
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:700;">${p.name}</div>
        <div style="font-size:13px;color:var(--text-tertiary);">${p.role}</div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <span class="personnel-tag" style="background:${dept.color}20;color:${dept.color};">${dept.name}</span>
          <span class="personnel-tag" style="background:${statusColors[p.status]}20;color:${statusColors[p.status]};">${statusLabels[p.status]}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Day Rate</div><div style="font-size:20px;font-weight:700;">${formatCurrency(p.rate)}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Active Events</div><div style="font-size:20px;font-weight:700;">${assignedEvents.length}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Travel Records</div><div style="font-size:20px;font-weight:700;">${personTravel.length}</div></div>
    </div>
    ${assignedEvents.length > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">ASSIGNED EVENTS</div>${assignedEvents.map(ev => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>navigateToEvent('${ev.id}'),150)"><span class="phase-badge ${ev.phase}" style="font-size:10px;padding:2px 6px;">${PHASE_LABELS[ev.phase]}</span><div style="flex:1;font-weight:500;font-size:13px;">${ev.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${formatDateShort(ev.startDate)}</div></div>`).join('')}</div>` : ''}
    ${personTravel.length > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">TRAVEL</div>${personTravel.map(tr => { const ev = EVENTS.find(e => e.id === tr.event); return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;"><span>${uiIcon({flight:'travelFlight',hotel:'travelHotel',self_drive:'travelSelfDrive'}[tr.type]||'travelLocation')}</span><div style="flex:1;"><div style="font-size:12px;font-weight:500;">${tr.from}${tr.to ? ' → '+tr.to : ''}</div><div style="font-size:11px;color:var(--text-tertiary);">${ev.name} · ${formatDate(tr.date)}</div></div><div style="font-size:12px;font-weight:500;">${formatCurrency(tr.cost)}</div></div>`; }).join('')}</div>` : ''}
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">CONTACT & PREFERENCES</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" value="${p.name.toLowerCase().replace(' ','.')}@crew.com"></div>
        <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-input" value="(555) 123-4567"></div>
        <div class="form-group"><label class="form-label">Home Base</label><input type="text" class="form-input" value="New York, NY"></div>
        <div class="form-group"><label class="form-label">Travel Preference</label><select class="form-select"><option>Will fly anywhere</option><option>Prefers driving</option><option>Local only</option></select></div>
      </div>
    </div>
  `;
  openModal(p.name, body, `
    <button class="btn btn-danger btn-sm" onclick="showConfirm('Remove Crew Member','Remove ${p.name} from the roster?',()=>showToast('${p.name} removed','error'))">Remove</button>
    <div style="flex:1;"></div>
    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" onclick="showToast('${p.name} updated!','success');closeModal();">Save</button>
  `);
}

function openAddPersonnelModal() {
  const body = `
    <!-- Photo Upload -->
    <div class="photo-upload-area">
      <div class="photo-upload-preview" onclick="document.getElementById('crewPhotoInput').click()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M3 16.8V9.2C3 8.0799 3 7.5198 3.21799 7.09202C3.40973 6.71569 3.71569 6.40973 4.09202 6.21799C4.5198 6 5.0799 6 6.2 6H7.25C7.25 6 7.5 4 9.5 4h5c2 0 2.25 2 2.25 2h1.05c1.1201 0 1.6802 0 2.108.21799C20.2843 6.40973 20.5903 6.71569 20.782 7.09202 21 7.5198 21 8.0799 21 9.2v7.6c0 1.1201 0 1.6802-.21799 2.108-.19174.3763-.49769.6823-.87402.874C19.4802 20 18.9201 20 17.8 20H6.2c-1.1201 0-1.6802 0-2.10798-.218-.37633-.1917-.68229-.4977-.87403-.874C3 18.4802 3 17.9201 3 16.8z"/></svg>
      </div>
      <input type="file" id="crewPhotoInput" accept="image/*" style="display:none" onchange="handleCrewPhotoUpload(this)">
      <div class="photo-upload-info">
        <h4>Crew Photo</h4>
        <p>Upload a headshot or badge photo. JPG, PNG up to 5 MB.</p>
        <button type="button" class="btn-upload" onclick="document.getElementById('crewPhotoInput').click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Photo
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="modal-tabs">
      <button class="modal-tab active" onclick="switchCrewTab(this, 'basic')">Basic Info</button>
      <button class="modal-tab" onclick="switchCrewTab(this, 'contact')">Contact</button>
      <button class="modal-tab" onclick="switchCrewTab(this, 'rates')">Rates & Pay</button>
      <button class="modal-tab" onclick="switchCrewTab(this, 'tax')">Tax & Legal</button>
      <button class="modal-tab" onclick="switchCrewTab(this, 'additional')">Additional</button>
    </div>

    <!-- TAB: Basic Info -->
    <div class="modal-tab-panel active" id="tab-basic">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">First Name *</label><input type="text" class="form-input" placeholder="John"></div>
        <div class="form-group"><label class="form-label">Last Name *</label><input type="text" class="form-input" placeholder="Doe"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Department *</label><select class="form-select"><option value="">Select…</option>${DEPARTMENTS.map(d => `<option>${d.name}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Role / Title *</label><input type="text" class="form-input" placeholder="e.g. A1 - Audio Engineer"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Date of Birth</label><input type="date" class="form-input"></div>
        <div class="form-group"><label class="form-label">Gender</label><select class="form-select"><option value="">Select…</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option></select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Shirt Size</label>
          <select class="form-select"><option value="">Select…</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>XXXL</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Crew Status</label>
          <select class="form-select"><option>Active</option><option>Inactive</option><option>On Leave</option><option>Prospect</option></select>
        </div>
      </div>
    </div>

    <!-- TAB: Contact -->
    <div class="modal-tab-panel" id="tab-contact">
      <div class="form-section-title">Primary Contact</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" placeholder="john@crew.com"></div>
        <div class="form-group"><label class="form-label">Phone *</label><input type="tel" class="form-input" placeholder="(555) 000-0000"></div>
      </div>
      <div class="form-group"><label class="form-label">Secondary Email</label><input type="email" class="form-input" placeholder="personal@email.com"></div>

      <div class="form-section-title">Home Address</div>
      <div class="form-group"><label class="form-label">Street Address</label><input type="text" class="form-input" placeholder="123 Main St, Apt 4B"></div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">City</label><input type="text" class="form-input" placeholder="Los Angeles"></div>
        <div class="form-group"><label class="form-label">State</label><input type="text" class="form-input" placeholder="CA"></div>
        <div class="form-group"><label class="form-label">ZIP Code</label><input type="text" class="form-input" placeholder="90001"></div>
      </div>

      <div class="form-section-title">Emergency Contact</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Emergency Contact Name</label><input type="text" class="form-input" placeholder="Jane Doe"></div>
        <div class="form-group"><label class="form-label">Relationship</label><input type="text" class="form-input" placeholder="Spouse, Parent, etc."></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Emergency Phone</label><input type="tel" class="form-input" placeholder="(555) 000-0000"></div>
        <div class="form-group"><label class="form-label">Emergency Email</label><input type="email" class="form-input" placeholder="jane@email.com"></div>
      </div>
    </div>

    <!-- TAB: Rates & Pay -->
    <div class="modal-tab-panel" id="tab-rates">
      <div class="form-section-title">Standard Rates</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Day Rate ($) *</label><input type="number" class="form-input" placeholder="0" step="25"></div>
        <div class="form-group"><label class="form-label">Half-Day Rate ($)</label><input type="number" class="form-input" placeholder="0" step="25"></div>
        <div class="form-group"><label class="form-label">Hourly Rate ($)</label><input type="number" class="form-input" placeholder="0" step="5"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">OT Rate ($/hr)</label><input type="number" class="form-input" placeholder="0" step="5"><div class="form-hint">Overtime hourly rate</div></div>
        <div class="form-group"><label class="form-label">Per Diem ($)</label><input type="number" class="form-input" placeholder="75" step="5"></div>
        <div class="form-group"><label class="form-label">Kit / Equipment Fee ($)</label><input type="number" class="form-input" placeholder="0" step="25"></div>
      </div>

      <div class="form-section-title">Travel Compensation</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Travel Day Rate ($)</label><input type="number" class="form-input" placeholder="0" step="25"><div class="form-hint">Rate for travel-only days</div></div>
        <div class="form-group"><label class="form-label">Mileage Rate ($/mi)</label><input type="number" class="form-input" placeholder="0.67" step="0.01"><div class="form-hint">IRS standard: $0.67/mi</div></div>
      </div>

      <div class="form-section-title">Payment Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select class="form-select"><option>Direct Deposit</option><option>Check</option><option>Wire Transfer</option><option>PayPal / Venmo</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Terms</label>
          <select class="form-select"><option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Upon Wrap</option></select>
        </div>
      </div>
    </div>

    <!-- TAB: Tax & Legal -->
    <div class="modal-tab-panel" id="tab-tax">
      <div class="form-section-title">Tax Classification</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Worker Classification *</label>
          <select class="form-select" id="crewWorkerClass">
            <option value="">Select…</option>
            <option>W-2 Employee</option>
            <option>1099 Independent Contractor</option>
            <option>Loan-out / Corp-to-Corp</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tax Filing Status</label>
          <select class="form-select">
            <option value="">Select…</option>
            <option>Single</option>
            <option>Married Filing Jointly</option>
            <option>Married Filing Separately</option>
            <option>Head of Household</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">SSN / Tax ID (last 4)</label><input type="text" class="form-input" maxlength="4" placeholder="••••"><div class="form-hint">Stored encrypted. Only last 4 shown.</div></div>
        <div class="form-group"><label class="form-label">Federal W-4 Allowances</label><input type="number" class="form-input" placeholder="0" min="0"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">State Tax Withholding</label><select class="form-select"><option value="">Select state…</option><option>CA</option><option>NY</option><option>TX (no state tax)</option><option>FL (no state tax)</option><option>NV (no state tax)</option><option>Other</option></select></div>
        <div class="form-group"><label class="form-label">Additional Withholding ($)</label><input type="number" class="form-input" placeholder="0" step="1"><div class="form-hint">Extra per-check withholding</div></div>
      </div>

      <div class="form-section-title">Tax Documents on File</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="form-toggle-row">
          <div><div class="form-toggle-label">W-4 (Employee Withholding)</div><div class="form-toggle-sublabel">Federal tax withholding form</div></div>
          <select class="form-select" style="width:140px;"><option>Not Filed</option><option>On File</option><option>Expired</option></select>
        </div>
        <div class="form-toggle-row">
          <div><div class="form-toggle-label">W-9 (Taxpayer Identification)</div><div class="form-toggle-sublabel">Required for 1099 contractors</div></div>
          <select class="form-select" style="width:140px;"><option>Not Filed</option><option>On File</option><option>Expired</option></select>
        </div>
        <div class="form-toggle-row">
          <div><div class="form-toggle-label">I-9 (Employment Eligibility)</div><div class="form-toggle-sublabel">Identity & work authorization verification</div></div>
          <select class="form-select" style="width:140px;"><option>Not Filed</option><option>On File</option><option>Expired</option></select>
        </div>
        <div class="form-toggle-row">
          <div><div class="form-toggle-label">Direct Deposit Authorization</div><div class="form-toggle-sublabel">Bank routing & account info</div></div>
          <select class="form-select" style="width:140px;"><option>Not Filed</option><option>On File</option><option>Expired</option></select>
        </div>
        <div class="form-toggle-row">
          <div><div class="form-toggle-label">NDA / Confidentiality Agreement</div><div class="form-toggle-sublabel">Non-disclosure agreement</div></div>
          <select class="form-select" style="width:140px;"><option>Not Filed</option><option>On File</option><option>Expired</option></select>
        </div>
      </div>

      <div class="form-section-title">Loan-out / Corporation Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Corporation Name</label><input type="text" class="form-input" placeholder="e.g. Smith Productions LLC"></div>
        <div class="form-group"><label class="form-label">EIN (Federal Tax ID)</label><input type="text" class="form-input" placeholder="XX-XXXXXXX"></div>
      </div>
      <div class="form-group"><label class="form-label">Corporation Address</label><input type="text" class="form-input" placeholder="123 Business Ave, City, State ZIP"></div>
    </div>

    <!-- TAB: Additional -->
    <div class="modal-tab-panel" id="tab-additional">
      <div class="form-section-title">Travel & Logistics</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Travel Preference</label>
          <select class="form-select"><option>Will fly anywhere</option><option>Prefers driving</option><option>Local only</option><option>Regional (within 500 mi)</option></select>
        </div>
        <div class="form-group"><label class="form-label">Home Airport (Code)</label><input type="text" class="form-input" placeholder="e.g. LAX" maxlength="3" style="text-transform:uppercase;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">TSA Known Traveler #</label><input type="text" class="form-input" placeholder="Optional"></div>
        <div class="form-group"><label class="form-label">Passport Number</label><input type="text" class="form-input" placeholder="Optional"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Passport Expiration</label><input type="date" class="form-input"></div>
        <div class="form-group"><label class="form-label">Driver's License State</label><input type="text" class="form-input" placeholder="e.g. CA" maxlength="2"></div>
      </div>

      <div class="form-section-title">Skills & Certifications</div>
      <div class="form-group"><label class="form-label">Certifications</label><input type="text" class="form-input" placeholder="e.g. CDL, ETCP, SBE, CTS (comma separated)"><div class="form-hint">Comma-separated list of certifications</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Years of Experience</label><input type="number" class="form-input" placeholder="0" min="0"></div>
        <div class="form-group">
          <label class="form-label">Skill Level</label>
          <select class="form-select"><option value="">Select…</option><option>Entry Level</option><option>Mid Level</option><option>Senior</option><option>Lead / Supervisor</option><option>Department Head</option></select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Languages Spoken</label><input type="text" class="form-input" placeholder="e.g. English, Spanish"></div>

      <div class="form-section-title">Vehicle & Equipment</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Has Personal Vehicle</label>
          <select class="form-select"><option>No</option><option>Yes — Car</option><option>Yes — Truck / SUV</option><option>Yes — Van / Sprinter</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Owns Equipment / Kit</label>
          <select class="form-select"><option>No</option><option>Yes — Basic Kit</option><option>Yes — Full Kit</option></select>
        </div>
      </div>

      <div class="form-section-title">Notes & Internal Info</div>
      <div class="form-group"><label class="form-label">Internal Notes</label><textarea class="form-textarea" placeholder="Special skills, preferences, scheduling notes, etc." style="min-height:100px;"></textarea></div>
      <div class="form-group"><label class="form-label">Dietary Restrictions / Allergies</label><input type="text" class="form-input" placeholder="e.g. Vegetarian, Nut allergy"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
