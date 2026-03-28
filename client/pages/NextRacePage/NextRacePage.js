/* global io */
(function () {
  'use strict';

  const fsBtn   = document.getElementById('fullscreenBtn');
  const titleEl = document.getElementById('raceTitle');
  const bodyEl  = document.getElementById('nrBody');
  const notice  = document.getElementById('notice');

  let socket = null;
  let snapshot = null;

  // choose the upcoming/next session from various shapes
  function pickNextSession(snap) {
    if (!snap) return null;
    const direct =
      snap.nextSession || snap.next || snap.upcoming || snap.upcomingSession || null;
    if (direct) return direct;

    if (Array.isArray(snap.queue) && snap.queue.length) return snap.queue[0];

    if (Array.isArray(snap.sessions)) {
      const pending = snap.sessions.filter(
        s => String(s.status || 'PENDING').toUpperCase() === 'PENDING'
      );
      pending.sort((a, b) => {
        const ai = Number(a.id || a._id || 0), bi = Number(b.id || b._id || 0);
        if (!Number.isNaN(ai) && !Number.isNaN(bi) && ai !== bi) return ai - bi;
        const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ac !== bc) return ac - bc;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
      return pending[0] || null;
    }
    return null;
  }

  // Only show paddock notice AFTER the race session is ENDED (i.e., no current)
  // and the system is back to DANGER, and there is a next session.
  function shouldShowPaddockNotice(snap) {
    const hasNoCurrent = !snap?.currentSession;
    const hasNext = !!pickNextSession(snap);
    const mode = String(snap?.mode || '').toUpperCase();
    return hasNoCurrent && hasNext && mode === 'DANGER';
  }

  function render(snap) {
    snapshot = snap || snapshot;
    if (!snapshot) return;

    const next = pickNextSession(snapshot);
    const title = next?.title || (next ? `Session ${next.id || next._id || ''}`.trim() : '—');
    titleEl && (titleEl.innerHTML = `<strong>Session:</strong> ${title}`);

    // paddock notice only after End Session
    if (notice) {
      if (shouldShowPaddockNotice(snapshot)) {
        notice.style.display = '';
      } else {
        notice.style.display = 'none';
      }
    }

    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    const drivers = Array.isArray(next?.drivers) ? [...next.drivers] : [];
    if (!drivers.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="2" style="text-align:center; padding:20px;">Waiting for next session…</td>`;
      bodyEl.appendChild(tr);
      return;
    }

    drivers.sort((a, b) => {
      const ac = a.carNumber ?? 999, bc = b.carNumber ?? 999;
      if (ac !== bc) return ac - bc;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    drivers.forEach((d) => {
      const tr = document.createElement('tr');
      const car = (d.carNumber != null && d.carNumber !== '') ? `#${d.carNumber}` : 'TBD';
      tr.innerHTML = `
        <td>${car}</td>
        <td>${d.name || '—'}</td>
      `;
      bodyEl.appendChild(tr);
    });
  }

  function connect() {
    socket = io('/public', { reconnectionAttempts: 5 });

    socket.on('public.snapshot', (snap) => render(snap));
    // not necessary to handle countdown here; purely next-session board
  }

  connect();
})();
