/* ============================================
   Venues — list + CRM contacts (API)
   ============================================ */
function pldVenuesHtmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function renderVenues() {
  const rest = typeof PLD_EVENTS_FROM_REST !== 'undefined' && PLD_EVENTS_FROM_REST;
  const hint = rest
    ? '<span style="font-size:11px;color:var(--text-tertiary);margin-left:8px;">Live data from API</span>'
    : '';
  const list = typeof VENUES !== 'undefined' && Array.isArray(VENUES) ? VENUES : [];
  return `
    <div class="page-header">
      <div><h1 class="page-title">Venues</h1><p class="page-subtitle">Locations and venue CRM contacts${hint}</p></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Venue</th><th>City</th><th></th></tr></thead>
        <tbody>
          ${list
            .map(function (v) {
              const id = String(v.id);
              return `<tr>
            <td><strong>${pldVenuesHtmlEsc(v.name)}</strong></td>
            <td style="color:var(--text-tertiary);">${pldVenuesHtmlEsc(v.city || '')}</td>
            <td>
              ${
                rest
                  ? `<button type="button" class="btn btn-ghost btn-sm" onclick="void pldOpenVenueContactsModal('${id}')">Contacts</button>`
                  : '<span style="font-size:12px;color:var(--text-tertiary);">—</span>'
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
