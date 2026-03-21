/* ============================================
   Tasks / roadmap — list, detail, console, week calendar, modals
   ============================================ */
window.__pldTasksCache = window.__pldTasksCache || [];
window.__pldTasksFilters = window.__pldTasksFilters || {
  status: '',
  priority: '',
  search: '',
  event_id: '',
  mine: false,
};
window.__pldTasksSelectedIds = window.__pldTasksSelectedIds || {};
window.__pldTasksConsoleView = window.__pldTasksConsoleView || 'all-open';
window.__pldTasksWeekStart = window.__pldTasksWeekStart || null;

function pldTasksEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function pldTasksUseApi() {
  return typeof window.pldApiFetch === 'function';
}

async function pldTasksFetchList() {
  if (!pldTasksUseApi()) return [];
  const f = window.__pldTasksFilters || {};
  const q = new URLSearchParams();
  q.set('parent_task_id', 'root');
  q.set('limit', '100');
  if (f.status) q.set('status', f.status);
  if (f.priority) q.set('priority', f.priority);
  if (f.search) q.set('search', f.search);
  if (f.event_id) q.set('event_id', f.event_id);
  if (f.mine) q.set('mine', 'true');
  const r = await window.pldApiFetch('/api/v1/tasks?' + q.toString(), { method: 'GET' });
  if (!r.ok || !r.body || !r.body.data) return [];
  return Array.isArray(r.body.data) ? r.body.data : [];
}

async function pldTasksFetchOne(id) {
  if (!pldTasksUseApi() || !id) return null;
  const r = await window.pldApiFetch('/api/v1/tasks/' + encodeURIComponent(id), { method: 'GET' });
  if (!r.ok || !r.body || !r.body.data) return null;
  return r.body.data;
}

async function pldTasksFetchChildren(parentId) {
  if (!pldTasksUseApi() || !parentId) return [];
  const q = new URLSearchParams();
  q.set('parent_task_id', parentId);
  q.set('limit', '100');
  const r = await window.pldApiFetch('/api/v1/tasks?' + q.toString(), { method: 'GET' });
  if (!r.ok || !r.body || !r.body.data) return [];
  return Array.isArray(r.body.data) ? r.body.data : [];
}

function pldTasksPersonnelName(pid) {
  if (!pid || typeof PERSONNEL === 'undefined' || !Array.isArray(PERSONNEL)) return '—';
  const p = PERSONNEL.find(function (x) {
    return String(x.id) === String(pid);
  });
  return p ? p.name || p.email : '—';
}

function pldTasksEventName(eid) {
  if (!eid || typeof EVENTS === 'undefined' || !Array.isArray(EVENTS)) return '—';
  const e = EVENTS.find(function (x) {
    return String(x.id) === String(eid);
  });
  return e ? e.name : '—';
}

function pldTasksTypeIcon(tt) {
  if (tt === 'milestone') return '◆';
  if (tt === 'checklist') return '☰';
  return '▪';
}

function pldTasksStatusClass(st) {
  return 'pld-task-status--' + String(st || 'open').replace(/[^a-z_]/g, '_');
}

function renderTasks() {
  if (typeof tasksViewMode !== 'undefined' && tasksViewMode === 'calendar') {
    return renderTasksWeekCalendar();
  }
  if (typeof tasksViewMode !== 'undefined' && tasksViewMode === 'console') {
    return renderTasksConsole();
  }
  return renderTasksList();
}

