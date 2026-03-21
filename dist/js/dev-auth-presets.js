/* ============================================
   Dev-only: quick account switch + login presets (localhost).
   Password for all presets matches migration 018 / seed-postgres (`pld`).
   Disable: window.PLD_DISABLE_DEV_AUTH_TOOLS = true, or non-localhost host.
   ============================================ */

(function () {
  var DEV_PW = 'pld';

  function pldIsLocalDevHost() {
    try {
      var h = String(location.hostname || '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '';
    } catch (_) {
      return false;
    }
  }

  /** @returns {boolean} */
  window.pldDevAuthToolsEnabled = function pldDevAuthToolsEnabled() {
    if (typeof window !== 'undefined' && window.PLD_DISABLE_DEV_AUTH_TOOLS) return false;
    return pldIsLocalDevHost();
  };

  /**
   * Keep in sync with database/migrations/018_dev_auth_fixtures.sql and docs/bootstrap-dev-identity.md
   * @returns {{ id: string, label: string, tenant_slug: string, email: string }[]}
   */
  window.pldDevAuthPresets = function pldDevAuthPresets() {
    return [
      { id: 'demo-admin', label: 'Demo · admin', tenant_slug: 'demo', email: 'admin@demo.local' },
      { id: 'demo-manager', label: 'Demo · manager', tenant_slug: 'demo', email: 'manager@demo.local' },
      { id: 'demo-coordinator', label: 'Demo · coordinator', tenant_slug: 'demo', email: 'coordinator@demo.local' },
      { id: 'demo-viewer', label: 'Demo · viewer', tenant_slug: 'demo', email: 'viewer@demo.local' },
      { id: 'test-admin', label: 'Test · admin', tenant_slug: 'test', email: 'testtenant@testtenant.com' },
      { id: 'test-manager', label: 'Test · manager', tenant_slug: 'test', email: 'manager@testtenant.com' },
      { id: 'test-viewer', label: 'Test · viewer', tenant_slug: 'test', email: 'viewer@testtenant.com' },
    ];
  };

  function presetById(id) {
    var list = window.pldDevAuthPresets();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  window.pldDevAuthLoginChipsHtml = function pldDevAuthLoginChipsHtml() {
    if (!window.pldDevAuthToolsEnabled()) return '';
    var list = window.pldDevAuthPresets();
    var chips = list
      .map(function (p) {
        return (
          '<button type="button" class="btn btn-ghost btn-sm pld-dev-auth-chip" onclick="void window.pldDevAuthQuickLoginFromPreset(\'' +
          escapeAttr(p.id) +
          '\')">' +
          escapeAttr(p.label) +
          '</button>'
        );
      })
      .join('');
    return (
      '<div class="pld-dev-auth-chips-wrap" role="group" aria-label="Dev quick sign-in">' +
      '<p style="margin:16px 0 8px;font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">Dev quick sign-in</p>' +
      '<div class="pld-dev-auth-chips">' +
      chips +
      '</div></div>'
    );
  };

  window.pldDevAuthQuickLoginFromPreset = async function pldDevAuthQuickLoginFromPreset(presetId) {
    if (!window.pldDevAuthToolsEnabled()) return;
    var p = presetById(presetId);
    if (!p || typeof window.pldAuthLoginWithCredentials !== 'function') return;
    var tenantEl = document.getElementById('authLoginTenant');
    var emailEl = document.getElementById('authLoginEmail');
    var pwEl = document.getElementById('authLoginPassword');
    if (tenantEl) tenantEl.value = p.tenant_slug;
    if (emailEl) emailEl.value = p.email;
    if (pwEl) pwEl.value = DEV_PW;
    var res = await window.pldAuthLoginWithCredentials(p.tenant_slug, p.email, DEV_PW, {
      showErrorEl: document.getElementById('authLoginErr'),
    });
    if (res.ok) {
      try {
        localStorage.setItem('pld_dev_last_preset', presetId);
      } catch (_) {}
      if (typeof showToast === 'function') showToast('Signed in', 'success');
    }
  };

  window.pldDevAuthSwitchToPreset = async function pldDevAuthSwitchToPreset(presetId) {
    if (!window.pldDevAuthToolsEnabled()) return;
    var p = presetById(presetId);
    if (!p || typeof window.pldAuthLoginWithCredentials !== 'function') return;
    if (typeof window.pldPresenceStop === 'function') window.pldPresenceStop();
    try {
      if (typeof window.pldAuthLogoutRemote === 'function') await window.pldAuthLogoutRemote();
    } catch (e) {
      void e;
    }
    if (typeof window.pldAuthClearSession === 'function') window.pldAuthClearSession();
    if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
    var res = await window.pldAuthLoginWithCredentials(p.tenant_slug, p.email, DEV_PW, {
      navigateToDashboard: true,
    });
    if (res.ok) {
      try {
        localStorage.setItem('pld_dev_last_preset', presetId);
      } catch (_) {}
      if (typeof showToast === 'function') showToast('Switched to ' + p.label, 'success');
    } else if (typeof showToast === 'function') {
      showToast(res.message || 'Sign in failed', 'error');
    }
  };

  window.pldDevAuthBindTopBarSelect = function pldDevAuthBindTopBarSelect() {
    var sel = document.getElementById('pldDevAuthPresetSelect');
    if (!sel) return;
    sel.addEventListener('change', function () {
      var v = sel.value;
      sel.value = '';
      if (v) void window.pldDevAuthSwitchToPreset(v);
    });
  };

  window.pldDevAuthTopBarSelectHtml = function pldDevAuthTopBarSelectHtml() {
    if (!window.pldDevAuthToolsEnabled()) return '';
    var list = window.pldDevAuthPresets();
    var opts =
      '<option value="">Dev users…</option>' +
      list
        .map(function (p) {
          return '<option value="' + escapeAttr(p.id) + '">' + escapeAttr(p.label) + '</option>';
        })
        .join('');
    return (
      '<label class="pld-dev-auth-select-wrap" title="Dev only — quick switch (same password: pld)">' +
      '<span class="sr-only">Dev quick switch</span>' +
      '<select id="pldDevAuthPresetSelect" class="pld-dev-auth-select" aria-label="Dev quick switch user">' +
      opts +
      '</select></label>'
    );
  };

  /** One-shot auto sign-in from localStorage (localhost only). */
  window.pldDevAuthMaybeAutoLogin = async function pldDevAuthMaybeAutoLogin() {
    if (!window.pldDevAuthToolsEnabled()) return;
    if (typeof window.pldAuthGetAccessToken === 'function' && window.pldAuthGetAccessToken()) return;
    if (sessionStorage.getItem('pld_dev_auto_login_attempted')) return;
    var id = localStorage.getItem('pld_dev_last_preset');
    if (!id) return;
    sessionStorage.setItem('pld_dev_auto_login_attempted', '1');
    var p = presetById(id);
    if (!p || typeof window.pldAuthLoginWithCredentials !== 'function') return;
    var res = await window.pldAuthLoginWithCredentials(p.tenant_slug, p.email, DEV_PW, {
      navigateToDashboard: false,
    });
    if (res.ok) {
      if (typeof navigateTo === 'function') navigateTo('dashboard');
      if (typeof showToast === 'function') showToast('Dev auto sign-in', 'success');
    }
  };
})();
