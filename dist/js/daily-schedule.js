/* ============================================
   Event "Schedule" tab — call sheet / day-by-day.
   Templates use {{shop}}, {{stage}}, {{city}}, {{venue}}, {{client}}, {{event}}.
   Persists to event metadata.daily_schedule when REST sync is active.
   ============================================ */
(function (W) {
  function dsEsc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseLocalDay(iso) {
    if (!iso || typeof iso !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }

  function eachEventCalendarDay(ev) {
    const a = parseLocalDay(ev.startDate);
    const b = parseLocalDay(ev.endDate);
    if (!a || !b || b < a) return [];
    const out = [];
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
      out.push(new Date(d));
    }
    return out;
  }

  function isoFromDate(d) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + da;
  }

  function formatDayHeading(d) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  function tokenContext(ev, venue, client) {
    const v = venue && typeof venue === 'object' ? venue : { name: '', city: '' };
    const c = client && typeof client === 'object' ? client : { name: '' };
    const city = v.city || '';
    const shop = city ? city + ' Shop' : 'Shop';
    return {
      shop: shop,
      stage: v.name ? v.name.split(',')[0].trim() : 'Stage',
      city: city || 'Venue city',
      venue: v.name || 'Venue',
      client: c.name || 'Client',
      event: ev.name || 'Event',
    };
  }

  function substituteTokens(str, ctx) {
    if (str == null || str === '') return '';
    let s = String(str);
    s = s.replace(/\{\{shop\}\}/g, ctx.shop);
    s = s.replace(/\{\{stage\}\}/g, ctx.stage);
    s = s.replace(/\{\{city\}\}/g, ctx.city);
    s = s.replace(/\{\{venue\}\}/g, ctx.venue);
    s = s.replace(/\{\{client\}\}/g, ctx.client);
    s = s.replace(/\{\{event\}\}/g, ctx.event);
    return s;
  }

  function materializeRow(r, ctx) {
    return {
      start: substituteTokens(r.start, ctx),
      end: substituteTokens(r.end, ctx),
      location: substituteTokens(r.location, ctx),
      dept: substituteTokens(r.dept, ctx),
      action: substituteTokens(r.action, ctx),
      notes: substituteTokens(r.notes, ctx),
      truck: Boolean(r.truck),
    };
  }

  /** @type {Array<{ titleSuffix: string, showDay: boolean, rows: object[] }>} */
  var TOUR_PRODUCTION_BLOCKS = [
    {
      titleSuffix: 'Shop Prep — Lighting',
      showDay: false,
      rows: [
        { start: '8:30 AM', end: '', location: '{{shop}}', dept: 'Lighting', action: 'CREW CALL', notes: '', truck: false },
        { start: '8:00 AM', end: '', location: '', dept: '', action: '', notes: '', truck: false },
      ],
    },
    {
      titleSuffix: 'Shop Prep Continued',
      showDay: false,
      rows: [
        { start: '8:30 AM', end: '', location: '{{shop}}', dept: 'Lighting', action: 'CREW CALL', notes: '', truck: false },
        { start: '8:30 AM', end: '', location: '{{shop}}', dept: 'Audio', action: 'CREW CALL', notes: '', truck: false },
        { start: '8:00 AM', end: '', location: '', dept: '', action: '', notes: '', truck: false },
      ],
    },
    {
      titleSuffix: '{{city}} — Place Stage & {{shop}} Prep',
      showDay: false,
      rows: [
        {
          start: '8:00 AM',
          end: '5:00 PM',
          location: 'Stage Build',
          dept: 'Stage Hands',
          action: 'CREW CALL — LOAD IN',
          notes: '8 Stage Hands + 1 Fork',
          truck: false,
        },
        {
          start: '8:30 AM',
          end: '',
          location: '{{shop}}',
          dept: 'Production — Trucking',
          action: "1x 53' Semi — Pre Rigging / Delay Towers",
          notes: 'Loaded and rolling in AM',
          truck: true,
        },
        { start: '8:00 AM', end: '', location: '', dept: '', action: '', notes: '', truck: false },
      ],
    },
    {
      titleSuffix: 'Stage Build & Pre-rig / Lighting Crew Travel Day',
      showDay: false,
      rows: [
        {
          start: '8:00 AM',
          end: '5:00 PM',
          location: 'Stage Build',
          dept: 'Stage Hands',
          action: 'CREW CALL — LOAD IN',
          notes: '',
          truck: false,
        },
        {
          start: '11:00 AM',
          end: '5:00 PM',
          location: '{{stage}}',
          dept: 'Production — Trucking',
          action: "1x 53' Semi — Pre Rigging w/ Delay Towers",
          notes: 'Delivery to {{city}}',
          truck: true,
        },
        {
          start: '11:00 AM',
          end: '5:00 PM',
          location: '{{stage}}',
          dept: 'Production — Rigging',
          action: 'CREW CALL — LOAD IN',
          notes: '8 Stage Hands + 1 Fork',
          truck: false,
        },
        { start: '12:00 PM', end: '', location: 'TBD', dept: '', action: '', notes: 'Place Trailers', truck: false },
      ],
    },
    {
      titleSuffix: 'Lighting & Video Load In / Audio Travel Day',
      showDay: false,
      rows: [
        {
          start: '8:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production — Lighting',
          action: "1x 53' Semi — Lighting",
          notes: 'Delivery to {{city}}',
          truck: true,
        },
        {
          start: '8:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production — Lighting',
          action: 'CREW CALL',
          notes: 'Lighting vendor leads',
          truck: false,
        },
        {
          start: '8:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Stage Hands — Lighting',
          action: 'CREW CALL',
          notes: '14 Stage Hands + 2 Fork Op',
          truck: false,
        },
        {
          start: '8:30 AM',
          end: '',
          location: '{{shop}}',
          dept: 'Production — Trucking',
          action: "1x 53' Semi — Audio",
          notes: 'Loaded and rolling in AM',
          truck: true,
        },
        {
          start: '10:00 AM',
          end: '',
          location: '{{shop}}',
          dept: 'Production — Audio Travel',
          action: '',
          notes: '',
          truck: false,
        },
        {
          start: '10:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production — Video',
          action: 'CREW CALL',
          notes: 'LED load in',
          truck: false,
        },
        {
          start: '10:00 AM',
          end: '',
          location: 'Structures',
          dept: 'Production — Delay Tower',
          action: 'CREW CALL',
          notes: 'Audio vendor leads',
          truck: false,
        },
        {
          start: '10:00 AM',
          end: '',
          location: 'Structures',
          dept: 'Stage Hands — Delay Tower',
          action: 'CREW CALL',
          notes: '8 Stage Hands + 1 Fork Op',
          truck: false,
        },
      ],
    },
    {
      titleSuffix: 'Production Load In Continued — Audio',
      showDay: false,
      rows: [
        {
          start: '8:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production — Audio Load',
          action: 'CREW CALL',
          notes: 'Audio leads',
          truck: false,
        },
        {
          start: '8:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production — Trucking',
          action: "1x 53' Semi — Audio",
          notes: 'Deliver to {{city}}',
          truck: true,
        },
        {
          start: '8:00 AM',
          end: '',
          location: '',
          dept: 'Production — Lighting',
          action: 'CREW CALL',
          notes: '',
          truck: false,
        },
        {
          start: '12:00 PM',
          end: '',
          location: 'Delays',
          dept: 'Delays — Trucking',
          action: 'CREW CALL',
          notes: 'Park and place video delay trailers',
          truck: false,
        },
      ],
    },
    {
      titleSuffix: 'Show Day — {{event}}',
      showDay: true,
      rows: [
        {
          start: '7:00 AM',
          end: '12:00 AM',
          location: '{{stage}}',
          dept: 'Production — All Departments',
          action: 'CREW CALL',
          notes: '',
          truck: false,
        },
        {
          start: '7:00 AM',
          end: '12:00 PM',
          location: '{{stage}}',
          dept: 'Stagehands',
          action: 'CREW CALL',
          notes: '',
          truck: false,
        },
        {
          start: '7:00 AM',
          end: '12:00 AM',
          location: '{{stage}}',
          dept: 'Stagehands',
          action: 'CREW CALL',
          notes: '8 stagehands — show (2 shifts)',
          truck: false,
        },
        {
          start: '6:30 AM',
          end: '12:00 AM',
          location: '{{stage}}',
          dept: 'Stagehands',
          action: 'CREW CALL',
          notes: '4 stagehands — spot ops + strike',
          truck: false,
        },
      ],
    },
    {
      titleSuffix: 'Load Out',
      showDay: false,
      rows: [
        {
          start: '9:00 AM',
          end: '2:00 PM',
          location: '{{stage}}',
          dept: 'Production — All Departments',
          action: 'CREW CALL — LOAD OUT',
          notes: '',
          truck: false,
        },
        {
          start: '9:00 AM',
          end: '2:00 PM',
          location: '{{stage}}',
          dept: 'Stagehands',
          action: 'CREW CALL — LOAD OUT',
          notes: '',
          truck: false,
        },
        {
          start: '10:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production',
          action: "(1) 53' Semi — Audio",
          notes: 'Pick up {{city}}',
          truck: true,
        },
        {
          start: '10:00 AM',
          end: '',
          location: '{{stage}}',
          dept: 'Production',
          action: "(1) 53' Semi — Lighting / Video",
          notes: 'Pick up {{city}}',
          truck: true,
        },
        {
          start: '10:00 AM',
          end: '',
          location: 'Structures',
          dept: 'Production',
          action: "(1) 53' Semi — Rigging / Delay Tower",
          notes: 'Pick up {{city}}',
          truck: true,
        },
      ],
    },
    { titleSuffix: 'Travel / Wrap', showDay: false, rows: [] },
  ];

  var FESTIVAL_THREE_DAY = [
    {
      titleSuffix: 'Load-in & prep — {{client}}',
      showDay: false,
      rows: [
        {
          start: '8:00 AM',
          end: '6:00 PM',
          location: '{{venue}}',
          dept: 'All depts',
          action: 'CREW CALL',
          notes: 'Confirm parking / credentials',
          truck: false,
        },
        {
          start: '9:00 AM',
          end: '',
          location: '{{shop}}',
          dept: 'Trucking',
          action: 'Semi arrival window',
          notes: '',
          truck: true,
        },
      ],
    },
    {
      titleSuffix: 'Show Day — {{event}}',
      showDay: true,
      rows: [
        {
          start: '7:00 AM',
          end: '11:00 PM',
          location: '{{stage}}',
          dept: 'Show crew',
          action: 'CREW CALL',
          notes: 'Doors / show times TBD',
          truck: false,
        },
      ],
    },
    {
      titleSuffix: 'Load out & travel',
      showDay: false,
      rows: [
        {
          start: '9:00 AM',
          end: '4:00 PM',
          location: '{{venue}}',
          dept: 'All depts',
          action: 'CREW CALL — STRIKE',
          notes: '',
          truck: false,
        },
      ],
    },
  ];

  function cloneDays(days) {
    return JSON.parse(JSON.stringify(days));
  }

  function buildFromBlocks(blocks, calendarDays, ctx) {
    const n = calendarDays.length;
    if (n === 0) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = calendarDays[i];
      const block = blocks[i] || { titleSuffix: '—', showDay: false, rows: [] };
      const titleSuffix = substituteTokens(block.titleSuffix, ctx);
      const heading = formatDayHeading(d) + (titleSuffix ? ' — ' + titleSuffix : '');
      const rows = (block.rows || []).map(function (r) {
        return materializeRow(r, ctx);
      });
      out.push({
        dateIso: isoFromDate(d),
        heading: heading,
        showDay: Boolean(block.showDay),
        rows: rows,
      });
    }
    return out;
  }

  function buildBlankDays(ev) {
    const calendarDays = eachEventCalendarDay(ev);
    return calendarDays.map(function (d) {
      return {
        dateIso: isoFromDate(d),
        heading: formatDayHeading(d) + ' — (blank)',
        showDay: false,
        rows: [
          { start: '', end: '', location: '', dept: '', action: '', notes: '', truck: false },
        ],
      };
    });
  }

  function getSavedDailySchedule(ev) {
    if (ev.dailySchedule && typeof ev.dailySchedule === 'object' && Array.isArray(ev.dailySchedule.days)) {
      return ev.dailySchedule;
    }
    var md = ev.metadata;
    if (md && md.daily_schedule && typeof md.daily_schedule === 'object' && Array.isArray(md.daily_schedule.days)) {
      return md.daily_schedule;
    }
    return null;
  }

  function attachDailySchedule(ev, payload) {
    ev.dailySchedule = payload;
    if (!ev.metadata || typeof ev.metadata !== 'object') ev.metadata = {};
    ev.metadata.daily_schedule = payload;
  }

  W.dsApplyScheduleTemplate = function (eventId) {
    var ev = typeof EVENTS !== 'undefined' ? EVENTS.find(function (e) {
      return e.id === eventId;
    }) : null;
    if (!ev) return;
    var sel = document.getElementById('ds-template-select-' + eventId);
    var templateId = sel ? sel.value : 'blank';
    var venue = typeof getVenue === 'function' ? getVenue(ev.venue) : null;
    var client = typeof getClient === 'function' ? getClient(ev.client) : null;
    var ctx = tokenContext(ev, venue, client);
    var calendarDays = eachEventCalendarDay(ev);
    if (calendarDays.length === 0) {
      if (typeof showToast === 'function') showToast('Set event start and end dates first', 'warning');
      return;
    }
    var days;
    if (templateId === 'tour_production') {
      days = buildFromBlocks(TOUR_PRODUCTION_BLOCKS, calendarDays, ctx);
    } else if (templateId === 'festival_3day') {
      var blocks3 = FESTIVAL_THREE_DAY;
      if (calendarDays.length < 3) {
        days = buildFromBlocks(blocks3.slice(0, calendarDays.length), calendarDays, ctx);
      } else {
        var span0 = calendarDays.length;
        var padL = Math.floor((span0 - 3) / 2);
        var sliceDays = calendarDays.slice(padL, padL + 3);
        var mid = buildFromBlocks(blocks3, sliceDays, ctx);
        var before = calendarDays.slice(0, padL).map(function (d) {
          return {
            dateIso: isoFromDate(d),
            heading: formatDayHeading(d) + ' — Pre / travel',
            showDay: false,
            rows: [],
          };
        });
        var after = calendarDays.slice(padL + 3).map(function (d) {
          return {
            dateIso: isoFromDate(d),
            heading: formatDayHeading(d) + ' — Wrap / travel',
            showDay: false,
            rows: [],
          };
        });
        days = before.concat(mid).concat(after);
      }
    } else {
      days = buildBlankDays(ev);
    }
    attachDailySchedule(ev, { templateId: templateId, days: days, updatedAt: new Date().toISOString() });
    void persistDailySchedule(ev);
    if (typeof renderPage === 'function' && typeof currentPage !== 'undefined') renderPage(currentPage);
    if (typeof showToast === 'function') showToast('Schedule updated', 'success');
  };

  W.dsStartBlankSchedule = function (eventId) {
    var sel = document.getElementById('ds-template-select-' + eventId);
    if (sel) sel.value = 'blank';
    W.dsApplyScheduleTemplate(eventId);
  };

  function persistDailySchedule(ev) {
    if (typeof persistEventFields !== 'function') return Promise.resolve();
    return persistEventFields(ev.id, { dailySchedule: ev.dailySchedule });
  }

  W.dsAddScheduleRow = function (eventId, dayIndex) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var saved = getSavedDailySchedule(ev);
    var days;
    if (saved && Array.isArray(saved.days)) {
      days = cloneDays(saved.days);
    } else {
      days = buildBlankDays(ev);
    }
    if (dayIndex < 0 || dayIndex >= days.length) return;
    days[dayIndex].rows.push({
      start: '',
      end: '',
      location: '',
      dept: '',
      action: '',
      notes: '',
      truck: false,
    });
    attachDailySchedule(ev, {
      templateId: (saved && saved.templateId) || 'blank',
      days: days,
      updatedAt: new Date().toISOString(),
    });
    void persistDailySchedule(ev);
    if (typeof renderPage === 'function') renderPage(currentPage);
  };

  W.dsDeleteScheduleRow = function (eventId, dayIndex, rowIndex) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var saved = getSavedDailySchedule(ev);
    var days;
    if (saved && Array.isArray(saved.days)) {
      days = cloneDays(saved.days);
    } else {
      days = buildBlankDays(ev);
    }
    if (dayIndex < 0 || dayIndex >= days.length) return;
    var rows = days[dayIndex].rows;
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    rows.splice(rowIndex, 1);
    if (rows.length === 0) {
      rows.push({ start: '', end: '', location: '', dept: '', action: '', notes: '', truck: false });
    }
    attachDailySchedule(ev, {
      templateId: (saved && saved.templateId) || 'blank',
      days: days,
      updatedAt: new Date().toISOString(),
    });
    void persistDailySchedule(ev);
    if (typeof renderPage === 'function') renderPage(currentPage);
  };

  W.dsEditScheduleRow = function (eventId, dayIndex, rowIndex) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var saved = getSavedDailySchedule(ev);
    var days;
    if (saved && Array.isArray(saved.days)) {
      days = saved.days;
    } else {
      var fresh = buildBlankDays(ev);
      attachDailySchedule(ev, { templateId: 'blank', days: cloneDays(fresh), updatedAt: new Date().toISOString() });
      days = getSavedDailySchedule(ev).days;
    }
    if (dayIndex < 0 || dayIndex >= days.length) return;
    var rows = days[dayIndex].rows;
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    var row = rows[rowIndex];
    var body =
      '<div class="form-group"><label class="form-label">Start</label><input type="text" class="form-input" id="ds-r-start" value="' +
      dsEsc(row.start) +
      '"></div>' +
      '<div class="form-group"><label class="form-label">End</label><input type="text" class="form-input" id="ds-r-end" value="' +
      dsEsc(row.end) +
      '"></div>' +
      '<div class="form-group"><label class="form-label">Location</label><input type="text" class="form-input" id="ds-r-loc" value="' +
      dsEsc(row.location) +
      '"></div>' +
      '<div class="form-group"><label class="form-label">Department</label><input type="text" class="form-input" id="ds-r-dept" value="' +
      dsEsc(row.dept) +
      '"></div>' +
      '<div class="form-group"><label class="form-label">Action and details</label><textarea class="form-textarea" id="ds-r-act" rows="2">' +
      dsEsc(row.action) +
      '</textarea></div>' +
      '<div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="ds-r-notes" rows="2">' +
      dsEsc(row.notes) +
      '</textarea></div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="ds-r-truck" ' +
      (row.truck ? 'checked' : '') +
      '> Truck / transport highlight</label>';
    var footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="dsSaveScheduleRowEdit(\'' +
      eventId +
      "'," +
      dayIndex +
      ',' +
      rowIndex +
      ')">Save</button>';
    if (typeof openModal === 'function') openModal('Edit row', body, footer);
  };

  W.dsSaveScheduleRowEdit = function (eventId, dayIndex, rowIndex) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var saved = getSavedDailySchedule(ev);
    if (!saved || !Array.isArray(saved.days)) return;
    var days = cloneDays(saved.days);
    var row = days[dayIndex].rows[rowIndex];
    var g = function (id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    };
    row.start = g('ds-r-start');
    row.end = g('ds-r-end');
    row.location = g('ds-r-loc');
    row.dept = g('ds-r-dept');
    row.action = g('ds-r-act');
    row.notes = g('ds-r-notes');
    var tr = document.getElementById('ds-r-truck');
    row.truck = !!(tr && tr.checked);
    attachDailySchedule(ev, {
      templateId: saved.templateId || 'blank',
      days: days,
      updatedAt: new Date().toISOString(),
    });
    void persistDailySchedule(ev);
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderPage === 'function') renderPage(currentPage);
    if (typeof showToast === 'function') showToast('Row saved', 'success');
  };

  W.dsEditScheduleDayTitle = function (eventId, dayIndex) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var saved = getSavedDailySchedule(ev);
    if (!saved || !saved.days || !saved.days[dayIndex]) return;
    var cur = saved.days[dayIndex].heading || '';
    var body =
      '<p style="font-size:12px;color:var(--text-tertiary);margin:0 0 10px 0;">Day heading (shown above that day’s rows).</p>' +
      '<div class="form-group"><label class="form-label">Heading</label><input type="text" class="form-input" id="ds-day-heading" value="' +
      dsEsc(cur) +
      '"></div>';
    var footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="dsSaveScheduleDayHeading(\'' +
      eventId +
      "'," +
      dayIndex +
      ')">Save</button>';
    if (typeof openModal === 'function') openModal('Edit day heading', body, footer);
  };

  W.dsSaveScheduleDayHeading = function (eventId, dayIndex) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var saved = getSavedDailySchedule(ev);
    if (!saved || !Array.isArray(saved.days)) return;
    var days = cloneDays(saved.days);
    var inp = document.getElementById('ds-day-heading');
    if (inp) days[dayIndex].heading = inp.value;
    attachDailySchedule(ev, {
      templateId: saved.templateId || 'blank',
      days: days,
      updatedAt: new Date().toISOString(),
    });
    void persistDailySchedule(ev);
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderPage === 'function') renderPage(currentPage);
  };

  function renderDailySchedule(ev, venue, client) {
    var calendarDays = eachEventCalendarDay(ev);
    if (calendarDays.length === 0) {
      return (
        '<div class="ds-container"><p style="padding:16px;color:var(--text-tertiary);font-size:14px;">Set this event’s start and end dates to build a day-by-day schedule.</p></div>'
      );
    }

    var saved = getSavedDailySchedule(ev);
    var dateMismatch =
      saved && Array.isArray(saved.days) && saved.days.length !== calendarDays.length;
    var displayDays =
      saved && Array.isArray(saved.days) && !dateMismatch ? saved.days : buildBlankDays(ev);

    var tid = saved && saved.templateId ? saved.templateId : 'blank';
    var eid = ev.id;

    var toolbar =
      '<div class="ds-toolbar">' +
      '<span class="ds-toolbar-label">Template</span>' +
      '<select id="ds-template-select-' +
      eid +
      '" class="form-select">' +
      '<option value="blank"' +
      (tid === 'blank' ? ' selected' : '') +
      '>Blank (one empty row per day)</option>' +
      '<option value="festival_3day"' +
      (tid === 'festival_3day' ? ' selected' : '') +
      '>Festival / weekend (3-day arc)</option>' +
      '<option value="tour_production"' +
      (tid === 'tour_production' ? ' selected' : '') +
      '>Tour / production week (shop → show → out)</option>' +
      '</select>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="dsApplyScheduleTemplate(\'' +
      eid +
      "')\">Apply template</button>" +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="dsStartBlankSchedule(\'' +
      eid +
      "')\">Start blank</button>" +
      '<span class="ds-toolbar-hint">Templates map to your event dates and swap in venue, city, client, and event name. Click a row to edit; add rows per day as needed.</span>' +
      '</div>' +
      (dateMismatch
        ? '<div style="padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--accent-amber);background:var(--accent-amber-muted);border-radius:var(--radius-md);border:1px solid var(--border-default);">Event dates no longer match this saved schedule. Apply a template again to regenerate days, or keep editing — your previous rows are still stored until you overwrite.</div>'
        : '');

    var thead =
      '<div class="ds-header-row">' +
      '<div class="ds-col ds-col-start">Start</div>' +
      '<div class="ds-col ds-col-end">End</div>' +
      '<div class="ds-col ds-col-location">Location</div>' +
      '<div class="ds-col ds-col-dept">Department</div>' +
      '<div class="ds-col ds-col-action">Action and Details</div>' +
      '<div class="ds-col ds-col-notes">Notes</div>' +
      '</div>';

    var body = displayDays
      .map(function (day, di) {
        var show = day.showDay;
        var heading = day.heading || formatDayHeading(parseLocalDay(day.dateIso) || calendarDays[di]) + ' —';
        var dayActions =
          '<div class="ds-day-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="dsEditScheduleDayTitle(\'' +
          eid +
          "'," +
          di +
          ')">Edit day title</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="dsAddScheduleRow(\'' +
          eid +
          "'," +
          di +
          ')">+ Row</button>' +
          '</div>';
        var rows = day.rows || [];
        var rowHtml =
          rows.length === 0
            ? '<div class="ds-empty-day"></div>'
            : rows
                .map(function (row, ri) {
                  return (
                    '<div class="ds-row ' +
                    (show ? 'show-day-row' : '') +
                    ' ' +
                    (row.truck ? 'truck-row' : '') +
                    '" style="cursor:pointer;" title="Click to edit" onclick="dsEditScheduleRow(\'' +
                    eid +
                    "'," +
                    di +
                    ',' +
                    ri +
                    ')">' +
                    '<div class="ds-col ds-col-start">' +
                    dsEsc(row.start) +
                    '</div>' +
                    '<div class="ds-col ds-col-end">' +
                    dsEsc(row.end) +
                    '</div>' +
                    '<div class="ds-col ds-col-location">' +
                    dsEsc(row.location) +
                    '</div>' +
                    '<div class="ds-col ds-col-dept">' +
                    dsEsc(row.dept) +
                    '</div>' +
                    '<div class="ds-col ds-col-action">' +
                    dsEsc(row.action) +
                    '</div>' +
                    '<div class="ds-col ds-col-notes" style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><span>' +
                    dsEsc(row.notes) +
                    '</span><button type="button" class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;flex-shrink:0;" onclick="event.stopPropagation();dsDeleteScheduleRow(\'' +
                    eid +
                    "'," +
                    di +
                    ',' +
                    ri +
                    ')">Remove</button></div>' +
                    '</div>'
                  );
                })
                .join('');
        return (
          '<div class="ds-day-header ' +
          (show ? 'show-day' : '') +
          '">' +
          dsEsc(heading) +
          '</div>' +
          dayActions +
          rowHtml
        );
      })
      .join('');

    return '<div class="ds-container">' + toolbar + thead + body + '</div>';
  }

  W.renderDailySchedule = renderDailySchedule;
})(typeof window !== 'undefined' ? window : globalThis);
