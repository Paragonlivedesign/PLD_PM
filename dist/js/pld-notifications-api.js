/* In-app notifications REST */
(function (global) {
  function applyBadge() {
    if (typeof global.pldUpdateNotificationBadge === 'function') global.pldUpdateNotificationBadge();
  }

  /** Show topbar dot only when unread_count > 0 (from API meta or row scan). */
  global.pldUpdateNotificationBadge = function pldUpdateNotificationBadge() {
    const dot =
      typeof document !== 'undefined' ? document.getElementById('notificationUnreadDot') : null;
    if (!dot) return;
    const st = global.__pldNotificationApi;
    if (!st || st.error) {
      dot.hidden = true;
      dot.setAttribute('aria-hidden', 'true');
      return;
    }
    let unread = 0;
    if (typeof st.unread === 'number' && !Number.isNaN(st.unread)) {
      unread = Math.max(0, st.unread);
    } else if (Array.isArray(st.rows)) {
      for (let i = 0; i < st.rows.length; i++) {
        if (st.rows[i] && st.rows[i].read_at == null) unread++;
      }
    }
    const show = unread > 0;
    dot.hidden = !show;
    dot.setAttribute('aria-hidden', show ? 'false' : 'true');
  };

  global.pldPrefetchNotifications = async function pldPrefetchNotifications() {
    if (typeof global.pldApiFetch !== 'function') {
      global.__pldNotificationApi = { error: true };
      applyBadge();
      return;
    }
    const r = await global.pldApiFetch('/api/v1/notifications?limit=12&status=all&sort_order=desc');
    if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) {
      global.__pldNotificationApi = { error: true };
      applyBadge();
      return;
    }
    const meta = r.body.meta && typeof r.body.meta === 'object' ? r.body.meta : {};
    const uc = meta.unread_count;
    global.__pldNotificationApi = {
      rows: r.body.data || [],
      unread: typeof uc === 'number' && !Number.isNaN(uc) ? uc : undefined,
    };
    applyBadge();
  };

  /** @returns {Promise<boolean>} */
  global.pldMarkAllNotificationsReadViaApi = async function pldMarkAllNotificationsReadViaApi() {
    if (typeof global.pldApiFetch !== 'function') return false;
    const r = await global.pldApiFetch('/api/v1/notifications/read-all', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const errs = r.body && r.body.errors;
    return !!(r.ok && r.body && (!errs || !errs.length));
  };

  /**
   * Loads GET /api/v1/notifications/preferences into window.__pldNotificationPrefsRaw
   * and calls renderPage('settings') when done.
   */
  global.pldLoadNotificationPreferencesForSettings =
    async function pldLoadNotificationPreferencesForSettings() {
      if (typeof global.pldApiFetch !== 'function') {
        global.__pldNotificationPrefsRaw = [];
        global.__pldNotificationPrefsLoading = false;
        global.__pldNotificationPrefsLoadError = true;
        if (typeof global.renderPage === 'function') global.renderPage('settings');
        return;
      }
      const r = await global.pldApiFetch('/api/v1/notifications/preferences', { method: 'GET' });
      global.__pldNotificationPrefsLoading = false;
      if (r.ok && r.body && Array.isArray(r.body.data)) {
        global.__pldNotificationPrefsRaw = r.body.data;
        global.__pldNotificationPrefsLoadError = false;
      } else {
        global.__pldNotificationPrefsRaw = [];
        global.__pldNotificationPrefsLoadError = true;
      }
      if (typeof global.renderPage === 'function') global.renderPage('settings');
    };

  /**
   * @param {HTMLElement} el toggle element
   * @param {string} notificationType e.g. phase_transition
   * @param {'email'|'push'|'slack'} uiChannel push maps to in_app
   */
  global.pldNotificationPrefToggle = async function pldNotificationPrefToggle(
    el,
    notificationType,
    uiChannel,
  ) {
    const apiChannel = uiChannel === 'push' ? 'in_app' : uiChannel;
    const nextEnabled = !el.classList.contains('active');
    el.classList.toggle('active', nextEnabled);
    if (typeof global.pldApiFetch !== 'function') {
      if (typeof global.showToast === 'function') {
        global.showToast('API not configured — preference not saved', 'warning');
      }
      return;
    }
    const r = await global.pldApiFetch('/api/v1/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: [
          { notification_type: notificationType, channel: apiChannel, enabled: nextEnabled },
        ],
      }),
    });
    if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) {
      el.classList.toggle('active', !nextEnabled);
      const msg =
        r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message;
      if (typeof global.showToast === 'function') {
        global.showToast(msg || 'Could not save preference', 'error');
      }
      return;
    }
    if (Array.isArray(r.body.data)) {
      global.__pldNotificationPrefsRaw = r.body.data;
    }
    if (typeof global.showToast === 'function') {
      global.showToast('Preference saved', 'success');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
