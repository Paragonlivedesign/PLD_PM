/* Tenant name + shell chrome from GET /api/v1/tenant; user initials from JWT profile. */
(function (global) {
  global.__pldTenant = null;

  function tenantInitials(name) {
    const s = String(name || "").trim();
    if (!s) return "—";
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
  }

  global.pldRefreshTenantShell = async function pldRefreshTenantShell() {
    if (typeof global.pldApiFetch !== "function") return;
    const base =
      typeof global.PLD_API_BASE === "string" ? global.PLD_API_BASE.trim() : "";
    if (!base) return;
    const r = await global.pldApiFetch("/api/v1/tenant", { method: "GET" });
    if (!r.ok || !r.body || !r.body.data) {
      global.__pldTenant = null;
      return;
    }
    global.__pldTenant = r.body.data;
    const name = String(r.body.data.name || "").trim() || "Tenant";
    const tn = document.querySelector(".tenant-name");
    const ta = document.querySelector(".tenant-avatar");
    const tr = document.querySelector(".tenant-role");
    if (tn) tn.textContent = name;
    if (ta) ta.textContent = tenantInitials(name);
    if (tr) {
      const u =
        typeof global.pldAuthGetUserJson === "function"
          ? global.pldAuthGetUserJson()
          : null;
      const role = u && u.role ? String(u.role) : "";
      tr.textContent = role ? role.charAt(0).toUpperCase() + role.slice(1) : "—";
    }
    try {
      document.title = name + " — PLD_PM";
    } catch (_) {}
  };

  global.pldApplySessionIdentityChrome = function pldApplySessionIdentityChrome() {
    const u =
      typeof global.pldAuthGetUserJson === "function"
        ? global.pldAuthGetUserJson()
        : null;
    if (!u) {
      global.__pldNotificationApi = null;
      if (typeof global.pldUpdateNotificationBadge === "function") {
        global.pldUpdateNotificationBadge();
      }
    } else {
      const base =
        typeof global.PLD_API_BASE === "string" ? global.PLD_API_BASE.trim() : "";
      if (base && typeof global.pldPrefetchNotifications === "function") {
        void global.pldPrefetchNotifications();
      }
    }
    let initials = "—";
    if (u) {
      const fn = String(u.first_name || "").trim();
      const ln = String(u.last_name || "").trim();
      if (fn || ln) {
        initials = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || "—";
      } else if (u.email) {
        const em = String(u.email);
        initials = em.slice(0, 2).toUpperCase();
      }
    }
    const el = document.querySelector(".topbar-avatar span");
    if (el) el.textContent = initials.slice(0, 3);
  };
})(typeof window !== "undefined" ? window : globalThis);
