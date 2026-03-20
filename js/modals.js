/* ============================================
   Module: Modal dialogs (keyboard shortcuts, clone event, assign crew/truck, travel, export, settlement, upload, etc.)
   Depends on: modal.js, state.js, data.js, events.js, event-page.js, personnel.js, trucks.js, travel.js, documents.js
   ============================================ */
function openKeyboardShortcuts() {
  const shortcuts = [
    ['Ctrl + K', 'Open command palette'], ['Ctrl + N', 'New event'], ['Ctrl + S', 'Save current item'],
    ['Ctrl + Z', 'Undo'], ['Ctrl + Shift + Z', 'Redo'],
    ['G then D', 'Go to Dashboard'], ['G then E', 'Go to Events'], ['G then S', 'Go to Scheduling'],
    ['G then P', 'Go to Personnel'], ['G then T', 'Go to Trucks'], ['G then R', 'Go to Travel'],
    ['G then F', 'Go to Financial'], ['G then O', 'Go to Documents'], ['Escape', 'Close modal / palette'], ['?', 'Show this help'],
  ];
  openModal('Keyboard Shortcuts', `
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Shortcut</th><th>Action</th></tr></thead><tbody>
      ${shortcuts.map(([key, action]) => `<tr><td><kbd style="padding:3px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);font-family:monospace;font-size:12px;">${key}</kbd></td><td>${action}</td></tr>`).join('')}
    </tbody></table></div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Got it</button>`);
}

