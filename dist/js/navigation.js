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
  let activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (!activeNav) {
    if (page === 'task') activeNav = document.querySelector('.nav-item[data-page="tasks"]');
    else if (page === 'client') activeNav = document.querySelector('.nav-item[data-page="clients"]');
    else if (page === 'vendor') activeNav = document.querySelector('.nav-item[data-page="vendors"]');
    else if (page === 'venue') activeNav = document.querySelector('.nav-item[data-page="venues"]');
    else if (page === 'contact') {
      const k = typeof selectedContactParentKind === 'string' ? selectedContactParentKind : '';
      if (k === 'client') activeNav = document.querySelector('.nav-item[data-page="clients"]');
      else if (k === 'vendor') activeNav = document.querySelector('.nav-item[data-page="vendors"]');
      else if (k === 'venue') activeNav = document.querySelector('.nav-item[data-page="venues"]');
    } else if (page === 'personnel-profile') activeNav = document.querySelector('.nav-item[data-page="personnel"]');
  }
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
    contacts: 'Contacts',
    settings: 'Settings',
    login: 'Sign in',
    'forgot-password': 'Forgot password',
    'reset-password': 'Reset password',
    'invite-accept': 'Accept invitation',
    account: 'Account',
    'invite-user': 'Invite user',
    'platform-admin': 'Master admin',
    search: 'Search',
    tasks: 'Tasks',
    task: 'Task',
    client: 'Client',
    vendor: 'Vendor',
    venue: 'Venue',
    contact: 'Contact',
    'personnel-profile': 'Personnel profile',
  };

  const bc = document.getElementById('breadcrumb');
  if (page === 'event' && selectedEventId) {
    const ev = EVENTS.find(e => e.id === selectedEventId);
    bc.innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('events')">Events</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${ev ? ev.name : 'Event'}</span>
    `;
  } else if (page === 'client' && typeof selectedClientId !== 'undefined' && selectedClientId && typeof CLIENTS !== 'undefined') {
    const c = CLIENTS.find(x => String(x.id) === String(selectedClientId));
    bc.innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('clients')">Clients</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${c ? c.name : 'Client'}</span>
    `;
  } else if (page === 'vendor' && typeof selectedVendorId !== 'undefined' && selectedVendorId && typeof VENDORS !== 'undefined') {
    const v = VENDORS.find(x => String(x.id) === String(selectedVendorId));
    bc.innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('vendors')">Vendors</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${v ? v.name : 'Vendor'}</span>
    `;
  } else if (page === 'venue' && typeof selectedVenueId !== 'undefined' && selectedVenueId && typeof VENUES !== 'undefined') {
    const v = VENUES.find(x => String(x.id) === String(selectedVenueId));
    bc.innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('venues')">Venues</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${v ? v.name : 'Venue'}</span>
    `;
  } else if (
    page === 'contact' &&
    typeof selectedContactParentKind !== 'undefined' &&
    selectedContactId &&
    typeof window.pldCrmContactBreadcrumbHtml === 'function'
  ) {
    bc.innerHTML = window.pldCrmContactBreadcrumbHtml();
  } else if (
    page === 'personnel-profile' &&
    typeof selectedPersonnelId !== 'undefined' &&
    selectedPersonnelId &&
    typeof PERSONNEL !== 'undefined'
  ) {
    const p = PERSONNEL.find(x => String(x.id) === String(selectedPersonnelId));
    bc.innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('personnel')">Personnel</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${p ? p.name : 'Profile'}</span>
    `;
  } else if (page === 'task' && typeof selectedTaskId !== 'undefined' && selectedTaskId) {
    const row =
      typeof window.__pldTaskDetailRow !== 'undefined' && window.__pldTaskDetailRow
        ? window.__pldTaskDetailRow
        : null;
    const title = row && row.title ? row.title : 'Task';
    bc.innerHTML = `
      <span class="breadcrumb-item breadcrumb-link" onclick="navigateTo('tasks')">Tasks</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${title}</span>
    `;
  } else {
    bc.innerHTML = `
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
