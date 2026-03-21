/* ============================================
   Auth UI pages (login, reset, invite, account)
   Depends on: navigation.js, router.js, pld-api.js, pld-auth-session.js
   ============================================ */

function pldAuthCard(inner) {
  return `
    <div class="auth-page-wrap" style="max-width:420px;margin:48px auto;padding:0 16px;">
      <div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:12px;padding:28px;">
        ${inner}
      </div>
    </div>
  `;
}

function renderAuthLogin() {
  const hasToken =
    typeof window.pldAuthGetAccessToken === 'function' && window.pldAuthGetAccessToken();
  if (hasToken) {
    return pldAuthCard(`
      <h2 style="margin:0 0 8px;font-size:20px;">Already signed in</h2>
      <p style="margin:0 0 20px;font-size:13px;color:var(--text-tertiary);">Your API session is active. Use the top bar to confirm status.</p>
      <button type="button" class="btn btn-primary" style="width:100%;" onclick="navigateTo('dashboard')">Go to dashboard</button>
    `);
  }

  const apiConnectedNoJwt =
    typeof window !== 'undefined' &&
    window.PLD_DATA_FROM_REST &&
    typeof window.PLD_API_BASE === 'string' &&
    window.PLD_API_BASE.trim() !== '';

  const connectedHint = apiConnectedNoJwt
    ? `<p style="margin:0 0 16px;padding:10px 12px;font-size:12px;line-height:1.45;color:var(--text-secondary);background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:8px;">The app is already <strong>connected to the API</strong> (catalog loaded). Signing in below adds a <strong>JWT session</strong> for actions that require a logged-in user.</p>`
    : '';

  return pldAuthCard(`
    <h2 style="margin:0 0 8px;font-size:20px;">Sign in</h2>
    <p style="margin:0 0 20px;font-size:13px;color:var(--text-tertiary);">Use your PLD API account (PostgreSQL backend).</p>
    ${connectedHint}
    <div id="authLoginErr" class="hidden" style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;font-size:13px;color:var(--accent-red);"></div>
    <div class="form-group">
      <label class="form-label">Tenant slug</label>
      <input type="text" class="form-input" id="authLoginTenant" value="demo" autocomplete="organization" />
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="form-input" id="authLoginEmail" value="admin@demo.local" autocomplete="username" />
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" class="form-input" id="authLoginPassword" value="" autocomplete="current-password" placeholder="pld (dev seed)" />
    </div>
    <button type="button" class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="submitAuthLogin()">Sign in</button>
    ${typeof window.pldDevAuthLoginChipsHtml === 'function' ? window.pldDevAuthLoginChipsHtml() : ''}
    <p style="margin:16px 0 0;font-size:12px;text-align:center;">
      <a href="javascript:void(0)" onclick="navigateTo('forgot-password');return false;">Forgot password?</a>
    </p>
  `);
}

