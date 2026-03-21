/* ============================================
   CRM profile pages — clients, vendors, venues, contacts, personnel
   Depends on: pld-crm-profile-shell.js, state.js, navigation.js, router.js, pld-api.js, pld-events-sync.js, pld-crm-api.js
   ============================================ */

(function (global) {
  const esc = global.pldCrmEsc;
  const attrEsc = global.pldCrmAttrEsc;
  const safeObj = global.pldCrmSafeObj;
  const orgProfileFromMeta = global.pldCrmOrgProfileFromMeta;
  const mergeOrgProfileMeta = global.pldCrmMergeOrgProfileMeta;
  const mergeContactMetaDeep = global.pldCrmMergeContactMetaDeep;
  const orgTabBarHtml = global.pldCrmOrgTabBarHtml;
  const pldVenueOsmStaticImageUrl = global.pldCrmVenueOsmStaticImageUrl;
  const pldVenueOsmEmbedUrl = global.pldCrmVenueOsmEmbedUrl;
  const pldClientParseCoordsFromMapsUrl = global.pldCrmParseCoordsFromMapsUrl;
  const pldVenueFetchBannerBlob = global.pldCrmVenueFetchBannerBlob;
  const pldApplyOsmBannerToCoverEl = global.pldCrmApplyOsmBannerToCoverEl;

  function useRestCatalog() {
    return typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  }

  global.navigateToClient = function (id) {
    selectedClientId = id;
    clientProfileTab = 'overview';
    navigateTo('client');
  };

  global.navigateToVendor = function (id) {
    selectedVendorId = id;
    vendorProfileTab = 'overview';
    navigateTo('vendor');
  };

  global.navigateToVenue = function (id) {
    selectedVenueId = id;
    venueProfileTab = 'overview';
    venueProfileViewMode = 'view';
    navigateTo('venue');
  };

  global.switchVenueProfileViewMode = function (mode) {
    venueProfileViewMode = mode === 'edit' ? 'edit' : 'view';
    if (typeof renderPage === 'function') renderPage('venue', { skipModuleDataFetch: true });
  };

  global.navigateToContact = function (kind, parentId, contactId) {
    window.__pldContactDetailCache = null;
    selectedContactParentKind = String(kind || '');
    selectedContactParentId = String(parentId || '');
    selectedContactId = String(contactId || '');
    contactProfileTab = 'overview';
    navigateTo('contact');
  };

  global.navigateToPersonnelProfile = function (id) {
    window.__pldPersonnelProfileCache = null;
    window.__pldPersonnelAssignmentsCache = null;
    selectedPersonnelId = id;
    personnelProfileTab = 'basic';
    navigateTo('personnel-profile');
  };

  global.switchClientProfileTab = function (tab) {
    clientProfileTab = tab;
    if (typeof renderPage === 'function') renderPage('client', { skipModuleDataFetch: true });
  };
  global.switchVendorProfileTab = function (tab) {
    vendorProfileTab = tab;
    if (typeof renderPage === 'function') renderPage('vendor', { skipModuleDataFetch: true });
  };
  global.switchVenueProfileTab = function (tab) {
    venueProfileTab = tab;
    if (typeof renderPage === 'function') renderPage('venue', { skipModuleDataFetch: true });
  };
  global.switchContactProfileTab = function (tab) {
    contactProfileTab = tab;
    if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
  };
  global.switchPersonnelProfileTab = function (tab) {
    personnelProfileTab = tab;
    if (tab === 'events' && typeof global.pldFetchPersonnelProfileAssignments === 'function') {
      void global.pldFetchPersonnelProfileAssignments();
      return;
    }
    if (typeof renderPage === 'function') renderPage('personnel-profile', { skipModuleDataFetch: true });
  };

  global.pldCrmContactBreadcrumbHtml = function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    let parentLabel = 'Parent';
    let listPage = 'clients';
    let navFn = 'navigateToClient';
    if (kind === 'client' && typeof CLIENTS !== 'undefined') {
      const c = CLIENTS.find((x) => String(x.id) === String(pid));
      parentLabel = c ? c.name : 'Client';
      listPage = 'clients';
      navFn = 'navigateToClient';
    } else if (kind === 'vendor') {
      const v = VENDORS.find((x) => String(x.id) === String(pid));
      parentLabel = v ? v.name : 'Vendor';
      listPage = 'vendors';
      navFn = 'navigateToVendor';
    } else if (kind === 'venue') {
      const v = VENUES.find((x) => String(x.id) === String(pid));
      parentLabel = v ? v.name : 'Venue';
      listPage = 'venues';
      navFn = 'navigateToVenue';
    }
    const contactName = (window.__pldContactDetailCache && window.__pldContactDetailCache.name) || 'Contact';
    return `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('${listPage}')">${esc(listPage.charAt(0).toUpperCase() + listPage.slice(1))}</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item breadcrumb-link" onclick="${navFn}('${attrEsc(pid)}')">${esc(parentLabel)}</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${esc(contactName)}</span>
    `;
  };

  async function apiGet(path) {
    if (typeof global.pldApiFetch !== 'function') return null;
    const r = await global.pldApiFetch(path, { method: 'GET' });
    if (!r.ok || !r.body || !r.body.data) return null;
    return r.body.data;
  }

  global.pldFetchContactOne = async function (kind, parentId, contactId) {
    const pid = encodeURIComponent(parentId);
    const cid = encodeURIComponent(contactId);
    if (kind === 'client') return apiGet(`/api/v1/clients/${pid}/contacts/${cid}`);
    if (kind === 'vendor') return apiGet(`/api/v1/vendors/${pid}/contacts/${cid}`);
    if (kind === 'venue') return apiGet(`/api/v1/venues/${pid}/contacts/${cid}`);
    return null;
  };

  global.pldListDocumentsForEntity = async function (entityType, entityId) {
    if (typeof global.pldApiFetch !== 'function') return [];
    const q = new URLSearchParams({ limit: '50', sort_by: 'created_at', sort_order: 'desc' });
    q.set('entity_type', entityType);
    q.set('entity_id', entityId);
    const r = await global.pldApiFetch('/api/v1/documents?' + q.toString(), { method: 'GET' });
    if (!r.ok || !Array.isArray(r.body.data)) return [];
    return r.body.data;
  };

  global.pldGetDocumentMetaForDisplay = async function (documentId) {
    if (typeof global.pldApiFetch !== 'function') return null;
    const r = await global.pldApiFetch('/api/v1/documents/' + encodeURIComponent(documentId), { method: 'GET' });
    if (!r.ok || !r.body || !r.body.data) return null;
    const meta = r.body.meta && typeof r.body.meta === 'object' ? r.body.meta : {};
    return { data: r.body.data, download_url: meta.download_url || null };
  };

  global.navigateToContactParent = function () {
    const k = selectedContactParentKind;
    const pid = selectedContactParentId;
    if (k === 'client') global.navigateToClient(pid);
    else if (k === 'vendor') global.navigateToVendor(pid);
    else if (k === 'venue') global.navigateToVenue(pid);
  };

  /** List row → org profile (ignore clicks on buttons / selects). */
  global.pldNavigateClientListRow = function (ev, tr) {
    if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
    const id = tr && tr.getAttribute ? tr.getAttribute('data-client-id') : '';
    if (id && typeof global.navigateToClient === 'function') global.navigateToClient(id);
  };
  global.pldNavigateVenueListRow = function (ev, tr) {
    if (ev && ev.target && ev.target.closest && (ev.target.closest('button') || ev.target.closest('select'))) return;
    const id = tr && tr.getAttribute ? tr.getAttribute('data-venue-id') : '';
    if (id && typeof global.navigateToVenue === 'function') global.navigateToVenue(id);
  };
  global.pldNavigateVendorListRow = function (ev, tr) {
    if (ev && ev.target && ev.target.closest && (ev.target.closest('button') || ev.target.closest('select'))) return;
    const id = tr && tr.getAttribute ? tr.getAttribute('data-vendor-id') : '';
    if (id && typeof global.navigateToVendor === 'function') global.navigateToVendor(id);
  };

  global.pldCrmProfileAfterRender = function (page) {
    if (page === 'venue' && typeof global.pldHydrateVenueHeroAssets === 'function') {
      void global.pldHydrateVenueHeroAssets(String(selectedVenueId || ''));
    }
    if (page === 'client' && clientProfileTab === 'contacts' && typeof global.pldHydrateOrgContactsPanel === 'function') {
      void global.pldHydrateOrgContactsPanel('client', String(selectedClientId || ''));
    } else if (page === 'vendor' && vendorProfileTab === 'contacts') {
      void global.pldHydrateOrgContactsPanel('vendor', String(selectedVendorId || ''));
    } else if (page === 'venue' && venueProfileTab === 'contacts') {
      void global.pldHydrateOrgContactsPanel('venue', String(selectedVenueId || ''));
    } else if (page === 'client' && clientProfileTab === 'files') {
      void global.pldHydrateOrgFilesList('client', String(selectedClientId || ''), 'pldCrmOrgFilesMount');
    } else if (page === 'vendor' && vendorProfileTab === 'files') {
      void global.pldHydrateOrgFilesList('vendor', String(selectedVendorId || ''), 'pldCrmOrgFilesMount');
    } else if (page === 'venue' && venueProfileTab === 'files') {
      void global.pldHydrateOrgFilesList('venue', String(selectedVenueId || ''), 'pldCrmOrgFilesMount');
    }
  };

  function renderClientProfilePage() {
    const id = selectedClientId ? String(selectedClientId) : '';
    const c =
      typeof CLIENTS !== 'undefined' && CLIENTS.find
        ? CLIENTS.find(function (x) {
            return String(x.id) === id;
          })
        : null;
    if (!c) {
      return '<div class="empty-state"><h3>Client not found</h3><button type="button" class="btn btn-primary" onclick="navigateTo(\'clients\')">Back to Clients</button></div>';
    }
    const md = safeObj(c.metadata);
    const prof = orgProfileFromMeta(md);
    const tab = clientProfileTab || 'overview';
    const coverUrl = prof.cover_document_id ? String(prof.cover_document_id) : '';
    const avatarUrl = prof.avatar_document_id ? String(prof.avatar_document_id) : '';
    const tagline = prof.tagline != null ? String(prof.tagline) : '';
    const about = prof.about != null ? String(prof.about) : '';

    let body = '';
    if (tab === 'overview') {
      body = `
        <div class="crm-profile-panel">
          <h3>Organization</h3>
          <div class="crm-profile-meta-grid">
            <div class="form-group"><label class="form-label">Name</label>
              <input type="text" class="form-input" id="pldCrmClientName" value="${attrEsc(c.name)}" /></div>
            <div class="form-group"><label class="form-label">Tagline</label>
              <input type="text" class="form-input" id="pldCrmClientTagline" value="${attrEsc(tagline)}" placeholder="Short subtitle" /></div>
          </div>
          <div class="form-group"><label class="form-label">About</label>
            <textarea class="form-textarea" id="pldCrmClientAbout" rows="4" placeholder="Public-facing description">${esc(about)}</textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Website</label>
              <input type="url" class="form-input" id="pldCrmClientWebsite" value="${attrEsc(prof.website != null ? String(prof.website) : '')}" /></div>
            <div class="form-group"><label class="form-label">Social (one URL)</label>
              <input type="url" class="form-input" id="pldCrmClientSocial" value="${attrEsc(prof.social_url != null ? String(prof.social_url) : '')}" /></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;">
            <div class="form-group"><label class="form-label">Primary contact name</label>
              <input type="text" class="form-input" id="pldCrmClientCn" value="${attrEsc(c.contact_name || c.contact || '')}" /></div>
            <div class="form-group"><label class="form-label">Email</label>
              <input type="email" class="form-input" id="pldCrmClientCe" value="${attrEsc(c.contact_email || c.email || '')}" /></div>
          </div>
          <div class="form-group"><label class="form-label">Phone</label>
            <input type="text" class="form-input" id="pldCrmClientPh" value="${attrEsc(c.phone || '')}" /></div>
          <div class="form-group"><label class="form-label">Internal notes</label>
            <textarea class="form-textarea" id="pldCrmClientNotes" rows="3">${esc(c.notes || '')}</textarea></div>
          <button type="button" class="btn btn-primary" onclick="void window.pldSaveClientProfile('${attrEsc(id)}')">Save</button>
        </div>`;
    } else if (tab === 'contacts') {
      body = renderOrgContactsPanel('client', id);
    } else if (tab === 'files') {
      body = renderOrgFilesPanel('client', id);
    } else if (tab === 'events') {
      const evs =
        typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)
          ? EVENTS.filter(function (e) {
              return String(e.client) === id;
            })
          : [];
      body = `<div class="crm-profile-panel"><h3>Events</h3>
        ${
          evs.length === 0
            ? '<p class="pld-empty-state" style="border:none;padding:0;">No events for this client.</p>'
            : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Phase</th><th>Start</th></tr></thead><tbody>${evs
                .map(function (ev) {
                  return `<tr class="ep-clickable" onclick="navigateToEvent('${attrEsc(ev.id)}')"><td>${esc(ev.name)}</td><td>${esc(ev.phase)}</td><td>${esc(ev.startDate)}</td></tr>`;
                })
                .join('')}</tbody></table></div>`
        }</div>`;
    }

    const coverStyle = coverUrl
      ? `background-image:url('');`
      : '';
    const clientHero = global.pldCrmOrgHeroHtml({
      coverId: 'pldCrmClientCover',
      coverStyle: coverStyle,
      avatarId: 'pldCrmClientAvatar',
      avatarInner: c.name ? esc(String(c.name).slice(0, 2).toUpperCase()) : '?',
      title: c.name,
      tagline: tagline ? tagline : 'Client organization',
      actionsHtml:
        '<div class="crm-profile-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" onclick="navigateTo(\'clients\')">← Back</button>' +
        '</div>',
    });
    return `
      <div class="crm-profile-page">
        ${clientHero}
        ${orgTabBarHtml('client', tab)}
        ${body}
      </div>`;
  }

  function renderOrgContactsPanel(kind, parentId) {
    const rows =
      typeof global.pldListContactsForParent === 'function'
        ? null
        : [];
    return `<div class="crm-profile-panel" id="pldOrgContactsWrap" data-kind="${kind}" data-parent="${attrEsc(parentId)}">
      <h3>Contacts</h3>
      <p style="font-size:13px;color:var(--text-tertiary);">Click a row to open the full contact profile.</p>
      <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldHydrateOrgContactsPanel('${kind}','${attrEsc(parentId)}')">Refresh</button>
      <div id="pldOrgContactsMount" style="margin-top:12px;"></div>
    </div>`;
  }

  global.pldHydrateOrgContactsPanel = async function (kind, parentId) {
    if (typeof global.pldListContactsForParent !== 'function') return;
    const list = await global.pldListContactsForParent(kind, parentId);
    const el = document.getElementById('pldOrgContactsMount');
    if (!el) return;
    if (!list || list.length === 0) {
      el.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">No contacts yet.</p>';
      return;
    }
    el.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Title</th><th>Email</th><th></th></tr></thead><tbody>${list
      .map(function (row) {
        const r = /** @type {Record<string, unknown>} */ (row);
        const cid = String(r.id || '');
        return `<tr onclick="navigateToContact('${kind}','${attrEsc(parentId)}','${attrEsc(cid)}')">
          <td><strong>${esc(r.name)}</strong></td>
          <td>${esc(r.title || '—')}</td>
          <td>${esc(r.email || '—')}</td>
          <td><button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();navigateToContact('${kind}','${attrEsc(parentId)}','${attrEsc(cid)}')">Open</button></td>
        </tr>`;
      })
      .join('')}</tbody></table>`;
  };

  function renderOrgFilesPanel(entityKind, entityId) {
    return `<div class="crm-profile-panel">
      <h3>Files</h3>
      <p style="font-size:13px;color:var(--text-tertiary);">Documents linked to this entity.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <input type="file" id="pldCrmOrgFile" />
        <button type="button" class="btn btn-primary btn-sm" onclick="void window.pldCrmUploadOrgDoc('${esc(entityKind)}','${attrEsc(entityId)}','pldCrmOrgFile','pldCrmOrgFilesMount')">Upload</button>
      </div>
      <div id="pldCrmOrgFilesMount" data-entity="${esc(entityKind)}" data-id="${attrEsc(entityId)}"></div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldHydrateOrgFilesList('${esc(entityKind)}','${attrEsc(entityId)}','pldCrmOrgFilesMount')">Refresh list</button>
    </div>`;
  }

  global.pldHydrateOrgFilesList = async function (entityType, entityId, mountId) {
    const docs = await global.pldListDocumentsForEntity(entityType, entityId);
    const mount = document.getElementById(mountId || 'pldCrmOrgFilesMount');
    if (!mount) return;
    if (!docs.length) {
      mount.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">No files yet.</p>';
      return;
    }
    mount.innerHTML = `<div class="crm-doc-list">${docs
      .map(function (d) {
        return `<div class="crm-doc-row"><span>${esc(d.name || d.id)}</span><span style="color:var(--text-tertiary);font-size:12px;">${esc(d.mime_type || '')}</span></div>`;
      })
      .join('')}</div>`;
  };

  global.pldCrmUploadOrgDoc = async function (entityType, entityId, fileInputId, mountId) {
    const inp = document.getElementById(fileInputId || 'pldCrmOrgFile');
    if (!inp || !inp.files || !inp.files[0]) {
      if (typeof showToast === 'function') showToast('Choose a file', 'warning');
      return;
    }
    if (typeof global.pldApiFormFetch !== 'function') return;
    const fd = new FormData();
    fd.append('file', inp.files[0]);
    fd.append('category', 'other');
    fd.append('entity_type', entityType);
    fd.append('entity_id', entityId);
    const r = await global.pldApiFormFetch('/api/v1/documents/upload', fd, { method: 'POST' });
    if (!r.ok) {
      const msg = r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Upload failed', 'error');
      return;
    }
    inp.value = '';
    if (typeof showToast === 'function') showToast('Uploaded', 'success');
    void global.pldHydrateOrgFilesList(entityType, entityId, mountId || 'pldCrmOrgFilesMount');
  };

  global.pldSaveClientProfile = async function (id) {
    if (typeof global.pldUpdateClientViaApi !== 'function') return;
    const c = CLIENTS.find(function (x) {
      return String(x.id) === String(id);
    });
    if (!c) return;
    const name = document.getElementById('pldCrmClientName')?.value?.trim() || '';
    if (!name) {
      if (typeof showToast === 'function') showToast('Name is required', 'error');
      return;
    }
    const tagline = document.getElementById('pldCrmClientTagline')?.value?.trim() || '';
    const about = document.getElementById('pldCrmClientAbout')?.value?.trim() || '';
    const website = document.getElementById('pldCrmClientWebsite')?.value?.trim() || '';
    const social_url = document.getElementById('pldCrmClientSocial')?.value?.trim() || '';
    const contact_name = document.getElementById('pldCrmClientCn')?.value?.trim() || '';
    const contact_email = document.getElementById('pldCrmClientCe')?.value?.trim() || '';
    const phone = document.getElementById('pldCrmClientPh')?.value?.trim() || '';
    const notes = document.getElementById('pldCrmClientNotes')?.value?.trim() || '';
    const md = safeObj(c.metadata);
    const prof = orgProfileFromMeta(md);
    const nextProf = { ...prof, tagline, about, website: website || undefined, social_url: social_url || undefined };
    const metadata = mergeOrgProfileMeta(md, nextProf);
    const ui = await global.pldUpdateClientViaApi(id, {
      name,
      contact_name: contact_name || undefined,
      contact_email: contact_email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      metadata,
    });
    if (ui && typeof showToast === 'function') showToast('Saved', 'success');
    if (typeof renderPage === 'function') renderPage('client', { skipModuleDataFetch: true });
  };

  function renderVendorProfilePage() {
    const id = selectedVendorId ? String(selectedVendorId) : '';
    const c =
      typeof VENDORS !== 'undefined' && VENDORS.find
        ? VENDORS.find(function (x) {
            return String(x.id) === id;
          })
        : null;
    if (!c) {
      return '<div class="empty-state"><h3>Vendor not found</h3><button type="button" class="btn btn-primary" onclick="navigateTo(\'vendors\')">Back</button></div>';
    }
    const md = safeObj(c.metadata);
    const prof = orgProfileFromMeta(md);
    const tab = vendorProfileTab || 'overview';
    let body = '';
    if (tab === 'overview') {
      body = `
        <div class="crm-profile-panel">
          <div class="crm-profile-meta-grid">
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="pldCrmVenName" value="${attrEsc(c.name)}" /></div>
            <div class="form-group"><label class="form-label">Tagline</label><input type="text" class="form-input" id="pldCrmVenTag" value="${attrEsc(prof.tagline != null ? String(prof.tagline) : '')}" /></div>
          </div>
          <div class="form-group"><label class="form-label">About</label><textarea class="form-textarea" id="pldCrmVenAbout" rows="3">${esc(prof.about != null ? String(prof.about) : '')}</textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Contact name</label><input type="text" class="form-input" id="pldCrmVenCn" value="${attrEsc(c.contact_name || '')}" /></div>
            <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="pldCrmVenCe" value="${attrEsc(c.contact_email || '')}" /></div>
          </div>
          <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="pldCrmVenPh" value="${attrEsc(c.phone || '')}" /></div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="pldCrmVenNotes" rows="3">${esc(c.notes || '')}</textarea></div>
          <button type="button" class="btn btn-primary" onclick="void window.pldSaveVendorProfile('${attrEsc(id)}')">Save</button>
        </div>`;
    } else if (tab === 'contacts') body = renderOrgContactsPanel('vendor', id);
    else if (tab === 'files') body = renderOrgFilesPanel('vendor', id);

    const vendorHero = global.pldCrmOrgHeroHtml({
      avatarInner: c.name ? esc(String(c.name).slice(0, 2).toUpperCase()) : '?',
      title: c.name,
      tagline: 'Vendor',
      actionsHtml:
        '<button type="button" class="btn btn-ghost btn-sm" onclick="navigateTo(\'vendors\')">← Back</button>',
    });
    return `
      <div class="crm-profile-page">
        ${vendorHero}
        ${orgTabBarHtml('vendor', tab)}
        ${body}
      </div>`;
  }

  global.pldSaveVendorProfile = async function (id) {
    if (typeof global.pldUpdateVendorViaApi !== 'function') return;
    const c = VENDORS.find(function (x) {
      return String(x.id) === String(id);
    });
    if (!c) return;
    const name = document.getElementById('pldCrmVenName')?.value?.trim() || '';
    if (!name) {
      if (typeof showToast === 'function') showToast('Name is required', 'error');
      return;
    }
    const md = safeObj(c.metadata);
    const prof = orgProfileFromMeta(md);
    const nextProf = {
      ...prof,
      tagline: document.getElementById('pldCrmVenTag')?.value?.trim() || '',
      about: document.getElementById('pldCrmVenAbout')?.value?.trim() || '',
    };
    const metadata = mergeOrgProfileMeta(md, nextProf);
    const ui = await global.pldUpdateVendorViaApi(id, {
      name,
      contact_name: document.getElementById('pldCrmVenCn')?.value?.trim() || undefined,
      contact_email: document.getElementById('pldCrmVenCe')?.value?.trim() || undefined,
      phone: document.getElementById('pldCrmVenPh')?.value?.trim() || undefined,
      notes: document.getElementById('pldCrmVenNotes')?.value?.trim() || undefined,
      metadata,
    });
    if (ui && typeof showToast === 'function') showToast('Saved', 'success');
    if (typeof renderPage === 'function') renderPage('vendor', { skipModuleDataFetch: true });
  };

  function venueCanEditVenues() {
    return typeof global.pldHasApiPermission === 'function' && global.pldHasApiPermission('venues:update');
  }

  global.pldApplyVenueMapsLinkResolve = async function () {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to resolve links (venues:update).', 'error');
      return;
    }
    const inp = document.getElementById('pldCrmVenueMapsLink');
    const latEl = document.getElementById('pldCrmVenueLat');
    const lngEl = document.getElementById('pldCrmVenueLng');
    const tzEl = document.getElementById('pldCrmVenueTz');
    const addrEl = document.getElementById('pldCrmVenueAddr');
    const raw = inp && inp.value ? String(inp.value).trim() : '';
    if (!raw) {
      if (typeof showToast === 'function') showToast('Paste a maps link first', 'warning');
      return;
    }
    let filled = false;
    if (typeof global.pldApiFetch === 'function') {
      const res = await global.pldApiFetch('/api/v1/venues/resolve-maps-link', {
        method: 'POST',
        body: JSON.stringify({ url: raw }),
      });
      if (res.ok && res.body && res.body.data) {
        const d = res.body.data;
        if (d.latitude != null && d.longitude != null) {
          if (latEl) latEl.value = String(d.latitude);
          if (lngEl) lngEl.value = String(d.longitude);
          filled = true;
        }
        if (d.timezone && tzEl) tzEl.value = String(d.timezone);
        if (d.formatted_address && addrEl && !addrEl.value.trim()) addrEl.value = String(d.formatted_address);
        if (filled) {
          if (typeof showToast === 'function') showToast('Location fields updated', 'success');
          return;
        }
        if (d.partial && !filled) {
          const local = pldClientParseCoordsFromMapsUrl(raw);
          if (local) {
            if (latEl) latEl.value = String(local.lat);
            if (lngEl) lngEl.value = String(local.lng);
            if (typeof showToast === 'function') showToast('Coordinates filled from link (partial)', 'success');
            return;
          }
        }
      } else if (res.status === 403 && typeof showToast === 'function') {
        showToast('No permission to resolve links (venues:update).', 'error');
        return;
      }
    }
    const local = pldClientParseCoordsFromMapsUrl(raw);
    if (local) {
      if (latEl) latEl.value = String(local.lat);
      if (lngEl) lngEl.value = String(local.lng);
      if (typeof showToast === 'function') showToast('Coordinates parsed from link', 'success');
      return;
    }
    if (typeof showToast === 'function') {
      showToast('Could not extract coordinates — set latitude/longitude manually.', 'warning');
    }
  };

  global.pldHydrateVenueHeroAssets = async function (venueId) {
    const id = String(venueId || '').trim();
    if (!id || typeof VENUES === 'undefined' || !Array.isArray(VENUES)) return;
    const v = VENUES.find(function (x) {
      return String(x.id) === id;
    });
    if (!v) return;
    const md = safeObj(v.metadata);
    const prof = orgProfileFromMeta(md);
    const mode = prof.cover_banner_mode != null ? String(prof.cover_banner_mode) : 'gradient';
    const coverEl = document.getElementById('pldCrmVenueCover');
    const avEl = document.getElementById('pldCrmVenueAvatar');
    if (window.__pldVenueCoverBlobUrl) {
      try {
        URL.revokeObjectURL(window.__pldVenueCoverBlobUrl);
      } catch (_e) {}
      window.__pldVenueCoverBlobUrl = null;
    }
    if (coverEl) {
      coverEl.style.backgroundImage = '';
      coverEl.style.backgroundSize = '';
      coverEl.style.backgroundPosition = '';
      const latOk = v.latitude != null && v.longitude != null;
      const hasCoverDoc = !!prof.cover_document_id;

      if (mode === 'custom' && hasCoverDoc) {
        const meta = await global.pldGetDocumentMetaForDisplay(String(prof.cover_document_id));
        const url = meta && meta.download_url ? String(meta.download_url) : '';
        if (url) {
          coverEl.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
          coverEl.style.backgroundSize = 'cover';
          coverEl.style.backgroundPosition = 'center';
        }
      } else if ((mode === 'google_map' || mode === 'google_streetview') && latOk) {
        const variant = mode === 'google_streetview' ? 'google_streetview' : 'google_map';
        const blob = await pldVenueFetchBannerBlob(id, variant);
        if (blob) {
          const ou = URL.createObjectURL(blob);
          window.__pldVenueCoverBlobUrl = ou;
          coverEl.style.backgroundImage = 'url(' + JSON.stringify(ou) + ')';
          coverEl.style.backgroundSize = 'cover';
          coverEl.style.backgroundPosition = 'center';
        } else {
          pldApplyOsmBannerToCoverEl(coverEl, v.latitude, v.longitude);
        }
      } else if (mode === 'map' && latOk) {
        pldApplyOsmBannerToCoverEl(coverEl, v.latitude, v.longitude);
      } else if ((mode === 'gradient' || mode === '') && hasCoverDoc) {
        const meta = await global.pldGetDocumentMetaForDisplay(String(prof.cover_document_id));
        const url = meta && meta.download_url ? String(meta.download_url) : '';
        if (url) {
          coverEl.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
          coverEl.style.backgroundSize = 'cover';
          coverEl.style.backgroundPosition = 'center';
        }
      } else if ((mode === 'gradient' || mode === '') && latOk && !hasCoverDoc) {
        /** Default banner: map snapshot when coordinates exist and no custom cover (plan: auto “pretty” header). */
        const blob = await pldVenueFetchBannerBlob(id, 'google_map');
        if (blob) {
          const ou = URL.createObjectURL(blob);
          window.__pldVenueCoverBlobUrl = ou;
          coverEl.style.backgroundImage = 'url(' + JSON.stringify(ou) + ')';
          coverEl.style.backgroundSize = 'cover';
          coverEl.style.backgroundPosition = 'center';
        } else {
          pldApplyOsmBannerToCoverEl(coverEl, v.latitude, v.longitude);
        }
      }
    }
    if (avEl && prof.avatar_document_id) {
      const meta = await global.pldGetDocumentMetaForDisplay(String(prof.avatar_document_id));
      const url = meta && meta.download_url ? String(meta.download_url) : '';
      if (url) {
        avEl.classList.add('crm-profile-avatar--photo');
        avEl.innerHTML = '<img src="' + attrEsc(url) + '" alt="" decoding="async" />';
      }
    }
  };

  async function pldCrmPatchVenueProfileDocs(venueId, profilePatch) {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to edit venues (venues:update).', 'error');
      return;
    }
    const id = String(venueId || '').trim();
    if (!id || typeof global.pldApiFetch !== 'function') return;
    const v = VENUES.find(function (x) {
      return String(x.id) === id;
    });
    if (!v) return;
    const md = safeObj(v.metadata);
    const nextProf = { ...orgProfileFromMeta(md), ...safeObj(profilePatch) };
    const metadata = mergeOrgProfileMeta(md, nextProf);
    const res = await global.pldApiFetch('/api/v1/venues/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify({ metadata }),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') {
        if (res.status === 403) {
          showToast(msg || 'No permission (venues:update).', 'error');
        } else {
          showToast(msg || 'Update failed', 'error');
        }
      }
      return;
    }
    if (typeof global.pldFetchVenuesFromApiIfConfigured === 'function') {
      await global.pldFetchVenuesFromApiIfConfigured(window.__pldVenuesListSearch || '');
    }
    if (typeof showToast === 'function') showToast('Updated', 'success');
    if (typeof renderPage === 'function') renderPage('venue', { skipModuleDataFetch: true });
  }

  global.pldCrmUploadVenueLogo = async function (venueId, fileInputId) {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to edit venues (venues:update).', 'error');
      return;
    }
    const inp = document.getElementById(fileInputId || 'pldCrmVenueLogoFile');
    if (!inp || !inp.files || !inp.files[0]) {
      if (typeof showToast === 'function') showToast('Choose an image', 'warning');
      return;
    }
    const f = inp.files[0];
    if (!f.type.startsWith('image/')) {
      if (typeof showToast === 'function') showToast('Use an image file', 'warning');
      return;
    }
    if (typeof global.pldApiFormFetch !== 'function') return;
    const fd = new FormData();
    fd.append('file', f, f.name || 'logo.jpg');
    fd.append('category', 'photo');
    fd.append('entity_type', 'venue');
    fd.append('entity_id', String(venueId));
    const r = await global.pldApiFormFetch('/api/v1/documents/upload', fd, { method: 'POST' });
    if (!r.ok || !r.body || !r.body.data || !r.body.data.id) {
      const msg = r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Upload failed', 'error');
      return;
    }
    inp.value = '';
    await pldCrmPatchVenueProfileDocs(venueId, { avatar_document_id: String(r.body.data.id) });
  };

  global.pldCrmUploadVenueCover = async function (venueId, fileInputId) {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to edit venues (venues:update).', 'error');
      return;
    }
    const inp = document.getElementById(fileInputId || 'pldCrmVenueCoverFile');
    if (!inp || !inp.files || !inp.files[0]) {
      if (typeof showToast === 'function') showToast('Choose an image', 'warning');
      return;
    }
    const f = inp.files[0];
    if (!f.type.startsWith('image/')) {
      if (typeof showToast === 'function') showToast('Use an image file', 'warning');
      return;
    }
    if (typeof global.pldApiFormFetch !== 'function') return;
    const fd = new FormData();
    fd.append('file', f, f.name || 'banner.jpg');
    fd.append('category', 'photo');
    fd.append('entity_type', 'venue');
    fd.append('entity_id', String(venueId));
    const r = await global.pldApiFormFetch('/api/v1/documents/upload', fd, { method: 'POST' });
    if (!r.ok || !r.body || !r.body.data || !r.body.data.id) {
      const msg = r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Upload failed', 'error');
      return;
    }
    inp.value = '';
    await pldCrmPatchVenueProfileDocs(venueId, {
      cover_document_id: String(r.body.data.id),
      cover_banner_mode: 'custom',
    });
  };

  global.pldCrmClearVenueLogo = function (venueId) {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to edit venues (venues:update).', 'error');
      return;
    }
    void pldCrmPatchVenueProfileDocs(venueId, { avatar_document_id: null });
  };

  global.pldCrmClearVenueCover = function (venueId) {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to edit venues (venues:update).', 'error');
      return;
    }
    void pldCrmPatchVenueProfileDocs(venueId, { cover_document_id: null, cover_banner_mode: 'gradient' });
  };

  function renderVenueProfilePage() {
    const id = selectedVenueId ? String(selectedVenueId) : '';
    const v =
      typeof VENUES !== 'undefined' && VENUES.find
        ? VENUES.find(function (x) {
            return String(x.id) === id;
          })
        : null;
    if (!v) {
      return '<div class="empty-state"><h3>Venue not found</h3><button type="button" class="btn btn-primary" onclick="navigateTo(\'venues\')">Back</button></div>';
    }
    const md = safeObj(v.metadata);
    const prof = orgProfileFromMeta(md);
    const tab = venueProfileTab || 'overview';
    const coverMode = prof.cover_banner_mode != null ? String(prof.cover_banner_mode) : 'gradient';
    const mapsLinkSaved = prof.maps_link != null ? String(prof.maps_link).trim() : '';
    const latStr = v.latitude != null ? String(v.latitude) : '';
    const lngStr = v.longitude != null ? String(v.longitude) : '';
    const hasCoords = latStr !== '' && lngStr !== '' && !Number.isNaN(Number(latStr)) && !Number.isNaN(Number(lngStr));
    const googleUrl = hasCoords
      ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(latStr + ',' + lngStr)
      : '';
    const appleUrl = hasCoords ? 'https://maps.apple.com/?ll=' + encodeURIComponent(latStr + ',' + lngStr) : '';
    const osmUrl = hasCoords
      ? 'https://www.openstreetmap.org/?mlat=' +
        encodeURIComponent(latStr) +
        '&mlon=' +
        encodeURIComponent(lngStr) +
        '#map=16/' +
        latStr +
        '/' +
        lngStr
      : '';
    const embedSrc = hasCoords ? pldVenueOsmEmbedUrl(latStr, lngStr) : '';

    const canEdit = venueCanEditVenues();
    const isView = !canEdit || venueProfileViewMode !== 'edit';

    let body = '';
    if (tab === 'overview') {
      const modeOpts = [
        ['gradient', 'Default banner'],
        ['map', 'OpenStreetMap snapshot'],
        ['google_map', 'Google map preview (server key)'],
        ['google_streetview', 'Street View preview (server key)'],
        ['custom', 'Custom image'],
      ];
      const modeSelect = modeOpts
        .map(function (opt) {
          return (
            '<option value="' +
            esc(opt[0]) +
            '"' +
            (coverMode === opt[0] ? ' selected' : '') +
            '>' +
            esc(opt[1]) +
            '</option>'
          );
        })
        .join('');
      const mapsLinkRow =
        mapsLinkSaved && isView
          ? `<p class="pld-venue-readonly-line"><a href="${attrEsc(mapsLinkSaved)}" target="_blank" rel="noopener noreferrer">${esc(mapsLinkSaved)}</a></p>`
          : '';
      const overviewReadonly = `
        <div class="crm-profile-panel pld-venue-overview-readonly">
          <dl class="pld-venue-readonly">
            <dt>Name</dt><dd>${esc(v.name)}</dd>
            <dt>City</dt><dd>${esc(v.city || '—')}</dd>
            <dt>Tagline</dt><dd>${esc(prof.tagline != null ? String(prof.tagline) : '—')}</dd>
            <dt>About</dt><dd style="white-space:pre-wrap;">${esc(prof.about != null ? String(prof.about) : '—')}</dd>
            <dt>Address</dt><dd>${esc(v.address || '—')}</dd>
            <dt>Maps link</dt><dd>${mapsLinkRow || '—'}</dd>
            <dt>Latitude</dt><dd>${latStr ? esc(latStr) : '—'}</dd>
            <dt>Longitude</dt><dd>${lngStr ? esc(lngStr) : '—'}</dd>
            <dt>Timezone</dt><dd>${esc(v.timezone || '—')}</dd>
            <dt>Notes</dt><dd style="white-space:pre-wrap;">${esc(v.notes || '—')}</dd>
          </dl>
          ${
            canEdit
              ? '<button type="button" class="btn btn-primary btn-sm pld-venue-edit-start" onclick="switchVenueProfileViewMode(\'edit\')">Edit details</button>'
              : '<p class="form-hint" style="margin-top:12px;">You have read-only access to this venue.</p>'
          }
        </div>`;
      const overviewEdit = `
        <div class="crm-profile-panel">
          <h3 class="pld-venue-section-title">Branding</h3>
          <p class="form-hint pld-venue-brand-hint">Logo and banner use your uploaded images, or map previews when the server has Google Maps configured.</p>
          <div class="pld-venue-brand-row pld-venue-branding-edit">
            <div class="pld-venue-brand-compact">
              <span class="pld-venue-brand-label">Logo</span>
              <input type="file" id="pldCrmVenueLogoFile" accept="image/*" class="pld-venue-file-quiet" />
              <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldCrmUploadVenueLogo('${attrEsc(id)}','pldCrmVenueLogoFile')">Upload</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldCrmClearVenueLogo('${attrEsc(id)}')">Remove</button>
            </div>
            <div class="pld-venue-brand-compact">
              <span class="pld-venue-brand-label">Banner</span>
              <input type="file" id="pldCrmVenueCoverFile" accept="image/*" class="pld-venue-file-quiet" />
              <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldCrmUploadVenueCover('${attrEsc(id)}','pldCrmVenueCoverFile')">Upload</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldCrmClearVenueCover('${attrEsc(id)}')">Clear</button>
            </div>
            <div class="form-group" style="margin-top:12px;max-width:420px;">
              <label class="form-label">Banner style</label>
              <select class="form-input" id="pldCrmVenueCoverMode">${modeSelect}</select>
              <p class="form-hint">Google options need <code>GOOGLE_MAPS_API_KEY</code> on the API. Otherwise use OpenStreetMap or a custom upload.</p>
            </div>
          </div>
          <h3 class="pld-venue-section-title">Details</h3>
          <div class="crm-profile-meta-grid">
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="pldCrmVenueName" value="${attrEsc(v.name)}" /></div>
            <div class="form-group"><label class="form-label">City</label><input type="text" class="form-input" id="pldCrmVenueCity" value="${attrEsc(v.city || '')}" /></div>
          </div>
          <div class="form-group"><label class="form-label">Tagline</label><input type="text" class="form-input" id="pldCrmVenueTag" value="${attrEsc(prof.tagline != null ? String(prof.tagline) : '')}" /></div>
          <div class="form-group"><label class="form-label">About</label><textarea class="form-textarea" id="pldCrmVenueAbout" rows="3">${esc(prof.about != null ? String(prof.about) : '')}</textarea></div>
          <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-input" id="pldCrmVenueAddr" value="${attrEsc(v.address || '')}" /></div>
          <div class="form-group"><label class="form-label">Maps link</label>
            <div class="pld-venue-mapslink-row">
              <input type="url" class="form-input" id="pldCrmVenueMapsLink" value="${attrEsc(mapsLinkSaved)}" placeholder="https://maps.google.com/..." />
              <button type="button" class="btn btn-secondary btn-sm" onclick="void window.pldApplyVenueMapsLinkResolve()">Apply link</button>
            </div>
            <p class="form-hint">Apply fills latitude, longitude, and timezone when possible.</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Latitude</label><input type="text" class="form-input" id="pldCrmVenueLat" value="${v.latitude != null ? esc(String(v.latitude)) : ''}" /></div>
            <div class="form-group"><label class="form-label">Longitude</label><input type="text" class="form-input" id="pldCrmVenueLng" value="${v.longitude != null ? esc(String(v.longitude)) : ''}" /></div>
            <div class="form-group"><label class="form-label">Timezone</label><input type="text" class="form-input" id="pldCrmVenueTz" value="${attrEsc(v.timezone || '')}" placeholder="America/Chicago" /></div>
          </div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="pldCrmVenueNotes" rows="3">${esc(v.notes || '')}</textarea></div>
          <div class="pld-venue-edit-actions">
            <button type="button" class="btn btn-primary" onclick="void window.pldSaveVenueProfile('${attrEsc(id)}')">Save</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="switchVenueProfileViewMode('view')">Cancel</button>
          </div>
        </div>`;
      body = isView ? overviewReadonly : overviewEdit;
    } else if (tab === 'contacts') body = renderOrgContactsPanel('venue', id);
    else if (tab === 'files') {
      body = isView
        ? `<div class="crm-profile-panel"><h3>Files</h3><p style="font-size:13px;color:var(--text-tertiary);">Documents linked to this venue.</p><div id="pldCrmOrgFilesMount" data-entity="venue" data-id="${attrEsc(id)}"></div></div>`
        : renderOrgFilesPanel('venue', id);
    } else if (tab === 'location') {
      const linkRow = [];
      if (mapsLinkSaved) {
        linkRow.push(
          `<a href="${attrEsc(mapsLinkSaved)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Saved maps link</a>`,
        );
      }
      if (googleUrl) {
        linkRow.push(
          `<a href="${attrEsc(googleUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Google Maps</a>`,
        );
      }
      if (appleUrl) {
        linkRow.push(
          `<a href="${attrEsc(appleUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Apple Maps</a>`,
        );
      }
      if (osmUrl) {
        linkRow.push(
          `<a href="${attrEsc(osmUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">OpenStreetMap</a>`,
        );
      }
      const linksHtml =
        linkRow.length > 0
          ? `<div class="pld-venue-map-links">${linkRow.join('')}</div>`
          : '<p style="color:var(--text-tertiary);font-size:13px;">Add latitude/longitude on Overview, or save a maps link there, to open external maps.</p>';
      const embedBlock = embedSrc
        ? `<div class="pld-venue-map-embed-wrap"><iframe src="${attrEsc(embedSrc)}" class="pld-venue-map-embed" title="Venue map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
        : '<p style="color:var(--text-tertiary);font-size:13px;">Set coordinates on Overview to show an interactive map here.</p>';
      body = `<div class="crm-profile-panel"><h3>Location</h3>
        <p style="font-size:13px;">${esc(v.address || '')}${v.city ? ', ' + esc(v.city) : ''}</p>
        ${embedBlock}
        <h3 style="margin-top:16px;">Open in maps</h3>
        ${linksHtml}</div>`;
    }

    const heroEditBar =
      canEdit && isView
        ? `<button type="button" class="btn btn-secondary btn-sm pld-venue-hero-edit" onclick="switchVenueProfileViewMode('edit')">Edit</button>`
        : canEdit && !isView
          ? `<button type="button" class="btn btn-ghost btn-sm pld-venue-hero-done" onclick="switchVenueProfileViewMode('view')">View</button>`
          : '';
    const venueHeroActions =
      '<div class="pld-venue-hero-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="navigateTo(\'venues\')">← Back</button>' +
      heroEditBar +
      '</div>';
    const venueHero = global.pldCrmOrgHeroHtml({
      coverId: 'pldCrmVenueCover',
      avatarId: 'pldCrmVenueAvatar',
      avatarInner: v.name ? esc(String(v.name).slice(0, 2).toUpperCase()) : '?',
      title: v.name,
      tagline: v.city || 'Venue',
      actionsHtml: venueHeroActions,
    });
    return `
      <div class="crm-profile-page">
        ${venueHero}
        ${orgTabBarHtml('venue', tab)}
        ${body}
      </div>`;
  }

  global.pldSaveVenueProfile = async function (id) {
    if (!venueCanEditVenues()) {
      if (typeof showToast === 'function') showToast('No permission to edit venues (venues:update).', 'error');
      return;
    }
    if (typeof global.pldApiFetch !== 'function') return;
    const v = VENUES.find(function (x) {
      return String(x.id) === String(id);
    });
    if (!v) return;
    const name = document.getElementById('pldCrmVenueName')?.value?.trim() || '';
    if (!name) {
      if (typeof showToast === 'function') showToast('Name is required', 'error');
      return;
    }
    const md = safeObj(v.metadata);
    const prof = orgProfileFromMeta(md);
    const coverModeRaw = document.getElementById('pldCrmVenueCoverMode')?.value?.trim() || 'gradient';
    const allowedModes = ['gradient', 'map', 'custom', 'google_map', 'google_streetview'];
    const cover_banner_mode = allowedModes.includes(coverModeRaw) ? coverModeRaw : 'gradient';
    const mapsLinkRaw = document.getElementById('pldCrmVenueMapsLink')?.value?.trim() || '';
    const nextProf = {
      ...prof,
      tagline: document.getElementById('pldCrmVenueTag')?.value?.trim() || '',
      about: document.getElementById('pldCrmVenueAbout')?.value?.trim() || '',
      cover_banner_mode,
      maps_link: mapsLinkRaw ? mapsLinkRaw : null,
    };
    const metadata = mergeOrgProfileMeta(md, nextProf);
    const latRaw = document.getElementById('pldCrmVenueLat')?.value?.trim() || '';
    const lngRaw = document.getElementById('pldCrmVenueLng')?.value?.trim() || '';
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
    const needsCoords =
      cover_banner_mode === 'map' ||
      cover_banner_mode === 'google_map' ||
      cover_banner_mode === 'google_streetview';
    if (needsCoords && (latitude == null || longitude == null)) {
      if (typeof showToast === 'function') {
        showToast('This banner style needs both latitude and longitude.', 'warning');
      }
      return;
    }
    if (cover_banner_mode === 'custom' && !prof.cover_document_id) {
      if (typeof showToast === 'function') {
        showToast('Custom banner needs an uploaded image (Branding).', 'warning');
      }
      return;
    }
    const patch = {
      name,
      city: document.getElementById('pldCrmVenueCity')?.value?.trim() || null,
      address: document.getElementById('pldCrmVenueAddr')?.value?.trim() || null,
      latitude,
      longitude,
      timezone: document.getElementById('pldCrmVenueTz')?.value?.trim() || null,
      notes: document.getElementById('pldCrmVenueNotes')?.value?.trim() || null,
      metadata,
    };
    const res = await global.pldApiFetch('/api/v1/venues/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') {
        if (res.status === 403) {
          showToast(
            msg || 'No permission to edit venues (venues:update). Sign out and back in after RBAC changes.',
            'error',
          );
        } else {
          showToast(msg || 'Save failed', 'error');
        }
      }
      return;
    }
    if (typeof global.pldFetchVenuesFromApiIfConfigured === 'function') {
      await global.pldFetchVenuesFromApiIfConfigured(window.__pldVenuesListSearch || '');
    }
    if (typeof showToast === 'function') showToast('Saved', 'success');
    venueProfileViewMode = 'view';
    if (typeof renderPage === 'function') renderPage('venue', { skipModuleDataFetch: true });
  };

  global.renderContactProfilePage = renderContactProfilePage;
  function pldCrmContactOrgOptions(kind, selectedId) {
    const arr =
      kind === 'client'
        ? Array.isArray(CLIENTS)
          ? CLIENTS
          : []
        : kind === 'vendor'
          ? Array.isArray(VENDORS)
            ? VENDORS
            : []
          : Array.isArray(VENUES)
            ? VENUES
            : [];
    return (
      '<option value="">Select…</option>' +
      arr
        .map(function (r) {
          const id = String((r && r.id) || '');
          const name = String((r && r.name) || id || '—');
          return (
            '<option value="' +
            attrEsc(id) +
            '"' +
            (String(selectedId || '') === id ? ' selected' : '') +
            '>' +
            esc(name) +
            '</option>'
          );
        })
        .join('')
    );
  }

  function pldCrmContactPersonnelOptions(selectedId) {
    const arr = Array.isArray(PERSONNEL) ? PERSONNEL : [];
    return (
      '<option value="">Not linked</option>' +
      arr
        .map(function (p) {
          const id = String((p && p.id) || '');
          const nm = String((p && p.name) || id || '—');
          return (
            '<option value="' +
            attrEsc(id) +
            '"' +
            (String(selectedId || '') === id ? ' selected' : '') +
            '>' +
            esc(nm) +
            '</option>'
          );
        })
        .join('')
    );
  }

  global.pldContactProfileOnAssignKindChange = function (kind) {
    const sel = document.getElementById('pldCtAssignParent');
    if (!sel) return;
    sel.innerHTML = pldCrmContactOrgOptions(String(kind || 'client'), '');
  };

  global.pldAssignContactToOrg = async function () {
    const fromKind = selectedContactParentKind;
    const fromPid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co || !cid || !fromKind || !fromPid) return;
    const toKind = String(document.getElementById('pldCtAssignKind')?.value || '');
    const toPid = String(document.getElementById('pldCtAssignParent')?.value || '').trim();
    if (!toKind || !toPid) {
      if (typeof showToast === 'function') showToast('Select organization type and organization', 'warning');
      return;
    }
    if (toKind === String(fromKind) && toPid === String(fromPid)) {
      if (typeof showToast === 'function') showToast('This contact is already assigned to that organization', 'info');
      return;
    }
    if (typeof global.pldCreateContact !== 'function') {
      if (typeof showToast === 'function') showToast('Contact API not available', 'error');
      return;
    }
    const payload = {
      name: co.name || '',
      email: co.email || null,
      phone: co.phone || null,
      title: co.title || null,
      is_primary: !!co.is_primary,
      personnel_id: co.personnel_id || null,
      metadata: safeObj(co.metadata),
    };
    const created = await global.pldCreateContact(toKind, toPid, payload);
    if (!created || !created.id) return;
    if (typeof showToast === 'function') showToast('Assigned to organization', 'success');
    if (typeof window.pldRefreshContactsHub === 'function') void window.pldRefreshContactsHub();
    if (typeof navigateToContact === 'function') {
      navigateToContact(toKind, toPid, String(created.id));
    }
  };

  function pldCrmContactKindDetailsHtml(kind, details) {
    const org = details && details.organization && typeof details.organization === 'object' ? details.organization : {};
    if (kind === 'client') {
      return `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div class="form-group"><label class="form-label">Company / account</label><input type="text" class="form-input" id="pldCtDetCompany" value="${attrEsc(org.company || '')}" /></div>
          <div class="form-group"><label class="form-label">Department</label><input type="text" class="form-input" id="pldCtDetDepartment" value="${attrEsc(org.department || '')}" /></div>
          <div class="form-group"><label class="form-label">Decision role</label><input type="text" class="form-input" id="pldCtDetRole" value="${attrEsc(org.role || '')}" placeholder="Approver / Influencer / User" /></div>
        </div>`;
    }
    if (kind === 'vendor') {
      return `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div class="form-group"><label class="form-label">Vendor company</label><input type="text" class="form-input" id="pldCtDetCompany" value="${attrEsc(org.company || '')}" /></div>
          <div class="form-group"><label class="form-label">Service line</label><input type="text" class="form-input" id="pldCtDetServiceLine" value="${attrEsc(org.service_line || '')}" placeholder="Freight, fabrication, rentals..." /></div>
          <div class="form-group"><label class="form-label">Vendor code</label><input type="text" class="form-input" id="pldCtDetVendorCode" value="${attrEsc(org.vendor_code || '')}" /></div>
        </div>`;
    }
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">Venue area / room</label><input type="text" class="form-input" id="pldCtDetVenueArea" value="${attrEsc(org.venue_area || '')}" placeholder="Main hall, loading dock..." /></div>
        <div class="form-group"><label class="form-label">Access notes</label><input type="text" class="form-input" id="pldCtDetAccessNotes" value="${attrEsc(org.access_notes || '')}" placeholder="Hours, entrance, security..." /></div>
      </div>`;
  }

  function pldCrmContactCrewSummaryHtml(co) {
    const p = co && co.personnel && typeof co.personnel === 'object' ? co.personnel : null;
    if (!co || !co.personnel_id) return '';
    if (!p) {
      return '<p style="font-size:13px;color:var(--text-tertiary);margin:8px 0 0;">Linked to crew member ID: <code>' + esc(String(co.personnel_id)) + '</code></p>';
    }
    return (
      '<div style="margin-top:8px;padding:10px;border:1px solid var(--border-subtle);border-radius:8px;">' +
      '<div style="font-size:13px;"><strong>' +
      esc((p.first_name || '') + ' ' + (p.last_name || '')).trim() +
      '</strong></div>' +
      '<div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">' +
      esc((p.role || 'Crew') + (p.department_name ? ' • ' + p.department_name : '')) +
      '</div>' +
      '</div>'
    );
  }

  global.pldSaveContactDetailFields = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co) return;
    const md = safeObj(co.metadata);
    const details = md.details && typeof md.details === 'object' ? md.details : {};
    const org = details.organization && typeof details.organization === 'object' ? details.organization : {};
    const communication =
      details.communication && typeof details.communication === 'object' ? details.communication : {};
    communication.preferred_method =
      String(document.getElementById('pldCtDetPreferredMethod')?.value || '').trim() || null;
    communication.timezone = String(document.getElementById('pldCtDetTimezone')?.value || '').trim() || null;
    details.notes = String(document.getElementById('pldCtDetNotes')?.value || '').trim() || null;
    if (kind === 'client') {
      org.company = String(document.getElementById('pldCtDetCompany')?.value || '').trim() || null;
      org.department = String(document.getElementById('pldCtDetDepartment')?.value || '').trim() || null;
      org.role = String(document.getElementById('pldCtDetRole')?.value || '').trim() || null;
      delete org.service_line;
      delete org.vendor_code;
      delete org.venue_area;
      delete org.access_notes;
    } else if (kind === 'vendor') {
      org.company = String(document.getElementById('pldCtDetCompany')?.value || '').trim() || null;
      org.service_line = String(document.getElementById('pldCtDetServiceLine')?.value || '').trim() || null;
      org.vendor_code = String(document.getElementById('pldCtDetVendorCode')?.value || '').trim() || null;
      delete org.department;
      delete org.role;
      delete org.venue_area;
      delete org.access_notes;
    } else {
      org.venue_area = String(document.getElementById('pldCtDetVenueArea')?.value || '').trim() || null;
      org.access_notes = String(document.getElementById('pldCtDetAccessNotes')?.value || '').trim() || null;
      delete org.company;
      delete org.department;
      delete org.role;
      delete org.service_line;
      delete org.vendor_code;
    }
    details.organization = org;
    details.communication = communication;
    md.details = details;
    const ok = await global.pldUpdateContact(kind, pid, cid, { metadata: md });
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Details saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  function renderContactProfilePage() {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    if (!kind || !pid || !cid) {
      return '<div class="empty-state"><h3>Contact not found</h3></div>';
    }
    const cache = window.__pldContactDetailCache;
    const co = cache && String(cache.id) === String(cid) ? cache : null;
    if (!co) {
      if (!window.__pldContactProfileLoading) {
        window.__pldContactProfileLoading = true;
        global
          .pldLoadContactProfile()
          .then(function () {
            window.__pldContactProfileLoading = false;
          })
          .catch(function () {
            window.__pldContactProfileLoading = false;
          });
      }
      return '<div class="crm-profile-page"><p style="padding:24px;color:var(--text-tertiary);">Loading contact…</p></div>';
    }
    window.__pldContactDetailCache = co;
    const cmeta = safeObj(co.metadata);
    const tab = contactProfileTab || 'overview';
    const parentName =
      kind === 'client'
        ? (CLIENTS.find((x) => String(x.id) === String(pid)) || {}).name
        : kind === 'vendor'
          ? (VENDORS.find((x) => String(x.id) === String(pid)) || {}).name
          : (VENUES.find((x) => String(x.id) === String(pid)) || {}).name;

    const tabBar = global.pldCrmContactProfileTabBarHtml(tab);

    let panel = '';
    if (tab === 'overview') {
      const assignKind = String(kind || 'client');
      const personnelOptions = pldCrmContactPersonnelOptions(co.personnel_id || '');
      const detailObj = cmeta.details && typeof cmeta.details === 'object' ? cmeta.details : {};
      const comm = detailObj.communication && typeof detailObj.communication === 'object' ? detailObj.communication : {};
      panel = `
        <div class="crm-profile-panel">
          <p style="font-size:13px;color:var(--text-tertiary);">Parent: <strong>${esc(parentName || '—')}</strong></p>
          <div class="crm-profile-meta-grid">
            <div class="form-group"><label class="form-label">Display name</label><input type="text" class="form-input" id="pldCtName" value="${attrEsc(co.name)}" /></div>
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="pldCtTitle" value="${attrEsc(co.title || '')}" /></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="pldCtEmail" value="${attrEsc(co.email || '')}" /></div>
            <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="pldCtPhone" value="${attrEsc(co.phone || '')}" /></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="pldCtPrimary" ${co.is_primary ? 'checked' : ''} /> Primary contact
          </label>
          <div class="form-group" style="margin-top:8px;">
            <label class="form-label">Linked crew member</label>
            <select class="form-select" id="pldCtPersonnelId">${personnelOptions}</select>
            ${pldCrmContactCrewSummaryHtml(co)}
          </div>
          <button type="button" class="btn btn-primary" style="margin-top:12px;" onclick="void window.pldSaveContactProfile()">Save</button>
          <hr style="margin:16px 0;border:0;border-top:1px solid var(--border-subtle);" />
          <h3 style="margin:0 0 8px;">Context details</h3>
          ${pldCrmContactKindDetailsHtml(kind, detailObj)}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Preferred method</label>
              <select class="form-select" id="pldCtDetPreferredMethod">
                <option value="" ${!comm.preferred_method ? 'selected' : ''}>Not set</option>
                <option value="email" ${comm.preferred_method === 'email' ? 'selected' : ''}>Email</option>
                <option value="phone" ${comm.preferred_method === 'phone' ? 'selected' : ''}>Phone</option>
                <option value="sms" ${comm.preferred_method === 'sms' ? 'selected' : ''}>SMS</option>
                <option value="slack" ${comm.preferred_method === 'slack' ? 'selected' : ''}>Slack</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Timezone</label><input type="text" class="form-input" id="pldCtDetTimezone" value="${attrEsc(comm.timezone || '')}" placeholder="America/New_York"></div>
          </div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="pldCtDetNotes" rows="2">${esc(detailObj.notes || '')}</textarea></div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="void window.pldSaveContactDetailFields()">Save details</button>
          <hr style="margin:16px 0;border:0;border-top:1px solid var(--border-subtle);" />
          <h3 style="margin:0 0 8px;">Assign to organization</h3>
          <p style="font-size:13px;color:var(--text-tertiary);margin:0 0 8px;">Create this contact under another client/company, venue, or vendor.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Organization type</label>
              <select class="form-select" id="pldCtAssignKind" onchange="pldContactProfileOnAssignKindChange(this.value)">
                <option value="client" ${assignKind === 'client' ? 'selected' : ''}>Client / Company</option>
                <option value="venue" ${assignKind === 'venue' ? 'selected' : ''}>Venue</option>
                <option value="vendor" ${assignKind === 'vendor' ? 'selected' : ''}>Vendor</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Organization</label>
              <select class="form-select" id="pldCtAssignParent">${pldCrmContactOrgOptions(assignKind, '')}</select>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="void window.pldAssignContactToOrg()">Assign</button>
          <p style="margin-top:10px;font-size:12px;color:var(--text-tertiary);">Contact ID: <code>${esc(String(co.id || ''))}</code> ${co.person_id ? ' • Person ID: <code>' + esc(String(co.person_id)) + '</code>' : ''}</p>
        </div>`;
    } else if (tab === 'phones') {
      const phones = Array.isArray(cmeta.phones) ? cmeta.phones : [];
      const p1 = phones[0] && typeof phones[0] === 'object' ? phones[0] : {};
      const p2 = phones[1] && typeof phones[1] === 'object' ? phones[1] : {};
      panel = `<div class="crm-profile-panel"><h3>Phones</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label class="form-label">Primary phone</label><input type="text" class="form-input" id="pldCtPhone1" value="${attrEsc(p1.address || '')}" placeholder="+1 ..."></div>
          <div class="form-group"><label class="form-label">Label</label><input type="text" class="form-input" id="pldCtPhone1Label" value="${attrEsc(p1.label || 'Primary')}" placeholder="Primary"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label class="form-label">Secondary phone</label><input type="text" class="form-input" id="pldCtPhone2" value="${attrEsc(p2.address || '')}" placeholder="+1 ..."></div>
          <div class="form-group"><label class="form-label">Label</label><input type="text" class="form-input" id="pldCtPhone2Label" value="${attrEsc(p2.label || '')}" placeholder="Mobile / Office"></div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="void window.pldSaveContactPhones()">Save</button></div>`;
    } else if (tab === 'addresses') {
      const ad = cmeta.addresses && typeof cmeta.addresses === 'object' ? cmeta.addresses : {};
      panel = `<div class="crm-profile-panel"><h3>Addresses</h3>
        <div class="form-group"><label class="form-label">Mailing</label><textarea class="form-textarea" id="pldCtMail" rows="2">${esc(ad.mailing != null ? String(ad.mailing) : '')}</textarea></div>
        <div class="form-group"><label class="form-label">Shipping</label><textarea class="form-textarea" id="pldCtShip" rows="2">${esc(ad.shipping != null ? String(ad.shipping) : '')}</textarea></div>
        <button type="button" class="btn btn-primary btn-sm" onclick="void window.pldSaveContactAddresses()">Save</button></div>`;
    } else if (tab === 'billing') {
      const b = cmeta.billing && typeof cmeta.billing === 'object' ? cmeta.billing : {};
      panel = `<div class="crm-profile-panel"><h3>Billing & terms</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label class="form-label">Billing email</label><input type="email" class="form-input" id="pldCtBillingEmail" value="${attrEsc(b.email || '')}" /></div>
          <div class="form-group"><label class="form-label">Payment terms</label><input type="text" class="form-input" id="pldCtBillingTerms" value="${attrEsc(b.terms || '')}" placeholder="Net 30" /></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label class="form-label">Tax ID</label><input type="text" class="form-input" id="pldCtBillingTaxId" value="${attrEsc(b.tax_id || '')}" /></div>
          <div class="form-group"><label class="form-label">PO required</label>
            <select class="form-select" id="pldCtBillingPoReq">
              <option value="no" ${b.po_required ? '' : 'selected'}>No</option>
              <option value="yes" ${b.po_required ? 'selected' : ''}>Yes</option>
            </select>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="void window.pldSaveContactBilling()">Save</button></div>`;
    } else if (tab === 'skills') {
      const sk = Array.isArray(cmeta.skills) ? cmeta.skills.join(', ') : '';
      panel = `<div class="crm-profile-panel"><h3>Skills</h3>
        <input type="text" class="form-input" id="pldCtSkills" value="${attrEsc(sk)}" placeholder="Comma-separated" />
        <button type="button" class="btn btn-primary btn-sm" onclick="void window.pldSaveContactSkills()">Save</button></div>`;
    } else if (tab === 'files') {
      panel = `<div class="crm-profile-panel"><h3>Files</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="file" id="pldCtFile" />
          <button type="button" class="btn btn-primary btn-sm" onclick="void window.pldCrmUploadOrgDoc('contact','${attrEsc(cid)}','pldCtFile','pldCtFilesMount')">Upload</button>
        </div>
        <div id="pldCtFilesMount"></div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldHydrateOrgFilesList('contact','${attrEsc(cid)}','pldCtFilesMount')">Refresh list</button></div>`;
    } else if (tab === 'history') {
      const evs =
        typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)
          ? EVENTS.filter(function (e) {
              return String(e.primary_contact_id || '') === String(cid);
            })
          : [];
      panel = `<div class="crm-profile-panel"><h3>Linked events</h3>
        ${
          evs.length === 0
            ? '<p style="color:var(--text-tertiary);font-size:13px;">No events reference this contact as primary.</p>'
            : `<table class="data-table"><thead><tr><th>Event</th><th>Phase</th></tr></thead><tbody>${evs
                .map(function (e) {
                  return `<tr onclick="navigateToEvent('${attrEsc(e.id)}')"><td>${esc(e.name)}</td><td>${esc(e.phase)}</td></tr>`;
                })
                .join('')}</tbody></table>`
        }</div>`;
    }

    const contactHero = global.pldCrmOrgHeroHtml({
      avatarInner: esc((co.name || '?').slice(0, 2).toUpperCase()),
      title: co.name,
      tagline: co.title || 'Contact',
      actionsHtml:
        '<button type="button" class="btn btn-ghost btn-sm" onclick="navigateToContactParent()">← Back</button>',
    });
    return `
      <div class="crm-profile-page">
        ${contactHero}
        ${tabBar}
        ${panel}
      </div>`;
  }

  global.pldLoadContactProfile = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const row = await global.pldFetchContactOne(kind, pid, cid);
    if (!row) {
      window.__pldContactDetailCache = {
        id: cid,
        name: 'Contact',
        title: null,
        email: null,
        phone: null,
        is_primary: false,
        metadata: {},
      };
      if (typeof showToast === 'function') showToast('Could not load contact', 'error');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
      return;
    }
    window.__pldContactDetailCache = row;
    if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
  };

  global.pldSaveContactProfile = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const body = {
      name: document.getElementById('pldCtName')?.value?.trim() || '',
      title: document.getElementById('pldCtTitle')?.value?.trim() || null,
      email: document.getElementById('pldCtEmail')?.value?.trim() || null,
      phone: document.getElementById('pldCtPhone')?.value?.trim() || null,
      is_primary: !!document.getElementById('pldCtPrimary')?.checked,
      personnel_id: document.getElementById('pldCtPersonnelId')?.value?.trim() || null,
    };
    if (!body.name) {
      if (typeof showToast === 'function') showToast('Name is required', 'error');
      return;
    }
    const ok = await global.pldUpdateContact(kind, pid, cid, body);
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  global.pldSaveContactMetaKey = async function (key) {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co) return;
    let md = safeObj(co.metadata);
    if (key !== 'phones' && key !== 'billing_json') return;
    const ok = await global.pldUpdateContact(kind, pid, cid, { metadata: md });
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  global.pldSaveContactPhones = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co) return;
    const md = safeObj(co.metadata);
    const p1 = String(document.getElementById('pldCtPhone1')?.value || '').trim();
    const p1Label = String(document.getElementById('pldCtPhone1Label')?.value || '').trim() || 'Primary';
    const p2 = String(document.getElementById('pldCtPhone2')?.value || '').trim();
    const p2Label = String(document.getElementById('pldCtPhone2Label')?.value || '').trim();
    /** @type {Array<Record<string, unknown>>} */
    const phones = [];
    if (p1) phones.push({ address: p1, e164: null, is_primary: true, label: p1Label });
    if (p2) phones.push({ address: p2, e164: null, is_primary: !p1, label: p2Label || 'Secondary' });
    md.phones = phones;
    const ok = await global.pldUpdateContact(kind, pid, cid, { metadata: md });
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  global.pldSaveContactBilling = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co) return;
    const md = safeObj(co.metadata);
    md.billing = {
      email: String(document.getElementById('pldCtBillingEmail')?.value || '').trim() || null,
      terms: String(document.getElementById('pldCtBillingTerms')?.value || '').trim() || null,
      tax_id: String(document.getElementById('pldCtBillingTaxId')?.value || '').trim() || null,
      po_required: String(document.getElementById('pldCtBillingPoReq')?.value || 'no') === 'yes',
    };
    const ok = await global.pldUpdateContact(kind, pid, cid, { metadata: md });
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  global.pldSaveContactAddresses = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co) return;
    const md = safeObj(co.metadata);
    md.addresses = {
      mailing: document.getElementById('pldCtMail')?.value?.trim() || '',
      shipping: document.getElementById('pldCtShip')?.value?.trim() || '',
    };
    const ok = await global.pldUpdateContact(kind, pid, cid, { metadata: md });
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  global.pldSaveContactSkills = async function () {
    const kind = selectedContactParentKind;
    const pid = selectedContactParentId;
    const cid = selectedContactId;
    const co = window.__pldContactDetailCache;
    if (!co) return;
    const md = safeObj(co.metadata);
    const raw = document.getElementById('pldCtSkills')?.value || '';
    md.skills = raw
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    const ok = await global.pldUpdateContact(kind, pid, cid, { metadata: md });
    if (ok) {
      window.__pldContactDetailCache = ok;
      if (typeof showToast === 'function') showToast('Saved', 'success');
      if (typeof renderPage === 'function') renderPage('contact', { skipModuleDataFetch: true });
    }
  };

  function pldIsPersonnelSelfView() {
    const uid = global.pldAuthGetUserJson && global.pldAuthGetUserJson();
    const pid = uid && uid.personnel_id != null ? String(uid.personnel_id) : '';
    return pid && selectedPersonnelId && String(pid) === String(selectedPersonnelId);
  }

  function personnelNormWorkerClass(v) {
    const s = String(v || '').toLowerCase();
    if (!s) return '';
    if (s.includes('w-2') || s === 'w2') return 'w2';
    if (s.includes('1099') || s.includes('independent')) return 'ic1099';
    if (s.includes('loan') || s.includes('corp-to-corp')) return 'loanout';
    return '';
  }

  function personnelNormFiling(v) {
    const s = String(v || '').toLowerCase();
    if (!s) return '';
    if (s.includes('joint')) return 'mfj';
    if (s.includes('separ')) return 'mfs';
    if (s.includes('head')) return 'hoh';
    if (s === 'single') return 'single';
    return '';
  }

  function personnelDocStatusVal(v) {
    const s = String(v || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (s === 'on_file' || s === 'onfile') return 'on_file';
    if (s === 'expired') return 'expired';
    if (s === 'not_filed' || s === 'notfiled' || s === '') return 'not_filed';
    if (['not_filed', 'on_file', 'expired'].indexOf(s) >= 0) return s;
    return 'not_filed';
  }

  function personnelTaxDocOpts(cur) {
    const c = personnelDocStatusVal(cur);
    const opts = [
      ['not_filed', 'Not filed'],
      ['on_file', 'On file'],
      ['expired', 'Expired'],
    ];
    return opts
      .map(function (x) {
        return '<option value="' + x[0] + '"' + (c === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>';
      })
      .join('');
  }

  function collectPersonnelTaxFromForm() {
    const wc = document.getElementById('ppTaxWorkerClass');
    if (!wc) return null;
    const w4Raw = document.getElementById('ppTaxW4Allow')?.value;
    const adRaw = document.getElementById('ppTaxAddWithhold')?.value;
    return {
      worker_classification: wc.value || '',
      filing_status: document.getElementById('ppTaxFiling')?.value || '',
      tax_id_last4: (document.getElementById('ppTaxIdLast4')?.value || '').trim().slice(0, 4),
      w4_allowances:
        w4Raw === '' || w4Raw == null ? null : Number.isNaN(Number(w4Raw)) ? null : Number(w4Raw),
      state_withholding: document.getElementById('ppTaxState')?.value || '',
      additional_withholding:
        adRaw === '' || adRaw == null ? null : Number.isNaN(Number(adRaw)) ? null : Number(adRaw),
      doc_w4: document.getElementById('ppTaxDocW4')?.value || 'not_filed',
      doc_w9: document.getElementById('ppTaxDocW9')?.value || 'not_filed',
      doc_i9: document.getElementById('ppTaxDocI9')?.value || 'not_filed',
      doc_direct_deposit: document.getElementById('ppTaxDocDd')?.value || 'not_filed',
      doc_nda: document.getElementById('ppTaxDocNda')?.value || 'not_filed',
      corp_name: document.getElementById('ppTaxCorpName')?.value?.trim() || '',
      corp_ein: document.getElementById('ppTaxCorpEin')?.value?.trim() || '',
      corp_address: document.getElementById('ppTaxCorpAddr')?.value?.trim() || '',
    };
  }

  function personnelOnboardingStageLabel(stage) {
    const s = String(stage || '').trim();
    const map = {
      invited: 'Invited',
      collecting_paperwork: 'Collecting paperwork',
      ready: 'Ready',
      active: 'Active',
    };
    return map[s] || (s ? s : '');
  }

  function personnelPaperworkRowHtml(label, statusVal) {
    const v = personnelDocStatusVal(statusVal);
    let cls = 'pld-pp-doc-pill--missing';
    let text = 'Not filed';
    if (v === 'on_file') {
      cls = 'pld-pp-doc-pill--ok';
      text = 'On file';
    } else if (v === 'expired') {
      cls = 'pld-pp-doc-pill--warn';
      text = 'Expired';
    }
    return (
      '<div class="crm-doc-row"><span>' +
      esc(label) +
      '</span><span class="pld-pp-doc-pill ' +
      cls +
      '">' +
      esc(text) +
      '</span></div>'
    );
  }

  function personnelPaperworkSummaryHtml(taxObj) {
    const t = taxObj && typeof taxObj === 'object' && !Array.isArray(taxObj) ? taxObj : {};
    return (
      '<div class="form-section-title" style="margin-top:0;">Paperwork status (from Tax &amp; Legal)</div>' +
      '<div class="crm-doc-list">' +
      personnelPaperworkRowHtml('W-4 (withholding)', t.doc_w4) +
      personnelPaperworkRowHtml('W-9 (taxpayer ID)', t.doc_w9) +
      personnelPaperworkRowHtml('I-9 (eligibility)', t.doc_i9) +
      personnelPaperworkRowHtml('Direct deposit', t.doc_direct_deposit) +
      personnelPaperworkRowHtml('NDA / confidentiality', t.doc_nda) +
      '</div>' +
      '<p class="form-hint" style="margin-top:10px;">These statuses mirror the Tax &amp; Legal tab. Use that tab to update them.</p>'
    );
  }

  function collectPersonnelOnboardingFromForm() {
    const stage = document.getElementById('ppOnbStage') ? String(document.getElementById('ppOnbStage').value || '').trim() : '';
    const notes = document.getElementById('ppOnbNotes') ? String(document.getElementById('ppOnbNotes').value || '').trim() : '';
    const clearedEl = document.getElementById('ppOnbCleared');
    const o = document.getElementById('ppOnbChkOrientation');
    const h = document.getElementById('ppOnbChkHandbook');
    const checklist = {};
    if (o) checklist.orientation_complete = !!o.checked;
    if (h) checklist.handbook_ack = !!h.checked;
    const out = {};
    if (stage) out.stage = stage;
    if (clearedEl) out.cleared_to_work = !!clearedEl.checked;
    if (notes) out.notes = notes;
    if (Object.keys(checklist).length) out.checklist = checklist;
    return out;
  }

  function renderPersonnelAssignmentsTable(rows) {
    if (!rows || !rows.length) {
      return '<p class="pld-pp-assignments-empty" style="color:var(--text-tertiary);margin:0;">No crew assignments found for this person.</p>';
    }
    const header =
      '<thead><tr><th>Event</th><th>Role</th><th>Dates</th><th>Status</th><th></th></tr></thead>';
    const body = rows
      .map(function (a) {
        const eid = a.event_id != null ? String(a.event_id) : '';
        const ename = esc(a.event_name || '—');
        const role = esc(a.role || '—');
        const sd = a.start_date != null ? esc(String(a.start_date).slice(0, 10)) : '—';
        const ed = a.end_date != null ? esc(String(a.end_date).slice(0, 10)) : '—';
        const st = esc(a.status || '—');
        const openBtn = eid
          ? '<button type="button" class="btn btn-ghost btn-sm" onclick="navigateToEvent(\'' +
            attrEsc(eid) +
            "')\">Open</button>"
          : '';
        return (
          '<tr><td>' +
          ename +
          '</td><td>' +
          role +
          '</td><td>' +
          sd +
          ' – ' +
          ed +
          '</td><td>' +
          st +
          '</td><td>' +
          openBtn +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<div class="table-wrap pld-pp-assignments-wrap"><table class="data-table pld-pp-assignments-table">' +
      header +
      '<tbody>' +
      body +
      '</tbody></table></div>'
    );
  }

  global.pldFetchPersonnelProfileAssignments = async function () {
    const pid = typeof selectedPersonnelId !== 'undefined' && selectedPersonnelId ? String(selectedPersonnelId) : '';
    if (!pid || typeof global.pldApiFetch !== 'function') return;
    window.__pldPersonnelAssignmentsCache = {
      personnelId: pid,
      loading: true,
      rows: null,
      error: null,
      meta: null,
    };
    if (typeof renderPage === 'function') renderPage('personnel-profile', { skipModuleDataFetch: true });
    const r = await global.pldApiFetch(
      '/api/v1/assignments/crew?' +
        new URLSearchParams({
          personnel_id: pid,
          sort_by: 'start_date',
          sort_order: 'desc',
          limit: '100',
        }).toString(),
      { method: 'GET' },
    );
    if (!r.ok || !r.body) {
      const msg =
        r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message
          ? String(r.body.errors[0].message)
          : 'Could not load assignments';
      window.__pldPersonnelAssignmentsCache = {
        personnelId: pid,
        loading: false,
        rows: [],
        error: msg,
        meta: null,
      };
    } else {
      window.__pldPersonnelAssignmentsCache = {
        personnelId: pid,
        loading: false,
        rows: Array.isArray(r.body.data) ? r.body.data : [],
        error: null,
        meta: r.body.meta || null,
      };
    }
    if (typeof renderPage === 'function') renderPage('personnel-profile', { skipModuleDataFetch: true });
  };

  function renderPersonnelProfilePage() {
    const id = selectedPersonnelId ? String(selectedPersonnelId) : '';
    const row = window.__pldPersonnelProfileCache;
    if (!row || String(row.id) !== id) {
      if (!window.__pldPersonnelProfileLoading) {
        window.__pldPersonnelProfileLoading = true;
        global
          .pldLoadPersonnelProfile()
          .then(function () {
            window.__pldPersonnelProfileLoading = false;
          })
          .catch(function () {
            window.__pldPersonnelProfileLoading = false;
          });
      }
      return '<div class="crm-profile-page"><p style="padding:24px;color:var(--text-tertiary);">Loading personnel…</p></div>';
    }
    const selfView = pldIsPersonnelSelfView();
    const hideTax = selfView;
    const hideRates = selfView;
    const hideOnboardingEdit = selfView;
    let tab = personnelProfileTab || 'basic';
    if (selfView && (tab === 'rates' || tab === 'tax')) {
      tab = 'basic';
      personnelProfileTab = 'basic';
    }
    const tabsAll = [
      { key: 'basic', label: 'Basic Info' },
      { key: 'contact', label: 'Contact' },
      { key: 'rates', label: 'Rates & Pay' },
      { key: 'tax', label: 'Tax & Legal' },
      { key: 'onboarding', label: 'Onboarding' },
      { key: 'events', label: 'Events' },
      { key: 'additional', label: 'Additional' },
    ];
    const tabDefs = [];
    tabsAll.forEach(function (t) {
      if (t.key === 'tax' && hideTax) return;
      if (t.key === 'rates' && hideRates) return;
      tabDefs.push(t);
    });
    const tabBar = global.pldCrmPersonnelModalTabBarHtml(tab, tabDefs);

    if (tab === 'events') {
      const evC = window.__pldPersonnelAssignmentsCache;
      if (!evC || String(evC.personnelId) !== id) {
        setTimeout(function () {
          if (typeof global.pldFetchPersonnelProfileAssignments === 'function') void global.pldFetchPersonnelProfileAssignments();
        }, 0);
      }
    }

    const md = safeObj(row.metadata);
    const tax = md.tax && typeof md.tax === 'object' && !Array.isArray(md.tax) ? md.tax : {};
    const onb = md.onboarding && typeof md.onboarding === 'object' && !Array.isArray(md.onboarding) ? md.onboarding : {};
    const onbChk = onb.checklist && typeof onb.checklist === 'object' && !Array.isArray(onb.checklist) ? onb.checklist : {};
    const stageVal = String(onb.stage || '');
    const tw = personnelNormWorkerClass(tax.worker_classification);
    const tf = personnelNormFiling(tax.filing_status);
    const stv = String(tax.state_withholding || '');
    const ec = row.emergency_contact && typeof row.emergency_contact === 'object' ? row.emergency_contact : {};
    const photoUrl = row.photo_url ? String(row.photo_url) : '';
    const initials = (
      String(row.first_name || '?').slice(0, 1) + String(row.last_name || '').slice(0, 1)
    ).toUpperCase();
    const showPhotoBtn = typeof window.pldPersonnelProfilePhotoPick === 'function';

    const stateOpts = ['', 'CA', 'NY', 'TX', 'FL', 'NV', 'Other']
      .map(function (st) {
        const lab = st === '' ? 'Select state…' : st;
        const sel = stv === st ? ' selected' : '';
        return '<option value="' + esc(st) + '"' + sel + '>' + esc(lab) + '</option>';
      })
      .join('');

    const innerBasic = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">First name *</label><input type="text" class="form-input" id="ppFn" value="${attrEsc(row.first_name)}" /></div>
            <div class="form-group"><label class="form-label">Last name *</label><input type="text" class="form-input" id="ppLn" value="${attrEsc(row.last_name)}" /></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Role *</label><input type="text" class="form-input" id="ppRole" value="${attrEsc(row.role)}" /></div>
            <div class="form-group"><label class="form-label">Employment</label>
              <select class="form-select" id="ppEt">
                <option value="full_time" ${row.employment_type === 'full_time' ? 'selected' : ''}>Full-time</option>
                <option value="part_time" ${row.employment_type === 'part_time' ? 'selected' : ''}>Part-time</option>
                <option value="freelance" ${row.employment_type === 'freelance' ? 'selected' : ''}>Freelance</option>
                <option value="contractor" ${row.employment_type === 'contractor' ? 'selected' : ''}>Contractor</option>
              </select></div>
          </div>
          <div class="form-group"><label class="form-label">Status</label>
            <select class="form-select" id="ppSt">
              <option value="active" ${row.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${row.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              <option value="on_leave" ${row.status === 'on_leave' ? 'selected' : ''}>On leave</option>
            </select></div>`;

    const innerContact = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="ppEm" value="${attrEsc(row.email)}" /></div>
            <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="ppPh" value="${attrEsc(row.phone || '')}" /></div>
          </div>
          <h4 style="margin:16px 0 8px;font-size:12px;color:var(--text-tertiary);">Emergency</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="ppEcName" value="${attrEsc(ec.name || '')}" /></div>
            <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="ppEcPhone" value="${attrEsc(ec.phone || '')}" /></div>
          </div>`;

    const innerRates = hideRates
      ? '<p style="color:var(--text-tertiary);">Pay and rate details are visible to administrators.</p>'
      : `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Day rate</label><input type="number" class="form-input" id="ppDr" value="${row.day_rate != null ? esc(String(row.day_rate)) : ''}" step="25" /></div>
            <div class="form-group"><label class="form-label">Per diem</label><input type="number" class="form-input" id="ppPd" value="${row.per_diem != null ? esc(String(row.per_diem)) : ''}" step="5" /></div>
          </div>
          <div class="form-group"><label class="form-label">Skills (comma-separated)</label><input type="text" class="form-input" id="ppSk" value="${Array.isArray(row.skills) ? esc(row.skills.join(', ')) : ''}" /></div>`;

    const innerTax = hideTax
      ? '<p style="color:var(--text-tertiary);">Tax and legal details are managed by an administrator.</p>'
      : `
          <p style="font-size:13px;color:var(--text-tertiary);margin:0 0 16px;">Tax and legal records are stored under <code>metadata.tax</code> and merged on save.</p>
          <div class="form-section-title">Tax classification</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Worker classification</label>
              <select class="form-select" id="ppTaxWorkerClass">
                <option value=""${tw === '' ? ' selected' : ''}>Select…</option>
                <option value="w2"${tw === 'w2' ? ' selected' : ''}>W-2 employee</option>
                <option value="ic1099"${tw === 'ic1099' ? ' selected' : ''}>1099 independent contractor</option>
                <option value="loanout"${tw === 'loanout' ? ' selected' : ''}>Loan-out / corp-to-corp</option>
              </select></div>
            <div class="form-group"><label class="form-label">Tax filing status</label>
              <select class="form-select" id="ppTaxFiling">
                <option value=""${tf === '' ? ' selected' : ''}>Select…</option>
                <option value="single"${tf === 'single' ? ' selected' : ''}>Single</option>
                <option value="mfj"${tf === 'mfj' ? ' selected' : ''}>Married filing jointly</option>
                <option value="mfs"${tf === 'mfs' ? ' selected' : ''}>Married filing separately</option>
                <option value="hoh"${tf === 'hoh' ? ' selected' : ''}>Head of household</option>
              </select></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">SSN / Tax ID (last 4)</label>
              <input type="text" class="form-input" id="ppTaxIdLast4" maxlength="4" value="${attrEsc(tax.tax_id_last4 != null ? String(tax.tax_id_last4) : '')}" placeholder="••••" />
              <div class="form-hint">Do not store full SSN here; backend may encrypt last 4 when supported.</div></div>
            <div class="form-group"><label class="form-label">Federal W-4 allowances</label>
              <input type="number" class="form-input" id="ppTaxW4Allow" min="0" value="${tax.w4_allowances != null && tax.w4_allowances !== '' ? esc(String(tax.w4_allowances)) : ''}" placeholder="0" /></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">State tax withholding</label>
              <select class="form-select" id="ppTaxState">${stateOpts}</select></div>
            <div class="form-group"><label class="form-label">Additional withholding ($)</label>
              <input type="number" class="form-input" id="ppTaxAddWithhold" step="1" value="${tax.additional_withholding != null && tax.additional_withholding !== '' ? esc(String(tax.additional_withholding)) : ''}" placeholder="0" /></div>
          </div>
          <div class="form-section-title">Tax documents on file</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="font-size:13px;">W-4 (employee withholding)</span>
              <select class="form-select" id="ppTaxDocW4" style="max-width:180px;">${personnelTaxDocOpts(tax.doc_w4)}</select></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="font-size:13px;">W-9 (taxpayer ID)</span>
              <select class="form-select" id="ppTaxDocW9" style="max-width:180px;">${personnelTaxDocOpts(tax.doc_w9)}</select></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="font-size:13px;">I-9 (employment eligibility)</span>
              <select class="form-select" id="ppTaxDocI9" style="max-width:180px;">${personnelTaxDocOpts(tax.doc_i9)}</select></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="font-size:13px;">Direct deposit authorization</span>
              <select class="form-select" id="ppTaxDocDd" style="max-width:180px;">${personnelTaxDocOpts(tax.doc_direct_deposit)}</select></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="font-size:13px;">NDA / confidentiality</span>
              <select class="form-select" id="ppTaxDocNda" style="max-width:180px;">${personnelTaxDocOpts(tax.doc_nda)}</select></div>
          </div>
          <div class="form-section-title">Loan-out / corporation</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Corporation name</label>
              <input type="text" class="form-input" id="ppTaxCorpName" value="${attrEsc(tax.corp_name != null ? String(tax.corp_name) : '')}" placeholder="e.g. LLC name" /></div>
            <div class="form-group"><label class="form-label">EIN</label>
              <input type="text" class="form-input" id="ppTaxCorpEin" value="${attrEsc(tax.corp_ein != null ? String(tax.corp_ein) : '')}" placeholder="XX-XXXXXXX" /></div>
          </div>
          <div class="form-group"><label class="form-label">Corporation address</label>
            <input type="text" class="form-input" id="ppTaxCorpAddr" value="${attrEsc(tax.corp_address != null ? String(tax.corp_address) : '')}" placeholder="Street, city, state ZIP" /></div>`;

    const onbStageDisp = stageVal ? personnelOnboardingStageLabel(stageVal) : '';
    const innerOnboarding = hideOnboardingEdit
      ? `<div class="crm-profile-panel">${personnelPaperworkSummaryHtml(tax)}<div class="form-section-title">Onboarding</div>
          <div class="crm-profile-meta-grid">
            <div><div class="form-hint">Stage</div><div style="font-size:14px;">${esc(onbStageDisp || '—')}</div></div>
            <div><div class="form-hint">Cleared to work</div><div style="font-size:14px;">${
              onb.cleared_to_work === true ? 'Yes' : onb.cleared_to_work === false ? 'No' : '—'
            }</div></div>
          </div>
          <div class="form-group" style="margin-top:12px;"><div class="form-hint">Notes</div><div style="white-space:pre-wrap;font-size:14px;">${esc(
            onb.notes != null ? String(onb.notes) : '—',
          )}</div></div>
          <div class="form-hint" style="margin-top:8px;">Administrators set onboarding on this tab. Your view is read-only.</div></div>`
      : `<div class="crm-profile-panel">${personnelPaperworkSummaryHtml(tax)}
          <div class="form-section-title">Onboarding</div>
          <p style="font-size:13px;color:var(--text-tertiary);margin:0 0 16px;">Stored under <code>metadata.onboarding</code> and merged on save.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label class="form-label">Stage</label>
              <select class="form-select" id="ppOnbStage">
                <option value=""${stageVal === '' ? ' selected' : ''}>Select…</option>
                <option value="invited"${stageVal === 'invited' ? ' selected' : ''}>Invited</option>
                <option value="collecting_paperwork"${stageVal === 'collecting_paperwork' ? ' selected' : ''}>Collecting paperwork</option>
                <option value="ready"${stageVal === 'ready' ? ' selected' : ''}>Ready</option>
                <option value="active"${stageVal === 'active' ? ' selected' : ''}>Active</option>
              </select></div>
            <div class="form-group"><label class="form-label">Cleared to work</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
                <input type="checkbox" id="ppOnbCleared" ${onb.cleared_to_work === true ? 'checked' : ''} /> OK to assign to events / crew work
              </label></div>
          </div>
          <div class="form-group"><label class="form-label">Notes</label>
            <textarea class="form-textarea" id="ppOnbNotes" rows="3" placeholder="Internal notes">${esc(onb.notes != null ? String(onb.notes) : '')}</textarea></div>
          <div class="form-section-title">Checklist</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
              <input type="checkbox" id="ppOnbChkOrientation" ${onbChk.orientation_complete === true ? 'checked' : ''} /> Orientation complete
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
              <input type="checkbox" id="ppOnbChkHandbook" ${onbChk.handbook_ack === true ? 'checked' : ''} /> Handbook / policy acknowledged
            </label>
          </div></div>`;

    const aCache = window.__pldPersonnelAssignmentsCache;
    let innerEvents = '';
    if (!aCache || String(aCache.personnelId) !== id || aCache.loading) {
      innerEvents =
        '<p style="color:var(--text-tertiary);margin:0;">Loading assignment history…</p>';
    } else if (aCache.error) {
      innerEvents = '<p style="color:var(--accent-amber);margin:0;">' + esc(aCache.error) + '</p>';
    } else {
      innerEvents =
        '<p style="font-size:13px;color:var(--text-tertiary);margin:0 0 12px;">Past and upcoming crew assignments (scheduling module).</p>' +
        renderPersonnelAssignmentsTable(aCache.rows);
    }

    const mdExtra = { ...md };
    delete mdExtra.tax;
    delete mdExtra.onboarding;
    const innerAdditional = `
        <div class="form-group"><label class="form-label">Profile metadata (JSON)</label>
          <textarea class="form-textarea" id="ppMeta" rows="12" style="font-family:ui-monospace,monospace;font-size:12px;">${esc(JSON.stringify(mdExtra, null, 2))}</textarea>
          <div class="form-hint">Use this for custom integration keys. <code>tax</code> and <code>onboarding</code> are saved from their tabs and are not shown here.</div></div>`;

    function ppPanel(key, inner) {
      return (
        '<div class="modal-tab-panel' +
        (tab === key ? ' active' : '') +
        '">' +
        inner +
        '</div>'
      );
    }

    const panels =
      ppPanel('basic', innerBasic) +
      ppPanel('contact', innerContact) +
      ppPanel('rates', innerRates) +
      ppPanel('tax', innerTax) +
      ppPanel('onboarding', innerOnboarding) +
      ppPanel('events', innerEvents) +
      ppPanel('additional', innerAdditional);

    const ver = row.version != null ? Number(row.version) : 1;
    const statusLabel =
      row.status === 'active' ? 'Active' : row.status === 'inactive' ? 'Inactive' : row.status === 'on_leave' ? 'On leave' : String(row.status || '—');
    let heroChips =
      '<span class="pld-pp-chip pld-pp-chip--muted">' +
      esc(statusLabel) +
      '</span>';
    if (onbStageDisp) {
      heroChips += '<span class="pld-pp-chip">' + esc(onbStageDisp) + '</span>';
    }
    if (onb.cleared_to_work === true) {
      heroChips += '<span class="pld-pp-chip pld-pp-chip--ok">Cleared to work</span>';
    } else if (onb.cleared_to_work === false) {
      heroChips += '<span class="pld-pp-chip pld-pp-chip--warn">Not cleared</span>';
    }
    if (aCache && String(aCache.personnelId) === id && !aCache.loading && !aCache.error && Array.isArray(aCache.rows)) {
      const tc = aCache.meta && aCache.meta.total_count != null ? Number(aCache.meta.total_count) : aCache.rows.length;
      if (!Number.isNaN(tc)) {
        heroChips +=
          '<span class="pld-pp-chip pld-pp-chip--muted">' +
          esc(String(tc)) +
          ' assignment' +
          (tc === 1 ? '' : 's') +
          '</span>';
      }
    }
    const photoBlock =
      (photoUrl
        ? `<div class="crm-profile-avatar pld-pp-avatar pld-pp-avatar--with-photo" role="img" aria-label="Profile photo"><span class="pld-pp-avatar-fallback" aria-hidden="true">${esc(initials)}</span><img class="pld-pp-avatar-img" src="${attrEsc(photoUrl)}" alt="" decoding="async" onerror="this.classList.add('is-broken');"></div>`
        : `<div class="crm-profile-avatar pld-pp-avatar">${esc(initials)}</div>`) +
      (showPhotoBtn
        ? `<div class="pld-pp-photo-actions"><input type="file" id="pldPpPhotoIn" accept="image/*" style="display:none" onchange="void window.pldPersonnelProfilePhotoPick(this)"><button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('pldPpPhotoIn').click()">Change photo</button></div>`
        : '');

    return `
      <div class="crm-profile-page personnel-profile-page">
        <input type="hidden" id="ppVer" value="${ver}" />
        <div class="pld-pp-hero">
          ${photoBlock}
          <div class="pld-pp-hero-text">
            <h1 class="page-title" style="margin:0;">${esc(row.first_name + ' ' + row.last_name)}</h1>
            <p class="page-subtitle" style="margin:4px 0 0;">${esc(row.role)}${selfView ? ' · Your profile' : ''}</p>
            <div class="pld-pp-hero-chips">${heroChips}</div>
          </div>
          <div class="page-actions" style="margin-left:auto;align-self:flex-start;">
            <button type="button" class="btn btn-secondary" onclick="navigateTo('personnel')">← Back</button>
            <button type="button" class="btn btn-primary" onclick="void window.pldSavePersonnelProfile()">Save</button>
          </div>
        </div>
        ${tabBar}
        ${panels}
      </div>`;
  }

  global.pldLoadPersonnelProfile = async function () {
    const id = selectedPersonnelId ? String(selectedPersonnelId) : '';
    if (!id || typeof global.pldApiFetch !== 'function') return;
    const r = await global.pldApiFetch('/api/v1/personnel/' + encodeURIComponent(id), { method: 'GET' });
    if (!r.ok || !r.body || !r.body.data) {
      window.__pldPersonnelProfileCache = { id: id, first_name: '', last_name: '', role: '—', version: 1, metadata: {} };
      if (typeof showToast === 'function') showToast('Could not load personnel', 'error');
      if (typeof renderPage === 'function') renderPage('personnel-profile', { skipModuleDataFetch: true });
      return;
    }
    window.__pldPersonnelProfileCache = r.body.data;
    if (typeof renderPage === 'function') renderPage('personnel-profile', { skipModuleDataFetch: true });
  };

  global.pldSavePersonnelProfile = async function () {
    const id = selectedPersonnelId ? String(selectedPersonnelId) : '';
    const row = window.__pldPersonnelProfileCache;
    if (!id || !row || typeof global.pldApiFetch !== 'function') return;
    const version = Number(document.getElementById('ppVer')?.value || row.version || 1);
    const payload = { version };
    const fn = document.getElementById('ppFn')?.value?.trim();
    const ln = document.getElementById('ppLn')?.value?.trim();
    if (fn) payload.first_name = fn;
    if (ln) payload.last_name = ln;
    if (document.getElementById('ppRole')) payload.role = document.getElementById('ppRole').value.trim();
    if (document.getElementById('ppEt')) payload.employment_type = document.getElementById('ppEt').value;
    if (document.getElementById('ppSt')) payload.status = document.getElementById('ppSt').value;
    if (document.getElementById('ppEm')) payload.email = document.getElementById('ppEm').value.trim();
    if (document.getElementById('ppPh')) payload.phone = document.getElementById('ppPh').value.trim() || null;
    if (!pldIsPersonnelSelfView()) {
      if (document.getElementById('ppDr')) {
        const n = Number(document.getElementById('ppDr').value);
        if (!Number.isNaN(n)) payload.day_rate = n;
      }
      if (document.getElementById('ppPd')) {
        const n = Number(document.getElementById('ppPd').value);
        if (!Number.isNaN(n)) payload.per_diem = n;
      }
      if (document.getElementById('ppSk')) {
        const raw = document.getElementById('ppSk').value || '';
        payload.skills = raw
          .split(',')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
      }
    }
    const ecName = document.getElementById('ppEcName')?.value?.trim();
    const ecPhone = document.getElementById('ppEcPhone')?.value?.trim();
    if (ecName !== undefined || ecPhone !== undefined) {
      payload.emergency_contact = { name: ecName || null, phone: ecPhone || null };
    }
    const hasMetaEditor = !!document.getElementById('ppMeta');
    const hasTaxForm = !!document.getElementById('ppTaxWorkerClass');
    if (hasMetaEditor || (hasTaxForm && !pldIsPersonnelSelfView())) {
      const metadataOut = { ...safeObj(row.metadata) };
      if (hasMetaEditor) {
        try {
          const parsed = JSON.parse(document.getElementById('ppMeta').value || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            Object.assign(metadataOut, parsed);
          }
        } catch (e) {
          if (typeof showToast === 'function') showToast('Invalid metadata JSON', 'error');
          return;
        }
      }
      if (hasTaxForm && !pldIsPersonnelSelfView()) {
        metadataOut.tax = collectPersonnelTaxFromForm();
      }
      payload.metadata = metadataOut;
    }
    const res = await global.pldApiFetch('/api/v1/personnel/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      if (typeof showToast === 'function') showToast(msg || 'Save failed', 'error');
      return;
    }
    window.__pldPersonnelProfileCache = res.body.data;
    if (typeof showToast === 'function') showToast('Saved', 'success');
    if (typeof fetchPersonnelFromApiIfConfigured === 'function') {
      await fetchPersonnelFromApiIfConfigured();
    }
    if (typeof renderPage === 'function') renderPage('personnel-profile', { skipModuleDataFetch: true });
  };

  global.renderClientProfilePage = renderClientProfilePage;
  global.renderVendorProfilePage = renderVendorProfilePage;
  global.renderVenueProfilePage = renderVenueProfilePage;
  global.renderPersonnelProfilePage = renderPersonnelProfilePage;
})(typeof window !== 'undefined' ? window : globalThis);
