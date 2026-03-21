/* ============================================
   Auth session (JWT + refresh) for PLD REST API
   Loaded before pld-api.js
   ============================================ */
(function () {
  const KEY_ACCESS = 'pld_access_token';
  const KEY_REFRESH = 'pld_refresh_token';
  const KEY_USER = 'pld_auth_user';

  function apiBasePrefix() {
    const base = typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE : '';
    return base === '' ? '' : base.replace(/\/$/, '');
  }

  function decodeJwtPart(token, key) {
    try {
      const part = token.split('.')[1];
      if (!part) return '';
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(b64));
      return json[key] || '';
    } catch (_) {
      return '';
    }
  }

  window.pldAuthGetAccessToken = function () {
    try {
      return localStorage.getItem(KEY_ACCESS) || '';
    } catch (_) {
      return '';
    }
  };

  window.pldAuthGetTenantIdFromToken = function () {
    const t = window.pldAuthGetAccessToken();
    return t ? decodeJwtPart(t, 'tid') : '';
  };

  window.pldAuthSaveLoginPayload = function (data) {
    try {
      if (data.access_token) localStorage.setItem(KEY_ACCESS, data.access_token);
      if (data.refresh_token) localStorage.setItem(KEY_REFRESH, data.refresh_token);
      if (data.user) localStorage.setItem(KEY_USER, JSON.stringify(data.user));
    } catch (_) {}
  };

  window.pldAuthClearSession = function () {
    try {
      localStorage.removeItem(KEY_ACCESS);
      localStorage.removeItem(KEY_REFRESH);
      localStorage.removeItem(KEY_USER);
    } catch (_) {}
  };

  window.pldAuthGetUserJson = function () {
    try {
      const raw = localStorage.getItem(KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  var refreshPromise = null;

  /** @returns {Promise<string|null>} new access token or null */
  window.pldAuthTryRefresh = async function pldAuthTryRefresh() {
    if (refreshPromise) return refreshPromise;
    var rt = '';
    try {
      rt = localStorage.getItem(KEY_REFRESH) || '';
    } catch (_) {}
    if (!rt) return null;

    refreshPromise = (async function () {
      const url = apiBasePrefix() + '/api/v1/auth/refresh';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
        credentials: 'include',
      });
      var body = null;
      try {
        body = await r.json();
      } catch (_) {
        body = {};
      }
      if (!r.ok || !body.data || !body.data.access_token) {
        window.pldAuthClearSession();
        return null;
      }
      try {
        localStorage.setItem(KEY_ACCESS, body.data.access_token);
        if (body.data.refresh_token) localStorage.setItem(KEY_REFRESH, body.data.refresh_token);
      } catch (_) {}
      return body.data.access_token;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  };

  /** @returns {boolean} */
  window.pldHasApiPermission = function (perm) {
    var u = window.pldAuthGetUserJson();
    if (!u || !u.permissions) return false;
    if (u.permissions.indexOf('*') >= 0) return true;
    return u.permissions.indexOf(perm) >= 0;
  };

  window.pldAuthLogoutRemote = async function pldAuthLogoutRemote() {
    var rt = '';
    var at = '';
    try {
      rt = localStorage.getItem(KEY_REFRESH) || '';
      at = localStorage.getItem(KEY_ACCESS) || '';
    } catch (_) {}
    if (rt && at) {
      try {
        await fetch(apiBasePrefix() + '/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + at,
          },
          body: JSON.stringify({ refresh_token: rt }),
          credentials: 'include',
        });
      } catch (_) {}
    }
    window.pldAuthClearSession();
  };
})();
