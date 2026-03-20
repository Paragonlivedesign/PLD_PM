// ============================================
// SCHEDULING
// ============================================
function getScheduleWeekLabel() {
  const dates = getScheduleWeekDates();
  if (!dates.length) return '';
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return fmt(dates[0]) + ' — ' + fmt(dates[6]) + ', ' + dates[0].getFullYear();
}

function renderScheduling() {
  const conflictList = [
    { id: 'c1', resource: 'Chris Martinez', resourceId: 'p5', type: 'Double booking', events: 'NBA All-Star Weekend + Super Bowl LXI Pre-Show', dates: 'Feb 14–17' },
    { id: 'c2', resource: 'Sarah Lee', resourceId: 'p2', type: 'Double booking', events: 'UFC 310 + NBA All-Star Weekend', dates: 'Feb 17' },
  ];
  const hasConflict = conflictList.length > 0;

  return `
    <div class="page-header">
      <div><h1 class="page-title">Scheduling</h1><p class="page-subtitle">Company-wide event timeline and calendar</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="openAutoOptimizeModal()">Auto-Optimize</button>
      </div>
    </div>
    ${hasConflict ? `
      <div class="conflict-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${conflictList.length} conflict${conflictList.length !== 1 ? 's' : ''}</span><button class="btn btn-sm" style="background:rgba(239,68,68,0.2);color:var(--accent-red);border:none;margin-left:auto;" onclick="openConflictResolutionModal()">Resolve</button></div>
      <div class="conflict-summary-panel">
        <div class="conflict-summary-panel-header">Conflict summary</div>
        <div class="conflict-summary-panel-list">
          ${conflictList.map(c => `
            <div class="conflict-summary-row">
              <div class="conflict-summary-info">
                <strong>${c.resource}</strong> — ${c.type}<br>
                <span class="conflict-summary-detail">${c.events} (${c.dates})</span>
              </div>
              <button class="btn btn-ghost btn-sm" style="color:var(--accent-red);" onclick="openConflictResolutionModal()">Resolve</button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <div class="schedule-controls">
      <div class="view-toggle">
        <button class="view-toggle-btn ${scheduleView === 'timeline' ? 'active' : ''}" onclick="scheduleView='timeline'; renderPage('scheduling');">Timeline</button>
        <button class="view-toggle-btn ${scheduleView === 'calendar' ? 'active' : ''}" onclick="scheduleView='calendar'; renderPage('scheduling');">Calendar</button>
      </div>
      <select class="filter-select"><option>All Departments</option>${DEPARTMENTS.map(d => `<option>${d.name}</option>`).join('')}</select>
      <select class="filter-select"><option>All Phases</option>${PHASES.map(p => `<option>${PHASE_LABELS[p]}</option>`).join('')}</select>
      ${scheduleView === 'timeline' ? `
        <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)-1;renderPage('scheduling');">← Prev</button>
        <span style="font-weight:600;font-size:13px;">${getScheduleWeekLabel()}</span>
        <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)+1;renderPage('scheduling');">Next →</button>
      ` : ''}
    </div>
    ${scheduleView === 'calendar' ? renderScheduleCalendar({}) : renderScheduleTimeline({})}
  `;
}

function renderScheduleGrid(crew, dates, assignments) {
  return `
    <div class="schedule-grid" style="grid-template-columns: 180px repeat(${dates.length}, 1fr);">
      <div class="schedule-cell header">Crew Member</div>
      ${dates.map((d, i) => `<div class="schedule-cell header" ${i === 3 ? 'style="background:var(--accent-blue-muted);color:var(--accent-blue);"' : ''}>${d}${i === 3 ? ' (Today)' : ''}</div>`).join('')}
      ${crew.map(p => { const dept = getDepartment(p.dept); return `
        <div class="schedule-cell row-header"><div style="display:flex;align-items:center;gap:8px;"><div style="width:24px;height:24px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;">${p.initials}</div><div><div style="font-size:12px;font-weight:500;">${p.name}</div><div style="font-size:10px;color:var(--text-tertiary);">${dept.name}</div></div></div></div>
        ${dates.map((_, di) => { const key = `${p.id}-${di}`; const asgn = assignments[key]; return asgn ? `<div class="schedule-cell has-assignment" onclick="openAssignmentDetailModal('${p.id}','${asgn.event}','${asgn.status}','${dates[di]}')"><span class="assignment-chip ${asgn.status}">${asgn.event}</span></div>` : `<div class="schedule-cell" onclick="openCreateAssignmentModal('${p.id}','${dates[di]}')"></div>`; }).join('')}
      `; }).join('')}
    </div>
  `;
}

