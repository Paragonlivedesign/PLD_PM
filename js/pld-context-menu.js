/* ============================================
   Shared context menu (right-click)
   Depends on: (none) — attach after body exists
   ============================================ */

(function () {
  let menuEl = null;
  let teardown = null;

  function closeMenu() {
    if (teardown) {
      teardown();
      teardown = null;
    }
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
  }

  window.pldCloseContextMenu = closeMenu;

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {Array<{ label: string, action?: () => void, danger?: boolean }>} items
   */
  window.pldShowContextMenu = function pldShowContextMenu(clientX, clientY, items) {
    closeMenu();
    if (!items || !items.length) return;
    menuEl = document.createElement('div');
    menuEl.className = 'pld-context-menu';
    menuEl.setAttribute('role', 'menu');
    items.forEach(function (it) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pld-context-menu-item' + (it.danger ? ' is-danger' : '');
      b.setAttribute('role', 'menuitem');
      b.textContent = it.label;
      b.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        if (typeof it.action === 'function') it.action();
      };
      menuEl.appendChild(b);
    });
    menuEl.style.left = '-9999px';
    menuEl.style.top = '-9999px';
    document.body.appendChild(menuEl);

    const pad = 6;
    const rect = menuEl.getBoundingClientRect();
    let x = clientX;
    let y = clientY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x + rect.width > vw - pad) x = Math.max(pad, vw - rect.width - pad);
    if (y + rect.height > vh - pad) y = Math.max(pad, vh - rect.height - pad);
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';

    const onDocMouseDown = function (e) {
      if (menuEl && !menuEl.contains(/** @type {Node} */ (e.target))) closeMenu();
    };
    const onKey = function (e) {
      if (e.key === 'Escape') closeMenu();
    };
    const onScroll = function () {
      closeMenu();
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    teardown = function () {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  };
})();
