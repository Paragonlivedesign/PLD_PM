/* ============================================
   Module: Financial Page
   Depends on: state.js, data.js, modal.js
   ============================================ */
function renderFinancial() {
  const totalBudget = EVENTS.reduce((s, e) => s + e.budget, 0);
  const totalSpent = EVENTS.reduce((s, e) => s + e.spent, 0);
  const remaining = totalBudget - totalSpent;

  return `
    <div class="page-header">
      <div><h1 class="page-title">Financial</h1><p class="page-subtitle">Budget tracking, cost breakdown, and settlement management</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="openExportModal('Financial Report')">Export Report</button>
        <button class="btn btn-primary" onclick="openManualCostModal()">+ Manual Entry</button>
      </div>
    </div>
    <div class="tabs">
      ${tabBtn('Overview', 'financialTab', 'overview', 'financial')}
      ${tabBtn('By Event', 'financialTab', 'byevent', 'financial')}
      ${tabBtn('By Category', 'financialTab', 'bycategory', 'financial')}
      ${tabBtn('Invoices', 'financialTab', 'invoices', 'financial')}
      ${tabBtn('Settlements', 'financialTab', 'settlements', 'financial')}
      ${tabBtn('Reports', 'financialTab', 'reports', 'financial')}
    </div>
    ${financialTab === 'overview' ? renderFinancialOverview(totalBudget, totalSpent, remaining) : financialTab === 'byevent' ? renderFinancialByEvent() : financialTab === 'bycategory' ? renderFinancialByCategory(totalSpent) : financialTab === 'invoices' ? renderFinancialInvoices() : financialTab === 'reports' ? renderFinancialReports() : renderFinancialSettlements()}
  `;
}

