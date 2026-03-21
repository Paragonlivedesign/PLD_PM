/* ============================================
   Module: Navigation & Sidebar
   Depends on: state.js
   ============================================ */

function initNavigation() {
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (!sidebarNav) return;
  sidebarNav.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    const page = item.getAttribute('data-page');
    if (!page) return;
    navigateTo(page);
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  const labels = {
    dashboard: 'Dashboard',
    events: 'Events',
    event: 'Event',
    scheduling: 'Scheduling',
    personnel: 'Personnel',
    trucks: 'Trucks',
    travel: 'Travel & Logistics',
    financial: 'Financial',
    documents: 'Documents',
    clients: 'Clients',
    venues: 'Venues',
    vendors: 'Vendors',
    settings: 'Settings',
    login: 'Sign in',
    'forgot-password': 'Forgot password',
    'reset-password': 'Reset password',
    'invite-accept': 'Accept invitation',
    account: 'Account',
    'invite-user': 'Invite user',
    'platform-admin': 'Master admin',
    search: 'Search',
  };

  if (page === 'event' && selectedEventId) {
    const ev = EVENTS.find(e => e.id === selectedEventId);
    document.getElementById('breadcrumb').innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('events')">Events</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${ev ? ev.name : 'Event'}</span>
    `;
  } else {
    document.getElementById('breadcrumb').innerHTML = `
      <span class="breadcrumb-item">${labels[page] || page}</span>
    `;
  }

  document.getElementById('sidebar').classList.remove('mobile-open');
  closePopups();
  renderPage(page);
  if (typeof window.history !== 'undefined' && window.history.replaceState) window.history.replaceState({}, '', window.location.pathname || window.location.href.split('#')[0] || '/');
}

// ============================================
// Sidebar
// ============================================
function initSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });
}

/** Sidebar Production nav: reflect live EVENTS / PERSONNEL lengths (not static demo numbers). */
function updateSidebarNavCounts() {
  const evBadge = document.getElementById('navBadgeEvents');
  const peBadge = document.getElementById('navBadgePersonnel');
  const nEv = typeof EVENTS !== 'undefined' && Array.isArray(EVENTS) ? EVENTS.length : 0;
  const nPe =
    typeof PERSONNEL !== 'undefined' && Array.isArray(PERSONNEL) ? PERSONNEL.length : 0;
  if (evBadge) {
    evBadge.textContent = nEv ? String(nEv) : '';
    if (nEv > 0) evBadge.removeAttribute('hidden');
    else evBadge.setAttribute('hidden', '');
  }
  if (peBadge) {
    peBadge.textContent = nPe ? String(nPe) : '';
    if (nPe > 0) peBadge.removeAttribute('hidden');
    else peBadge.setAttribute('hidden', '');
  }
}

if (typeof window !== 'undefined') {
  window.updateSidebarNavCounts = updateSidebarNavCounts;
  window.addEventListener('pld-data-ready', function () {
    updateSidebarNavCounts();
  });
  window.addEventListener('pld-rest-events-synced', function () {
    updateSidebarNavCounts();
  });
}
