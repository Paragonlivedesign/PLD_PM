/* ============================================
   Contacts hub — CRM persons (API-backed)
   Depends on: pld-api.js, pld-crm-api.js, router.js, navigation.js
   ============================================ */

/** @type {Array<Record<string, unknown>>} */
window.__pldContactsHubRows = window.__pldContactsHubRows || [];
window.__pldContactsHubSearch = window.__pldContactsHubSearch || '';
/** @type {Record<string, unknown> | null} */
window.__pldContactsHubMeta = window.__pldContactsHubMeta || null;
window.__pldContactsHubLoading = false;
window.__pldContactsHubError = '';
/** Set true after the first hub list request finishes (success or failure). */
window.__pldContactsHubFetched = false;
window.__pldContactsHubOrgFilter = window.__pldContactsHubOrgFilter || 'all';
window.__pldContactsHubFlagFilter = window.__pldContactsHubFlagFilter || 'all';

function pldContactsEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function pldContactsPrimaryEmail(row) {
  const emails = row && row.emails;
  if (!Array.isArray(emails) || emails.length === 0) return '—';
  const prim = emails.find(function (e) {
    return e && e.is_primary;
  });
  const e = prim || emails[0];
  return e && e.address ? String(e.address) : '—';
}

function pldContactsPrimaryPhone(row) {
  const phones = row && row.phones;
  if (!Array.isArray(phones) || phones.length === 0) return '—';
  const prim = phones.find(function (p) {
    return p && p.is_primary;
  });
  const p = prim || phones[0];
  if (!p) return '—';
  const raw = p.e164 && String(p.e164).trim() ? String(p.e164) : p.address ? String(p.address) : '—';
  return raw || '—';
}

function pldContactsParentTypeToKind(pt) {
  if (pt === 'client_organization') return 'client';
  if (pt === 'vendor_organization') return 'vendor';
  return 'venue';
}

/** One line per membership: type + optional title + primary flag. */
function pldContactsMembershipOneLine(m) {
  if (!m) return '—';
  const pt = m.parent_type;
  const typeLabel =
    pt === 'client_organization' ? 'Client' : pt === 'venue' ? 'Venue' : 'Vendor';
  let s = typeLabel;
  if (m.title && String(m.title).trim()) s += ' · ' + String(m.title).trim();
  if (m.is_primary) s += ' · Primary';
  return s;
}

function pldContactsChipClassForParentType(pt) {
  if (pt === 'client_organization') return 'pld-contacts-chip pld-contacts-chip--client';
  if (pt === 'venue') return 'pld-contacts-chip pld-contacts-chip--venue';
  return 'pld-contacts-chip pld-contacts-chip--vendor';
}

/**
 * Organizations column: multiple memberships → chip buttons; single → span (row opens profile).
 */
function pldContactsMembershipColumnHtml(row) {
  const m = row && row.memberships;
  if (!Array.isArray(m) || m.length === 0) {
    return '<span class="pld-contacts-muted">—</span>';
  }
  const multi = m.length > 1;
  return m
    .map(function (x) {
      const cls = pldContactsChipClassForParentType(x.parent_type);
      const line = pldContactsMembershipOneLine(x);
      if (multi) {
        const kind = pldContactsParentTypeToKind(String(x.parent_type));
        const pid = String(x.parent_id);
        const mid = String(x.membership_id);
        return (
          '<button type="button" class="' +
          cls +
          ' pld-contacts-org-btn" data-kind="' +
          pldContactsEsc(kind) +
          '" data-parent="' +
          pldContactsEsc(pid) +
          '" data-mid="' +
          pldContactsEsc(mid) +
          '" title="Open this contact under this organization">' +
          pldContactsEsc(line) +
          '</button>'
        );
      }
      return '<span class="' + cls + '">' + pldContactsEsc(line) + '</span>';
    })
    .join('');
}

