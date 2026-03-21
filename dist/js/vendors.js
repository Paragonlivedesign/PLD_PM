/* ============================================
   Vendors — directory, search, CRUD, linked client, contacts (API)
   ============================================ */
window.__pldVendorsListSearch = window.__pldVendorsListSearch || '';
/** @type {ReturnType<typeof setTimeout> | null} */
window.__pldVendorsSearchTimer = window.__pldVendorsSearchTimer || null;
window.__pldVendorsApiLoadError = window.__pldVendorsApiLoadError || null;

function pldVendorsHtmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function pldVendorsJsArgForOnclick(s) {
  return JSON.stringify(String(s)).replace(/"/g, '&quot;');
}

function pldVendorsUseRestApi() {
  return typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
}

window.pldRefreshVendorsFromApiIfConfigured = async function pldRefreshVendorsFromApiIfConfigured() {
  if (typeof pldListVendorsFromApi !== 'function' || typeof VENDORS === 'undefined') return;
  const term = String(window.__pldVendorsListSearch || '').trim();
  const rows = await pldListVendorsFromApi(term);
  if (!Array.isArray(rows)) return;
  VENDORS.length = 0;
  rows.forEach(function (raw) {
    VENDORS.push({
      id: raw.id,
      name: raw.name,
      contact_name: raw.contact_name != null ? String(raw.contact_name) : '',
      contact_email: raw.contact_email != null ? String(raw.contact_email) : '',
      phone: raw.phone != null ? String(raw.phone) : '',
      notes: raw.notes != null ? String(raw.notes) : '',
      linked_client_id: raw.linked_client_id != null ? String(raw.linked_client_id) : '',
    });
  });
};

function onVendorsSearchInput(value) {
  window.__pldVendorsListSearch = value;
  if (window.__pldVendorsSearchTimer) clearTimeout(window.__pldVendorsSearchTimer);
  window.__pldVendorsSearchTimer = setTimeout(function () {
    window.__pldVendorsSearchTimer = null;
    if (pldVendorsUseRestApi() && typeof window.pldRefreshVendorsFromApiIfConfigured === 'function') {
      void (async function () {
        window.__pldVendorsApiLoadError = null;
        try {
          await window.pldRefreshVendorsFromApiIfConfigured();
        } catch (e) {
          window.__pldVendorsApiLoadError =
            e && /** @type {{ message?: string }} */ (e).message
              ? String(/** @type {{ message?: string }} */ (e).message)
              : 'Vendors API unavailable';
        }
        if (typeof renderPage === 'function') renderPage('vendors', { skipModuleDataFetch: true });
      })();
    } else if (typeof renderPage === 'function') {
      renderPage('vendors', { skipModuleDataFetch: true });
    }
  }, 300);
}

window.pldOpenVendorEditorModal = async function pldOpenVendorEditorModal(vendorId) {
  const id = vendorId ? String(vendorId) : '';
  let existing = null;
  if (id && typeof VENDORS !== 'undefined' && VENDORS.find) {
    existing = VENDORS.find(function (x) {
      return String(x.id) === id;
    });
  }
  if (id && pldVendorsUseRestApi() && typeof window.pldApiFetch === 'function') {
    const r = await window.pldApiFetch('/api/v1/vendors/' + encodeURIComponent(id), { method: 'GET' });
    if (r.ok && r.body && r.body.data) {
      const d = r.body.data;
      existing = {
        id: d.id,
        name: d.name,
        contact_name: d.contact_name != null ? String(d.contact_name) : '',
        contact_email: d.contact_email != null ? String(d.contact_email) : '',
        phone: d.phone != null ? String(d.phone) : '',
        notes: d.notes != null ? String(d.notes) : '',
        linked_client_id: d.linked_client_id != null ? String(d.linked_client_id) : '',
      };
    }
  }
  const isEdit = !!id;
  const name0 = existing ? String(existing.name || '') : '';
  const cn0 = existing && existing.contact_name != null ? String(existing.contact_name) : '';
  const em0 = existing && existing.contact_email != null ? String(existing.contact_email) : '';
  const ph0 = existing && existing.phone != null ? String(existing.phone) : '';
  const no0 = existing && existing.notes != null ? String(existing.notes) : '';
  const lid = existing && existing.linked_client_id != null ? String(existing.linked_client_id) : '';
  const clientOpts = (typeof CLIENTS !== 'undefined' && Array.isArray(CLIENTS) ? CLIENTS : [])
    .map(function (c) {
      const sel = lid === String(c.id) ? ' selected' : '';
      return `<option value="${pldVendorsHtmlEsc(c.id)}"${sel}>${pldVendorsHtmlEsc(c.name)}</option>`;
    })
    .join('');

  const body = `
    <input type="hidden" id="pldVendorFormId" value="${pldVendorsHtmlEsc(id)}">
    <div class="form-group"><label class="form-label">Vendor name</label>
      <input type="text" class="form-input" id="pldVendorFormName" value="${pldVendorsHtmlEsc(name0)}" placeholder="Supplier or company"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">Contact name</label>
        <input type="text" class="form-input" id="pldVendorFormContactName" value="${pldVendorsHtmlEsc(cn0)}"></div>
      <div class="form-group"><label class="form-label">Contact email</label>
        <input type="email" class="form-input" id="pldVendorFormContactEmail" value="${pldVendorsHtmlEsc(em0)}"></div>
    </div>
    <div class="form-group"><label class="form-label">Phone</label>
      <input type="text" class="form-input" id="pldVendorFormPhone" value="${pldVendorsHtmlEsc(ph0)}"></div>
    <div class="form-group"><label class="form-label">Linked client</label>
      <select class="form-select" id="pldVendorFormLinkedClient">
        <option value="">— None —</option>
        ${clientOpts}
      </select>
      <p class="form-hint">Optional — same org as an existing client record.</p></div>
    <div class="form-group"><label class="form-label">Notes</label>
      <textarea class="form-textarea" id="pldVendorFormNotes" rows="3">${pldVendorsHtmlEsc(no0)}</textarea></div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="void pldSubmitVendorEditor()">${isEdit ? 'Save' : 'Add vendor'}</button>
  `;
  if (typeof openModal === 'function') openModal(isEdit ? 'Edit vendor' : 'Add vendor', body, footer);
};

window.pldSubmitVendorEditor = async function pldSubmitVendorEditor() {
  const idEl = document.getElementById('pldVendorFormId');
  const id = idEl && idEl.value ? String(idEl.value).trim() : '';
  const name = document.getElementById('pldVendorFormName')?.value?.trim() || '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Vendor name is required', 'error');
    return;
  }
  const contact_name = document.getElementById('pldVendorFormContactName')?.value?.trim() || '';
  const contact_email = document.getElementById('pldVendorFormContactEmail')?.value?.trim() || '';
  const phone = document.getElementById('pldVendorFormPhone')?.value?.trim() || '';
  const notes = document.getElementById('pldVendorFormNotes')?.value?.trim() || '';
  const lcEl = document.getElementById('pldVendorFormLinkedClient');
  const linked_client_id = lcEl && lcEl.value ? String(lcEl.value) : null;

  if (!pldVendorsUseRestApi() || typeof window.pldCreateVendorViaApi !== 'function') {
    if (typeof showToast === 'function') showToast('Connect to API to save vendors', 'warning');
    return;
  }

  if (id) {
    const updated = await window.pldUpdateVendorViaApi(id, {
      name,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      phone: phone || null,
      notes: notes || null,
      linked_client_id,
    });
    if (!updated) return;
  } else {
    const created = await window.pldCreateVendorViaApi({
      name,
      contact_name: contact_name || undefined,
      contact_email: contact_email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      linked_client_id: linked_client_id || undefined,
    });
    if (!created) return;
  }
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(id ? 'Vendor updated' : 'Vendor added', 'success');
  if (typeof window.pldRefreshVendorsFromApiIfConfigured === 'function') {
    await window.pldRefreshVendorsFromApiIfConfigured();
  }
  if (typeof renderPage === 'function') renderPage('vendors', { skipModuleDataFetch: true });
};

