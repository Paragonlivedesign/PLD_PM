// ============================================
// PERSONNEL
// Depends on: data.js, pld-api.js (optional)
// ============================================
/** @type {unknown[] | null} */
window.__pldPersonnelApiRows = window.__pldPersonnelApiRows ?? null;
/** @type {unknown[] | null} */
window.__pldDepartmentsApiRows = window.__pldDepartmentsApiRows ?? null;
/** @type {string | null} */
window.__pldPersonnelApiLoadError = window.__pldPersonnelApiLoadError ?? null;
/** @type {string} */
window.__pldPersonnelListSearch = window.__pldPersonnelListSearch ?? '';
/** @type {string} */
window.__pldPersonnelListStatus = window.__pldPersonnelListStatus ?? '';
/** @type {string} */
window.__pldPersonnelListDepartmentId = window.__pldPersonnelListDepartmentId ?? '';
/** @type {ReturnType<typeof setTimeout> | null} */
window.__pldPersonnelSearchTimer = window.__pldPersonnelSearchTimer ?? null;
/** @type {File | null} */
window.__pldPendingCrewPhotoFile = window.__pldPendingCrewPhotoFile ?? null;
/** @type {File | null} */
window.__pldPersonnelDetailPhotoFile = window.__pldPersonnelDetailPhotoFile ?? null;

const PLD_CREW_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function pldApiBaseActive() {
  return typeof window.PLD_API_BASE === 'string' && window.PLD_API_BASE.trim() !== '';
}

function pldPersonnelListQueryString() {
  const q = new URLSearchParams();
  q.set('limit', '100');
  q.set('sort_by', 'name');
  q.set('sort_order', 'asc');
  const s = (window.__pldPersonnelListSearch || '').trim();
  if (s) q.set('search', s);
  const st = (window.__pldPersonnelListStatus || '').trim();
  if (st) q.set('status', st);
  const dept = (window.__pldPersonnelListDepartmentId || '').trim();
  if (dept) q.set('department_id', dept);
  return q.toString();
}

window.pldBuildPersonnelListQueryString = pldPersonnelListQueryString;

async function fetchPersonnelFromApiIfConfigured() {
  if (typeof window.pldApiFetch !== 'function') return;
  if (!pldApiBaseActive()) {
    window.__pldPersonnelApiLoadError = null;
    return;
  }
  window.__pldPersonnelApiLoadError = null;
  const [pr, dr] = await Promise.all([
    window.pldApiFetch('/api/v1/personnel?' + pldPersonnelListQueryString()),
    window.pldApiFetch('/api/v1/departments?include_counts=true'),
  ]);
  if (!pr.ok || !pr.body || !Array.isArray(pr.body.data)) {
    const msg =
      pr.body && pr.body.errors && pr.body.errors[0] && pr.body.errors[0].message
        ? String(pr.body.errors[0].message)
        : 'Personnel API unavailable (check backend, CORS, DATABASE_URL)';
    window.__pldPersonnelApiRows = [];
    window.__pldPersonnelApiLoadError = msg;
  } else {
    window.__pldPersonnelApiRows = pr.body.data;
    window.__pldPersonnelApiLoadError = null;
  }
  if (!dr.ok || !dr.body || !Array.isArray(dr.body.data)) {
    window.__pldDepartmentsApiRows = [];
  } else {
    window.__pldDepartmentsApiRows = dr.body.data;
  }
  const el = document.querySelector('.page-title');
  if (el && el.textContent === 'Personnel' && typeof renderPage === 'function') {
    renderPage('personnel', { skipModuleDataFetch: true });
  }
}

