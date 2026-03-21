/* ============================================
   Custom Fields — Settings UI + shared field renderers
   Depends: pld-api.js, modals.js, settings.js, router.js
   ============================================ */

(function () {
  window.loadCustomFieldsDefinitions = async function (entityType) {
    const q = new URLSearchParams({ entity_type: entityType });
    const res = await window.pldApiFetch('/api/v1/custom-fields?' + q.toString(), { method: 'GET' });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      throw new Error(msg || String(res.status));
    }
    return (res.body && res.body.data) || [];
  };

  window.createCustomFieldDefinition = async function (body) {
    const res = await window.pldApiFetch('/api/v1/custom-fields', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      throw new Error(msg || String(res.status));
    }
    return res.body && res.body.data;
  };

  window.deleteCustomFieldDefinition = async function (id) {
    const res = await window.pldApiFetch('/api/v1/custom-fields/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      throw new Error(msg || String(res.status));
    }
    return res.body && res.body.data;
  };

  window.updateCustomFieldDefinition = async function (id, body) {
    const res = await window.pldApiFetch('/api/v1/custom-fields/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      throw new Error(msg || String(res.status));
    }
    return res.body && res.body.data;
  };

  window.reorderCustomFieldDefinitions = async function (entityType, orderedIds) {
    const res = await window.pldApiFetch('/api/v1/custom-fields/reorder', {
      method: 'PUT',
      body: JSON.stringify({ entity_type: entityType, ordered_ids: orderedIds }),
    });
    if (!res.ok) {
      const msg = res.body && res.body.errors && res.body.errors[0] && res.body.errors[0].message;
      throw new Error(msg || String(res.status));
    }
    return res.body && res.body.data;
  };

  const ENTITY_TYPES = [
    { value: 'event', label: 'Event' },
    { value: 'personnel', label: 'Personnel' },
    { value: 'truck', label: 'Truck' },
    { value: 'travel_record', label: 'Travel' },
    { value: 'financial_line_item', label: 'Financial line' },
    { value: 'department', label: 'Department' },
  ];

  const FIELD_TYPES = [
    'text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone',
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.loadCustomFieldsSettingsContent = async function () {
    const root = document.getElementById('customFieldsSettingsRoot');
    if (!root) return;
    const entity = window.customFieldsEntityFilter || 'event';
    root.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">Loading definitions…</p>';
    try {
      const defs = await window.loadCustomFieldsDefinitions(entity);
      window.__pldCfDefsForEntity = defs;
      const rows = defs.map(function (d, idx) {
        return '<tr>'
          + '<td style="white-space:nowrap;">'
          + '<button type="button" class="btn btn-ghost btn-sm" title="Move up" aria-label="Move up"'
          + (idx === 0 ? ' disabled' : '')
          + ' onclick="window.pldMoveCustomFieldRow(\'' + d.id + '\',-1)">↑</button> '
          + '<button type="button" class="btn btn-ghost btn-sm" title="Move down" aria-label="Move down"'
          + (idx >= defs.length - 1 ? ' disabled' : '')
          + ' onclick="window.pldMoveCustomFieldRow(\'' + d.id + '\',1)">↓</button>'
          + '</td>'
          + '<td><code style="font-size:12px;">' + escapeHtml(d.field_key) + '</code></td>'
          + '<td><strong>' + escapeHtml(d.label) + '</strong></td>'
          + '<td>' + escapeHtml(d.field_type) + '</td>'
          + '<td>' + (d.is_required ? '<span style="color:var(--accent-green);">Yes</span>' : '<span style="color:var(--text-tertiary);">No</span>') + '</td>'
          + '<td>' + (d.is_searchable ? '<span style="color:var(--accent-blue);">Yes</span>' : '<span style="color:var(--text-tertiary);">No</span>') + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button type="button" class="btn btn-ghost btn-sm" onclick="window.openEditCustomFieldDefinitionModal(\'' + d.id + '\')">Edit</button> '
          + '<button type="button" class="btn btn-ghost btn-sm" onclick="window.deleteCustomFieldRow(\'' + d.id + '\')">Deactivate</button>'
          + '</td>'
          + '</tr>';
      }).join('');
      const filterHtml = ENTITY_TYPES.map(function (e) {
        return '<button type="button" class="btn btn-sm ' + (entity === e.value ? 'btn-primary' : 'btn-secondary') + '" onclick="window.customFieldsEntityFilter=\'' + e.value + '\'; if(typeof renderPage===\'function\') renderPage(\'settings\');">' + escapeHtml(e.label) + '</button>';
      }).join(' ');
      const baseHint = typeof window.PLD_API_BASE === 'string' && window.PLD_API_BASE ? window.PLD_API_BASE : '(same-origin / Vite proxy)';
      root.innerHTML = ''
        + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;">'
        + '<span style="font-size:12px;color:var(--text-tertiary);">Entity:</span> ' + filterHtml
        + '</div>'
        + '<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Key</th><th>Label</th><th>Type</th><th>Required</th><th>Search</th><th>Actions</th></tr></thead><tbody>'
        + (rows || '<tr><td colspan="7" style="color:var(--text-tertiary);">No custom fields yet.</td></tr>')
        + '</tbody></table></div>'
        + '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">API base: ' + escapeHtml(String(baseHint)) + '</p>';
    } catch (err) {
      root.innerHTML = '<p style="color:var(--accent-red);font-size:13px;">Could not load custom fields. ' + escapeHtml(String(err.message || err)) + '</p>';
    }
  };

  window.pldMoveCustomFieldRow = async function (defId, delta) {
    const entity = window.customFieldsEntityFilter || 'event';
    const defs = window.__pldCfDefsForEntity;
    if (!defs || !Array.isArray(defs)) return;
    const i = defs.findIndex(function (x) { return x.id === defId; });
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= defs.length) return;
    const next = defs.slice();
    const t = next[i];
    next[i] = next[j];
    next[j] = t;
    try {
      await window.reorderCustomFieldDefinitions(
        entity,
        next.map(function (d) { return d.id; }),
      );
      if (typeof showToast === 'function') showToast('Order updated', 'success');
      await window.loadCustomFieldsSettingsContent();
    } catch (e) {
      if (typeof showToast === 'function') showToast(String(e.message || e), 'error');
    }
  };

  window.openEditCustomFieldDefinitionModal = function (defId) {
    const defs = window.__pldCfDefsForEntity;
    const d = defs && defs.find(function (x) { return x.id === defId; });
    if (!d || typeof openModal !== 'function') return;
    const desc = d.description != null ? String(d.description) : '';
    const body = ''
      + '<input type="hidden" id="pldCfEditId" value="' + escapeHtml(d.id) + '">'
      + '<div class="form-group"><label class="form-label">Label</label><input type="text" class="form-input" id="pldCfEditLabel" value="' + escapeHtml(d.label) + '"></div>'
      + '<div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="pldCfEditDesc" rows="2">' + escapeHtml(desc) + '</textarea></div>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="pldCfEditRequired"' + (d.is_required ? ' checked' : '') + '> Required</label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox" id="pldCfEditSearchable"' + (d.is_searchable ? ' checked' : '') + '> Searchable</label>'
      + '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Key <code>' + escapeHtml(d.field_key) + '</code> and type cannot be changed here.</p>';
    openModal('Edit custom field', body, ''
      + '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>'
      + '<button type="button" class="btn btn-primary" onclick="window.submitEditCustomFieldDefinition()">Save</button>');
  };

  window.submitEditCustomFieldDefinition = async function () {
    const idEl = document.getElementById('pldCfEditId');
    const labelEl = document.getElementById('pldCfEditLabel');
    const descEl = document.getElementById('pldCfEditDesc');
    const id = idEl && idEl.value;
    if (!id) return;
    const payload = {
      label: (labelEl && labelEl.value) || '',
      description: descEl && descEl.value ? String(descEl.value) : null,
      is_required: !!(document.getElementById('pldCfEditRequired') && document.getElementById('pldCfEditRequired').checked),
      is_searchable: !!(document.getElementById('pldCfEditSearchable') && document.getElementById('pldCfEditSearchable').checked),
    };
    try {
      await window.updateCustomFieldDefinition(id, payload);
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast('Field updated', 'success');
      if (typeof window.loadCustomFieldsSettingsContent === 'function') await window.loadCustomFieldsSettingsContent();
    } catch (e) {
      if (typeof showToast === 'function') showToast(String(e.message || e), 'error');
    }
  };

  window.deleteCustomFieldRow = async function (id) {
    if (!confirm('Deactivate this field definition? It will be hidden from new edits (soft-delete).')) return;
    try {
      await window.deleteCustomFieldDefinition(id);
      if (typeof showToast === 'function') showToast('Field removed', 'success');
      await window.loadCustomFieldsSettingsContent();
    } catch (e) {
      if (typeof showToast === 'function') showToast(String(e.message || e), 'error');
    }
  };

  /** Mount definition-driven controls into a container (event create/edit modals). */
  window.pldMountCustomFieldsInContainer = async function (containerId, entityType, initialValues) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML =
      '<p style="font-size:12px;color:var(--text-tertiary);">Loading custom fields…</p>';
    try {
      const defs = await window.loadCustomFieldsDefinitions(entityType);
      const iv = initialValues && typeof initialValues === 'object' ? initialValues : {};
      if (!defs.length) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML =
        '<div style="font-size:12px;font-weight:600;color:var(--text-tertiary);margin:12px 0 8px;">Custom fields</div>' +
        defs
          .map(function (d) {
            return window.renderCustomFieldControl(d, iv[d.field_key], 'custom_fields');
          })
          .join('');
    } catch (err) {
      el.innerHTML =
        '<p style="font-size:12px;color:var(--accent-red);">Custom fields unavailable. ' +
        escapeHtml(String(err.message || err)) +
        '</p>';
    }
  };

  /**
   * Read values from inputs inside container; defs from loadCustomFieldsDefinitions.
   * @returns {Record<string, unknown>}
   */
  window.pldCollectCustomFieldValuesFromContainer = function (containerEl, defs) {
    const out = {};
    if (!containerEl || !defs || !defs.length) return out;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const key = d.field_key;
      const ft = d.field_type;
      if (ft === 'boolean') {
        const inp = containerEl.querySelector('input[type="checkbox"][name="custom_fields[' + key + ']"]');
        out[key] = Boolean(inp && inp.checked);
        continue;
      }
      if (ft === 'multi_select' && d.options && d.options.length) {
        const boxes = containerEl.querySelectorAll(
          'input[type="checkbox"][name="custom_fields[' + key + '][]"]',
        );
        const sel = [];
        for (let j = 0; j < boxes.length; j++) {
          if (boxes[j].checked) sel.push(boxes[j].value);
        }
        out[key] = sel;
        continue;
      }
      if (ft === 'select' && d.options && d.options.length) {
        const sel = containerEl.querySelector('select[name="custom_fields[' + key + ']"]');
        out[key] = sel ? sel.value : '';
        continue;
      }
      if (ft === 'number') {
        const inp = containerEl.querySelector('input[name="custom_fields[' + key + ']"]');
        const raw = inp && inp.value !== '' ? Number(inp.value) : null;
        out[key] = raw;
        continue;
      }
      const inp = containerEl.querySelector('[name="custom_fields[' + key + ']"]');
      out[key] = inp && 'value' in inp ? inp.value : '';
    }
    return out;
  };

  window.renderCustomFieldControl = function (def, value, namePrefix) {
    const name = (namePrefix || 'custom_fields') + '[' + def.field_key + ']';
    const ft = def.field_type;
    if (ft === 'boolean') {
      const checked = value === true || value === 'true';
      return '<label class="form-label" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="' + name + '" ' + (checked ? 'checked' : '') + '> ' + escapeHtml(def.label) + '</label>';
    }
    if (ft === 'select' && def.options && def.options.length) {
      const opts = def.options.filter(function (o) { return !o.is_deprecated; })
        .map(function (o) {
          return '<option value="' + escapeHtml(o.value) + '"' + (String(value) === o.value ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
        }).join('');
      return '<div class="form-group"><label class="form-label">' + escapeHtml(def.label) + '</label><select class="form-select" name="' + name + '">' + opts + '</select></div>';
    }
    if (ft === 'multi_select' && def.options && def.options.length) {
      const sel = Array.isArray(value) ? value : [];
      const boxes = def.options.filter(function (o) { return !o.is_deprecated; }).map(function (o) {
        const c = sel.indexOf(o.value) >= 0;
        return '<label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" name="' + name + '[]" value="' + escapeHtml(o.value) + '"' + (c ? ' checked' : '') + '> ' + escapeHtml(o.label) + '</label>';
      }).join('');
      return '<div class="form-group"><label class="form-label">' + escapeHtml(def.label) + '</label><div style="display:flex;flex-direction:column;gap:6px;">' + boxes + '</div></div>';
    }
    if (ft === 'date') {
      const v = value != null ? String(value).slice(0, 10) : '';
      return '<div class="form-group"><label class="form-label">' + escapeHtml(def.label) + '</label><input type="date" class="form-input" name="' + name + '" value="' + escapeHtml(v) + '"></div>';
    }
    if (ft === 'datetime') {
      const v = value != null ? String(value).slice(0, 16) : '';
      return '<div class="form-group"><label class="form-label">' + escapeHtml(def.label) + '</label><input type="datetime-local" class="form-input" name="' + name + '" value="' + escapeHtml(v) + '"></div>';
    }
    var inputType = 'text';
    if (ft === 'number') inputType = 'number';
    else if (ft === 'url') inputType = 'url';
    else if (ft === 'email') inputType = 'email';
    else if (ft === 'phone') inputType = 'tel';
    const v = value != null ? String(value) : '';
    return '<div class="form-group"><label class="form-label">' + escapeHtml(def.label) + '</label><input type="' + inputType + '" class="form-input" name="' + name + '" value="' + escapeHtml(v) + '"></div>';
  };

  window.openAddCustomFieldModal = function () {
    const entityType = window.customFieldsEntityFilter || 'event';
    const body = ''
      + '<div class="form-group"><label class="form-label">Field key (snake_case)</label><input type="text" class="form-input" id="cfFieldKey" placeholder="show_caller"></div>'
      + '<div class="form-group"><label class="form-label">Label</label><input type="text" class="form-input" id="cfLabel" placeholder="Show Caller"></div>'
      + '<div class="form-group"><label class="form-label">Type</label><select class="form-select" id="cfFieldType">' + FIELD_TYPES.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') + '</select></div>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="cfRequired"> Required</label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;"><input type="checkbox" id="cfSearchable"> Searchable</label>'
      + '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Entity type: <strong>' + escapeHtml(entityType) + '</strong></p>';
    if (typeof openModal !== 'function') return;
    openModal('Add Custom Field', body, ''
      + '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>'
      + '<button type="button" class="btn btn-primary" onclick="window.submitNewCustomField()">Add</button>');
  };

  window.submitNewCustomField = async function () {
    const keyEl = document.getElementById('cfFieldKey');
    const labelEl = document.getElementById('cfLabel');
    const typeEl = document.getElementById('cfFieldType');
    const key = (keyEl && keyEl.value) || '';
    const label = (labelEl && labelEl.value) || '';
    const fieldType = (typeEl && typeEl.value) || 'text';
    const entityType = window.customFieldsEntityFilter || 'event';
    const isRequired = document.getElementById('cfRequired') && document.getElementById('cfRequired').checked;
    const isSearchable = document.getElementById('cfSearchable') && document.getElementById('cfSearchable').checked;
    const payload = {
      entity_type: entityType,
      field_key: key.trim(),
      label: label.trim(),
      field_type: fieldType,
      is_required: isRequired,
      is_searchable: isSearchable,
    };
    if (fieldType === 'select' || fieldType === 'multi_select') {
      if (typeof showToast === 'function') showToast('Select types require options — create as text first or use API.', 'warning');
      return;
    }
    try {
      await window.createCustomFieldDefinition(payload);
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast('Field created', 'success');
      if (typeof window.loadCustomFieldsSettingsContent === 'function') await window.loadCustomFieldsSettingsContent();
    } catch (e) {
      if (typeof showToast === 'function') showToast(String(e.message || e), 'error');
    }
  };
})();