/**
 * Row click on a person with several orgs — same choices as chip buttons.
 * Depends on: openPickerModal (pld-picker.js), navigateToContact (crm-profile-pages.js).
 */
window.pldContactsOpenMembershipPicker = function pldContactsOpenMembershipPicker(rowIndex) {
  const rows = window.__pldContactsHubRows;
  const row = rows && rows[rowIndex];
  if (!row || !Array.isArray(row.memberships) || row.memberships.length < 2) return;
  const displayName = row.display_name != null ? String(row.display_name) : 'Contact';
  const items = row.memberships.map(function (m) {
    const pt = m.parent_type;
    const typeLabel =
      pt === 'client_organization' ? 'Client' : pt === 'venue' ? 'Venue' : 'Vendor';
    var sec = '';
    if (m.title && String(m.title).trim()) sec = String(m.title).trim();
    if (m.is_primary) sec = sec ? sec + ' · Primary' : 'Primary contact';
    const kind = pldContactsParentTypeToKind(String(pt));
    return {
      id: String(m.membership_id),
      primary: typeLabel,
      secondary: sec || '',
      meta: {
        kind: kind,
        parentId: String(m.parent_id),
        mid: String(m.membership_id),
      },
    };
  });
  if (typeof openPickerModal !== 'function') {
    const m0 = row.memberships[0];
    if (typeof navigateToContact === 'function') {
      navigateToContact(
        pldContactsParentTypeToKind(String(m0.parent_type)),
        String(m0.parent_id),
        String(m0.membership_id),
      );
    }
    return;
  }
  openPickerModal({
    title: 'Open contact — ' + displayName,
    items: items,
    searchPlaceholder: 'Filter organizations…',
    onSelect: function (_id, item) {
      const meta = item && item.meta;
      if (!meta || typeof navigateToContact !== 'function') return;
      navigateToContact(meta.kind, meta.parentId, meta.mid);
    },
  });
};

/** Delegated: org chip buttons; multi row → picker; single row → navigate */
function pldContactsInitRowClicksOnce() {
  if (window.__pldContactsHubClicksInit) return;
  window.__pldContactsHubClicksInit = true;
  document.addEventListener('click', function (e) {
    const actionBtn = e.target && e.target.closest ? e.target.closest('.pld-contacts-action-btn') : null;
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const ri = actionBtn.getAttribute('data-row-index');
      const mode = actionBtn.getAttribute('data-mode') || 'open';
      if (ri != null && ri !== '') {
        window.pldContactsOpenFromRowIndex(parseInt(ri, 10), mode === 'edit');
      }
      return;
    }
    const orgBtn = e.target && e.target.closest ? e.target.closest('.pld-contacts-org-btn') : null;
    if (orgBtn) {
      e.preventDefault();
      e.stopPropagation();
      const kind = orgBtn.getAttribute('data-kind');
      const parent = orgBtn.getAttribute('data-parent');
      const mid = orgBtn.getAttribute('data-mid');
      if (kind && parent && mid && typeof navigateToContact === 'function') {
        navigateToContact(kind, parent, mid);
      }
      return;
    }
    const trMulti = e.target && e.target.closest ? e.target.closest('tr.pld-contacts-row--multi') : null;
    if (trMulti) {
      const ri = trMulti.getAttribute('data-row-index');
      if (ri != null && ri !== '') {
        e.preventDefault();
        window.pldContactsOpenMembershipPicker(parseInt(ri, 10));
      }
      return;
    }
    const tr = e.target && e.target.closest ? e.target.closest('tr.pld-contacts-row[data-mid]') : null;
    if (!tr) return;
    const kind = tr.getAttribute('data-kind');
    const parent = tr.getAttribute('data-parent');
    const mid = tr.getAttribute('data-mid');
    if (!kind || !parent || !mid || typeof navigateToContact !== 'function') return;
    navigateToContact(kind, parent, mid);
  });
}