/** @returns {Array<Record<string, unknown>>} */
function pldPersonnelCardRows() {
  if (pldApiBaseActive()) {
    if (!Array.isArray(window.__pldPersonnelApiRows)) {
      return [];
    }
    return window.__pldPersonnelApiRows.map((p) => {
      const r = /** @type {Record<string, unknown>} */ (p);
      const name = `${r.first_name} ${r.last_name}`.trim();
      const dept = (window.__pldDepartmentsApiRows || []).find(
        (d) => /** @type {Record<string, unknown>} */ (d).id === r.department_id,
      );
      const dr = dept ? /** @type {Record<string, unknown>} */ (dept) : null;
      const deptName = dr ? String(dr.name) : (r.department_name ? String(r.department_name) : '—');
      const color = dr && dr.color ? String(dr.color) : '#6366f1';
      const initials = name
        .split(/\s+/)
        .map((x) => x[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?';
      const photoUrl = r.photo_url ? String(r.photo_url) : '';
      return {
        id: String(r.id),
        name,
        role: String(r.role),
        dept: r.department_id ? String(r.department_id) : 'unassigned',
        deptName,
        deptColor: color,
        status: String(r.status),
        rate: r.day_rate != null ? Number(r.day_rate) : 0,
        initials,
        avatar: photoUrl ? '' : `linear-gradient(135deg, ${color}, #9333ea)`,
        photo_url: photoUrl,
        photo_document_id: r.photo_document_id != null ? String(r.photo_document_id) : '',
        source: 'api',
        email: String(r.email || ''),
        employment_type: String(r.employment_type || ''),
        version: r.version != null ? Number(r.version) : 1,
        custom_fields:
          r.custom_fields && typeof r.custom_fields === 'object' && !Array.isArray(r.custom_fields)
            ? /** @type {Record<string, unknown>} */ (r.custom_fields)
            : {},
      };
    });
  }
  return PERSONNEL.map((p) => {
    const dept = getDepartment(p.dept);
    return {
      ...p,
      deptName: dept.name,
      deptColor: dept.color,
      source: 'firestore',
      photo_url: '',
      photo_document_id: '',
    };
  });
}

/** Filtered roster for directory / availability (API applies query; Firestore filters client-side). */
function pldPersonnelRowsForDisplay() {
  const rows = pldPersonnelCardRows();
  if (pldApiBaseActive()) return rows;
  const q = (window.__pldPersonnelListSearch || '').trim().toLowerCase();
  const st = (window.__pldPersonnelListStatus || '').trim();
  const dept = (window.__pldPersonnelListDepartmentId || '').trim();
  return rows.filter(function (p) {
    if (dept && String(p.dept) !== dept) return false;
    if (st && String(p.status) !== st) return false;
    if (!q) return true;
    const hay = [p.name, p.role, p.deptName, p.email || '']
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.indexOf(q) >= 0;
  });
}

function onPersonnelSearchInput(value) {
  window.__pldPersonnelListSearch = value;
  if (window.__pldPersonnelSearchTimer) clearTimeout(window.__pldPersonnelSearchTimer);
  window.__pldPersonnelSearchTimer = setTimeout(function () {
    window.__pldPersonnelSearchTimer = null;
    if (pldApiBaseActive()) void fetchPersonnelFromApiIfConfigured();
    else if (typeof renderPage === 'function') renderPage('personnel', { skipModuleDataFetch: true });
  }, 300);
}

function onPersonnelDepartmentFilter(value) {
  window.__pldPersonnelListDepartmentId = value ? String(value) : '';
  if (pldApiBaseActive()) void fetchPersonnelFromApiIfConfigured();
  else if (typeof renderPage === 'function') renderPage('personnel', { skipModuleDataFetch: true });
}

function onPersonnelStatusFilter(value) {
  window.__pldPersonnelListStatus = value ? String(value) : '';
  if (pldApiBaseActive()) void fetchPersonnelFromApiIfConfigured();
  else if (typeof renderPage === 'function') renderPage('personnel', { skipModuleDataFetch: true });
}

function personnelStatusDot(row) {
  if (row.source === 'api') {
    const m = {
      active: 'var(--accent-green)',
      inactive: 'var(--text-tertiary)',
      on_leave: 'var(--accent-amber)',
    };
    return m[row.status] || 'var(--text-tertiary)';
  }
  const statusColors = {
    available: 'var(--accent-green)',
    on_event: 'var(--accent-blue)',
    unavailable: 'var(--accent-red)',
  };
  return statusColors[row.status];
}

function personnelStatusLabel(row) {
  if (row.source === 'api') {
    const m = { active: 'Active', inactive: 'Inactive', on_leave: 'On leave' };
    return m[row.status] || row.status;
  }
  const statusLabels = { available: 'Available', on_event: 'On Event', unavailable: 'Unavailable' };
  return statusLabels[row.status];
}

function pldPersonnelIdAttr(id) {
  return encodeURIComponent(String(id));
}

function pldPersonnelIdFromAttr(raw) {
  if (raw == null || raw === '') return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function pldContextMenuPersonnelCard(domEvent, el) {
  if (typeof window.pldShowContextMenu !== 'function' || !el) return;
  const raw = el.getAttribute('data-pld-personnel-id');
  const id = pldPersonnelIdFromAttr(raw);
  if (!id) return;
  window.pldShowContextMenu(domEvent.clientX, domEvent.clientY, [
    { label: 'View / edit', action: function () { openPersonnelDetail(id); } },
  ]);
}

/** Add-personnel modal tabs (was referenced in HTML but undefined — clicks were no-ops after open). */
function switchCrewTab(btn, tabId) {
  const root = btn && btn.closest ? btn.closest('#modal') : null;
  if (!root) return;
  root.querySelectorAll('.modal-tab').forEach((b) => b.classList.remove('active'));
  root.querySelectorAll('.modal-tab-panel').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = root.querySelector('#tab-' + tabId);
  if (panel) panel.classList.add('active');
}

function handleCrewPhotoUpload(input) {
  const f = input && input.files && input.files[0];
  if (!f) return;
  if (f.size > PLD_CREW_PHOTO_MAX_BYTES) {
    if (typeof showToast === 'function') showToast('Photo must be 5 MB or smaller.', 'error');
    input.value = '';
    return;
  }
  if (!f.type.startsWith('image/')) {
    if (typeof showToast === 'function') showToast('Please choose an image file.', 'error');
    input.value = '';
    return;
  }
  window.__pldPendingCrewPhotoFile = f;
  const preview = document.querySelector('#modal .photo-upload-preview');
  if (preview) {
    const prevUrl = preview.getAttribute('data-pld-temp-preview');
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    const url = URL.createObjectURL(f);
    preview.setAttribute('data-pld-temp-preview', url);
    preview.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
  }
}

function handlePersonnelDetailPhotoPick(input) {
  const f = input && input.files && input.files[0];
  if (!f) return;
  if (f.size > PLD_CREW_PHOTO_MAX_BYTES) {
    if (typeof showToast === 'function') showToast('Photo must be 5 MB or smaller.', 'error');
    input.value = '';
    return;
  }
  if (!f.type.startsWith('image/')) {
    if (typeof showToast === 'function') showToast('Please choose an image file.', 'error');
    input.value = '';
    return;
  }
  window.__pldPersonnelDetailPhotoFile = f;
  const prevSlot = document.getElementById('pldPdAvatarSlot');
  if (prevSlot) {
    const prevUrl = prevSlot.getAttribute('data-pld-temp-preview');
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    const url = URL.createObjectURL(f);
    prevSlot.setAttribute('data-pld-temp-preview', url);
    prevSlot.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
  }
}

/**
 * @param {File} file
 * @param {string} [personnelId] optional — sent as documents.entity_id when present
 * @returns {Promise<string | null>} document id
 */
async function pldUploadPersonnelPhotoFile(file, personnelId) {
  if (typeof window.pldApiFormFetch !== 'function') return null;
  const fd = new FormData();
  fd.append('file', file, file.name || 'photo.jpg');
  fd.append('category', 'photo');
  fd.append('entity_type', 'personnel');
  if (personnelId) fd.append('entity_id', personnelId);
  fd.append('visibility', 'internal');
  const r = await window.pldApiFormFetch('/api/v1/documents/upload', fd);
  if (!r.ok || !r.body || !r.body.data || !r.body.data.id) {
    const msg =
      r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message
        ? String(r.body.errors[0].message)
        : 'Photo upload failed (documents:upload permission required)';
    if (typeof showToast === 'function') showToast(msg, 'error');
    return null;
  }
  return String(r.body.data.id);
}

function personnelSourceBannerHtml() {
  const box =
    'font-size:12px;margin:0 0 16px 0;padding:10px 12px;background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-subtle);max-width:920px;color:var(--text-tertiary);';
  if (!pldApiBaseActive()) {
    return `<p class="pld-directory-api-hint" style="${box}">Local roster (Firestore seed). Set <code>pld-api-base</code> for PostgreSQL CRUD.</p>`;
  }
  if (window.__pldPersonnelApiLoadError) {
    return `<p class="pld-directory-error-banner is-fatal" style="${box};border-left:3px solid var(--accent-red);">${pldEscapeHtml(window.__pldPersonnelApiLoadError)}</p>`;
  }
  if (window.__pldPersonnelApiRows === null) {
    return `<p style="${box}">Loading roster…</p>`;
  }
  return `<p class="pld-directory-api-hint" style="${box}">Connected to <code>${pldEscapeHtml(String(window.PLD_API_BASE || ''))}</code></p>`;
}

function renderPersonnel() {
  const rows = pldPersonnelRowsForDisplay();
  const deptForSubtitle = pldApiBaseActive()
    ? Array.isArray(window.__pldDepartmentsApiRows)
      ? window.__pldDepartmentsApiRows.length
      : 0
    : DEPARTMENTS.length;
  const deptOpts = (pldApiBaseActive() && Array.isArray(window.__pldDepartmentsApiRows)
    ? window.__pldDepartmentsApiRows
    : DEPARTMENTS
  )
    .map(function (d) {
      const r = /** @type {Record<string, unknown>} */ (d);
      const id = String(r.id != null ? r.id : '');
      const name = String(r.name != null ? r.name : '');
      const sel = (window.__pldPersonnelListDepartmentId || '') === id ? ' selected' : '';
      return `<option value="${pldEscapeHtml(id)}"${sel}>${pldEscapeHtml(name)}</option>`;
    })
    .join('');
  const selStat = window.__pldPersonnelListStatus || '';
  const statOptsApi = [
    ['', 'All statuses'],
    ['active', 'Active'],
    ['inactive', 'Inactive'],
    ['on_leave', 'On leave'],
  ]
    .map(function (x) {
      const v = x[0];
      const lab = x[1];
      const sel = selStat === v ? ' selected' : '';
      return `<option value="${pldEscapeHtml(v)}"${sel}>${pldEscapeHtml(lab)}</option>`;
    })
    .join('');
  const statOptsFs = [
    ['', 'All statuses'],
    ['available', 'Available'],
    ['on_event', 'On Event'],
    ['unavailable', 'Unavailable'],
  ]
    .map(function (x) {
      const v = x[0];
      const lab = x[1];
      const sel = selStat === v ? ' selected' : '';
      return `<option value="${pldEscapeHtml(v)}"${sel}>${pldEscapeHtml(lab)}</option>`;
    })
    .join('');
  const searchVal = pldEscapeHtml(window.__pldPersonnelListSearch || '');
  return `
    ${personnelSourceBannerHtml()}
    <div class="page-header pld-directory-page-header">
      <div><h1 class="page-title">Personnel</h1><p class="page-subtitle">${rows.length} shown · ${deptForSubtitle} departments</p></div>
      <div class="page-actions">
        <button type="button" class="btn btn-secondary" onclick="openPersonnelCSVImportModal()">Import CSV</button>
        <button type="button" class="btn btn-primary pld-add-crew-btn">+ Add personnel</button>
      </div>
    </div>
    <div class="pld-directory-toolbar personnel-view-toolbar">
    <div class="schedule-controls" style="margin-bottom:0;">
      <div class="view-toggle">
        <button class="view-toggle-btn ${personnelView === 'directory' ? 'active' : ''}" onclick="personnelView='directory'; renderPage('personnel');">Directory</button>
        <button class="view-toggle-btn ${personnelView === 'availability' ? 'active' : ''}" onclick="personnelView='availability'; renderPage('personnel');">Availability</button>
      </div>
      <label class="form-label" for="pldPersonnelDeptFilter">Dept</label>
      <select id="pldPersonnelDeptFilter" class="filter-select" onchange="onPersonnelDepartmentFilter(this.value)"><option value="">All departments</option>${deptOpts}</select>
      <label class="form-label" for="pldPersonnelStatusFilter">Status</label>
      <select id="pldPersonnelStatusFilter" class="filter-select" onchange="onPersonnelStatusFilter(this.value)">${pldApiBaseActive() ? statOptsApi : statOptsFs}</select>
      <input type="search" class="filter-input" placeholder="Search…" style="min-width:200px;" value="${searchVal}"
        oninput="onPersonnelSearchInput(this.value)">
    </div>
    </div>
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card"><div class="stat-label">Roster total</div><div class="stat-value">${rows.length}</div></div>
      ${pldApiBaseActive() ? `
      <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value" style="color:var(--accent-green);">${rows.filter((p) => p.status === 'active').length}</div></div>
      <div class="stat-card"><div class="stat-label">Inactive</div><div class="stat-value" style="color:var(--text-tertiary);">${rows.filter((p) => p.status === 'inactive').length}</div></div>
      <div class="stat-card"><div class="stat-label">On leave</div><div class="stat-value" style="color:var(--accent-amber);">${rows.filter((p) => p.status === 'on_leave').length}</div></div>
      ` : `
      <div class="stat-card"><div class="stat-label">Available</div><div class="stat-value" style="color:var(--accent-green);">${rows.filter((p) => p.status === 'available').length}</div></div>
      <div class="stat-card"><div class="stat-label">On Event</div><div class="stat-value" style="color:var(--accent-blue);">${rows.filter((p) => p.status === 'on_event').length}</div></div>
      <div class="stat-card"><div class="stat-label">Unavailable</div><div class="stat-value" style="color:var(--accent-red);">${rows.filter((p) => p.status === 'unavailable').length}</div></div>
      `}
    </div>
    ${personnelView === 'availability' ? renderPersonnelAvailability() : `
    <div class="personnel-grid">
      ${rows.map((p) => {
        const dot = personnelStatusDot(p);
        const lab = personnelStatusLabel(p);
        const avInner = p.photo_url
          ? `<img src="${pldEscapeHtml(p.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`
          : p.initials;
        const avStyle = p.photo_url
          ? 'padding:0;overflow:hidden;background:#111827;'
          : `background:${p.avatar};`;
        return `
        <div class="personnel-card" data-pld-personnel-id="${pldPersonnelIdAttr(p.id)}" role="button" tabindex="0" oncontextmenu="event.preventDefault();event.stopPropagation();pldContextMenuPersonnelCard(event,this);">
          <div class="personnel-card-header">
            <div class="personnel-avatar" style="${avStyle}">${avInner}</div>
            <div style="flex:1;min-width:0;"><div class="personnel-name">${p.name}</div><div class="personnel-role">${p.role}</div></div>
            <div style="width:8px;height:8px;border-radius:50%;background:${dot};" title="${lab}"></div>
          </div>
          <div class="personnel-meta">
            <span class="personnel-tag" style="background:${p.deptColor}20;color:${p.deptColor};">${p.deptName}</span>
            <span class="personnel-tag" style="background:var(--bg-tertiary);color:var(--text-secondary);">${formatCurrency(p.rate)}/day</span>
            <span class="personnel-tag" style="background:${dot}20;color:${dot};">${lab}</span>
          </div>
        </div>
      `;
      }).join('')}
    </div>`}
  `;
}

function pldIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pldEscapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadPersonnelAvailabilityGridFromApi() {
  const mount = document.getElementById('pldPersonnelAvailMount');
  if (!mount || typeof window.pldApiFetch !== 'function') return;
  const crew = pldPersonnelRowsForDisplay().filter((c) => c.source === 'api').slice(0, 100);
  if (!crew.length) {
    mount.innerHTML =
      '<p style="font-size:13px;color:var(--text-tertiary);">No API roster. Set API base and open Directory first.</p>';
    return;
  }
  const weekDates = typeof getScheduleWeekDates === 'function' ? getScheduleWeekDates() : [];
  if (weekDates.length < 7) return;
  const start = pldIsoDateLocal(weekDates[0]);
  const end = pldIsoDateLocal(weekDates[6]);
  const r = await window.pldApiFetch(
    '/api/v1/personnel/availability?start=' +
      encodeURIComponent(start) +
      '&end=' +
      encodeURIComponent(end) +
      '&limit=120',
  );
  if (!r.ok || !Array.isArray(r.body?.data)) {
    mount.innerHTML =
      '<p style="font-size:13px;color:var(--accent-red);">Could not load availability from API.</p>';
    return;
  }
  const byId = new Map(r.body.data.map((row) => [row.personnel_id, row]));
  const today = pldIsoDateLocal(new Date());
  const dateLabels = weekDates.map((d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  );
  let html = `<div class="schedule-grid" style="grid-template-columns: 200px repeat(7, 1fr);">`;
  html += `<div class="schedule-cell header">Personnel</div>`;
  for (let i = 0; i < 7; i++) {
    const iso = pldIsoDateLocal(weekDates[i]);
    const isToday = iso === today;
    html += `<div class="schedule-cell header" ${isToday ? 'style="background:var(--accent-blue-muted);color:var(--accent-blue);"' : ''}>${dateLabels[i]}${isToday ? ' (Today)' : ''}</div>`;
  }
  for (const p of crew) {
    const bulk = byId.get(p.id);
    const deptLabel = p.deptName || getDepartment(p.dept).name;
    const smAv = p.photo_url
      ? `<div style="width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#111827;"><img src="${pldEscapeHtml(p.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;"></div>`
      : `<div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;">${p.initials}</div>`;
    html += `<div class="schedule-cell row-header" data-pld-personnel-id="${pldPersonnelIdAttr(p.id)}" style="cursor:pointer;" role="button" tabindex="0"><div style="display:flex;align-items:center;gap:8px;">${smAv}<div><div style="font-size:12px;font-weight:500;" class="ep-clickable">${pldEscapeHtml(p.name)}</div><div style="font-size:10px;color:var(--text-tertiary);">${pldEscapeHtml(deptLabel)}</div></div></div></div>`;
    for (let di = 0; di < 7; di++) {
      const iso = pldIsoDateLocal(weekDates[di]);
      const dayObj = bulk?.days?.find((d) => d.date === iso);
      const asgns = dayObj?.assignments || [];
      if (!asgns.length) {
        html += `<div class="schedule-cell"></div>`;
      } else {
        const conflict = asgns.length > 1;
        const a = asgns[0];
        const label = pldEscapeHtml(a.event_name || 'Event');
        html += `<div class="schedule-cell has-assignment ${conflict ? 'has-conflict' : ''}" title="${conflict ? 'Multiple assignments' : ''}"><span class="assignment-chip ${conflict ? 'conflict' : 'confirmed'}">${label}</span></div>`;
      }
    }
  }
  html += `</div>`;
  mount.innerHTML = html;
}

function renderPersonnelAvailability() {
  if (pldApiBaseActive() && window.__pldPersonnelApiRows === null) {
    return `<p style="font-size:13px;color:var(--text-tertiary);margin:0;">Loading roster…</p>`;
  }
  const crewForGrid = pldPersonnelRowsForDisplay().slice(0, 100);
  const weekDates = typeof getScheduleWeekDates === 'function' ? getScheduleWeekDates() : [];
  if (pldApiBaseActive()) {
    if (crewForGrid.length === 0) {
      return `<p style="font-size:13px;color:var(--text-tertiary);margin:0;">No personnel in the PostgreSQL roster yet — add people via <strong>Add personnel</strong>, <strong>Import CSV</strong>, or the API.</p>`;
    }
    if (crewForGrid[0] && crewForGrid[0].source === 'api') {
      return `
    <p style="font-size:12px;color:var(--text-tertiary);margin:0 0 12px 0;">Week matches <strong>Scheduling</strong> navigation. Data from <code>/api/v1/personnel/availability</code>.</p>
    <div class="avail-grid-controls">
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)-1;renderPage('personnel');">← Prev Week</button>
      <span style="font-weight:600;font-size:13px;">${getScheduleWeekLabel()}</span>
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)+1;renderPage('personnel');">Next Week →</button>
    </div>
    <div id="pldPersonnelAvailMount"><p style="font-size:13px;color:var(--text-tertiary);">Loading availability…</p></div>
  `;
    }
  }
  if (!crewForGrid.length) {
    return `<p style="font-size:13px;color:var(--text-tertiary);margin:0;">No personnel in the roster.</p>`;
  }
  if (weekDates.length < 7) {
    return `<p style="font-size:13px;color:var(--text-tertiary);margin:0;">Week navigation is unavailable.</p>`;
  }
  const dateLabels = weekDates.map((d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  );
  const today = pldIsoDateLocal(new Date());
  let html = `
    <p style="font-size:12px;color:var(--text-tertiary);margin:0 0 12px 0;">Week matches <strong>Scheduling</strong>. Assignment cells stay empty here unless the roster is loaded from the <strong>PostgreSQL API</strong> (<code>pld-api-base</code>).</p>
    <div class="avail-grid-controls">
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)-1;renderPage('personnel');">← Prev Week</button>
      <span style="font-weight:600;font-size:13px;">${getScheduleWeekLabel()}</span>
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)+1;renderPage('personnel');">Next Week →</button>
    </div>
    <div class="schedule-grid" style="grid-template-columns: 200px repeat(7, 1fr);">
      <div class="schedule-cell header">Personnel</div>`;
  for (let i = 0; i < 7; i++) {
    const iso = pldIsoDateLocal(weekDates[i]);
    const isToday = iso === today;
    html += `<div class="schedule-cell header" ${isToday ? 'style="background:var(--accent-blue-muted);color:var(--accent-blue);"' : ''}>${dateLabels[i]}${isToday ? ' (Today)' : ''}</div>`;
  }
  for (const p of crewForGrid) {
    const deptLabel = p.deptName || getDepartment(p.dept).name;
    const smAv = p.photo_url
      ? `<div style="width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#111827;"><img src="${pldEscapeHtml(p.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;"></div>`
      : `<div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;">${p.initials}</div>`;
    html += `<div class="schedule-cell row-header" data-pld-personnel-id="${pldPersonnelIdAttr(p.id)}" style="cursor:pointer;" role="button" tabindex="0"><div style="display:flex;align-items:center;gap:8px;">${smAv}<div><div style="font-size:12px;font-weight:500;" class="ep-clickable">${pldEscapeHtml(p.name)}</div><div style="font-size:10px;color:var(--text-tertiary);">${pldEscapeHtml(deptLabel)}</div></div></div></div>`;
    for (let di = 0; di < 7; di++) {
      html += `<div class="schedule-cell"></div>`;
    }
  }
  html += `</div>`;
  return html;
}

function openPersonnelDetail(personId) {
  window.__pldPersonnelDetailPhotoFile = null;
  const needle = String(personId);
  const rows = pldPersonnelCardRows();
  const p = rows.find((x) => String(x.id) === needle);
  if (!p) {
    if (typeof showToast === 'function') {
      showToast('Could not open that personnel profile (list may have changed). Try refreshing.', 'warning');
    }
    return;
  }
  const dept = p.deptName
    ? { name: p.deptName, color: p.deptColor }
    : getDepartment(p.dept);
  const statusColors = { available: 'var(--accent-green)', on_event: 'var(--accent-blue)', unavailable: 'var(--accent-red)' };
  const statusLabels = { available: 'Available', on_event: 'On Event', unavailable: 'Unavailable' };
  const statusDot =
    p.source === 'api' ? personnelStatusDot(p) : statusColors[p.status];
  const statusLab =
    p.source === 'api' ? personnelStatusLabel(p) : statusLabels[p.status];
  const assignedEvents = EVENTS.filter(e => e.crew.includes(p.id));
  const personTravel = TRAVEL_RECORDS.filter(t => t.personnel === p.id);

  const apiRoleField =
    p.source === 'api'
      ? `<div class="form-group" style="margin-top:4px;"><label class="form-label">Role</label><input type="text" id="pldPdRole" class="form-input" style="max-width:320px;" value="${pldEscapeHtml(p.role)}"></div>`
      : `<div style="font-size:13px;color:var(--text-tertiary);">${p.role}</div>`;
  const headAv =
    p.source === 'api' && p.photo_url
      ? `<div id="pldPdAvatarSlot" style="width:56px;height:56px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#111827;"><img src="${pldEscapeHtml(p.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`
      : `<div id="pldPdAvatarSlot" style="width:56px;height:56px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#fff;">${p.initials}</div>`;
  const photoPick =
    p.source === 'api'
      ? `<div style="margin-top:8px;"><input type="file" id="pldPdPhotoInput" accept="image/*" style="display:none" onchange="handlePersonnelDetailPhotoPick(this)"><button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('pldPdPhotoInput').click()">Change photo</button></div>`
      : '';
  const body = `
    ${p.source === 'api' ? `<input type="hidden" id="pldPdVersion" value="${p.version ?? 1}">` : ''}
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
      ${headAv}
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:700;">${p.name}</div>
        ${apiRoleField}
        <div style="display:flex;gap:8px;margin-top:6px;">
          <span class="personnel-tag" style="background:${dept.color}20;color:${dept.color};">${dept.name}</span>
          <span class="personnel-tag" style="background:${statusDot}20;color:${statusDot};">${statusLab}</span>
        </div>
        ${photoPick}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Day Rate</div><div style="font-size:20px;font-weight:700;">${formatCurrency(p.rate)}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Active Events</div><div style="font-size:20px;font-weight:700;">${assignedEvents.length}</div></div>
      <div class="stat-card" style="padding:12px;"><div class="stat-label">Travel Records</div><div style="font-size:20px;font-weight:700;">${personTravel.length}</div></div>
    </div>
    ${assignedEvents.length > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">ASSIGNED EVENTS</div>${assignedEvents.map(ev => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;cursor:pointer;" onclick="closeModal();setTimeout(()=>navigateToEvent('${ev.id}'),150)"><span class="phase-badge ${ev.phase}" style="font-size:10px;padding:2px 6px;">${PHASE_LABELS[ev.phase]}</span><div style="flex:1;font-weight:500;font-size:13px;">${ev.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${formatDateShort(ev.startDate)}</div></div>`).join('')}</div>` : ''}
    ${personTravel.length > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">TRAVEL</div>${personTravel.map(tr => { const ev = EVENTS.find(e => e.id === tr.event); return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);margin-bottom:4px;"><span>${uiIcon({flight:'travelFlight',hotel:'travelHotel',self_drive:'travelSelfDrive'}[tr.type]||'travelLocation')}</span><div style="flex:1;"><div style="font-size:12px;font-weight:500;">${tr.from}${tr.to ? ' → '+tr.to : ''}</div><div style="font-size:11px;color:var(--text-tertiary);">${ev.name} · ${formatDate(tr.date)}</div></div><div style="font-size:12px;font-weight:500;">${formatCurrency(tr.cost)}</div></div>`; }).join('')}</div>` : ''}
    ${p.source === 'api' ? '<div id="pldPdCustomFieldsMount"></div>' : ''}
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">CONTACT & PREFERENCES</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Email</label><input type="email" id="pldPdEmail" class="form-input" value="${pldEscapeHtml(String(p.email || ''))}"></div>
        <div class="form-group"><label class="form-label">Phone</label><input type="tel" id="pldPdPhone" class="form-input" value="${pldEscapeHtml(String(p.phone || ''))}"></div>
        <div class="form-group"><label class="form-label">Home Base</label><input type="text" class="form-input" value=""></div>
        <div class="form-group"><label class="form-label">Travel Preference</label><select class="form-select"><option>Will fly anywhere</option><option>Prefers driving</option><option>Local only</option></select></div>
      </div>
    </div>
  `;
  const saveBtn =
    p.source === 'api'
      ? `<button type="button" class="btn btn-primary" onclick="void pldSavePersonnelDetailFromModal('${p.id}')">Save</button>`
      : `<button type="button" class="btn btn-primary" onclick="if(typeof showToast==='function')showToast('Save is only persisted when the roster is loaded from the PostgreSQL API.','info');closeModal();">Save</button>`;
  openModal(p.name, body, `
    <button class="btn btn-danger btn-sm" onclick="showConfirm('Remove from roster','Remove ${p.name.replace(/'/g, "\\'")} from the roster?',()=>{if(typeof showToast==='function')showToast('Remove is not wired for this roster source.','info');})">Remove</button>
    <div style="flex:1;"></div>
    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    ${saveBtn}
  `);
  if (p.source === 'api' && typeof window.pldMountCustomFieldsInContainer === 'function') {
    void window.pldMountCustomFieldsInContainer(
      'pldPdCustomFieldsMount',
      'personnel',
      p.custom_fields && typeof p.custom_fields === 'object' ? p.custom_fields : {},
    );
  }
}

