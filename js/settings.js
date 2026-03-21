/* ============================================
   Module: Settings Page
   Depends on: state.js, data.js, modal.js, router.js
   ============================================ */
function renderSettings() {
  if (typeof settingsTab !== 'undefined' && settingsTab !== 'notifications' && typeof window !== 'undefined') {
    window.__pldNotificationPrefsRaw = undefined;
    window.__pldNotificationPrefsLoading = false;
  }
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
      ${tabBtn('Time & Pay', 'settingsTab', 'workforce', 'settings')}
    </div>
    ${
      settingsTab === 'appearance'
        ? renderSettingsAppearance()
        : settingsTab === 'general'
          ? renderSettingsGeneral()
          : settingsTab === 'departments'
            ? renderSettingsDepartments()
            : settingsTab === 'customfields'
              ? renderSettingsCustomFields()
              : settingsTab === 'users'
                ? renderSettingsUsers()
                : settingsTab === 'integrations'
                  ? renderSettingsIntegrations()
                  : settingsTab === 'workforce'
                    ? renderSettingsWorkforce()
                    : renderSettingsNotifications()
    }
  `;
}

/** Labels for Settings → Appearance → Custom palette (theme mode = custom). */
const CUSTOM_THEME_COLOR_LABELS = {
  bgPrimary: 'Page background',
  bgSecondary: 'Secondary background',
  bgTertiary: 'Cards / panels',
  bgElevated: 'Elevated surfaces',
  textPrimary: 'Primary text',
  textSecondary: 'Secondary text',
  textTertiary: 'Muted text',
};

function renderSettingsAppearance() {
  const s = themeSettings;
  const cp = { ...THEME_DEFAULTS.customPalette, ...(s.customPalette || {}) };
  const customColorFields = Object.keys(CUSTOM_THEME_COLOR_LABELS);
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
            ${['dark','light','midnight','custom'].map(mode => `
              <div onclick="setTheme('mode','${mode}');renderPage('settings');" style="cursor:pointer;padding:14px;text-align:center;border:2px solid ${s.mode === mode ? 'var(--accent-blue)' : 'var(--border-default)'};background:${s.mode === mode ? 'var(--accent-blue-muted)' : 'var(--bg-tertiary)'};transition:all 150ms;">
                <div style="font-size:20px;margin-bottom:6px;">${uiIcon('theme'+mode.charAt(0).toUpperCase()+mode.slice(1))}</div>
                <div style="font-size:12px;font-weight:600;text-transform:capitalize;">${mode}</div>
              </div>
            `).join('')}
          </div>
          ${
            s.mode === 'custom'
              ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-default);">
            <p style="font-size:12px;color:var(--text-tertiary);margin:0 0 12px;line-height:1.45;">Choose your own backgrounds and text. Border contrast follows the page background. Hover states are derived from the tertiary color.</p>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
              ${customColorFields.map(field => {
                const hex = cp[field] || THEME_DEFAULTS.customPalette[field];
                const safe = String(hex).replace(/"/g, '&quot;');
                const lab = CUSTOM_THEME_COLOR_LABELS[field];
                return `
              <div class="form-group" style="margin:0;">
                <label class="form-label" style="margin-bottom:6px;">${lab}</label>
                <div style="display:flex;align-items:center;gap:10px;">
                  <input type="color" value="${safe}" onchange="setTheme('customPalette',{${field}:this.value});renderPage('settings');" style="width:44px;height:32px;border:1px solid var(--border-default);background:var(--bg-tertiary);cursor:pointer;padding:2px;flex-shrink:0;">
                  <input type="text" class="form-input" value="${safe}" style="flex:1;min-width:0;font-family:monospace;font-size:12px;" onchange="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){setTheme('customPalette',{${field}:this.value});renderPage('settings');}">
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>`
              : ''
          }
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
              <span class="phase-badge planning">Planning</span>
              <span class="phase-badge pre_production">Pre-Production</span>
              <span class="phase-badge production">Production</span>
              <span class="phase-badge closed">Closed</span>
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

/** After `pldRefreshTenantShell`, sync General tab inputs from `window.__pldTenant`. */
function pldHydrateSettingsGeneralInputs() {
  if (typeof settingsTab === 'undefined' || settingsTab !== 'general') return;
  const sn = pldSettingsGeneralSnapshot();
  const n = document.getElementById('pldSettingsTenantName');
  if (n) n.value = sn.name;
  const tz = document.getElementById('pldSettingsTimezone');
  if (tz) tz.value = sn.default_timezone;
  const cur = document.getElementById('pldSettingsCurrency');
  if (cur) cur.value = sn.default_currency;
  const buf = document.getElementById('pldSettingsDriveBuffer');
  if (buf) buf.value = String(sn.drive_time_buffer_hours);
  const tc = document.getElementById('pldSettingsToggleConflict');
  if (tc) {
    tc.classList.toggle('active', sn.conflict_on);
    tc.setAttribute('aria-checked', String(sn.conflict_on));
  }
  const tb = document.getElementById('pldSettingsToggleBuffer');
  if (tb) {
    tb.classList.toggle('active', sn.buffer_on);
    tb.setAttribute('aria-checked', String(sn.buffer_on));
  }
  const ta = document.getElementById('pldSettingsToggleAudit');
  if (ta) {
    ta.classList.toggle('active', sn.audit_on);
    ta.setAttribute('aria-checked', String(sn.audit_on));
  }
  const logo = document.getElementById('pldSettingsLogoUrl');
  if (logo) logo.value = sn.logo_url;
}

function pldSettingsGeneralSnapshot() {
  const t = typeof window !== 'undefined' ? window.__pldTenant : null;
  const s = t && t.settings && typeof t.settings === 'object' ? t.settings : {};
  const f = s.features && typeof s.features === 'object' ? s.features : {};
  const sched = f.scheduling && typeof f.scheduling === 'object' ? f.scheduling : {};
  const de = f.data_export && typeof f.data_export === 'object' ? f.data_export : {};
  const tz = typeof s.default_timezone === 'string' ? s.default_timezone : 'America/New_York';
  const cur = typeof s.default_currency === 'string' ? s.default_currency : 'USD';
  const drive =
    typeof sched.drive_time_buffer_hours === 'number' && !Number.isNaN(sched.drive_time_buffer_hours)
      ? sched.drive_time_buffer_hours
      : 4;
  const branding = s.branding && typeof s.branding === 'object' ? s.branding : {};
  const logo_url =
    branding.logo_url != null && String(branding.logo_url).trim() !== ''
      ? String(branding.logo_url).trim()
      : '';
  return {
    name: t && t.name != null ? String(t.name) : '',
    default_timezone: tz,
    default_currency: cur,
    conflict_on: sched.conflict_detection_enabled !== false,
    buffer_on: sched.buffer_windows_enabled !== false,
    drive_time_buffer_hours: drive,
    audit_on: de.audit_logging_enabled !== false,
    logo_url,
  };
}

function renderSettingsGeneral() {
  const sn = pldSettingsGeneralSnapshot();
  const api =
    typeof PLD_API_BASE === 'string' && PLD_API_BASE.trim() !== '' && typeof pldApiFetch === 'function';
  const tenantName = sn.name.replace(/"/g, '&quot;');
  const tzSel = (val, label) =>
    `<option value="${pldSettingsEsc(val)}"${sn.default_timezone === val ? ' selected' : ''}>${label}</option>`;
  const curSel = (code, label) =>
    `<option value="${code}"${sn.default_currency === code ? ' selected' : ''}>${label}</option>`;
  const tConflict = sn.conflict_on ? 'toggle active' : 'toggle';
  const tBuffer = sn.buffer_on ? 'toggle active' : 'toggle';
  const tAudit = sn.audit_on ? 'toggle active' : 'toggle';
  const logoVal = pldSettingsEsc(sn.logo_url);
  return `
    <div class="grid-2"><div>
      <div class="settings-section"><h3 class="settings-section-title">Organization</h3>
        <p style="font-size:12px;color:var(--text-tertiary);margin:-4px 0 12px;">Saved to the server (<code style="font-size:11px;">PUT /api/v1/tenant</code>). View: <code style="font-size:11px;">tenancy.settings.view</code>. Edit: <code style="font-size:11px;">tenancy.settings.edit</code>.</p>
        <div class="form-group"><label class="form-label">Company Name</label><input type="text" class="form-input" id="pldSettingsTenantName" value="${tenantName}" autocomplete="organization" /></div>
        <div class="form-group"><label class="form-label">App logo URL</label><input type="url" class="form-input" id="pldSettingsLogoUrl" value="${logoVal}" placeholder="https://example.com/logo.png" autocomplete="off" />
        <p style="font-size:11px;color:var(--text-tertiary);margin:4px 0 0;line-height:1.4;">Optional. Sidebar logo; use a public HTTPS image URL. Clear the field and save to restore the built-in default.</p></div>
        <div class="form-group"><label class="form-label">Default Timezone</label><select class="form-select" id="pldSettingsTimezone">
          ${tzSel('America/New_York', 'America/New_York (ET)')}
          ${tzSel('America/Chicago', 'America/Chicago (CT)')}
          ${tzSel('America/Denver', 'America/Denver (MT)')}
          ${tzSel('America/Los_Angeles', 'America/Los_Angeles (PT)')}
          ${tzSel('UTC', 'UTC')}
        </select></div>
        <div class="form-group"><label class="form-label">Currency</label><select class="form-select" id="pldSettingsCurrency">
          ${curSel('USD', 'USD ($)')}
          ${curSel('EUR', 'EUR (€)')}
          ${curSel('GBP', 'GBP (£)')}
        </select></div>
        <button type="button" class="btn btn-primary btn-sm" onclick="void submitSettingsGeneral()">Save changes</button>
      </div>
      <div class="settings-section"><h3 class="settings-section-title">Scheduling</h3>
        <div class="settings-row"><div><div class="settings-row-label">Conflict Detection</div><div class="settings-row-desc">Detect double-bookings and drive-time violations</div></div><div class="${tConflict}" id="pldSettingsToggleConflict" role="switch" aria-checked="${sn.conflict_on}" onclick="this.classList.toggle('active');this.setAttribute('aria-checked',this.classList.contains('active'))"></div></div>
        <div class="settings-row"><div><div class="settings-row-label">Buffer Windows</div><div class="settings-row-desc">Minimum buffer between assignments (double-booking soft conflicts)</div></div><div class="${tBuffer}" id="pldSettingsToggleBuffer" role="switch" aria-checked="${sn.buffer_on}" onclick="this.classList.toggle('active');this.setAttribute('aria-checked',this.classList.contains('active'))"></div></div>
        <div class="settings-row"><div><div class="settings-row-label">Drive Time Buffer (hours)</div><div class="settings-row-desc">Extra hours beyond computed drive time between consecutive gigs</div></div><input type="number" class="form-input" id="pldSettingsDriveBuffer" value="${sn.drive_time_buffer_hours}" min="0" max="168" step="0.5" style="width:80px;"></div>
      </div>
    </div><div>
      <div class="settings-section"><h3 class="settings-section-title">Data & Export</h3>
        <div class="settings-row"><div><div class="settings-row-label">Audit Logging</div><div class="settings-row-desc">Record data changes in audit log tables</div></div><div class="${tAudit}" id="pldSettingsToggleAudit" role="switch" aria-checked="${sn.audit_on}" onclick="this.classList.toggle('active');this.setAttribute('aria-checked',this.classList.contains('active'))"></div></div>
        <p style="font-size:12px;color:var(--text-tertiary);margin:0;">Database backups are configured by deployment / ops (not from this screen).</p>
      </div>
      <div class="settings-section"><h3 class="settings-section-title">Danger Zone</h3>
        <p style="font-size:12px;color:var(--text-tertiary);margin:-4px 0 10px;">Permanently deletes <strong>all</strong> operational data for this tenant in PostgreSQL (events, clients, personnel, documents, travel, …). <strong>Users and roles are kept</strong> so you can sign in again. Requires <code style="font-size:11px;">tenancy.settings.edit</code> and <code style="font-size:11px;">POST /api/v1/tenant/reset-data</code> with body <code style="font-size:11px;">{ "confirm": "RESET" }</code>.</p>
        <p style="font-size:11px;color:var(--text-tertiary);margin:0 0 10px;">Production APIs must set <code style="font-size:11px;">PLD_ALLOW_TENANT_DATA_RESET=1</code> or the request returns 403.</p>
        <button type="button" class="btn btn-danger" onclick="openTenantResetConfirmModal()" ${api ? '' : 'disabled title="Configure API base and sign in"'}>Reset all data</button>
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border-default);">
          <h4 style="font-size:13px;margin:0 0 8px;font-weight:600;">Restore soft-deleted event</h4>
          <p style="font-size:12px;color:var(--text-tertiary);margin:-4px 0 10px;line-height:1.45;">Brings back an event that was soft-deleted. Requires <code style="font-size:11px;">tenancy.settings.edit</code> (<code style="font-size:11px;">POST /api/v1/events/:id/restore</code>). You need the event UUID (e.g. from audit or support).</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <input type="text" class="form-input" id="pldSettingsRestoreEventId" placeholder="Event UUID" autocomplete="off" style="min-width:260px;flex:1;max-width:420px;" />
            <button type="button" class="btn btn-secondary btn-sm" onclick="void submitRestoreSoftDeletedEventFromSettings()" ${api ? '' : 'disabled title="Configure API base and sign in"'}>Restore event</button>
          </div>
        </div>
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

function pldSettingsEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** JSON string literal safe inside a double-quoted HTML onclick (JSON.stringify + " → &quot;). */
function pldSettingsJsArgForOnclick(s) {
  return JSON.stringify(String(s)).replace(/"/g, '&quot;');
}

function pldSettingsAvatarColor(email) {
  let h = 0;
  const s = String(email || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 42%)`;
}

/** Maps auth contract role to UI label (GET /api/v1/auth/me). */
function pldSettingsRoleLabel(role) {
  const r = String(role || '').toLowerCase();
  const map = {
    admin: 'Tenant Admin',
    manager: 'Production Manager',
    coordinator: 'Coordinator',
    viewer: 'Client Viewer',
  };
  return map[r] || (role ? String(role).replace(/_/g, ' ') : 'Member');
}

function pldSettingsUsersFromSession() {
  const u = typeof window.pldAuthGetUserJson === 'function' ? window.pldAuthGetUserJson() : null;
  if (!u || !u.email) return [];
  const fn = String(u.first_name || '').trim();
  const ln = String(u.last_name || '').trim();
  const name = [fn, ln].filter(Boolean).join(' ') || String(u.email);
  let initials = '—';
  if (fn && ln) initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase();
  else if (fn) initials = fn.slice(0, 2).toUpperCase();
  else initials = String(u.email).slice(0, 2).toUpperCase();
  return [{
    name,
    email: u.email,
    role: pldSettingsRoleLabel(u.role),
    status: u.is_active === false ? 'invited' : 'active',
    initials: initials.slice(0, 3),
    color: pldSettingsAvatarColor(u.email),
    isSelf: true,
  }];
}

function renderSettingsCustomFields() {
  if (typeof window.customFieldsEntityFilter === 'undefined') window.customFieldsEntityFilter = 'event';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <p style="color:var(--text-tertiary);font-size:13px;">Define custom fields per entity type (API v1). Requires backend at <code style="font-size:11px;">PLD_API_BASE</code> (default <code style="font-size:11px;">http://localhost:3000</code>).</p>
      <button type="button" class="btn btn-primary btn-sm" onclick="typeof openAddCustomFieldModal==='function'&&openAddCustomFieldModal()">+ Add Field</button>
    </div>
    <div id="customFieldsSettingsRoot"><p style="color:var(--text-tertiary);font-size:13px;">Loading…</p></div>
  `;
}

function renderSettingsUsers() {
  const users = pldSettingsUsersFromSession();
  const roles = ['Tenant Admin', 'Production Manager', 'Department Head', 'Crew Lead', 'Crew Member', 'Client Viewer'];
  const emptyRow = `
    <tr>
      <td colspan="5" style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:13px;">
        No signed-in user in this browser. Sign in via the API (see <code style="font-size:11px;">PLD_API_BASE</code>) to see your account here.
        A full tenant member directory will ship when the list-members endpoint is available.
      </td>
    </tr>`;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <p style="color:var(--text-tertiary);font-size:13px;">Manage users and their role-based access. The table shows the signed-in account; other members are not listed yet.</p>
      <button class="btn btn-primary btn-sm" onclick="openInviteUserModal()">+ Invite User</button>
    </div>
    <div style="margin-bottom:20px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Roles</h4>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${roles.map(r => `<span class="personnel-tag" style="background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;" onclick="openEditRoleModal('${r}')">${r}</span>`).join('')}
      </div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${users.length
    ? users.map(u => `<tr>
        <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:50%;background:${u.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;">${pldSettingsEsc(u.initials)}</div><strong>${pldSettingsEsc(u.name)}</strong></div></td>
        <td style="color:var(--text-tertiary);">${pldSettingsEsc(u.email)}</td>
        <td>${pldSettingsEsc(u.role)}</td>
        <td><span class="phase-badge ${u.status === 'active' ? 'closed' : 'planning'}">${u.status === 'active' ? 'Active' : 'Invited'}</span></td>
        <td><button type="button" class="btn btn-ghost btn-sm" onclick="openEditUserModal(${pldSettingsJsArgForOnclick(u.name)},${pldSettingsJsArgForOnclick(u.email)},${pldSettingsJsArgForOnclick(u.role)})">Edit</button>${u.isSelf ? '' : `<button type="button" class="btn btn-ghost btn-sm" onclick="showConfirm('Remove User','Remove ${pldSettingsEsc(u.name)} from this tenant?',()=>showToast('User removed','error'))">Remove</button>`}</td>
      </tr>`).join('')
    : emptyRow}
    </tbody></table></div>
  `;
}

function renderSettingsIntegrations() {
  const iconKeys = { 'Google Calendar':'integrationGoogleCal', 'Google Drive':'integrationGoogleDrive', 'Slack':'integrationSlack', 'QuickBooks':'integrationQuickBooks', 'Outlook Calendar':'integrationOutlook', 'Dropbox':'integrationDropbox', 'Webhooks':'integrationWebhooks', 'Public API':'integrationApi' };
  // All disconnected until integration status is loaded from the API (no mock connected state).
  const integrations = [
    { name: 'Google Calendar', desc: 'Sync events to Google Calendar', status: 'disconnected' },
    { name: 'Google Drive', desc: 'Store and sync documents', status: 'disconnected' },
    { name: 'Slack', desc: 'Send notifications to Slack channels', status: 'disconnected' },
    { name: 'QuickBooks', desc: 'Sync financial data for invoicing', status: 'disconnected' },
    { name: 'Outlook Calendar', desc: 'Sync events to Outlook', status: 'disconnected' },
    { name: 'Dropbox', desc: 'Alternative document storage', status: 'disconnected' },
    { name: 'Webhooks', desc: 'Custom webhooks for external systems', status: 'disconnected' },
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

function pldNotifFallbackDefaults(type) {
  const m = {
    phase_transition: { in_app: true, email: true, slack: false },
    scheduling_conflict: { in_app: true, email: true, slack: true },
    budget_alert: { in_app: false, email: true, slack: false },
    crew_assignment: { in_app: true, email: false, slack: false },
    travel_update: { in_app: true, email: true, slack: false },
    document_generated: { in_app: true, email: false, slack: true },
    comment: { in_app: true, email: false, slack: true },
  };
  return m[type] || { in_app: true, email: true, slack: false };
}

function pldNotifChannelEnabled(prefs, type, apiChannel) {
  if (!Array.isArray(prefs) || !prefs.length) {
    const d = pldNotifFallbackDefaults(type);
    return !!d[apiChannel];
  }
  const row = prefs.find(function (p) {
    return p.notification_type === type && p.channel === apiChannel;
  });
  if (row) return !!row.enabled;
  const d = pldNotifFallbackDefaults(type);
  return !!d[apiChannel];
}

function renderSettingsNotifications() {
  const rows = [
    { type: 'phase_transition', label: 'Phase Transitions', desc: 'When an event phase changes' },
    { type: 'scheduling_conflict', label: 'Scheduling Conflicts', desc: 'When a conflict is detected' },
    { type: 'budget_alert', label: 'Budget Alerts', desc: 'When budget exceeds 80%/90%' },
    { type: 'crew_assignment', label: 'Crew Assignment Changes', desc: 'When crew is added/removed' },
    { type: 'travel_update', label: 'Travel Updates', desc: 'Flight/hotel confirmations' },
    { type: 'document_generated', label: 'Document Generated', desc: 'When a document is created' },
    { type: 'comment', label: 'New Comments', desc: 'When someone comments on an event' },
  ];
  if (typeof window !== 'undefined' && window.__pldNotificationPrefsLoading) {
    return '<p style="color:var(--text-tertiary);font-size:13px;">Loading notification preferences…</p>';
  }
  if (typeof window !== 'undefined' && window.__pldNotificationPrefsRaw === undefined) {
    window.__pldNotificationPrefsLoading = true;
    if (typeof window.pldLoadNotificationPreferencesForSettings === 'function') {
      void window.pldLoadNotificationPreferencesForSettings();
    } else {
      window.__pldNotificationPrefsLoading = false;
      window.__pldNotificationPrefsRaw = [];
      window.__pldNotificationPrefsLoadError = true;
      if (typeof renderPage === 'function') renderPage('settings');
    }
    return '<p style="color:var(--text-tertiary);font-size:13px;">Loading notification preferences…</p>';
  }
  const prefs = typeof window !== 'undefined' ? window.__pldNotificationPrefsRaw : [];
  const warn =
    typeof window !== 'undefined' && window.__pldNotificationPrefsLoadError
      ? '<p style="color:var(--accent-amber);font-size:12px;margin-bottom:12px;">Could not load preferences from the API — showing defaults. Toggles may not save until you are signed in.</p>'
      : '';
  return `
    ${warn}
    <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:20px;">Configure notification channels for each event type. Push uses in-app notifications (bell). Slack is stored for future delivery.</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Event Type</th><th>Description</th><th>Email</th><th>Push</th><th>Slack</th></tr></thead><tbody>
      ${rows.map(function (c) {
        const emailOn = pldNotifChannelEnabled(prefs, c.type, 'email');
        const pushOn = pldNotifChannelEnabled(prefs, c.type, 'in_app');
        const slackOn = pldNotifChannelEnabled(prefs, c.type, 'slack');
        return `<tr>
        <td><strong>${c.label}</strong></td>
        <td style="color:var(--text-tertiary);font-size:12px;">${c.desc}</td>
        <td><div class="toggle ${emailOn ? 'active' : ''}" onclick="void pldNotificationPrefToggle(this,'${c.type}','email')" style="width:32px;height:18px;"></div></td>
        <td><div class="toggle ${pushOn ? 'active' : ''}" onclick="void pldNotificationPrefToggle(this,'${c.type}','push')" style="width:32px;height:18px;"></div></td>
        <td><div class="toggle ${slackOn ? 'active' : ''}" onclick="void pldNotificationPrefToggle(this,'${c.type}','slack')" style="width:32px;height:18px;"></div></td>
      </tr>`;
      }).join('')}
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

function renderSettingsWorkforce() {
  const api =
    typeof PLD_API_BASE === 'string' && PLD_API_BASE.trim() !== '' && typeof pldApiFetch === 'function';
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">My crew assignments</h3>
      <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:12px;">Requires sign-in and <code>scheduling:read:self</code> (demo dev mode uses full permissions).</p>
      <div id="pldSettingsMeAssignments" style="font-size:13px;color:var(--text-secondary);">Loading…</div>
    </div>
    <div class="settings-section">
      <h3 class="settings-section-title">Time clock</h3>
      <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:12px;">Clock in/out is tied to your linked personnel profile.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button type="button" class="btn btn-primary btn-sm" onclick="void pldSettingsWorkforceClockIn()" ${api ? '' : 'disabled title="API not configured"'}>Clock in</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="void pldSettingsWorkforceClockOut()" ${api ? '' : 'disabled'}>Clock out</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="void pldHydrateSettingsWorkforceTab()">Refresh</button>
      </div>
      <div id="pldSettingsTimeEntries" class="table-wrap" style="max-height:240px;overflow:auto;"></div>
    </div>
    <div class="settings-section">
      <h3 class="settings-section-title">Pay periods & export</h3>
      <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:12px;">Shell endpoints for payroll run and export-first CSV.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="void pldSettingsWorkforceCreatePayPeriod()" ${api ? '' : 'disabled'}>Create sample period</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="void pldSettingsWorkforcePayrollExport()" ${api ? '' : 'disabled'}>Run export stub</button>
      </div>
      <div id="pldSettingsPayPeriods" style="font-size:13px;color:var(--text-secondary);"></div>
    </div>
  `;
}

window.pldHydrateSettingsWorkforceTab = async function pldHydrateSettingsWorkforceTab() {
  const assEl = document.getElementById('pldSettingsMeAssignments');
  const timeEl = document.getElementById('pldSettingsTimeEntries');
  const payEl = document.getElementById('pldSettingsPayPeriods');
  if (assEl && typeof pldFetchMeCrewAssignments === 'function') {
    const res = await pldFetchMeCrewAssignments({ limit: 25 });
    if (!res) {
      assEl.textContent = 'Could not load assignments (sign in or check permissions).';
    } else {
      const rows = Array.isArray(res.data) ? res.data : [];
      const meta = res.meta || {};
      if (meta.personnel_linked === false) {
        assEl.innerHTML =
          '<span style="color:var(--text-tertiary);">' +
          (meta.note || 'No personnel linked to this user.') +
          '</span>';
      } else if (rows.length === 0) {
        assEl.textContent = 'No upcoming assignments.';
      } else {
        assEl.innerHTML =
          '<table class="data-table"><thead><tr><th>Event</th><th>Start</th><th>Status</th></tr></thead><tbody>' +
          rows
            .map(function (r) {
              const en = r.event_name != null ? String(r.event_name) : '—';
              const sd =
                r.start_date != null
                  ? String(r.start_date)
                  : r.startDate != null
                    ? String(r.startDate)
                    : '—';
              const st = r.status != null ? String(r.status) : '—';
              return (
                '<tr><td>' +
                en.replace(/</g, '&lt;') +
                '</td><td>' +
                sd +
                '</td><td>' +
                st +
                '</td></tr>'
              );
            })
            .join('') +
          '</tbody></table>';
      }
    }
  }
  if (timeEl && typeof pldTimeListEntries === 'function') {
    const entries = await pldTimeListEntries();
    if (!entries.length) {
      timeEl.innerHTML = '<p style="font-size:13px;color:var(--text-tertiary);margin:0;">No time entries.</p>';
    } else {
      timeEl.innerHTML =
        '<table class="data-table"><thead><tr><th>Start</th><th>End</th><th>Event</th></tr></thead><tbody>' +
        entries
          .map(function (e) {
            return (
              '<tr><td>' +
              String(e.started_at != null ? e.started_at : '—') +
              '</td><td>' +
              String(e.ended_at != null ? e.ended_at : '—') +
              '</td><td>' +
              String(e.event_id || '—') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    }
  }
  if (payEl && typeof pldPayPeriodsList === 'function') {
    const periods = await pldPayPeriodsList();
    if (!periods.length) {
      payEl.textContent = 'No pay periods yet.';
    } else {
      payEl.innerHTML =
        '<ul style="margin:0;padding-left:18px;">' +
        periods
          .map(function (p) {
            return (
              '<li>' +
              String(p.period_start || '') +
              ' — ' +
              String(p.period_end || '') +
              ' (id ' +
              String(p.id || '').slice(0, 8) +
              '…)</li>'
            );
          })
          .join('') +
        '</ul>';
    }
  }
};

window.pldSettingsWorkforceClockIn = async function pldSettingsWorkforceClockIn() {
  if (typeof pldTimeClockIn !== 'function') return;
  await pldTimeClockIn({});
  await pldHydrateSettingsWorkforceTab();
};

window.pldSettingsWorkforceClockOut = async function pldSettingsWorkforceClockOut() {
  if (typeof pldTimeClockOut !== 'function') return;
  await pldTimeClockOut();
  await pldHydrateSettingsWorkforceTab();
};

window.pldSettingsWorkforceCreatePayPeriod = async function pldSettingsWorkforceCreatePayPeriod() {
  if (typeof pldPayPeriodCreate !== 'function') return;
  const start = new Date();
  const end = new Date(start.getTime() + 13 * 24 * 60 * 60 * 1000);
  const fmt = function (d) {
    return d.toISOString().slice(0, 10);
  };
  await pldPayPeriodCreate({
    period_start: fmt(start),
    period_end: fmt(end),
    pay_date: fmt(end),
  });
  await pldHydrateSettingsWorkforceTab();
};

window.pldSettingsWorkforcePayrollExport = async function pldSettingsWorkforcePayrollExport() {
  if (typeof pldPayrollExportStub !== 'function') return;
  const d = await pldPayrollExportStub();
  if (d && typeof showToast === 'function') showToast('Export stub ready (see console)', 'success');
  if (d) console.info('[payroll export]', d);
};

async function submitSettingsGeneral() {
  const el = document.getElementById('pldSettingsTenantName');
  const name = el ? String(el.value || '').trim() : '';
  if (!name) {
    showToast('Company name is required', 'warning');
    return;
  }
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API client not loaded', 'warning');
    return;
  }
  const tzEl = document.getElementById('pldSettingsTimezone');
  const curEl = document.getElementById('pldSettingsCurrency');
  const bufEl = document.getElementById('pldSettingsDriveBuffer');
  const tz = tzEl ? String(tzEl.value || '').trim() : 'America/New_York';
  const cur = curEl ? String(curEl.value || '').trim().toUpperCase().slice(0, 3) : 'USD';
  let driveBuf = bufEl ? Number(bufEl.value) : 4;
  if (!Number.isFinite(driveBuf)) driveBuf = 4;
  driveBuf = Math.min(168, Math.max(0, driveBuf));
  const tConflict = document.getElementById('pldSettingsToggleConflict');
  const tBuffer = document.getElementById('pldSettingsToggleBuffer');
  const tAudit = document.getElementById('pldSettingsToggleAudit');
  const logoEl = document.getElementById('pldSettingsLogoUrl');
  const logoRaw = logoEl ? String(logoEl.value || '').trim() : '';
  const settings = {
    default_timezone: tz,
    default_currency: cur,
    branding: {
      logo_url: logoRaw === '' ? null : logoRaw,
    },
    features: {
      scheduling: {
        conflict_detection_enabled: !!(tConflict && tConflict.classList.contains('active')),
        buffer_windows_enabled: !!(tBuffer && tBuffer.classList.contains('active')),
        drive_time_buffer_hours: driveBuf,
      },
      data_export: {
        audit_logging_enabled: !!(tAudit && tAudit.classList.contains('active')),
      },
    },
  };
  const res = await window.pldApiFetch('/api/v1/tenant', {
    method: 'PUT',
    body: JSON.stringify({ name, settings }),
  });
  if (res.ok && res.body && res.body.data) {
    window.__pldTenant = res.body.data;
    if (typeof window.pldRefreshTenantShell === 'function') await window.pldRefreshTenantShell();
    showToast('Settings saved', 'success');
  } else {
    const msg =
      (res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message) ||
      'Could not save (check permissions)';
    if (res.status === 403 && typeof showToast === 'function') {
      showToast(msg || 'Missing tenancy.settings.edit permission.', 'warning');
    } else {
      showToast(msg, 'warning');
    }
  }
}

function openTenantResetConfirmModal() {
  if (typeof openModal !== 'function') return;
  const body =
    '<p style="color:var(--text-secondary);font-size:13px;margin:0 0 12px;line-height:1.45;">This removes <strong>all</strong> business data for this tenant from the database. Users, roles, and sign-in remain. This cannot be undone.</p>' +
    '<p style="font-size:12px;color:var(--text-tertiary);margin:0 0 10px;">Type <strong>RESET</strong> to confirm.</p>' +
    '<input type="text" class="form-input" id="pldTenantResetConfirm" placeholder="RESET" autocomplete="off" />';
  openModal(
    'Reset all data',
    body,
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-danger" onclick="void submitTenantResetAllData()">Erase data</button>',
  );
}

async function submitTenantResetAllData() {
  const input = document.getElementById('pldTenantResetConfirm');
  const typed = input && input.value != null ? String(input.value).trim() : '';
  if (typed !== 'RESET') {
    if (typeof showToast === 'function') showToast('Type RESET to confirm', 'warning');
    return;
  }
  if (typeof window.pldApiFetch !== 'function') {
    if (typeof showToast === 'function') showToast('API not available', 'error');
    return;
  }
  const res = await window.pldApiFetch('/api/v1/tenant/reset-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'RESET' }),
  });
  if (typeof closeModal === 'function') closeModal();
  const err0 = res.body && res.body.errors && res.body.errors[0];
  if (!res.ok || err0) {
    const msg = err0 && err0.message ? String(err0.message) : 'Reset failed';
    if (typeof showToast === 'function') showToast(msg, 'error');
    return;
  }
  if (typeof showToast === 'function') showToast('Tenant data cleared', 'success');
  if (typeof window.pldTryBootstrapFromSql === 'function') {
    try {
      await window.pldTryBootstrapFromSql();
    } catch (e) {
      console.warn('[tenant-reset] rehydrate', e);
    }
  }
  if (typeof window.pldFetchGlobalTravelIfConfigured === 'function') {
    try {
      await window.pldFetchGlobalTravelIfConfigured();
    } catch (e) {
      void e;
    }
  }
  if (typeof window.pldRefreshTenantShell === 'function') {
    try {
      await window.pldRefreshTenantShell();
    } catch (e) {
      void e;
    }
  }
  if (typeof renderPage === 'function') renderPage('settings');
}

async function submitRestoreSoftDeletedEventFromSettings() {
  const el = document.getElementById('pldSettingsRestoreEventId');
  const raw = el && el.value != null ? String(el.value).trim() : '';
  if (!raw) {
    if (typeof showToast === 'function') showToast('Enter the event UUID', 'warning');
    return;
  }
  if (typeof window.pldRestoreEventViaApi !== 'function') {
    if (typeof showToast === 'function') showToast('Restore is not available', 'error');
    return;
  }
  const ui = await window.pldRestoreEventViaApi(raw);
  if (!ui) return;
  if (typeof showToast === 'function') showToast('Event restored', 'success');
  if (typeof window.pldRefetchEventsListFromApi === 'function') await window.pldRefetchEventsListFromApi();
  if (el) el.value = '';
}

// ============================================
// GLOBAL MODALS — All missing actions wired up
// ============================================

let profileTab = 'personal';

