/* ============================================
   Venues — directory, search, CRUD, CRM contacts (API)
   ============================================ */
window.__pldVenuesListSearch = window.__pldVenuesListSearch || '';
/** @type {ReturnType<typeof setTimeout> | null} */
window.__pldVenuesSearchTimer = window.__pldVenuesSearchTimer || null;
window.__pldVenuesApiLoadError = window.__pldVenuesApiLoadError || null;

function pldVenuesHtmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** JSON string safe inside double-quoted HTML onclick. */
function pldVenuesJsArgForOnclick(s) {
  return JSON.stringify(String(s)).replace(/"/g, '&quot;');
}

function pldVenuesUseRestApi() {
  return typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
}

/**
 * Refill VENUES from GET /api/v1/venues (optional search).
 * @param {string} [search]
 */
window.pldFetchVenuesFromApiIfConfigured = async function pldFetchVenuesFromApiIfConfigured(search) {
  if (typeof window.pldApiFetch !== 'function') return;
  const baseOn = typeof window.PLD_API_BASE === 'string' && window.PLD_API_BASE.trim() !== '';
  if (!baseOn) {
    window.__pldVenuesApiLoadError = null;
    return;
  }
  window.__pldVenuesApiLoadError = null;
  const term =
    search !== undefined && search !== null
      ? String(search).trim()
      : String(window.__pldVenuesListSearch || '').trim();
  try {
    const all = [];
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      const q = new URLSearchParams({ limit: '100' });
      if (cursor) q.set('cursor', cursor);
      if (term) q.set('search', term);
      const res = await window.pldApiFetch('/api/v1/venues?' + q.toString(), { method: 'GET' });
      if (!res.ok) {
        const msg =
          res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
        throw new Error(msg || 'HTTP ' + res.status);
      }
      const rows = (res.body && res.body.data) || [];
      for (let i = 0; i < rows.length; i++) {
        const v = rows[i];
        all.push({
          id: v.id,
          name: v.name,
          city: v.city || '',
        });
      }
      const meta = res.body && res.body.meta;
      if (!meta || !meta.cursor) break;
      cursor = meta.cursor;
    }
    if (typeof VENUES !== 'undefined' && Array.isArray(VENUES)) {
      VENUES.length = 0;
      all.forEach(function (row) {
        VENUES.push(row);
      });
    }
  } catch (e) {
    window.__pldVenuesApiLoadError =
      e && /** @type {{ message?: string }} */ (e).message
        ? String(/** @type {{ message?: string }} */ (e).message)
        : 'Venues API unavailable';
  }
  const el = document.querySelector('.page-title');
  if (el && el.textContent === 'Venues' && typeof renderPage === 'function') {
    renderPage('venues', { skipModuleDataFetch: true });
  }
};

function onVenuesSearchInput(value) {
  window.__pldVenuesListSearch = value;
  if (window.__pldVenuesSearchTimer) clearTimeout(window.__pldVenuesSearchTimer);
  window.__pldVenuesSearchTimer = setTimeout(function () {
    window.__pldVenuesSearchTimer = null;
    if (pldVenuesUseRestApi() && typeof window.pldFetchVenuesFromApiIfConfigured === 'function') {
      void window.pldFetchVenuesFromApiIfConfigured(window.__pldVenuesListSearch);
    } else if (typeof renderPage === 'function') {
      renderPage('venues', { skipModuleDataFetch: true });
    }
  }, 300);
}

window.pldOpenVenueEditorModal = async function pldOpenVenueEditorModal(venueId) {
  const id = venueId ? String(venueId) : '';
  let existing =
    id && typeof VENUES !== 'undefined' && Array.isArray(VENUES)
      ? VENUES.find(function (x) {
          return String(x.id) === id;
        })
      : null;
  if (id && pldVenuesUseRestApi() && typeof window.pldApiFetch === 'function') {
    const r = await window.pldApiFetch('/api/v1/venues/' + encodeURIComponent(id), { method: 'GET' });
    if (r.ok && r.body && r.body.data) {
      const d = r.body.data;
      existing = {
        id: d.id,
        name: d.name,
        city: d.city || '',
        address: d.address || '',
        latitude: d.latitude != null ? Number(d.latitude) : '',
        longitude: d.longitude != null ? Number(d.longitude) : '',
        timezone: d.timezone || '',
        notes: d.notes || '',
      };
    }
  }
  const isEdit = !!id;
  const name0 = existing ? String(existing.name || '') : '';
  const city0 = existing && existing.city != null ? String(existing.city) : '';
  const addr0 = existing && existing.address != null ? String(existing.address) : '';
  const lat0 =
    existing && existing.latitude !== undefined && existing.latitude !== ''
      ? String(existing.latitude)
      : '';
  const lng0 =
    existing && existing.longitude !== undefined && existing.longitude !== ''
      ? String(existing.longitude)
      : '';
  const tz0 = existing && existing.timezone != null ? String(existing.timezone) : '';
  const notes0 = existing && existing.notes != null ? String(existing.notes) : '';

  const body = `
    <input type="hidden" id="pldVenueFormId" value="${pldVenuesHtmlEsc(id)}">
    <div class="form-group"><label class="form-label">Name</label>
      <input type="text" class="form-input" id="pldVenueFormName" value="${pldVenuesHtmlEsc(name0)}" placeholder="Venue name"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">City</label>
        <input type="text" class="form-input" id="pldVenueFormCity" value="${pldVenuesHtmlEsc(city0)}"></div>
      <div class="form-group"><label class="form-label">Timezone (IANA)</label>
        <input type="text" class="form-input" id="pldVenueFormTz" value="${pldVenuesHtmlEsc(tz0)}" placeholder="America/Chicago"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label>
      <input type="text" class="form-input" id="pldVenueFormAddress" value="${pldVenuesHtmlEsc(addr0)}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">Latitude</label>
        <input type="text" class="form-input" id="pldVenueFormLat" value="${pldVenuesHtmlEsc(lat0)}"></div>
      <div class="form-group"><label class="form-label">Longitude</label>
        <input type="text" class="form-input" id="pldVenueFormLng" value="${pldVenuesHtmlEsc(lng0)}"></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label>
      <textarea class="form-textarea" id="pldVenueFormNotes" rows="3">${pldVenuesHtmlEsc(notes0)}</textarea></div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="void pldSubmitVenueEditor()">${isEdit ? 'Save' : 'Add venue'}</button>
  `;
  if (typeof openModal === 'function') openModal(isEdit ? 'Edit venue' : 'Add venue', body, footer);
};

