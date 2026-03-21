/* ============================================
   Module: Documents Page
   Depends on: state.js, data.js, modal.js, pld-api.js
   ============================================ */

/** @type {unknown[] | null} */
window.__pldDocumentsApiDocs = null;
/** @type {unknown[] | null} */
window.__pldDocumentsApiTemplates = null;

function pldDocumentsBrand() {
  const t = typeof window !== 'undefined' && window.__pldTenant;
  return t && t.name ? String(t.name) : 'Organization';
}

function pldDocumentsSampleEventTitle() {
  return typeof EVENTS !== 'undefined' && EVENTS[0] ? EVENTS[0].name : 'Event';
}

function formatDocBytes(n) {
  const x = Number(n) || 0;
  if (x < 1024) return x + ' B';
  if (x < 1048576) return (x / 1024).toFixed(1) + ' KB';
  return (x / 1048576).toFixed(1) + ' MB';
}

async function fetchDocumentsFromApiIfConfigured() {
  if (typeof window.pldApiFetch !== 'function') return;
  const r = await window.pldApiFetch('/api/v1/documents?limit=100&sort_by=created_at&sort_order=desc');
  if (r.ok && r.body && Array.isArray(r.body.data)) {
    window.__pldDocumentsApiDocs = r.body.data;
  } else {
    window.__pldDocumentsApiDocs = null;
  }
  const t = await window.pldApiFetch('/api/v1/templates?sort_by=name&sort_order=asc');
  if (t.ok && t.body && Array.isArray(t.body.data)) {
    window.__pldDocumentsApiTemplates = t.body.data;
  } else {
    window.__pldDocumentsApiTemplates = null;
  }
  const el = document.querySelector('.page-title');
  if (el && el.textContent === 'Documents' && typeof renderPage === 'function') {
    renderPage('documents', { skipModuleDataFetch: true });
  }
}

function getDocumentsRows() {
  if (Array.isArray(window.__pldDocumentsApiDocs)) {
    return window.__pldDocumentsApiDocs.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.category,
      size: formatDocBytes(d.size_bytes),
      version: d.version != null ? d.version : 1,
      updated: String(d.updated_at || d.created_at || '').slice(0, 10) || '—',
      event: d.event_id,
      source: d.source,
      format: (d.mime_type || '').includes('html') ? 'html' : 'pdf',
      stale: d.stale,
      _api: true,
    }));
  }
  return DOCUMENTS.map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    size: doc.size,
    version: doc.version,
    updated: doc.updated,
    event: doc.event,
    source: doc.source === 'generated' ? 'generated' : 'demo',
    format: doc.format || 'pdf',
    stale: false,
    _api: false,
  }));
}

function getTemplatesRows() {
  if (Array.isArray(window.__pldDocumentsApiTemplates)) {
    return window.__pldDocumentsApiTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      desc: t.description || '',
      category: t.category,
      format: t.format,
      version: t.version,
      _api: true,
    }));
  }
  return [
    { id: 'crew-pack', name: 'Crew Pack Template', desc: 'Standard crew pack', category: 'report', _api: false },
    { id: 'day-sheet', name: 'Day Sheet Template', desc: 'Daily schedule', category: 'report', _api: false },
  ];
}

async function pldSubmitDocumentUpload() {
  const errEl = document.getElementById('pldUploadDocErr');
  const fileInput = document.getElementById('pldUploadDocFile');
  const evSel = document.getElementById('pldUploadDocEvent');
  const catSel = document.getElementById('pldUploadDocCategory');
  const nameInput = document.getElementById('pldUploadDocName');
  const descInput = document.getElementById('pldUploadDocDesc');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Choose a file.';
    }
    return;
  }
  if (typeof window.pldApiFormFetch !== 'function') {
    showToast('API not configured (pld-api.js)', 'error');
    return;
  }
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  fd.append('category', catSel ? catSel.value : 'other');
  if (evSel && evSel.value) fd.append('event_id', evSel.value);
  if (nameInput && nameInput.value.trim()) fd.append('name', nameInput.value.trim());
  if (descInput && descInput.value.trim()) fd.append('description', descInput.value.trim());
  const btn = document.getElementById('pldUploadDocBtn');
  if (btn) btn.disabled = true;
  const r = await window.pldApiFormFetch('/api/v1/documents/upload', fd, { method: 'POST' });
  if (btn) btn.disabled = false;
  const uploadErrs = r.body && Array.isArray(r.body.errors) && r.body.errors.length;
  if (!r.ok || !r.body || uploadErrs) {
    const msg = (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Upload failed';
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = msg;
    }
    return;
  }
  showToast('Uploaded', 'success');
  closeModal();
  await fetchDocumentsFromApiIfConfigured();
}

function renderDocuments() {
  const rows = getDocumentsRows();
  const apiNote = window.__pldDocumentsApiDocs ? ' · API' : '';
  return `
    <div class="page-header">
      <div><h1 class="page-title">Documents</h1><p class="page-subtitle">${rows.length} documents${apiNote}</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="openGenerateDocModal()">Generate Document</button>
        <button class="btn btn-primary" onclick="openUploadDocModal()">Upload</button>
      </div>
    </div>
    <div class="tabs">
      ${tabBtn('All Documents', 'documentsTab', 'all', 'documents')}
      ${tabBtn('Templates', 'documentsTab', 'templates', 'documents')}
      ${tabBtn('Generated', 'documentsTab', 'generated', 'documents')}
      ${tabBtn('Email Templates', 'documentsTab', 'emailTemplates', 'documents')}
    </div>
    ${documentsTab === 'all' ? renderDocumentsAll() : documentsTab === 'templates' ? renderDocumentsTemplates() : documentsTab === 'emailTemplates' ? renderDocumentsEmailTemplates() : renderDocumentsGenerated()}
  `;
}

function renderDocumentsAll() {
  const docTypeLabels = { crew_pack:'Crew Pack', day_sheet:'Day Sheet', manifest:'Manifest', rooming_list:'Rooming List', rider:'Rider', settlement:'Settlement', travel_summary:'Travel Summary', production_schedule:'Production schedule', stage_plot:'Stage plot', tech_spec:'Tech spec', contract:'Contract', invoice:'Invoice', photo:'Photo', other:'Other' };
  const docTypeIcons = { crew_pack:'pdf', day_sheet:'pdf', manifest:'sheet', rooming_list:'sheet', rider:'pdf', settlement:'pdf', travel_summary:'doc', invoice:'doc', contract:'pdf', photo:'doc' };
  const svgIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>';
  const list = getDocumentsRows();
  return `
    <div class="filter-bar">
      <select class="filter-select"><option>All Events</option>${EVENTS.map(e => `<option>${e.name}</option>`).join('')}</select>
      <select class="filter-select"><option>All Types</option>${Object.values(docTypeLabels).map(l => `<option>${l}</option>`).join('')}</select>
      <input type="text" class="filter-input" placeholder="Search documents…" style="min-width:200px;">
    </div>
    <div class="doc-list">
      ${list.length
    ? list.map(doc => { const ev = doc.event ? EVENTS.find(e => e.id === doc.event) : null; const evName = ev ? ev.name : (doc.event ? String(doc.event).slice(0, 8) + '…' : '—'); const iconType = docTypeIcons[doc.type] || 'doc'; const stale = doc.stale ? ' · stale' : ''; const safeName = String(doc.name).replace(/'/g, "\\'"); const safeId = String(doc.id).replace(/'/g, "\\'"); return `
        <div class="doc-item" onclick="openDocPreview('${safeId}')">
          <div class="doc-icon ${iconType}">${svgIcon}</div>
          <div class="doc-info"><div class="doc-name">${doc.name}</div><div class="doc-meta">${docTypeLabels[doc.type] || doc.type || 'Document'} · ${doc.size} · v${doc.version} · ${evName} · ${doc.updated}${stale}</div></div>
          <div class="doc-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();pldDownloadDocument('${safeId}')">↓</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEmailDocModal('${safeName}')">✉</button>
          </div>
        </div>`; }).join('')
    : '<div class="empty-state" style="padding:32px;text-align:center;color:var(--text-tertiary);">No documents yet. Upload a file or generate from a template.</div>'}
    </div>
  `;
}