function renderTasksList() {
  var rows = window.__pldTasksCache || [];
  var f = window.__pldTasksFilters || {};
  var sel = window.__pldTasksSelectedIds || {};
  var selectedCount = Object.keys(sel).filter(function (k) {
    return sel[k];
  }).length;

  var filterToolbar =
    '<tr class="pld-filter-row"><td colspan="9">' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">' +
    '<div class="form-group" style="margin:0;"><label class="form-label">Status</label>' +
    '<select class="form-input form-input-sm pld-filter-cell" data-filter-key="status" id="tsk_status">' +
    ['', 'open', 'in_progress', 'blocked', 'done', 'cancelled']
      .map(function (s) {
        var lab = !s ? 'Any' : s;
        return (
          '<option value="' +
          s +
          '"' +
          (String(f.status || '') === s ? ' selected' : '') +
          '>' +
          lab +
          '</option>'
        );
      })
      .join('') +
    '</select></div>' +
    '<div class="form-group" style="margin:0;"><label class="form-label">Priority</label>' +
    '<select class="form-input form-input-sm pld-filter-cell" data-filter-key="priority" id="tsk_priority">' +
    ['', 'low', 'normal', 'high', 'urgent']
      .map(function (s) {
        return (
          '<option value="' +
          s +
          '"' +
          (String(f.priority || '') === s ? ' selected' : '') +
          '>' +
          (s || 'Any') +
          '</option>'
        );
      })
      .join('') +
    '</select></div>' +
    '<div class="form-group" style="margin:0;min-width:160px;"><label class="form-label">Search</label>' +
    '<input type="search" class="form-input form-input-sm pld-filter-cell" data-filter-key="search" id="tsk_search" value="' +
    pldTasksEsc(f.search || '') +
    '"></div>' +
    '<div class="form-group" style="margin:0;min-width:200px;"><label class="form-label">Event ID</label>' +
    '<input type="search" class="form-input form-input-sm pld-filter-cell" data-filter-key="event_id" id="tsk_event_id" placeholder="UUID" value="' +
    pldTasksEsc(f.event_id || '') +
    '"></div>' +
    '</div></td></tr>';

  var tbody = rows
    .map(function (t) {
      var ck = sel[t.id] ? 'checked' : '';
      return (
        '<tr data-task-id="' +
        pldTasksEsc(t.id) +
        '">' +
        '<td><input type="checkbox" class="pld-task-row-cb" data-id="' +
        pldTasksEsc(t.id) +
        '" ' +
        ck +
        '></td>' +
        '<td><span class="pld-task-type-icon" title="' +
        pldTasksEsc(t.task_type) +
        '">' +
        pldTasksTypeIcon(t.task_type) +
        '</span></td>' +
        '<td><a href="javascript:void(0)" class="pld-task-title-link" data-id="' +
        pldTasksEsc(t.id) +
        '">' +
        pldTasksEsc(t.title) +
        '</a></td>' +
        '<td><span class="' +
        pldTasksStatusClass(t.status) +
        '">' +
        pldTasksEsc(t.status) +
        '</span></td>' +
        '<td>' +
        pldTasksEsc(t.priority) +
        '</td>' +
        '<td>' +
        pldTasksEsc(pldTasksPersonnelName(t.assignee_personnel_id)) +
        '</td>' +
        '<td>' +
        pldTasksEsc(t.due_at ? String(t.due_at).slice(0, 10) : '—') +
        '</td>' +
        '<td>' +
        pldTasksEsc(pldTasksEventName(t.event_id)) +
        '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" onclick=\'pldOpenTaskEditorModal(' +
        JSON.stringify(t.id != null ? String(t.id) : '') +
        ')\'>Edit</button></td>' +
        '</tr>'
      );
    })
    .join('');

  var bulk =
    selectedCount > 0
      ? '<div class="pld-bulk-bar"><span>' +
        selectedCount +
        ' selected</span> <button type="button" class="btn btn-primary btn-sm" onclick="pldTasksBulkSetStatus(\'done\')">Mark done</button> <button type="button" class="btn btn-ghost btn-sm" onclick="pldTasksBulkClear()">Clear</button></div>'
      : '';

  var err =
    window.__pldTasksLoadError
      ? '<div class="pld-directory-error" role="alert">' + pldTasksEsc(window.__pldTasksLoadError) + '</div>'
      : '';

  return (
    '<div class="pld-tasks-page">' +
    '<div class="page-header pld-directory-page-header">' +
    '<div><h1 class="page-title">Tasks</h1>' +
    '<p class="page-subtitle">Roadmap and operational work — tenant-scoped</p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
    '<div class="pld-tasks-view-switch">' +
    '<button type="button" class="' +
    (typeof tasksViewMode !== 'undefined' && tasksViewMode === 'list' ? 'active' : '') +
    '" onclick="tasksViewMode=\'list\';renderPage(\'tasks\')">List</button>' +
    '<button type="button" class="' +
    (typeof tasksViewMode !== 'undefined' && tasksViewMode === 'console' ? 'active' : '') +
    '" onclick="tasksViewMode=\'console\';renderPage(\'tasks\')">Console</button>' +
    '<button type="button" class="' +
    (typeof tasksViewMode !== 'undefined' && tasksViewMode === 'calendar' ? 'active' : '') +
    '" onclick="tasksViewMode=\'calendar\';renderPage(\'tasks\')">Week</button>' +
    '</div>' +
    '<button type="button" class="btn btn-primary" onclick="pldOpenTaskEditorModal(\'\')">+ New task</button>' +
    '</div></div>' +
    err +
    '<div class="pld-tasks-toolbar">' +
    '<label class="form-label" style="margin:0;"><input type="checkbox" id="pldTasksMine" ' +
    (f.mine ? 'checked' : '') +
    ' onchange="pldTasksSetMine(this.checked)"> Mine only</label>' +
    '<button type="button" class="btn btn-ghost btn-sm" onclick="void pldTasksRefresh()">Refresh</button>' +
    '</div>' +
    bulk +
    '<div class="table-wrap pld-data-table-wrap">' +
    '<table class="data-table pld-directory-table">' +
    '<thead><tr>' +
    '<th style="width:36px;"></th>' +
    '<th style="width:40px;">Type</th>' +
    '<th>Title</th>' +
    '<th>Status</th>' +
    '<th>Priority</th>' +
    '<th>Assignee</th>' +
    '<th>Due</th>' +
    '<th>Event</th>' +
    '<th></th>' +
    '</tr>' +
    filterToolbar +
    '</thead><tbody>' +
    (tbody ||
      '<tr><td colspan="9" class="empty-table-msg">No tasks yet. Create one or adjust filters.</td></tr>') +
    '</tbody></table></div></div>'
  );
}

