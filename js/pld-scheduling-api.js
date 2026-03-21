/* ============================================
   Scheduling REST (Wave 2) — crew / truck assignments
   Depends on: pld-api.js, state (EVENTS), pld-events-sync (PLD_EVENTS_FROM_REST)
   ============================================ */

(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(s || "").trim(),
    );
  }

  function schedulingRestEnabled() {
    return (
      typeof global.PLD_EVENTS_FROM_REST !== "undefined" &&
      global.PLD_EVENTS_FROM_REST === true &&
      typeof global.pldApiFetch === "function"
    );
  }

  global.pldHydrateEventCrewFromApi = async function pldHydrateEventCrewFromApi(eventId) {
    const EVENTS = global.EVENTS;
    if (!EVENTS || typeof global.pldApiFetch !== "function") return;
    const ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    try {
      const r = await global.pldApiFetch(
        "/api/v1/assignments/crew?event_id=" +
          encodeURIComponent(eventId) +
          "&limit=100&sort_by=start_date&sort_order=asc",
        { method: "GET" },
      );
      if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) return;
      const raw = r.body.data;
      const list = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      const ids = [];
      for (let i = 0; i < list.length; i++) {
        const pid = list[i].personnel_id;
        if (pid && !seen.has(pid)) {
          seen.add(pid);
          ids.push(pid);
        }
      }
      ev.crew = ids;
    } catch (_e) {
      /* ignore */
    }
  };

  global.pldHydrateEventTruckFromApi = async function pldHydrateEventTruckFromApi(eventId) {
    const EVENTS = global.EVENTS;
    if (!EVENTS || typeof global.pldApiFetch !== "function") return;
    const ev = EVENTS.find(function (e) {
      return e.id === eventId;
    });
    if (!ev) return;
    try {
      const r = await global.pldApiFetch(
        "/api/v1/assignments/truck?event_id=" +
          encodeURIComponent(eventId) +
          "&limit=100",
        { method: "GET" },
      );
      if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) return;
      const raw = r.body.data;
      const list = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      const ids = [];
      for (let i = 0; i < list.length; i++) {
        const tid = list[i].truck_id;
        if (tid && !seen.has(tid)) {
          seen.add(tid);
          ids.push(tid);
        }
      }
      ev.trucks = ids;
    } catch (_e) {
      /* ignore */
    }
  };

  /**
   * GET truck assignments for an event, set ev.trucks, re-render event page + sidebar counts.
   */
  global.pldRefreshEventTruckAssignments = async function pldRefreshEventTruckAssignments(
    eventId,
  ) {
    await global.pldHydrateEventTruckFromApi(eventId);
    if (
      typeof global.renderPage === "function" &&
      global.currentPage === "event" &&
      global.selectedEventId === eventId
    ) {
      global.renderPage("event");
    }
    if (typeof global.updateSidebarNavCounts === "function") {
      global.updateSidebarNavCounts();
    }
  };

  /**
   * Loads GET /api/v1/assignments/crew?event_id=… into #pldEventAssignmentsPanel when present.
   */
  global.pldRefreshEventCrewAssignments = async function pldRefreshEventCrewAssignments(
    eventId,
  ) {
    const el = document.getElementById("pldEventAssignmentsPanel");
    if (!el) return;
    if (typeof global.pldApiFetch !== "function") {
      el.innerHTML = "";
      return;
    }
    el.innerHTML =
      '<p style="font-size:13px;color:var(--text-tertiary);margin:0;">Loading crew assignments…</p>';
    try {
      const r = await global.pldApiFetch(
        "/api/v1/assignments/crew?event_id=" +
          encodeURIComponent(eventId) +
          "&limit=100&sort_by=start_date&sort_order=asc",
        { method: "GET" },
      );
      if (!r.ok || !r.body || (r.body.errors && r.body.errors.length)) {
        el.innerHTML =
          '<p style="font-size:13px;color:var(--accent-amber);margin:0;">Could not load assignments (API).</p>';
        return;
      }
      const raw = r.body.data;
      const list = Array.isArray(raw) ? raw : [];
      if (!list.length) {
        el.innerHTML =
          '<p style="font-size:13px;color:var(--text-tertiary);margin:0;">No crew assignments in API for this event yet.</p>';
        return;
      }
      const rows = list
        .map(function (a) {
          const name =
            a.personnel_name ||
            (a.personnel_id ? String(a.personnel_id).slice(0, 8) + "…" : "—");
          const start = a.start_date || "—";
          const end = a.end_date || "—";
          const st = a.status || "—";
          const role = a.role || "—";
          return (
            "<tr><td>" +
            escapeHtml(name) +
            "</td><td>" +
            escapeHtml(role) +
            "</td><td>" +
            escapeHtml(start) +
            " → " +
            escapeHtml(end) +
            "</td><td>" +
            escapeHtml(st) +
            "</td></tr>"
          );
        })
        .join("");
      el.innerHTML =
        '<div class="ep-section" style="margin-bottom:0;">' +
        '<div class="ep-section-header">Crew assignments (API)</div>' +
        '<p style="font-size:12px;color:var(--text-tertiary);margin:0 0 8px 0;">Live data from <code>/api/v1/assignments/crew</code> when the shell is pointed at PLD_PM.</p>' +
        '<div class="table-wrap"><table class="data-table">' +
        "<thead><tr><th>Name</th><th>Role</th><th>Dates</th><th>Status</th></tr></thead>" +
        "<tbody>" +
        rows +
        "</tbody></table></div></div>";
    } catch (e) {
      el.innerHTML =
        '<p style="font-size:13px;color:var(--accent-red);margin:0;">Failed to load assignments.</p>';
    }
  };

  global.pldSubmitAssignCrewFromModal = async function pldSubmitAssignCrewFromModal() {
    const idEl = document.getElementById("assignCrewEventId");
    const eventId = idEl && idEl.value ? idEl.value.trim() : "";
    const EVENTS = global.EVENTS;
    const ev = eventId && EVENTS ? EVENTS.find(function (e) {
      return e.id === eventId;
    }) : null;
    if (!ev) {
      if (typeof global.showToast === "function") {
        global.showToast("Event not found.", "error");
      }
      return;
    }
    const boxes = document.querySelectorAll(".assign-crew-cb:checked");
    const selected = [];
    boxes.forEach(function (cb) {
      if (cb.value) {
        selected.push({
          personnelId: cb.value,
          role: (cb.getAttribute("data-role") || "crew").trim() || "crew",
          departmentId: cb.getAttribute("data-dept") || "",
        });
      }
    });
    if (!selected.length) {
      if (typeof global.showToast === "function") {
        global.showToast("Select at least one crew member.", "warning");
      }
      return;
    }
    const startEl = document.getElementById("assignCrewStart");
    const endEl = document.getElementById("assignCrewEnd");
    const timeEl = document.getElementById("assignCrewCallTime");
    let startDate = (startEl && startEl.value) || ev.startDate || "";
    let endDate = (endEl && endEl.value) || ev.endDate || startDate;
    if (!startDate || !endDate) {
      if (typeof global.showToast === "function") {
        global.showToast("Start and end dates are required.", "error");
      }
      return;
    }
    const startTime = timeEl && timeEl.value ? timeEl.value : null;
    const useApi = schedulingRestEnabled();
    if (useApi) {
      let failMsg = "";
      for (let i = 0; i < selected.length; i++) {
        const s = selected[i];
        const body = {
          event_id: eventId,
          personnel_id: s.personnelId,
          role: s.role,
          start_date: String(startDate).slice(0, 10),
          end_date: String(endDate).slice(0, 10),
          status: "tentative",
        };
        if (startTime) body.start_time = startTime;
        if (s.departmentId && isUuid(s.departmentId)) {
          body.department_id = s.departmentId;
        }
        const r = await global.pldApiFetch("/api/v1/assignments/crew", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          failMsg =
            (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) ||
            "Assignment failed";
          break;
        }
      }
      if (failMsg) {
        if (typeof global.showToast === "function") {
          global.showToast(failMsg, "error");
        }
        return;
      }
      await global.pldHydrateEventCrewFromApi(eventId);
      if (typeof global.pldRefreshEventCrewAssignments === "function") {
        await global.pldRefreshEventCrewAssignments(eventId);
      }
    } else {
      const cur = Array.isArray(ev.crew) ? ev.crew.slice() : [];
      const set = new Set(cur);
      for (let i = 0; i < selected.length; i++) {
        set.add(selected[i].personnelId);
      }
      ev.crew = Array.from(set);
    }
    if (typeof global.closeModal === "function") global.closeModal();
    if (typeof global.showToast === "function") {
      global.showToast("Crew assigned.", "success");
    }
    if (
      typeof global.renderPage === "function" &&
      global.currentPage === "event" &&
      global.selectedEventId === eventId
    ) {
      global.renderPage("event");
    }
    if (typeof global.updateSidebarNavCounts === "function") {
      global.updateSidebarNavCounts();
    }
  };

  global.pldSubmitAssignTrucksToEventFromModal = async function pldSubmitAssignTrucksToEventFromModal() {
    const idEl = document.getElementById("assignTruckEventId");
    const eventId = idEl && idEl.value ? idEl.value.trim() : "";
    const EVENTS = global.EVENTS;
    const ev = eventId && EVENTS ? EVENTS.find(function (e) {
      return e.id === eventId;
    }) : null;
    if (!ev) {
      if (typeof global.showToast === "function") {
        global.showToast("Event not found.", "error");
      }
      return;
    }
    const boxes = document.querySelectorAll(".assign-truck-cb:checked");
    const truckIds = [];
    boxes.forEach(function (cb) {
      if (cb.value) truckIds.push(cb.value);
    });
    if (!truckIds.length) {
      if (typeof global.showToast === "function") {
        global.showToast("Select at least one truck.", "warning");
      }
      return;
    }
    const startEl = document.getElementById("assignTruckStart");
    const endEl = document.getElementById("assignTruckEnd");
    const purposeEl = document.getElementById("assignTruckPurpose");
    const notesEl = document.getElementById("assignTruckNotes");
    let startDate = (startEl && startEl.value) || ev.startDate || "";
    let endDate = (endEl && endEl.value) || ev.endDate || startDate;
    if (!startDate || !endDate) {
      if (typeof global.showToast === "function") {
        global.showToast("Start and end dates are required.", "error");
      }
      return;
    }
    const purpose = purposeEl && purposeEl.value ? String(purposeEl.value).trim() : null;
    const notes = notesEl && notesEl.value ? String(notesEl.value).trim() : null;
    const useApi = schedulingRestEnabled();
    if (useApi) {
      let failMsg = "";
      for (let i = 0; i < truckIds.length; i++) {
        const body = {
          event_id: eventId,
          truck_id: truckIds[i],
          start_date: String(startDate).slice(0, 10),
          end_date: String(endDate).slice(0, 10),
          status: "tentative",
        };
        if (purpose) body.purpose = purpose;
        if (notes) body.notes = notes;
        const r = await global.pldApiFetch("/api/v1/assignments/truck", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          failMsg =
            (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) ||
            "Truck assignment failed";
          break;
        }
      }
      if (failMsg) {
        if (typeof global.showToast === "function") {
          global.showToast(failMsg, "error");
        }
        return;
      }
      await global.pldRefreshEventTruckAssignments(eventId);
    } else {
      const cur = Array.isArray(ev.trucks) ? ev.trucks.slice() : [];
      const set = new Set(cur);
      for (let i = 0; i < truckIds.length; i++) {
        set.add(truckIds[i]);
      }
      ev.trucks = Array.from(set);
      if (typeof global.closeModal === "function") global.closeModal();
      if (typeof global.showToast === "function") {
        global.showToast("Truck assigned.", "success");
      }
      if (
        typeof global.renderPage === "function" &&
        global.currentPage === "event" &&
        global.selectedEventId === eventId
      ) {
        global.renderPage("event");
      }
      if (typeof global.updateSidebarNavCounts === "function") {
        global.updateSidebarNavCounts();
      }
      return;
    }
    if (typeof global.closeModal === "function") global.closeModal();
    if (typeof global.showToast === "function") {
      global.showToast("Truck assigned.", "success");
    }
  };

  global.pldSubmitAssignTruckToEventFromModal = async function pldSubmitAssignTruckToEventFromModal() {
    const truckEl = document.getElementById("assignTruckToEventTruckId");
    const truckId = truckEl && truckEl.value ? truckEl.value.trim() : "";
    const eventIdEl = document.getElementById("assignTruckToEventEventId");
    const eventId = eventIdEl && eventIdEl.value ? eventIdEl.value.trim() : "";
    if (!truckId || !eventId) {
      if (typeof global.showToast === "function") {
        global.showToast("Choose an event.", "warning");
      }
      return;
    }
    const EVENTS = global.EVENTS;
    const ev = EVENTS ? EVENTS.find(function (e) {
      return e.id === eventId;
    }) : null;
    if (!ev) {
      if (typeof global.showToast === "function") {
        global.showToast("Event not found.", "error");
      }
      return;
    }
    const depEl = document.getElementById("assignTruckToEventDeparture");
    const retEl = document.getElementById("assignTruckToEventReturn");
    const driverEl = document.getElementById("assignTruckToEventDriverId");
    const notesEl = document.getElementById("assignTruckToEventNotes");
    let startDate = (depEl && depEl.value) || ev.startDate || "";
    let endDate = (retEl && retEl.value) || ev.endDate || startDate;
    if (!startDate || !endDate) {
      if (typeof global.showToast === "function") {
        global.showToast("Departure and return dates are required.", "error");
      }
      return;
    }
    const driverVal = driverEl && driverEl.value ? driverEl.value.trim() : "";
    const driverId = isUuid(driverVal) ? driverVal : null;
    const notes = notesEl && notesEl.value ? String(notesEl.value).trim() : null;
    const useApi = schedulingRestEnabled();
    if (useApi) {
      const body = {
        event_id: eventId,
        truck_id: truckId,
        start_date: String(startDate).slice(0, 10),
        end_date: String(endDate).slice(0, 10),
        status: "tentative",
      };
      if (driverId) body.driver_id = driverId;
      if (notes) body.notes = notes;
      const r = await global.pldApiFetch("/api/v1/assignments/truck", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const failMsg =
          (r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) ||
          "Truck assignment failed";
        if (typeof global.showToast === "function") {
          global.showToast(failMsg, "error");
        }
        return;
      }
      await global.pldRefreshEventTruckAssignments(eventId);
    } else {
      const cur = Array.isArray(ev.trucks) ? ev.trucks.slice() : [];
      if (!cur.includes(truckId)) cur.push(truckId);
      ev.trucks = cur;
    }
    if (typeof global.closeModal === "function") global.closeModal();
    if (typeof global.showToast === "function") {
      global.showToast("Truck assigned to event.", "success");
    }
    if (
      typeof global.renderPage === "function" &&
      global.currentPage === "event" &&
      global.selectedEventId === eventId
    ) {
      global.renderPage("event");
    }
    if (typeof global.updateSidebarNavCounts === "function") {
      global.updateSidebarNavCounts();
    }
  };

  /**
   * GET /api/v1/assignments/crew?personnel_id=… — for personnel profile event history, dashboards, etc.
   * @param {string} personnelId
   * @param {{ limit?: number, date_range_start?: string, date_range_end?: string }} [opts]
   */
  global.pldFetchCrewAssignmentsForPersonnel = async function (personnelId, opts) {
    opts = opts || {};
    const pid = String(personnelId || "").trim();
    if (!pid || typeof global.pldApiFetch !== "function") {
      return { ok: false, rows: [], meta: null, error: "No API" };
    }
    const q = new URLSearchParams({
      personnel_id: pid,
      sort_by: "start_date",
      sort_order: "desc",
      limit: String(opts.limit != null ? opts.limit : 100),
    });
    if (opts.date_range_start) q.set("date_range_start", opts.date_range_start);
    if (opts.date_range_end) q.set("date_range_end", opts.date_range_end);
    const r = await global.pldApiFetch("/api/v1/assignments/crew?" + q.toString(), { method: "GET" });
    if (!r.ok || !r.body) {
      const msg =
        r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message
          ? String(r.body.errors[0].message)
          : "Request failed";
      return { ok: false, rows: [], meta: null, error: msg };
    }
    return {
      ok: true,
      rows: Array.isArray(r.body.data) ? r.body.data : [],
      meta: r.body.meta || null,
      error: null,
    };
  };

})(typeof window !== "undefined" ? window : globalThis);