window.pldSubmitVenueEditor = async function pldSubmitVenueEditor() {
  const idEl = document.getElementById('pldVenueFormId');
  const id = idEl && idEl.value ? String(idEl.value).trim() : '';
  const name = document.getElementById('pldVenueFormName')?.value?.trim() || '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Name is required', 'error');
    return;
  }
  const city = document.getElementById('pldVenueFormCity')?.value?.trim() || '';
  const address = document.getElementById('pldVenueFormAddress')?.value?.trim() || '';
  const tz = document.getElementById('pldVenueFormTz')?.value?.trim() || '';
  const notes = document.getElementById('pldVenueFormNotes')?.value?.trim() || '';
  const latRaw = document.getElementById('pldVenueFormLat')?.value?.trim() || '';
  const lngRaw = document.getElementById('pldVenueFormLng')?.value?.trim() || '';
  let latitude = null;
  let longitude = null;
  if (latRaw !== '') {
    const n = Number(latRaw);
    if (!Number.isNaN(n)) latitude = n;
  }
  if (lngRaw !== '') {
    const n = Number(lngRaw);
    if (!Number.isNaN(n)) longitude = n;
  }

  if (!pldVenuesUseRestApi() || typeof window.pldApiFetch !== 'function') {
    if (typeof showToast === 'function') showToast('Connect to API to save venues', 'warning');
    return;
  }

  if (id) {
    const patch = {
      name,
      city: city || null,
      address: address || null,
      latitude,
      longitude,
      timezone: tz || null,
      notes: notes || null,
    };
    const res = await window.pldApiFetch('/api/v1/venues/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Update failed', 'error');
      return;
    }
  } else {
    const res = await window.pldApiFetch('/api/v1/venues', {
      method: 'POST',
      body: JSON.stringify({
        name,
        city: city || undefined,
        address: address || undefined,
        latitude: latitude != null ? latitude : undefined,
        longitude: longitude != null ? longitude : undefined,
        timezone: tz || undefined,
        notes: notes || undefined,
      }),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Create failed', 'error');
      return;
    }
  }
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(id ? 'Venue updated' : 'Venue added', 'success');
  if (typeof window.pldFetchVenuesFromApiIfConfigured === 'function') {
    await window.pldFetchVenuesFromApiIfConfigured(window.__pldVenuesListSearch);
  }
};

window.pldConfirmDeleteVenue = function pldConfirmDeleteVenue(venueId) {
  const id = String(venueId || '').trim();
  if (!id) return;
  const v =
    typeof VENUES !== 'undefined' && VENUES.find
      ? VENUES.find(function (x) {
          return String(x.id) === id;
        })
      : null;
  const label = v ? String(v.name || id) : id;
  if (typeof showConfirm !== 'function') return;
  showConfirm('Delete venue', 'Delete ' + label + '?', function () {
    void pldRunDeleteVenue(id);
  });
};

async function pldRunDeleteVenue(id) {
  if (!pldVenuesUseRestApi() || typeof window.pldApiFetch !== 'function') return;
  const res = await window.pldApiFetch('/api/v1/venues/' + encodeURIComponent(id), { method: 'DELETE' });
  if (res.status === 409) {
    const msg =
      res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message
        ? String(res.body.errors[0].message)
        : 'Venue still has events';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    return;
  }
  if (!res.ok) {
    const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
    if (typeof showToast === 'function') showToast(msg || 'Delete failed', 'error');
    return;
  }
  if (typeof showToast === 'function') showToast('Venue removed', 'success');
  if (typeof window.pldFetchVenuesFromApiIfConfigured === 'function') {
    await window.pldFetchVenuesFromApiIfConfigured(window.__pldVenuesListSearch);
  }
}

