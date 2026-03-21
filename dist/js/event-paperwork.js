/* ============================================
   Event Crew List + Radios tabs — tied to assigned crew & venue.
   Extras persist in event metadata.event_paperwork (REST merge).
   ============================================ */
(function (W) {
  var RADIO_CHANNELS = [
    { ch: '1', label: 'Production', color: '#ef4444' },
    { ch: '2', label: 'Audio', color: '#3b82f6' },
    { ch: '3', label: 'Lighting', color: '#f59e0b' },
    { ch: '4', label: 'Video', color: '#8b5cf6' },
    { ch: '5', label: 'Stage / Rigging', color: '#22c55e' },
    { ch: '6', label: 'Trucking / Transport', color: '#ec4899' },
    { ch: '7', label: 'Security', color: '#06b6d4' },
    { ch: '8', label: 'Emergency', color: '#f97316' },
  ];

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensurePaperwork(ev) {
    var p = ev.eventPaperwork;
    if (!p && ev.metadata && ev.metadata.event_paperwork) p = ev.metadata.event_paperwork;
    if (!p || typeof p !== 'object') p = {};
    if (!p.crew_rows || typeof p.crew_rows !== 'object') p.crew_rows = {};
    if (!p.refs || typeof p.refs !== 'object') p.refs = {};
    if (!p.radio_assignments || typeof p.radio_assignments !== 'object') p.radio_assignments = {};
    ev.eventPaperwork = p;
    if (!ev.metadata || typeof ev.metadata !== 'object') ev.metadata = {};
    ev.metadata.event_paperwork = p;
    return p;
  }

  function persistPaperwork(ev) {
    if (typeof persistEventFields !== 'function') return Promise.resolve();
    return persistEventFields(ev.id, { eventPaperwork: ensurePaperwork(ev) });
  }

  function defaultCheckDates(ev) {
    var a = ev.startDate ? (typeof formatDateShort === 'function' ? formatDateShort(ev.startDate) : ev.startDate) : '';
    var b = ev.endDate ? (typeof formatDateShort === 'function' ? formatDateShort(ev.endDate) : ev.endDate) : '';
    return { in0: a, out0: b };
  }

  function defaultChannelsForDeptName(deptName) {
    var n = String(deptName || '').toLowerCase();
    if (n.indexOf('audio') >= 0) return { ch1: '2', ch2: '1' };
    if (n.indexOf('light') >= 0) return { ch1: '3', ch2: '1' };
    if (n.indexOf('video') >= 0 || n.indexOf('led') >= 0) return { ch1: '4', ch2: '1' };
    if (n.indexOf('rig') >= 0 || n.indexOf('stage') >= 0) return { ch1: '5', ch2: '' };
    if (n.indexOf('truck') >= 0 || n.indexOf('transport') >= 0) return { ch1: '6', ch2: '' };
    if (n.indexOf('prod') >= 0) return { ch1: '1', ch2: '5' };
    return { ch1: '1', ch2: '' };
  }

  function crewListRows(ev) {
    var ids = Array.isArray(ev.crew) ? ev.crew : [];
    var rows = [];
    for (var i = 0; i < ids.length; i++) {
      var p = typeof getPersonnel === 'function' ? getPersonnel(ids[i]) : null;
      if (!p) continue;
      var dept = typeof getDepartment === 'function' ? getDepartment(p.dept) : null;
      rows.push({ personnel: p, deptName: dept ? dept.name : '—' });
    }
    return rows;
  }

  function chBadge(ch) {
    if (!ch) return '';
    var c = RADIO_CHANNELS.find(function (x) {
      return x.ch === ch;
    });
    var color = c ? c.color : '#666';
    return (
      '<span class="radio-ch-badge" style="background:' +
      color +
      '20;color:' +
      color +
      ';border:1px solid ' +
      color +
      '40;">' +
      esc(ch) +
      '</span>'
    );
  }

  W.epEditCrewListRow = function (eventId, personnelId) {
    var ev = typeof EVENTS !== 'undefined' ? EVENTS.find(function (e) {
      return e.id === eventId;
    }) : null;
    if (!ev) return;
    var pw = ensurePaperwork(ev);
    var defs = defaultCheckDates(ev);
    var ex = pw.crew_rows[personnelId] || {};
    var p = typeof getPersonnel === 'function' ? getPersonnel(personnelId) : null;
    if (!p) return;
    var body =
      '<p style="font-size:12px;color:var(--text-tertiary);margin:0 0 12px 0;">' +
      esc(p.name) +
      '</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
      '<div class="form-group"><label class="form-label">Hotel check-in</label><input class="form-input" id="ep-cl-in" value="' +
      esc(ex.checkIn != null && ex.checkIn !== '' ? ex.checkIn : defs.in0) +
      '"></div>' +
      '<div class="form-group"><label class="form-label">Hotel check-out</label><input class="form-input" id="ep-cl-out" value="' +
      esc(ex.checkOut != null && ex.checkOut !== '' ? ex.checkOut : defs.out0) +
      '"></div></div>' +
      '<div class="form-group"><label class="form-label">Confirmation #</label><input class="form-input" id="ep-cl-conf" value="' +
      esc(ex.confirm || '') +
      '"></div>' +
      '<label class="form-group" style="display:flex;align-items:center;gap:8px;font-size:13px;"><input type="checkbox" id="ep-cl-van" ' +
      (ex.van ? 'checked' : '') +
      '> Van</label>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;"><input type="checkbox" id="ep-cl-fly" ' +
      (ex.fly ? 'checked' : '') +
      '> Flying</label>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;"><input type="checkbox" id="ep-cl-drive" ' +
      (ex.drive ? 'checked' : '') +
      '> Driving</label>';
    var footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="epSaveCrewListRow(\'' +
      esc(eventId).replace(/'/g, "\\'") +
      "','" +
      esc(personnelId).replace(/'/g, "\\'") +
      "')\">Save</button>";
    if (typeof openModal === 'function') openModal('Crew list — hotel & transport', body, footer);
  };

  W.epSaveCrewListRow = function (eventId, personnelId) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var pw = ensurePaperwork(ev);
    function v(id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    }
    function ck(id) {
      var el = document.getElementById(id);
      return !!(el && el.checked);
    }
    pw.crew_rows[personnelId] = {
      checkIn: v('ep-cl-in'),
      checkOut: v('ep-cl-out'),
      confirm: v('ep-cl-conf'),
      van: ck('ep-cl-van'),
      fly: ck('ep-cl-fly'),
      drive: ck('ep-cl-drive'),
    };
    void persistPaperwork(ev);
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderPage === 'function') renderPage(currentPage);
    if (typeof showToast === 'function') showToast('Crew list row saved', 'success');
  };

  W.epEditPaperworkRefs = function (eventId) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var r = ensurePaperwork(ev).refs;
    function field(id, label, val) {
      return (
        '<div class="form-group"><label class="form-label">' +
        label +
        '</label><input class="form-input" id="' +
        id +
        '" value="' +
        esc(val || '') +
        '"></div>'
      );
    }
    var body =
      '<p style="font-size:12px;color:var(--text-tertiary);">Shown on the crew list reference cards (hotel, laundry, airports, etc.).</p>' +
      field('ep-ref-hotel-name', 'Hotel name', r.hotel_name) +
      field('ep-ref-hotel-addr', 'Hotel address', r.hotel_address) +
      field('ep-ref-hotel-meta', 'Hotel notes (parking, breakfast…)', r.hotel_meta) +
      field('ep-ref-laundry-name', 'Laundry / cleaners', r.laundry_name) +
      field('ep-ref-laundry-addr', 'Laundry address', r.laundry_address) +
      field('ep-ref-emergency', 'Emergency / urgent care', r.emergency) +
      field('ep-ref-ap1-title', 'Airport A label', r.airport_a_title || 'Nearest airport') +
      field('ep-ref-ap1-name', 'Airport A name', r.airport_a_name) +
      field('ep-ref-ap1-addr', 'Airport A address', r.airport_a_address) +
      field('ep-ref-ap2-title', 'Airport B label', r.airport_b_title || 'Alternate airport') +
      field('ep-ref-ap2-name', 'Airport B name', r.airport_b_name) +
      field('ep-ref-ap2-addr', 'Airport B address', r.airport_b_address);
    var footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="epSavePaperworkRefs(\'' +
      esc(eventId).replace(/'/g, "\\'") +
      "')\">Save</button>";
    if (typeof openModal === 'function') openModal('Reference info (crew list)', body, footer);
  };

  W.epSavePaperworkRefs = function (eventId) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var r = ensurePaperwork(ev).refs;
    function v(id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    }
    r.hotel_name = v('ep-ref-hotel-name');
    r.hotel_address = v('ep-ref-hotel-addr');
    r.hotel_meta = v('ep-ref-hotel-meta');
    r.laundry_name = v('ep-ref-laundry-name');
    r.laundry_address = v('ep-ref-laundry-addr');
    r.emergency = v('ep-ref-emergency');
    r.airport_a_title = v('ep-ref-ap1-title');
    r.airport_a_name = v('ep-ref-ap1-name');
    r.airport_a_address = v('ep-ref-ap1-addr');
    r.airport_b_title = v('ep-ref-ap2-title');
    r.airport_b_name = v('ep-ref-ap2-name');
    r.airport_b_address = v('ep-ref-ap2-addr');
    void persistPaperwork(ev);
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderPage === 'function') renderPage(currentPage);
    if (typeof showToast === 'function') showToast('Reference cards updated', 'success');
  };

  W.epRegenerateRadioAssignments = function (eventId) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var pw = ensurePaperwork(ev);
    var list = crewListRows(ev);
    pw.radio_assignments = {};
    for (var i = 0; i < list.length; i++) {
      var p = list[i].personnel;
      var ch = defaultChannelsForDeptName(list[i].deptName);
      pw.radio_assignments[p.id] = {
        ch1: ch.ch1,
        ch2: ch.ch2,
        radioId: 'R-' + ('00' + String(i + 1)).slice(-3),
        radioType: 'Handheld',
      };
    }
    void persistPaperwork(ev);
    if (typeof renderPage === 'function') renderPage(currentPage);
    if (typeof showToast === 'function') showToast('Radio channels reset from departments', 'success');
  };

  W.epEditRadioRow = function (eventId, personnelId) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var pw = ensurePaperwork(ev);
    var list = crewListRows(ev);
    var idx = list.findIndex(function (x) {
      return x.personnel.id === personnelId;
    });
    var p = idx >= 0 ? list[idx].personnel : null;
    if (!p) return;
    var ra = pw.radio_assignments[personnelId];
    if (!ra) {
      var ch = defaultChannelsForDeptName(idx >= 0 ? list[idx].deptName : '');
      ra = { ch1: ch.ch1, ch2: ch.ch2, radioId: 'R-000', radioType: 'Handheld' };
    }
    var chOpts = RADIO_CHANNELS.map(function (c) {
      return '<option value="' + esc(c.ch) + '"' + (ra.ch1 === c.ch ? ' selected' : '') + '>' + esc(c.ch + ' — ' + c.label) + '</option>';
    }).join('');
    var ch2Opts =
      '<option value="">—</option>' +
      RADIO_CHANNELS.map(function (c) {
        return '<option value="' + esc(c.ch) + '"' + (ra.ch2 === c.ch ? ' selected' : '') + '>' + esc(c.ch + ' — ' + c.label) + '</option>';
      }).join('');
    var body =
      '<p style="font-size:12px;color:var(--text-tertiary);">' +
      esc(p.name) +
      '</p>' +
      '<div class="form-group"><label class="form-label">Primary channel</label><select class="form-select" id="ep-r-ch1">' +
      chOpts +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">Secondary channel</label><select class="form-select" id="ep-r-ch2">' +
      ch2Opts +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">Radio ID</label><input class="form-input" id="ep-r-id" value="' +
      esc(ra.radioId || '') +
      '"></div>' +
      '<div class="form-group"><label class="form-label">Radio type</label><input class="form-input" id="ep-r-type" value="' +
      esc(ra.radioType || '') +
      '"></div>';
    var footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="epSaveRadioRow(\'' +
      esc(eventId).replace(/'/g, "\\'") +
      "','" +
      esc(personnelId).replace(/'/g, "\\'") +
      "')\">Save</button>";
    if (typeof openModal === 'function') openModal('Radio assignment', body, footer);
  };

  W.epSaveRadioRow = function (eventId, personnelId) {
    var ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    var pw = ensurePaperwork(ev);
    var c1 = document.getElementById('ep-r-ch1');
    var c2 = document.getElementById('ep-r-ch2');
    var idEl = document.getElementById('ep-r-id');
    var tEl = document.getElementById('ep-r-type');
    pw.radio_assignments[personnelId] = {
      ch1: c1 ? c1.value : '',
      ch2: c2 ? c2.value : '',
      radioId: idEl ? idEl.value : '',
      radioType: tEl ? tEl.value : '',
    };
    void persistPaperwork(ev);
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderPage === 'function') renderPage(currentPage);
    if (typeof showToast === 'function') showToast('Radio row saved', 'success');
  };

  function renderEventCrewList(ev, venue, client) {
    var v = venue && venue.name ? venue : { name: 'Venue TBD', city: '' };
    var cname = client && client.name ? client.name : 'Client';
    var rows = crewListRows(ev);
    var pw = ensurePaperwork(ev);
    var defs = defaultCheckDates(ev);

    function checkIcon(on) {
      return on
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';
    }

    var toolbar =
      '<div class="ds-toolbar" style="margin-bottom:14px;">' +
      '<span class="ds-toolbar-hint" style="flex:1;">Rows come from the <strong>Crew</strong> tab. Edit hotel / transport per person; reference cards use venue + optional hotel & airport notes.</span>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="epEditPaperworkRefs(\'' +
      esc(ev.id).replace(/'/g, "\\'") +
      "')\">Edit reference cards</button>" +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="switchEventTab(\'crew\')">Manage crew →</button>' +
      '</div>';

    var title =
      esc(ev.name) + ' — Crew list · ' + esc(cname) + (v.city ? ' · ' + esc(v.city) : '');

    var tableBody = '';
    if (rows.length === 0) {
      tableBody =
        '<tr><td colspan="11" style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:14px;">No crew assigned yet. Add people on the Crew tab to populate this sheet.</td></tr>';
    } else {
      var byDept = {};
      for (var i = 0; i < rows.length; i++) {
        var dn = rows[i].deptName;
        if (!byDept[dn]) byDept[dn] = [];
        byDept[dn].push(rows[i]);
      }
      var num = 0;
      var deptNames = Object.keys(byDept).sort();
      for (var d = 0; d < deptNames.length; d++) {
        var dn0 = deptNames[d];
        tableBody +=
          '<tr class="cl-separator"><td colspan="11" style="padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary);background:var(--bg-primary);">' +
          esc(dn0) +
          '</td></tr>';
        var grp = byDept[dn0];
        for (var j = 0; j < grp.length; j++) {
          num++;
          var p = grp[j].personnel;
          var ex = pw.crew_rows[p.id] || {};
          var cin = ex.checkIn != null && ex.checkIn !== '' ? ex.checkIn : defs.in0;
          var cout = ex.checkOut != null && ex.checkOut !== '' ? ex.checkOut : defs.out0;
          tableBody +=
            '<tr class="cl-row ep-clickable" style="cursor:pointer;" onclick="epEditCrewListRow(\'' +
            esc(ev.id).replace(/'/g, "\\'") +
            "','" +
            esc(p.id).replace(/'/g, "\\'") +
            '\')" title="Click to edit hotel & transport">' +
            '<td class="cl-num">' +
            num +
            '</td>' +
            '<td class="cl-name">' +
            esc(p.name) +
            '</td>' +
            '<td class="cl-pos">' +
            esc(p.role) +
            '</td>' +
            '<td class="cl-phone">' +
            esc(p.phone || '') +
            '</td>' +
            '<td class="cl-email">' +
            esc(p.email || '') +
            '</td>' +
            '<td class="cl-date">' +
            esc(cin) +
            '</td>' +
            '<td class="cl-date">' +
            esc(cout) +
            '</td>' +
            '<td class="cl-confirm">' +
            esc(ex.confirm || '') +
            '</td>' +
            '<td class="cl-check">' +
            checkIcon(ex.van) +
            '</td>' +
            '<td class="cl-check">' +
            checkIcon(ex.fly) +
            '</td>' +
            '<td class="cl-check">' +
            checkIcon(ex.drive) +
            '</td>' +
            '</tr>';
        }
      }
    }

    var r = pw.refs;
    var hotelName = r.hotel_name || '—';
    var hotelAddr = r.hotel_address || 'Add hotel in “Edit reference cards”';
    var hotelMeta = r.hotel_meta || '';

    return (
      '<div class="cl-container">' +
      toolbar +
      '<div class="cl-title-bar"><h3 style="margin:0;font-size:15px;font-weight:700;">' +
      title +
      '</h3></div>' +
      '<div class="cl-table-wrap">' +
      '<table class="cl-table">' +
      '<thead><tr>' +
      '<th class="cl-th-num">#</th><th class="cl-th-name">Name</th><th class="cl-th-pos">Position</th>' +
      '<th class="cl-th-phone">Phone</th><th class="cl-th-email">Email</th>' +
      '<th class="cl-th-hotel" colspan="2">HOTEL</th><th class="cl-th-confirm">Confirmation #</th>' +
      '<th class="cl-th-transport" colspan="3">TRANSPORTATION</th>' +
      '</tr>' +
      '<tr class="cl-subheader"><th></th><th></th><th></th><th></th><th></th><th>Check In</th><th>Check Out</th><th></th><th>Van</th><th>Flying</th><th>Driving</th></tr>' +
      '</thead><tbody>' +
      tableBody +
      '</tbody></table></div>' +
      '<div class="cl-reference-section">' +
      '<div class="cl-ref-grid">' +
      '<div class="cl-ref-card">' +
      '<div class="cl-ref-title">Hotel</div>' +
      '<div class="cl-ref-name">' +
      esc(hotelName) +
      '</div>' +
      '<div class="cl-ref-detail">' +
      esc(hotelAddr) +
      '</div>' +
      (hotelMeta ? '<div class="cl-ref-meta"><span>' + esc(hotelMeta) + '</span></div>' : '') +
      '</div>' +
      '<div class="cl-ref-card">' +
      '<div class="cl-ref-title">Venue</div>' +
      '<div class="cl-ref-name">' +
      esc(v.name) +
      '</div>' +
      '<div class="cl-ref-detail">' +
      esc(v.city || '') +
      (v.address ? ' · ' + esc(v.address) : '') +
      '</div>' +
      '</div>' +
      '<div class="cl-ref-card">' +
      '<div class="cl-ref-title">Laundry / wash</div>' +
      '<div class="cl-ref-name">' +
      esc(r.laundry_name || '—') +
      '</div>' +
      '<div class="cl-ref-detail">' +
      esc(r.laundry_address || '') +
      '</div>' +
      '</div>' +
      '<div class="cl-ref-card">' +
      '<div class="cl-ref-title">Emergency / urgent care</div>' +
      '<div class="cl-ref-detail" style="white-space:pre-wrap;">' +
      esc(r.emergency || 'Add hospital or clinic details in reference cards.') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="cl-ref-grid" style="margin-top:12px;">' +
      '<div class="cl-ref-card">' +
      '<div class="cl-ref-title">' +
      esc(r.airport_a_title || 'Airport A') +
      '</div>' +
      '<div class="cl-ref-name">' +
      esc(r.airport_a_name || '—') +
      '</div>' +
      '<div class="cl-ref-detail">' +
      esc(r.airport_a_address || '') +
      '</div>' +
      '</div>' +
      '<div class="cl-ref-card">' +
      '<div class="cl-ref-title">' +
      esc(r.airport_b_title || 'Airport B') +
      '</div>' +
      '<div class="cl-ref-name">' +
      esc(r.airport_b_name || '—') +
      '</div>' +
      '<div class="cl-ref-detail">' +
      esc(r.airport_b_address || '') +
      '</div>' +
      '</div>' +
      '</div></div></div>'
    );
  }

  function renderRadiosTab(ev) {
    var pw = ensurePaperwork(ev);
    var list = crewListRows(ev);

    var deptGroups = {};
    for (var i = 0; i < list.length; i++) {
      var dn = list[i].deptName;
      if (!deptGroups[dn]) deptGroups[dn] = [];
      deptGroups[dn].push(list[i]);
    }
    var depts = Object.keys(deptGroups).sort();

    var tbody = '';
    for (var d = 0; d < depts.length; d++) {
      var dn = depts[d];
      tbody +=
        '<tr class="cl-separator"><td colspan="6" style="padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary);background:var(--bg-primary);">' +
        esc(dn) +
        '</td></tr>';
      var grp = deptGroups[dn];
      for (var j = 0; j < grp.length; j++) {
        var p = grp[j].personnel;
        var ra = pw.radio_assignments[p.id];
        if (!ra) {
          var chDef = defaultChannelsForDeptName(dn);
          ra = { ch1: chDef.ch1, ch2: chDef.ch2, radioId: '', radioType: 'Handheld' };
        }
        tbody +=
          '<tr class="cl-row ep-clickable" style="cursor:pointer;" onclick="epEditRadioRow(\'' +
          esc(ev.id).replace(/'/g, "\\'") +
          "','" +
          esc(p.id).replace(/'/g, "\\'") +
          '\')" title="Click to edit">' +
          '<td class="cl-name">' +
          esc(p.name) +
          '</td>' +
          '<td class="cl-pos">' +
          esc(p.role) +
          '</td>' +
          '<td style="text-align:center;">' +
          chBadge(ra.ch1) +
          '</td>' +
          '<td style="text-align:center;">' +
          chBadge(ra.ch2) +
          '</td>' +
          '<td style="font-family:monospace;font-size:11px;color:var(--text-secondary);">' +
          esc(ra.radioId || '—') +
          '</td>' +
          '<td style="font-size:11px;color:var(--text-tertiary);">' +
          esc(ra.radioType || '') +
          '</td>' +
          '</tr>';
      }
    }

    if (list.length === 0) {
      tbody =
        '<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--text-tertiary);">No crew assigned — add crew first, then return here for radio channels.</td></tr>';
    }

    var assignedN = list.length;

    return (
      '<div class="ds-container">' +
      '<div class="ds-toolbar" style="margin-bottom:14px;">' +
      '<span class="ds-toolbar-hint" style="flex:1;">Channels default from each person’s department; click a row to fine-tune. Emergency channel <strong>8</strong> stays clear.</span>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="epRegenerateRadioAssignments(\'' +
      esc(ev.id).replace(/'/g, "\\'") +
      "')\">Reset from departments</button>" +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="switchEventTab(\'crew\')">Crew →</button>' +
      '</div>' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;">' +
      '<div style="flex:1;min-width:500px;">' +
      '<div class="cl-title-bar" style="display:flex;align-items:center;justify-content:space-between;">' +
      '<h3 style="margin:0;font-size:15px;font-weight:700;">Radio assignments</h3>' +
      '<div style="display:flex;gap:6px;">' +
      '<button class="btn btn-ghost btn-sm" onclick="showToast(\'Export — wire to PDF/print when ready\',\'info\')">Export</button>' +
      '</div></div>' +
      '<table class="cl-table" style="margin-top:0;">' +
      '<thead><tr><th style="width:160px;">Name</th><th style="width:200px;">Position</th><th style="width:70px;text-align:center;">Primary</th><th style="width:70px;text-align:center;">Secondary</th><th style="width:80px;">Radio ID</th><th>Type</th></tr></thead>' +
      '<tbody>' +
      tbody +
      '</tbody></table></div>' +
      '<div style="width:240px;flex-shrink:0;">' +
      '<div class="cl-title-bar"><h3 style="margin:0;font-size:13px;font-weight:700;">Channel directory</h3></div>' +
      '<div style="display:flex;flex-direction:column;gap:0;">' +
      RADIO_CHANNELS.map(function (c) {
        return (
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-subtle);">' +
          '<span class="radio-ch-badge" style="background:' +
          c.color +
          '20;color:' +
          c.color +
          ';border:1px solid ' +
          c.color +
          '40;font-size:13px;width:28px;text-align:center;">' +
          esc(c.ch) +
          '</span>' +
          '<span style="font-size:12px;font-weight:600;color:var(--text-primary);">' +
          esc(c.label) +
          '</span></div>'
        );
      }).join('') +
      '</div>' +
      '<div style="padding:12px 14px;font-size:11px;color:var(--text-tertiary);border-top:1px solid var(--border-subtle);">Primary channel before call time.</div>' +
      '<div style="padding:12px 14px;border-top:1px solid var(--border-default);">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary);margin-bottom:8px;">Summary</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      '<div style="background:var(--bg-tertiary);padding:8px;border-radius:var(--radius-md);text-align:center;">' +
      '<div style="font-size:18px;font-weight:700;color:var(--text-primary);">' +
      assignedN +
      '</div>' +
      '<div style="font-size:10px;color:var(--text-tertiary);">Assigned</div></div>' +
      '<div style="background:var(--bg-tertiary);padding:8px;border-radius:var(--radius-md);text-align:center;">' +
      '<div style="font-size:18px;font-weight:700;color:var(--accent-green);">—</div>' +
      '<div style="font-size:10px;color:var(--text-tertiary);">Spares (TBD)</div></div>' +
      '</div></div></div></div></div>'
    );
  }

  W.renderEventCrewList = renderEventCrewList;
  W.renderRadiosTab = renderRadiosTab;
})(typeof window !== 'undefined' ? window : globalThis);
