/* ============================================
   Platform admin (master) — tenants + users
   GET /api/v1/platform/tenants (Bearer + PLD_PLATFORM_ADMIN_EMAILS)
   ============================================ */

function pldEscapePlatform(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function renderPlatformAdmin() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Master admin</h1>
        <p class="page-subtitle">All tenants and users (platform scope). Requires <code style="font-size:12px;">PLD_PLATFORM_ADMIN_EMAILS</code> on the API.</p>
      </div>
    </div>
    <div id="pldPlatformAdminRoot" class="card" style="padding:0;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);">
        <span style="font-weight:600;font-size:14px;">Tenants</span>
      </div>
      <div id="pldPlatformAdminBody" style="padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:var(--text-tertiary);">Loading…</p>
      </div>
    </div>
  `;
}

async function pldHydratePlatformAdmin() {
  const body = document.getElementById('pldPlatformAdminBody');
  if (!body || typeof pldApiFetch !== 'function') return;
  const r = await pldApiFetch('/api/v1/platform/tenants', { method: 'GET' });
  if (!r.ok) {
    const msg =
      (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) ||
      'Could not load platform data';
    body.innerHTML = `<p style="margin:0;font-size:13px;color:var(--accent-amber);">${pldEscapePlatform(msg)}</p>
      <p style="margin:12px 0 0;font-size:12px;color:var(--text-tertiary);">Sign in with an email listed in <code>PLD_PLATFORM_ADMIN_EMAILS</code> (see <code>.env.example</code>), then refresh.</p>`;
    return;
  }
  const rows = (r.body && r.body.data) || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    body.innerHTML =
      '<p style="margin:0;font-size:13px;color:var(--text-tertiary);">No tenants in the database.</p>';
    return;
  }
  body.innerHTML = rows
    .map(function (t) {
      const users = Array.isArray(t.users) ? t.users : [];
      const userRows =
        users.length === 0
          ? '<tr><td colspan="4" style="font-size:12px;color:var(--text-tertiary);">No users</td></tr>'
          : users
              .map(function (u) {
                const name =
                  [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || '—';
                const active = u.is_active !== false;
                return `<tr>
            <td style="font-size:12px;">${pldEscapePlatform(u.email || '')}</td>
            <td style="font-size:12px;color:var(--text-tertiary);">${pldEscapePlatform(name)}</td>
            <td style="font-size:12px;">${pldEscapePlatform(u.role_name || '')}</td>
            <td style="font-size:12px;">${active ? '<span style="color:var(--accent-green);">active</span>' : '<span style="color:var(--text-tertiary);">inactive</span>'}</td>
          </tr>`;
              })
              .join('');
      const created = t.created_at ? String(t.created_at).slice(0, 10) : '—';
      return `
        <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;margin-bottom:10px;">
            <span style="font-weight:600;font-size:15px;">${pldEscapePlatform(t.name || '')}</span>
            <span style="font-size:12px;color:var(--text-tertiary);">slug <code>${pldEscapePlatform(t.slug || '')}</code></span>
            <span style="font-size:12px;color:var(--text-tertiary);">status ${pldEscapePlatform(t.status || '')}</span>
            <span style="font-size:12px;color:var(--text-tertiary);">created ${pldEscapePlatform(created)}</span>
            <span style="font-size:11px;font-family:monospace;color:var(--text-tertiary);">${pldEscapePlatform(t.id || '')}</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>State</th></tr></thead>
              <tbody>${userRows}</tbody>
            </table>
          </div>
        </div>`;
    })
    .join('');
}

window.renderPlatformAdmin = renderPlatformAdmin;
window.pldHydratePlatformAdmin = pldHydratePlatformAdmin;

/**
 * Show sidebar + topbar entry when the signed-in user can use platform admin
 * (`is_platform_admin` from /auth/me, or probe GET /api/v1/platform/tenants).
 */
window.pldRefreshPlatformAdminNav = async function pldRefreshPlatformAdminNav() {
  const navEl = document.getElementById('navPlatformAdmin');
  const topEl = document.getElementById('pldPlatformAdminTopBtn');
  function setVisible(visible) {
    const d = visible ? '' : 'none';
    if (navEl) navEl.style.display = d;
    if (topEl) topEl.style.display = d;
  }
  const apiOn =
    typeof window.PLD_API_BASE === 'string' && window.PLD_API_BASE.trim() !== '';
  const tok =
    typeof window.pldAuthGetAccessToken === 'function' && window.pldAuthGetAccessToken();
  if (!apiOn || !tok) {
    setVisible(false);
    return;
  }
  const u = typeof window.pldAuthGetUserJson === 'function' ? window.pldAuthGetUserJson() : null;
  if (u && u.is_platform_admin === true) {
    setVisible(true);
    return;
  }
  if (u && u.is_platform_admin === false) {
    setVisible(false);
    return;
  }
  try {
    const r = await pldApiFetch('/api/v1/platform/tenants', { method: 'GET' });
    setVisible(r.ok);
  } catch (_) {
    setVisible(false);
  }
};