window.pldRefreshContactsHub = async function pldRefreshContactsHub() {
  if (typeof window.pldListContactPersonsFromApi !== 'function') return;
  window.__pldContactsHubLoading = true;
  window.__pldContactsHubError = '';
  if (typeof renderPage === 'function') renderPage('contacts', { skipModuleDataFetch: true });
  const q = typeof window.__pldContactsHubSearch === 'string' ? window.__pldContactsHubSearch.trim() : '';
  try {
    const result = await window.pldListContactPersonsFromApi({ search: q, limit: 100 });
    window.__pldContactsHubRows = Array.isArray(result) ? result : [];
    const fe =
      typeof window.__pldContactsHubFetchError === 'string' ? window.__pldContactsHubFetchError.trim() : '';
    if (fe) window.__pldContactsHubError = fe;
  } catch (err) {
    window.__pldContactsHubError = err && err.message ? String(err.message) : 'Failed to load';
    window.__pldContactsHubRows = [];
  } finally {
    window.__pldContactsHubLoading = false;
    window.__pldContactsHubFetched = true;
  }
  if (typeof renderPage === 'function') renderPage('contacts', { skipModuleDataFetch: true });
};

function onContactsSearchInput(value) {
  window.__pldContactsHubSearch = value;
  if (window.__pldContactsSearchTimer) clearTimeout(window.__pldContactsSearchTimer);
  window.__pldContactsSearchTimer = setTimeout(function () {
    window.__pldContactsSearchTimer = null;
    void window.pldRefreshContactsHub();
  }, 320);
}

function pldContactsCountLabel() {
  const meta = window.__pldContactsHubMeta;
  if (meta && typeof meta.count === 'number') return String(meta.count);
  const rows = Array.isArray(window.__pldContactsHubRows) ? window.__pldContactsHubRows : [];
  return String(rows.length);
}

function pldContactsRowMatchesFilters(row) {
  const orgFilter = String(window.__pldContactsHubOrgFilter || 'all');
  const flagFilter = String(window.__pldContactsHubFlagFilter || 'all');
  const memberships = Array.isArray(row && row.memberships) ? row.memberships : [];
  if (orgFilter !== 'all') {
    const wantedPt =
      orgFilter === 'client'
        ? 'client_organization'
        : orgFilter === 'venue'
          ? 'venue'
          : 'vendor_organization';
    const hasOrg = memberships.some(function (m) {
      return String(m.parent_type) === wantedPt;
    });
    if (!hasOrg) return false;
  }
  if (flagFilter === 'has_login') {
    if (!(row && row.user_id != null && String(row.user_id).trim())) return false;
  } else if (flagFilter === 'has_crew') {
    if (!(row && row.personnel_id != null && String(row.personnel_id).trim())) return false;
  } else if (flagFilter === 'multi_org') {
    if (memberships.length < 2) return false;
  }
  return true;
}

function onContactsOrgFilterChange(value) {
  window.__pldContactsHubOrgFilter = value || 'all';
  if (typeof renderPage === 'function') renderPage('contacts', { skipModuleDataFetch: true });
}

function onContactsFlagFilterChange(value) {
  window.__pldContactsHubFlagFilter = value || 'all';
  if (typeof renderPage === 'function') renderPage('contacts', { skipModuleDataFetch: true });
}

function pldContactsResetFilters() {
  window.__pldContactsHubOrgFilter = 'all';
  window.__pldContactsHubFlagFilter = 'all';
  if (typeof renderPage === 'function') renderPage('contacts', { skipModuleDataFetch: true });
}

function pldContactsListParents(kind) {
  if (kind === 'client') return Array.isArray(window.CLIENTS) ? window.CLIENTS : [];
  if (kind === 'venue') return Array.isArray(window.VENUES) ? window.VENUES : [];
  return Array.isArray(window.VENDORS) ? window.VENDORS : [];
}