async function pldSavePersonnelDetailFromModal(personId) {
  if (typeof window.pldApiFetch !== 'function') return;
  const versionEl = document.getElementById('pldPdVersion');
  const emailEl = document.getElementById('pldPdEmail');
  const roleEl = document.getElementById('pldPdRole');
  const phoneEl = document.getElementById('pldPdPhone');
  const version = versionEl ? Number(versionEl.value) : 1;
  const pendingPhoto = window.__pldPersonnelDetailPhotoFile;
  let photo_document_id = undefined;
  if (pendingPhoto instanceof File) {
    const docId = await pldUploadPersonnelPhotoFile(pendingPhoto, personId);
    if (!docId) return;
    window.__pldPersonnelDetailPhotoFile = null;
    const inp = document.getElementById('pldPdPhotoInput');
    if (inp) inp.value = '';
    photo_document_id = docId;
  }
  const payload = {
    version,
    email: emailEl ? String(emailEl.value || '').trim() : '',
    role: roleEl ? String(roleEl.value || '').trim() : '',
    phone: phoneEl && phoneEl.value ? String(phoneEl.value).trim() : null,
  };
  if (photo_document_id !== undefined) payload.photo_document_id = photo_document_id;
  const cfMount = document.getElementById('pldPdCustomFieldsMount');
  if (
    cfMount &&
    typeof window.loadCustomFieldsDefinitions === 'function' &&
    typeof window.pldCollectCustomFieldValuesFromContainer === 'function'
  ) {
    try {
      const defs = await window.loadCustomFieldsDefinitions('personnel');
      payload.custom_fields = window.pldCollectCustomFieldValuesFromContainer(cfMount, defs);
    } catch (_e) {
      if (typeof showToast === 'function') showToast('Could not save custom fields', 'warning');
    }
  }
  const r = await window.pldApiFetch(`/api/v1/personnel/${personId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err0 = r.body && r.body.errors && r.body.errors[0];
    const msg = err0 && err0.message ? String(err0.message) : '';
    if (typeof showToast === 'function') {
      if (r.status === 403) {
        showToast(
          msg ||
            'No permission to edit personnel (personnel:update). Sign out and back in after RBAC changes, or use an admin account.',
          'error',
        );
      } else {
        showToast(msg || 'Save failed', 'error');
      }
    }
    return;
  }
  if (typeof showToast === 'function') showToast('Saved', 'success');
  if (typeof closeModal === 'function') closeModal();
  await fetchPersonnelFromApiIfConfigured();
}

async function pldSubmitNewPersonnelFromModal() {
  if (typeof window.pldApiFetch !== 'function' || !pldApiBaseActive()) {
    if (typeof showToast === 'function') showToast('Set pld-api-base to create personnel.', 'warning');
    return;
  }
  const fnEl = document.getElementById('pldAddFirstName');
  const lnEl = document.getElementById('pldAddLastName');
  const emEl = document.getElementById('pldAddEmail');
  const roleEl = document.getElementById('pldAddRole');
  const depEl = document.getElementById('pldAddDepartment');
  const etEl = document.getElementById('pldAddEmployment');
  const drEl = document.getElementById('pldAddDayRate');
  const fn = fnEl ? String(fnEl.value || '').trim() : '';
  const ln = lnEl ? String(lnEl.value || '').trim() : '';
  const em = emEl ? String(emEl.value || '').trim() : '';
  const role = roleEl ? String(roleEl.value || '').trim() : '';
  const employment_type = etEl && etEl.value ? String(etEl.value) : 'freelance';
  if (!fn || !ln || !em || !role) {
    if (typeof showToast === 'function') showToast('First name, last name, email, and role are required.', 'warning');
    return;
  }
  const payload = { first_name: fn, last_name: ln, email: em, role, employment_type };
  if (depEl && depEl.value) payload.department_id = depEl.value;
  if (drEl && drEl.value !== '') {
    const n = Number(drEl.value);
    if (!Number.isNaN(n)) payload.day_rate = n;
  }
  const pending = window.__pldPendingCrewPhotoFile;
  if (pending instanceof File) {
    const docId = await pldUploadPersonnelPhotoFile(pending, undefined);
    if (!docId) return;
    payload.photo_document_id = docId;
  }
  window.__pldPendingCrewPhotoFile = null;
  const r = await window.pldApiFetch('/api/v1/personnel', { method: 'POST', body: JSON.stringify(payload) });
  if (!r.ok) {
    const msg = r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message;
    if (typeof showToast === 'function') showToast(msg || 'Create failed', 'error');
    return;
  }
  if (typeof showToast === 'function') showToast('Personnel record created', 'success');
  if (typeof closeModal === 'function') closeModal();
  await fetchPersonnelFromApiIfConfigured();
  if (typeof renderPage === 'function') renderPage('personnel');
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
        <h4>Profile photo</h4>
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
        <div class="form-group"><label class="form-label">First Name *</label><input type="text" class="form-input" id="pldAddFirstName" placeholder="First name" autocomplete="given-name"></div>
        <div class="form-group"><label class="form-label">Last Name *</label><input type="text" class="form-input" id="pldAddLastName" placeholder="Last name" autocomplete="family-name"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Department</label><select class="form-select" id="pldAddDepartment"><option value="">Select…</option>${DEPARTMENTS.map((d) => `<option value="${String(d.id)}">${d.name}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Role / Title *</label><input type="text" class="form-input" id="pldAddRole" placeholder="Job title"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Employment *</label><select class="form-select" id="pldAddEmployment"><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="freelance" selected>Freelance</option><option value="contractor">Contractor</option></select></div>
        <div class="form-group"></div>
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
          <label class="form-label">Roster status</label>
          <select class="form-select"><option>Active</option><option>Inactive</option><option>On Leave</option><option>Prospect</option></select>
        </div>
      </div>
    </div>

    <!-- TAB: Contact -->
    <div class="modal-tab-panel" id="tab-contact">
      <div class="form-section-title">Primary Contact</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="pldAddEmail" placeholder="email@example.com" autocomplete="email"></div>
        <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-input" placeholder="Phone"></div>
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
        <div class="form-group"><label class="form-label">Day Rate ($)</label><input type="number" class="form-input" id="pldAddDayRate" placeholder="0" step="25" min="0"></div>
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
        <div class="form-group"><label class="form-label">Employee ID</label><input type="text" class="form-input" placeholder="Internal reference"></div>
        <div class="form-group"><label class="form-label">Hire Date</label><input type="date" class="form-input"></div>
      </div>
    </div>
  `;
  if (typeof openModal !== 'function') {
    console.error('PLD: openModal is not available (modal.js not loaded?)');
    return;
  }
  const addFooter = pldApiBaseActive()
    ? `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="void pldSubmitNewPersonnelFromModal()">Save</button>`
    : `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="if(typeof showToast==='function')showToast('Set pld-api-base to create personnel in PostgreSQL.','info')">Save</button>`;
  openModal('Add personnel', body, addFooter);
  const modalEl = document.getElementById('modal');
  if (modalEl) modalEl.classList.add('modal-wide');
}

/**
 * Delegation on `document` (filtered to #pageContent) so clicks work even if bind order
 * vs. init.js / first paint was wrong; survives innerHTML swaps on the main column.
 */
(function pldInstallPersonnelDelegation() {
  if (window.__pldPersonnelDocDelegationInstalled) return;
  window.__pldPersonnelDocDelegationInstalled = true;

  function onDocClick(e) {
    const main = e.target.closest('#pageContent');
    if (!main) return;
    const addBtn = e.target.closest('button.pld-add-crew-btn');
    if (addBtn) {
      e.preventDefault();
      if (typeof openAddPersonnelModal === 'function') openAddPersonnelModal();
      return;
    }
    const row = e.target.closest('[data-pld-personnel-id]');
    if (row && typeof openPersonnelDetail === 'function') {
      e.preventDefault();
      openPersonnelDetail(pldPersonnelIdFromAttr(row.getAttribute('data-pld-personnel-id')));
    }
  }

  function onDocKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const main = e.target.closest('#pageContent');
    if (!main) return;
    const row = e.target.closest('[data-pld-personnel-id]');
    if (!row) return;
    e.preventDefault();
    if (typeof openPersonnelDetail === 'function') {
      openPersonnelDetail(pldPersonnelIdFromAttr(row.getAttribute('data-pld-personnel-id')));
    }
  }

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKeydown);
})();
