/* Week crew sheet from GET /api/v1/schedule */
(function (global) {
  global.pldHydrateSchedulingSheet = async function pldHydrateSchedulingSheet() {
    if (typeof global.scheduleView === 'undefined' || global.scheduleView !== 'api') return;
    if (typeof global.pldApiFetch !== 'function') return;
    const el = document.getElementById('pldSchedulingApiPanel');
    if (!el) return;
    el.innerHTML = '<p style="font-size:13px;color:var(--text-tertiary);">Loading schedule…</p>';
    const d = new Date();
    const iso = d.toISOString().slice(0, 10);
    const r = await global.pldApiFetch(
      '/api/v1/schedule?view=week&date=' + encodeURIComponent(iso) + '&resource_type=personnel',
    );
    if (!r.ok || !r.body || !r.body.data || (r.body.errors && r.body.errors.length)) {
      el.innerHTML =
        '<p style="font-size:13px;color:var(--accent-amber);">Schedule API unavailable.</p>';
      return;
    }
    const rows = r.body.data.resources || [];
    if (!rows.length) {
      el.innerHTML =
        '<p style="font-size:13px;color:var(--text-tertiary);">No personnel rows for this week (add crew assignments in API).</p>';
      return;
    }
    const esc = (s) => String(s || '').replace(/</g, '&lt;');
    el.innerHTML = `
      <p style="font-size:12px;color:var(--text-tertiary);margin:0 0 10px 0;">Week grid (API) — next: full sheet / timeline UX per Planning scheduling module.</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Crew</th><th>Assignments (week)</th></tr></thead><tbody>
        ${rows
          .map((row) => {
            const list = row.assignments || [];
            const txt = list.length
              ? list
                  .map(
                    (b) =>
                      `${esc(b.event_name)} (${esc(b.start_date)}–${esc(b.end_date)})${b.role ? ' · ' + esc(b.role) : ''}`,
                  )
                  .join('; ')
              : '—';
            return `<tr><td><strong>${esc(row.resource_name)}</strong></td><td style="font-size:12px;">${txt}</td></tr>`;
          })
          .join('')}
      </tbody></table></div>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