function pldContactsParentOptionsHtml(kind) {
  const rows = pldContactsListParents(kind);
  const opts = rows
    .map(function (r) {
      const id = r && r.id != null ? String(r.id) : '';
      const name = r && r.name != null ? String(r.name) : id;
      return '<option value="' + pldContactsEsc(id) + '">' + pldContactsEsc(name || id) + '</option>';
    })
    .join('');
  return '<option value="">Select…</option>' + opts;
}

window.pldContactsOnAddKindChange = function pldContactsOnAddKindChange(value) {
  const kind = String(value || 'client');
  const sel = document.getElementById('pldContactsAddParent');
  if (!sel) return;
  sel.innerHTML = pldContactsParentOptionsHtml(kind);
};

window.pldContactsOpenAddModal = function pldContactsOpenAddModal() {
  if (typeof openModal !== 'function') {
    if (typeof showToast === 'function') showToast('Modal not available', 'error');
    return;
  }
  openModal(
    'Add contact',
    '<div class="pld-contacts-add-form">' +
      '<div class="form-group"><label class="form-label">Organization type</label>' +
      '<select id="pldContactsAddKind" class="form-select" onchange="pldContactsOnAddKindChange(this.value)">' +
      '<option value="client">Client</option>' +
      '<option value="venue">Venue</option>' +
      '<option value="vendor">Vendor</option>' +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">Organization</label>' +
      '<select id="pldContactsAddParent" class="form-select">' +
      pldContactsParentOptionsHtml('client') +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">Name</label>' +
      '<input id="pldContactsAddName" class="form-input" placeholder="Full name"></div>' +
      '<div class="form-group"><label class="form-label">Email</label>' +
      '<input id="pldContactsAddEmail" class="form-input" placeholder="name@company.com"></div>' +
      '<div class="form-group"><label class="form-label">Phone</label>' +
      '<input id="pldContactsAddPhone" class="form-input" placeholder="+1 ..."></div>' +
      '<div class="form-group"><label class="form-label">Title</label>' +
      '<input id="pldContactsAddTitle" class="form-input" placeholder="Coordinator, PM, ..."></div>' +
      '</div>',
    '<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="void pldContactsSubmitAddContact()">Add contact</button>',
  );
};

window.pldContactsSubmitAddContact = async function pldContactsSubmitAddContact() {
  const kind = String(document.getElementById('pldContactsAddKind')?.value || 'client');
  const parentId = String(document.getElementById('pldContactsAddParent')?.value || '').trim();
  const name = String(document.getElementById('pldContactsAddName')?.value || '').trim();
  const email = String(document.getElementById('pldContactsAddEmail')?.value || '').trim();
  const phone = String(document.getElementById('pldContactsAddPhone')?.value || '').trim();
  const title = String(document.getElementById('pldContactsAddTitle')?.value || '').trim();
  if (!parentId) {
    if (typeof showToast === 'function') showToast('Select an organization', 'warning');
    return;
  }
  if (!name) {
    if (typeof showToast === 'function') showToast('Name is required', 'error');
    return;
  }
  if (typeof window.pldCreateContact !== 'function') {
    if (typeof showToast === 'function') showToast('Contact API not available', 'error');
    return;
  }
  const created = await window.pldCreateContact(kind, parentId, {
    name: name,
    email: email || null,
    phone: phone || null,
    title: title || null,
  });
  if (!created || !created.id) return;
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast('Contact added', 'success');
  await window.pldRefreshContactsHub();
  if (typeof navigateToContact === 'function') {
    navigateToContact(kind, parentId, String(created.id));
  }
};

