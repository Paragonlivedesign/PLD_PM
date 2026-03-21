/* Operations dashboard — GET /api/v1/dashboard/operations */
(function (global) {
  global.pldHydrateDashboardFromApi = async function pldHydrateDashboardFromApi() {
    if (typeof global.pldApiFetch !== 'function') return;
    const content = document.getElementById('pageContent');
    if (!content) return;
    let slot = content.querySelector('#pldDashboardApiStrip');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'pldDashboardApiStrip';
      slot.className = 'card';
      slot.style.cssText = 'margin-bottom:20px;padding:14px 16px;';
      const first = content.querySelector('.stats-row');
      if (first && first.parentNode) first.parentNode.insertBefore(slot, first);
      else content.insertBefore(slot, content.firstChild);
    }
    slot.innerHTML =
      '<p style="margin:0;font-size:13px;color:var(--text-tertiary);">Loading live KPIs from API…</p>';
    const r = await global.pldApiFetch('/api/v1/dashboard/operations');
    if (!r.ok || !r.body || !r.body.data || (r.body.errors && r.body.errors.length)) {
      var errMsg =
        (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || '';
      var hint =
        'Live dashboard API unavailable. Start the API on port 3000; if you open the SPA from another port (e.g. 8000), set <meta name="pld-api-base" content="http://127.0.0.1:3000"> so requests hit the backend.';
      if (r.status === 403) {
        hint =
          'Live dashboard: forbidden (403). Needs <code style="font-size:11px;">analytics:dashboard:read</code> (admins have <code style="font-size:11px;">*</code>). Run <code style="font-size:11px;">npm run db:migrate</code>, restart the API, then Sign out and sign in again (clears server permission cache).';
      } else if (r.status === 401) {
        hint = 'Live dashboard: sign in again (session expired).';
      } else if (errMsg) {
        hint = 'Live dashboard: ' + errMsg;
      }
      var btn =
        typeof global.pldSignOutAndGoLogin === 'function'
          ? '<p style="margin:10px 0 0;"><button type="button" class="btn btn-secondary btn-sm" onclick="void window.pldSignOutAndGoLogin();">Sign out & sign in again</button></p>'
          : '';
      slot.innerHTML =
        '<p style="margin:0;font-size:13px;color:var(--accent-amber);">' + hint + '</p>' + btn;
      return;
    }
    const k = r.body.data.kpis || {};
    slot.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;">
        <span style="font-weight:600;font-size:13px;color:var(--text-secondary);">Live (Postgres)</span>
        <span style="font-size:13px;"><strong>${k.active_events ?? '—'}</strong> active events</span>
        <span style="font-size:13px;"><strong>${k.upcoming_events_7d ?? '—'}</strong> upcoming (7d)</span>
        <span style="font-size:13px;"><strong>${k.open_conflicts ?? '—'}</strong> open conflicts</span>
        <span style="font-size:13px;"><strong>${k.personnel_assigned ?? '—'}</strong> crew assigned (range)</span>
      </div>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
