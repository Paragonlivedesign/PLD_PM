/* ============================================
   Clients — catalog page (list, search, add/edit/delete)
   Depends on: data.js, modal.js, router.js, pld-events-sync.js (optional API)
   ============================================ */

/** @type {string} */
window.__pldClientsListSearch = window.__pldClientsListSearch || '';
/** @type {ReturnType<typeof setTimeout> | null} */
window.__pldClientsSearchTimer = window.__pldClientsSearchTimer || null;

function pldClientsHtmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function pldClientsAttrEsc(s) {
  return pldClientsHtmlEsc(s);
}

/** Safe for HTML `data-*` attributes (ids, UUIDs). */
function pldClientsDataAttrEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/** JSON string literal safe inside a double-quoted HTML onclick. */
function pldClientsJsArgForOnclick(s) {
  return JSON.stringify(String(s)).replace(/"/g, '&quot;');
}

function pldClientsUseRestApi() {
  return typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
}

function pldClientsContactDisplay(c) {
  const r = /** @type {Record<string, unknown>} */ (c);
  if (r.contact_name != null && String(r.contact_name).trim()) return String(r.contact_name);
  if (r.contact != null && String(r.contact).trim()) return String(r.contact);
  return '—';
}

function pldClientsEmailDisplay(c) {
  const r = /** @type {Record<string, unknown>} */ (c);
  if (r.contact_email != null && String(r.contact_email).trim()) return String(r.contact_email);
  if (r.email != null && String(r.email).trim()) return String(r.email);
  return '—';
}

function pldClientsPhoneDisplay(c) {
  const r = /** @type {Record<string, unknown>} */ (c);
  if (r.phone != null && String(r.phone).trim()) return String(r.phone);
  return '—';
}

function pldClientsNotesDisplay(c) {
  const r = /** @type {Record<string, unknown>} */ (c);
  if (r.notes != null && String(r.notes).trim()) return String(r.notes);
  return '';
}

function pldClientsEventCount(clientId) {
  if (typeof EVENTS === 'undefined' || !Array.isArray(EVENTS)) return 0;
  return EVENTS.filter(function (e) {
    return e.client === clientId;
  }).length;
}

function pldClientsRowsForDisplay() {
  const q = (window.__pldClientsListSearch || '').trim().toLowerCase();
  if (!q || pldClientsUseRestApi()) return CLIENTS.slice();
  return CLIENTS.filter(function (c) {
    const r = /** @type {Record<string, unknown>} */ (c);
    const parts = [
      String(r.name || ''),
      pldClientsContactDisplay(c),
      pldClientsEmailDisplay(c),
      pldClientsPhoneDisplay(c),
    ]
      .join(' ')
      .toLowerCase();
    return parts.indexOf(q) >= 0;
  });
}

function onClientsSearchInput(value) {
  window.__pldClientsListSearch = value;
  if (window.__pldClientsSearchTimer) clearTimeout(window.__pldClientsSearchTimer);
  window.__pldClientsSearchTimer = setTimeout(function () {
    window.__pldClientsSearchTimer = null;
    if (pldClientsUseRestApi() && typeof window.pldFetchClientsFromApiIfConfigured === 'function') {
      void window.pldFetchClientsFromApiIfConfigured(window.__pldClientsListSearch);
    } else if (typeof renderPage === 'function') {
      renderPage('clients');
    }
  }, 300);
}

function openClientEditorModal(clientId) {
  const id = clientId ? String(clientId) : '';
  const existing = id
    ? CLIENTS.find(function (c) {
        return c.id === id;
      })
    : null;
  const isEdit = !!existing;
  const name0 = existing ? String(existing.name || '') : '';
  const contactName0 = existing
    ? String(
        existing.contact_name != null && existing.contact_name !== ''
          ? existing.contact_name
          : existing.contact != null
            ? existing.contact
            : '',
      )
    : '';
  const email0 = existing
    ? String(
        existing.contact_email != null && existing.contact_email !== ''
          ? existing.contact_email
          : existing.email != null
            ? existing.email
            : '',
      )
    : '';
  const phone0 = existing && existing.phone != null ? String(existing.phone) : '';
  const notes0 = existing && existing.notes != null ? String(existing.notes) : '';

  const body = `
    <input type="hidden" id="pldClientFormId" value="${pldClientsAttrEsc(id)}">
    <div class="form-group"><label class="form-label">Organization name</label>
      <input type="text" class="form-input" id="pldClientFormName" value="${pldClientsAttrEsc(name0)}" placeholder="e.g. Acme Productions"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Contact name</label>
        <input type="text" class="form-input" id="pldClientFormContactName" value="${pldClientsAttrEsc(contactName0)}"></div>
      <div class="form-group"><label class="form-label">Contact email</label>
        <input type="email" class="form-input" id="pldClientFormContactEmail" value="${pldClientsAttrEsc(email0)}"></div>
    </div>
    <div class="form-group"><label class="form-label">Phone</label>
      <input type="text" class="form-input" id="pldClientFormPhone" value="${pldClientsAttrEsc(phone0)}"></div>
    <div class="form-group"><label class="form-label">Notes</label>
      <textarea class="form-textarea" id="pldClientFormNotes" rows="3" placeholder="Internal notes">${pldClientsHtmlEsc(notes0)}</textarea></div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="void pldSubmitClientEditor()">${isEdit ? 'Save' : 'Add client'}</button>
  `;
  openModal(isEdit ? 'Edit client' : 'Add client', body, footer);
}

window.pldSubmitClientEditor = async function pldSubmitClientEditor() {
  const idEl = document.getElementById('pldClientFormId');
  const nameEl = document.getElementById('pldClientFormName');
  const cnEl = document.getElementById('pldClientFormContactName');
  const emEl = document.getElementById('pldClientFormContactEmail');
  const phEl = document.getElementById('pldClientFormPhone');
  const noEl = document.getElementById('pldClientFormNotes');
  const id = idEl && idEl.value ? String(idEl.value).trim() : '';
  const name = nameEl && nameEl.value ? nameEl.value.trim() : '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Organization name is required', 'error');
    return;
  }
  const contact_name = cnEl && cnEl.value ? cnEl.value.trim() : '';
  const contact_email = emEl && emEl.value ? emEl.value.trim() : '';
  const phone = phEl && phEl.value ? phEl.value.trim() : '';
  const notes = noEl && noEl.value ? noEl.value.trim() : '';

  if (pldClientsUseRestApi()) {
    if (id) {
      if (typeof window.pldUpdateClientViaApi !== 'function') {
        if (typeof showToast === 'function') showToast('Client API not available', 'error');
        return;
      }
      const patch = { name, contact_name, contact_email, phone, notes };
      const ui = await window.pldUpdateClientViaApi(id, patch);
      if (!ui) return;
    } else {
      if (typeof window.pldCreateClientViaApi !== 'function') {
        if (typeof showToast === 'function') showToast('Client API not available', 'error');
        return;
      }
      const created = await window.pldCreateClientViaApi({
        name: name,
        contact_name: contact_name || undefined,
        contact_email: contact_email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      if (!created) return;
    }
  } else {
    if (id) {
      const c = CLIENTS.find(function (x) {
        return x.id === id;
      });
      if (!c) return;
      c.name = name;
      c.contact = contact_name;
      c.contact_name = contact_name;
      c.email = contact_email;
      c.contact_email = contact_email;
      c.phone = phone;
      c.notes = notes;
    } else {
      const newId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'cl-' + String(Date.now());
      CLIENTS.push({
        id: newId,
        name: name,
        contact: contact_name,
        email: contact_email,
        contact_name: contact_name,
        contact_email: contact_email,
        phone: phone,
        notes: notes,
      });
    }
  }
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(id ? 'Client updated' : 'Client added', 'success');
  if (typeof renderPage === 'function') renderPage('clients');
};

/** Prefer this over inline onclick strings so UUIDs are never mangled by HTML quoting. */
function pldConfirmDeleteClientFromData(btn) {
  const raw = btn && btn.getAttribute ? btn.getAttribute('data-client-id') : null;
  const id = raw == null ? '' : String(raw).trim();
  pldConfirmDeleteClient(id);
}

function pldConfirmDeleteClient(clientId) {
  const id = String(clientId == null ? '' : clientId).trim();
  if (!id) {
    if (typeof showToast === 'function')
      showToast('Cannot delete client (missing id). Try refreshing the list.', 'error');
    return;
  }
  const c = CLIENTS.find(function (x) {
    return x.id === id;
  });
  const label = c ? String(c.name || id) : id;
  if (pldClientsEventCount(id) > 0) {
    if (typeof showToast === 'function')
      showToast('Remove or reassign events that use this client first', 'warning');
    return;
  }
  if (typeof showConfirm !== 'function') return;
  showConfirm(
    'Delete client',
    'Delete ' + label + '? This cannot be undone.',
    function () {
      void pldRunDeleteClient(id);
    },
  );
}

function pldClientContactsEsc(s) {
  return pldClientsHtmlEsc(String(s ?? ''));
}

/** @param {Record<string, unknown>} row */
function pldContactRowHtml(kind, parentId, row) {
  const id = String(row.id);
  const name = pldClientContactsEsc(row.name);
  const title = pldClientContactsEsc(row.title || '');
  const email = pldClientContactsEsc(row.email || '');
  const phone = pldClientContactsEsc(row.phone || '');
  const prim = row.is_primary ? '<span class="phase-badge planning" style="font-size:10px;">Primary</span>' : '';
  return `<tr>
    <td><strong>${name}</strong> ${prim}</td>
    <td style="color:var(--text-tertiary);font-size:13px;">${title}</td>
    <td style="color:var(--text-tertiary);font-size:13px;">${email}</td>
    <td style="color:var(--text-tertiary);font-size:13px;">${phone}</td>
    <td>
      <button type="button" class="btn btn-ghost btn-sm" onclick="pldOpenContactEditor(${pldClientsJsArgForOnclick(kind)}, ${pldClientsJsArgForOnclick(parentId)}, ${pldClientsJsArgForOnclick(id)})">Edit</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="pldConfirmDeleteContact(${pldClientsJsArgForOnclick(kind)}, ${pldClientsJsArgForOnclick(parentId)}, ${pldClientsJsArgForOnclick(id)})">Remove</button>
    </td>
  </tr>`;
}

window.pldOpenClientContactsModal = async function pldOpenClientContactsModal(clientId) {
  const id = String(clientId);
  const c = CLIENTS.find(function (x) {
    return x.id === id;
  });
  if (!c) return;
  if (!pldClientsUseRestApi() || typeof window.pldListContactsForParent !== 'function') {
    if (typeof showToast === 'function') showToast('Connect to API to manage contacts', 'warning');
    return;
  }
  const rows = await window.pldListContactsForParent('client', id);
  const tbody =
    rows.length === 0
      ? '<tr><td colspan="5" style="padding:16px;color:var(--text-tertiary);">No contacts yet.</td></tr>'
      : rows.map(function (r) {
          return pldContactRowHtml('client', id, r);
        }).join('');
  const body = `
    <p style="font-size:13px;color:var(--text-tertiary);margin:0 0 12px;">CRM contacts for <strong>${pldClientContactsEsc(c.name)}</strong> (separate from the legacy single contact fields on the org row).</p>
    <div class="table-wrap" style="max-height:320px;overflow:auto;">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th></th></tr></thead>
        <tbody id="pldClientContactsTbody">${tbody}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;">
      <button type="button" class="btn btn-primary btn-sm" onclick="pldOpenContactEditor('client', ${pldClientsJsArgForOnclick(id)}, '')">+ Add contact</button>
    </div>
  `;
  const footer = `<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  if (typeof openModal === 'function') openModal('Contacts — ' + c.name, body, footer);
};

window.pldOpenVenueContactsModal = async function pldOpenVenueContactsModal(venueId) {
  const id = String(venueId);
  const v = typeof VENUES !== 'undefined' && VENUES.find ? VENUES.find(function (x) { return x.id === id; }) : null;
  if (!v) return;
  if (!pldClientsUseRestApi() || typeof window.pldListContactsForParent !== 'function') {
    if (typeof showToast === 'function') showToast('Connect to API to manage contacts', 'warning');
    return;
  }
  const rows = await window.pldListContactsForParent('venue', id);
  const tbody =
    rows.length === 0
      ? '<tr><td colspan="5" style="padding:16px;color:var(--text-tertiary);">No contacts yet.</td></tr>'
      : rows.map(function (r) {
          return pldContactRowHtml('venue', id, r);
        }).join('');
  const body = `
    <p style="font-size:13px;color:var(--text-tertiary);margin:0 0 12px;">CRM contacts for <strong>${pldClientContactsEsc(v.name)}</strong>, ${pldClientContactsEsc(v.city || '')}</p>
    <div class="table-wrap" style="max-height:320px;overflow:auto;">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th></th></tr></thead>
        <tbody id="pldVenueContactsTbody">${tbody}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;">
      <button type="button" class="btn btn-primary btn-sm" onclick="pldOpenContactEditor('venue', ${pldClientsJsArgForOnclick(id)}, '')">+ Add contact</button>
    </div>
  `;
  const footer = `<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  if (typeof openModal === 'function') openModal('Venue contacts — ' + v.name, body, footer);
};

window.pldOpenVendorContactsModal = async function pldOpenVendorContactsModal(vendorId) {
  const id = String(vendorId);
  const v =
    typeof VENDORS !== 'undefined' && VENDORS.find
      ? VENDORS.find(function (x) {
          return x.id === id;
        })
      : null;
  if (!v) return;
  if (!pldClientsUseRestApi() || typeof window.pldListContactsForParent !== 'function') {
    if (typeof showToast === 'function') showToast('Connect to API to manage contacts', 'warning');
    return;
  }
  const rows = await window.pldListContactsForParent('vendor', id);
  const tbody =
    rows.length === 0
      ? '<tr><td colspan="5" style="padding:16px;color:var(--text-tertiary);">No contacts yet.</td></tr>'
      : rows.map(function (r) {
          return pldContactRowHtml('vendor', id, r);
        }).join('');
  const body = `
    <p style="font-size:13px;color:var(--text-tertiary);margin:0 0 12px;">CRM contacts for <strong>${pldClientContactsEsc(v.name)}</strong></p>
    <div class="table-wrap" style="max-height:320px;overflow:auto;">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th></th></tr></thead>
        <tbody id="pldVendorContactsTbody">${tbody}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;">
      <button type="button" class="btn btn-primary btn-sm" onclick="pldOpenContactEditor('vendor', ${pldClientsJsArgForOnclick(id)}, '')">+ Add contact</button>
    </div>
  `;
  const footer = `<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  if (typeof openModal === 'function') openModal('Vendor contacts — ' + v.name, body, footer);
};

window.pldOpenContactEditor = function (kind, parentId, contactId) {
  const kid = String(kind);
  const pid = String(parentId);
  const cid = contactId ? String(contactId) : '';
  void (async () => {
    let existing = null;
    if (cid && typeof window.pldListContactsForParent === 'function') {
      const list = await window.pldListContactsForParent(kid, pid);
      existing = list.find(function (x) {
        return String(x.id) === cid;
      });
    }
    const name0 = existing ? String(existing.name || '') : '';
    const email0 = existing ? String(existing.email || '') : '';
    const phone0 = existing ? String(existing.phone || '') : '';
    const title0 = existing ? String(existing.title || '') : '';
    const primary0 = existing && existing.is_primary;
    const pers0 =
      existing && existing.personnel_id != null ? String(existing.personnel_id) : '';
    const body = `
      <input type="hidden" id="pldContactKind" value="${pldClientsAttrEsc(kid)}">
      <input type="hidden" id="pldContactParentId" value="${pldClientsAttrEsc(pid)}">
      <input type="hidden" id="pldContactId" value="${pldClientsAttrEsc(cid)}">
      <div class="form-group"><label class="form-label">Name</label>
        <input type="text" class="form-input" id="pldContactName" value="${pldClientsAttrEsc(name0)}" placeholder="Required"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Email</label>
          <input type="email" class="form-input" id="pldContactEmail" value="${pldClientsAttrEsc(email0)}"></div>
        <div class="form-group"><label class="form-label">Phone</label>
          <input type="text" class="form-input" id="pldContactPhone" value="${pldClientsAttrEsc(phone0)}"></div>
      </div>
      <div class="form-group"><label class="form-label">Title</label>
        <input type="text" class="form-input" id="pldContactTitle" value="${pldClientsAttrEsc(title0)}"></div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;">
        <input type="checkbox" id="pldContactPrimary" ${primary0 ? 'checked' : ''}> Primary contact for this record
      </label>
      <details style="font-size:12px;color:var(--text-tertiary);">
        <summary style="cursor:pointer;">Advanced</summary>
        <div class="form-group" style="margin-top:8px;"><label class="form-label">Link to personnel UUID (optional)</label>
          <input type="text" class="form-input" id="pldContactPersonnelId" value="${pldClientsAttrEsc(pers0)}" placeholder="personnel id"></div>
      </details>
    `;
    const cancelBack =
      kid === 'client'
        ? `closeModal();setTimeout(function(){if(typeof pldOpenClientContactsModal==='function')pldOpenClientContactsModal(${pldClientsJsArgForOnclick(pid)});},50);`
        : kid === 'venue'
          ? `closeModal();setTimeout(function(){if(typeof pldOpenVenueContactsModal==='function')pldOpenVenueContactsModal(${pldClientsJsArgForOnclick(pid)});},50);`
          : kid === 'vendor'
            ? `closeModal();setTimeout(function(){if(typeof pldOpenVendorContactsModal==='function')pldOpenVendorContactsModal(${pldClientsJsArgForOnclick(pid)});},50);`
            : 'closeModal();';
    const footer = `
      <button type="button" class="btn btn-secondary" onclick="${cancelBack}">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="void pldSubmitContactEditor()">${cid ? 'Save' : 'Add'}</button>
    `;
    const title =
      kid === 'client'
        ? 'Contact'
        : kid === 'venue'
          ? 'Venue contact'
          : 'Vendor contact';
    if (typeof openModal === 'function') openModal((cid ? 'Edit ' : 'Add ') + title, body, footer);
  })();
};

window.pldSubmitContactEditor = async function pldSubmitContactEditor() {
  const kEl = document.getElementById('pldContactKind');
  const pEl = document.getElementById('pldContactParentId');
  const idEl = document.getElementById('pldContactId');
  const kind = kEl && kEl.value ? String(kEl.value) : 'client';
  const parentId = pEl && pEl.value ? String(pEl.value) : '';
  const cid = idEl && idEl.value ? String(idEl.value) : '';
  const name = document.getElementById('pldContactName')?.value?.trim() || '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Name is required', 'error');
    return;
  }
  const payload = {
    name: name,
    email: document.getElementById('pldContactEmail')?.value?.trim() || null,
    phone: document.getElementById('pldContactPhone')?.value?.trim() || null,
    title: document.getElementById('pldContactTitle')?.value?.trim() || null,
    is_primary: !!document.getElementById('pldContactPrimary')?.checked,
  };
  const pRaw = document.getElementById('pldContactPersonnelId')?.value?.trim();
  if (pRaw) payload.personnel_id = pRaw;
  else payload.personnel_id = null;
  let ok = null;
  if (cid) {
    ok = await window.pldUpdateContact(kind, parentId, cid, payload);
  } else {
    ok = await window.pldCreateContact(kind, parentId, payload);
  }
  if (!ok) return;
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(cid ? 'Contact updated' : 'Contact added', 'success');
  if (kind === 'client') window.pldOpenClientContactsModal(parentId);
  else if (kind === 'venue' && typeof renderPage === 'function' && currentPage === 'venues') renderPage('venues');
  else if (kind === 'vendor' && typeof renderPage === 'function' && currentPage === 'vendors') renderPage('vendors');
};

window.pldConfirmDeleteContact = function (kind, parentId, contactId) {
  if (typeof showConfirm !== 'function') return;
  showConfirm('Remove contact', 'Remove this contact?', function () {
    void (async () => {
      const ok = await window.pldDeleteContact(kind, parentId, contactId);
      if (!ok) return;
      if (typeof showToast === 'function') showToast('Contact removed', 'success');
      if (kind === 'client') window.pldOpenClientContactsModal(parentId);
      else if (kind === 'venue') {
        if (typeof window.pldOpenVenueContactsModal === 'function') window.pldOpenVenueContactsModal(parentId);
        else if (typeof renderPage === 'function' && currentPage === 'venues') renderPage('venues');
      } else if (kind === 'vendor') {
        if (typeof window.pldOpenVendorContactsModal === 'function') window.pldOpenVendorContactsModal(parentId);
        else if (typeof renderPage === 'function' && currentPage === 'vendors') renderPage('vendors');
      }
    })();
  });
};

window.pldRunDeleteClient = async function pldRunDeleteClient(id) {
  if (pldClientsUseRestApi()) {
    if (typeof window.pldDeleteClientViaApi !== 'function') {
      if (typeof showToast === 'function') showToast('Client API not available', 'error');
      return;
    }
    const ok = await window.pldDeleteClientViaApi(id);
    if (!ok) return;
  } else {
    const idx = CLIENTS.findIndex(function (c) {
      return c.id === id;
    });
    if (idx >= 0) CLIENTS.splice(idx, 1);
  }
  if (typeof showToast === 'function') showToast('Client removed', 'success');
  if (typeof renderPage === 'function') renderPage('clients');
};

function openClientEditorModalFromData(btn) {
  const raw = btn && btn.getAttribute ? btn.getAttribute('data-client-id') : null;
  const id = raw == null ? '' : String(raw).trim();
  openClientEditorModal(id);
}

function pldOpenClientContactsModalFromData(btn) {
  const raw = btn && btn.getAttribute ? btn.getAttribute('data-client-id') : null;
  const id = raw == null ? '' : String(raw).trim();
  void window.pldOpenClientContactsModal(id);
}

function pldContextMenuClientRow(domEvent, rowEl) {
  const raw = rowEl && rowEl.getAttribute ? rowEl.getAttribute('data-client-id') : null;
  const id = raw == null ? '' : String(raw).trim();
  if (!id || typeof window.pldShowContextMenu !== 'function') return;
  const items = [];
  items.push({
    label: 'Open profile',
    action: function () {
      if (typeof window.navigateToClient === 'function') window.navigateToClient(id);
    },
  });
  if (pldClientsUseRestApi()) {
    items.push({
      label: 'Contacts…',
      action: function () {
        void window.pldOpenClientContactsModal(id);
      },
    });
  }
  items.push({ label: 'Edit', action: function () { openClientEditorModal(id); } });
  items.push({
    label: 'Delete',
    danger: true,
    action: function () {
      pldConfirmDeleteClient(id);
    },
  });
  window.pldShowContextMenu(domEvent.clientX, domEvent.clientY, items);
}

function renderClients() {
  const apiErr =
    typeof window.__pldClientsApiLoadError !== 'undefined' && window.__pldClientsApiLoadError
      ? String(window.__pldClientsApiLoadError)
      : '';
  const errBanner = apiErr
    ? `<div class="pld-directory-error-banner">${pldClientsHtmlEsc(apiErr)}</div>`
    : '';
  const rows = pldClientsRowsForDisplay();
  const searchVal = pldClientsHtmlEsc(window.__pldClientsListSearch || '');

  const tableBody =
    rows.length === 0
      ? `<tr><td colspan="6" class="pld-empty-state" style="border:none;">No clients match. Add one or adjust search.</td></tr>`
      : rows
          .map(function (c) {
            const r = /** @type {Record<string, unknown>} */ (c);
            const cid = String(r.id == null ? '' : r.id).trim();
            const ec = cid ? pldClientsEventCount(cid) : 0;
            const dataAttr = cid ? ` data-client-id="${pldClientsDataAttrEsc(cid)}"` : '';
            return `<tr${dataAttr} style="cursor:pointer;" onclick="pldNavigateClientListRow(event, this)" oncontextmenu="event.preventDefault();event.stopPropagation();pldContextMenuClientRow(event, this);">
          <td><strong>${pldClientsHtmlEsc(String(r.name || ''))}</strong></td>
          <td style="color:var(--text-tertiary);">${pldClientsHtmlEsc(pldClientsContactDisplay(c))}</td>
          <td style="color:var(--text-tertiary);">${pldClientsHtmlEsc(pldClientsEmailDisplay(c))}</td>
          <td style="color:var(--text-tertiary);">${pldClientsHtmlEsc(pldClientsPhoneDisplay(c))}</td>
          <td style="text-align:center;">${ec}</td>
          <td class="pld-directory-actions">
            ${
              pldClientsUseRestApi() && cid
                ? `<button type="button" class="btn btn-ghost btn-sm" data-client-id="${pldClientsDataAttrEsc(cid)}" onclick="void pldOpenClientContactsModalFromData(this)">Contacts</button>`
                : ''
            }
            <button type="button" class="btn btn-ghost btn-sm" data-client-id="${cid ? pldClientsDataAttrEsc(cid) : ''}" onclick="openClientEditorModalFromData(this)" ${cid ? '' : 'disabled'}>Edit</button>
            ${
              cid
                ? `<button type="button" class="btn btn-ghost btn-sm" data-client-id="${pldClientsDataAttrEsc(cid)}" onclick="pldConfirmDeleteClientFromData(this)">Delete</button>`
                : '<span class="form-hint" style="font-size:12px;">No id</span>'
            }
          </td>
        </tr>`;
          })
          .join('');

  return `
    <div class="page-header pld-directory-page-header">
      <div>
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">Organizations you produce events for — contacts, billing, and notes</p>
      </div>
      <button type="button" class="btn btn-primary" onclick="openClientEditorModal('')">+ Add client</button>
    </div>
    ${errBanner}
    <div class="pld-directory-toolbar">
      <div class="pld-directory-toolbar-inner">
        <label class="form-label" for="pldClientsSearch">Search</label>
        <input type="search" id="pldClientsSearch" class="form-input" style="max-width:320px;flex:1;min-width:180px;" placeholder="Name, contact, email…" value="${searchVal}"
          oninput="onClientsSearchInput(this.value)">
        <span class="pld-directory-meta">${rows.length} shown</span>
      </div>
      ${
        pldClientsUseRestApi()
          ? '<p class="pld-directory-api-hint">Search uses the API when connected.</p>'
          : '<p class="pld-directory-api-hint">Local mode: filters the list in your browser.</p>'
      }
    </div>
    <div class="table-wrap pld-data-table-wrap pld-directory-table-wrap">
      <table class="data-table pld-directory-table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Phone</th>
            <th style="text-align:center;">Events</th>
            <th class="pld-directory-actions">Actions</th>
          </tr>
        </thead>
        <tbody>${tableBody}</tbody>
      </table>
    </div>
  `;
}