function getScheduleWeekDates() {
  const base = new Date(2026, 1, 9);
  base.setDate(base.getDate() + (scheduleWeekOffset || 0) * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function renderScheduleTimeline(opts) {
  opts = opts || {};
  const embedded = opts.embedded === true;
  const navTarget = embedded ? 'dashboard' : 'scheduling';
  const weekDates = getScheduleWeekDates();
  const dayWidth = 100;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateLabels = weekDates.map(d => {
    const short = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const isToday = d.getTime() === today.getTime();
    return { short, key: d.toISOString().slice(0, 10), isToday };
  });

  const activeEvents = EVENTS.filter(e => !['archived', 'settled'].includes(e.phase));
  const weekStart = weekDates[0].toISOString().slice(0, 10);
  const weekEnd = weekDates[6].toISOString().slice(0, 10);
  const eventsInWeek = activeEvents.filter(ev => ev.startDate <= weekEnd && ev.endDate >= weekStart);

  const phaseColors = { bidding: 'var(--text-tertiary)', awarded: '#6366f1', preproduction: 'var(--accent-purple)', production: 'var(--accent-blue)', live: 'var(--accent-red)', wrap: 'var(--accent-amber)' };

  const rowCells = dateLabels.map((d) => `<div class="timeline-row-cell" data-date="${d.key}" style="min-width:${dayWidth}px;"></div>`).join('');

  const weekNav = embedded ? `
    <div class="schedule-controls" style="margin-bottom:12px;">
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)-1;renderPage('${navTarget}');">← Prev</button>
      <span style="font-weight:600;font-size:13px;">${getScheduleWeekLabel()}</span>
      <button class="btn btn-ghost btn-sm" onclick="scheduleWeekOffset=(scheduleWeekOffset||0)+1;renderPage('${navTarget}');">Next →</button>
    </div>
  ` : '';

  return `
    ${weekNav}
    <div class="timeline-container ${embedded ? 'timeline-embedded' : ''}" id="scheduleTimelineContainer">
      <div class="timeline-header">
        <div class="timeline-label-col">Event</div>
        <div class="timeline-dates">${dateLabels.map((d, i) => `<div class="timeline-date-col ${d.isToday ? 'today' : ''}" style="min-width:${dayWidth}px;">${d.short}</div>`).join('')}</div>
      </div>
      ${eventsInWeek.length ? eventsInWeek.map(ev => {
        const start = new Date(ev.startDate + 'T00:00:00').getTime();
        const end = new Date(ev.endDate + 'T23:59:59').getTime();
        const rangeStart = Math.max(start, weekDates[0].getTime());
        const rangeEnd = Math.min(end, weekDates[6].getTime() + 86400000);
        const leftPx = ((rangeStart - weekDates[0].getTime()) / 86400000) * dayWidth + 4;
        const widthPx = Math.max(20, ((rangeEnd - rangeStart) / 86400000) * dayWidth - 4);
        const color = phaseColors[ev.phase] || 'var(--accent-blue)';
        const crewCount = (ev.crew && ev.crew.length) || 0;
        return `<div class="timeline-row"><div class="timeline-row-label"><span class="phase-badge ${ev.phase}" style="font-size:10px;padding:2px 6px;">${(PHASE_LABELS[ev.phase] || ev.phase).slice(0, 4).toUpperCase()}</span>${ev.name}</div><div class="timeline-row-cells">${rowCells}<div class="timeline-bar-wrap" data-event-id="${ev.id}" style="left:${leftPx}px;width:${widthPx}px;"><div class="timeline-bar-resize timeline-bar-resize-left" data-event-id="${ev.id}" data-edge="start" title="Resize start"></div><div class="timeline-bar" data-event-id="${ev.id}" style="background:${color};" title="${ev.name}">${ev.name.length > 24 ? ev.name.substring(0, 22) + '…' : ev.name}${crewCount ? ' — ' + crewCount + ' crew' : ''}</div><div class="timeline-bar-resize timeline-bar-resize-right" data-event-id="${ev.id}" data-edge="end" title="Resize end"></div></div></div></div>`;
      }).join('') : '<div class="timeline-row timeline-empty-row"><div class="timeline-row-label">No events this week</div><div class="timeline-row-cells">' + rowCells + '</div></div>'}
      <div class="timeline-row timeline-draw-row" id="timelineDrawRow">
        <div class="timeline-row-label" style="font-weight:600;color:var(--accent-blue);font-size:11px;">+ Draw new event</div>
        <div class="timeline-row-cells" id="timelineDrawCells">${rowCells}</div>
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">Click an event bar to open it. Drag across the “Draw new event” row to create an event for those dates.</p>
  `;
}

function scheduleBarAddDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function initScheduleTimelineBarDnD() {
  const container = document.getElementById('scheduleTimelineContainer');
  if (!container) return;
  const dayWidth = 100;
  const weekDates = getScheduleWeekDates();
  const weekStart = weekDates[0].getTime();
  const weekEnd = weekDates[6].getTime() + 86400000;

  let dragging = null;
  let startX = 0;
  let startLeft = 0;
  let startWidth = 0;
  let origStartDate = '';
  let origEndDate = '';
  let timelineBarJustDragged = false;

  function pxToDays(deltaPx) {
    return Math.round(deltaPx / dayWidth);
  }

  function commitMove(eventId, newStart, newEnd) {
    const ev = EVENTS.find(e => e.id === eventId);
    if (!ev) return;
    ev.startDate = newStart;
    ev.endDate = newEnd;
    renderPage('scheduling');
    showToast('Event dates updated', 'success');
  }

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const wrap = e.target.closest('.timeline-bar-wrap');
    if (!wrap) return;
    const eventId = wrap.getAttribute('data-event-id');
    const ev = EVENTS.find(x => x.id === eventId);
    if (!ev) return;

    const leftHandle = e.target.closest('.timeline-bar-resize-left');
    const rightHandle = e.target.closest('.timeline-bar-resize-right');
    const barBody = e.target.closest('.timeline-bar');

    const rect = wrap.getBoundingClientRect();
    startX = e.clientX;
    startLeft = parseFloat(wrap.style.left) || 0;
    startWidth = parseFloat(wrap.style.width) || 0;
    origStartDate = ev.startDate;
    origEndDate = ev.endDate;

    if (leftHandle) {
      e.preventDefault();
      dragging = 'resize-start';
    } else if (rightHandle) {
      e.preventDefault();
      dragging = 'resize-end';
    } else if (barBody) {
      e.preventDefault();
      dragging = 'move';
    } else return;

    dragging = { type: dragging, eventId, wrap };
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging || typeof dragging !== 'object') return;
    const deltaPx = e.clientX - startX;
    const deltaDays = pxToDays(deltaPx);
    const ev = EVENTS.find(x => x.id === dragging.eventId);
    if (!ev) return;

    if (dragging.type === 'move') {
      const newStart = scheduleBarAddDays(origStartDate, deltaDays);
      const newEnd = scheduleBarAddDays(origEndDate, deltaDays);
      const newStartTs = new Date(newStart + 'T00:00:00').getTime();
      const newEndTs = new Date(newEnd + 'T23:59:59').getTime();
      if (newStartTs < weekStart || newEndTs > weekEnd) return;
      dragging.wrap.style.left = (startLeft + deltaPx) + 'px';
    } else if (dragging.type === 'resize-start') {
      const newStart = scheduleBarAddDays(origStartDate, deltaDays);
      if (newStart >= origEndDate) return;
      const newStartTs = new Date(newStart + 'T00:00:00').getTime();
      if (newStartTs < weekStart) return;
      const daysDiff = (new Date(origStartDate + 'T00:00:00').getTime() - new Date(newStart + 'T00:00:00').getTime()) / 86400000;
      dragging.wrap.style.left = (startLeft + daysDiff * dayWidth) + 'px';
      dragging.wrap.style.width = (startWidth - daysDiff * dayWidth) + 'px';
    } else if (dragging.type === 'resize-end') {
      const newEnd = scheduleBarAddDays(origEndDate, deltaDays);
      if (newEnd <= origStartDate) return;
      const newEndTs = new Date(newEnd + 'T23:59:59').getTime();
      if (newEndTs > weekEnd) return;
      const daysDiff = (new Date(newEnd + 'T00:00:00').getTime() - new Date(origEndDate + 'T00:00:00').getTime()) / 86400000;
      dragging.wrap.style.width = (startWidth + daysDiff * dayWidth) + 'px';
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !dragging || typeof dragging !== 'object') return;
    const deltaPx = e.clientX - startX;
    const deltaDays = pxToDays(deltaPx);
    const ev = EVENTS.find(x => x.id === dragging.eventId);
    timelineBarJustDragged = true;
    if (ev) {
      if (dragging.type === 'move') {
        const newStart = scheduleBarAddDays(origStartDate, deltaDays);
        const newEnd = scheduleBarAddDays(origEndDate, deltaDays);
        commitMove(dragging.eventId, newStart, newEnd);
      } else if (dragging.type === 'resize-start') {
        const newStart = scheduleBarAddDays(origStartDate, deltaDays);
        if (newStart < origEndDate) {
          ev.startDate = newStart;
          renderPage('scheduling');
          showToast('Event start date updated', 'success');
        }
      } else if (dragging.type === 'resize-end') {
        const newEnd = scheduleBarAddDays(origEndDate, deltaDays);
        if (newEnd > origStartDate) {
          ev.endDate = newEnd;
          renderPage('scheduling');
          showToast('Event end date updated', 'success');
        }
      }
    }
    dragging = null;
    setTimeout(() => { timelineBarJustDragged = false; }, 100);
  });

  container.addEventListener('click', (e) => {
    if (timelineBarJustDragged) return;
    const bar = e.target.closest('.timeline-bar');
    if (!bar || e.target.closest('.timeline-bar-resize')) return;
    const wrap = bar.closest('.timeline-bar-wrap');
    if (wrap) {
      e.preventDefault();
      e.stopPropagation();
      navigateToEvent(wrap.getAttribute('data-event-id'));
    }
  }, true);
}