window.pldTasksSetMine = function (on) {
  window.__pldTasksFilters = window.__pldTasksFilters || {};
  window.__pldTasksFilters.mine = !!on;
  void pldTasksRefresh();
};

window.pldTasksBulkClear = function () {
  window.__pldTasksSelectedIds = {};
  renderPage('tasks', { skipModuleDataFetch: true });
};

window.pldTasksBulkSetStatus = async function (status) {
  var sel = window.__pldTasksSelectedIds || {};
  var ids = Object.keys(sel).filter(function (k) {
    return sel[k];
  });
  if (!ids.length || !pldTasksUseApi()) return;
  var r = await window.pldApiFetch('/api/v1/tasks/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ task_ids: ids, patch: { status: status } }),
  });
  if (r.ok) {
    window.__pldTasksSelectedIds = {};
    await pldTasksRefresh();
  }
};

window.pldOpenTaskEditorModal = async function (taskId) {
  if (typeof openModal !== 'function') return;
  var id = taskId ? String(taskId) : '';
  var existing = id ? await pldTasksFetchOne(id) : null;
  var title0 = existing ? String(existing.title || '') : '';
  var desc0 = existing && existing.description != null ? String(existing.description) : '';
  var st0 = existing ? String(existing.status || 'open') : 'open';
  var pr0 = existing ? String(existing.priority || 'normal') : 'normal';
  var tt0 = existing ? String(existing.task_type || 'task') : 'task';
  var ev0 = existing && existing.event_id ? String(existing.event_id) : '';
  var as0 = existing && existing.assignee_personnel_id ? String(existing.assignee_personnel_id) : '';
  var due0 = existing && existing.due_at ? String(existing.due_at).slice(0, 16) : '';
  var pct0 = existing && existing.completion_percent != null ? String(existing.completion_percent) : '';

  var body =
    '<input type="hidden" id="pldTaskFormId" value="' +
    pldTasksEsc(id) +
    '">' +
    '<div class="form-group"><label class="form-label">Title <span style="color:#b91c1c">*</span></label>' +
    '<input type="text" class="form-input" id="pldTaskFormTitle" value="' +
    pldTasksEsc(title0) +
    '" maxlength="500"></div>' +
    '<div class="form-group"><label class="form-label">Description</label>' +
    '<textarea class="form-input" id="pldTaskFormDesc" rows="3">' +
    pldTasksEsc(desc0) +
    '</textarea></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
    '<div class="form-group"><label class="form-label">Status</label>' +
    '<select class="form-input" id="pldTaskFormStatus">' +
    ['open', 'in_progress', 'blocked', 'done', 'cancelled']
      .map(function (s) {
        return '<option value="' + s + '"' + (st0 === s ? ' selected' : '') + '>' + s + '</option>';
      })
      .join('') +
    '</select></div>' +
    '<div class="form-group"><label class="form-label">Priority</label>' +
    '<select class="form-input" id="pldTaskFormPriority">' +
    ['low', 'normal', 'high', 'urgent']
      .map(function (s) {
        return '<option value="' + s + '"' + (pr0 === s ? ' selected' : '') + '>' + s + '</option>';
      })
      .join('') +
    '</select></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Task type</label>' +
    '<select class="form-input" id="pldTaskFormType">' +
    ['task', 'milestone', 'checklist']
      .map(function (s) {
        return '<option value="' + s + '"' + (tt0 === s ? ' selected' : '') + '>' + s + '</option>';
      })
      .join('') +
    '</select></div>' +
    '<div class="form-group"><label class="form-label">Due (local)</label>' +
    '<input type="datetime-local" class="form-input" id="pldTaskFormDue" value="' +
    pldTasksEsc(due0) +
    '"></div>' +
    '<div class="form-group"><label class="form-label">Completion %</label>' +
    '<input type="number" class="form-input" id="pldTaskFormPct" min="0" max="100" value="' +
    pldTasksEsc(pct0) +
    '"></div>' +
    '<div class="form-group"><label class="form-label">Link event</label>' +
    '<input type="hidden" id="pldTaskFormEvent" value="' +
    pldTasksEsc(ev0) +
    '">' +
    '<button type="button" class="pld-picker-trigger" onclick="pldOpenTaskEventPicker()"><span id="pldTaskFormEventLabel">' +
    pldTasksEsc(ev0 ? pldTasksEventName(ev0) : '— None —') +
    '</span></button></div>' +
    '<div class="form-group"><label class="form-label">Assignee</label>' +
    '<input type="hidden" id="pldTaskFormAssignee" value="' +
    pldTasksEsc(as0) +
    '">' +
    '<button type="button" class="pld-picker-trigger" onclick="pldOpenTaskAssigneePicker()"><span id="pldTaskFormAssigneeLabel">' +
    pldTasksEsc(as0 ? pldTasksPersonnelName(as0) : '— None —') +
    '</span></button></div>';

  openModal(id ? 'Edit task' : 'New task', body, '');
  var footer = document.getElementById('modalFooter');
  if (footer) {
    footer.innerHTML =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="pldSaveTaskFromModal()">Save</button>';
  }
};

