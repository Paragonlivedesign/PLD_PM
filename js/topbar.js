/* ============================================
   Module: Topbar — Notifications & Profile popups
   Depends on: state.js, modal.js, navigation.js
   ============================================ */

function initTopbarActions() {
  document.getElementById('notificationBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    profileOpen = false;
    notificationsOpen = !notificationsOpen;
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
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showToast('All marked as read','success'); closePopups();">Mark all read</button>
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
    const panel = document.createElement('div');
    panel.className = 'popup-panel profile-popup';
    panel.onclick = (e) => e.stopPropagation();
    panel.innerHTML = `
      <div style="padding:16px;border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent-blue),var(--accent-cyan));display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;color:#fff;">CM</div>
          <div>
            <div style="font-weight:600;font-size:14px;">Cody Martin</div>
            <div style="font-size:12px;color:var(--text-tertiary);">cody@acmeproductions.com</div>
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
          Edit Profile
        </div>
        <div class="popup-menu-item" onclick="event.stopPropagation();closePopups();setTimeout(openKeyboardShortcuts,50);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/></svg>
          Keyboard Shortcuts
        </div>
      </div>
      <div style="padding:8px;border-top:1px solid var(--border-subtle);">
        <div class="popup-menu-item" style="color:var(--accent-red);" onclick="event.stopPropagation();closePopups();showToast('Logged out','warning');">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </div>
      </div>
    `;
    document.querySelector('.topbar-right').appendChild(panel);
  }
}

function renderNotificationItems() {
  const notifications = [
    { type: 'conflict', title: 'Scheduling Conflict', desc: 'Chris Martinez double-booked Feb 16-17', time: '2 min ago', unread: true },
    { type: 'phase', title: 'Phase Advanced', desc: 'UFC 310 moved to Live', time: '15 min ago', unread: true },
    { type: 'travel', title: 'Flight Confirmed', desc: 'DL1247 JFK→LAS for Mike Thompson', time: '1 hr ago', unread: true },
    { type: 'doc', title: 'Document Generated', desc: 'Super Bowl LXI Crew Pack v3', time: '5 hrs ago', unread: false },
    { type: 'budget', title: 'Budget Alert', desc: 'UFC 310 at 94% budget utilization', time: '6 hrs ago', unread: false },
    { type: 'crew', title: 'Crew Joined', desc: 'Sarah Lee added to Super Bowl LXI', time: '8 hrs ago', unread: false },
  ];
  const typeColors = { conflict: 'var(--accent-red)', phase: 'var(--accent-blue)', travel: 'var(--accent-green)', doc: 'var(--accent-purple)', budget: 'var(--accent-amber)', crew: 'var(--accent-cyan)' };

  return notifications.map(n => `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);cursor:pointer;display:flex;gap:10px;align-items:flex-start;transition:background 150ms;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" onclick="event.stopPropagation();closePopups();setTimeout(openAllNotifications,50);">
      <div style="width:8px;height:8px;border-radius:50%;background:${n.unread ? typeColors[n.type] : 'transparent'};margin-top:6px;flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:${n.unread ? '600' : '400'};font-size:13px;">${n.title}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:1px;">${n.desc}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${n.time}</div>
      </div>
    </div>
  `).join('');
}