function initScheduleTimelineDraw() {
  const container = document.getElementById('timelineDrawCells');
  if (!container) return;
  let startDate = null;
  let selecting = false;
  const cells = container.querySelectorAll('.timeline-row-cell');
  function dateAt(clientX) {
    const rect = container.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right) return null;
    const i = Math.floor((clientX - rect.left) / (rect.width / 7));
    const cell = cells[Math.min(i, cells.length - 1)];
    return cell ? cell.getAttribute('data-date') : null;
  }
  function clearHighlight() {
    cells.forEach(c => c.classList.remove('timeline-draw-highlight')); selecting = false;
  }
  container.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    startDate = dateAt(e.clientX);
    if (startDate) { selecting = true; clearHighlight(); const c = Array.from(cells).find(el => el.getAttribute('data-date') === startDate); if (c) c.classList.add('timeline-draw-highlight'); }
  });
  container.addEventListener('mousemove', e => {
    if (!selecting || !startDate) return;
    const endDate = dateAt(e.clientX);
    if (!endDate) return;
    clearHighlight();
    const dates = cells.map(c => c.getAttribute('data-date')).filter(Boolean);
    const i0 = dates.indexOf(startDate);
    const i1 = dates.indexOf(endDate);
    if (i0 === -1 || i1 === -1) return;
    const [a, b] = i0 <= i1 ? [i0, i1] : [i1, i0];
    for (let i = a; i <= b; i++) cells[i].classList.add('timeline-draw-highlight');
  });
  document.addEventListener('mouseup', e => {
    if (e.button !== 0 || !selecting) return;
    const endDate = dateAt(e.clientX);
    if (startDate && endDate) {
      const dates = cells.map(c => c.getAttribute('data-date')).filter(Boolean);
      const i0 = dates.indexOf(startDate);
      const i1 = dates.indexOf(endDate);
      if (i0 !== -1 && i1 !== -1) {
        const [d1, d2] = i0 <= i1 ? [dates[i0], dates[i1]] : [dates[i1], dates[i0]];
        openNewEventModal(d1, d2);
      }
    }
    clearHighlight();
    startDate = null;
  });
}