window.pldOpenTaskEventPicker = function () {
  if (typeof openPickerModal !== 'function' || typeof pickerItemsFromEvents !== 'function') return;
  var items = [{ id: '', primary: '— None —', secondary: '' }];
  if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
    items = items.concat(pickerItemsFromEvents(EVENTS, {}));
  }
  openPickerModal({
    title: 'Link event',
    items: items,
    onSelect: function (pickedId) {
      var h = document.getElementById('pldTaskFormEvent');
      if (h) h.value = pickedId || '';
      var lbl = document.getElementById('pldTaskFormEventLabel');
      if (lbl) lbl.textContent = pickedId ? pldTasksEventName(pickedId) : '— None —';
    },
  });
};

window.pldOpenTaskAssigneePicker = function () {
  if (typeof openPickerModal !== 'function' || typeof pickerItemsFromPersonnel !== 'function') return;
  var items = [{ id: '', primary: '— None —', secondary: '' }];
  if (typeof PERSONNEL !== 'undefined' && Array.isArray(PERSONNEL)) {
    items = items.concat(pickerItemsFromPersonnel(PERSONNEL));
  }
  openPickerModal({
    title: 'Assignee',
    items: items,
    onSelect: function (pickedId) {
      var h = document.getElementById('pldTaskFormAssignee');
      if (h) h.value = pickedId || '';
      var lbl = document.getElementById('pldTaskFormAssigneeLabel');
      if (lbl) lbl.textContent = pickedId ? pldTasksPersonnelName(pickedId) : '— None —';
    },
  });
};

