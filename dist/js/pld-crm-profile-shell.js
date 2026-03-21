/* ============================================
   Shared CRM profile shell — helpers + tab/hero HTML builders
   Load before crm-profile-pages.js
   ============================================ */

(function (global) {
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function attrEsc(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function safeObj(o) {
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  }

  function orgProfileFromMeta(md) {
    const m = safeObj(md);
    const p = m.profile && typeof m.profile === 'object' ? m.profile : {};
    return p;
  }

  function mergeOrgProfileMeta(existingMd, profilePatch) {
    const base = safeObj(existingMd);
    const prof = orgProfileFromMeta(base);
    const nextProf = { ...prof, ...safeObj(profilePatch) };
    return { ...base, profile: nextProf };
  }

  function mergeContactMetaDeep(existingMd, patch) {
    const base = safeObj(existingMd);
    return { ...base, ...safeObj(patch) };
  }

  /**
   * @param {'client'|'vendor'|'venue'} kind
   * @param {string} active
   */
  function orgTabBarHtml(kind, active) {
    const tabs =
      kind === 'client'
        ? [
            { key: 'overview', label: 'Overview' },
            { key: 'contacts', label: 'Contacts' },
            { key: 'files', label: 'Files' },
            { key: 'events', label: 'Events' },
          ]
        : kind === 'venue'
          ? [
              { key: 'overview', label: 'Overview' },
              { key: 'contacts', label: 'Contacts' },
              { key: 'files', label: 'Files' },
              { key: 'location', label: 'Location' },
            ]
          : [
              { key: 'overview', label: 'Overview' },
              { key: 'contacts', label: 'Contacts' },
              { key: 'files', label: 'Files' },
            ];
    const fn =
      kind === 'client'
        ? 'switchClientProfileTab'
        : kind === 'vendor'
          ? 'switchVendorProfileTab'
          : 'switchVenueProfileTab';
    return `<div class="crm-profile-tabs">${tabs
      .map(function (t) {
        return `<button type="button" class="${active === t.key ? 'active' : ''}" onclick="${fn}('${t.key}')">${esc(t.label)}</button>`;
      })
      .join('')}</div>`;
  }

  function contactProfileTabBarHtml(activeTab) {
    const subTabs = [
      { key: 'overview', label: 'Overview' },
      { key: 'phones', label: 'Phones' },
      { key: 'addresses', label: 'Addresses' },
      { key: 'billing', label: 'Billing' },
      { key: 'skills', label: 'Skills' },
      { key: 'files', label: 'Files' },
      { key: 'history', label: 'History' },
    ];
    return `<div class="crm-profile-tabs">${subTabs
      .map(function (t) {
        return `<button type="button" class="${activeTab === t.key ? 'active' : ''}" onclick="switchContactProfileTab('${t.key}')">${esc(t.label)}</button>`;
      })
      .join('')}</div>`;
  }

  /**
   * Personnel profile uses modal-tab styling.
   * @param {string} activeKey
   * @param {Array<{key:string,label:string}>} tabDefs
   */
  function personnelModalTabBarHtml(activeKey, tabDefs) {
    return `<div class="modal-tabs personnel-profile-page">${tabDefs
      .map(function (t) {
        return `<button type="button" class="modal-tab ${activeKey === t.key ? 'active' : ''}" onclick="switchPersonnelProfileTab('${t.key}')">${esc(t.label)}</button>`;
      })
      .join('')}</div>`;
  }

  /**
   * Standard org/contact hero (gradient cover strip + avatar + title block).
   * @param {{ coverId?: string, coverStyle?: string, avatarId?: string, avatarClass?: string, avatarInner: string, title: string, tagline: string, actionsHtml: string }} o
   */
  function orgHeroHtml(o) {
    const coverId = o.coverId ? ' id="' + esc(o.coverId) + '"' : '';
    const coverSt = o.coverStyle ? ' style="' + esc(o.coverStyle) + '"' : '';
    const avId = o.avatarId ? ' id="' + esc(o.avatarId) + '"' : '';
    const avCls = o.avatarClass ? ' ' + esc(o.avatarClass) : '';
    return (
      '<div class="crm-profile-hero">' +
      '<div class="crm-profile-cover"' +
      coverId +
      coverSt +
      '></div>' +
      '<div class="crm-profile-hero-inner">' +
      '<div class="crm-profile-avatar' +
      avCls +
      '"' +
      avId +
      '>' +
      o.avatarInner +
      '</div>' +
      '<div class="crm-profile-title-block">' +
      '<h1>' +
      esc(o.title) +
      '</h1>' +
      '<p class="crm-profile-tagline">' +
      esc(o.tagline) +
      '</p>' +
      o.actionsHtml +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  /** OpenStreetMap tile URL for venue banner fallback. */
  function venueOsmStaticImageUrl(lat, lng) {
    const la = Number(lat);
    const lo = Number(lng);
    if (Number.isNaN(la) || Number.isNaN(lo)) return '';
    const zoom = 14;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lo + 180) / 360) * n);
    const latRad = (la * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    );
    return 'https://tile.openstreetmap.org/' + zoom + '/' + x + '/' + y + '.png';
  }

  function venueOsmEmbedUrl(lat, lng) {
    const la = Number(lat);
    const lo = Number(lng);
    if (Number.isNaN(la) || Number.isNaN(lo)) return '';
    const d = 0.015;
    const bbox = [lo - d, la - d, lo + d, la + d].join(',');
    return (
      'https://www.openstreetmap.org/export/embed.html?bbox=' +
      encodeURIComponent(bbox) +
      '&layer=mapnik&marker=' +
      encodeURIComponent(la + ',' + lo)
    );
  }

  /** Best-effort @lat,lng / q=lat,lng / ll= parsing when API returns partial. */
  function parseCoordsFromMapsUrl(urlRaw) {
    const u = String(urlRaw || '').trim();
    if (!u) return null;
    const atMatch = u.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|$|[z\s])/);
    if (atMatch) {
      const lat = Number(atMatch[1]);
      const lng = Number(atMatch[2]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat: lat, lng: lng };
      }
    }
    try {
      const parsed = new URL(u);
      const q = parsed.searchParams.get('q');
      if (q) {
        const dec = decodeURIComponent(q).trim();
        const comma = dec.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (comma) {
          const lat = Number(comma[1]);
          const lng = Number(comma[2]);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat: lat, lng: lng };
        }
      }
      const ll = parsed.searchParams.get('ll');
      if (ll) {
        const parts = ll.split(',');
        if (parts.length >= 2) {
          const lat = Number(parts[0]);
          const lng = Number(parts[1]);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat: lat, lng: lng };
        }
      }
    } catch (_e) {
      return null;
    }
    return null;
  }

  function venueFetchBannerBlob(venueId, variant) {
    return new Promise(function (resolve) {
      const base = typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.replace(/\/$/, '') : '';
      const path =
        '/api/v1/venues/' +
        encodeURIComponent(venueId) +
        '/banner-preview?variant=' +
        encodeURIComponent(variant);
      const url = base === '' ? path : base + path;
      const headers = new Headers();
      const access =
        typeof global.pldAuthGetAccessToken === 'function' ? global.pldAuthGetAccessToken() : '';
      if (access) headers.set('Authorization', 'Bearer ' + access);
      const tid =
        typeof global.pldAuthGetTenantIdFromToken === 'function' ? global.pldAuthGetTenantIdFromToken() : '';
      if (tid) headers.set('X-Tenant-Id', tid);
      else if (typeof window.PLD_TENANT_ID === 'string') headers.set('X-Tenant-Id', window.PLD_TENANT_ID);
      fetch(url, { method: 'GET', headers: headers, credentials: 'include' })
        .then(function (r) {
          if (!r.ok) return resolve(null);
          return r.blob();
        })
        .then(function (b) {
          resolve(b && b.size > 0 ? b : null);
        })
        .catch(function () {
          resolve(null);
        });
    });
  }

  function applyOsmBannerToCoverEl(coverEl, lat, lng) {
    const u = venueOsmStaticImageUrl(String(lat), String(lng));
    if (u) {
      coverEl.style.backgroundImage = 'url(' + JSON.stringify(u) + ')';
      coverEl.style.backgroundSize = 'cover';
      coverEl.style.backgroundPosition = 'center';
    }
  }

  global.pldCrmEsc = esc;
  global.pldCrmAttrEsc = attrEsc;
  global.pldCrmSafeObj = safeObj;
  global.pldCrmOrgProfileFromMeta = orgProfileFromMeta;
  global.pldCrmMergeOrgProfileMeta = mergeOrgProfileMeta;
  global.pldCrmMergeContactMetaDeep = mergeContactMetaDeep;
  global.pldCrmOrgTabBarHtml = orgTabBarHtml;
  global.pldCrmContactProfileTabBarHtml = contactProfileTabBarHtml;
  global.pldCrmPersonnelModalTabBarHtml = personnelModalTabBarHtml;
  global.pldCrmOrgHeroHtml = orgHeroHtml;
  global.pldCrmVenueOsmStaticImageUrl = venueOsmStaticImageUrl;
  global.pldCrmVenueOsmEmbedUrl = venueOsmEmbedUrl;
  global.pldCrmParseCoordsFromMapsUrl = parseCoordsFromMapsUrl;
  global.pldCrmVenueFetchBannerBlob = venueFetchBannerBlob;
  global.pldCrmApplyOsmBannerToCoverEl = applyOsmBannerToCoverEl;
})(typeof window !== 'undefined' ? window : globalThis);