function openAllNotifications() {
  const allNotifs = [
    { title:'Scheduling Conflict', desc:'Chris Martinez double-booked Feb 16-17', time:'2 min ago', unread:true, color:'var(--accent-red)' },
    { title:'Phase Advanced', desc:'UFC 310 moved to Live', time:'15 min ago', unread:true, color:'var(--accent-blue)' },
    { title:'Flight Confirmed', desc:'DL1247 JFK to LAS for Mike Thompson', time:'1 hr ago', unread:true, color:'var(--accent-green)' },
    { title:'Document Generated', desc:'Super Bowl LXI Crew Pack v3', time:'5 hrs ago', unread:false, color:'var(--accent-purple)' },
    { title:'Budget Alert', desc:'UFC 310 at 94% budget utilization', time:'6 hrs ago', unread:false, color:'var(--accent-amber)' },
    { title:'Crew Joined', desc:'Sarah Lee added to Super Bowl LXI', time:'8 hrs ago', unread:false, color:'var(--accent-cyan)' },
    { title:'Phase Advanced', desc:'NBA All-Star moved to Production', time:'1 day ago', unread:false, color:'var(--accent-blue)' },
    { title:'Hotel Booked', desc:'Ritz-Carlton Atlanta 5 rooms', time:'1 day ago', unread:false, color:'var(--accent-green)' },
    { title:'Rider Uploaded', desc:'Taylor Swift NYC rider (5.8 MB)', time:'2 days ago', unread:false, color:'var(--accent-purple)' },
  ];
  openModal('All Notifications', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-size:12px;color:var(--text-tertiary);">${allNotifs.filter(n=>n.unread).length} unread</span><button class="btn btn-ghost btn-sm" onclick="showToast('All marked read','success')">Mark all read</button></div>
    ${allNotifs.map(n => `<div style="display:flex;gap:10px;padding:12px;border-bottom:1px solid var(--border-subtle);"><div style="width:10px;height:10px;border-radius:50%;background:${n.unread?n.color:'transparent'};margin-top:4px;flex-shrink:0;"></div><div style="flex:1;"><div style="font-weight:${n.unread?600:400};font-size:13px;">${n.title}</div><div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">${n.desc}</div><div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${n.time}</div></div></div>`).join('')}
  `, `<button class="btn btn-primary" onclick="closeModal()">Close</button>`);
}

function openCloneEventModal() {
  openModal('Clone Event', `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Clone an event with all its details, crew, and truck assignments.</p>
    <div class="form-group"><label class="form-label">Source Event</label><select class="form-select">${EVENTS.map(e => `<option value="${e.id}">${e.name} (${PHASE_LABELS[e.phase]})</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">New Event Name</label><input type="text" class="form-input" placeholder="e.g. Super Bowl LXII Pre-Show"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">New Start Date</label><input type="date" class="form-input"></div>
      <div class="form-group"><label class="form-label">New End Date</label><input type="date" class="form-input"></div>
    </div>
    <div class="form-group"><label class="form-label">What to clone</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Crew assignments</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Truck assignments</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Budget</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Travel records</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Documents</label>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Event cloned!','success');closeModal();">Clone Event</button>`);
}

function openAssignCrewModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  const available = PERSONNEL.filter(p => !ev.crew.includes(p.id));
  openModal('Assign Crew — ' + ev.name, `
    <div class="form-group"><label class="form-label">Search Crew</label><input type="text" class="form-input" placeholder="Type to filter…"></div>
    <div style="max-height:300px;overflow-y:auto;">
      ${available.map(p => { const dept = getDepartment(p.dept); return `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border-subtle);cursor:pointer;" onclick="this.querySelector('input').checked=!this.querySelector('input').checked"><input type="checkbox" onclick="event.stopPropagation()"><div style="width:32px;height:32px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;">${p.initials}</div><div style="flex:1;"><div style="font-weight:500;font-size:13px;">${p.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${p.role} · ${dept.name}</div></div><div style="font-size:12px;color:var(--text-secondary);">${formatCurrency(p.rate)}/day</div></div>`; }).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
      <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" value="${ev.startDate}"></div>
      <div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-input" value="${ev.endDate}"></div>
    </div>
    <div class="form-group"><label class="form-label">Call Time</label><input type="time" class="form-input" value="08:00"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Crew assigned!','success');closeModal();">Assign Selected</button>`);
}

function openPersonnelCSVImportModal() {
  csvImportStep = 1;
  openModal('Import Personnel from CSV', getCSVImportBody(), getCSVImportFooter());
}

function getCSVImportBody() {
  const step = csvImportStep || 1;
  if (step === 1) {
    return `
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 1 of 4 — Upload your CSV file (max 500 rows)</div>
      <div id="csvUploadZone" style="border:2px dashed var(--border-default);padding:40px;text-align:center;cursor:pointer;transition:border-color 200ms,background 200ms;" onmouseover="this.style.borderColor='var(--accent-blue)';this.style.background='rgba(59,130,246,0.05)'" onmouseout="this.style.borderColor='var(--border-default)';this.style.background='transparent'" onclick="this.innerHTML='<div style=\\'font-size:24px;margin-bottom:8px;\\'>✅</div><div style=\\'font-weight:500;color:var(--accent-green);\\'>personnel-sample.csv selected</div><div style=\\'font-size:12px;color:var(--text-tertiary);margin-top:4px;\\'>3 rows · 5 columns</div>';">
        <div style="font-size:32px;margin-bottom:8px;">📁</div>
        <div style="font-weight:500;margin-bottom:4px;">Click to browse or drag CSV here</div>
        <div style="font-size:12px;color:var(--text-tertiary);">Columns: Name, Email, Department, Role, Day Rate (or map in next step)</div>
      </div>
    `;
  }
  if (step === 2) {
    const csvHeaders = ['Name','Email','Department','Role','Rate'];
    const personnelFields = ['Name','Email','Department','Role','Day Rate','Skip'];
    return `
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 2 of 4 — Map CSV columns to personnel fields</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>CSV Column</th><th>Map to</th></tr></thead><tbody>
        ${csvHeaders.map((h, i) => `<tr><td><strong>${h}</strong></td><td><select class="form-select" style="min-width:140px;"><option value="">—</option>${personnelFields.map(f => `<option value="${f.toLowerCase().replace(' ','')}" ${(f.toLowerCase().replace(' ','') === h.toLowerCase().replace(' ','') || (h==='Rate'&&f==='Day Rate')) ? 'selected' : ''}>${f}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Unmapped columns are ignored. Required: Name, Department.</div>
    `;
  }
  if (step === 3) {
    const previewRows = [ { name: 'Jane Doe', email: 'jane@example.com', dept: 'Audio', role: 'A2', rate: 550, error: null }, { name: 'John Smith', email: 'invalid', dept: 'Video', role: 'TD', rate: 950, error: 'Invalid email' }, { name: 'Alex Rivera', email: 'alex@example.com', dept: 'Lighting', role: 'LD', rate: 900, error: null } ];
    return `
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 3 of 4 — Preview (2 ready, 1 with errors)</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Rate</th><th>Status</th></tr></thead><tbody>
        ${previewRows.map(r => `<tr style="${r.error ? 'background:rgba(239,68,68,0.08);' : ''}"><td>${r.name}</td><td>${r.email}</td><td>${r.dept}</td><td>${r.role}</td><td>${formatCurrency(r.rate)}</td><td>${r.error ? `<span style="color:var(--accent-red);font-size:11px;">${r.error}</span>` : '<span style="color:var(--accent-green);font-size:11px;">Ready</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Rows with errors will be skipped. You can fix the file and re-upload from step 1.</div>
    `;
  }
  return `
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 4 of 4 — Confirm import</div>
    <div style="padding:20px;background:var(--bg-tertiary);border-radius:var(--radius);margin-bottom:16px;">
      <div style="font-weight:600;margin-bottom:8px;">Ready to import</div>
      <div style="font-size:13px;color:var(--text-secondary);">2 new personnel will be added. 1 row skipped (validation error).</div>
    </div>
    <p style="font-size:12px;color:var(--text-tertiary);">Duplicate emails will be skipped. Existing records will not be modified.</p>
  `;
}

function getCSVImportFooter() {
  const step = csvImportStep || 1;
  const backBtn = step > 1 ? `<button class="btn btn-ghost" onclick="csvImportStep=${step-1};document.getElementById('modalBody').innerHTML=getCSVImportBody();document.getElementById('modalFooter').innerHTML=getCSVImportFooter();">Back</button>` : '';
  const nextBtn = step < 4 ? `<button class="btn btn-primary" onclick="csvImportStep=${step+1};document.getElementById('modalBody').innerHTML=getCSVImportBody();document.getElementById('modalFooter').innerHTML=getCSVImportFooter();">Next</button>` : `<button class="btn btn-primary" onclick="showToast('Imported 2 personnel!','success');closeModal();renderPage('personnel');">Import</button>`;
  return `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>${backBtn}${nextBtn}`;
}

function openAssignTruckModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  const available = TRUCKS.filter(t => !ev.trucks.includes(t.id));
  openModal('Assign Truck — ' + ev.name, `
    ${available.map(t => `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border-subtle);cursor:pointer;" onclick="this.querySelector('input').checked=!this.querySelector('input').checked"><input type="checkbox" onclick="event.stopPropagation()"><div style="font-size:20px;">🚛</div><div style="flex:1;"><div style="font-weight:500;font-size:13px;">${t.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${t.type} · ${t.location}</div></div><span class="phase-badge" style="font-size:10px;">${t.status}</span></div>`).join('')}
    <div class="form-group" style="margin-top:16px;"><label class="form-label">Route Origin</label><input type="text" class="form-input" placeholder="Warehouse / previous venue"></div>
    <div class="form-group"><label class="form-label">Departure Date</label><input type="date" class="form-input"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Truck assigned!','success');closeModal();">Assign</button>`);
}

function openAssignTruckToEventModal(truckId) {
  const t = TRUCKS.find(x => x.id === truckId);
  openModal('Assign ' + t.name + ' to Event', `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);"><div style="font-size:24px;">🚛</div><div><div style="font-weight:600;">${t.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${t.type}</div></div></div>
    <div class="form-group"><label class="form-label">Event</label><select class="form-select"><option value="">Select event…</option>${EVENTS.filter(e => !['settled','archived'].includes(e.phase)).map(e => `<option>${e.name} — ${getVenue(e.venue).city}</option>`).join('')}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div class="form-group"><label class="form-label">Departure</label><input type="date" class="form-input"></div><div class="form-group"><label class="form-label">Return</label><input type="date" class="form-input"></div></div>
    <div class="form-group"><label class="form-label">Driver</label><select class="form-select"><option value="">Select…</option>${PERSONNEL.slice(0,4).map(p => `<option>${p.name}</option>`).join('')}<option>External driver</option></select></div>
    <div class="form-group"><label class="form-label">Route Notes</label><textarea class="form-textarea" placeholder="Stops, special instructions…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('${t.name} assigned!','success');closeModal();">Assign</button>`);
}

function openCreateAssignmentModal(personId, dateStr) {
  const p = getPersonnel(personId); if (!p) return;
  openModal('Create Assignment', `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);"><div style="width:36px;height:36px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;">${p.initials}</div><div><div style="font-weight:600;">${p.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${p.role} · ${dateStr}</div></div></div>
    <div class="form-group"><label class="form-label">Event</label><select class="form-select"><option value="">Select event…</option>${EVENTS.filter(e => !['settled','archived'].includes(e.phase)).map(e => `<option>${e.name}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Role on Event</label><input type="text" class="form-input" value="${p.role}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div class="form-group"><label class="form-label">Call Time</label><input type="time" class="form-input" value="08:00"></div><div class="form-group"><label class="form-label">Wrap Time</label><input type="time" class="form-input" value="18:00"></div></div>
    <div class="form-group"><label class="form-label">Day Rate Override</label><input type="number" class="form-input" value="${p.rate}"></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Special instructions…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Assignment created!','success');closeModal();">Create</button>`);
}

function openAssignmentDetailModal(personId, eventName, status, dateStr) {
  const p = getPersonnel(personId); if (!p) return;
  openModal('Assignment Detail', `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);"><div style="width:36px;height:36px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;">${p.initials}</div><div style="flex:1;"><div style="font-weight:600;">${p.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${p.role}</div></div><span class="assignment-chip ${status}">${status}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;"><div><div style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;">Event</div><div style="font-size:14px;font-weight:500;">${eventName}</div></div><div><div style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;">Date</div><div style="font-size:14px;font-weight:500;">${dateStr}, 2026</div></div><div><div style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;">Call Time</div><div style="font-size:14px;font-weight:500;">08:00 AM</div></div><div><div style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;">Day Rate</div><div style="font-size:14px;font-weight:500;">${formatCurrency(p.rate)}</div></div></div>
    ${status === 'conflict' ? '<div class="conflict-banner">This crew member is double-booked on this date.</div>' : ''}
    <div class="form-group"><label class="form-label">Status</label><select class="form-select"><option ${status==='confirmed'?'selected':''}>Confirmed</option><option ${status==='pending'?'selected':''}>Pending</option><option>Cancelled</option></select></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Add notes…"></textarea></div>
  `, `<button class="btn btn-danger btn-sm" onclick="showConfirm('Remove Assignment','Remove ${p.name} from ${eventName}?',()=>showToast('Removed','error'))">Remove</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="showToast('Updated!','success');closeModal();">Save</button>`);
}

function openConflictResolutionModal() {
  const p = getPersonnel('p5');
  openModal('Resolve Scheduling Conflict', `
    <div class="conflict-banner" style="margin-bottom:16px;"><strong>${p.name}</strong> is assigned to two events on Feb 16-17.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="card" style="border:2px solid var(--accent-blue);"><div style="font-weight:600;margin-bottom:4px;">NBA All-Star Weekend</div><div style="font-size:12px;color:var(--text-tertiary);">Feb 14–16 · Atlanta</div></div>
      <div class="card" style="border:2px solid var(--accent-purple);"><div style="font-weight:600;margin-bottom:4px;">Super Bowl LXI Pre-Show</div><div style="font-size:12px;color:var(--text-tertiary);">Feb 8–9 · Los Angeles</div></div>
    </div>
    <div class="form-group"><label class="form-label">Resolution</label>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:10px;border:1px solid var(--border-default);"><input type="radio" name="resolve" checked style="margin-top:2px;"><div><strong>Keep NBA All-Star</strong><div style="font-size:11px;color:var(--text-tertiary);">Remove from Super Bowl</div></div></label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:10px;border:1px solid var(--border-default);"><input type="radio" name="resolve" style="margin-top:2px;"><div><strong>Keep Super Bowl LXI</strong><div style="font-size:11px;color:var(--text-tertiary);">Remove from NBA All-Star</div></div></label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:10px;border:1px solid var(--border-default);"><input type="radio" name="resolve" style="margin-top:2px;"><div><strong>Find replacement</strong><div style="font-size:11px;color:var(--text-tertiary);">Suggest available Lighting Designers</div></div></label>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Conflict resolved!','success');closeModal();">Apply</button>`);
}

function openTravelDetailModal(travelId) {
  const tr = TRAVEL_RECORDS.find(t => t.id === travelId); if (!tr) return;
  const person = getPersonnel(tr.personnel); const ev = EVENTS.find(e => e.id === tr.event);
  const travelIconKey = {flight:'travelFlight',hotel:'travelHotel',self_drive:'travelSelfDrive'}[tr.type] || 'travelLocation';
  const statusC = {booked:'var(--accent-blue)',confirmed:'var(--accent-green)',pending:'var(--accent-amber)'};
  openModal('Travel Record', `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);"><div style="font-size:28px;">${uiIcon(travelIconKey)}</div><div style="flex:1;"><div style="font-size:16px;font-weight:600;">${tr.from}${tr.to?' → '+tr.to:''}</div><div style="font-size:12px;color:var(--text-tertiary);">${person.name} · ${ev.name}</div></div><span class="phase-badge" style="background:${statusC[tr.status]||'var(--accent-amber)'}20;color:${statusC[tr.status]||'var(--accent-amber)'};">${tr.status}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option ${tr.type==='flight'?'selected':''}>Flight</option><option ${tr.type==='hotel'?'selected':''}>Hotel</option><option ${tr.type==='self_drive'?'selected':''}>Self-Drive</option></select></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-select"><option ${tr.status==='pending'?'selected':''}>Pending</option><option ${tr.status==='booked'?'selected':''}>Booked</option><option ${tr.status==='confirmed'?'selected':''}>Confirmed</option><option>Cancelled</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" value="${tr.date}"></div>
      <div class="form-group"><label class="form-label">Cost ($)</label><input type="number" class="form-input" value="${tr.cost}"></div>
    </div>
    ${tr.airline?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div class="form-group"><label class="form-label">Airline</label><input type="text" class="form-input" value="${tr.airline}"></div><div class="form-group"><label class="form-label">Flight #</label><input type="text" class="form-input" value="${tr.flight}"></div></div>`:''}
    <div class="form-group"><label class="form-label">Confirmation #</label><input type="text" class="form-input" placeholder="e.g. ABC123"></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Special requests…"></textarea></div>
  `, `<button class="btn btn-danger btn-sm" onclick="showConfirm('Delete','Delete this travel record?',()=>showToast('Deleted','error'))">Delete</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Updated!','success');closeModal();">Save</button>`);
}

function openExportModal(title) {
  openModal('Export: ' + title, `
    <div class="form-group"><label class="form-label">Format</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${['PDF','Excel (.xlsx)','CSV'].map((f,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);"><div style="font-size:18px;margin-bottom:4px;">${['📄','📊','📋'][i]}</div><div style="font-size:12px;font-weight:600;">${f}</div></div>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">Include</label><div style="display:flex;flex-direction:column;gap:8px;"><label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Summary</label><label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Detail breakdown</label><label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Charts</label></div></div>
    <div class="form-group"><label class="form-label">Email to (optional)</label><input type="email" class="form-input" placeholder="recipient@company.com"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Exported!','success');closeModal();">Export</button>`);
}

function openSettlementModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId); const client = getClient(ev.client);
  openModal('Settle: ' + ev.name, `
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">${client.name} · ${getVenue(ev.venue).name}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Budget</div><div style="font-size:18px;font-weight:700;">${formatCurrency(ev.budget)}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Spent</div><div style="font-size:18px;font-weight:700;color:var(--accent-amber);">${formatCurrency(ev.spent)}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Variance</div><div style="font-size:18px;font-weight:700;color:var(--accent-green);">+${formatCurrency(ev.budget-ev.spent)}</div></div>
    </div>
    <div class="form-group"><label class="form-label">Checklist</label><div style="display:flex;flex-direction:column;gap:8px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Timesheets verified</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Travel reconciled</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Vendor invoices collected</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Equipment returns confirmed</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Client approval</label>
    </div></div>
    <div class="form-group"><label class="form-label">Adjustment ($)</label><input type="number" class="form-input" value="0"></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Settlement notes…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('${ev.name} settled!','success');closeModal();">Mark Settled</button>`);
}

function openSettlementReportModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId); const client = getClient(ev.client);
  const l=Math.round(ev.spent*.45),eq=Math.round(ev.spent*.22),tr=Math.round(ev.spent*.18),ot=ev.spent-l-eq-tr;
  openModal('Settlement Report: ' + ev.name, `
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">${client.name} · ${getVenue(ev.venue).name} · ${formatDate(ev.startDate)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Budget</div><div style="font-size:18px;font-weight:700;">${formatCurrency(ev.budget)}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Final Cost</div><div style="font-size:18px;font-weight:700;">${formatCurrency(ev.spent)}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Under Budget</div><div style="font-size:18px;font-weight:700;color:var(--accent-green);">+${formatCurrency(ev.budget-ev.spent)}</div></div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th style="text-align:right;">Amount</th><th style="text-align:right;">%</th></tr></thead><tbody>
      <tr><td>Labor</td><td style="text-align:right;">${formatCurrency(l)}</td><td style="text-align:right;">45%</td></tr>
      <tr><td>Equipment</td><td style="text-align:right;">${formatCurrency(eq)}</td><td style="text-align:right;">22%</td></tr>
      <tr><td>Travel</td><td style="text-align:right;">${formatCurrency(tr)}</td><td style="text-align:right;">18%</td></tr>
      <tr><td>Other</td><td style="text-align:right;">${formatCurrency(ot)}</td><td style="text-align:right;">15%</td></tr>
      <tr style="font-weight:700;"><td>Total</td><td style="text-align:right;">${formatCurrency(ev.spent)}</td><td style="text-align:right;">100%</td></tr>
    </tbody></table></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="closeModal();setTimeout(()=>openExportModal('Settlement — ${ev.name}'),150)">Export</button>`);
}

function openCreateInvoiceModal() {
  openModal('New Invoice', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Client</label><select class="form-select"><option value="">Select…</option>${CLIENTS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Event</label><select class="form-select"><option value="">Select…</option>${EVENTS.filter(e => !['settled','archived'].includes(e.phase)).map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Invoice #</label><input type="text" class="form-input" placeholder="INV-2026-005"></div>
      <div class="form-group"><label class="form-label">Due date</label><input type="date" class="form-input"></div>
    </div>
    <div class="form-group"><label class="form-label">Line items</label></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>
      <tr><td><input type="text" class="form-input" placeholder="Description" style="width:100%;"></td><td><input type="number" class="form-input" value="1" style="width:60px;"></td><td><input type="number" class="form-input" placeholder="0" style="width:100px;"></td><td><span style="font-weight:500;">$0</span></td></tr>
      <tr><td colspan="4"><button class="btn btn-ghost btn-sm">+ Add line</button></td></tr>
    </tbody></table></div>
    <div style="margin-top:12px;text-align:right;"><strong>Subtotal: $0</strong></div>
    <div class="form-group" style="margin-top:16px;"><label class="form-label">Notes / Payment terms</label><textarea class="form-textarea" placeholder="Net 30, payment address…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Invoice saved as draft','success');closeModal();">Save as Draft</button><button class="btn btn-secondary" onclick="showToast('Invoice sent!','success');closeModal();">Save & Send</button>`);
}

function openEditInvoiceModal(invoiceId) {
  const inv = INVOICES.find(i => i.id === invoiceId);
  if (!inv) return;
  const ev = EVENTS.find(e => e.id === inv.event);
  const client = getClient(inv.client);
  const isDraft = inv.status === 'draft';
  openModal('Edit Invoice — ' + inv.number, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Client</label><select class="form-select" ${!isDraft ? 'disabled' : ''}>${CLIENTS.map(c => `<option value="${c.id}" ${inv.client===c.id?'selected':''}>${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Event</label><select class="form-select" ${!isDraft ? 'disabled' : ''}>${EVENTS.map(e => `<option value="${e.id}" ${inv.event===e.id?'selected':''}>${e.name}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Invoice #</label><input type="text" class="form-input" value="${inv.number}" ${!isDraft ? 'readonly' : ''}></div>
      <div class="form-group"><label class="form-label">Due date</label><input type="date" class="form-input" value="${inv.dueDate}" ${!isDraft ? 'readonly' : ''}></div>
    </div>
    <div style="margin-bottom:8px;"><strong>Status:</strong> <span class="phase-badge" style="font-size:11px;">${inv.status}</span></div>
    <div class="form-group"><label class="form-label">Line items</label></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>
      ${inv.lineItems.map(li => `<tr><td>${li.description}</td><td>${li.quantity}</td><td>${formatCurrency(li.unitPrice)}</td><td><strong>${formatCurrency(li.total)}</strong></td></tr>`).join('')}
      ${isDraft ? '<tr><td colspan="4"><button class="btn btn-ghost btn-sm">+ Add line</button></td></tr>' : ''}
    </tbody></table></div>
    <div style="margin-top:12px;text-align:right;"><strong>Total: ${formatCurrency(inv.amount)}</strong></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>${isDraft ? `<button class="btn btn-primary" onclick="showToast('Invoice updated','success');closeModal();">Save</button><button class="btn btn-secondary" onclick="showToast('Sent!','success');closeModal();">Send</button>` : `<button class="btn btn-primary" onclick="closeModal()">Close</button>`}`);
}

function openUploadDocModal() {
  openModal('Upload Document', `
    <div style="border:2px dashed var(--border-default);padding:40px;text-align:center;margin-bottom:16px;cursor:pointer;transition:border-color 200ms,background 200ms;" onmouseover="this.style.borderColor='var(--accent-blue)';this.style.background='rgba(59,130,246,0.05)'" onmouseout="this.style.borderColor='var(--border-default)';this.style.background='transparent'" onclick="this.innerHTML='<div style=\\'font-size:32px;margin-bottom:8px;\\'>✅</div><div style=\\'font-weight:500;color:var(--accent-green);\\'>crew-pack-v3.pdf selected</div><div style=\\'font-size:12px;color:var(--text-tertiary);margin-top:4px;\\'>2.4 MB · PDF</div>'"><div style="font-size:32px;margin-bottom:8px;">📁</div><div style="font-weight:500;margin-bottom:4px;">Click to browse or drag files here</div><div style="font-size:12px;color:var(--text-tertiary);">PDF, XLSX, DOCX, PNG, JPG up to 25 MB</div></div>
    <div class="form-group"><label class="form-label">Event</label><select class="form-select"><option value="">Select…</option>${EVENTS.map(e => `<option>${e.name}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option>Rider</option><option>Crew Pack</option><option>Day Sheet</option><option>Manifest</option><option>Contract</option><option>Other</option></select></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Description…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Uploaded!','success');closeModal();">Upload</button>`);
}

function openEmailDocModal(docName) {
  openModal('Email Document', `
    <div style="margin-bottom:12px;font-weight:500;">📄 ${docName}</div>
    <div class="form-group"><label class="form-label">To</label><input type="email" class="form-input" placeholder="recipient@company.com"></div>
    <div class="form-group"><label class="form-label">CC</label><input type="email" class="form-input" placeholder="cc@company.com"></div>
    <div class="form-group"><label class="form-label">Subject</label><input type="text" class="form-input" value="${docName}"></div>
    <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea">Please find attached: ${docName}</textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Email sent!','success');closeModal();">Send</button>`);
}

function openSendEmailModal(context, eventId, templateId) {
  const ev = eventId ? EVENTS.find(e => e.id === eventId) : (EVENTS[0] || null);
  const venue = ev ? getVenue(ev.venue) : null;
  const client = ev ? getClient(ev.client) : null;
  const template = templateId ? (EMAIL_TEMPLATES || []).find(t => t.id === templateId) : (EMAIL_TEMPLATES || []).find(t => t.context === context) || (EMAIL_TEMPLATES || [])[0];
  const fill = (str) => {
    if (!str || !ev) return str || '';
    return str
      .replace(/\{\{eventName\}\}/g, ev.name)
      .replace(/\{\{startDate\}\}/g, formatDate(ev.startDate))
      .replace(/\{\{endDate\}\}/g, formatDate(ev.endDate))
      .replace(/\{\{venueName\}\}/g, venue ? venue.name : '')
      .replace(/\{\{venueCity\}\}/g, venue ? venue.city : '');
  };
  const subject = template ? fill(template.subject) : 'Update: ' + (ev ? ev.name : '');
  const body = template ? fill(template.body) : (ev ? `Hi,\n\nUpdate regarding ${ev.name}.\n\n` : '');
  const eventOptions = EVENTS.map(e => `<option value="${e.id}" ${ev && ev.id === e.id ? 'selected' : ''}>${e.name}</option>`).join('');
  openModal('Send Email — ' + (template ? template.name : 'Draft'), `
    <div class="form-group"><label class="form-label">Event</label><select class="form-select" id="sendEmailEvent">${eventOptions}</select></div>
    <div class="form-group"><label class="form-label">To</label><input type="text" class="form-input" id="sendEmailTo" placeholder="Crew, client, or enter addresses…"></div>
    <div class="form-group"><label class="form-label">Subject</label><input type="text" class="form-input" id="sendEmailSubject" value="${(subject || '').replace(/"/g, '&quot;')}"></div>
    <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="sendEmailBody" rows="8">${(body || '').replace(/<\/textarea>/gi, '</\u200Btextarea>')}</textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-secondary" onclick="var s=document.getElementById('sendEmailSubject');var b=document.getElementById('sendEmailBody');if(s&&b){navigator.clipboard&&navigator.clipboard.writeText(s.value+'\\n\\n'+b.value);showToast('Copied to clipboard','success');}">Copy draft</button><button class="btn btn-primary" onclick="showToast('Email sent!','success');closeModal();">Send</button>`);
}

function openDownloadModal(docName) {
  openModal('Download: ' + docName, `
    <div class="form-group"><label class="form-label">Format</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${['PDF','Excel','Print'].map((f,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);"><div style="font-size:18px;margin-bottom:4px;">${['📄','📊','🖨️'][i]}</div><div style="font-size:12px;font-weight:600;">${f}</div></div>`).join('')}</div></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Downloading…','success');closeModal();">Download</button>`);
}

function openRegenerateModal(docId) {
  const doc = DOCUMENTS.find(d => d.id === docId); if (!doc) return;
  openModal('Regenerate: ' + doc.name, `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">This will create v${doc.version+1} with the latest data. Current version will be archived.</p>
    <div class="form-group"><label class="form-label">Template</label><select class="form-select"><option>Default</option><option>Compact</option><option>Detailed</option></select></div>
    <div class="form-group"><label class="form-label">Options</label><div style="display:flex;flex-direction:column;gap:8px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Latest crew</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Latest travel</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Auto-email to crew</label>
    </div></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Regenerated as v${doc.version+1}!','success');closeModal();">Regenerate</button>`);
}

function openTemplateEditorModal(name, desc) {
  openModal('Edit Template: ' + name, `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" value="${name}"></div>
    <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea">${desc}</textarea></div>
    <div class="form-group"><label class="form-label">Layout</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${['Portrait','Landscape','Auto'].map((f,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:12px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);"><div style="font-size:12px;font-weight:600;">${f}</div></div>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">Sections</label><div style="display:flex;flex-direction:column;gap:8px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Header</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Crew list</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Schedule</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Contacts</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Venue map</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Financials</label>
    </div></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Template saved!','success');closeModal();">Save</button>`);
}

function openAddCustomFieldModal() {
  openModal('Add Custom Field', `
    <div class="form-group"><label class="form-label">Entity</label><select class="form-select"><option>Event</option><option>Personnel</option><option>Venue</option><option>Truck</option><option>Client</option></select></div>
    <div class="form-group"><label class="form-label">Field Name</label><input type="text" class="form-input" placeholder="e.g. Show Caller"></div>
    <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option>Text</option><option>Number</option><option>Currency</option><option>Date</option><option>Time</option><option>Boolean</option><option>Single Select</option><option>Multi Select</option><option>Tags</option><option>URL</option><option>Email</option></select></div>
    <div class="form-group"><label class="form-label">Options (for Select)</label><textarea class="form-textarea" placeholder="One per line…"></textarea></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox"> Required</label>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Field added!','success');closeModal();renderPage('settings');">Add</button>`);
}

function openEditCustomFieldModal(name, entity, type, required) {
  openModal('Edit: ' + name, `
    <div class="form-group"><label class="form-label">Entity</label><select class="form-select"><option ${entity==='Event'?'selected':''}>Event</option><option ${entity==='Personnel'?'selected':''}>Personnel</option><option ${entity==='Venue'?'selected':''}>Venue</option><option ${entity==='Truck'?'selected':''}>Truck</option></select></div>
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" value="${name}"></div>
    <div class="form-group"><label class="form-label">Type</label><select class="form-select"><option ${type==='Text'?'selected':''}>Text</option><option ${type==='Number'?'selected':''}>Number</option><option ${type==='Date'?'selected':''}>Date</option><option ${type==='Time'?'selected':''}>Time</option><option ${type==='Single Select'?'selected':''}>Single Select</option><option ${type==='Multi Select'?'selected':''}>Multi Select</option></select></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox" ${required?'checked':''}> Required</label>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Updated!','success');closeModal();renderPage('settings');">Save</button>`);
}

function openInviteUserModal() {
  openModal('Invite User', `
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" placeholder="user@company.com"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div class="form-group"><label class="form-label">First Name</label><input type="text" class="form-input"></div><div class="form-group"><label class="form-label">Last Name</label><input type="text" class="form-input"></div></div>
    <div class="form-group"><label class="form-label">Role</label><select class="form-select"><option>Production Manager</option><option>Department Head</option><option>Crew Lead</option><option>Crew Member</option><option>Client Viewer</option></select></div>
    <div class="form-group"><label class="form-label">Link to Personnel</label><select class="form-select"><option value="">None</option>${PERSONNEL.map(p => `<option>${p.name}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Welcome Message</label><textarea class="form-textarea" placeholder="Personal note…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Invitation sent!','success');closeModal();">Send Invite</button>`);
}

function openEditUserModal(name, email, role) {
  const roles = ['Tenant Admin','Production Manager','Department Head','Crew Lead','Crew Member','Client Viewer'];
  openModal('Edit: ' + name, `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" value="${name}"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" value="${email}"></div>
    <div class="form-group"><label class="form-label">Role</label><select class="form-select">${roles.map(r => `<option ${r===role?'selected':''}>${r}</option>`).join('')}</select></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox"> Suspend account</label>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('${name} updated!','success');closeModal();">Save</button>`);
}

function openEditRoleModal(roleName) {
  const allPerms = ['View events','Create events','Edit events','Delete events','Manage crew','Manage trucks','View financial','Edit financial','Manage documents','Manage settings','Manage users'];
  const full = ['Tenant Admin']; const high = ['Production Manager'];
  const isAll = full.includes(roleName) || high.includes(roleName);
  openModal('Edit Role: ' + roleName, `
    <div class="form-group"><label class="form-label">Role Name</label><input type="text" class="form-input" value="${roleName}"></div>
    <div class="form-group"><label class="form-label">Permissions</label><div style="display:flex;flex-direction:column;gap:8px;">
      ${allPerms.map(p => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" ${isAll || p==='View events' ? 'checked':''}> ${p}</label>`).join('')}
    </div></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Role updated!','success');closeModal();">Save</button>`);
}

function openConnectIntegrationModal(name, desc) {
  const iconKey = {Slack:'integrationSlack',QuickBooks:'integrationQuickBooks','Outlook Calendar':'integrationOutlook',Dropbox:'integrationDropbox','Public API':'integrationApi'}[name] || 'integrationLink';
  openModal('Connect ' + name, `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);"><div style="font-size:24px;">${uiIcon(iconKey)}</div><div><div style="font-weight:600;">${name}</div><div style="font-size:12px;color:var(--text-tertiary);">${desc}</div></div></div>
    ${name === 'Public API' ? `
      <div class="form-group"><label class="form-label">API Key</label><div style="display:flex;gap:8px;"><input type="text" class="form-input" value="pk_live_xxxxxxxxxxxxxxxx" style="font-family:monospace;" readonly><button class="btn btn-secondary btn-sm" onclick="showToast('Copied!','success')">Copy</button></div></div>
      <div class="form-group"><label class="form-label">Allowed Origins</label><input type="text" class="form-input" placeholder="https://yourdomain.com"></div>
      <div class="form-group"><label class="form-label">Rate Limit</label><select class="form-select"><option>100 req/min</option><option>500 req/min</option><option>1000 req/min</option></select></div>
    ` : `
      <div style="background:var(--bg-tertiary);padding:30px;text-align:center;margin-bottom:16px;">
        <div style="font-weight:500;margin-bottom:8px;">Authorize ${name}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">You'll be redirected to ${name} to grant access</div>
        <button class="btn btn-primary" onclick="showToast('Redirecting to ${name}…','info')">Authorize with ${name}</button>
      </div>
      <div class="form-group"><label class="form-label">Sync</label><div style="display:flex;flex-direction:column;gap:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Auto-sync</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Two-way sync</label>
      </div></div>
    `}
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('${name} connected!','success');closeModal();">Save</button>`);
}

// ============================================
// ADDITIONAL MODALS — Remaining dead buttons
// ============================================

function openRefreshModal() {
  openModal('Refresh Data', `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:40px;margin-bottom:16px;animation:spin 1s linear infinite;">⟳</div>
      <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
      <div style="font-size:14px;font-weight:500;margin-bottom:8px;">Syncing with server…</div>
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:20px;">Pulling latest data from all sources</div>
      <div style="text-align:left;background:var(--bg-tertiary);padding:16px;font-family:monospace;font-size:11px;max-height:200px;overflow-y:auto;">
        <div style="color:var(--accent-green);margin-bottom:4px;">✓ Events synced (${EVENTS.length} records)</div>
        <div style="color:var(--accent-green);margin-bottom:4px;">✓ Personnel synced (${PERSONNEL.length} records)</div>
        <div style="color:var(--accent-green);margin-bottom:4px;">✓ Trucks synced (${TRUCKS.length} records)</div>
        <div style="color:var(--accent-green);margin-bottom:4px;">✓ Travel records synced (${TRAVEL_RECORDS.length} records)</div>
        <div style="color:var(--accent-green);margin-bottom:4px;">✓ Documents synced (${DOCUMENTS.length} records)</div>
        <div style="color:var(--accent-green);margin-bottom:4px;">✓ Financial data synced</div>
        <div style="color:var(--accent-blue);">● Checking for conflicts…</div>
      </div>
    </div>
  `, `<button class="btn btn-primary" onclick="showToast('Data refreshed!','success');closeModal();renderPage(currentPage);">Done</button>`);
}

function openAutoOptimizeModal() {
  const crew = PERSONNEL.length;
  const activeEvts = EVENTS.filter(e => !['settled','archived'].includes(e.phase)).length;
  openModal('Auto-Optimize Schedule', `
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">The optimizer will analyze ${crew} crew members across ${activeEvts} active events to find the best assignment configuration.</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Optimization Goals</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Minimize scheduling conflicts</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Balance workload across crew</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Respect drive-time buffers</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Minimize travel costs</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Prefer same crew for recurring clients</label>
      </div>
      <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Constraints</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="form-group"><label class="form-label">Max consecutive days</label><select class="form-select"><option>5 days</option><option>7 days</option><option selected>10 days</option><option>14 days</option></select></div>
        <div class="form-group"><label class="form-label">Min buffer between events</label><select class="form-select"><option>None</option><option selected>1 day</option><option>2 days</option><option>3 days</option></select></div>
      </div>
      <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Preview of Changes</div>
      <div style="background:var(--bg-tertiary);padding:12px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:12px;">
          <span>Conflicts resolved</span>
          <span style="font-weight:600;color:var(--accent-green);">1 → 0</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:12px;">
          <span>Assignments moved</span>
          <span style="font-weight:600;">3</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:12px;">
          <span>Crew members affected</span>
          <span style="font-weight:600;">2</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;">
          <span>Estimated cost change</span>
          <span style="font-weight:600;color:var(--accent-green);">-$1,200</span>
        </div>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Schedule optimized! 1 conflict resolved.','success');closeModal();renderPage('scheduling');">Apply Optimization</button>`);
}

function openAvatarUploadModal() {
  resetModalWidth();
  closeModal();
  setTimeout(() => {
    openModal('Change Profile Photo', `
      <div style="display:flex;gap:24px;align-items:flex-start;">
        <div style="flex-shrink:0;">
          <div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,var(--accent-blue),var(--accent-cyan));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:40px;color:#fff;margin-bottom:8px;">CM</div>
          <div style="text-align:center;font-size:11px;color:var(--text-tertiary);">Current photo</div>
        </div>
        <div style="flex:1;">
          <div style="border:2px dashed var(--border-default);padding:30px;text-align:center;margin-bottom:12px;cursor:pointer;transition:border-color 200ms;" onmouseover="this.style.borderColor='var(--accent-blue)'" onmouseout="this.style.borderColor='var(--border-default)'" onclick="this.innerHTML='<div style=\\'font-size:24px;margin-bottom:4px;\\'>✅</div><div style=\\'font-weight:500;color:var(--accent-green);font-size:13px;\\'>photo.jpg selected</div>'">
            <div style="font-size:24px;margin-bottom:4px;">📷</div>
            <div style="font-weight:500;font-size:13px;">Click to upload a photo</div>
            <div style="font-size:11px;color:var(--text-tertiary);">JPG, PNG, or GIF up to 5 MB</div>
          </div>
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;">Or choose an avatar color</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${['linear-gradient(135deg,#3b82f6,#06b6d4)','linear-gradient(135deg,#8b5cf6,#ec4899)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#10b981,#06b6d4)','linear-gradient(135deg,#6366f1,#8b5cf6)','linear-gradient(135deg,#f43f5e,#f59e0b)'].map(bg => `
              <div style="width:40px;height:40px;border-radius:50%;background:${bg};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;border:2px solid transparent;transition:border-color 200ms;" onmouseover="this.style.borderColor='var(--text-primary)'" onmouseout="this.style.borderColor='transparent'" onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='transparent');this.style.borderColor='var(--text-primary)';">CM</div>
            `).join('')}
          </div>
        </div>
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Photo updated!','success');closeModal();">Save Photo</button>`);
  }, 150);
}

function open2FAConfigureModal() {
  openModal('Configure Authenticator App', `
    <div style="display:flex;gap:24px;align-items:flex-start;">
      <div style="flex-shrink:0;text-align:center;">
        <div style="width:160px;height:160px;background:var(--bg-tertiary);border:1px solid var(--border-default);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;">
          <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;width:120px;">
            ${Array(64).fill(0).map(() => `<div style="width:100%;aspect-ratio:1;background:${Math.random()>0.5?'var(--text-primary)':'transparent'};"></div>`).join('')}
          </div>
        </div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:6px;">Scan with authenticator app</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Setup Instructions</div>
        <ol style="font-size:13px;color:var(--text-secondary);padding-left:16px;margin-bottom:16px;">
          <li style="margin-bottom:6px;">Open your authenticator app (Google Authenticator, Authy, etc.)</li>
          <li style="margin-bottom:6px;">Scan the QR code on the left</li>
          <li style="margin-bottom:6px;">Enter the 6-digit verification code below</li>
        </ol>
        <div class="form-group"><label class="form-label">Manual entry key</label>
          <div style="display:flex;gap:8px;"><input type="text" class="form-input" value="JBSWY3DPEHPK3PXP" style="font-family:monospace;font-size:12px;" readonly><button class="btn btn-secondary btn-sm" onclick="showToast('Copied!','success')">Copy</button></div>
        </div>
        <div class="form-group"><label class="form-label">Verification Code</label>
          <input type="text" class="form-input" placeholder="Enter 6-digit code" maxlength="6" style="font-family:monospace;font-size:16px;letter-spacing:6px;text-align:center;">
        </div>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('2FA enabled!','success');closeModal();">Verify & Enable</button>`);
}

// ============================================
// EVENT-PAGE MODALS — Book Travel, Add Expense, Generate Doc
// ============================================

function openBookTravelModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const crewOptions = ev.crew.map(cid => getPersonnel(cid)).filter(Boolean);
  openModal('Book Travel — ' + ev.name, `
    <div class="form-group"><label class="form-label">Crew Member</label>
      <select class="form-select"><option value="">Select crew member…</option>${crewOptions.map(p => `<option value="${p.id}">${p.name} — ${p.role}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="form-label">Travel Type</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;" id="travelTypeSelector">
        ${['Flight','Hotel','Ground / Self-Drive'].map((t,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);">
          <div style="font-size:20px;margin-bottom:4px;">${['✈️','🏨','🚗'][i]}</div>
          <div style="font-size:12px;font-weight:600;">${t}</div>
        </div>`).join('')}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">From</label><input type="text" class="form-input" placeholder="Origin city or airport code"></div>
      <div class="form-group"><label class="form-label">To</label><input type="text" class="form-input" placeholder="Destination city or airport code"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" value="${ev.startDate}"></div>
      <div class="form-group"><label class="form-label">Return Date</label><input type="date" class="form-input" value="${ev.endDate}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Airline / Provider</label><input type="text" class="form-input" placeholder="e.g. Delta, Hilton, Enterprise"></div>
      <div class="form-group"><label class="form-label">Confirmation #</label><input type="text" class="form-input" placeholder="e.g. ABC123"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Cost ($)</label><input type="number" class="form-input" placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-select"><option>Pending</option><option>Booked</option><option>Confirmed</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Special requests, dietary needs, loyalty numbers…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Travel booked!','success');closeModal();">Book Travel</button>`);
}

function openAddExpenseModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const categories = ['Labor','Equipment Rental','Travel','Venue','Catering','Materials','Insurance','Permits','Marketing','Miscellaneous'];
  openModal('Add Expense — ' + ev.name, `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" placeholder="e.g. Camera rental — Day 1"></div>
      <div class="form-group"><label class="form-label">Amount ($)</label><input type="number" class="form-input" placeholder="0.00"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Category</label><select class="form-select">${categories.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Vendor / Payee</label><input type="text" class="form-input" placeholder="Company or person name"></div>
      <div class="form-group"><label class="form-label">Payment Method</label><select class="form-select"><option>Company Card</option><option>Wire Transfer</option><option>Check</option><option>Cash</option><option>Petty Cash</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Invoice / Receipt #</label><input type="text" class="form-input" placeholder="INV-0001"></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-select"><option>Pending</option><option>Approved</option><option>Paid</option><option>Reimbursed</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Receipt / Attachment</label>
      <div style="border:2px dashed var(--border-default);padding:24px;text-align:center;cursor:pointer;transition:border-color 200ms;" onmouseover="this.style.borderColor='var(--accent-blue)'" onmouseout="this.style.borderColor='var(--border-default)'" onclick="this.innerHTML='<div style=\\'font-size:20px;margin-bottom:4px;\\'>✅</div><div style=\\'font-weight:500;color:var(--accent-green);font-size:12px;\\'>receipt.pdf selected</div>'">
        <div style="font-size:20px;margin-bottom:4px;">📎</div>
        <div style="font-size:12px;font-weight:500;">Click to attach receipt</div>
        <div style="font-size:11px;color:var(--text-tertiary);">PDF, JPG, PNG up to 10 MB</div>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Additional details…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Expense added!','success');closeModal();">Add Expense</button>`);
}

function openGenerateDocModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const docTypes = [
    { id: 'crew_pack', label: 'Crew Pack', desc: 'Complete crew info, schedule, contacts, and logistics', icon: '📋' },
    { id: 'day_sheet', label: 'Day Sheet', desc: 'Daily call sheet with times, assignments, and notes', icon: '📄' },
    { id: 'call_sheet', label: 'Call Sheet', desc: 'Crew call times, locations, and department notes', icon: '📞' },
    { id: 'manifest', label: 'Manifest', desc: 'Travel and lodging summary for all crew', icon: '✈️' },
    { id: 'budget_report', label: 'Budget Report', desc: 'Financial breakdown with category spending', icon: '💰' },
    { id: 'crew_list', label: 'Crew List', desc: 'Roster with contact info and assignments', icon: '👥' },
  ];
  openModal('Generate Document — ' + ev.name, `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Select a document type to generate with the latest event data.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
      ${docTypes.map((dt, i) => `
        <div onclick="this.parentElement.querySelectorAll('.gen-doc-opt').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" class="gen-doc-opt" style="cursor:pointer;padding:14px;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);display:flex;gap:10px;align-items:flex-start;">
          <div style="font-size:22px;">${dt.icon}</div>
          <div><div style="font-weight:600;font-size:13px;">${dt.label}</div><div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${dt.desc}</div></div>
        </div>
      `).join('')}
    </div>
    <div class="form-group"><label class="form-label">Template</label><select class="form-select"><option>Default</option><option>Compact</option><option>Detailed</option><option>Client-Facing</option></select></div>
    <div class="form-group"><label class="form-label">Format</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${['PDF','Excel','Print'].map((f,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:10px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);"><div style="font-size:12px;font-weight:600;">${f}</div></div>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Options</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Include company branding</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Include latest crew assignments</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Auto-email to crew on generate</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Include venue maps / diagrams</label>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Document generated!','success');closeModal();">Generate</button>`);
}

// ============================================
// CALENDAR — Add/Edit Event on Date
// ============================================

function openCalendarDayModal(dateStr, existingEvents) {
  const formatted = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const evList = existingEvents ? existingEvents.split('|||').filter(Boolean) : [];
  const evObjects = evList.map(eid => EVENTS.find(e => e.id === eid)).filter(Boolean);

  const body = `
    <div style="margin-bottom:16px;">
      <div style="font-size:15px;font-weight:600;margin-bottom:4px;">${formatted}</div>
      <div style="font-size:12px;color:var(--text-tertiary);">${evObjects.length} event${evObjects.length !== 1 ? 's' : ''} on this day</div>
    </div>

    ${evObjects.length > 0 ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:8px;">Events on this day</div>
        ${evObjects.map(ev => {
          const client = getClient(ev.client);
          const venue = getVenue(ev.venue);
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);margin-bottom:6px;cursor:pointer;border-left:3px solid var(--accent-blue);" onclick="closeModal();setTimeout(()=>navigateToEvent('${ev.id}'),150);">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${ev.name}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">${client.name} · ${venue.name}, ${venue.city}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">${formatDateShort(ev.startDate)} — ${formatDateShort(ev.endDate)}</div>
            </div>
            <span class="phase-badge ${ev.phase}" style="font-size:10px;">${PHASE_LABELS[ev.phase]}</span>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();closeModal();setTimeout(()=>openEditEventModal('${ev.id}'),150);">Edit</button>
          </div>`;
        }).join('')}
      </div>
    ` : ''}

    <div style="border-top:${evObjects.length > 0 ? '1px solid var(--border-subtle);padding-top:16px;' : 'none;'}">
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:12px;">Quick Create Event</div>
      <div class="form-group"><label class="form-label">Event Name</label><input type="text" class="form-input" placeholder="e.g. Corporate Gala 2026"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Client</label><select class="form-select"><option value="">Select…</option>${CLIENTS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Venue</label><select class="form-select"><option value="">Select…</option>${VENUES.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" value="${dateStr}"></div>
        <div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-input" value="${dateStr}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Budget</label><input type="number" class="form-input" placeholder="$0"></div>
        <div class="form-group"><label class="form-label">Priority</label><select class="form-select"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
      </div>
    </div>
  `;

  openModal('Calendar — ' + formatted, body, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="showToast('Event created!','success');closeModal();">Create Event</button>
  `);
}

function openEditEventModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const client = getClient(ev.client);
  const venue = getVenue(ev.venue);
  openModal('Edit Event — ' + ev.name, `
    <div class="form-group"><label class="form-label">Event Name</label><input type="text" class="form-input" value="${ev.name}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Client</label><select class="form-select">${CLIENTS.map(c => `<option value="${c.id}" ${c.id===ev.client?'selected':''}>${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Venue</label><select class="form-select">${VENUES.map(v => `<option value="${v.id}" ${v.id===ev.venue?'selected':''}>${v.name} — ${v.city}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" value="${ev.startDate}"></div>
      <div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-input" value="${ev.endDate}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Budget ($)</label><input type="number" class="form-input" value="${ev.budget}"></div>
      <div class="form-group"><label class="form-label">Priority</label><select class="form-select"><option value="low" ${ev.priority==='low'?'selected':''}>Low</option><option value="medium" ${ev.priority==='medium'?'selected':''}>Medium</option><option value="high" ${ev.priority==='high'?'selected':''}>High</option><option value="critical" ${ev.priority==='critical'?'selected':''}>Critical</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Phase</label><select class="form-select">${PHASES.map(p => `<option value="${p}" ${p===ev.phase?'selected':''}>${PHASE_LABELS[p]}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="Any additional details…"></textarea></div>
  `, `
    <button class="btn btn-danger btn-sm" onclick="showConfirm('Delete Event','Are you sure you want to delete ${ev.name}?',()=>{showToast('Event deleted','error');closeModal();})">Delete</button>
    <div style="flex:1;"></div>
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="showToast('Event updated!','success');closeModal();">Save Changes</button>
  `);
}

function openPrintModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  openModal('Print — ' + ev.name, `
    <div class="form-group"><label class="form-label">What to Print</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Overview & Details</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Crew List</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Running Schedule</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Financial Summary</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Travel Itineraries</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Radio Assignments</label>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Layout</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${['Portrait','Landscape','Auto'].map((f,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:12px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);"><div style="font-size:12px;font-weight:600;">${f}</div></div>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Paper Size</label><select class="form-select"><option selected>Letter (8.5 x 11)</option><option>Legal (8.5 x 14)</option><option>A4</option><option>Tabloid (11 x 17)</option></select></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox" checked> Include company branding</label>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Print preview opened','success');closeModal();">Print</button>`);
}

function openExportCrewListModal(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  openModal('Export Crew List — ' + ev.name, `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Export a crew list for ${ev.name} (${ev.crew.length} members).</p>
    <div class="form-group"><label class="form-label">Format</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${['PDF','Excel (.xlsx)','CSV'].map((f,i) => `<div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='var(--border-default)');this.style.borderColor='var(--accent-blue)';" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${i===0?'var(--accent-blue)':'var(--border-default)'};background:var(--bg-tertiary);"><div style="font-size:18px;margin-bottom:4px;">${['📄','📊','📋'][i]}</div><div style="font-size:12px;font-weight:600;">${f}</div></div>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Include</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Contact info (phone, email)</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Department & role</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" checked> Day rates</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Emergency contact</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Travel & hotel info</label>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Email to (optional)</label><input type="email" class="form-input" placeholder="recipient@company.com"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Crew list exported!','success');closeModal();">Export</button>`);
}

// ============================================
// RUNNING SCHEDULE — Add Custom Row / Section
// ============================================

function openAddCustomRowModal() {
  openModal('Add Custom Row', `
    <div class="form-group"><label class="form-label">Row Label</label><input type="text" class="form-input" placeholder="e.g. Show Caller, Greenroom Contact"></div>
    <div class="form-group"><label class="form-label">Section</label><select class="form-select"><option>General Info</option><option>Production</option><option>Audio</option><option>Video</option><option>Lighting</option><option>Transportation</option><option>Catering</option><option>Custom</option></select></div>
    <div class="form-group"><label class="form-label">Default Value</label><input type="text" class="form-input" placeholder="Default text for all dates (optional)"></div>
    <div class="form-group"><label class="form-label">Position</label><select class="form-select"><option>At end of section</option><option>At top of section</option></select></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox"> Apply to all dates</label>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Custom row added!','success');closeModal();">Add Row</button>`);
}

function openAddCustomSectionModal() {
  openModal('Add Custom Section', `
    <div class="form-group"><label class="form-label">Section Name</label><input type="text" class="form-input" placeholder="e.g. Greenroom, VIP, Stage B"></div>
    <div class="form-group"><label class="form-label">Color</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'].map((c, i) => `
          <div onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.outline='none');this.style.outline='2px solid var(--text-primary)';" style="width:32px;height:32px;border-radius:6px;background:${c};cursor:pointer;${i===0?'outline:2px solid var(--text-primary);':''}"></div>
        `).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Initial Rows</label><textarea class="form-textarea" placeholder="One row label per line, e.g.:\nStage Manager\nFloor Director\nPrompter"></textarea></div>
    <div class="form-group"><label class="form-label">Position</label><select class="form-select"><option>At end</option><option>After General Info</option><option>Before Transportation</option></select></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Section added!','success');closeModal();">Add Section</button>`);
}

// ============================================
// COMPANY PROFILE — Upload Logo, Invite, Edit Member, Billing
// ============================================

function openCompanyLogoUploadModal() {
  openModal('Change Company Logo', `
    <div style="display:flex;gap:24px;align-items:flex-start;">
      <div style="flex-shrink:0;text-align:center;">
        <div style="width:100px;height:100px;border-radius:12px;background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:32px;color:#fff;margin-bottom:8px;">AC</div>
        <div style="font-size:11px;color:var(--text-tertiary);">Current logo</div>
      </div>
      <div style="flex:1;">
        <div style="border:2px dashed var(--border-default);padding:30px;text-align:center;cursor:pointer;transition:border-color 200ms;" onmouseover="this.style.borderColor='var(--accent-blue)'" onmouseout="this.style.borderColor='var(--border-default)'" onclick="this.innerHTML='<div style=\\'font-size:24px;margin-bottom:4px;\\'>✅</div><div style=\\'font-weight:500;color:var(--accent-green);font-size:13px;\\'>logo.png selected</div><div style=\\'font-size:11px;color:var(--text-tertiary);margin-top:2px;\\'>256x256 · 48 KB</div>'">
          <div style="font-size:24px;margin-bottom:4px;">🖼️</div>
          <div style="font-weight:500;font-size:13px;">Click to upload logo</div>
          <div style="font-size:11px;color:var(--text-tertiary);">PNG, SVG, or JPG · 256x256px recommended</div>
        </div>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Logo updated!','success');closeModal();">Save Logo</button>`);
}

function openCompanyInviteMemberModal() {
  openModal('Invite Team Member', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">First Name</label><input type="text" class="form-input" placeholder="John"></div>
      <div class="form-group"><label class="form-label">Last Name</label><input type="text" class="form-input" placeholder="Doe"></div>
    </div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" placeholder="john@acmeproductions.com"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Role / Title</label><input type="text" class="form-input" placeholder="e.g. Production Coordinator"></div>
      <div class="form-group"><label class="form-label">Access Level</label><select class="form-select"><option>Admin</option><option selected>Manager</option><option>Crew</option><option>Client Viewer</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Link to Personnel Record</label><select class="form-select"><option value="">None — create new</option>${PERSONNEL.map(p => `<option value="${p.id}">${p.name} — ${p.role}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Welcome Message (optional)</label><textarea class="form-textarea" placeholder="Personal note included in the invite email…"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Invitation sent!','success');closeModal();">Send Invite</button>`);
}

function openCompanyEditMemberModal(name, role, email, access) {
  const accessLevels = ['Admin','Manager','Crew','Client Viewer'];
  openModal('Edit Team Member — ' + name, `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-blue);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;color:#fff;">${name.split(' ').map(w=>w[0]).join('')}</div>
      <div><div style="font-weight:600;">${name}</div><div style="font-size:12px;color:var(--text-tertiary);">${email}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">First Name</label><input type="text" class="form-input" value="${name.split(' ')[0]}"></div>
      <div class="form-group"><label class="form-label">Last Name</label><input type="text" class="form-input" value="${name.split(' ').slice(1).join(' ')}"></div>
    </div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" value="${email}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Role / Title</label><input type="text" class="form-input" value="${role}"></div>
      <div class="form-group"><label class="form-label">Access Level</label><select class="form-select">${accessLevels.map(a => `<option ${a===access?'selected':''}>${a}</option>`).join('')}</select></div>
    </div>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Suspend account</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox"> Reset password on next login</label>
    </div>
  `, `
    <button class="btn btn-danger btn-sm" onclick="showConfirm('Remove Member','Remove ${name} from the team?',()=>{showToast('Member removed','warning');closeModal();})">Remove</button>
    <div style="flex:1;"></div>
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="showToast('${name} updated!','success');closeModal();">Save</button>
  `);
}

function openUpdatePaymentModal() {
  openModal('Update Payment Method', `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px;background:var(--bg-tertiary);border:1px solid var(--border-default);">
      <div style="font-size:24px;">💳</div>
      <div><div style="font-weight:500;font-size:13px;">Current: Visa ending in 4242</div><div style="font-size:11px;color:var(--text-tertiary);">Expires 08/2028</div></div>
    </div>
    <div class="form-group"><label class="form-label">Card Number</label><input type="text" class="form-input" placeholder="1234 5678 9012 3456" maxlength="19"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Expiry</label><input type="text" class="form-input" placeholder="MM/YY" maxlength="5"></div>
      <div class="form-group"><label class="form-label">CVC</label><input type="text" class="form-input" placeholder="123" maxlength="4"></div>
      <div class="form-group"><label class="form-label">ZIP</label><input type="text" class="form-input" placeholder="10001" maxlength="5"></div>
    </div>
    <div class="form-group"><label class="form-label">Cardholder Name</label><input type="text" class="form-input" placeholder="Name on card"></div>
    <div style="margin-top:8px;padding:12px;background:var(--bg-tertiary);font-size:12px;color:var(--text-tertiary);display:flex;gap:8px;">
      <span>🔒</span><span>Your payment info is encrypted and secure. We never store full card numbers.</span>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Payment method updated!','success');closeModal();">Update Card</button>`);
}

function openUpgradePlanModal() {
  const plans = [
    { name: 'Starter', price: '$49', desc: 'For small teams', features: ['5 users','10 events/month','Basic reports','Email support'], current: false },
    { name: 'Pro', price: '$199', desc: 'For growing companies', features: ['25 users','Unlimited events','Advanced reports','Priority support','API access'], current: true },
    { name: 'Enterprise', price: 'Custom', desc: 'For large operations', features: ['Unlimited users','Unlimited events','Custom integrations','Dedicated support','SLA guarantee','SSO & SAML'], current: false },
  ];
  openModal('Change Plan', `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      ${plans.map(p => `
        <div style="padding:20px;border:2px solid ${p.current ? 'var(--accent-blue)' : 'var(--border-default)'};background:var(--bg-tertiary);text-align:center;position:relative;">
          ${p.current ? '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;background:var(--accent-blue);color:#fff;padding:2px 10px;border-radius:10px;">CURRENT</div>' : ''}
          <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${p.name}</div>
          <div style="font-size:24px;font-weight:800;color:var(--accent-blue);margin-bottom:4px;">${p.price}</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:12px;">${p.price !== 'Custom' ? '/month' : 'pricing'}</div>
          <div style="text-align:left;font-size:12px;color:var(--text-secondary);">
            ${p.features.map(f => `<div style="padding:3px 0;">✓ ${f}</div>`).join('')}
          </div>
          ${!p.current ? `<button class="btn ${p.name==='Enterprise'?'btn-secondary':'btn-primary'} btn-sm" style="width:100%;margin-top:12px;" onclick="showToast('${p.name === 'Enterprise' ? 'Contact sales — we\\'ll reach out!' : 'Plan changed to ' + p.name + '!'}','success');closeModal();">${p.name === 'Enterprise' ? 'Contact Sales' : 'Switch to ' + p.name}</button>` : '<div style="margin-top:12px;font-size:11px;color:var(--text-tertiary);">Your current plan</div>'}
        </div>
      `).join('')}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
}