/* global openModal, closeModal, showToast, renderPage, fetchPersonnelFromApiIfConfigured */
(function () {
  const TARGETS = [
    ['', '— skip —'],
    ['ignore', 'Skip column'],
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
    ['email', 'Email'],
    ['role', 'Role'],
    ['employment_type', 'Employment type'],
    ['phone', 'Phone'],
    ['department', 'Department (name)'],
    ['department_id', 'Department ID'],
    ['day_rate', 'Day rate'],
    ['per_diem', 'Per diem'],
    ['skills', 'Skills (comma-separated)'],
    ['status', 'Status'],
  ];

  window.__pldCsvApi = null;

  function api() {
    return typeof window.pldApiFetch === 'function';
  }

  window.pldPersonnelCsvOpenWizard = function () {
    if (!api()) return;
    window.__pldCsvApi = {
      step: 1,
      sessionId: null,
      columns: [],
      rawText: '',
      columnMap: {},
      validateResult: null,
      previewResult: null,
    };
    openModal('Import Personnel from CSV', window.pldPersonnelCsvBody(), window.pldPersonnelCsvFooter());
  };

  window.pldPersonnelCsvRefreshModal = function () {
    const b = document.getElementById('modalBody');
    const f = document.getElementById('modalFooter');
    if (b) b.innerHTML = window.pldPersonnelCsvBody();
    if (f) f.innerHTML = window.pldPersonnelCsvFooter();
  };

  window.pldPersonnelCsvReadFile = function (input) {
    const st = window.__pldCsvApi;
    if (!st || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function () {
      st.rawText = String(reader.result || '');
      const ta = document.getElementById('pldCsvTextarea');
      if (ta) ta.value = st.rawText;
    };
    reader.readAsText(file, 'UTF-8');
  };

  window.pldPersonnelCsvNext = async function () {
    const st = window.__pldCsvApi;
    if (!st || !api()) return;
    try {
      if (st.step === 1) {
        const ta = document.getElementById('pldCsvTextarea');
        st.rawText = ta ? String(ta.value || '') : st.rawText;
        if (!st.rawText.trim()) {
          showToast('Paste or upload CSV text first', 'error');
          return;
        }
        const r = await window.pldApiFetch('/api/v1/personnel/import/upload', {
          method: 'POST',
          body: JSON.stringify({ csv_text: st.rawText }),
        });
        if (!r.ok || !r.body || r.body.errors) {
          showToast((r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Upload failed', 'error');
          return;
        }
        st.sessionId = r.body.data.session_id;
        st.columns = r.body.data.columns || [];
        st.step = 2;
        window.pldPersonnelCsvRefreshModal();
        return;
      }
      if (st.step === 2) {
        const map = {};
        st.columns.forEach((col, i) => {
          const sel = document.getElementById('pldMap_' + i);
          if (sel && sel.value) map[col] = sel.value;
        });
        st.columnMap = map;
        const r = await window.pldApiFetch('/api/v1/personnel/import/validate', {
          method: 'POST',
          body: JSON.stringify({ session_id: st.sessionId, column_map: map }),
        });
        if (!r.ok || !r.body || r.body.errors) {
          showToast((r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Validate failed', 'error');
          return;
        }
        st.validateResult = r.body.data;
        const pr = await window.pldApiFetch('/api/v1/personnel/import/preview', {
          method: 'POST',
          body: JSON.stringify({ session_id: st.sessionId, column_map: map }),
        });
        if (!pr.ok || !pr.body || pr.body.errors) {
          showToast('Preview failed', 'error');
          return;
        }
        st.previewResult = pr.body.data;
        st.step = 3;
        window.pldPersonnelCsvRefreshModal();
        return;
      }
      if (st.step === 3) {
        st.step = 4;
        window.pldPersonnelCsvRefreshModal();
        return;
      }
      if (st.step === 4) {
        const r = await window.pldApiFetch('/api/v1/personnel/import/confirm', {
          method: 'POST',
          body: JSON.stringify({ session_id: st.sessionId, column_map: st.columnMap }),
        });
        if (!r.ok || !r.body || r.body.errors) {
          showToast((r.body && r.body.errors && r.body.errors[0] && r.body.errors[0].message) || 'Import failed', 'error');
          return;
        }
        const d = r.body.data;
        showToast(`Imported: ${d.created} created, ${d.updated} updated, ${d.skipped} skipped`, 'success');
        closeModal();
        window.__pldCsvApi = null;
        if (typeof fetchPersonnelFromApiIfConfigured === 'function') await fetchPersonnelFromApiIfConfigured();
        if (typeof renderPage === 'function') renderPage('personnel');
      }
    } catch (e) {
      showToast(String(e.message || e), 'error');
    }
  };

  window.pldPersonnelCsvBack = function () {
    const st = window.__pldCsvApi;
    if (!st) return;
    if (st.step > 1) {
      st.step -= 1;
      window.pldPersonnelCsvRefreshModal();
    }
  };

  window.pldPersonnelCsvBody = function () {
    const st = window.__pldCsvApi;
    if (!st) return '';
    if (st.step === 1) {
      return `
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 1 of 4 — Paste CSV or choose a file (max 500 rows, 5 MB)</div>
        <textarea id="pldCsvTextarea" class="form-textarea" style="min-height:160px;width:100%;font-family:monospace;font-size:12px;" placeholder="first_name,last_name,email,role,employment_type&#10;Jane,Doe,jane@x.com,A1,freelance">${escapeHtml(st.rawText)}</textarea>
        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">Or upload file</label>
          <input type="file" accept=".csv,text/csv" class="form-input" onchange="pldPersonnelCsvReadFile(this)">
        </div>`;
    }
    if (st.step === 2) {
      const rows = st.columns
        .map(
          (col, i) => `
        <tr>
          <td><strong>${escapeHtml(col)}</strong></td>
          <td>
            <select class="form-select" id="pldMap_${i}" style="min-width:180px;">
              ${TARGETS.map(
                ([v, lab]) =>
                  `<option value="${v}" ${guessMap(col) === v ? 'selected' : ''}>${escapeHtml(lab)}</option>`,
              ).join('')}
            </select>
          </td>
        </tr>`,
        )
        .join('');
      return `
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 2 of 4 — Map columns (email + names + role required)</div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>CSV column</th><th>Field</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    if (st.step === 3) {
      const p = st.previewResult || {};
      const prev = (p.preview || []).slice(0, 20);
      const table = prev
        .map(
          (row) =>
            `<tr><td>${row.row_index + 1}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.email || row.reason || '')}</td><td>${escapeHtml(row.reason || '')}</td></tr>`,
        )
        .join('');
      return `
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 3 of 4 — Preview</div>
        <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius);margin-bottom:12px;font-size:13px;">
          <div><strong>New:</strong> ${p.new_count ?? 0} · <strong>Update:</strong> ${p.update_count ?? 0} · <strong>Skip:</strong> ${p.skip_count ?? 0}</div>
        </div>
        <div class="table-wrap" style="max-height:220px;overflow:auto;"><table class="data-table"><thead><tr><th>Row</th><th>Action</th><th>Email / note</th><th>Reason</th></tr></thead><tbody>${table}</tbody></table></div>
        <p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Showing up to 20 preview rows.</p>`;
    }
    return `
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Step 4 of 4 — Confirm</div>
      <p style="font-size:14px;">Run the import with the mapped columns. This updates existing personnel matched by email.</p>`;
  };

  window.pldPersonnelCsvFooter = function () {
    const st = window.__pldCsvApi;
    if (!st) return '';
    const back =
      st.step > 1
        ? `<button type="button" class="btn btn-ghost" onclick="pldPersonnelCsvBack()">Back</button>`
        : '';
    const nextLabel = st.step === 4 ? 'Import' : 'Next';
    const next = `<button type="button" class="btn btn-primary" onclick="void pldPersonnelCsvNext()">${nextLabel}</button>`;
    return `<button type="button" class="btn btn-secondary" onclick="closeModal();window.__pldCsvApi=null;">Cancel</button>${back}<div style="flex:1"></div>${next}`;
  };

  function guessMap(col) {
    const c = col.trim().toLowerCase().replace(/[_\s]+/g, '');
    if (c === 'email' || c === 'e-mail') return 'email';
    if (c === 'firstname' || c === 'first' || c === 'givenname') return 'first_name';
    if (c === 'lastname' || c === 'last' || c === 'surname' || c === 'familyname') return 'last_name';
    if (c === 'role' || c === 'title' || c === 'jobtitle') return 'role';
    if (c === 'department' || c === 'dept') return 'department';
    if (c === 'phone' || c === 'mobile') return 'phone';
    if (c === 'dayrate' || c === 'rate') return 'day_rate';
    if (c === 'perdiem') return 'per_diem';
    if (c === 'skills') return 'skills';
    if (c === 'status') return 'status';
    if (c === 'employmenttype' || c === 'type') return 'employment_type';
    return '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** @param {string} qs */
  window.pldPersonnelBulkAvailabilityUrl = function (qs) {
    const q = new URLSearchParams(qs);
    return '/api/v1/personnel/availability?' + q.toString();
  };
})();