window.pldConfirmDeleteVendor = function pldConfirmDeleteVendor(vendorId) {
  const id = String(vendorId || '').trim();
  if (!id) return;
  const v =
    typeof VENDORS !== 'undefined' && VENDORS.find
      ? VENDORS.find(function (x) {
          return String(x.id) === id;
        })
      : null;
  const label = v ? String(v.name || id) : id;
  if (typeof showConfirm !== 'function') return;
  showConfirm('Delete vendor', 'Delete ' + label + '? CRM contacts for this vendor will be removed.', function () {
    void pldRunDeleteVendor(id);
  });
};

async function pldRunDeleteVendor(id) {
  if (!pldVendorsUseRestApi() || typeof window.pldDeleteVendorViaApi !== 'function') return;
  const ok = await window.pldDeleteVendorViaApi(id);
  if (!ok) return;
  if (typeof showToast === 'function') showToast('Vendor removed', 'success');
  if (typeof window.pldRefreshVendorsFromApiIfConfigured === 'function') {
    await window.pldRefreshVendorsFromApiIfConfigured();
  }
  if (typeof renderPage === 'function') renderPage('vendors', { skipModuleDataFetch: true });
}

window.pldVendorLinkedClientChange = function (vendorId, clientId) {
  void (async function () {
    if (typeof window.pldUpdateVendorViaApi !== 'function') return;
    const vid = String(vendorId);
    const cid = clientId ? String(clientId) : null;
    const updated = await window.pldUpdateVendorViaApi(vid, { linked_client_id: cid });
    if (!updated) return;
    const row = VENDORS.find(function (x) {
      return x.id === vid;
    });
    if (row) row.linked_client_id = cid || '';
    if (typeof showToast === 'function') showToast('Linked client updated', 'success');
    if (typeof renderPage === 'function') renderPage('vendors', { skipModuleDataFetch: true });
  })();
};

