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

  const ENTITY_TYPES = [
    { value: 'event', label: 'Event' },
    { value: 'personnel', label: 'Personnel' },
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
      const rows = defs.map(function (d) {
        return '<tr>'
          + '<td><code style="font-size:12px;">' + escapeHtml(d.field_key) + '</code></td>'
          + '<td><strong>' + escapeHtml(d.label) + '</strong></td>'
          + '<td>' + escapeHtml(d.field_type) + '</td>'
          + '<td>' + (d.is_required ? '<span style="color:var(--accent-green);">Yes</span>' : '<span style="color:var(--text-tertiary);">No</span>') + '</td>'
          + '<td><button type="button" class="btn btn-ghost btn-sm" onclick="window.deleteCustomFieldRow(\'' + d.id + '\')">Delete</button></td>'
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
        + '<div class="table-wrap"><table class="data-table"><thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Required</th><th>Actions</th></tr></thead><tbody>'
        + (rows || '<tr><td colspan="5" style="color:var(--text-tertiary);">No custom fields yet.</td></tr>')
        + '</tbody></table></div>'
        + '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">API base: ' + escapeHtml(String(baseHint)) + '</p>';
    } catch (err) {
      root.innerHTML = '<p style="color:var(--accent-red);font-size:13px;">Could not load custom fields. ' + escapeHtml(String(err.message || err)) + '</p>';
    }
  };

  window.deleteCustomFieldRow = async function (id) {
    if (!confirm('Soft-delete this field definition?')) return;
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
    const inputType = ft === 'number' ? 'number' : 'text';
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
