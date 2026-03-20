/* ============================================
   Module: Settings Page
   Depends on: state.js, data.js, modal.js, router.js
   ============================================ */
function renderSettings() {
  return `
    <div class="page-header"><div><h1 class="page-title">Settings</h1><p class="page-subtitle">Tenant configuration and preferences</p></div></div>
    <div class="tabs">
      ${tabBtn('Appearance', 'settingsTab', 'appearance', 'settings')}
      ${tabBtn('General', 'settingsTab', 'general', 'settings')}
      ${tabBtn('Departments', 'settingsTab', 'departments', 'settings')}
      ${tabBtn('Custom Fields', 'settingsTab', 'customfields', 'settings')}
      ${tabBtn('Users & Roles', 'settingsTab', 'users', 'settings')}
      ${tabBtn('Integrations', 'settingsTab', 'integrations', 'settings')}
      ${tabBtn('Notifications', 'settingsTab', 'notifications', 'settings')}
    </div>
    ${settingsTab === 'appearance' ? renderSettingsAppearance() : settingsTab === 'general' ? renderSettingsGeneral() : settingsTab === 'departments' ? renderSettingsDepartments() : settingsTab === 'customfields' ? renderSettingsCustomFields() : settingsTab === 'users' ? renderSettingsUsers() : settingsTab === 'integrations' ? renderSettingsIntegrations() : renderSettingsNotifications()}
  `;
}

