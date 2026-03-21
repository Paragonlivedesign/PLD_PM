/* ============================================
   Module: App Initialization
   Depends on: state.js, theme.js, navigation.js, topbar.js, command-palette.js, modal.js, router.js
   ============================================ */

function pldStatusEscapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Clear JWT + refresh token, refresh chrome, go to login (permissions reload on next sign-in). */
window.pldSignOutAndGoLogin = async function pldSignOutAndGoLogin() {
  if (typeof window.pldPresenceStop === 'function') window.pldPresenceStop();
  try {
    if (typeof window.pldAuthLogoutRemote === 'function') await window.pldAuthLogoutRemote();
  } catch (e) {
    console.error(e);
  }
  if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
  if (typeof window.pldApplySessionIdentityChrome === 'function') window.pldApplySessionIdentityChrome();
  if (typeof window.pldRefreshPlatformAdminNav === 'function') void window.pldRefreshPlatformAdminNav();
  if (typeof showToast === 'function') showToast('Signed out — sign in again to refresh permissions', 'success');
  if (typeof navigateTo === 'function') navigateTo('login');
};

/**
 * Top bar: API session + connection state (JWT vs dev headers vs offline).
 * Kept name `pldUpdateApiSignInLink` for callers (auth-pages, topbar logout).
 */
window.pldUpdateApiSignInLink = function pldUpdateApiSignInLink() {
  const bar = document.getElementById('pldApiStatusBar');
  if (!bar) return;

  const apiOn =
    typeof window.PLD_API_BASE === 'string' && window.PLD_API_BASE.trim() !== '';
  if (!apiOn) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  bar.style.display = 'flex';
  const tok =
    typeof window.pldAuthGetAccessToken === 'function' && window.pldAuthGetAccessToken();
  const fromRest = typeof window.PLD_DATA_FROM_REST !== 'undefined' && window.PLD_DATA_FROM_REST;
  let email = '';
  if (typeof window.pldAuthGetUserJson === 'function') {
    const u = window.pldAuthGetUserJson();
    if (u && typeof u === 'object') email = String(u.email || u.email_address || '').trim();
  }

  if (tok) {
    const who = email ? `<span class="pld-api-status-email">${pldStatusEscapeHtml(email)}</span>` : '';
    bar.innerHTML = `
      <span class="pld-api-status-pill pld-api-status-pill--session" title="Signed in to the PostgreSQL API">
        <span class="pld-api-status-dot" aria-hidden="true"></span>
        <span>Signed in</span>${who}
      </span>
      <span class="pld-api-status-meta" title="JWT session — sign out after DB/migration changes so the next sign-in loads fresh permissions">Session</span>
      <button type="button" class="btn btn-ghost btn-sm" onclick="void window.pldSignOutAndGoLogin();">Sign out</button>`;
    return;
  }

  if (fromRest) {
    bar.innerHTML = `
      <span class="pld-api-status-pill pld-api-status-pill--ok" title="Data loaded via API using dev headers until you sign in">
        <span class="pld-api-status-dot pld-api-status-dot--ok" aria-hidden="true"></span>
        <span>API connected</span>
      </span>
      <a href="javascript:void(0)" class="btn btn-ghost btn-sm" onclick="navigateTo('login'); return false;">Sign in</a>`;
    return;
  }

  bar.innerHTML = `
    <span class="pld-api-status-pill pld-api-status-pill--warn" title="Not using PostgreSQL catalog from API (Firestore or offline)">
      <span class="pld-api-status-dot pld-api-status-dot--warn" aria-hidden="true"></span>
      <span>Local data</span>
    </span>
    <a href="javascript:void(0)" class="btn btn-ghost btn-sm" onclick="navigateTo('login'); return false;">Sign in (API)</a>`;
};

document.addEventListener('DOMContentLoaded', async () => {
  window.pldUpdateApiSignInLink();
  if (typeof window.pldRefreshPlatformAdminNav === 'function') void window.pldRefreshPlatformAdminNav();
  const errEl = document.getElementById('pld-boot-error');
  try {
    await PLD_PM_DATA.init();
    if (typeof window.pldRefreshTenantShell === 'function') await window.pldRefreshTenantShell();
    if (typeof window.pldApplySessionIdentityChrome === 'function') window.pldApplySessionIdentityChrome();
    if (typeof window.pldUpdateApiSignInLink === 'function') window.pldUpdateApiSignInLink();
    if (typeof window.pldRefreshPlatformAdminNav === 'function') void window.pldRefreshPlatformAdminNav();
    if (errEl) errEl.classList.add('hidden');
  } catch (e) {
    console.error(e);
    if (errEl) {
      errEl.textContent =
        'Could not load app data. For PostgreSQL: run the API (npm run dev) with DATABASE_URL set and migrations applied. For Firestore demo: npm run emulators — npm run seed — open http://127.0.0.1:5000';
      errEl.classList.remove('hidden');
    }
    return;
  }

  loadTheme();
  initNavigation();
  initSidebar();
  if (typeof window.pldPresenceStart === 'function') window.pldPresenceStart();
  if (typeof window.updateSidebarNavCounts === 'function') window.updateSidebarNavCounts();
  initCommandPalette();
  initModal();
  initTopbarActions();
  const qs = new URLSearchParams(window.location.search);
  if (qs.get('page') === 'reset-password') {
    navigateTo('reset-password');
  } else if (qs.get('page') === 'invite-accept') {
    navigateTo('invite-accept');
  } else {
    renderPage('dashboard');
  }
});