function renderScheduleCalendar(opts) {
  opts = opts || {};
  const embedded = opts.embedded === true;
  const navTarget = embedded ? 'dashboard' : 'scheduling';
  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();
  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const eventColors = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#f97316','#ec4899','#14b8a6','#6366f1','#f43f5e','#84cc16'];

  function eventsOnDay(day) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return EVENTS.filter(ev => {
      return !['archived','settled'].includes(ev.phase) && ev.startDate <= dateStr && ev.endDate >= dateStr;
    });
  }

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div class="cal-cell cal-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayEvents = eventsOnDay(d);
    const eventIds = dayEvents.map(ev => ev.id).join('|||');
    cells += `<div class="cal-cell cal-cell-clickable ${isToday ? 'cal-today' : ''}" onclick="openCalendarDayModal('${dateStr}','${eventIds}')">
      <div class="cal-day-num ${isToday ? 'today-num' : ''}">${d}</div>
      ${dayEvents.slice(0, 3).map((ev, i) => {
        const ci = EVENTS.indexOf(ev) % eventColors.length;
        return `<div class="cal-event-chip" style="background:${eventColors[ci]}20;color:${eventColors[ci]};border-left:3px solid ${eventColors[ci]};" onclick="event.stopPropagation();navigateToEvent('${ev.id}')">${ev.name.length > 18 ? ev.name.substring(0,16)+'…' : ev.name}</div>`;
      }).join('')}
      ${dayEvents.length > 3 ? `<div class="cal-more" onclick="event.stopPropagation();">+${dayEvents.length - 3} more</div>` : ''}
      ${dayEvents.length === 0 ? '<div class="cal-add-hint">+ Add</div>' : ''}
    </div>`;
  }
  const remaining = (firstDay + daysInMonth) % 7;
  if (remaining > 0) for (let i = 0; i < 7 - remaining; i++) cells += '<div class="cal-cell cal-empty"></div>';

  return `
    <div class="calendar-container ${embedded ? 'calendar-embedded' : ''}">
      <div class="cal-nav">
        <button class="btn btn-ghost btn-sm" onclick="calendarMonth=new Date(${y},${m-1});renderPage('${navTarget}');">← Prev</button>
        <h3 class="cal-month-title">${monthName}</h3>
        <button class="btn btn-ghost btn-sm" onclick="calendarMonth=new Date(${y},${m+1});renderPage('${navTarget}');">Next →</button>
      </div>
      <div class="cal-grid" id="${embedded ? 'dashboardCalGrid' : 'scheduleCalGrid'}">
        <div class="cal-header">Sun</div><div class="cal-header">Mon</div><div class="cal-header">Tue</div>
        <div class="cal-header">Wed</div><div class="cal-header">Thu</div><div class="cal-header">Fri</div><div class="cal-header">Sat</div>
        ${cells}
      </div>
    </div>
  `;
}