function pldContextMenuVenueRow(domEvent, venueId) {
  const id = String(venueId || '');
  if (!id || typeof window.pldShowContextMenu !== 'function') return;
  const list = typeof VENUES !== 'undefined' && Array.isArray(VENUES) ? VENUES : [];
  const v = list.find(function (x) {
    return String(x.id) === id;
  });
  const items = [];
  const rest = typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  if (rest) {
    items.push({
      label: 'Edit…',
      action: function () {
        void window.pldOpenVenueEditorModal(id);
      },
    });
    items.push({
      label: 'Venue contacts…',
      action: function () {
        void window.pldOpenVenueContactsModal(id);
      },
    });
  }
  if (v && v.name) {
    items.push({
      label: 'Copy venue name',
      action: function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          void navigator.clipboard.writeText(String(v.name));
          if (typeof showToast === 'function') showToast('Copied', 'success');
        }
      },
    });
  }
  if (rest) {
    items.push({
      label: 'Delete',
      danger: true,
      action: function () {
        window.pldConfirmDeleteVenue(id);
      },
    });
  }
  if (items.length) window.pldShowContextMenu(domEvent.clientX, domEvent.clientY, items);
}

function pldVenuesRowsForDisplay() {
  const q = (window.__pldVenuesListSearch || '').trim().toLowerCase();
  const list = typeof VENUES !== 'undefined' && Array.isArray(VENUES) ? VENUES : [];
  if (!q || pldVenuesUseRestApi()) return list.slice();
  return list.filter(function (v) {
    const parts = [String(v.name || ''), String(v.city || '')].join(' ').toLowerCase();
    return parts.indexOf(q) >= 0;
  });
}

function renderVenues() {
  const rest = typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  const apiErr =
    typeof window.__pldVenuesApiLoadError !== 'undefined' && window.__pldVenuesApiLoadError
      ? String(window.__pldVenuesApiLoadError)
      : '';
  const errBanner = apiErr
    ? `<div class="pld-directory-error-banner">${pldVenuesHtmlEsc(apiErr)}</div>`
    : '';
  const searchVal = pldVenuesHtmlEsc(window.__pldVenuesListSearch || '');
  const rows = pldVenuesRowsForDisplay();
  const tbody =
    rows.length === 0
      ? `<tr><td colspan="3" class="pld-empty-state" style="border:none;">No venues match. Add one or adjust search.</td></tr>`
      : rows
          .map(function (v) {
            const id = String(v.id);
            const safeId = id.replace(/'/g, "\\'");
            return `<tr oncontextmenu="event.preventDefault();event.stopPropagation();pldContextMenuVenueRow(event,'${safeId}');">
            <td><strong>${pldVenuesHtmlEsc(v.name)}</strong></td>
            <td style="color:var(--text-tertiary);">${pldVenuesHtmlEsc(v.city || '')}</td>
            <td class="pld-directory-actions">
              ${
                rest
                  ? `<button type="button" class="btn btn-ghost btn-sm" onclick="void pldOpenVenueContactsModal(${pldVenuesJsArgForOnclick(id)})">Contacts</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="void pldOpenVenueEditorModal(${pldVenuesJsArgForOnclick(id)})">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="pldConfirmDeleteVenue(${pldVenuesJsArgForOnclick(id)})">Delete</button>`
                  : '<span class="form-hint" style="font-size:12px;">API off</span>'
              }
            </td>
          </tr>`;
          })
          .join('');

  return `
    <div class="page-header pld-directory-page-header">
      <div>
        <h1 class="page-title">Venues</h1>
        <p class="page-subtitle">Locations, addresses, and CRM contacts</p>
      </div>
      ${
        rest
          ? `<button type="button" class="btn btn-primary" onclick="void pldOpenVenueEditorModal('')">+ Add venue</button>`
          : ''
      }
    </div>
    ${errBanner}
    <div class="pld-directory-toolbar">
      <div class="pld-directory-toolbar-inner">
        <label class="form-label" for="pldVenuesSearch">Search</label>
        <input type="search" id="pldVenuesSearch" class="form-input" style="max-width:320px;min-width:180px;flex:1;" placeholder="Name or city…" value="${searchVal}"
          oninput="onVenuesSearchInput(this.value)">
        <span class="pld-directory-meta">${rows.length} shown</span>
      </div>
      ${
        rest
          ? '<p class="pld-directory-api-hint">Search uses the API when connected.</p>'
          : '<p class="pld-directory-api-hint">Local mode: filters in the browser.</p>'
      }
    </div>
    <div class="table-wrap pld-data-table-wrap pld-directory-table-wrap">
      <table class="data-table pld-directory-table">
        <thead><tr><th>Venue</th><th>City</th><th class="pld-directory-actions">Actions</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}