window.pldSaveTaskFromModal = async function () {
  var idEl = document.getElementById('pldTaskFormId');
  var id = idEl && idEl.value ? String(idEl.value) : '';
  var title = document.getElementById('pldTaskFormTitle');
  var titleV = title && title.value ? String(title.value).trim() : '';
  if (!titleV) {
    alert('Title is required');
    return;
  }
  var desc = document.getElementById('pldTaskFormDesc');
  var st = document.getElementById('pldTaskFormStatus');
  var pr = document.getElementById('pldTaskFormPriority');
  var tt = document.getElementById('pldTaskFormType');
  var due = document.getElementById('pldTaskFormDue');
  var pct = document.getElementById('pldTaskFormPct');
  var ev = document.getElementById('pldTaskFormEvent');
  var as = document.getElementById('pldTaskFormAssignee');
  var dueVal = due && due.value ? new Date(due.value).toISOString() : null;
  var pctVal = pct && pct.value !== '' ? parseInt(pct.value, 10) : null;
  if (pctVal !== null && (pctVal < 0 || pctVal > 100 || Number.isNaN(pctVal))) pctVal = null;

  var payload = {
    title: titleV,
    description: desc && desc.value ? String(desc.value) : null,
    status: st ? String(st.value) : 'open',
    priority: pr ? String(pr.value) : 'normal',
    task_type: tt ? String(tt.value) : 'task',
    due_at: dueVal,
    completion_percent: pctVal,
    event_id: ev && ev.value ? String(ev.value) : null,
    assignee_personnel_id: as && as.value ? String(as.value) : null,
  };

  if (!pldTasksUseApi()) {
    alert('API not configured');
    return;
  }
  var method = id ? 'PATCH' : 'POST';
  var path = id ? '/api/v1/tasks/' + encodeURIComponent(id) : '/api/v1/tasks';
  var bodyObj = id
    ? {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        task_type: payload.task_type,
        due_at: payload.due_at,
        completion_percent: payload.completion_percent,
        event_id: payload.event_id,
        assignee_personnel_id: payload.assignee_personnel_id,
      }
    : {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        task_type: payload.task_type,
        due_at: payload.due_at,
        completion_percent: payload.completion_percent,
        event_id: payload.event_id,
        assignee_personnel_id: payload.assignee_personnel_id,
      };
  var r = await window.pldApiFetch(path, {
    method: method,
    body: JSON.stringify(bodyObj),
  });
  if (r.ok) {
    if (typeof closeModal === 'function') closeModal();
    await pldTasksRefresh();
    if (typeof renderPage === 'function') renderPage(typeof currentPage !== 'undefined' ? currentPage : 'tasks');
  } else {
    var msg = r.body && r.body.errors && r.body.errors[0] ? r.body.errors[0].message : 'Save failed';
    alert(msg);
  }
};

window.pldTasksRefresh = async function () {
  window.__pldTasksLoadError = null;
  try {
    window.__pldTasksCache = await pldTasksFetchList();
  } catch (e) {
    window.__pldTasksLoadError = e && e.message ? String(e.message) : 'Load failed';
    window.__pldTasksCache = [];
  }
  if (typeof renderPage === 'function') renderPage('tasks', { skipModuleDataFetch: true });
};

window.pldTasksApplyFiltersFromDom = function () {
  window.__pldTasksFilters = window.__pldTasksFilters || {};
  var f = window.__pldTasksFilters;
  var st = document.getElementById('tsk_status');
  var pr = document.getElementById('tsk_priority');
  var se = document.getElementById('tsk_search');
  var ev = document.getElementById('tsk_event_id');
  if (st) f.status = st.value || '';
  if (pr) f.priority = pr.value || '';
  if (se) f.search = se.value || '';
  if (ev) f.event_id = (ev.value || '').trim();
  void pldTasksRefresh();
};

