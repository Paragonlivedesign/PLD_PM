/* ============================================
   Searchable picker overlay — large lists (crew, events, clients, …)
   Depends on: none (appends overlay to document.body; z-index above main modal)
   ============================================
   Usage:
     openPickerModal({
       title: 'Select crew member',
       items: [{ id: 'uuid', primary: 'Name', secondary: 'Role', meta: { … } }],
       searchPlaceholder: 'Search…',
       pickerFilter: 'none' | 'events', // events: date range + phase bar (requires meta on items from pickerItemsFromEvents)
       onSelect: function (id, item) { … },
     });
     pickerItemsFromPersonnel(PERSONNEL)
     pickerItemsFromEvents(EVENTS, { excludeTerminal: true })
     pickerItemsFromVenues(VENUES)
     pickerItemsHomeBaseFromVenues(VENUES) // meta.storageValue for truck home_base
     pickerItemsFromDepartments(DEPARTMENTS)
     pickerItemsFromVendors(VENDORS)
   ============================================ */
(function (global) {
  function pldEscHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /** ISO date strings YYYY-MM-DD; empty filter parts = open-ended on that side. */
  function pldEventOverlapsFilter(meta, filterStart, filterEnd, phaseVal) {
    if (phaseVal && String(phaseVal).trim() !== '') {
      var ph = meta && meta.phase != null ? String(meta.phase) : '';
      if (ph !== String(phaseVal)) return false;
    }
    var fs = filterStart ? String(filterStart).slice(0, 10) : '';
    var fe = filterEnd ? String(filterEnd).slice(0, 10) : '';
    if (!fs && !fe) return true;
    var s = meta && meta.startISO ? String(meta.startISO).slice(0, 10) : '';
    var e = meta && meta.endISO ? String(meta.endISO).slice(0, 10) : s;
    if (!s && !e) return true;
    if (!e) e = s;
    if (!s) s = e;
    if (fs && fe) {
      if (fs > fe) return true;
      return s <= fe && e >= fs;
    }
    if (fs && !fe) return e >= fs;
    if (fe && !fs) return s <= fe;
    return true;
  }

  /** @param {Array<{id:string,primary:string,secondary?:string,meta?:object}>} items */
  function openPickerModal(opts) {
    if (!opts || typeof opts.onSelect !== 'function') return;
    var title = opts.title || 'Choose';
    var items = Array.isArray(opts.items) ? opts.items : [];
    var placeholder = opts.searchPlaceholder || 'Type to filter…';
    var emptyMsg = opts.emptyMessage || 'No matches.';
    var onSelect = opts.onSelect;
    var onCancel = typeof opts.onCancel === 'function' ? opts.onCancel : null;
    var filterPreset = opts.pickerFilter || opts.filterPreset || 'none';
    /** @type {Array<{ label: string, className?: string, onClick: () => void }>} */
    var footerButtons = Array.isArray(opts.footerButtons) ? opts.footerButtons : [];

    var overlay = document.getElementById('pldPickerOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pldPickerOverlay';
      overlay.className = 'modal-overlay pld-picker-overlay';
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('role', 'dialog');
      document.body.appendChild(overlay);
    }

    var itemById = new Map();
    items.forEach(function (it) {
      itemById.set(String(it.id), it);
    });

    function closePicker() {
      overlay.classList.add('hidden');
      document.removeEventListener('keydown', escHandler);
      if (overlay._pldBackdropClick) {
        overlay.removeEventListener('click', overlay._pldBackdropClick);
        overlay._pldBackdropClick = null;
      }
    }

    function escHandler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
        if (onCancel) onCancel();
      }
    }

    var modalWide = filterPreset === 'events' ? 'max-width:520px' : 'max-width:440px';
    var filterBlock =
      filterPreset === 'events'
        ? '<div class="pld-picker-filters" id="pldPickerFilters">' +
          '<div class="pld-picker-filters-title">Filter</div>' +
          '<div class="pld-picker-filters-grid">' +
          '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">From</label>' +
          '<input type="date" class="form-input" id="pldPickerFilterStart" style="margin:0;padding:6px 8px;font-size:12px;"></div>' +
          '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">To</label>' +
          '<input type="date" class="form-input" id="pldPickerFilterEnd" style="margin:0;padding:6px 8px;font-size:12px;"></div>' +
          '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Phase</label>' +
          '<select class="form-select" id="pldPickerFilterPhase" style="margin:0;padding:6px 8px;font-size:12px;">' +
          '<option value="">All</option>' +
          (typeof global.PHASES !== 'undefined' && Array.isArray(global.PHASES)
            ? global.PHASES.map(function (ph) {
                var lab =
                  typeof global.PHASE_LABELS !== 'undefined' && global.PHASE_LABELS[ph]
                    ? global.PHASE_LABELS[ph]
                    : ph;
                return (
                  '<option value="' +
                  pldEscHtml(ph) +
                  '">' +
                  pldEscHtml(lab) +
                  '</option>'
                );
              }).join('')
            : '') +
          '</select></div>' +
          '<div class="form-group" style="margin:0;align-self:end;">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="pldPickerFilterClear" style="width:100%;">Clear filters</button>' +
          '</div></div></div>'
        : '';

    overlay.innerHTML =
      '<div class="modal pld-picker-modal" style="' +
      modalWide +
      '">' +
      '<div class="modal-header">' +
      '<h3 id="pldPickerTitle">' +
      pldEscHtml(title) +
      '</h3>' +
      '<button type="button" class="modal-close" id="pldPickerCloseBtn" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="modal-body" style="padding-top:12px">' +
      filterBlock +
      '<input type="search" class="form-input" id="pldPickerSearch" autocomplete="off" style="margin-bottom:12px">' +
      '<div class="pld-picker-list" id="pldPickerList"></div>' +
      '<p id="pldPickerEmpty" class="hidden" style="text-align:center;color:var(--text-tertiary);font-size:13px;padding:16px;margin:0">' +
      pldEscHtml(emptyMsg) +
      '</p>' +
      '</div>' +
      '<div class="modal-footer pld-picker-footer" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center;">' +
      '<span id="pldPickerFooterLead" style="flex:1;min-width:8px;"></span>' +
      '<button type="button" class="btn btn-secondary" id="pldPickerCancelBtn">Cancel</button>' +
      '</div>' +
      '</div>';

    var searchEl = document.getElementById('pldPickerSearch');
    var listEl = document.getElementById('pldPickerList');
    var emptyEl = document.getElementById('pldPickerEmpty');
    if (searchEl) {
      searchEl.placeholder = placeholder;
    }

    function getFilterState() {
      var fs = '';
      var fe = '';
      var ph = '';
      if (filterPreset === 'events') {
        var elS = document.getElementById('pldPickerFilterStart');
        var elE = document.getElementById('pldPickerFilterEnd');
        var elP = document.getElementById('pldPickerFilterPhase');
        fs = elS && elS.value ? elS.value : '';
        fe = elE && elE.value ? elE.value : '';
        ph = elP && elP.value ? elP.value : '';
      }
      return { start: fs, end: fe, phase: ph };
    }

    function renderList(query) {
      var ql = String(query || '')
        .toLowerCase()
        .trim();
      var st = getFilterState();
      var filtered = items.filter(function (it) {
        if (filterPreset === 'events') {
          if (!pldEventOverlapsFilter(it.meta || {}, st.start, st.end, st.phase)) return false;
        }
        if (!ql) return true;
        var a = String(it.primary || '').toLowerCase();
        var b = String(it.secondary || '').toLowerCase();
        var c = String(it.id || '').toLowerCase();
        return a.indexOf(ql) >= 0 || b.indexOf(ql) >= 0 || c.indexOf(ql) >= 0;
      });

      if (!listEl) return;
      if (filtered.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) {
          emptyEl.classList.remove('hidden');
          emptyEl.style.display = 'block';
        }
        return;
      }
      if (emptyEl) {
        emptyEl.classList.add('hidden');
        emptyEl.style.display = 'none';
      }

      listEl.innerHTML = filtered
        .map(function (it) {
          var id = String(it.id);
          var pid = pldEscHtml(id);
          var sec =
            it.secondary && String(it.secondary).trim() !== ''
              ? '<span class="pld-picker-secondary">' + pldEscHtml(it.secondary) + '</span>'
              : '';
          return (
            '<button type="button" class="pld-picker-row" data-id="' +
            pid +
            '">' +
            '<span class="pld-picker-primary">' +
            pldEscHtml(it.primary) +
            '</span>' +
            sec +
            '</button>'
          );
        })
        .join('');
    }

    listEl.onclick = function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.pld-picker-row') : null;
      if (!btn || !btn.getAttribute) return;
      var id = btn.getAttribute('data-id');
      if (id == null) return;
      var raw = itemById.get(String(id));
      closePicker();
      onSelect(String(id), raw || { id: id, primary: '', secondary: '' });
    };

    document.addEventListener('keydown', escHandler);

    if (overlay._pldBackdropClick) {
      overlay.removeEventListener('click', overlay._pldBackdropClick);
      overlay._pldBackdropClick = null;
    }
    overlay._pldBackdropClick = function (e) {
      if (e.target === overlay) {
        closePicker();
        if (onCancel) onCancel();
      }
    };
    overlay.addEventListener('click', overlay._pldBackdropClick);

    var closeBtn = document.getElementById('pldPickerCloseBtn');
    if (closeBtn) {
      closeBtn.onclick = function () {
        closePicker();
        if (onCancel) onCancel();
      };
    }
    var cancelBtn = document.getElementById('pldPickerCancelBtn');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        closePicker();
        if (onCancel) onCancel();
      };
    }

    if (footerButtons.length > 0 && cancelBtn && cancelBtn.parentNode) {
      for (var bi = footerButtons.length - 1; bi >= 0; bi--) {
        (function (fb) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = fb.className || 'btn btn-primary btn-sm';
          b.textContent = fb.label || 'Action';
          b.onclick = function () {
            closePicker();
            if (typeof fb.onClick === 'function') fb.onClick();
          };
          cancelBtn.parentNode.insertBefore(b, cancelBtn);
        })(footerButtons[bi]);
      }
    }

    if (searchEl) {
      searchEl.oninput = function () {
        renderList(searchEl.value);
      };
    }

    if (filterPreset === 'events') {
      var fsEl = document.getElementById('pldPickerFilterStart');
      var feEl = document.getElementById('pldPickerFilterEnd');
      var fpEl = document.getElementById('pldPickerFilterPhase');
      var fcBtn = document.getElementById('pldPickerFilterClear');
      function refilter() {
        renderList(searchEl ? searchEl.value : '');
      }
      if (fsEl) fsEl.onchange = refilter;
      if (feEl) feEl.onchange = refilter;
      if (fpEl) fpEl.onchange = refilter;
      if (fcBtn) {
        fcBtn.onclick = function () {
          if (fsEl) fsEl.value = '';
          if (feEl) feEl.value = '';
          if (fpEl) fpEl.value = '';
          refilter();
        };
      }
    }

    renderList('');
    overlay.classList.remove('hidden');
    overlay.style.zIndex = '200';

    setTimeout(function () {
      if (searchEl) searchEl.focus();
    }, 0);
  }

  function pickerItemsFromPersonnel(personnelArr) {
    var arr = Array.isArray(personnelArr) ? personnelArr : [];
    return arr.map(function (p) {
      return {
        id: String(p.id),
        primary: p.name || '—',
        secondary: p.role || '',
      };
    });
  }

  function pickerItemsFromEvents(eventsArr, opts) {
    opts = opts || {};
    var excludeTerminal = opts.excludeTerminal !== false;
    var arr = Array.isArray(eventsArr) ? eventsArr.slice() : [];
    if (excludeTerminal && typeof global.isTerminalEventPhase === 'function') {
      arr = arr.filter(function (e) {
        return !global.isTerminalEventPhase(e.phase);
      });
    }
    return arr.map(function (e) {
      var phase =
        typeof global.PHASE_LABELS !== 'undefined' && e.phase
          ? global.PHASE_LABELS[e.phase]
          : '';
      var venueName = '';
      if (typeof global.getVenue === 'function' && e.venue) {
        var v = global.getVenue(e.venue);
        venueName = v && v.name ? String(v.name) : '';
      }
      var sd = e.startDate != null ? String(e.startDate).slice(0, 10) : '';
      var ed = e.endDate != null ? String(e.endDate).slice(0, 10) : sd;
      var dateBit = '';
      if (sd) dateBit = ed && ed !== sd ? sd + ' → ' + ed : sd;
      var secondary = [phase, venueName, dateBit].filter(Boolean).join(' · ');
      return {
        id: String(e.id),
        primary: e.name || '—',
        secondary: secondary,
        meta: {
          startISO: sd,
          endISO: ed || sd,
          phase: e.phase != null ? String(e.phase) : '',
        },
      };
    });
  }

  function pickerItemsFromClients(clientsArr) {
    var arr = Array.isArray(clientsArr) ? clientsArr : [];
    return arr.map(function (c) {
      return {
        id: String(c.id),
        primary: c.name || '—',
        secondary: c.city || c.email || '',
      };
    });
  }

  function pickerItemsFromVenues(venuesArr) {
    var arr = Array.isArray(venuesArr) ? venuesArr : [];
    return arr.map(function (v) {
      var city = v.city != null ? String(v.city) : '';
      var name = v.name != null ? String(v.name) : '—';
      var secondary = v.address != null && String(v.address).trim() !== '' ? String(v.address) : '';
      return {
        id: String(v.id),
        primary: city ? name + ' — ' + city : name,
        secondary: secondary,
      };
    });
  }

  /** One line for `home_base` string; searchable primary/secondary; meta.storageValue is what we store. */
  function pickerItemsHomeBaseFromVenues(venuesArr) {
    var arr = Array.isArray(venuesArr) ? venuesArr : [];
    return arr.map(function (v) {
      var city = v.city != null ? String(v.city).trim() : '';
      var name = v.name != null ? String(v.name) : '—';
      var addr = v.address != null ? String(v.address).trim() : '';
      var storage = addr ? [name, addr, city].filter(Boolean).join(', ') : city ? name + ', ' + city : name;
      var secondary = addr ? addr + (city ? ' · ' + city : '') : city || 'Venue';
      return {
        id: 'hb:v:' + String(v.id),
        primary: name,
        secondary: secondary,
        meta: { storageValue: storage, kind: 'venue' },
      };
    });
  }

  function pickerItemsFromDepartments(deptsArr) {
    var arr = Array.isArray(deptsArr) ? deptsArr : [];
    return arr.map(function (d) {
      return {
        id: String(d.id),
        primary: d.name != null ? String(d.name) : '—',
        secondary: d.color != null ? String(d.color) : '',
      };
    });
  }

  function pickerItemsFromVendors(vendorsArr) {
    var arr = Array.isArray(vendorsArr) ? vendorsArr : [];
    return arr.map(function (v) {
      var name = v.name != null ? String(v.name) : '—';
      var cn = v.contact_name != null ? String(v.contact_name).trim() : '';
      var em = v.contact_email != null ? String(v.contact_email).trim() : '';
      var ph = v.phone != null ? String(v.phone).trim() : '';
      var secondary = [cn, em || ph].filter(Boolean).join(' · ');
      return {
        id: String(v.id),
        primary: name,
        secondary: secondary,
      };
    });
  }

  global.openPickerModal = openPickerModal;
  global.pickerItemsFromPersonnel = pickerItemsFromPersonnel;
  global.pickerItemsFromEvents = pickerItemsFromEvents;
  global.pickerItemsFromClients = pickerItemsFromClients;
  global.pickerItemsFromVenues = pickerItemsFromVenues;
  global.pickerItemsHomeBaseFromVenues = pickerItemsHomeBaseFromVenues;
  global.pickerItemsFromDepartments = pickerItemsFromDepartments;
  global.pickerItemsFromVendors = pickerItemsFromVendors;
  global.pldEscPickerHtml = pldEscHtml;
})(typeof window !== 'undefined' ? window : globalThis);