function renderFinancialOverview(totalBudget, totalSpent, remaining) {
  const laborPct = 45, travelPct = 18, equipPct = 22, vendorPct = 8, perdiemPct = 4, otherPct = 3;
  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total Budget</div><div class="stat-value">${formatCurrency(totalBudget)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Spent</div><div class="stat-value" style="color:var(--accent-amber);">${formatCurrency(totalSpent)}</div><div class="stat-change">${Math.round(totalSpent/totalBudget*100)}% of budget</div></div>
      <div class="stat-card"><div class="stat-label">Remaining</div><div class="stat-value" style="color:var(--accent-green);">${formatCurrency(remaining)}</div></div>
      <div class="stat-card"><div class="stat-label">Avg Event Cost</div><div class="stat-value">${formatCurrency(Math.round(totalSpent / EVENTS.filter(e => e.spent > 0).length))}</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-header"><span class="card-title">Cost Breakdown</span></div>
        ${FINANCIAL_CATEGORIES.map(cat => { const pct = {labor:laborPct,travel:travelPct,equipment:equipPct,vendor:vendorPct,per_diem:perdiemPct,other:otherPct}[cat.key]; return `<div class="budget-bar-container"><div class="budget-bar-label"><span>${cat.label}</span><span>${formatCurrency(Math.round(totalSpent*pct/100))} (${pct}%)</span></div><div class="budget-bar"><div class="budget-bar-fill ${cat.color}" style="width:${pct}%;"></div></div></div>`; }).join('')}
      </div>
      <div class="card"><div class="card-header"><span class="card-title">Budget by Event</span></div>
        ${EVENTS.filter(e => e.budget > 0).sort((a,b) => b.budget - a.budget).slice(0,6).map(ev => { const pct = Math.round(ev.spent/ev.budget*100); const color = pct>90?'red':pct>70?'amber':'blue'; return `<div class="budget-bar-container" style="cursor:pointer;" onclick="navigateToEvent('${ev.id}')"><div class="budget-bar-label"><span>${ev.name}</span><span>${formatCurrency(ev.spent)} / ${formatCurrency(ev.budget)}</span></div><div class="budget-bar"><div class="budget-bar-fill ${color}" style="width:${pct}%;"></div></div></div>`; }).join('')}
      </div>
    </div>
    <div class="card" style="margin-top:20px;"><div class="card-header"><span class="card-title">Recent Transactions</span></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Event</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        <tr><td>Feb 17</td><td>UFC 310</td><td>Labor</td><td>Crew day rates - 4 crew</td><td>${formatCurrency(3200)}</td><td><span class="phase-badge settled">Paid</span></td></tr>
        <tr><td>Feb 16</td><td>UFC 310</td><td>Travel</td><td>Flights JFK→LAS (2 pax)</td><td>${formatCurrency(560)}</td><td><span class="phase-badge awarded">Booked</span></td></tr>
        <tr><td>Feb 15</td><td>NBA All-Star</td><td>Equipment</td><td>LED wall rental - 3 days</td><td>${formatCurrency(18500)}</td><td><span class="phase-badge production">Pending</span></td></tr>
        <tr><td>Feb 14</td><td>NBA All-Star</td><td>Labor</td><td>Crew day rates - 5 crew</td><td>${formatCurrency(4100)}</td><td><span class="phase-badge settled">Paid</span></td></tr>
        <tr><td>Feb 14</td><td>NBA All-Star</td><td>Vendor</td><td>Catering services</td><td>${formatCurrency(2800)}</td><td><span class="phase-badge production">Pending</span></td></tr>
        <tr><td>Feb 13</td><td>NBA All-Star</td><td>Travel</td><td>Hotel - 5 rooms x 3 nights</td><td>${formatCurrency(6750)}</td><td><span class="phase-badge settled">Paid</span></td></tr>
      </tbody></table></div>
    </div>
  `;
}

function renderFinancialByEvent() {
  return `
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Event</th><th>Phase</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Utilization</th></tr></thead><tbody>
      ${EVENTS.filter(e => e.budget > 0).sort((a,b) => b.budget - a.budget).map(ev => {
        const pct = Math.round(ev.spent/ev.budget*100);
        const color = pct>90?'var(--accent-red)':pct>70?'var(--accent-amber)':'var(--accent-green)';
        return `<tr onclick="navigateToEvent('${ev.id}')" style="cursor:pointer;">
          <td><strong>${ev.name}</strong></td>
          <td><span class="phase-badge ${ev.phase}">${PHASE_LABELS[ev.phase]}</span></td>
          <td>${formatCurrency(ev.budget)}</td>
          <td>${formatCurrency(ev.spent)}</td>
          <td style="color:${ev.budget - ev.spent < 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${formatCurrency(ev.budget - ev.spent)}</td>
          <td><div style="display:flex;align-items:center;gap:8px;"><div class="budget-bar" style="flex:1;"><div class="budget-bar-fill ${pct>90?'red':pct>70?'amber':'blue'}" style="width:${pct}%;"></div></div><span style="font-size:12px;font-weight:600;color:${color};">${pct}%</span></div></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
  `;
}

function renderFinancialByCategory(totalSpent) {
  const cats = [
    { label: 'Labor', pct: 45, items: [{desc:'Crew day rates — NBA All-Star (5 crew x 3 days)',amt:12300},{desc:'Crew day rates — UFC 310 (4 crew x 1 day)',amt:3200},{desc:'Crew day rates — Super Bowl prep (4 crew x 2 days)',amt:6800},{desc:'Overtime — NBA All-Star setup',amt:2400}] },
    { label: 'Equipment', pct: 22, items: [{desc:'LED wall rental — NBA All-Star (3 days)',amt:18500},{desc:'Camera package — UFC 310',amt:8200},{desc:'Audio console rental — Super Bowl',amt:4500}] },
    { label: 'Travel', pct: 18, items: [{desc:'Flights — UFC 310 (4 pax)',amt:1220},{desc:'Hotels — NBA All-Star (5 rooms x 3 nights)',amt:6750},{desc:'Ground transport — Atlanta',amt:890}] },
    { label: 'Vendor', pct: 8, items: [{desc:'Catering — NBA All-Star',amt:2800},{desc:'Security — UFC 310',amt:3200},{desc:'Staging labor — subcontract',amt:4500}] },
    { label: 'Per Diem', pct: 4, items: [{desc:'Per diem — NBA All-Star crew (5 x 4 days)',amt:1500},{desc:'Per diem — UFC 310 crew (4 x 2 days)',amt:600}] },
    { label: 'Other', pct: 3, items: [{desc:'Permits — Las Vegas',amt:1200},{desc:'Insurance rider — MSG',amt:800}] }
  ];
  return `
    ${cats.map(cat => `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><span class="card-title">${cat.label}</span><span style="font-size:13px;font-weight:600;color:var(--text-secondary);">${formatCurrency(Math.round(totalSpent*cat.pct/100))} (${cat.pct}%)</span></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead><tbody>
          ${cat.items.map(it => `<tr><td>${it.desc}</td><td style="text-align:right;font-weight:500;">${formatCurrency(it.amt)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    `).join('')}
  `;
}

function renderFinancialSettlements() {
  const settled = EVENTS.filter(e => ['settled','archived'].includes(e.phase));
  const pending = EVENTS.filter(e => e.phase === 'wrap');
  return `
    <div class="stats-row" style="margin-bottom:20px;">
      <div class="stat-card"><div class="stat-label">Settled Events</div><div class="stat-value" style="color:var(--accent-green);">${settled.length}</div></div>
      <div class="stat-card"><div class="stat-label">Pending Settlement</div><div class="stat-value" style="color:var(--accent-amber);">${pending.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Settled</div><div class="stat-value">${formatCurrency(settled.reduce((s,e) => s + e.spent, 0))}</div></div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Event</th><th>Client</th><th>Budget</th><th>Final Cost</th><th>Variance</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${[...pending, ...settled].map(ev => {
        const client = getClient(ev.client);
        const variance = ev.budget - ev.spent;
        return `<tr>
          <td><strong>${ev.name}</strong></td><td>${client.name}</td>
          <td>${formatCurrency(ev.budget)}</td><td>${formatCurrency(ev.spent)}</td>
          <td style="color:${variance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${variance >= 0 ? '+' : ''}${formatCurrency(variance)}</td>
          <td><span class="phase-badge ${ev.phase}">${ev.phase === 'wrap' ? 'Pending' : 'Settled'}</span></td>
          <td>${ev.phase === 'wrap' ? `<button class="btn btn-primary btn-sm" onclick="openSettlementModal('${ev.id}')">Settle</button>` : `<button class="btn btn-ghost btn-sm" onclick="openSettlementReportModal('${ev.id}')">View Report</button>`}</td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
  `;
}

function renderFinancialInvoices() {
  const overdueCount = INVOICES.filter(inv => inv.status === 'overdue').length;
  const statusStyles = { draft: 'background:var(--bg-tertiary);color:var(--text-secondary);', sent: 'background:var(--accent-blue);color:#fff;', paid: 'background:var(--accent-green);color:#fff;', overdue: 'background:var(--accent-red);color:#fff;' };
  return `
    ${overdueCount > 0 ? `<div class="conflict-banner" style="margin-bottom:16px;"><strong>${overdueCount} overdue invoice${overdueCount !== 1 ? 's' : ''}</strong> — <button class="btn btn-ghost btn-sm" style="color:inherit;text-decoration:underline;" onclick="financialTab='invoices';document.querySelector('[data-filter-invoices]')?.click?.();renderPage('financial');">View invoices</button></div>` : ''}
    <div class="card">
      <div class="card-header">
        <span class="card-title">Invoices</span>
        <button class="btn btn-primary btn-sm" onclick="openCreateInvoiceModal()">+ New Invoice</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Invoice #</th><th>Client</th><th>Event</th><th>Amount</th><th>Status</th><th>Due</th><th>Sent</th><th>Actions</th></tr></thead>
          <tbody>
            ${INVOICES.map(inv => {
              const ev = EVENTS.find(e => e.id === inv.event);
              const client = getClient(inv.client);
              return `<tr>
                <td><strong>${inv.number}</strong></td>
                <td>${client.name}</td>
                <td>${ev ? ev.name : '—'}</td>
                <td>${formatCurrency(inv.amount)}</td>
                <td><span class="phase-badge" style="font-size:10px;${statusStyles[inv.status] || statusStyles.draft}">${inv.status}</span></td>
                <td>${formatDateShort(inv.dueDate)}</td>
                <td>${inv.sentDate ? formatDateShort(inv.sentDate) : '—'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="openEditInvoiceModal('${inv.id}')">Edit</button>
                  ${inv.status === 'draft' ? `<button class="btn btn-ghost btn-sm" onclick="showToast('Sent!','success')">Send</button>` : ''}
                  ${inv.status === 'sent' ? `<button class="btn btn-ghost btn-sm" onclick="showToast('Marked paid','success')">Mark paid</button>` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="showToast('Downloading PDF…','success')">PDF</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openReportPreviewModal(reportId, title) {
  const body = '<div style="padding:24px;min-height:200px;">Report preview would show here (e.g. table or chart for ' + title + ').</div>';
  const footer = '<button class="btn btn-primary" onclick="closeModal()">Close</button><button class="btn btn-secondary" onclick="showToast(\'Exporting…\',\'success\');closeModal();">Export PDF</button>';
  openModal(title, body, footer);
}

function renderFinancialReports() {
  const reportCards = [
    { id: 'pl', title: 'P&L Summary', desc: 'Profit & loss by period. Revenue, costs by category, margin.', metrics: 'Revenue, costs, margin' },
    { id: 'ar', title: 'AR Aging', desc: 'Accounts receivable by age bucket (current, 30, 60, 90+ days).', metrics: 'Current, 30, 60, 90+ days' },
    { id: 'cf', title: 'Cash Flow Forecast', desc: 'Projected cash in and out by week or month.', metrics: 'In, out, net by period' },
    { id: 'var', title: 'Budget Variance', desc: 'Budget vs. actual by event or category. Over/under flags.', metrics: 'Budget, actual, variance %' },
  ];
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;">
      ${reportCards.map(r => `
        <div class="card" style="padding:20px;">
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">${r.title}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">${r.desc}</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:16px;">${r.metrics}</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="openReportPreviewModal('${r.id}', '${r.title.replace(/'/g, "\\'")}')">Preview</button>
            <button class="btn btn-ghost btn-sm" onclick="showToast('Exporting ${r.title}…','success')">Export</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openManualCostModal() {
  const body = `
    <div class="form-group"><label class="form-label">Event</label><select class="form-select"><option value="">Select…</option>${EVENTS.filter(e => !['settled','archived'].includes(e.phase)).map(e => `<option>${e.name}</option>`).join('')}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Category</label><select class="form-select">${FINANCIAL_CATEGORIES.map(c => `<option>${c.label}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Amount ($)</label><input type="number" class="form-input" placeholder="0"></div>
    </div>
    <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" placeholder="What is this cost for?"></div>
    <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input"></div>
    <div class="form-group"><label class="form-label">Vendor / Payee</label><input type="text" class="form-input" placeholder="Optional"></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" placeholder="PO number, invoice reference…"></textarea></div>
  `;
  openModal('Add Manual Cost Entry', body, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Cost entry added!','success');closeModal();">Add Entry</button>`);
}

// ============================================
// DOCUMENTS (with sub-tabs)
// ============================================
