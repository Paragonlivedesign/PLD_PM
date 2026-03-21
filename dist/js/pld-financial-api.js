/* Financial — cost report + financial records into Financial page (no duplicate demo strip). */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&lt;');
  }

  function categoryColorClass(key) {
    const k = String(key || '').toLowerCase();
    if (k.includes('labor')) return 'blue';
    if (k.includes('travel') || k.includes('transport')) return 'purple';
    if (k.includes('equip')) return 'amber';
    if (k.includes('vendor') || k.includes('cater')) return 'green';
    if (k.includes('per') || k.includes('accommodation')) return 'cyan';
    return 'red';
  }

  function mapApiCategoryToLabel(key) {
    const k = String(key || '').toLowerCase().replace(/_/g, ' ');
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : '—';
  }

  global.pldHydrateFinancialFromApi = async function pldHydrateFinancialFromApi() {
    if (typeof global.pldApiFetch !== 'function') return;
    const content = document.getElementById('pageContent');
    if (!content) return;

    const costEl = content.querySelector('#pldFinCostBreakdown');
    const txEl = content.querySelector('#pldFinRecentTxBody');
    const catMount = content.querySelector('#pldFinByCategoryMount');

    const runCosts = async () => {
      if (!costEl && !catMount) return;
      const r = await global.pldApiFetch('/api/v1/reports/costs?group_by=category');
      if (!r.ok || !r.body || !r.body.data || (r.body.errors && r.body.errors.length)) {
        if (costEl) {
          costEl.innerHTML =
            '<p style="margin:0;font-size:13px;color:var(--accent-amber);">Cost report unavailable (sign in or check <code>reports:read</code>).</p>';
        }
        if (catMount) {
          catMount.innerHTML =
            '<p style="margin:0;font-size:13px;color:var(--accent-amber);">Could not load category report.</p>';
        }
        return;
      }
      const groups = r.body.data.groups || [];
      const totals = r.body.data.totals || {};
      const totalCosts = Number(totals.total_costs || 0) || 1;

      if (costEl) {
        if (!groups.length) {
          costEl.innerHTML =
            '<p style="margin:0;font-size:13px;color:var(--text-tertiary);">No cost rows in the selected period.</p>';
        } else {
          costEl.innerHTML = groups
            .map((g) => {
              const amt = Number(g.total_costs || 0);
              const pct = Math.round((amt / totalCosts) * 100);
              const label = esc(g.label || g.key || '');
              const c = categoryColorClass(g.key || g.label);
              return `<div class="budget-bar-container"><div class="budget-bar-label"><span>${label}</span><span>${amt.toFixed(0)} (${pct}%)</span></div><div class="budget-bar"><div class="budget-bar-fill ${c}" style="width:${Math.min(100, pct)}%;"></div></div></div>`;
            })
            .join('');
        }
      }

      if (catMount) {
        if (!groups.length) {
          catMount.innerHTML =
            '<p style="margin:0;font-size:13px;color:var(--text-tertiary);">No categories to show.</p>';
          return;
        }
        const lines = await global.pldApiFetch('/api/v1/financials?limit=100&sort_by=date&sort_order=desc');
        const lineRows =
          lines.ok && lines.body && lines.body.data && Array.isArray(lines.body.data)
            ? lines.body.data
            : [];
        catMount.innerHTML = groups
          .map((g) => {
            const catKey = String(g.key || '').toLowerCase();
            const label = esc(g.label || mapApiCategoryToLabel(g.key));
            const sub = lineRows.filter((row) => String(row.category || '').toLowerCase() === catKey);
            const rows =
              sub.length > 0
                ? sub
                    .slice(0, 12)
                    .map((it) => {
                      const d = it.date ? String(it.date).slice(0, 10) : '—';
                      return `<tr><td>${esc(it.description || '—')}</td><td style="text-align:right;font-weight:500;">${Number(it.amount || 0).toFixed(2)}</td><td style="font-size:12px;color:var(--text-tertiary);">${esc(d)}</td></tr>`;
                    })
                    .join('')
                : `<tr><td colspan="3" style="color:var(--text-tertiary);font-size:12px;">No line items for this category in the latest page.</td></tr>`;
            return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><span class="card-title">${label}</span><span style="font-size:13px;font-weight:600;color:var(--text-secondary);">${Number(g.total_costs || 0).toFixed(2)} total</span></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Description</th><th style="text-align:right;">Amount</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
          })
          .join('');
      }
    };

    const runTx = async () => {
      if (!txEl) return;
      const r = await global.pldApiFetch('/api/v1/financials?limit=15&sort_by=date&sort_order=desc');
      if (!r.ok || !r.body || !r.body.data) {
        txEl.innerHTML = `<tr><td colspan="7" style="color:var(--accent-amber);font-size:13px;">Financial records unavailable (API or permission).</td></tr>`;
        return;
      }
      const rows = Array.isArray(r.body.data) ? r.body.data : [];
      if (!rows.length) {
        txEl.innerHTML = `<tr><td colspan="6" style="color:var(--text-tertiary);font-size:13px;">No financial records yet.</td></tr>`;
        return;
      }
      txEl.innerHTML = rows
        .map((it) => {
          const d = it.date ? String(it.date).slice(0, 10) : '—';
          return `<tr><td style="white-space:nowrap;">${esc(d)}</td><td>${esc(it.event_name || '—')}</td><td>${esc(it.category)}</td><td>${esc(it.description)}</td><td>${Number(it.amount || 0).toFixed(2)}</td><td>${esc(it.type)}</td><td>${esc(it.status)}</td></tr>`;
        })
        .join('');
    };

    await runCosts();
    await runTx();
  };
})(typeof window !== 'undefined' ? window : globalThis);