/**
 * POST /api/v1/auth/login — shared by manual sign-in and dev quick-switch.
 * @param {string} tenant_slug
 * @param {string} email
 * @param {string} password
 * @param {{ showErrorEl?: HTMLElement|null, navigateToDashboard?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
window.pldAuthLoginWithCredentials = async function pldAuthLoginWithCredentials(tenant_slug, email, password, opts) {
  opts = opts || {};
  var showEl = opts.showErrorEl || null;
  if (showEl) {
    showEl.classList.add('hidden');
    showEl.textContent = '';
  }
  var base = typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.replace(/\/$/, '') : '';
  var url = (base === '' ? '' : base) + '/api/v1/auth/login';
  try {
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, tenant_slug: tenant_slug }),
      credentials: 'include',
    });
    var body = await r.json().catch(function () {
      return {};
    });
    if (!r.ok || !body.data) {
      var msg =
        (body.errors && body.errors[0] && body.errors[0].message) || 'Sign in failed';
      if (r.status === 503 || /not configured/i.test(msg)) {
        msg +=
          ' Set JWT_SECRET in the repo root .env (copy from .env.example), then restart the API.';
      }
      if (showEl) {
        showEl.textContent = msg;
        showEl.classList.remove('hidden');
      }
      return { ok: false, message: msg };
    }
    if (typeof window.pldAuthSaveLoginPayload === 'function') {
      window.pldAuthSaveLoginPayload(body.data);
    }
    if (typeof window.pldRefreshTenantShell === 'function') await window.pldRefreshTenantShell();
    if (typeof window.pldRehydrateCatalogAfterTenantContextChange === 'function') {
      await window.pldRehydrateCatalogAfterTenantContextChange();
    }
    if (typeof window.pldApplySessionIdentityChrome === 'function') window.pldApplySessionIdentityChrome();
    if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
    if (typeof window.pldRefreshPlatformAdminNav === 'function') void window.pldRefreshPlatformAdminNav();
    if (typeof window.pldPresenceRestart === 'function') window.pldPresenceRestart();
    if (opts.navigateToDashboard !== false && typeof navigateTo === 'function') navigateTo('dashboard');
    return { ok: true };
  } catch (e) {
    var net = 'Network error — is the API running?';
    if (showEl) {
      showEl.textContent = net;
      showEl.classList.remove('hidden');
    }
    return { ok: false, message: net };
  }
};

async function submitAuthLogin() {
  var err = document.getElementById('authLoginErr');
  var tenant = (document.getElementById('authLoginTenant') && document.getElementById('authLoginTenant').value) || 'demo';
  var email = (document.getElementById('authLoginEmail') && document.getElementById('authLoginEmail').value) || '';
  var password = (document.getElementById('authLoginPassword') && document.getElementById('authLoginPassword').value) || '';
  var res = await window.pldAuthLoginWithCredentials(tenant, email, password, { showErrorEl: err });
  if (res.ok && typeof showToast === 'function') showToast('Signed in', 'success');
}

function renderAuthForgotPassword() {
  return pldAuthCard(`
    <h2 style="margin:0 0 8px;font-size:20px;">Reset password</h2>
    <p style="margin:0 0 20px;font-size:13px;color:var(--text-tertiary);">We will email a link if the account exists.</p>
    <div id="authForgotMsg" class="hidden" style="margin-bottom:12px;padding:10px;background:var(--bg-tertiary);border-radius:8px;font-size:13px;"></div>
    <div class="form-group">
      <label class="form-label">Tenant slug</label>
      <input type="text" class="form-input" id="authForgotTenant" value="demo" />
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="form-input" id="authForgotEmail" />
    </div>
    <button type="button" class="btn btn-primary" style="width:100%;" onclick="submitAuthForgot()">Send reset link</button>
    <p style="margin:16px 0 0;font-size:12px;text-align:center;"><a href="javascript:void(0)" onclick="navigateTo('login');return false;">Back to sign in</a></p>
  `);
}

async function submitAuthForgot() {
  var el = document.getElementById('authForgotMsg');
  var tenant = (document.getElementById('authForgotTenant') && document.getElementById('authForgotTenant').value) || 'demo';
  var email = (document.getElementById('authForgotEmail') && document.getElementById('authForgotEmail').value) || '';
  var base =
    typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.replace(/\/$/, '') : '';
  var r = await fetch(base + '/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, tenant_slug: tenant }),
    credentials: 'include',
  });
  var body = await r.json().catch(function () {
    return {};
  });
  if (el) {
    el.textContent = (body.data && body.data.message) || 'Request submitted.';
    el.classList.remove('hidden');
  }
}

function renderAuthResetPassword() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token') || '';
  return pldAuthCard(`
    <h2 style="margin:0 0 8px;font-size:20px;">Choose a new password</h2>
    <div id="authResetErr" class="hidden" style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;font-size:13px;color:var(--accent-red);"></div>
    <div class="form-group">
      <label class="form-label">Reset token</label>
      <input type="text" class="form-input" id="authResetToken" value="${token.replace(/"/g, '&quot;')}" placeholder="From email or server log (dev)" />
    </div>
    <div class="form-group">
      <label class="form-label">New password (min 8)</label>
      <input type="password" class="form-input" id="authResetNew" autocomplete="new-password" />
    </div>
    <button type="button" class="btn btn-primary" style="width:100%;" onclick="submitAuthReset()">Update password</button>
    <p style="margin:16px 0 0;font-size:12px;text-align:center;"><a href="javascript:void(0)" onclick="navigateTo('login');return false;">Sign in</a></p>
  `);
}

async function submitAuthReset() {
  var err = document.getElementById('authResetErr');
  if (err) err.classList.add('hidden');
  var token = (document.getElementById('authResetToken') && document.getElementById('authResetToken').value) || '';
  var new_password =
    (document.getElementById('authResetNew') && document.getElementById('authResetNew').value) || '';
  var base =
    typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.replace(/\/$/, '') : '';
  var r = await fetch(base + '/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, new_password: new_password }),
    credentials: 'include',
  });
  var body = await r.json().catch(function () {
    return {};
  });
  if (!r.ok) {
    if (err) {
      err.textContent =
        (body.errors && body.errors[0] && body.errors[0].message) || 'Reset failed';
      err.classList.remove('hidden');
    }
    return;
  }
  if (typeof showToast === 'function') showToast('Password updated — sign in', 'success');
  navigateTo('login');
}

function renderAuthInviteAccept() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('invite') || params.get('token') || '';
  return pldAuthCard(`
    <h2 style="margin:0 0 8px;font-size:20px;">Accept invitation</h2>
    <div id="authInvErr" class="hidden" style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;font-size:13px;color:var(--accent-red);"></div>
    <div class="form-group">
      <label class="form-label">Invitation token</label>
      <input type="text" class="form-input" id="authInvToken" value="${token.replace(/"/g, '&quot;')}" />
    </div>
    <div class="form-group">
      <label class="form-label">First name</label>
      <input type="text" class="form-input" id="authInvFn" />
    </div>
    <div class="form-group">
      <label class="form-label">Last name</label>
      <input type="text" class="form-input" id="authInvLn" />
    </div>
    <div class="form-group">
      <label class="form-label">Password (min 8)</label>
      <input type="password" class="form-input" id="authInvPw" autocomplete="new-password" />
    </div>
    <button type="button" class="btn btn-primary" style="width:100%;" onclick="submitAuthInviteAccept()">Create account</button>
  `);
}

async function submitAuthInviteAccept() {
  var err = document.getElementById('authInvErr');
  if (err) err.classList.add('hidden');
  var base =
    typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.replace(/\/$/, '') : '';
  var r = await fetch(base + '/api/v1/auth/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: document.getElementById('authInvToken').value,
      first_name: document.getElementById('authInvFn').value,
      last_name: document.getElementById('authInvLn').value,
      password: document.getElementById('authInvPw').value,
    }),
    credentials: 'include',
  });
  var body = await r.json().catch(function () {
    return {};
  });
  if (!r.ok || !body.data) {
    if (err) {
      err.textContent =
        (body.errors && body.errors[0] && body.errors[0].message) || 'Could not accept invite';
      err.classList.remove('hidden');
    }
    return;
  }
  if (typeof window.pldAuthSaveLoginPayload === 'function') {
    window.pldAuthSaveLoginPayload(body.data);
  }
  if (typeof window.pldRefreshTenantShell === 'function') await window.pldRefreshTenantShell();
  if (typeof window.pldRehydrateCatalogAfterTenantContextChange === 'function') {
    await window.pldRehydrateCatalogAfterTenantContextChange();
  }
  if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
  if (typeof window.pldPresenceRestart === 'function') window.pldPresenceRestart();
  navigateTo('dashboard');
}

function renderAuthAccount() {
  var u = typeof window.pldAuthGetUserJson === 'function' ? window.pldAuthGetUserJson() : null;
  if (!u) {
    return pldAuthCard(`
      <p style="margin:0;">Sign in to manage your API account.</p>
      <button type="button" class="btn btn-primary" style="margin-top:16px;" onclick="navigateTo('login')">Sign in</button>
    `);
  }
  var perms = (u.permissions || []).join(', ');
  return pldAuthCard(`
    <h2 style="margin:0 0 8px;font-size:20px;">API account</h2>
    <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px;">${u.email || ''} · ${u.role || ''}</p>
    <div class="form-group"><label class="form-label">First name</label><input type="text" class="form-input" id="accFn" value="${(u.first_name || '').replace(/"/g, '&quot;')}" /></div>
    <div class="form-group"><label class="form-label">Last name</label><input type="text" class="form-input" id="accLn" value="${(u.last_name || '').replace(/"/g, '&quot;')}" /></div>
    <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="accPh" value="${(u.phone || '').replace(/"/g, '&quot;')}" /></div>
    <p style="font-size:11px;color:var(--text-tertiary);margin-bottom:12px;">Permissions: ${perms || '—'}</p>
    <button type="button" class="btn btn-primary" style="width:100%;margin-bottom:8px;" onclick="submitAuthAccountProfile()">Save profile</button>
    <button type="button" class="btn btn-secondary" style="width:100%;" onclick="submitAuthAccountLogout()">Sign out</button>
  `);
}

async function submitAuthAccountProfile() {
  var res = await window.pldApiFetch('/api/v1/auth/me', {
    method: 'PUT',
    body: JSON.stringify({
      first_name: document.getElementById('accFn').value,
      last_name: document.getElementById('accLn').value,
      phone: document.getElementById('accPh').value || null,
    }),
  });
  if (res.ok && res.body && res.body.data) {
    try {
      localStorage.setItem('pld_auth_user', JSON.stringify(res.body.data));
    } catch (_) {}
    if (typeof window.pldApplySessionIdentityChrome === 'function') window.pldApplySessionIdentityChrome();
    if (typeof showToast === 'function') showToast('Profile saved', 'success');
  } else if (typeof showToast === 'function') {
    showToast((res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message) || 'Save failed', 'warning');
  }
}

async function submitAuthAccountLogout() {
  if (typeof window.pldAuthLogoutRemote === 'function') await window.pldAuthLogoutRemote();
  if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
  if (typeof showToast === 'function') showToast('Signed out', 'success');
  navigateTo('login');
}

function renderAuthInviteAdmin() {
  var u = typeof window.pldAuthGetUserJson === 'function' ? window.pldAuthGetUserJson() : null;
  if (!u) {
    return pldAuthCard(
      '<p>Sign in to send invitations.</p><button type="button" class="btn btn-primary" style="margin-top:12px;" onclick="navigateTo(\'login\')">Sign in</button>',
    );
  }
  return pldAuthCard(`
    <h2 style="margin:0 0 8px;font-size:20px;">Invite user</h2>
    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">Requires <code>auth.invitations.manage</code> on the API.</p>
    <div id="authInvAdErr" class="hidden" style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;font-size:13px;color:var(--accent-red);"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="invAdEmail" /></div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <select class="form-select" id="invAdRole">
        <option value="viewer">viewer</option>
        <option value="coordinator">coordinator</option>
        <option value="manager">manager</option>
        <option value="admin">admin</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Personnel ID (optional)</label><input type="text" class="form-input" id="invAdPid" placeholder="UUID" /></div>
    <button type="button" class="btn btn-primary" style="width:100%;" onclick="submitAuthInviteAdmin()">Send invitation</button>
  `);
}

async function submitAuthInviteAdmin() {
  var err = document.getElementById('authInvAdErr');
  if (err) err.classList.add('hidden');
  var email = document.getElementById('invAdEmail').value;
  var role = document.getElementById('invAdRole').value;
  var pid = document.getElementById('invAdPid').value.trim();
  var res = await window.pldApiFetch('/api/v1/auth/invite', {
    method: 'POST',
    body: JSON.stringify({
      email: email,
      role: role,
      personnel_id: pid || undefined,
    }),
  });
  if (!res.ok) {
    if (err) {
      err.textContent =
        (res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message) ||
        'Invite failed';
      err.classList.remove('hidden');
    }
    return;
  }
  if (typeof showToast === 'function') showToast('Invitation created (check server log for token in dev)', 'success');
}

window.renderAuthLogin = renderAuthLogin;
window.renderAuthForgotPassword = renderAuthForgotPassword;
window.renderAuthResetPassword = renderAuthResetPassword;
window.renderAuthInviteAccept = renderAuthInviteAccept;
window.renderAuthAccount = renderAuthAccount;
window.renderAuthInviteAdmin = renderAuthInviteAdmin;
window.submitAuthInviteAdmin = submitAuthInviteAdmin;
window.submitAuthLogin = submitAuthLogin;
window.submitAuthForgot = submitAuthForgot;
window.submitAuthReset = submitAuthReset;
window.submitAuthInviteAccept = submitAuthInviteAccept;
window.submitAuthAccountProfile = submitAuthAccountProfile;
window.submitAuthAccountLogout = submitAuthAccountLogout;