window.pldContactsOpenFromRowIndex = function pldContactsOpenFromRowIndex(rowIndex, preferEdit) {
  const rows = Array.isArray(window.__pldContactsHubRows) ? window.__pldContactsHubRows : [];
  const row = rows[rowIndex];
  if (!row || !Array.isArray(row.memberships) || row.memberships.length === 0) return;
  if (row.memberships.length > 1) {
    window.pldContactsOpenMembershipPicker(rowIndex);
    return;
  }
  const m = row.memberships[0];
  if (typeof navigateToContact !== 'function') return;
  navigateToContact(
    pldContactsParentTypeToKind(String(m.parent_type)),
    String(m.parent_id),
    String(m.membership_id),
  );
  if (preferEdit && typeof window.switchContactProfileTab === 'function') {
    window.switchContactProfileTab('overview');
  }
};

function renderContacts() {
  pldContactsInitRowClicksOnce();
  const rows = Array.isArray(window.__pldContactsHubRows) ? window.__pldContactsHubRows : [];
  const q = typeof window.__pldContactsHubSearch === 'string' ? window.__pldContactsHubSearch : '';
  const orgFilter = String(window.__pldContactsHubOrgFilter || 'all');
  const flagFilter = String(window.__pldContactsHubFlagFilter || 'all');
  const useApi =
    typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST && typeof window.pldApiFetch === 'function';
  const fetched = window.__pldContactsHubFetched === true;
  const awaitingFirstFetch = useApi && !fetched;
  const loading = !!window.__pldContactsHubLoading || awaitingFirstFetch;
  const err = typeof window.__pldContactsHubError === 'string' ? window.__pldContactsHubError : '';
  const entries = rows.map(function (row, idx) {
    return { row: row, sourceIndex: idx };
  });
  const filteredEntries = entries.filter(function (entry) {
    return pldContactsRowMatchesFilters(entry.row);
  });

  const bodyRows = filteredEntries
    .map(function (entry) {
      const row = entry.row;
      const sourceIndex = entry.sourceIndex;
      const name = row.display_name != null ? String(row.display_name) : '—';
      const email = pldContactsPrimaryEmail(row);
      const phone = pldContactsPrimaryPhone(row);
      const orgCol = pldContactsMembershipColumnHtml(row);
      const badges = [];
      if (row.user_id != null && String(row.user_id).trim()) {
        badges.push('<span class="pld-contacts-badge pld-contacts-badge--login">Login</span>');
      }
      if (row.personnel_id != null && String(row.personnel_id).trim()) {
        badges.push('<span class="pld-contacts-badge pld-contacts-badge--crew">Crew</span>');
      }
      const badgeHtml = badges.length ? ' ' + badges.join(' ') : '';
      const memberships = Array.isArray(row.memberships) ? row.memberships : [];
      const multi = memberships.length > 1;
      const firstM = memberships[0] || null;
      const kind = firstM ? pldContactsParentTypeToKind(String(firstM.parent_type)) : '';
      const parentId = firstM ? String(firstM.parent_id) : '';
      const mid = firstM ? String(firstM.membership_id) : '';
      const actions =
        memberships.length === 0
          ? '<span class="pld-contacts-muted">—</span>'
          : '<div class="pld-contacts-actions-cell">' +
            '<button type="button" class="btn btn-ghost btn-sm pld-contacts-action-btn" data-row-index="' +
            String(sourceIndex) +
            '" data-mode="open">Open</button>' +
            '<button type="button" class="btn btn-secondary btn-sm pld-contacts-action-btn" data-row-index="' +
            String(sourceIndex) +
            '" data-mode="edit">Edit</button>' +
            '</div>';
      var rowAttrs = ' class="pld-contacts-row pld-contacts-row--disabled"';
      if (firstM && kind && parentId && mid) {
        if (multi) {
          rowAttrs =
            ' class="pld-contacts-row pld-contacts-row--multi" data-row-index="' +
            String(sourceIndex) +
            '" title="Choose organization to open"';
        } else {
          rowAttrs =
            ' class="pld-contacts-row" data-kind="' +
            pldContactsEsc(kind) +
            '" data-parent="' +
            pldContactsEsc(parentId) +
            '" data-mid="' +
            pldContactsEsc(mid) +
            '"';
        }
      }
      const chev = multi ? '⋯' : '›';
      return (
        '<tr' +
        rowAttrs +
        '><td class="pld-contacts-td-name"><span class="pld-contacts-name">' +
        pldContactsEsc(name) +
        '</span>' +
        badgeHtml +
        '</td><td class="pld-contacts-td-sub">' +
        pldContactsEsc(email) +
        '</td><td class="pld-contacts-td-sub">' +
        pldContactsEsc(phone) +
        '</td><td class="pld-contacts-td-chips">' +
        orgCol +
        '</td><td class="pld-contacts-td-actions">' +
        actions +
        '</td><td class="pld-contacts-td-chev" aria-hidden="true"><span class="pld-contacts-chevron' +
        (multi ? ' pld-contacts-chevron--multi' : '') +
        '">' +
        chev +
        '</span></td></tr>'
      );
    })
    .join('');

  const loadingBlock =
    '<div class="pld-contacts-loading" role="status" aria-busy="true">' +
    '<div class="pld-contacts-skeleton">' +
    Array(5)
      .fill(0)
      .map(function () {
        return '<div class="pld-contacts-skeleton-row"><span></span><span></span><span></span></div>';
      })
      .join('') +
    '</div><p class="pld-contacts-loading-text">Loading contacts…</p></div>';

  const emptyBlock =
    '<div class="pld-contacts-empty">' +
    '<div class="pld-contacts-empty-icon" aria-hidden="true">' +
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
    '</div>' +
    '<h3 class="pld-contacts-empty-title">No contacts match</h3>' +
    '<p class="pld-contacts-empty-desc">Adjust filters or search, or add people under <strong>Clients</strong>, <strong>Venues</strong>, or <strong>Vendors</strong> → Contacts.</p>' +
    '</div>';

  const noApiBlock =
    '<div class="pld-contacts-empty">' +
    '<p class="pld-contacts-empty-desc">Connect the <strong>PostgreSQL API</strong> (see meta <code>pld-api-base</code>) to load your directory.</p>' +
    '</div>';

  let tableBlock = '';
  if (loading) {
    tableBlock = loadingBlock;
  } else if (err) {
    tableBlock = '<div class="pld-contacts-error">' + pldContactsEsc(err) + '</div>';
  } else if (!useApi) {
    tableBlock = noApiBlock;
  } else if (filteredEntries.length === 0) {
    tableBlock = emptyBlock;
  } else {
    tableBlock =
      '<div class="table-wrap pld-contacts-table-wrap"><table class="data-table pld-contacts-table">' +
      '<thead><tr>' +
      '<th>Name</th><th>Email</th><th>Phone</th><th>Organizations</th><th>Actions</th><th class="pld-contacts-th-chev"></th>' +
      '</tr></thead><tbody>' +
      bodyRows +
      '</tbody></table></div>';
  }

  const totalCount = rows.length;
  const shownCount = filteredEntries.length;
  const countStr = loading ? '…' : shownCount === totalCount ? String(shownCount) : String(shownCount) + ' / ' + String(totalCount);

  return (
    '<div class="page-header pld-contacts-page">' +
    '<div class="pld-contacts-header-text">' +
    '<h1 class="page-title">Contacts</h1>' +
    '<p class="page-subtitle">Directory of people linked to your clients, venues, and vendors</p></div>' +
    '<div class="page-actions pld-contacts-actions">' +
    '<button type="button" class="btn btn-primary btn-sm pld-contacts-add-btn" onclick="pldContactsOpenAddModal()" title="Add a new contact to a client, venue, or vendor">' +
    '<span>+ Add Contact</span></button>' +
    '<button type="button" class="btn btn-secondary btn-sm pld-contacts-export-btn" onclick="pldContactsExportCsv()" title="Export CSV (one row per membership)">' +
    '<svg class="pld-contacts-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
    '<span>Export CSV</span></button></div></div>' +
    '<div class="card pld-contacts-card">' +
    '<div class="card-body">' +
    '<div class="pld-contacts-toolbar">' +
    '<div class="pld-contacts-search-wrap">' +
    '<svg class="pld-contacts-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
    '<input type="search" id="pldContactsSearchInput" class="form-input pld-contacts-search" placeholder="Search by name or email…" value="' +
    pldContactsEsc(q) +
    '" oninput="onContactsSearchInput(this.value)" autocomplete="off">' +
    '</div>' +
    '<select id="pldContactsOrgFilter" class="form-select pld-contacts-filter-select" onchange="onContactsOrgFilterChange(this.value)">' +
    '<option value="all"' + (orgFilter === 'all' ? ' selected' : '') + '>All orgs</option>' +
    '<option value="client"' + (orgFilter === 'client' ? ' selected' : '') + '>Clients</option>' +
    '<option value="venue"' + (orgFilter === 'venue' ? ' selected' : '') + '>Venues</option>' +
    '<option value="vendor"' + (orgFilter === 'vendor' ? ' selected' : '') + '>Vendors</option>' +
    '</select>' +
    '<select id="pldContactsFlagFilter" class="form-select pld-contacts-filter-select" onchange="onContactsFlagFilterChange(this.value)">' +
    '<option value="all"' + (flagFilter === 'all' ? ' selected' : '') + '>All people</option>' +
    '<option value="has_login"' + (flagFilter === 'has_login' ? ' selected' : '') + '>Has login</option>' +
    '<option value="has_crew"' + (flagFilter === 'has_crew' ? ' selected' : '') + '>Linked crew</option>' +
    '<option value="multi_org"' + (flagFilter === 'multi_org' ? ' selected' : '') + '>Multi-org</option>' +
    '</select>' +
    '<button type="button" class="btn btn-ghost btn-sm pld-contacts-reset-filters" onclick="pldContactsResetFilters()">Reset</button>' +
    '<span class="pld-contacts-meta">' +
    (loading ? 'Loading…' : '<strong>' + pldContactsEsc(countStr) + '</strong> people') +
    '</span></div>' +
    tableBlock +
    '</div></div>'
  );
}

