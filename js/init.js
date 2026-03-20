/* ============================================
   Module: App Initialization
   Depends on: state.js, theme.js, navigation.js, topbar.js, command-palette.js, modal.js, router.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initNavigation();
  initSidebar();
  initCommandPalette();
  initModal();
  initTopbarActions();
  renderPage('dashboard');
});
