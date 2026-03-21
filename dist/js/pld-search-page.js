/* Full search results page — GET /api/v1/search (Wave 3 partial). */
(function (global) {
  global.__pldSearchPageQuery = global.__pldSearchPageQuery || '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.renderSearchPage = function renderSearchPage() {
    const q = esc(global.__pldSearchPageQuery || '');
    return `
    <div class="page-header">
      <div><h1 class="page-title">Search</h1><p class="page-subtitle">Results from the API index</p></div>
    </div>
    <div class="card" style="padding:16px;margin-bottom:16px;">
      <div class="form-group" style="margin:0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <input type="search" id="pldSearchPageInput" class="form-input" style="max-width:420px;flex:1;min-width:200px;" placeholder="Search…" value="${q}">
        <button type="button" class="btn btn-primary" onclick="window.pldRunSearchPageFromInput()">Search</button>
      </div>
    </div>
    <div id="pldSearchPageResults"><p style="font-size:13px;color:var(--text-tertiary);">Enter a term and search.</p></div>`;
  };

  global.pldRunSearchPageFromInput = function pldRunSearchPageFromInput() {
    const el = document.getElementById('pldSearchPageInput');
    global.__pldSearchPageQuery = el && el.value ? String(el.value).trim() : '';
    if (typeof renderPage === 'function') renderPage('search', { skipModuleDataFetch: true });
    void global.pldHydrateSearchPage();
  };

  global.pldHydrateSearchPage = async function pldHydrateSearchPage() {
    const out = document.getElementById('pldSearchPageResults');
    if (!out) return;
    const q = String(global.__pldSearchPageQuery || '').trim();
    if (!q) {
      out.innerHTML = '<p style="font-size:13px;color:var(--text-tertiary);">Enter a term and search.</p>';
      return;
    }
    if (typeof global.pldApiFetch !== 'function') {
      out.innerHTML =
        '<p style="font-size:13px;color:var(--accent-amber);">API client not available.</p>';
      return;
    }
    out.innerHTML = '<p style="font-size:13px;color:var(--text-tertiary);">Searching…</p>';
    try {
      const r = await global.pldApiFetch(
        '/api/v1/search?q=' + encodeURIComponent(q) + '&limit=50',
        { method: 'GET' },
      );
      if (!r.ok || !r.body || !r.body.data || !r.body.data.results) {
        out.innerHTML =
          '<p style="font-size:13px;color:var(--accent-amber);">Search unavailable.</p>';
        return;
      }
      const groups = r.body.data.results;
      const keys = Object.keys(groups);
      if (!keys.length) {
        out.innerHTML = '<p style="font-size:13px;color:var(--text-tertiary);">No matches.</p>';
        return;
      }
      let html = '';
      for (const et of keys) {
        const items = groups[et] || [];
        if (!items.length) continue;
        html += `<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin-bottom:8px;">${esc(et)}</div>`;
        for (const it of items) {
          const title = esc(it.title || '');
          const sub = esc(it.subtitle || '');
          const id = esc(it.id || '');
          const onClick =
            et === 'event' && id
              ? `onclick="navigateToEvent('${id.replace(/'/g, "\\'")}')"`
              : '';
          html += `<div class="command-result-item" style="cursor:${onClick ? 'pointer' : 'default'};" ${onClick}>
            <div class="result-icon" style="background:var(--bg-tertiary);color:var(--text-secondary);">${esc(et.slice(0, 2).toUpperCase())}</div>
            <div><div style="font-weight:500;">${title}</div><div style="font-size:11px;color:var(--text-tertiary);">${sub}</div></div>
          </div>`;
        }
        html += '</div>';
      }
      out.innerHTML = html || '<p style="font-size:13px;color:var(--text-tertiary);">No matches.</p>';
    } catch (_e) {
      out.innerHTML = '<p style="font-size:13px;color:var(--accent-red);">Search failed.</p>';
    }
  };
})(window);