function renderDocumentsTemplates() {
  const iconKeys = { 'crew-pack':'templateCrewPack', 'day-sheet':'templateDaySheet', 'trucking-manifest':'templateTrucking', 'rooming-list':'templateRooming', 'travel-summary':'templateTravelSummary', 'settlement-report':'templateSettlement' };
  const templates = getTemplatesRows().map((t) =>
    t._api
      ? { ...t, uses: '—', lastUsed: '—', thumb: `<div style="padding:20px;font-size:12px;color:var(--text-tertiary);">${t.category} · API template</div>` }
      : { ...t, uses: 24, lastUsed: '2026-02-14', thumb: getTemplateThumbnail(t.id) },
  );
  if (!templates.length) {
    return '<div class="empty-state" style="padding:32px;text-align:center;color:var(--text-tertiary);">No templates in this tenant. Seed templates via API or use a migrated database.</div>';
  }
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:20px;">
      ${templates.map(t => `
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="background:var(--bg-tertiary);padding:12px 16px;border-bottom:1px solid var(--border-subtle);min-height:180px;position:relative;overflow:hidden;" id="tpl-thumb-${t.id}">
            ${t.thumb}
          </div>
          <div style="padding:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-size:18px;">${uiIcon(iconKeys[t.id] || 'docPreview')}</span>
              <div style="font-weight:600;font-size:14px;">${t.name}</div>
            </div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">${t.desc}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-size:11px;color:var(--text-tertiary);">${t._api ? `Server · ${t.category || '—'} · ${t.format || 'html'}${t.version != null ? ' · v' + t.version : ''}` : `Used ${t.uses}× · Last ${formatDate(t.lastUsed)}`}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                ${t._api ? `<button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();void openApiTemplateViewModal('${String(t.id).replace(/'/g, "\\'")}')">View</button><button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();void openApiTemplateEditorModal('${String(t.id).replace(/'/g, "\\'")}')">Edit</button>` : `<button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTemplateMockup('${t.id}')">Preview</button><button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openTemplateEditorModal('${String(t.name).replace(/'/g, "\\'")}','${String(t.desc).replace(/'/g, "\\'")}')">Edit</button>`}
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function getTemplateThumbnail(id) {
  const line = (w,y) => `<div style="height:6px;width:${w};background:var(--border-default);border-radius:3px;position:absolute;top:${y}px;left:16px;"></div>`;
  const block = (x,y,w,h,bg) => `<div style="position:absolute;top:${y}px;left:${x}px;width:${w}px;height:${h}px;background:${bg||'var(--border-subtle)'};"></div>`;
  switch(id) {
    case 'crew-pack': return `
      <div style="font-size:8px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${pldDocumentsBrand().toUpperCase()}</div>
      <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:2px;">${pldDocumentsSampleEventTitle()} — Crew Pack</div>
      <div style="font-size:7px;color:var(--text-tertiary);margin-bottom:10px;">Feb 8—9, 2026 · SoFi Stadium, Los Angeles, CA</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div style="background:var(--bg-secondary);padding:6px;"><div style="font-size:6px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:2px;">CALL TIME</div><div style="font-size:9px;font-weight:600;color:var(--text-primary);">06:00 AM</div></div>
        <div style="background:var(--bg-secondary);padding:6px;"><div style="font-size:6px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:2px;">WRAP TIME</div><div style="font-size:9px;font-weight:600;color:var(--text-primary);">11:00 PM</div></div>
      </div>
      <div style="font-size:7px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:4px;">CREW ROSTER</div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${['Alex Johnson — TD','Mike Thompson — A1','Sarah Lee — Camera Op','Emma Davis — Graphics'].map(n => `<div style="display:flex;align-items:center;gap:4px;font-size:7px;color:var(--text-secondary);"><div style="width:4px;height:4px;border-radius:50%;background:var(--accent-blue);"></div>${n}</div>`).join('')}
      </div>`;
    case 'day-sheet': return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div><div style="font-size:8px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;">DAY SHEET</div><div style="font-size:10px;font-weight:600;color:var(--text-secondary);">${pldDocumentsSampleEventTitle()}</div></div>
        <div style="text-align:right;"><div style="font-size:8px;color:var(--text-tertiary);">Day 1 of 3</div><div style="font-size:8px;font-weight:600;color:var(--text-secondary);">Feb 14, 2026</div></div>
      </div>
      <div style="font-size:7px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:3px;border-top:1px solid var(--border-default);padding-top:6px;">SCHEDULE</div>
      ${[['06:00','Crew call — Load in begins'],['08:00','Camera blocking'],['10:00','Audio check / line check'],['12:00','Lunch break (catering Rm 204)'],['14:00','Full rehearsal'],['17:00','Doors open'],['19:00','SHOW LIVE']].map(([t,d]) => `<div style="display:flex;gap:6px;font-size:7px;margin-bottom:2px;"><div style="font-weight:600;color:var(--accent-blue);width:28px;flex-shrink:0;">${t}</div><div style="color:var(--text-secondary);">${d}</div></div>`).join('')}`;
    case 'trucking-manifest': return `
      <div style="font-size:8px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">TRUCKING MANIFEST</div>
      <div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">Alpha Unit → SoFi Stadium</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;">
        <div style="background:var(--bg-secondary);padding:4px 6px;"><div style="font-size:6px;color:var(--text-tertiary);">DRIVER</div><div style="font-size:7px;font-weight:600;color:var(--text-secondary);">J. Rodriguez</div></div>
        <div style="background:var(--bg-secondary);padding:4px 6px;"><div style="font-size:6px;color:var(--text-tertiary);">DEPART</div><div style="font-size:7px;font-weight:600;color:var(--text-secondary);">Feb 5, 6AM</div></div>
        <div style="background:var(--bg-secondary);padding:4px 6px;"><div style="font-size:6px;color:var(--text-tertiary);">ETA</div><div style="font-size:7px;font-weight:600;color:var(--text-secondary);">Feb 7, 2PM</div></div>
      </div>
      <div style="font-size:7px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:3px;">LOAD LIST</div>
      <table style="width:100%;font-size:7px;color:var(--text-secondary);border-collapse:collapse;">
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:2px 0;font-weight:600;">Qty</td><td style="font-weight:600;">Item</td><td style="font-weight:600;">Weight</td></tr>
        ${[['4','LED Panels 4×8','320 lbs'],['8','Moving Head Lights','240 lbs'],['2','Audio Racks','480 lbs'],['12','Cable Trunks','600 lbs'],['1','Video Switcher','180 lbs']].map(([q,i,w]) => `<tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:2px 0;">${q}</td><td>${i}</td><td>${w}</td></tr>`).join('')}
      </table>`;
    case 'rooming-list': return `
      <div style="font-size:8px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">ROOMING LIST</div>
      <div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-bottom:1px;">Hotel (sample)</div>
      <div style="font-size:7px;color:var(--text-tertiary);margin-bottom:8px;">${pldDocumentsSampleEventTitle()} · Check-in · Check-out</div>
      <table style="width:100%;font-size:7px;color:var(--text-secondary);border-collapse:collapse;">
        <tr style="border-bottom:1px solid var(--border-default);"><td style="padding:2px 0;font-weight:600;">Room</td><td style="font-weight:600;">Guest</td><td style="font-weight:600;">Type</td><td style="font-weight:600;">In</td><td style="font-weight:600;">Out</td></tr>
        ${[['1204','Alex Johnson','King','2/13','2/17'],['1205','Mike Thompson','King','2/13','2/17'],['1206','Chris Martinez','Dbl','2/14','2/17'],['1207','Sarah Lee','King','2/13','2/16'],['1208','Emma Davis','King','2/13','2/17']].map(([r,g,t,i,o]) => `<tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:2px 0;">${r}</td><td>${g}</td><td>${t}</td><td>${i}</td><td>${o}</td></tr>`).join('')}
      </table>`;
    case 'travel-summary': return `
      <div style="font-size:8px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">TRAVEL SUMMARY</div>
      <div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">${pldDocumentsSampleEventTitle()} — sample venue</div>
      <div style="font-size:7px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:3px;">FLIGHTS</div>
      ${[['Alex Johnson','DL1247','JFK → LAS','Feb 10, 8:00a','Feb 10, 11:15a'],['Mike Thompson','UA892','ORD → LAS','Feb 10, 7:30a','Feb 10, 9:45a']].map(([n,f,r,d,a]) => `<div style="background:var(--bg-secondary);padding:4px 6px;margin-bottom:3px;display:flex;justify-content:space-between;"><div><div style="font-size:7px;font-weight:600;color:var(--text-secondary);">${n}</div><div style="font-size:6px;color:var(--text-tertiary);">${f} · ${r}</div></div><div style="text-align:right;"><div style="font-size:6px;color:var(--text-tertiary);">Dep ${d.split(',')[1]}</div><div style="font-size:6px;color:var(--text-tertiary);">Arr ${a.split(',')[1]}</div></div></div>`).join('')}
      <div style="font-size:7px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:3px;margin-top:6px;">GROUND</div>
      <div style="background:var(--bg-secondary);padding:4px 6px;"><div style="font-size:7px;color:var(--text-secondary);">${uiIcon('travelSelfDrive')} Rental — Enterprise, LAS Airport</div><div style="font-size:6px;color:var(--text-tertiary);">Pickup Feb 10 · Return Feb 14</div></div>`;
    case 'settlement-report': return `
      <div style="font-size:8px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">SETTLEMENT REPORT</div>
      <div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">${pldDocumentsSampleEventTitle()}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;">
        <div style="background:var(--bg-secondary);padding:4px 6px;text-align:center;"><div style="font-size:6px;color:var(--text-tertiary);">BUDGET</div><div style="font-size:9px;font-weight:700;color:var(--text-primary);">$180,000</div></div>
        <div style="background:var(--bg-secondary);padding:4px 6px;text-align:center;"><div style="font-size:6px;color:var(--text-tertiary);">ACTUAL</div><div style="font-size:9px;font-weight:700;color:var(--accent-amber);">$165,400</div></div>
        <div style="background:var(--bg-secondary);padding:4px 6px;text-align:center;"><div style="font-size:6px;color:var(--text-tertiary);">SAVINGS</div><div style="font-size:9px;font-weight:700;color:var(--accent-green);">$14,600</div></div>
      </div>
      <div style="font-size:7px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:3px;">BREAKDOWN</div>
      ${[['Labor','$74,430','45%','var(--accent-blue)'],['Equipment','$36,388','22%','var(--accent-purple)'],['Travel','$29,772','18%','var(--accent-cyan)'],['Venue/Other','$24,810','15%','var(--accent-amber)']].map(([cat,amt,pct,c]) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><div style="width:6px;height:6px;background:${c};flex-shrink:0;"></div><div style="flex:1;font-size:7px;color:var(--text-secondary);">${cat}</div><div style="font-size:7px;font-weight:600;color:var(--text-secondary);">${amt}</div><div style="font-size:7px;color:var(--text-tertiary);width:24px;text-align:right;">${pct}</div></div>`).join('')}`;
    default: return '';
  }
}

function openTemplateMockup(templateId) {
  if (!EVENTS || !EVENTS.length) {
    showToast('Add at least one event to preview this template.', 'warning');
    return;
  }
  const ev = EVENTS[0];
  const venue = getVenue(ev.venue);
  const client = getClient(ev.client);
  const crewList = (ev.crew || []).map((cid) => getPersonnel(cid)).filter(Boolean);

  let title = '', body = '';
  switch(templateId) {
    case 'crew-pack':
      title = 'Crew Pack — ' + ev.name;
      body = `
        <div style="background:#fff;color:#111;padding:32px;font-family:'Segoe UI',sans-serif;min-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:16px;margin-bottom:20px;">
            <div><div style="font-size:22px;font-weight:800;color:#1a1a2e;">${pldDocumentsBrand().toUpperCase()}</div><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;">Production Services</div></div>
            <div style="text-align:right;"><div style="font-size:12px;font-weight:600;color:#1a1a2e;">${ev.name}</div><div style="font-size:11px;color:#666;">${formatDate(ev.startDate)} — ${formatDate(ev.endDate)}</div><div style="font-size:11px;color:#666;">${venue.name}, ${venue.city}</div></div>
          </div>

          <div style="font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">CREW PACK</div>
          <div style="font-size:11px;color:#888;margin-bottom:20px;">Version 3 · Generated ${new Date().toLocaleDateString()}</div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
            ${[['CALL TIME','06:00 AM'],['WRAP TIME','11:00 PM'],['CREW SIZE',crewList.length+' people'],['CLIENT',client.name]].map(([l,v]) => `<div style="background:#f5f5f5;padding:12px;"><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${l}</div><div style="font-size:14px;font-weight:700;color:#1a1a2e;">${v}</div></div>`).join('')}
          </div>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">CREW ROSTER</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:24px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:8px;font-weight:600;font-size:10px;text-transform:uppercase;color:#666;">Name</th><th style="text-align:left;padding:8px;font-weight:600;font-size:10px;text-transform:uppercase;color:#666;">Role</th><th style="text-align:left;padding:8px;font-weight:600;font-size:10px;text-transform:uppercase;color:#666;">Dept</th><th style="text-align:left;padding:8px;font-weight:600;font-size:10px;text-transform:uppercase;color:#666;">Phone</th></tr>
            ${crewList.map(p => `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;font-weight:500;">${p.name}</td><td style="padding:8px;">${p.role}</td><td style="padding:8px;">${getDepartment(p.dept).name}</td><td style="padding:8px;">${p.phone}</td></tr>`).join('')}
          </table>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">SCHEDULE</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:24px;">
            ${[['06:00 AM','Crew Call — Load-in begins at Dock C'],['08:00 AM','Camera blocking & position marks'],['10:00 AM','Full audio line check'],['12:00 PM','Lunch — Catering in Room 204'],['14:00 PM','Full dress rehearsal'],['17:00 PM','Doors open — standby positions'],['19:00 PM','SHOW LIVE'],['22:30 PM','Show wrap — strike begins']].map(([t,d]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px 8px;font-weight:700;color:#2563eb;width:90px;">${t}</td><td style="padding:6px 8px;">${d}</td></tr>`).join('')}
          </table>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">VENUE INFO</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12px;margin-bottom:24px;">
            <div><div style="font-weight:600;margin-bottom:4px;">${venue.name}</div><div style="color:#666;">${venue.address || '1001 Stadium Dr'}<br>${venue.city}, ${venue.state || 'CA'}</div></div>
            <div><div style="font-weight:600;margin-bottom:4px;">Key Contacts</div><div style="color:#666;">Production / TD / venue contacts (sample)</div></div>
          </div>

          <div style="border-top:2px solid #1a1a2e;padding-top:12px;display:flex;justify-content:space-between;font-size:10px;color:#999;">
            <span>CONFIDENTIAL — For crew use only</span><span>Page 1 of 2</span>
          </div>
        </div>`;
      break;

    case 'day-sheet':
      title = 'Day Sheet — ' + ev.name;
      body = `
        <div style="background:#fff;color:#111;padding:32px;font-family:'Segoe UI',sans-serif;min-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px;">
            <div><div style="font-size:20px;font-weight:800;color:#1a1a2e;">DAY SHEET</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:2px;">${ev.name}</div></div>
            <div style="text-align:right;"><div style="font-size:24px;font-weight:800;color:#2563eb;">DAY 1</div><div style="font-size:12px;color:#666;">${formatDate(ev.startDate)}</div></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
            ${[['VENUE',venue.name],['WEATHER','72°F Sunny'],['MEALS','Catering Rm 204'],['PARKING','Lot C — Badge Req.']].map(([l,v]) => `<div style="background:#f8f9fa;padding:10px;"><div style="font-size:8px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;">${l}</div><div style="font-size:12px;font-weight:600;color:#1a1a2e;margin-top:2px;">${v}</div></div>`).join('')}
          </div>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">SCHEDULE OF THE DAY</div>
          ${[['06:00','Crew Call','All crew report to Dock C. Badge required.','#2563eb'],['07:00','Load-In','Audio & Lighting load-in begins','#8b5cf6'],['08:00','Camera Block','Camera positions & blocking rehearsal','#0891b2'],['10:00','Line Check','Full audio & comms check','#0891b2'],['11:30','Tech Rehearsal','Run-through with talent stand-ins','#f59e0b'],['12:30','LUNCH','Catering Room 204 — 1hr break','#10b981'],['13:30','Dress Rehearsal','Full show run with talent','#f59e0b'],['16:00','Break','30 min break — standby call','#6b7280'],['17:00','Doors','House opens — all positions','#ef4444'],['19:00','SHOW','LIVE BROADCAST','#ef4444'],['22:30','Wrap','Strike & load-out begins','#8b5cf6']].map(([t,label,desc,c]) => `
            <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
              <div style="width:50px;font-size:13px;font-weight:700;color:${c};">${t}</div>
              <div style="flex:1;"><div style="font-size:13px;font-weight:600;">${label}</div><div style="font-size:11px;color:#666;">${desc}</div></div>
            </div>`).join('')}

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-top:20px;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">DEPARTMENT ASSIGNMENTS</div>
          <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:20px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;">Dept</th><th style="text-align:left;padding:6px;">Lead</th><th style="text-align:left;padding:6px;">Crew Count</th><th style="text-align:left;padding:6px;">Call</th></tr>
            ${[['Audio','Mike Thompson',3,'06:00'],['Video','Alex Johnson',4,'06:00'],['Lighting','Chris Martinez',3,'07:00'],['Graphics','Emma Davis',2,'08:00']].map(([d,l,c,t]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px;font-weight:600;">${d}</td><td style="padding:6px;">${l}</td><td style="padding:6px;">${c}</td><td style="padding:6px;font-weight:600;color:#2563eb;">${t}</td></tr>`).join('')}
          </table>

          <div style="border-top:2px solid #1a1a2e;padding-top:10px;font-size:10px;color:#999;display:flex;justify-content:space-between;">
            <span>${pldDocumentsBrand().toUpperCase()} · ${ev.name}</span><span>Page 1 of 1</span>
          </div>
        </div>`;
      break;

    case 'trucking-manifest':
      title = 'Trucking Manifest — Alpha Unit';
      body = `
        <div style="background:#fff;color:#111;padding:32px;font-family:'Segoe UI',sans-serif;min-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px;">
            <div><div style="font-size:20px;font-weight:800;color:#1a1a2e;">TRUCKING MANIFEST</div><div style="font-size:12px;color:#666;">Document #TM-2026-0215</div></div>
            <div style="text-align:right;background:#f8f9fa;padding:8px 12px;"><div style="font-size:10px;color:#666;">Event</div><div style="font-size:13px;font-weight:700;color:#1a1a2e;">${ev.name}</div></div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
            ${[['TRUCK','Alpha Unit — 53ft'],['DRIVER','J. Rodriguez'],['DEPARTURE','Feb 5, 2026 6:00 AM'],['ETA','Feb 7, 2026 2:00 PM']].map(([l,v]) => `<div style="background:#f8f9fa;padding:10px;"><div style="font-size:8px;font-weight:700;color:#999;text-transform:uppercase;">${l}</div><div style="font-size:12px;font-weight:600;color:#1a1a2e;margin-top:2px;">${v}</div></div>`).join('')}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:4px;">ROUTE</div><div style="font-size:12px;"><strong>Origin:</strong> Warehouse (sample)<br><strong>Stop 1:</strong> Fuel — I-78 Travel Center<br><strong>Stop 2:</strong> Weigh Station — I-15<br><strong>Dest:</strong> ${venue.name} — Dock C</div></div>
            <div><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:4px;">TRUCK DETAILS</div><div style="font-size:12px;"><strong>License:</strong> NJ-TR-4521<br><strong>Weight Limit:</strong> 45,000 lbs<br><strong>Seal #:</strong> ACM-88421<br><strong>Insurance:</strong> Policy #INS-992841</div></div>
          </div>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">LOAD MANIFEST</div>
          <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:16px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;">#</th><th style="text-align:left;padding:6px;">Item</th><th style="text-align:left;padding:6px;">Qty</th><th style="text-align:left;padding:6px;">Weight</th><th style="text-align:left;padding:6px;">Case/Rack</th><th style="text-align:left;padding:6px;">Notes</th></tr>
            ${[['1','LED Video Panels 4×8',4,'320 lbs','Cases A1-A4','Handle with care'],['2','Moving Head Lights',8,'240 lbs','Rack B1-B2','Top load only'],['3','Audio Racks (Main)',2,'480 lbs','Rack C1-C2','Fragile'],['4','Cable Trunks',12,'600 lbs','Trunks D1-D12','—'],['5','Video Switcher + Router',1,'180 lbs','Case E1','Keep upright'],['6','Staging Decks',6,'900 lbs','Stack F1-F6','—'],['7','Truss Sections',8,'640 lbs','Bundle G1-G4','—'],['8','Misc Consumables',3,'120 lbs','Box H1-H3','—']].map(([n,i,q,w,c,nt]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">${n}</td><td style="padding:6px;font-weight:500;">${i}</td><td style="padding:6px;">${q}</td><td style="padding:6px;">${w}</td><td style="padding:6px;font-size:10px;">${c}</td><td style="padding:6px;font-size:10px;color:#666;">${nt}</td></tr>`).join('')}
            <tr style="background:#f8f9fa;font-weight:700;"><td colspan="3" style="padding:8px;">TOTAL</td><td style="padding:8px;">3,480 lbs</td><td colspan="2" style="padding:8px;">44 items</td></tr>
          </table>

          <div style="border-top:2px solid #1a1a2e;padding-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;font-size:10px;color:#666;">
            <div><div style="font-weight:600;color:#111;">Loaded By:</div><div style="border-bottom:1px solid #ccc;height:24px;margin-top:4px;"></div></div>
            <div><div style="font-weight:600;color:#111;">Verified By:</div><div style="border-bottom:1px solid #ccc;height:24px;margin-top:4px;"></div></div>
            <div><div style="font-weight:600;color:#111;">Date:</div><div style="border-bottom:1px solid #ccc;height:24px;margin-top:4px;"></div></div>
          </div>
        </div>`;
      break;

    case 'rooming-list':
      title = 'Rooming List — ' + pldDocumentsSampleEventTitle();
      body = `
        <div style="background:#fff;color:#111;padding:32px;font-family:'Segoe UI',sans-serif;min-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px;">
            <div><div style="font-size:20px;font-weight:800;color:#1a1a2e;">ROOMING LIST</div><div style="font-size:12px;color:#666;">${pldDocumentsBrand()}</div></div>
            <div style="text-align:right;"><div style="font-size:13px;font-weight:700;color:#1a1a2e;">${pldDocumentsSampleEventTitle()}</div><div style="font-size:11px;color:#666;">${formatDate(ev.startDate)} — ${formatDate(ev.endDate)} · ${venue.city || ''}</div></div>
          </div>

          <div style="background:#f0f7ff;border:1px solid #bfdbfe;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div><div style="font-size:9px;font-weight:700;color:#2563eb;text-transform:uppercase;">Hotel</div><div style="font-size:13px;font-weight:600;">Ritz-Carlton Atlanta</div><div style="font-size:11px;color:#666;">181 Peachtree St NE, Atlanta</div></div>
            <div><div style="font-size:9px;font-weight:700;color:#2563eb;text-transform:uppercase;">Confirmation #</div><div style="font-size:13px;font-weight:600;">RC-ATL-88421</div><div style="font-size:11px;color:#666;">Group Block: ${pldDocumentsBrand().slice(0, 12)}</div></div>
            <div><div style="font-size:9px;font-weight:700;color:#2563eb;text-transform:uppercase;">Rooms</div><div style="font-size:13px;font-weight:600;">5 Rooms</div><div style="font-size:11px;color:#666;">4 King · 1 Double</div></div>
          </div>

          <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:20px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Room</th><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Guest</th><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Dept</th><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Room Type</th><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Check-In</th><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Check-Out</th><th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;">Nights</th></tr>
            ${[['1204','Alex Johnson','Video','King','Feb 13','Feb 17','4'],['1205','Mike Thompson','Audio','King','Feb 13','Feb 17','4'],['1206','Chris Martinez','Lighting','Double','Feb 14','Feb 17','3'],['1207','Sarah Lee','Camera','King','Feb 13','Feb 16','3'],['1208','Emma Davis','Graphics','King','Feb 13','Feb 17','4']].map(([r,g,d,t,i,o,n]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;font-weight:600;">${r}</td><td style="padding:8px;">${g}</td><td style="padding:8px;font-size:11px;">${d}</td><td style="padding:8px;">${t}</td><td style="padding:8px;">${i}</td><td style="padding:8px;">${o}</td><td style="padding:8px;text-align:center;">${n}</td></tr>`).join('')}
            <tr style="background:#f8f9fa;font-weight:700;"><td colspan="6" style="padding:8px;">Total Room Nights</td><td style="padding:8px;text-align:center;">18</td></tr>
          </table>

          <div style="font-size:11px;color:#666;margin-bottom:8px;"><strong>Notes:</strong> Late checkout requested for Feb 17. WiFi included. Breakfast not included — per diem applies.</div>

          <div style="border-top:2px solid #1a1a2e;padding-top:10px;font-size:10px;color:#999;display:flex;justify-content:space-between;"><span>${pldDocumentsBrand().toUpperCase()} · Rooming List</span><span>Page 1 of 1</span></div>
        </div>`;
      break;

    case 'travel-summary':
      title = 'Travel Summary — ' + pldDocumentsSampleEventTitle();
      body = `
        <div style="background:#fff;color:#111;padding:32px;font-family:'Segoe UI',sans-serif;min-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px;">
            <div><div style="font-size:20px;font-weight:800;color:#1a1a2e;">TRAVEL SUMMARY</div><div style="font-size:12px;color:#666;">${pldDocumentsBrand()}</div></div>
            <div style="text-align:right;"><div style="font-size:13px;font-weight:700;color:#1a1a2e;">${pldDocumentsSampleEventTitle()}</div><div style="font-size:11px;color:#666;">${formatDate(ev.startDate)} — ${formatDate(ev.endDate)} · ${venue.city || ''}</div></div>
          </div>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">✈️ FLIGHTS</div>
          <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:20px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;">Passenger</th><th style="text-align:left;padding:6px;">Flight</th><th style="text-align:left;padding:6px;">Route</th><th style="text-align:left;padding:6px;">Depart</th><th style="text-align:left;padding:6px;">Arrive</th><th style="text-align:left;padding:6px;">Status</th></tr>
            ${[['Alex Johnson','DL 1247','JFK → LAS','Feb 10, 8:00a','Feb 10, 11:15a','✅ Confirmed'],['Mike Thompson','UA 892','ORD → LAS','Feb 10, 7:30a','Feb 10, 9:45a','✅ Confirmed'],['Chris Martinez','AA 445','LAX → LAS','Feb 11, 6:00a','Feb 11, 7:10a','✅ Confirmed'],['Alex Johnson','DL 1248','LAS → JFK','Feb 14, 4:00p','Feb 14, 11:30p','📛 Booked'],['Mike Thompson','UA 893','LAS → ORD','Feb 14, 3:00p','Feb 14, 8:15p','📛 Booked']].map(([p,f,r,d,a,s]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px;font-weight:500;">${p}</td><td style="padding:6px;font-weight:600;color:#2563eb;">${f}</td><td style="padding:6px;">${r}</td><td style="padding:6px;">${d}</td><td style="padding:6px;">${a}</td><td style="padding:6px;">${s}</td></tr>`).join('')}
          </table>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">🏨 HOTEL</div>
          <div style="background:#f8f9fa;padding:12px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:12px;">
            <div><strong>MGM Grand Las Vegas</strong><br>3799 S Las Vegas Blvd<br>Conf: MGM-LV-55102</div>
            <div><strong>Check-in:</strong> Feb 10<br><strong>Check-out:</strong> Feb 14<br><strong>Rooms:</strong> 3</div>
            <div><strong>Rate:</strong> $189/night (group)<br><strong>Total:</strong> $2,268<br><strong>Incidentals:</strong> On crew</div>
          </div>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">🚗 GROUND TRANSPORT</div>
          <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:20px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;">Type</th><th style="text-align:left;padding:6px;">Provider</th><th style="text-align:left;padding:6px;">Pickup</th><th style="text-align:left;padding:6px;">Return</th><th style="text-align:left;padding:6px;">Cost</th></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">Rental Car</td><td style="padding:6px;">Enterprise — LAS Airport</td><td style="padding:6px;">Feb 10, 11:30a</td><td style="padding:6px;">Feb 14, 1:00p</td><td style="padding:6px;">$280</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">Self-Drive</td><td style="padding:6px;">Chris Martinez (personal)</td><td style="padding:6px;">Feb 11</td><td style="padding:6px;">Feb 14</td><td style="padding:6px;">$0.585/mi</td></tr>
          </table>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">💰 COST SUMMARY</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">Flights</td><td style="padding:6px;text-align:right;font-weight:600;">$4,250</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">Hotel</td><td style="padding:6px;text-align:right;font-weight:600;">$2,268</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">Ground</td><td style="padding:6px;text-align:right;font-weight:600;">$455</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">Per Diem (3 crew × 4 days × $65)</td><td style="padding:6px;text-align:right;font-weight:600;">$780</td></tr>
            <tr style="background:#f0f0f0;font-weight:700;font-size:13px;"><td style="padding:8px;">TOTAL TRAVEL COST</td><td style="padding:8px;text-align:right;">$7,753</td></tr>
          </table>

          <div style="border-top:2px solid #1a1a2e;padding-top:10px;margin-top:16px;font-size:10px;color:#999;display:flex;justify-content:space-between;"><span>${pldDocumentsBrand().toUpperCase()} · Travel Summary</span><span>Page 1 of 1</span></div>
        </div>`;
      break;

    case 'settlement-report':
      title = 'Settlement Report — ' + pldDocumentsSampleEventTitle();
      const tsEv = ev;
      body = `
        <div style="background:#fff;color:#111;padding:32px;font-family:'Segoe UI',sans-serif;min-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px;">
            <div><div style="font-size:20px;font-weight:800;color:#1a1a2e;">SETTLEMENT REPORT</div><div style="font-size:12px;color:#666;">${pldDocumentsBrand()} · FINAL</div></div>
            <div style="text-align:right;"><div style="font-size:13px;font-weight:700;color:#1a1a2e;">${tsEv.name}</div><div style="font-size:11px;color:#666;">${formatDate(tsEv.startDate)} — ${formatDate(tsEv.endDate)}</div><div style="font-size:11px;color:#666;">${getVenue(tsEv.venue).name}</div></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
            <div style="background:#f8f9fa;padding:16px;text-align:center;"><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;">Approved Budget</div><div style="font-size:22px;font-weight:800;color:#1a1a2e;margin-top:4px;">${formatCurrency(tsEv.budget)}</div></div>
            <div style="background:#fef3c7;padding:16px;text-align:center;"><div style="font-size:9px;font-weight:700;color:#92400e;text-transform:uppercase;">Actual Cost</div><div style="font-size:22px;font-weight:800;color:#92400e;margin-top:4px;">${formatCurrency(tsEv.spent)}</div></div>
            <div style="background:#d1fae5;padding:16px;text-align:center;"><div style="font-size:9px;font-weight:700;color:#065f46;text-transform:uppercase;">Under Budget</div><div style="font-size:22px;font-weight:800;color:#065f46;margin-top:4px;">+${formatCurrency(tsEv.budget - tsEv.spent)}</div></div>
          </div>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">COST BREAKDOWN BY CATEGORY</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:24px;">
            <tr style="background:#f0f0f0;"><th style="text-align:left;padding:8px;">Category</th><th style="text-align:right;padding:8px;">Budget</th><th style="text-align:right;padding:8px;">Actual</th><th style="text-align:right;padding:8px;">Variance</th><th style="text-align:right;padding:8px;">% of Total</th></tr>
            ${[['Labor','$81,000','$74,430','+$6,570','45%'],['Equipment','$39,600','$36,388','+$3,212','22%'],['Travel','$32,400','$29,772','+$2,628','18%'],['Venue & Staging','$18,000','$16,540','+$1,460','10%'],['Catering','$5,400','$5,120','+$280','3%'],['Misc & Contingency','$3,600','$3,150','+$450','2%']].map(([c,b,a,v,p]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;font-weight:500;">${c}</td><td style="padding:8px;text-align:right;">${b}</td><td style="padding:8px;text-align:right;font-weight:600;">${a}</td><td style="padding:8px;text-align:right;color:#065f46;">${v}</td><td style="padding:8px;text-align:right;">${p}</td></tr>`).join('')}
            <tr style="background:#f8f9fa;font-weight:700;"><td style="padding:8px;">TOTAL</td><td style="padding:8px;text-align:right;">${formatCurrency(tsEv.budget)}</td><td style="padding:8px;text-align:right;">${formatCurrency(tsEv.spent)}</td><td style="padding:8px;text-align:right;color:#065f46;">+${formatCurrency(tsEv.budget-tsEv.spent)}</td><td style="padding:8px;text-align:right;">100%</td></tr>
          </table>

          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">CREW SUMMARY</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
            ${[['Crew Size','8 people'],['Total Days','16 man-days'],['Avg Day Rate','$925'],['OT Hours','12 hrs']].map(([l,v]) => `<div style="background:#f8f9fa;padding:10px;"><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;">${l}</div><div style="font-size:13px;font-weight:600;margin-top:2px;">${v}</div></div>`).join('')}
          </div>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;margin-bottom:16px;">
            <div style="font-weight:700;color:#065f46;margin-bottom:4px;">✅ Settlement Approved</div>
            <div style="font-size:11px;color:#166534;">Approved by Cody Martin on ${new Date().toLocaleDateString()} · All invoices reconciled · Client sign-off received</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;border-top:2px solid #1a1a2e;padding-top:12px;margin-top:16px;">
            <div><div style="font-size:10px;font-weight:600;color:#666;">Prepared By:</div><div style="border-bottom:1px solid #ccc;height:28px;margin-top:4px;"></div><div style="font-size:10px;color:#999;margin-top:2px;">Cody Martin, Production Manager</div></div>
            <div><div style="font-size:10px;font-weight:600;color:#666;">Client Approval:</div><div style="border-bottom:1px solid #ccc;height:28px;margin-top:4px;"></div><div style="font-size:10px;color:#999;margin-top:2px;">${getClient(tsEv.client).name}</div></div>
          </div>
        </div>`;
      break;
    default:
      title = 'Template Preview';
      body = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);">No preview available</div>';
  }

  openModal(title, `
    <div style="max-height:70vh;overflow-y:auto;border:1px solid var(--border-default);box-shadow:0 2px 16px rgba(0,0,0,0.3);">
      ${body}
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>openExportModal('${title}'),150)">Export</button>
    <button class="btn btn-primary" onclick="showToast('Printing…','success');window.print();">Print</button>
  `);
}

function renderDocumentsEmailTemplates() {
  const ctxLabel = { crew: 'Crew', overview: 'Event / Client', travel: 'Travel' };
  return `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Use these templates to draft emails with event and crew data pre-filled. Open a draft from here or from the Event page (Overview, Crew, or Travel tab).</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Template</th><th>Context</th><th>Subject</th><th>Actions</th></tr></thead>
        <tbody>
          ${(EMAIL_TEMPLATES || []).map(t => `
            <tr>
              <td><span style="font-weight:500;">${t.name}</span></td>
              <td><span class="phase-badge" style="font-size:10px;">${ctxLabel[t.context] || t.context}</span></td>
              <td style="font-size:12px;color:var(--text-secondary);">${(t.subject || '').replace(/\{\{[^}]+\}\}/g, '…')}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="openSendEmailModal('${t.context}', null, '${t.id}')">Use template</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDocumentsGenerated() {
  const gen = getDocumentsRows().filter((d) => d.source === 'generated');
  return `
    <div class="filter-bar">
      <select class="filter-select"><option>All Events</option>${EVENTS.map(e => `<option>${e.name}</option>`).join('')}</select>
      <select class="filter-select"><option>Last 7 days</option><option>Last 30 days</option><option>All time</option></select>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Event</th><th>Generated</th><th>Version</th><th>Size</th><th>Actions</th></tr></thead><tbody>
      ${gen.length ? gen.map(doc => { const ev = doc.event ? EVENTS.find(e => e.id === doc.event) : null; const evName = ev ? ev.name : '—'; const safe = String(doc.name).replace(/'/g, "\\'"); return `<tr>
        <td><strong>${doc.name}</strong></td><td>${evName}</td><td>${doc.updated}</td><td>v${doc.version}</td><td>${doc.size}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openDocPreview('${doc.id}')">Preview</button><button class="btn btn-ghost btn-sm" onclick="pldDownloadDocument('${doc.id}')">↓</button><button class="btn btn-ghost btn-sm" onclick="openRegenerateModal('${doc.id}')">↻</button></td>
      </tr>`; }).join('') : '<tr><td colspan="6" style="color:var(--text-tertiary);">No generated documents yet.</td></tr>'}
    </tbody></table></div>
  `;
}

async function pldDownloadDocument(docId) {
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API not configured', 'error');
    return;
  }
  const r = await window.pldApiFetch('/api/v1/documents/' + encodeURIComponent(docId));
  if (r.ok && r.body && r.body.meta && r.body.meta.download_url) {
    window.open(r.body.meta.download_url, '_blank', 'noopener,noreferrer');
    return;
  }
  showToast('Could not get download link', 'error');
}

function openDocPreview(docId) {
  void pldOpenDocPreviewAsync(docId);
}

async function pldOpenDocPreviewAsync(docId) {
  if (typeof window.pldApiFetch === 'function') {
    const r = await window.pldApiFetch('/api/v1/documents/' + encodeURIComponent(docId));
    if (r.ok && r.body && r.body.data) {
      const d = r.body.data;
      const m = r.body.meta || {};
      const dl = m.download_url || '';
      const ev = d.event_id ? EVENTS.find((e) => e.id === d.event_id) : null;
      const evName = ev ? ev.name : '—';
      const safeName = String(d.name).replace(/'/g, "\\'");
      const dlEsc = dl.replace(/"/g, '&quot;');
      const isPdf = String(d.mime_type || '').toLowerCase().includes('pdf');
      const pdfFrame =
        dl && isPdf
          ? `<div style="margin-bottom:16px;"><iframe title="PDF preview" src="${dlEsc}#toolbar=0" style="width:100%;height:min(55vh,520px);border:1px solid var(--border-default);border-radius:var(--radius-md);background:var(--bg-tertiary);"></iframe><p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Inline preview uses the signed URL; open in a new tab if the browser blocks embedding.</p></div>`
          : '';
      const body = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
      <div style="font-size:28px;">${uiIcon('docPreview')}</div>
      <div><div style="font-size:16px;font-weight:600;">${d.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${evName} · v${d.version} · ${formatDocBytes(d.size_bytes)}</div></div>
    </div>
    ${pdfFrame}
    <div style="background:var(--bg-tertiary);padding:24px;margin-bottom:16px;">
      <a class="btn btn-primary" href="${dlEsc}" target="_blank" rel="noopener noreferrer">Open / download</a>
      <p style="font-size:12px;color:var(--text-tertiary);margin-top:12px;">Link expires in ~15 minutes. Refresh from the list if needed.</p>
    </div>
  `;
      openModal('Document Preview', body, `
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>openEmailDocModal('${safeName}'),150)">Email</button>
    <div style="flex:1;"></div>
    <button class="btn btn-primary" onclick="pldDownloadDocument('${docId}');closeModal();">Download</button>
  `);
      return;
    }
  }
  const doc = DOCUMENTS.find((d) => d.id === docId);
  if (!doc) {
    showToast('Document not found', 'error');
    return;
  }
  const ev = EVENTS.find(e => e.id === doc.event);
  const body = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
      <div style="font-size:28px;">${uiIcon('docPreview')}</div>
      <div><div style="font-size:16px;font-weight:600;">${doc.name}</div><div style="font-size:12px;color:var(--text-tertiary);">${ev ? ev.name : '—'} · v${doc.version} · ${doc.size}</div></div>
    </div>
    <div style="background:var(--bg-tertiary);padding:40px;text-align:center;margin-bottom:16px;min-height:200px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
      <div style="font-size:48px;opacity:0.3;">${uiIcon('docPreview')}</div>
      <div style="font-size:14px;color:var(--text-tertiary);">Document preview would render here</div>
      <div style="font-size:12px;color:var(--text-tertiary);">PDF viewer / spreadsheet viewer</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><div style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;">Format</div><div style="font-size:13px;font-weight:500;">${(doc.format || 'pdf').toUpperCase()}</div></div>
      <div><div style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;">Last Updated</div><div style="font-size:13px;font-weight:500;">${formatDate(doc.updated)}</div></div>
    </div>
  `;
  openModal('Document Preview', body, `
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>openCompareVersionsModal('${doc.id}','${String(doc.name).replace(/'/g, "\\'")}'),150)">Compare Versions</button>
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>openRegenerateModal('${doc.id}'),150)">Regenerate</button>
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>openEmailDocModal('${String(doc.name).replace(/'/g, "\\'")}'),150)">Email</button>
    <div style="flex:1;"></div>
    <button class="btn btn-primary" onclick="closeModal();setTimeout(()=>openDownloadModal('${String(doc.name).replace(/'/g, "\\'")}'),150)">Download</button>
  `);
}

function openCompareVersionsModal(docId, docName) {
  const body = `
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Side-by-side diff: previous version (left) vs current version (right). Changes highlighted.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;">
      <div style="background:var(--bg-tertiary);padding:16px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">v2 (previous)</div>
        <div style="font-size:13px;font-family:monospace;line-height:1.6;">
          <div>Call time: <span style="background:rgba(239,68,68,0.2);text-decoration:line-through;">06:00 AM</span></div>
          <div>Crew: Mike Thompson, Sarah Lee, <span style="background:rgba(239,68,68,0.2);text-decoration:line-through;">Jake Wilson</span></div>
          <div>Venue: SoFi Stadium</div>
        </div>
      </div>
      <div style="background:var(--bg-tertiary);padding:16px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">v3 (current)</div>
        <div style="font-size:13px;font-family:monospace;line-height:1.6;">
          <div>Call time: <span style="background:rgba(34,197,94,0.2);">07:00 AM</span></div>
          <div>Crew: Mike Thompson, Sarah Lee, <span style="background:rgba(34,197,94,0.2);">Emma Davis</span></div>
          <div>Venue: SoFi Stadium</div>
        </div>
      </div>
    </div>
  `;
  openModal('Compare Versions — ' + docName, body, '<button class="btn btn-primary" onclick="closeModal()">Close</button>');
}

function openGenerateDocModal() {
  const evOpts = EVENTS.filter(e => !isTerminalEventPhase(e.phase)).map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  const tplList = getTemplatesRows();
  const tplOpts = tplList.length
    ? tplList.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')
    : '<option value="">No templates — create one via API</option>';
  const body = `
    <p id="pldGenDocErr" style="font-size:12px;color:var(--accent-red);display:none;"></p>
    <div class="form-group"><label class="form-label">Event</label><select class="form-select" id="pldGenDocEvent"><option value="">Select event…</option>${evOpts}</select></div>
    <div class="form-group"><label class="form-label">Template</label><select class="form-select" id="pldGenDocTemplate">${tplOpts}</select></div>
    <div class="form-group"><label class="form-label">Output</label><select class="form-select" id="pldGenDocFormat"><option value="pdf">PDF (stored as HTML for now)</option><option value="docx">DOCX</option></select></div>
  `;
  openModal('Generate Document', body, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="pldGenDocBtn" onclick="pldSubmitGenerateDocument()">Generate</button>`);
}

async function pldSubmitGenerateDocument() {
  const err = document.getElementById('pldGenDocErr');
  const ev = document.getElementById('pldGenDocEvent')?.value;
  const tpl = document.getElementById('pldGenDocTemplate')?.value;
  const fmt = document.getElementById('pldGenDocFormat')?.value || 'pdf';
  if (!ev || !tpl) {
    if (err) {
      err.style.display = 'block';
      err.textContent = 'Select event and template.';
    }
    return;
  }
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API not configured', 'error');
    return;
  }
  const btn = document.getElementById('pldGenDocBtn');
  if (btn) btn.disabled = true;
  const r = await window.pldApiFetch('/api/v1/documents/generate', {
    method: 'POST',
    body: JSON.stringify({ template_id: tpl, event_id: ev, output_format: fmt }),
  });
  if (btn) btn.disabled = false;
  const genErrs = r.body && Array.isArray(r.body.errors) && r.body.errors.length;
  if (!r.ok || !r.body || genErrs) {
    const msg = (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Generate failed';
    if (err) {
      err.style.display = 'block';
      err.textContent = msg;
    }
    return;
  }
  showToast('Document generated', 'success');
  closeModal();
  await fetchDocumentsFromApiIfConfigured();
}

/** @type {string[]} */
var PLD_DOC_TEMPLATE_CATEGORIES = [
  'contract',
  'rider',
  'invoice',
  'production_schedule',
  'stage_plot',
  'tech_spec',
  'report',
  'day_sheet',
  'crew_pack',
  'other',
];

function pldDocumentsEscHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Mirrors backend `TEMPLATE_VARIABLE_CATALOG` if GET /templates/variable-catalog fails.
 * @type {Array<{ key: string, category: string, label: string, kind: string, description?: string, stub?: boolean }>}
 */
var PLD_TEMPLATE_VARIABLE_CATALOG_FALLBACK = [
  { key: 'event_name', category: 'event', label: 'Event name', kind: 'text' },
  { key: 'event_start_date', category: 'event', label: 'Start date', kind: 'text' },
  { key: 'event_end_date', category: 'event', label: 'End date', kind: 'text' },
  { key: 'event_phase', category: 'event', label: 'Phase', kind: 'text' },
  { key: 'event_status', category: 'event', label: 'Status', kind: 'text' },
  { key: 'event_description', category: 'event', label: 'Description', kind: 'text' },
  { key: 'personnel_table', category: 'personnel', label: 'Personnel table', kind: 'html' },
  { key: 'custom_fields_list', category: 'custom_fields', label: 'Custom fields list', kind: 'html' },
  { key: 'schedule_section', category: 'placeholders', label: 'Schedule block', kind: 'html', stub: true },
  { key: 'travel_section', category: 'placeholders', label: 'Travel block', kind: 'html', stub: true },
  { key: 'financial_section', category: 'placeholders', label: 'Financial block', kind: 'html', stub: true },
];

window.pldInsertTemplateVariable = function (key) {
  const ta = document.getElementById('pldTplContent');
  if (!ta) return;
  const ins = '{{' + key + '}}';
  const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
  const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : start;
  ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
  const pos = start + ins.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
};

window.pldCopyTemplateVariable = function (key) {
  const t = '{{' + key + '}}';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    void navigator.clipboard.writeText(t);
    if (typeof showToast === 'function') showToast('Copied ' + t, 'success');
  } else if (typeof showToast === 'function') {
    showToast(t, 'info');
  }
};

async function pldHydrateTemplateVariablePanel() {
  const mount = document.getElementById('pldTplVarMount');
  if (!mount) return;
  /** @type {typeof PLD_TEMPLATE_VARIABLE_CATALOG_FALLBACK | null} */
  var list = null;
  if (typeof window.pldApiFetch === 'function') {
    const r = await window.pldApiFetch('/api/v1/templates/variable-catalog');
    if (r.ok && r.body && Array.isArray(r.body.data)) list = r.body.data;
  }
  if (!list || !list.length) list = PLD_TEMPLATE_VARIABLE_CATALOG_FALLBACK;
  const categoryLabels = {
    event: 'Event',
    personnel: 'People',
    custom_fields: 'Custom fields',
    placeholders: 'Placeholders (stubs)',
  };
  const order = ['event', 'personnel', 'custom_fields', 'placeholders'];
  /** @type {Record<string, typeof list>} */
  var byCat = {};
  list.forEach(function (row) {
    var c = row.category || 'event';
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(row);
  });
  var html =
    '<div style="font-weight:600;font-size:13px;margin-bottom:8px;">Insert variable</div>' +
    '<p style="font-size:11px;color:var(--text-tertiary);margin:0 0 10px;line-height:1.45;">Built-in merge keys for <code>POST /api/v1/documents/generate</code>. Custom keys: pass <code>data_overrides</code> (see repo <code>docs/template-variables.md</code>).</p>';
  order.forEach(function (cat) {
    var rows = byCat[cat];
    if (!rows || !rows.length) return;
    html +=
      '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-tertiary);margin:12px 0 6px;">' +
      pldDocumentsEscHtml(categoryLabels[cat] || cat) +
      '</div>';
    rows.forEach(function (row) {
      var stub = row.stub ? ' <span style="color:var(--accent-amber);font-size:10px;">stub</span>' : '';
      var k = String(row.key || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      html += '<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);">';
      html +=
        '<div style="font-size:12px;font-weight:500;">' + pldDocumentsEscHtml(row.label || row.key) + stub + '</div>';
      if (row.description) {
        html +=
          '<div style="font-size:10px;color:var(--text-tertiary);margin:2px 0 4px;line-height:1.35;">' +
          pldDocumentsEscHtml(row.description) +
          '</div>';
      }
      html +=
        '<code style="display:block;font-size:10px;color:var(--text-secondary);margin-bottom:6px;">{{' +
        pldDocumentsEscHtml(row.key) +
        '}}</code>';
      html +=
        '<div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px;min-height:auto;" onclick="pldInsertTemplateVariable(\'' +
        k +
        '\')">Insert</button><button type="button" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px;min-height:auto;" onclick="pldCopyTemplateVariable(\'' +
        k +
        '\')">Copy</button></div></div>';
    });
  });
  mount.innerHTML = html;
}

async function openApiTemplateViewModal(templateId) {
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API not configured', 'error');
    return;
  }
  openModal(
    'Template',
    '<p style="margin:0;font-size:13px;color:var(--text-tertiary);">Loading…</p>',
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>',
  );
  const r = await window.pldApiFetch('/api/v1/templates/' + encodeURIComponent(templateId));
  if (!r.ok || !r.body || !r.body.data) {
    closeModal();
    const msg =
      (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Could not load template';
    showToast(msg, 'error');
    return;
  }
  const d = r.body.data;
  const name = String(d.name || 'Template');
  const fmt = String(d.format || 'html');
  const content = String(d.content ?? '');
  const ver = d.version != null ? String(d.version) : '—';
  const cat = String(d.category || '—');
  closeModal();
  const sub = `<strong>${pldDocumentsEscHtml(name)}</strong> <span style="color:var(--text-tertiary);">· ${pldDocumentsEscHtml(cat)} · ${pldDocumentsEscHtml(fmt)} · v${pldDocumentsEscHtml(ver)}</span>`;
  const body = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary);line-height:1.5;">${sub}</div>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <button type="button" class="btn btn-sm btn-secondary" id="pldTplTabPrev">Preview</button>
      <button type="button" class="btn btn-sm btn-secondary" id="pldTplTabSrc">Source</button>
    </div>
    <div id="pldTplPrevPane">
      <iframe sandbox="" id="pldTplViewFrame" title="Template preview" style="width:100%;height:380px;border:1px solid var(--border-default);border-radius:var(--radius-md);background:var(--bg-primary);"></iframe>
      <p style="margin:8px 0 0;font-size:11px;color:var(--text-tertiary);">Preview is sandboxed (no scripts). Use Source for raw <code>{{variables}}</code>.</p>
    </div>
    <div id="pldTplSrcPane" style="display:none;">
      <pre id="pldTplViewPre" style="margin:0;max-height:380px;overflow:auto;padding:12px;font-size:11px;font-family:ui-monospace,monospace;background:var(--bg-tertiary);border-radius:var(--radius-md);white-space:pre-wrap;word-break:break-word;border:1px solid var(--border-subtle);"></pre>
    </div>
  `;
  openModal('Template — ' + name, body, '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>');
  setTimeout(function () {
    const pre = document.getElementById('pldTplViewPre');
    if (pre) pre.textContent = content;
    const ifr = document.getElementById('pldTplViewFrame');
    if (ifr) {
      if (fmt === 'html') {
        ifr.srcdoc = content;
      } else {
        ifr.srcdoc =
          '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:12px;font:13px system-ui;color:#111;}</style></head><body><pre style="white-space:pre-wrap;word-break:break-word;">' +
          pldDocumentsEscHtml(content) +
          '</pre></body></html>';
      }
    }
    const bp = document.getElementById('pldTplPrevPane');
    const sp = document.getElementById('pldTplSrcPane');
    document.getElementById('pldTplTabPrev')?.addEventListener('click', function () {
      if (bp) bp.style.display = 'block';
      if (sp) sp.style.display = 'none';
    });
    document.getElementById('pldTplTabSrc')?.addEventListener('click', function () {
      if (bp) bp.style.display = 'none';
      if (sp) sp.style.display = 'block';
    });
  }, 0);
}

async function openApiTemplateEditorModal(templateId) {
  if (typeof window.pldApiFetch !== 'function') {
    showToast('API not configured', 'error');
    return;
  }
  openModal(
    'Edit template',
    '<p style="margin:0;font-size:13px;color:var(--text-tertiary);">Loading…</p>',
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>',
  );
  const r = await window.pldApiFetch('/api/v1/templates/' + encodeURIComponent(templateId));
  if (!r.ok || !r.body || !r.body.data) {
    closeModal();
    const msg =
      (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Could not load template';
    showToast(msg, 'error');
    return;
  }
  const d = r.body.data;
  const name = String(d.name || '');
  const desc = String(d.description ?? '');
  const category = String(d.category || 'report');
  const format = String(d.format || 'html');
  const content = String(d.content ?? '');
  closeModal();
  var catList = PLD_DOC_TEMPLATE_CATEGORIES.slice();
  if (category && catList.indexOf(category) < 0) catList.unshift(category);
  const catOpts = catList.map(function (c) {
    const sel = c === category ? ' selected' : '';
    const label = c.replace(/_/g, ' ');
    return '<option value="' + c + '"' + sel + '>' + label + '</option>';
  }).join('');
  const fmtOpts = ['html', 'markdown', 'docx_xml']
    .map(function (f) {
      const sel = f === format ? ' selected' : '';
      return '<option value="' + f + '"' + sel + '>' + f + '</option>';
    })
    .join('');
  const body = `
    <p id="pldTplEditErr" style="display:none;font-size:12px;color:var(--accent-red);margin:0 0 10px;"></p>
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="pldTplName" value="${pldDocumentsEscHtml(name)}"></div>
    <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="pldTplDesc" rows="2">${pldDocumentsEscHtml(desc)}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="pldTplCategory">${catOpts}</select></div>
      <div class="form-group"><label class="form-label">Format</label><select class="form-select" id="pldTplFormat">${fmtOpts}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,280px);gap:16px;align-items:start;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Content <span style="font-weight:400;color:var(--text-tertiary);">({{variable}})</span></label>
        <textarea class="form-textarea" id="pldTplContent" style="min-height:320px;font-family:ui-monospace,monospace;font-size:12px;"></textarea>
      </div>
      <div id="pldTplVarMount" class="card" style="padding:12px 14px;margin:0;max-height:420px;overflow-y:auto;">
        <p style="margin:0;font-size:12px;color:var(--text-tertiary);">Loading variables…</p>
      </div>
    </div>
  `;
  const footer = `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" id="pldTplSaveBtn" onclick="void window.pldSaveApiTemplate('${templateId}')">Save</button>`;
  openModal('Edit template — ' + name, body, footer);
  setTimeout(function () {
    const ta = document.getElementById('pldTplContent');
    if (ta) ta.value = content;
    void pldHydrateTemplateVariablePanel();
  }, 0);
}

window.pldSaveApiTemplate = async function (templateId) {
  const errEl = document.getElementById('pldTplEditErr');
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }
  const name = document.getElementById('pldTplName')?.value?.trim();
  if (!name) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Name is required.';
    }
    showToast('Name is required', 'error');
    return;
  }
  const btn = document.getElementById('pldTplSaveBtn');
  if (btn) btn.disabled = true;
  try {
    const payload = {
      name: name,
      description: document.getElementById('pldTplDesc')?.value ?? '',
      category: document.getElementById('pldTplCategory')?.value,
      format: document.getElementById('pldTplFormat')?.value,
      content: document.getElementById('pldTplContent')?.value ?? '',
    };
    const r = await window.pldApiFetch('/api/v1/templates/' + encodeURIComponent(templateId), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!r.ok || (r.body && r.body.errors && r.body.errors.length)) {
      const msg =
        (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Save failed';
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = msg;
      }
      showToast(msg, 'error');
      return;
    }
    showToast('Template saved', 'success');
    closeModal();
    if (typeof fetchDocumentsFromApiIfConfigured === 'function') await fetchDocumentsFromApiIfConfigured();
    if (typeof currentPage !== 'undefined' && currentPage === 'documents' && typeof renderPage === 'function') {
      renderPage('documents', { skipModuleDataFetch: true });
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ============================================
// SETTINGS (with sub-tabs)
// ============================================
