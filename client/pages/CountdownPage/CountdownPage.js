/* global io */
(function () {
  'use strict';

  const timeEl   = document.getElementById('countdown');   // <-- matches your CSS
  const statusEl = document.getElementById('statusText');
  const fsBtn    = document.getElementById('fullscreenBtn');

  let socket;
  let timer = { running: false, remainingMs: 0, endsAt: null, durationMs: null };
  let rafId = null;

  const fmt = (ms) => {
    if (ms == null) return '--:--';
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  function render() {
    if (timeEl) timeEl.textContent = fmt(timer.remainingMs);

    if (!statusEl) return;
    if (!timer.running) {
      statusEl.textContent = 'Timer: stopped';
      document.title = 'Race Countdown';
    } else {
      statusEl.textContent = 'Race in progress';
      document.title = `⏱ ${fmt(timer.remainingMs)} • Race Countdown`;
    }
  }

  function tick() {
    if (timer.running && timer.endsAt) {
      const remaining = timer.endsAt - Date.now();
      timer.remainingMs = Math.max(0, remaining);
      render();
      if (remaining <= 0) {
        timer.running = false;
        cancelAnimationFrame(rafId);
        rafId = null;
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function applySnapshot(snap) {
    // snap: { mode, timer:{ running, remainingMs, endsAt, durationMs }, ... }
    if (snap && snap.timer) {
      timer.running     = !!snap.timer.running;
      timer.remainingMs = Number(snap.timer.remainingMs || 0);
      timer.endsAt      = snap.timer.endsAt ? Number(snap.timer.endsAt) : null;
      timer.durationMs  = snap.timer.durationMs != null ? Number(snap.timer.durationMs) : null;
    } else {
      timer.running = false;
      timer.remainingMs = 0;
      timer.endsAt = null;
      timer.durationMs = null;
    }

    render();

    if (timer.running && !rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function connect() {
    // Public namespace (no auth helper)
    socket = io('/public', { reconnectionAttempts: 5 });

    socket.on('connect', () => {
      // console.log('[Countdown] connected:', socket.id);
    });

    socket.on('connect_error', (e) => {
      // console.warn('[Countdown] connect_error:', e?.message);
    });

    // Initial state includes timer snapshot
    socket.on('public.snapshot', (snap) => {
      applySnapshot(snap);
    });

    // Per-second tick pushed by server
    socket.on('public.countdown', (t) => {
      if (typeof t?.remainingMs === 'number') {
        timer.remainingMs = t.remainingMs;
        render();
      }
    });
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  fsBtn?.addEventListener('click', toggleFullscreen);

  connect();
})();
