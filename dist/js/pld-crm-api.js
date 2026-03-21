/* ============================================
   CRM + workforce API helpers (contacts, vendors, me, time, pay)
   Depends on: pld-api.js
   ============================================ */
(function (global) {
  function errMsg(res) {
    const e = res && res.body && res.body.errors && res.body.errors[0];
    return e && e.message ? String(e.message) : 'Request failed';
  }

  function contactsBase(kind, parentId) {
    const id = encodeURIComponent(parentId);
    if (kind === 'client') return '/api/v1/clients/' + id + '/contacts';
    if (kind === 'venue') return '/api/v1/venues/' + id + '/contacts';
    if (kind === 'vendor') return '/api/v1/vendors/' + id + '/contacts';
    throw new Error('contactsBase: kind must be client|venue|vendor');
  }

  /**
   * @param {'client'|'venue'|'vendor'} kind
   * @param {string} parentId
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  global.pldListContactsForParent = async function (kind, parentId) {
    if (typeof global.pldApiFetch !== 'function') return [];
    const res = await global.pldApiFetch(contactsBase(kind, parentId), { method: 'GET' });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return [];
    }
    const d = res.body && res.body.data;
    return Array.isArray(d) ? d : [];
  };

  global.pldCreateContact = async function (kind, parentId, body) {
    const res = await global.pldApiFetch(contactsBase(kind, parentId), {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldUpdateContact = async function (kind, parentId, contactId, body) {
    const res = await global.pldApiFetch(
      contactsBase(kind, parentId) + '/' + encodeURIComponent(contactId),
      { method: 'PUT', body: JSON.stringify(body) },
    );
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldDeleteContact = async function (kind, parentId, contactId) {
    const res = await global.pldApiFetch(
      contactsBase(kind, parentId) + '/' + encodeURIComponent(contactId),
      { method: 'DELETE' },
    );
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return false;
    }
    return true;
  };

  /** @param {string} [search]
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  global.pldListVendorsFromApi = async function (search) {
    if (typeof global.pldApiFetch !== 'function') return [];
    const q = new URLSearchParams({ limit: '200' });
    const term = search != null ? String(search).trim() : '';
    if (term) q.set('search', term);
    const res = await global.pldApiFetch('/api/v1/vendors?' + q.toString(), { method: 'GET' });
    if (!res.ok) return [];
    const d = res.body && res.body.data;
    return Array.isArray(d) ? d : [];
  };

  global.pldCreateVendorViaApi = async function (payload) {
    const res = await global.pldApiFetch('/api/v1/vendors', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldUpdateVendorViaApi = async function (vendorId, body) {
    const res = await global.pldApiFetch('/api/v1/vendors/' + encodeURIComponent(vendorId), {
      method: 'PUT',
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldDeleteVendorViaApi = async function (vendorId) {
    const res = await global.pldApiFetch('/api/v1/vendors/' + encodeURIComponent(vendorId), {
      method: 'DELETE',
    });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return false;
    }
    return true;
  };

  global.pldUpdateVendorLinkedClient = async function (vendorId, linkedClientId) {
    return global.pldUpdateVendorViaApi(vendorId, { linked_client_id: linkedClientId || null });
  };

  global.pldFetchMeCrewAssignments = async function (query) {
    if (typeof global.pldApiFetch !== 'function') return null;
    const q = new URLSearchParams(query || {});
    const path = '/api/v1/me/crew-assignments' + (q.toString() ? '?' + q.toString() : '');
    const res = await global.pldApiFetch(path, { method: 'GET' });
    if (!res.ok) return null;
    return res.body;
  };

  global.pldTimeClockIn = async function (body) {
    const res = await global.pldApiFetch('/api/v1/time/clock-in', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldTimeClockOut = async function () {
    const res = await global.pldApiFetch('/api/v1/time/clock-out', { method: 'POST', body: '{}' });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldTimeListEntries = async function () {
    const res = await global.pldApiFetch('/api/v1/time/entries?limit=50', { method: 'GET' });
    if (!res.ok) return [];
    const d = res.body && res.body.data;
    return Array.isArray(d) ? d : [];
  };

  global.pldPayPeriodsList = async function () {
    const res = await global.pldApiFetch('/api/v1/pay-periods?limit=50', { method: 'GET' });
    if (!res.ok) return [];
    const d = res.body && res.body.data;
    return Array.isArray(d) ? d : [];
  };

  global.pldPayPeriodCreate = async function (body) {
    const res = await global.pldApiFetch('/api/v1/pay-periods', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };

  global.pldPayrollExportStub = async function () {
    const res = await global.pldApiFetch('/api/v1/payroll/export', { method: 'GET' });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast(errMsg(res), 'error');
      return null;
    }
    return res.body && res.body.data ? res.body.data : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