function renderTasksConsole() {
  var rows = window.__pldTasksCache || [];
  var view = window.__pldTasksConsoleView || 'all-open';
  var tbody = rows
    .map(function (t) {
      return (
        '<tr>' +
        '<td><a href="javascript:void(0)" onclick=\'navigateToTaskDetail(' +
        JSON.stringify(t.id != null ? String(t.id) : '') +
        ')\'>' +
        pldTasksEsc(t.title) +
        '</a></td>' +
        '<td>' +
        pldTasksEsc(t.status) +
        '</td>' +
        '<td>' +
        pldTasksEsc(t.due_at ? String(t.due_at).slice(0, 10) : '—') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  var inspector = '';
  if (typeof selectedTaskId !== 'undefined' && selectedTaskId) {
    var t = rows.find(function (x) {
      return String(x.id) === String(selectedTaskId);
    });
    if (t) {
      inspector =
        '<div class="pld-kv-grid">' +
        '<span class="k">Status</span><span class="v">' +
        pldTasksEsc(t.status) +
        '</span>' +
        '<span class="k">Due</span><span class="v">' +
        pldTasksEsc(t.due_at ? String(t.due_at).slice(0, 10) : '—') +
        '</span>' +
        '</div>' +
        '<p style="margin-top:10px;font-size:12px;color:var(--text-muted);">Crew snapshot: use Personnel / Scheduling when linked to an event.</p>';
    }
  }

  return (
    '<div class="pld-tasks-page">' +
    '<div class="page-header"><div><h1 class="page-title">Tasks</h1>' +
    '<p class="page-subtitle">Three-pane console (saved views + grid + inspector)</p></div>' +
    '<div class="pld-tasks-view-switch">' +
    '<button type="button" onclick="tasksViewMode=\'list\';renderPage(\'tasks\')">List</button>' +
    '<button type="button" class="active" onclick="tasksViewMode=\'console\';renderPage(\'tasks\')">Console</button>' +
    '<button type="button" onclick="tasksViewMode=\'calendar\';renderPage(\'tasks\')">Week</button>' +
    '</div></div>' +
    '<div class="pld-tasks-console">' +
    '<div class="pld-tasks-console-tree">' +
    '<div class="folder">General</div>' +
    '<a class="' +
    (view === 'all-open' ? 'active' : '') +
    '" onclick="window.__pldTasksConsoleView=\'all-open\';void pldTasksRefresh();">All open</a>' +
    '<a class="' +
    (view === 'due-week' ? 'active' : '') +
    '" onclick="window.__pldTasksConsoleView=\'due-week\';void pldTasksRefresh();">Due this week</a>' +
    '<div class="folder">Personal</div>' +
    '<a href="javascript:void(0)" onclick="pldTasksSetMine(true);tasksViewMode=\'list\';renderPage(\'tasks\')">My tasks (list)</a>' +
    '</div>' +
    '<div class="pld-tasks-console-main">' +
    '<table class="data-table"><thead><tr><th>Title</th><th>Status</th><th>Due</th></tr></thead><tbody>' +
    (tbody ||
      '<tr><td colspan="3" class="empty-table-msg">No tasks</td></tr>') +
    '</tbody></table></div>' +
    '<div class="pld-tasks-console-inspector"><strong>Inspector</strong>' +
    (inspector || '<p class="text-muted">Select a row.</p>') +
    '</div>' +
    '</div></div>'
  );
}

function startOfWeek(d) {
  var x = new Date(d);
  var day = x.getDay();
  var diff = x.getDate() - day;
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function renderTasksWeekCalendar() {
  var rows = window.__pldTasksCache || [];
  var start = window.__pldTasksWeekStart ? new Date(window.__pldTasksWeekStart) : startOfWeek(new Date());
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  var heads = days
    .map(function (d) {
      return '<div class="day-head">' + (d.getMonth() + 1) + '/' + d.getDate() + '</div>';
    })
    .join('');

  var cells = days
    .map(function (d) {
      var iso = d.toISOString().slice(0, 10);
      var lines = rows
        .filter(function (t) {
          if (!t.due_at) return false;
          return String(t.due_at).slice(0, 10) === iso;
        })
        .map(function (t) {
          var pct =
            t.completion_percent != null &&
            t.completion_percent !== ''
              ? ' (' + t.completion_percent + '%)'
              : '';
          return (
            '<span class="cal-line st-' +
            String(t.status || 'open').replace(/[^a-z]/g, '') +
            '" onclick=\'navigateToTaskDetail(' +
            JSON.stringify(t.id != null ? String(t.id) : '') +
            ')\'>' +
            pldTasksEsc(t.title) +
            pct +
            '</span>'
          );
        })
        .join('');
      return '<div class="day-cell">' + lines + '</div>';
    })
    .join('');

  return (
    '<div class="pld-tasks-page">' +
    '<div class="page-header"><div><h1 class="page-title">Tasks — week</h1>' +
    '<p class="page-subtitle">Items placed by due date</p></div>' +
    '<div class="pld-tasks-view-switch">' +
    '<button type="button" onclick="tasksViewMode=\'list\';renderPage(\'tasks\')">List</button>' +
    '<button type="button" onclick="tasksViewMode=\'console\';renderPage(\'tasks\')">Console</button>' +
    '<button type="button" class="active" onclick="tasksViewMode=\'calendar\';renderPage(\'tasks\')">Week</button>' +
    '</div></div>' +
    '<div class="pld-tasks-toolbar">' +
    '<button type="button" class="btn btn-ghost btn-sm" onclick="pldTasksWeekShift(-7)">← Prev</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" onclick="pldTasksWeekShift(7)">Next →</button>' +
    '</div>' +
    '<div class="pld-tasks-week-cal">' +
    '<div class="pld-tasks-week-cal-row">' +
    heads +
    '</div><div class="pld-tasks-week-cal-row">' +
    cells +
    '</div></div></div>'
  );
}

window.pldTasksWeekShift = function (delta) {
  var base = window.__pldTasksWeekStart ? new Date(window.__pldTasksWeekStart) : startOfWeek(new Date());
  base.setDate(base.getDate() + delta);
  window.__pldTasksWeekStart = base.toISOString();
  renderPage('tasks', { skipModuleDataFetch: true });
};

window.navigateToTaskDetail = function (id) {
  window.__pldTaskDetailRow = null;
  selectedTaskId = id;
  navigateTo('task');
};

window.pldHydrateTaskDetailPage = async function () {
  if (typeof selectedTaskId === 'undefined' || !selectedTaskId) return;
  if (!pldTasksUseApi()) return;
  var t = await pldTasksFetchOne(selectedTaskId);
  if (t) {
    window.__pldTaskDetailRow = t;
    window.__pldTasksCache = window.__pldTasksCache || [];
    var ix = window.__pldTasksCache.findIndex(function (x) {
      return String(x.id) === String(t.id);
    });
    if (ix >= 0) window.__pldTasksCache[ix] = t;
    if (typeof renderPage === 'function') renderPage('task', { skipModuleDataFetch: true });
    if (typeof taskDetailTab !== 'undefined' && taskDetailTab === 'subtasks' && typeof window.pldFillTaskSubtasksPanel === 'function') {
      void window.pldFillTaskSubtasksPanel(selectedTaskId);
    }
  }
};

window.pldFillTaskSubtasksPanel = async function (taskId) {
  var el = document.getElementById('pldTaskSubtasksPanel');
  if (!el || !taskId) return;
  el.innerHTML = '<p class="text-muted">Loading…</p>';
  var children = await pldTasksFetchChildren(taskId);
  if (!children.length) {
    el.innerHTML =
      '<p class="text-muted">No subtasks. Add a task with this row as parent from the task editor or list.</p>';
    return;
  }
  el.innerHTML =
    '<ul class="pld-task-subtasks-list" style="list-style:none;padding:0;margin:0;">' +
    children
      .map(function (c) {
        return (
          '<li style="padding:8px 0;border-bottom:1px solid var(--border-subtle);"><a href="#" class="pld-task-title-link" data-id="' +
          pldTasksEsc(c.id) +
          '">' +
          pldTasksEsc(c.title) +
          '</a> <span class="text-muted" style="font-size:12px;">' +
          pldTasksEsc(c.status) +
          '</span></li>'
        );
      })
      .join('') +
    '</ul>';
};

function renderTaskDetail() {
  var t = null;
  if (typeof window.__pldTaskDetailRow !== 'undefined' && window.__pldTaskDetailRow) {
    t = window.__pldTaskDetailRow;
  }
  if (
    !t &&
    typeof selectedTaskId !== 'undefined' &&
    selectedTaskId &&
    window.__pldTasksCache
  ) {
    t = window.__pldTasksCache.find(function (x) {
      return String(x.id) === String(selectedTaskId);
    });
  }
  if (!t && typeof selectedTaskId !== 'undefined' && selectedTaskId) {
    return (
      '<div class="empty-state"><p>Loading task…</p><button class="btn btn-primary" onclick="navigateTo(\'tasks\')">Back to list</button></div>'
    );
  }
  if (!t) {
    return '<div class="empty-state"><h3>No task selected</h3></div>';
  }

  var tab =
    typeof taskDetailTab !== 'undefined' ? taskDetailTab : 'overview';
  if (tab === 'notes' || tab === 'files' || tab === 'history') {
    taskDetailTab = 'overview';
    tab = 'overview';
  }
  var subTab =
    '<div class="pld-subtabs">' +
    '<button type="button" class="' +
    (tab === 'overview' ? 'active' : '') +
    '" onclick="taskDetailTab=\'overview\';renderPage(\'task\')">Overview</button>' +
    '<button type="button" class="' +
    (tab === 'subtasks' ? 'active' : '') +
    '" onclick="taskDetailTab=\'subtasks\';renderPage(\'task\')">Subtasks</button>' +
    '</div>';

  var panel = '';
  if (tab === 'overview') {
    panel =
      '<p style="font-size:14px;line-height:1.5;">' +
      (t.description ? pldTasksEsc(t.description) : '<em>No description</em>') +
      '</p>';
  } else {
    panel =
      '<div id="pldTaskSubtasksPanel"><p class="text-muted">Loading…</p></div>';
  }

  return (
    '<div class="pld-tasks-page">' +
    '<div class="pld-entity-header">' +
    '<div><h1 class="page-title">' +
    pldTasksEsc(t.title) +
    '</h1></div>' +
    '<div class="pld-icon-actions">' +
    '<button type="button" title="Edit" onclick=\'pldOpenTaskEditorModal(' +
    JSON.stringify(t.id != null ? String(t.id) : '') +
    ')\'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
    '<button type="button" title="Back to list" onclick="selectedTaskId=null;navigateTo(\'tasks\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
    '</div></div>' +
    '<div class="pld-entity-summary">' +
    '<div class="pld-kv-grid">' +
    '<span class="k">Status</span><span class="v">' +
    pldTasksEsc(t.status) +
    '</span>' +
    '<span class="k">Priority</span><span class="v">' +
    pldTasksEsc(t.priority) +
    '</span>' +
    '<span class="k">Due</span><span class="v">' +
    pldTasksEsc(t.due_at ? String(t.due_at).slice(0, 16) : '—') +
    '</span>' +
    '<span class="k">Assignee</span><span class="v">' +
    pldTasksEsc(pldTasksPersonnelName(t.assignee_personnel_id)) +
    '</span>' +
    '<span class="k">Event</span><span class="v">' +
    pldTasksEsc(pldTasksEventName(t.event_id)) +
    '</span>' +
    '<span class="k">Progress</span><span class="v">' +
    (t.completion_percent != null ? pldTasksEsc(String(t.completion_percent)) + '%' : '—') +
    '</span>' +
    '</div></div>' +
    subTab +
    '<div class="pld-subtab-panel">' +
    panel +
    '</div></div>'
  );
}

window.renderTaskPage = function renderTaskPage() {
  return renderTaskDetail();
};

document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var row = t.closest('.pld-task-title-link');
  if (row && row.getAttribute('data-id')) {
    e.preventDefault();
    navigateToTaskDetail(row.getAttribute('data-id'));
  }
  var cb = t.closest('.pld-task-row-cb');
  if (cb && cb.getAttribute('data-id')) {
    var id = cb.getAttribute('data-id');
    window.__pldTasksSelectedIds = window.__pldTasksSelectedIds || {};
    window.__pldTasksSelectedIds[id] = cb.checked;
  }
});

document.addEventListener('change', function (e) {
  var t = e.target;
  if (t && t.classList && t.classList.contains('pld-filter-cell')) {
    window.__pldTasksFilters = window.__pldTasksFilters || {};
    var f = window.__pldTasksFilters;
    var key = t.getAttribute('data-filter-key');
    if (key) f[key] = t.value || '';
    if (key === 'search' || key === 'event_id') {
      clearTimeout(window.__pldTasksFilterDebounce);
      window.__pldTasksFilterDebounce = setTimeout(function () {
        void pldTasksRefresh();
      }, 300);
    } else {
      void pldTasksRefresh();
    }
  }
});
