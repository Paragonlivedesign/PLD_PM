/* ============================================
   PLD REST API client (PostgreSQL backend)
   Set window.PLD_API_BASE (e.g. http://127.0.0.1:3000) to enable.
   With JWT session (pld-auth-session.js): Bearer + refresh on 401.
   ============================================ */

(function () {
  const meta = document.querySelector('meta[name="pld-api-base"]');
  if (meta && meta.getAttribute('content')) {
    window.PLD_API_BASE = meta.getAttribute('content').trim();
  }
  if (typeof window.PLD_API_BASE !== 'string') {
    window.PLD_API_BASE = '';
  }
  /** Empty string = same-origin (use with Vite proxy to backend). */
  if (typeof window.PLD_TENANT_ID !== 'string') {
    window.PLD_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  }
  if (typeof window.PLD_USER_ID !== 'string') {
    window.PLD_USER_ID = '00000000-0000-0000-0000-000000000002';
  }

  function buildUrl(path) {
    const base = window.PLD_API_BASE;
    return path.startsWith('http')
      ? path
      : (base === '' ? '' : base.replace(/\/$/, '')) + path;
  }

  function applyAuthHeaders(headers) {
    headers.set('Content-Type', 'application/json');
    var access =
      typeof window.pldAuthGetAccessToken === 'function'
        ? window.pldAuthGetAccessToken()
        : '';
    if (access) {
      headers.set('Authorization', 'Bearer ' + access);
      var tid =
        typeof window.pldAuthGetTenantIdFromToken === 'function'
          ? window.pldAuthGetTenantIdFromToken()
          : '';
      if (tid) headers.set('X-Tenant-Id', tid);
    } else {
      headers.set('X-Tenant-Id', window.PLD_TENANT_ID);
      headers.set('X-User-Id', window.PLD_USER_ID);
      headers.set('X-Permissions', '*');
    }
  }

  /**
   * @param {string} path e.g. /api/v1/events
   * @param {RequestInit} [options]
   * @param {boolean} [_retry]
   */
  window.pldApiFetch = async function pldApiFetch(path, options, _retry) {
    const headers = new Headers(options?.headers);
    applyAuthHeaders(headers);
    const hadBearer = !!(
      typeof window.pldAuthGetAccessToken === 'function' && window.pldAuthGetAccessToken()
    );
    const url = buildUrl(path);
    const r = await fetch(url, { ...options, headers, credentials: 'include' });
    let body = null;
    try {
      body = await r.json();
    } catch {
      body = { errors: [{ code: 'parse', message: 'Invalid JSON' }] };
    }
    if (r.status === 401 && hadBearer && !_retry && typeof window.pldAuthTryRefresh === 'function') {
      var nextTok = await window.pldAuthTryRefresh();
      if (nextTok) return pldApiFetch(path, options, true);
      /* Refresh failed and usually cleared session — retry once with dev headers (no Bearer). */
      if (
        typeof window.pldAuthGetAccessToken === 'function' &&
        !window.pldAuthGetAccessToken()
      ) {
        return pldApiFetch(path, options, true);
      }
    }
    /** JWT tenant no longer in DB (e.g. DB reset) — clear session and retry once with dev headers. */
    if (r.status === 403 && hadBearer && !_retry) {
      var err0 = body && body.errors && body.errors[0];
      if (err0 && err0.code === 'TENANT_FORBIDDEN') {
        if (typeof window.pldAuthClearSession === 'function') window.pldAuthClearSession();
        if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
        if (typeof window.pldApplySessionIdentityChrome === 'function') window.pldApplySessionIdentityChrome();
        if (typeof window.pldRefreshPlatformAdminNav === 'function') void window.pldRefreshPlatformAdminNav();
        return pldApiFetch(path, options, true);
      }
    }
    return { ok: r.ok, status: r.status, body };
  };

  /**
   * Multipart / FormData — do not set Content-Type (browser sets boundary).
   * @param {string} path
   * @param {FormData} formData
   * @param {RequestInit} [options]
   * @param {boolean} [_retry]
   */
  window.pldApiFormFetch = async function pldApiFormFetch(path, formData, options, _retry) {
    const headers = new Headers(options?.headers);
    var access =
      typeof window.pldAuthGetAccessToken === 'function'
        ? window.pldAuthGetAccessToken()
        : '';
    if (access) {
      headers.set('Authorization', 'Bearer ' + access);
      var tid =
        typeof window.pldAuthGetTenantIdFromToken === 'function'
          ? window.pldAuthGetTenantIdFromToken()
          : '';
      if (tid) headers.set('X-Tenant-Id', tid);
    } else {
      headers.set('X-Tenant-Id', window.PLD_TENANT_ID);
      headers.set('X-User-Id', window.PLD_USER_ID);
      headers.set('X-Permissions', '*');
    }
    const hadBearer = !!access;
    const url = buildUrl(path);
    const r = await fetch(url, {
      ...options,
      method: options?.method || 'POST',
      body: formData,
      headers,
      credentials: 'include',
    });
    let body = null;
    try {
      body = await r.json();
    } catch {
      body = { errors: [{ code: 'parse', message: 'Invalid JSON' }] };
    }
    if (r.status === 401 && hadBearer && !_retry && typeof window.pldAuthTryRefresh === 'function') {
      var nextTok = await window.pldAuthTryRefresh();
      if (nextTok) return pldApiFormFetch(path, formData, options, true);
      if (
        typeof window.pldAuthGetAccessToken === 'function' &&
        !window.pldAuthGetAccessToken()
      ) {
        return pldApiFormFetch(path, formData, options, true);
      }
    }
    return { ok: r.ok, status: r.status, body };
  };
})();
