/* ============================================
   Module: Topbar — Notifications & Profile popups
   Depends on: state.js, modal.js, navigation.js
   ============================================ */

function pldTopbarEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function pldSessionProfileChip() {
  const u = typeof window.pldAuthGetUserJson === 'function' ? window.pldAuthGetUserJson() : null;
  if (!u) return { name: 'Not signed in', email: '', initials: '—' };
  const fn = String(u.first_name || '').trim();
  const ln = String(u.last_name || '').trim();
  const name = [fn, ln].filter(Boolean).join(' ') || String(u.email || 'User');
  let initials = '—';
  if (fn || ln) initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase();
  else if (u.email) initials = String(u.email).slice(0, 2).toUpperCase();
  return { name, email: String(u.email || ''), initials: initials.slice(0, 3) };
}

function initTopbarActions() {
  document.getElementById('notificationBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    profileOpen = false;
    notificationsOpen = !notificationsOpen;
    if (notificationsOpen && typeof pldPrefetchNotifications === 'function') {
      await pldPrefetchNotifications();
    } else if (typeof pldUpdateNotificationBadge === 'function') {
      pldUpdateNotificationBadge();
    }
    renderPopups();
  });

  document.querySelector('.topbar-avatar').addEventListener('click', (e) => {
    e.stopPropagation();
    notificationsOpen = false;
    profileOpen = !profileOpen;
    renderPopups();
  });

  document.addEventListener('click', () => {
    closePopups();
  });
}

function closePopups() {
  notificationsOpen = false;
  profileOpen = false;
  renderPopups();
}

function renderPopups() {
  // Remove existing
  document.querySelectorAll('.popup-panel').forEach(el => el.remove());

  if (notificationsOpen) {
    const panel = document.createElement('div');
    panel.className = 'popup-panel';
    panel.onclick = (e) => e.stopPropagation();
    panel.innerHTML = `
      <div style="padding:16px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-weight:600;font-size:14px;">Notifications</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); void pldTopbarMarkAllNotificationsRead();">Mark all read</button>
      </div>
      <div style="max-height:400px;overflow-y:auto;">
        ${renderNotificationItems()}
      </div>
      <div style="padding:12px;border-top:1px solid var(--border-subtle);text-align:center;">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();closePopups();setTimeout(openAllNotifications,50);">View all notifications</button>
      </div>
    `;
    document.querySelector('.topbar-right').appendChild(panel);
  }

  if (profileOpen) {
    const chip = pldSessionProfileChip();
    const panel = document.createElement('div');
    panel.className = 'popup-panel profile-popup';
    panel.onclick = (e) => e.stopPropagation();
    panel.innerHTML = `
      <div style="padding:16px;border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent-blue),var(--accent-cyan));display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;color:#fff;">${pldTopbarEsc(chip.initials)}</div>
          <div>
            <div style="font-weight:600;font-size:14px;">${pldTopbarEsc(chip.name)}</div>
            <div style="font-size:12px;color:var(--text-tertiary);">${pldTopbarEsc(chip.email || '—')}</div>
          </div>
        </div>
      </div>
      <div style="padding:8px;">
        <div class="popup-menu-item" onclick="event.stopPropagation();closePopups();setTimeout(()=>navigateTo('settings'),50);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </div>
        <div class="popup-menu-item" onclick="event.stopPropagation();closePopups();setTimeout(openProfileEditor,50);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Account
        </div>
        <div class="popup-menu-item" onclick="event.stopPropagation();closePopups();setTimeout(openKeyboardShortcuts,50);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/></svg>
          Keyboard Shortcuts
        </div>
      </div>
      <div style="padding:8px;border-top:1px solid var(--border-subtle);">
        <div class="popup-menu-item" style="color:var(--accent-red);" onclick="event.stopPropagation();closePopups();void (async()=>{ if (typeof pldAuthLogoutRemote==='function') await pldAuthLogoutRemote(); if (typeof pldUpdateApiSignInLink==='function') pldUpdateApiSignInLink(); if (typeof pldApplySessionIdentityChrome==='function') pldApplySessionIdentityChrome(); if (typeof pldRefreshPlatformAdminNav==='function') void pldRefreshPlatformAdminNav(); showToast('Logged out','warning'); navigateTo('login'); })();">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </div>
      </div>
    `;
    document.querySelector('.topbar-right').appendChild(panel);
  }
}

function renderNotificationItems() {
  const apiRows =
    typeof window !== 'undefined' && window.__pldNotificationApi && window.__pldNotificationApi.rows;
  if (apiRows && apiRows.length) {
    return apiRows
      .map((n) => {
        const title = String(n.title || n.type || 'Notification').replace(/</g, '&lt;');
        const body = String(n.body || n.message || '').replace(/</g, '&lt;');
        const unread = n.read_at == null;
        const t = n.created_at ? String(n.created_at).slice(0, 16) : '';
        return `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);cursor:pointer;display:flex;gap:10px;align-items:flex-start;" onclick="event.stopPropagation();closePopups();">
      <div style="width:8px;height:8px;border-radius:50%;background:${unread ? 'var(--accent-blue)' : 'transparent'};margin-top:6px;flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:${unread ? '600' : '400'};font-size:13px;">${title}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:1px;">${body}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${t}</div>
      </div>
    </div>`;
      })
      .join('');
  }
  return `
    <div style="padding:20px 16px;text-align:center;">
      <p style="margin:0;font-size:13px;color:var(--text-tertiary);">No notifications from the API yet.</p>
      <p style="margin:8px 0 0;font-size:12px;color:var(--text-tertiary);">Connect to PostgreSQL and use <code style="font-size:11px;">/api/v1/notifications</code> when available.</p>
    </div>`;
}

window.pldTopbarMarkAllNotificationsRead = async function pldTopbarMarkAllNotificationsRead() {
  if (typeof pldMarkAllNotificationsReadViaApi === 'function') {
    await pldMarkAllNotificationsReadViaApi();
  }
  if (typeof pldPrefetchNotifications === 'function') {
    await pldPrefetchNotifications();
  } else if (typeof pldUpdateNotificationBadge === 'function') {
    pldUpdateNotificationBadge();
  }
  if (typeof showToast === 'function') showToast('All marked as read', 'success');
  closePopups();
};