window.onContactsSearchInput = onContactsSearchInput;
window.onContactsOrgFilterChange = onContactsOrgFilterChange;
window.onContactsFlagFilterChange = onContactsFlagFilterChange;
window.pldContactsResetFilters = pldContactsResetFilters;

window.pldContactsExportCsv = async function pldContactsExportCsv() {
  if (typeof window.pldApiFetch !== 'function') return;
  const base = typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.replace(/\/$/, '') : '';
  const token =
    typeof window.pldAuthGetAccessToken === 'function' ? window.pldAuthGetAccessToken() : '';
  const q = typeof window.__pldContactsHubSearch === 'string' ? window.__pldContactsHubSearch.trim() : '';
  const url =
    (base ? base : '') +
    '/api/v1/contact-persons/export' +
    (q ? '?search=' + encodeURIComponent(q) : '');
  try {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', 'Bearer ' + token);
      const tid =
        typeof window.pldAuthGetTenantIdFromToken === 'function'
          ? window.pldAuthGetTenantIdFromToken()
          : '';
      if (tid) headers.set('X-Tenant-Id', tid);
    } else {
      headers.set('X-Tenant-Id', typeof window.PLD_TENANT_ID === 'string' ? window.PLD_TENANT_ID : '');
      headers.set('X-User-Id', typeof window.PLD_USER_ID === 'string' ? window.PLD_USER_ID : '');
      headers.set('X-Permissions', '*');
    }
    const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast('Export failed', 'error');
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contacts-export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof showToast === 'function') showToast('Downloaded contacts-export.csv', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Export failed', 'error');
  }
};
