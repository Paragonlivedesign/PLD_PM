/* ============================================
   Sidebar “users online” — tenant presence via backend /ws (collaboration module).
   Requires PLD_API_BASE (or same-origin + Vite /ws proxy). Auth: JWT or dev token "dev".
   ============================================ */
(function () {
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  var ws = null;
  var pingTimer = null;
  var reconnectTimer = null;
  var stopped = true;
  var backoffMs = 1000;
  var authedForSubscribe = false;

  function apiBaseTrim() {
    return typeof window.PLD_API_BASE === 'string' ? window.PLD_API_BASE.trim() : '';
  }

  function resolveTenantId() {
    if (typeof window.pldAuthGetTenantIdFromToken === 'function') {
      var jt = window.pldAuthGetTenantIdFromToken();
      if (jt && uuidRe.test(jt)) return jt;
    }
    var d = typeof window.PLD_TENANT_ID === 'string' ? window.PLD_TENANT_ID.trim() : '';
    if (uuidRe.test(d)) return d;
    return '';
  }

  function resolveToken() {
    if (typeof window.pldAuthGetAccessToken === 'function') {
      var t = window.pldAuthGetAccessToken();
      if (t && String(t).length) return String(t);
    }
    return 'dev';
  }

  function wsUrl() {
    var base = apiBaseTrim();
    if (base === '') {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return proto + '//' + location.host + '/ws';
    }
    try {
      var u = new URL(base.indexOf('//') >= 0 ? base : 'http://' + base);
      var p = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return p + '//' + u.host + '/ws';
    } catch (_) {
      return '';
    }
  }

  function setUi(state, count) {
    var span = document.getElementById('pldPresenceLabel');
    var dot = document.querySelector('.presence-indicator .presence-dot');
    if (!span || !dot) return;
    dot.classList.remove('online', 'offline', 'pending');
    if (state === 'live' && typeof count === 'number' && count >= 0) {
      dot.classList.add('online');
      span.textContent = count === 1 ? '1 user online' : count + ' users online';
      return;
    }
    if (state === 'pending') {
      dot.classList.add('pending');
      span.textContent = 'Connecting…';
      return;
    }
    if (state === 'noserver') {
      dot.classList.add('offline');
      span.textContent = '—';
      return;
    }
    dot.classList.add('offline');
    span.textContent = 'Live unavailable';
  }

  function clearTimers() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function sendPing() {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ type: 'ping' }));
    } catch (_) {}
  }

  function scheduleReconnect() {
    if (stopped) return;
    clearTimers();
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connectSocket();
    }, backoffMs);
    backoffMs = Math.min(backoffMs * 2, 30000);
  }

  function connectSocket() {
    if (stopped) return;
    var url = wsUrl();
    var tid = resolveTenantId();
    if (!url || !tid) {
      setUi('noserver', 0);
      return;
    }

    setUi('pending', 0);
    try {
      ws = new WebSocket(url);
    } catch (_) {
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      backoffMs = 1000;
      try {
        ws.send(
          JSON.stringify({
            type: 'auth',
            token: resolveToken(),
            tenant_id: tid,
          }),
        );
      } catch (_) {
        scheduleReconnect();
      }
    };

    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'auth_ok') {
          authedForSubscribe = true;
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              channel: 'tenant:' + tid + ':app',
            }),
          );
          if (!pingTimer) {
            pingTimer = setInterval(sendPing, 25000);
          }
          return;
        }
        if (msg.type === 'presence_update' && msg.payload && typeof msg.payload.connected === 'number') {
          setUi('live', msg.payload.connected);
          return;
        }
        if (msg.type === 'auth_error' || msg.type === 'error') {
          setUi('unavailable', 0);
        }
      } catch (_) {}
    };

    ws.onerror = function () {};

    ws.onclose = function () {
      ws = null;
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (!stopped) {
        setUi('pending', 0);
        scheduleReconnect();
      }
    };
  }

  window.pldPresenceStop = function pldPresenceStop() {
    stopped = true;
    clearTimers();
    if (ws) {
      try {
        ws.close();
      } catch (_) {}
      ws = null;
    }
  };

  window.pldPresenceStart = function pldPresenceStart() {
    var base = apiBaseTrim();
    if (!resolveTenantId()) {
      setUi('noserver', 0);
      return;
    }
    if (base === '' && (location.protocol === 'file:' || !location.host)) {
      setUi('noserver', 0);
      return;
    }
    stopped = false;
    backoffMs = 1000;
    if (ws) {
      try {
        ws.close();
      } catch (_) {}
      ws = null;
    }
    clearTimers();
    connectSocket();
  };

  window.pldPresenceRestart = function pldPresenceRestart() {
    window.pldPresenceStop();
    window.pldPresenceStart();
  };
})();