function renderSettingsAppearance() {
  const s = themeSettings;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <p style="color:var(--text-tertiary);font-size:13px;">Customize the look and feel. All changes apply instantly.</p>
      <button class="btn btn-secondary btn-sm" onclick="resetTheme();renderPage('settings');showToast('Theme reset to defaults','success');">Reset to Defaults</button>
    </div>

    <div class="grid-2">
      <!-- Left Column -->
      <div>
        <!-- Theme Mode -->
        <div class="settings-section">
          <h3 class="settings-section-title">Theme Mode</h3>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
            ${['dark','light','midnight','solarized'].map(mode => `
              <div onclick="setTheme('mode','${mode}');renderPage('settings');" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${s.mode === mode ? 'var(--accent-blue)' : 'var(--border-default)'};background:${s.mode === mode ? 'var(--accent-blue-muted)' : 'var(--bg-tertiary)'};transition:all 150ms;">
                <div style="font-size:20px;margin-bottom:6px;">${uiIcon('theme'+mode.charAt(0).toUpperCase()+mode.slice(1))}</div>
                <div style="font-size:12px;font-weight:600;text-transform:capitalize;">${mode}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- UI Icons (emoji on/off for companies that prefer text-only or custom) -->
        <div class="settings-section">
          <h3 class="settings-section-title">UI Icons</h3>
          <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:10px;">Some companies prefer no emoji or custom branding. Turn off to hide all emoji/icons across the app, or keep on for the default set.</p>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" ${getUseEmojiIcons() ? 'checked' : ''} onchange="setUseEmojiIcons(this.checked);renderPage('settings');showToast(this.checked ? 'Emoji icons enabled' : 'Emoji icons disabled','success');">
            <span>Show emoji / icons in UI</span>
          </label>
        </div>

        <!-- Accent Color -->
        <div class="settings-section">
          <h3 class="settings-section-title">Accent Color</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            ${ACCENT_PRESETS.map(p => `
              <div onclick="setTheme('accent','${p.value}');renderPage('settings');" style="cursor:pointer;width:36px;height:36px;background:${p.value};display:flex;align-items:center;justify-content:center;border:2px solid ${s.accent === p.value ? '#fff' : 'transparent'};transition:all 150ms;box-shadow:${s.accent === p.value ? '0 0 0 2px var(--bg-primary), 0 0 0 4px '+p.value : 'none'};" title="${p.name}">
                ${s.accent === p.value ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" style="width:16px;height:16px;"><polyline points="20,6 9,17 4,12"/></svg>' : ''}
              </div>
            `).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <label class="form-label" style="margin:0;white-space:nowrap;">Custom Color:</label>
            <input type="color" value="${s.accent}" onchange="setTheme('accent',this.value);renderPage('settings');" style="width:48px;height:32px;border:1px solid var(--border-default);background:var(--bg-tertiary);cursor:pointer;padding:2px;">
            <input type="text" class="form-input" value="${s.accent}" style="width:100px;font-family:monospace;" onchange="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){setTheme('accent',this.value);renderPage('settings');}">
          </div>
        </div>

        <!-- Phase Colors -->
        <div class="settings-section">
          <h3 class="settings-section-title">Phase Colors</h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${PHASES.map(phase => `
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="color" value="${getComputedStyle(document.documentElement).getPropertyValue('--phase-'+phase).trim() || '#888'}" onchange="document.documentElement.style.setProperty('--phase-${phase}',this.value);showToast('${PHASE_LABELS[phase]} color updated','success');" style="width:32px;height:24px;border:1px solid var(--border-default);background:var(--bg-tertiary);cursor:pointer;padding:1px;">
                <span style="font-size:13px;font-weight:500;min-width:120px;">${PHASE_LABELS[phase]}</span>
                <span class="phase-badge ${phase}">${PHASE_LABELS[phase]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div>
        <!-- Border Radius -->
        <div class="settings-section">
          <h3 class="settings-section-title">Border Radius</h3>
          <div style="display:flex;align-items:center;gap:16px;">
            <input type="range" min="0" max="20" value="${s.radius}" oninput="setTheme('radius',parseInt(this.value));document.getElementById('radiusVal').textContent=this.value+'px';" style="flex:1;accent-color:var(--accent-blue);">
            <span id="radiusVal" style="font-size:13px;font-weight:600;min-width:40px;">${s.radius}px</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            ${[0,4,8,12,16].map(v => `<button class="btn btn-sm ${s.radius === v ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme('radius',${v});renderPage('settings');">${v}px</button>`).join('')}
          </div>
          <div style="margin-top:12px;display:flex;gap:12px;">
            <div style="width:60px;height:40px;background:var(--accent-blue);border-radius:var(--radius-md);"></div>
            <div style="width:60px;height:40px;background:var(--accent-purple);border-radius:var(--radius-lg);"></div>
            <div style="flex:1;height:40px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-md);display:flex;align-items:center;padding:0 12px;font-size:12px;color:var(--text-tertiary);">Preview elements</div>
          </div>
        </div>

        <!-- Font Size -->
        <div class="settings-section">
          <h3 class="settings-section-title">Font Size</h3>
          <div style="display:flex;align-items:center;gap:16px;">
            <input type="range" min="11" max="18" value="${s.fontSize}" oninput="setTheme('fontSize',parseInt(this.value));document.getElementById('fontVal').textContent=this.value+'px';" style="flex:1;accent-color:var(--accent-blue);">
            <span id="fontVal" style="font-size:13px;font-weight:600;min-width:40px;">${s.fontSize}px</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            ${[12,13,14,15,16].map(v => `<button class="btn btn-sm ${s.fontSize === v ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme('fontSize',${v});renderPage('settings');">${v}px</button>`).join('')}
          </div>
        </div>

        <!-- Font Family -->
        <div class="settings-section">
          <h3 class="settings-section-title">Font Family</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${FONT_OPTIONS.map(f => `
              <button class="btn btn-sm ${s.fontFamily === f ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme('fontFamily','${f}');renderPage('settings');" style="font-family:'${f}',sans-serif;">${f}</button>
            `).join('')}
          </div>
        </div>

        <!-- Density -->
        <div class="settings-section">
          <h3 class="settings-section-title">Density</h3>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${['compact','comfortable','spacious'].map(d => `
              <div onclick="setTheme('density','${d}');renderPage('settings');" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${s.density === d ? 'var(--accent-blue)' : 'var(--border-default)'};background:${s.density === d ? 'var(--accent-blue-muted)' : 'var(--bg-tertiary)'};transition:all 150ms;">
                <div style="font-size:16px;margin-bottom:4px;">${uiIcon('density'+d.charAt(0).toUpperCase()+d.slice(1))}</div>
                <div style="font-size:12px;font-weight:600;text-transform:capitalize;">${d}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Sidebar Width -->
        <div class="settings-section">
          <h3 class="settings-section-title">Sidebar Width</h3>
          <div style="display:flex;align-items:center;gap:16px;">
            <input type="range" min="200" max="340" step="10" value="${s.sidebarWidth}" oninput="setTheme('sidebarWidth',parseInt(this.value));document.getElementById('sidebarVal').textContent=this.value+'px';" style="flex:1;accent-color:var(--accent-blue);">
            <span id="sidebarVal" style="font-size:13px;font-weight:600;min-width:50px;">${s.sidebarWidth}px</span>
          </div>
        </div>

        <!-- Live Preview -->
        <div class="settings-section">
          <h3 class="settings-section-title">Preview</h3>
          <div class="card" style="padding:16px;">
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              <button class="btn btn-primary btn-sm">Primary</button>
              <button class="btn btn-secondary btn-sm">Secondary</button>
              <button class="btn btn-ghost btn-sm">Ghost</button>
              <button class="btn btn-danger btn-sm">Danger</button>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              <span class="phase-badge bidding">Bidding</span>
              <span class="phase-badge awarded">Awarded</span>
              <span class="phase-badge live">Live</span>
              <span class="phase-badge settled">Settled</span>
            </div>
            <div class="budget-bar-container">
              <div class="budget-bar-label"><span>Sample Bar</span><span>72%</span></div>
              <div class="budget-bar"><div class="budget-bar-fill blue" style="width:72%;"></div></div>
            </div>
            <div style="margin-top:8px;">
              <span class="assignment-chip confirmed">Confirmed</span>
              <span class="assignment-chip pending">Pending</span>
              <span class="assignment-chip conflict">Conflict</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsGeneral() {
  return `
    <div class="grid-2"><div>
      <div class="settings-section"><h3 class="settings-section-title">Organization</h3>
        <div class="form-group"><label class="form-label">Company Name</label><input type="text" class="form-input" value="Acme Productions"></div>
        <div class="form-group"><label class="form-label">Default Timezone</label><select class="form-select"><option>America/New_York (EST)</option><option>America/Chicago (CST)</option><option>America/Denver (MST)</option><option>America/Los_Angeles (PST)</option></select></div>
        <div class="form-group"><label class="form-label">Currency</label><select class="form-select"><option selected>USD ($)</option><option>EUR</option><option>GBP</option></select></div>
      </div>
      <div class="settings-section"><h3 class="settings-section-title">Scheduling</h3>
        <div class="settings-row"><div><div class="settings-row-label">Conflict Detection</div><div class="settings-row-desc">Detect double-bookings and drive-time violations</div></div><div class="toggle active" onclick="this.classList.toggle('active');showToast(this.classList.contains('active')?'Conflict detection enabled':'Conflict detection disabled','success')"></div></div>
        <div class="settings-row"><div><div class="settings-row-label">Buffer Windows</div><div class="settings-row-desc">Minimum buffer between assignments</div></div><div class="toggle active" onclick="this.classList.toggle('active');showToast(this.classList.contains('active')?'Buffer windows enabled':'Buffer windows disabled','success')"></div></div>
        <div class="settings-row"><div><div class="settings-row-label">Drive Time Buffer (hours)</div><div class="settings-row-desc">Gap for ground transport between venues</div></div><input type="number" class="form-input" value="4" style="width:80px;"></div>
      </div>
    </div><div>
      <div class="settings-section"><h3 class="settings-section-title">Data & Export</h3>
        <div class="settings-row"><div><div class="settings-row-label">Audit Logging</div><div class="settings-row-desc">Record all data changes</div></div><div class="toggle active" onclick="this.classList.toggle('active');showToast(this.classList.contains('active')?'Audit logging enabled':'Audit logging disabled','success')"></div></div>
        <div class="settings-row"><div><div class="settings-row-label">Auto-backup</div><div class="settings-row-desc">Daily database backup</div></div><div class="toggle active" onclick="this.classList.toggle('active');showToast(this.classList.contains('active')?'Auto-backup enabled':'Auto-backup disabled','success')"></div></div>
      </div>
      <div class="settings-section"><h3 class="settings-section-title">Danger Zone</h3>
        <button class="btn btn-danger" onclick="showConfirm('Reset All Data','This will reset all events, crew, and financial data. This cannot be undone.',()=>showToast('All data reset','error'))">Reset All Data</button>
      </div>
    </div></div>
  `;
}

function renderSettingsDepartments() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <p style="color:var(--text-tertiary);font-size:13px;">Manage departments and their colors. Color changes apply everywhere instantly.</p>
      <button class="btn btn-primary btn-sm" onclick="openAddDepartmentModal()">+ Add Department</button>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Color</th><th>Name</th><th>Members</th><th>Actions</th></tr></thead><tbody>
      ${DEPARTMENTS.map((d, i) => { const count = PERSONNEL.filter(p => p.dept === d.id).length; return `<tr>
        <td><input type="color" value="${d.color}" onchange="DEPARTMENTS[${i}].color=this.value;renderPage('settings');showToast('${d.name} color updated','success');" style="width:32px;height:28px;border:1px solid var(--border-default);background:var(--bg-tertiary);cursor:pointer;padding:1px;"></td>
        <td><strong>${d.name}</strong></td>
        <td>${count} crew</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openEditDepartmentModal(${i})">Edit</button><button class="btn btn-ghost btn-sm" onclick="showConfirm('Delete Department','Delete ${d.name}? ${count} members will become unassigned.',()=>{showToast('${d.name} deleted','error');})">Delete</button></td>
      </tr>`; }).join('')}
    </tbody></table></div>
  `;
}

function openAddDepartmentModal() {
  const body = `
    <div class="form-group"><label class="form-label">Department Name</label><input type="text" class="form-input" id="newDeptName" placeholder="e.g. Wardrobe"></div>
    <div class="form-group"><label class="form-label">Color</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <input type="color" id="newDeptColor" value="#6366f1" style="width:48px;height:32px;border:1px solid var(--border-default);background:var(--bg-tertiary);cursor:pointer;padding:2px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#f43f5e'].map(c => `
            <div onclick="document.getElementById('newDeptColor').value='${c}';" style="width:24px;height:24px;background:${c};cursor:pointer;border:1px solid rgba(255,255,255,0.1);"></div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  openModal('Add Department', body, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="addDepartment()">Add Department</button>
  `);
}

function addDepartment() {
  const name = document.getElementById('newDeptName').value.trim();
  const color = document.getElementById('newDeptColor').value;
  if (!name) { showToast('Name is required','warning'); return; }
  DEPARTMENTS.push({ id: 'd' + (DEPARTMENTS.length + 1), name, color });
  showToast(name + ' department added!','success');
  closeModal();
  renderPage('settings');
}

function openEditDepartmentModal(idx) {
  const d = DEPARTMENTS[idx];
  const body = `
    <div class="form-group"><label class="form-label">Department Name</label><input type="text" class="form-input" id="editDeptName" value="${d.name}"></div>
    <div class="form-group"><label class="form-label">Color</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <input type="color" id="editDeptColor" value="${d.color}" style="width:48px;height:32px;border:1px solid var(--border-default);background:var(--bg-tertiary);cursor:pointer;padding:2px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#f43f5e'].map(c => `
            <div onclick="document.getElementById('editDeptColor').value='${c}';" style="width:24px;height:24px;background:${c};cursor:pointer;border:1px solid rgba(255,255,255,0.1);"></div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  openModal('Edit Department: ' + d.name, body, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="DEPARTMENTS[${idx}].name=document.getElementById('editDeptName').value;DEPARTMENTS[${idx}].color=document.getElementById('editDeptColor').value;showToast('Department updated!','success');closeModal();renderPage('settings');">Save</button>
  `);
}

function renderSettingsCustomFields() {
  const fields = [
    { entity: 'Event', name: 'Show Caller', type: 'Text', required: true },
    { entity: 'Event', name: 'Load-In Time', type: 'Time', required: false },
    { entity: 'Event', name: 'Broadcast Network', type: 'Single Select', required: false },
    { entity: 'Personnel', name: 'Shirt Size', type: 'Single Select', required: false },
    { entity: 'Personnel', name: 'Emergency Contact', type: 'Text', required: true },
    { entity: 'Personnel', name: 'Certifications', type: 'Multi Select', required: false },
    { entity: 'Venue', name: 'Loading Dock Info', type: 'Text', required: false },
    { entity: 'Venue', name: 'Power Capacity (Amps)', type: 'Number', required: false },
    { entity: 'Truck', name: 'DOT Expiry', type: 'Date', required: true },
  ];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <p style="color:var(--text-tertiary);font-size:13px;">Define custom fields for events, personnel, venues, and trucks</p>
      <button class="btn btn-primary btn-sm" onclick="openAddCustomFieldModal()">+ Add Field</button>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Entity</th><th>Field Name</th><th>Type</th><th>Required</th><th>Actions</th></tr></thead><tbody>
      ${fields.map(f => `<tr>
        <td><span class="personnel-tag" style="background:var(--bg-tertiary);color:var(--text-secondary);">${f.entity}</span></td>
        <td><strong>${f.name}</strong></td><td>${f.type}</td>
        <td>${f.required ? '<span style="color:var(--accent-green);">Yes</span>' : '<span style="color:var(--text-tertiary);">No</span>'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openEditCustomFieldModal('${f.name}','${f.entity}','${f.type}',${f.required})">Edit</button><button class="btn btn-ghost btn-sm" onclick="showConfirm('Delete Field','Delete the custom field &quot;${f.name}&quot;?',()=>showToast('Field deleted','error'))">Delete</button></td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

function renderSettingsUsers() {
  const users = [
    { name: 'Cody Martin', email: 'cody@acmeproductions.com', role: 'Tenant Admin', status: 'active', initials: 'CM', color: '#3b82f6' },
    { name: 'Alex Johnson', email: 'alex@acmeproductions.com', role: 'Production Manager', status: 'active', initials: 'AJ', color: '#ec4899' },
    { name: 'Jake Wilson', email: 'jake@acmeproductions.com', role: 'Department Head', status: 'active', initials: 'JW', color: '#22c55e' },
    { name: 'Sarah Lee', email: 'sarah@acmeproductions.com', role: 'Crew Member', status: 'active', initials: 'SL', color: '#8b5cf6' },
    { name: 'Mike Thompson', email: 'mike@acmeproductions.com', role: 'Crew Lead', status: 'active', initials: 'MT', color: '#3b82f6' },
    { name: 'Rachel Green', email: 'rachel@acmeproductions.com', role: 'Client Viewer', status: 'invited', initials: 'RG', color: '#f59e0b' },
  ];
  const roles = ['Tenant Admin', 'Production Manager', 'Department Head', 'Crew Lead', 'Crew Member', 'Client Viewer'];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <p style="color:var(--text-tertiary);font-size:13px;">Manage users and their role-based access</p>
      <button class="btn btn-primary btn-sm" onclick="openInviteUserModal()">+ Invite User</button>
    </div>
    <div style="margin-bottom:20px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Roles</h4>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${roles.map(r => `<span class="personnel-tag" style="background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;" onclick="openEditRoleModal('${r}')">${r}</span>`).join('')}
      </div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${users.map(u => `<tr>
        <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:50%;background:${u.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;">${u.initials}</div><strong>${u.name}</strong></div></td>
        <td style="color:var(--text-tertiary);">${u.email}</td>
        <td>${u.role}</td>
        <td><span class="phase-badge ${u.status === 'active' ? 'settled' : 'bidding'}">${u.status === 'active' ? 'Active' : 'Invited'}</span></td>
        <td><button class="btn btn-ghost btn-sm" onclick="openEditUserModal('${u.name}','${u.email}','${u.role}')">Edit</button>${u.name !== 'Cody Martin' ? `<button class="btn btn-ghost btn-sm" onclick="showConfirm('Remove User','Remove ${u.name} from this tenant?',()=>showToast('User removed','error'))">Remove</button>` : ''}</td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

function renderSettingsIntegrations() {
  const iconKeys = { 'Google Calendar':'integrationGoogleCal', 'Google Drive':'integrationGoogleDrive', 'Slack':'integrationSlack', 'QuickBooks':'integrationQuickBooks', 'Outlook Calendar':'integrationOutlook', 'Dropbox':'integrationDropbox', 'Webhooks':'integrationWebhooks', 'Public API':'integrationApi' };
  const integrations = [
    { name: 'Google Calendar', desc: 'Sync events to Google Calendar', status: 'connected' },
    { name: 'Google Drive', desc: 'Store and sync documents', status: 'connected' },
    { name: 'Slack', desc: 'Send notifications to Slack channels', status: 'disconnected' },
    { name: 'QuickBooks', desc: 'Sync financial data for invoicing', status: 'disconnected' },
    { name: 'Outlook Calendar', desc: 'Sync events to Outlook', status: 'disconnected' },
    { name: 'Dropbox', desc: 'Alternative document storage', status: 'disconnected' },
    { name: 'Webhooks', desc: 'Custom webhooks for external systems', status: 'connected' },
    { name: 'Public API', desc: 'RESTful API access for third parties', status: 'disconnected' },
  ];
  return `
    <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:20px;">Connect external services and manage API access</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${integrations.map(i => `
        <div class="card" style="display:flex;align-items:flex-start;gap:12px;">
          <div style="font-size:24px;flex-shrink:0;">${uiIcon(iconKeys[i.name] || 'integrationLink')}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;margin-bottom:2px;">${i.name}</div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:10px;">${i.desc}</div>
            ${i.status === 'connected' ? `<button class="btn btn-secondary btn-sm" onclick="showConfirm('Disconnect','Disconnect ${i.name}?',()=>showToast('${i.name} disconnected','warning'))">Disconnect</button>` : `<button class="btn btn-primary btn-sm" onclick="openConnectIntegrationModal('${i.name}','${i.desc}')">Connect</button>`}
          </div>
          <div style="width:8px;height:8px;border-radius:50%;background:${i.status === 'connected' ? 'var(--accent-green)' : 'var(--text-tertiary)'};margin-top:4px;flex-shrink:0;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSettingsNotifications() {
  const channels = [
    { label: 'Phase Transitions', desc: 'When an event phase changes', email: true, push: true, slack: false },
    { label: 'Scheduling Conflicts', desc: 'When a conflict is detected', email: true, push: true, slack: true },
    { label: 'Budget Alerts', desc: 'When budget exceeds 80%/90%', email: true, push: false, slack: false },
    { label: 'Crew Assignment Changes', desc: 'When crew is added/removed', email: false, push: true, slack: false },
    { label: 'Travel Updates', desc: 'Flight/hotel confirmations', email: true, push: true, slack: false },
    { label: 'Document Generated', desc: 'When a document is created', email: false, push: true, slack: true },
    { label: 'New Comments', desc: 'When someone comments on an event', email: false, push: true, slack: true },
  ];
  return `
    <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:20px;">Configure notification channels for each event type</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Event Type</th><th>Description</th><th>Email</th><th>Push</th><th>Slack</th></tr></thead><tbody>
      ${channels.map(c => `<tr>
        <td><strong>${c.label}</strong></td>
        <td style="color:var(--text-tertiary);font-size:12px;">${c.desc}</td>
        <td><div class="toggle ${c.email ? 'active' : ''}" onclick="this.classList.toggle('active');showToast('Email '+( this.classList.contains('active')?'enabled':'disabled'),'success')" style="width:32px;height:18px;"></div></td>
        <td><div class="toggle ${c.push ? 'active' : ''}" onclick="this.classList.toggle('active');showToast('Push '+(this.classList.contains('active')?'enabled':'disabled'),'success')" style="width:32px;height:18px;"></div></td>
        <td><div class="toggle ${c.slack ? 'active' : ''}" onclick="this.classList.toggle('active');showToast('Slack '+(this.classList.contains('active')?'enabled':'disabled'),'success')" style="width:32px;height:18px;"></div></td>
      </tr>`).join('')}
    </tbody></table></div>
    <div class="settings-section" style="margin-top:24px;">
      <h3 class="settings-section-title">Quiet Hours</h3>
      <div class="settings-row"><div><div class="settings-row-label">Enable Quiet Hours</div><div class="settings-row-desc">Suppress non-critical notifications during set hours</div></div><div class="toggle" onclick="this.classList.toggle('active');showToast(this.classList.contains('active')?'Quiet hours enabled':'Quiet hours disabled','success')"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px;">
        <div class="form-group"><label class="form-label">Start Time</label><input type="time" class="form-input" value="22:00"></div>
        <div class="form-group"><label class="form-label">End Time</label><input type="time" class="form-input" value="07:00"></div>
      </div>
    </div>
  `;
}

// ============================================
// GLOBAL MODALS — All missing actions wired up
// ============================================

let profileTab = 'personal';

