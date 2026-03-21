/* ============================================
   Optional filter row under table headers (Contact Manager pattern)
   ============================================ */
(function (global) {
  /**
   * @param {Array<{ key: string, label: string, type?: 'text'|'select', options?: Array<{v:string,t:string}> }>} columns
   * @param {Record<string, string>} values
   * @param {string} tableId prefix for input ids
   */
  function pldFilterRowHtml(columns, values, tableId) {
    var vals = values || {};
    var t = tableId || 'flt';
    var cells = (columns || []).map(function (col) {
      var k = col.key;
      var v = vals[k] != null ? String(vals[k]) : '';
      if (col.type === 'select' && col.options) {
        var opts = col.options
          .map(function (o) {
            return (
              '<option value="' +
              String(o.v).replace(/"/g, '&quot;') +
              '"' +
              (String(v) === String(o.v) ? ' selected' : '') +
              '>' +
              String(o.t).replace(/</g, '&lt;') +
              '</option>'
            );
          })
          .join('');
        return (
          '<td><select class="form-input form-input-sm pld-filter-cell" data-filter-key="' +
          k +
          '" id="' +
          t +
          '_' +
          k +
          '">' +
          opts +
          '</select></td>'
        );
      }
      return (
        '<td><input type="search" class="form-input form-input-sm pld-filter-cell" data-filter-key="' +
        k +
        '" id="' +
        t +
        '_' +
        k +
        '" placeholder="…" value="' +
        String(v).replace(/"/g, '&quot;') +
        '"></td>'
      );
    });
    return '<tr class="pld-filter-row">' + cells.join('') + '</tr>';
  }

  global.pldFilterRowHtml = pldFilterRowHtml;
})(typeof window !== 'undefined' ? window : globalThis);