function pldContextMenuVendorRow(domEvent, vendorId) {
  const id = String(vendorId || '');
  if (!id || typeof window.pldShowContextMenu !== 'function') return;
  const list = typeof VENDORS !== 'undefined' && Array.isArray(VENDORS) ? VENDORS : [];
  const v = list.find(function (x) {
    return String(x.id) === id;
  });
  const items = [];
  const rest = typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  if (rest) {
    items.push({
      label: 'Edit…',
      action: function () {
        void window.pldOpenVendorEditorModal(id);
      },
    });
    items.push({
      label: 'Vendor contacts…',
      action: function () {
        void window.pldOpenVendorContactsModal(id);
      },
    });
  }
  if (v && v.name) {
    items.push({
      label: 'Copy name',
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
        window.pldConfirmDeleteVendor(id);
      },
    });
  }
  if (items.length) window.pldShowContextMenu(domEvent.clientX, domEvent.clientY, items);
}

function pldVendorsRowsForDisplay() {
  const q = (window.__pldVendorsListSearch || '').trim().toLowerCase();
  const list = typeof VENDORS !== 'undefined' && Array.isArray(VENDORS) ? VENDORS : [];
  if (!q || pldVendorsUseRestApi()) return list.slice();
  return list.filter(function (v) {
    const parts = [
      String(v.name || ''),
      String(v.contact_email || ''),
      String(v.contact_name || ''),
    ]
      .join(' ')
      .toLowerCase();
    return parts.indexOf(q) >= 0;
  });
}

function renderVendors() {
  const rest = typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  const apiErr =
    typeof window.__pldVendorsApiLoadError !== 'undefined' && window.__pldVendorsApiLoadError
      ? String(window.__pldVendorsApiLoadError)
      : '';
  const errBanner = apiErr
    ? `<div class="pld-directory-error-banner">${pldVendorsHtmlEsc(apiErr)}</div>`
    : '';
  const searchVal = pldVendorsHtmlEsc(window.__pldVendorsListSearch || '');
  const rows = pldVendorsRowsForDisplay();
  const tbody =
    rows.length === 0
      ? `<tr><td colspan="4" class="pld-empty-state" style="border:none;">No vendors match. Add one or adjust search.</td></tr>`
      : rows
          .map(function (v) {
            const id = String(v.id);
            const lid = v.linked_client_id ? String(v.linked_client_id) : '';
            const clientOpts = (typeof CLIENTS !== 'undefined' && Array.isArray(CLIENTS) ? CLIENTS : [])
              .map(function (c) {
                const sel = lid === String(c.id) ? ' selected' : '';
                return `<option value="${pldVendorsHtmlEsc(c.id)}"${sel}>${pldVendorsHtmlEsc(c.name)}</option>`;
              })
              .join('');
            return `<tr oncontextmenu="event.preventDefault();event.stopPropagation();pldContextMenuVendorRow(event,${pldVendorsJsArgForOnclick(id)});">
            <td><strong>${pldVendorsHtmlEsc(v.name)}</strong>
              <div style="font-size:11px;color:var(--text-tertiary);">${pldVendorsHtmlEsc(v.contact_email || '')}</div></td>
            <td>
              ${
                rest
                  ? `<select class="form-select" style="max-width:220px;" onchange="pldVendorLinkedClientChange(${pldVendorsJsArgForOnclick(id)}, this.value)">
                <option value="">— None —</option>
                ${clientOpts}
              </select>`
                  : pldVendorsHtmlEsc(
                      lid ? (CLIENTS.find(function (c) { return c.id === lid; }) || {}).name || lid : '—',
                    )
              }
            </td>
            <td class="pld-directory-actions">
              ${
                rest
                  ? `<button type="button" class="btn btn-ghost btn-sm" onclick="void pldOpenVendorContactsModal(${pldVendorsJsArgForOnclick(id)})">Contacts</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="void pldOpenVendorEditorModal(${pldVendorsJsArgForOnclick(id)})">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="pldConfirmDeleteVendor(${pldVendorsJsArgForOnclick(id)})">Delete</button>`
                  : '<span class="form-hint" style="font-size:12px;">API off</span>'
              }
            </td>
          </tr>`;
          })
          .join('');

  return `
    <div class="page-header pld-directory-page-header">
      <div>
        <h1 class="page-title">Vendors</h1>
        <p class="page-subtitle">Suppliers and linked clients</p>
      </div>
      ${rest ? `<button type="button" class="btn btn-primary" onclick="void pldOpenVendorEditorModal('')">+ Add vendor</button>` : ''}
    </div>
    ${errBanner}
    <div class="pld-directory-toolbar">
      <div class="pld-directory-toolbar-inner">
        <label class="form-label" for="pldVendorsSearch">Search</label>
        <input type="search" id="pldVendorsSearch" class="form-input" style="max-width:320px;min-width:180px;flex:1;" placeholder="Name, email…" value="${searchVal}"
          oninput="onVendorsSearchInput(this.value)">
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
        <thead><tr><th>Vendor</th><th>Linked client</th><th class="pld-directory-actions">Actions</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}
