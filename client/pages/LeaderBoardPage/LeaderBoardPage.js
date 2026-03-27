/* global io */
(function () {
  'use strict';

  const fsBtn    = document.getElementById('fullscreenBtn');
  const titleEl  = document.getElementById('raceTitle');
  const modeEl   = document.getElementById('modeBadge');
  const timerEl  = document.getElementById('timerText');
  const bodyEl   = document.getElementById('lbBody');

  let socket = null;
  let snapshot = null;

  // -------- formatters --------
  const fmtTimer = (ms) => {
    if (ms == null) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };
  const fmtLap = (ms) => {
    if (ms == null) return '—';
    const whole = Math.max(0, Math.floor(ms));
    const m = Math.floor(whole / 60000);
    const s = Math.floor((whole % 60000) / 1000);
    const mm = String(m);
    const ss = String(s).padStart(2, '0');
    const mmm = String(whole % 1000).padStart(3, '0');
    return `${mm}:${ss}.${mmm}`;
  };

  // -------- render --------
  function render(snap) {
    snapshot = snap || snapshot;
    if (!snapshot) return;

    // Title / Mode / Timer
    const current = snapshot.currentSession;
    const title = current?.title || (current ? `Session ${current.id}` : '—');
    titleEl && (titleEl.innerHTML = `<strong>Session:</strong> ${title}`);

    modeEl && (modeEl.innerHTML = `<strong>Mode:</strong> ${snapshot.mode || '—'}`);

    if (timerEl && snapshot.timer) {
      timerEl.innerHTML = snapshot.timer.running
        ? `<strong>Timer:</strong> ${fmtTimer(snapshot.timer.remainingMs)}`
        : `<strong>Timer:</strong> stopped`;
      document.title = snapshot.timer.running
        ? `🏁 ${fmtTimer(snapshot.timer.remainingMs)} • Leader Board`
        : 'Leader Board';
    }

    // Table rows
    if (!bodyEl) return;
    const data = Array.isArray(snapshot.leaderboard) ? snapshot.leaderboard : [];
    bodyEl.innerHTML = '';

    if (!data.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; padding:20px;">Waiting for session…</td>`;
      bodyEl.appendChild(tr);
      return;
    }

    data.forEach((row, i) => {
      const tr = document.createElement('tr');
      const best = row.bestLapMs != null ? fmtLap(row.bestLapMs) : '—';
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>#${row.carNumber}</td>
        <td>${row.name}</td>
        <td>${row.lapCount ?? 0}</td>
        <td>${best}</td>
      `;
      bodyEl.appendChild(tr);
    });
  }

  // -------- sockets --------
  function connect() {
    // Public namespace; no auth helper
    socket = io('/public', { reconnectionAttempts: 5 });

    socket.on('connect', () => {
      // console.log('[LeaderBoard] connected', socket.id);
    });

    socket.on('connect_error', (e) => {
      // console.warn('[LeaderBoard] connect_error:', e?.message);
    });

    // Initial + subsequent full snapshots
    socket.on('public.snapshot', (snap) => {
      render(snap);
    });

    // Per-second timer ticks
    socket.on('public.countdown', (t) => {
      if (snapshot?.timer && typeof t?.remainingMs === 'number') {
        snapshot.timer.remainingMs = t.remainingMs;
        render(snapshot);
      }
    });
  }

  connect();
})();
