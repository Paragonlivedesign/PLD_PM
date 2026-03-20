/* ============================================
   Module: Page Router
   Depends on: all page render modules (dashboard, events, etc.)
   ============================================ */

function renderPage(page) {
  const content = document.getElementById('pageContent');
  if (!content) return;
  content.scrollTop = 0;
  var html = '';
  switch (page) {
    case 'dashboard': html = typeof renderDashboard === 'function' ? renderDashboard() : ''; break;
    case 'events': html = typeof renderEvents === 'function' ? renderEvents() : ''; break;
    case 'scheduling': html = typeof renderScheduling === 'function' ? renderScheduling() : ''; break;
    case 'event': html = typeof renderEventPage === 'function' ? renderEventPage() : ''; break;
    case 'personnel': html = typeof renderPersonnel === 'function' ? renderPersonnel() : ''; break;
    case 'trucks': html = typeof renderTrucks === 'function' ? renderTrucks() : ''; break;
    case 'travel': html = typeof renderTravel === 'function' ? renderTravel() : ''; break;
    case 'financial': html = typeof renderFinancial === 'function' ? renderFinancial() : ''; break;
    case 'documents': html = typeof renderDocuments === 'function' ? renderDocuments() : ''; break;
    case 'settings': html = typeof renderSettings === 'function' ? renderSettings() : ''; break;
    default: html = '<div class="empty-state"><h3>Page not found</h3></div>';
  }
  content.innerHTML = html;
  // Post-render: make dashboard stat cards clickable
  if (page === 'dashboard') {
    setTimeout(() => {
      const cards = content.querySelectorAll('.stat-card');
      const pages = ['events','events','personnel','financial'];
      cards.forEach((card, i) => { if (pages[i]) { card.style.cursor = 'pointer'; card.addEventListener('click', () => navigateTo(pages[i])); } });
      if (typeof dashboardScheduleView !== 'undefined' && dashboardScheduleView === 'timeline' && typeof initScheduleTimelineDraw === 'function') {
        initScheduleTimelineDraw();
        if (typeof initScheduleTimelineBarDnD === 'function') initScheduleTimelineBarDnD();
      }
    }, 0);
  }
  if (page === 'scheduling') {
    setTimeout(() => {
      if (scheduleView === 'timeline') {
        initScheduleTimelineDraw();
        if (typeof initScheduleTimelineBarDnD === 'function') initScheduleTimelineBarDnD();
      } else initScheduleCalendarClickAndDraw();
    }, 0);
  }
}

// ============================================
// Helper: Tab rendering
// ============================================
function tabBtn(label, tabVar, tabVal, renderFn) {
  return `<button class="tab ${window[tabVar] === tabVal ? 'active' : ''}" onclick="${tabVar}='${tabVal}'; renderPage('${renderFn}');">${label}</button>`;
}
