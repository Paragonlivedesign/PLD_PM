/* ============================================
   Module: Command Palette (Ctrl+K)
   Depends on: state.js, data.js, navigation.js
   ============================================ */

/** Close palette, stash query, open full search page (see pld-search-page.js). */
window.pldNavigateToFullSearch = function pldNavigateToFullSearch(query) {
  const pal = document.getElementById('commandPalette');
  if (pal) pal.classList.add('hidden');
  window.__pldSearchPageQuery = typeof query === 'string' ? query : '';
  if (typeof navigateTo === 'function') navigateTo('search');
  setTimeout(function () {
    if (typeof pldHydrateSearchPage === 'function') pldHydrateSearchPage();
  }, 0);
};

function initCommandPalette() {
  const palette = document.getElementById('commandPalette');
  const input = document.getElementById('commandInput');
  const results = document.getElementById('commandResults');

  document.getElementById('searchTrigger').addEventListener('click', openPalette);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
    }
    if (e.key === 'Escape') closePalette();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.closest('input, textarea, [contenteditable="true"]')) {
      if (e.shiftKey) {
        e.preventDefault();
        if (typeof showToast === 'function') showToast('Redo: re-added Sarah Lee to NBA All-Star Weekend', 'success');
      } else {
        e.preventDefault();
        if (typeof showToast === 'function') showToast('Undo: removed Sarah Lee from NBA All-Star Weekend', 'info');
      }
    }
  });

  palette.querySelector('.command-palette-backdrop').addEventListener('click', closePalette);

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    renderCommandResults(query, results);
  });

  function openPalette() {
    palette.classList.remove('hidden');
    input.value = '';
    input.focus();
    renderCommandResults('', results);
  }

  function closePalette() {
    palette.classList.add('hidden');
  }
}

function renderCommandResults(query, container) {
  let html = '';

  const matchedEvents = EVENTS.filter(e =>
    !query || e.name.toLowerCase().includes(query) || PHASE_LABELS[e.phase].toLowerCase().includes(query)
  ).slice(0, 5);

  if (matchedEvents.length) {
    html += '<div class="command-result-group"><div class="command-result-group-label">Events</div>';
    matchedEvents.forEach(ev => {
      html += `<div class="command-result-item" onclick="document.getElementById('commandPalette').classList.add('hidden'); navigateToEvent('${ev.id}');">
        <div class="result-icon" style="background: var(--accent-blue-muted); color: var(--accent-blue);">EV</div>
        <div><div style="font-weight:500;">${ev.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${PHASE_LABELS[ev.phase]} · ${getVenue(ev.venue).name}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  const matchedPersonnel = PERSONNEL.filter(p =>
    !query || p.name.toLowerCase().includes(query) || p.role.toLowerCase().includes(query)
  ).slice(0, 5);

  if (matchedPersonnel.length) {
    html += '<div class="command-result-group"><div class="command-result-group-label">Personnel</div>';
    matchedPersonnel.forEach(p => {
      html += `<div class="command-result-item" onclick="document.getElementById('commandPalette').classList.add('hidden'); openPersonnelDetail('${p.id}');">
        <div class="result-icon" style="background: ${p.avatar}30; color: ${p.avatar};">${p.initials}</div>
        <div><div style="font-weight:500;">${p.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${p.role}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  const matchedTrucks = TRUCKS.filter(t =>
    !query || t.name.toLowerCase().includes(query) || t.type.toLowerCase().includes(query)
  ).slice(0, 3);

  if (matchedTrucks.length && query) {
    html += '<div class="command-result-group"><div class="command-result-group-label">Trucks</div>';
    matchedTrucks.forEach(t => {
      html += `<div class="command-result-item" onclick="document.getElementById('commandPalette').classList.add('hidden'); openTruckDetail('${t.id}');">
        <div class="result-icon" style="background: var(--accent-amber-muted); color: var(--accent-amber);">TK</div>
        <div><div style="font-weight:500;">${t.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${t.type} · ${t.location}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  if (!query || 'navigate'.includes(query) || 'go to'.includes(query)) {
    html += '<div class="command-result-group"><div class="command-result-group-label">Commands</div>';
    const navPages = [
      ['dashboard', 'Dashboard'],
      ['events', 'Events'],
      ['scheduling', 'Scheduling'],
      ['personnel', 'Personnel'],
      ['trucks', 'Trucks'],
      ['travel', 'Travel'],
      ['financial', 'Financial'],
      ['documents', 'Documents'],
      ['clients', 'Clients'],
      ['venues', 'Venues'],
      ['vendors', 'Vendors'],
      ['platform-admin', 'Master admin'],
      ['settings', 'Settings'],
    ];
    navPages.forEach(([page, label]) => {
      const qok = !query || page.includes(query) || label.toLowerCase().includes(query);
      if (qok) {
        html += `<div class="command-result-item" onclick="document.getElementById('commandPalette').classList.add('hidden'); navigateTo('${page}');">
          <div class="result-icon" style="background: var(--bg-tertiary); color: var(--text-secondary);">→</div>
          <div style="font-weight:500;">Go to ${label}</div>
        </div>`;
      }
    });
    html += '</div>';
  }

  container.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--text-tertiary);">No results found</div>';

  const q = query.trim();
  if (typeof window.pldApiFetch !== 'function' || q.length < 2) return;
  const slot = document.createElement('div');
  slot.id = 'pldCmdApiSearch';
  container.appendChild(slot);
  slot.innerHTML =
    '<div class="command-result-group"><div class="command-result-group-label">API search</div><div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary);">Searching…</div></div>';
  void window
    .pldApiFetch('/api/v1/search?q=' + encodeURIComponent(q) + '&limit=4')
    .then((r) => {
      if (!r.ok || !r.body || !r.body.data || !r.body.data.results) {
        slot.innerHTML =
          '<div class="command-result-group"><div class="command-result-group-label">API search</div><div style="padding:8px 12px;font-size:12px;color:var(--accent-amber);">Unavailable</div></div>';
        return;
      }
      const groups = r.body.data.results;
      const parts = [];
      for (const et of Object.keys(groups)) {
        const items = groups[et] || [];
        for (const it of items.slice(0, 3)) {
          const title = String(it.title || '').replace(/</g, '&lt;');
          const sub = String(it.subtitle || '').replace(/</g, '&lt;');
          parts.push(`<div class="command-result-item" onclick="document.getElementById('commandPalette').classList.add('hidden'); navigateTo('events');">
        <div class="result-icon" style="background: var(--bg-tertiary); color: var(--text-secondary);">${et.slice(0, 2).toUpperCase()}</div>
        <div><div style="font-weight:500;">${title}</div><div style="font-size:11px;color:var(--text-tertiary);">${et} · ${sub}</div></div>
      </div>`);
        }
      }
      const viewAll =
        '<div class="command-result-item" onclick=\'pldNavigateToFullSearch(' +
        JSON.stringify(q) +
        ')\'>' +
        '<div class="result-icon" style="background: var(--accent-blue-muted); color: var(--accent-blue);">↗</div>' +
        '<div style="font-weight:500;">View all API results</div></div>';
      slot.innerHTML =
        '<div class="command-result-group"><div class="command-result-group-label">API search</div>' +
        (parts.length ? parts.join('') : '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary);">No API matches</div>') +
        viewAll +
        '</div>';
    });
}
