/* ============================================
   Vendors — list, linked client, CRM contacts (API)
   ============================================ */
function pldVendorsHtmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

window.pldRefreshVendorsFromApiIfConfigured = async function pldRefreshVendorsFromApiIfConfigured() {
  if (typeof pldListVendorsFromApi !== 'function' || typeof VENDORS === 'undefined') return;
  const rows = await pldListVendorsFromApi();
  if (!Array.isArray(rows)) return;
  VENDORS.length = 0;
  rows.forEach(function (raw) {
    VENDORS.push({
      id: raw.id,
      name: raw.name,
      contact_name: raw.contact_name != null ? String(raw.contact_name) : '',
      contact_email: raw.contact_email != null ? String(raw.contact_email) : '',
      phone: raw.phone != null ? String(raw.phone) : '',
      notes: raw.notes != null ? String(raw.notes) : '',
      linked_client_id: raw.linked_client_id != null ? String(raw.linked_client_id) : '',
    });
  });
};

window.pldVendorLinkedClientChange = function (vendorId, clientId) {
  void (async function () {
    if (typeof pldUpdateVendorLinkedClient !== 'function') return;
    const vid = String(vendorId);
    const cid = clientId ? String(clientId) : null;
    const updated = await pldUpdateVendorLinkedClient(vid, cid);
    if (!updated) return;
    const row = VENDORS.find(function (x) {
      return x.id === vid;
    });
    if (row) row.linked_client_id = cid || '';
    if (typeof showToast === 'function') showToast('Linked client updated', 'success');
    if (typeof renderPage === 'function') renderPage('vendors', { skipModuleDataFetch: true });
  })();
};

function renderVendors() {
  const rest = typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  const hint = rest
    ? '<span style="font-size:11px;color:var(--text-tertiary);margin-left:8px;">Live data from API</span>'
    : '';
  const list = typeof VENDORS !== 'undefined' && Array.isArray(VENDORS) ? VENDORS : [];
  return `
    <div class="page-header">
      <div><h1 class="page-title">Vendors</h1><p class="page-subtitle">Suppliers, linked clients, and contacts${hint}</p></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Vendor</th><th>Linked client</th><th></th></tr></thead>
        <tbody>
          ${list
            .map(function (v) {
              const id = String(v.id);
              const lid = v.linked_client_id ? String(v.linked_client_id) : '';
              const clientOpts = (typeof CLIENTS !== 'undefined' && Array.isArray(CLIENTS) ? CLIENTS : [])
                .map(function (c) {
                  const sel = lid === String(c.id) ? ' selected' : '';
                  return `<option value="${pldVendorsHtmlEsc(c.id)}"${sel}>${pldVendorsHtmlEsc(c.name)}</option>`;
                })
                .join('');
              return `<tr>
            <td><strong>${pldVendorsHtmlEsc(v.name)}</strong>
              <div style="font-size:11px;color:var(--text-tertiary);">${pldVendorsHtmlEsc(v.contact_email || '')}</div>
            </td>
            <td>
              ${
                rest
                  ? `<select class="form-select" style="max-width:220px;" onchange="pldVendorLinkedClientChange('${id}', this.value)">
                <option value="">— None —</option>
                ${clientOpts}
              </select>`
                  : pldVendorsHtmlEsc(lid ? (CLIENTS.find(function (c) { return c.id === lid; }) || {}).name || lid : '—')
              }
            </td>
            <td>
              ${
                rest
                  ? `<button type="button" class="btn btn-ghost btn-sm" onclick="void pldOpenVendorContactsModal('${id}')">Contacts</button>`
                  : '—'
              }
            </td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
