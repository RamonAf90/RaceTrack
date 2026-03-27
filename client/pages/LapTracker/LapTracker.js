/* global io */
(function () {
  'use strict';

  const area = document.getElementById('buttonsArea');
  const note = document.getElementById('note');

  let socket = null;
  let snapshot = null;

  const setNote = (msg) => { if (note) note.textContent = msg || ''; };

  // Build or rebuild the car buttons from a driver list
  function renderButtons(drivers, enabled) {
    if (!area) return;
    area.innerHTML = '';

    if (!Array.isArray(drivers) || !drivers.length) {
      setNote('No drivers in this session.');
      return;
    }

    drivers
      .slice()
      .sort((a, b) => (a.carNumber ?? 999) - (b.carNumber ?? 999))
      .forEach((d) => {
        const btn = document.createElement('button');
        btn.className = 'lapBtn';
        btn.dataset.car = String(d.carNumber);
        btn.textContent = `#${d.carNumber}`; // requirement: show car number (big target)
        if (!enabled) btn.classList.add('lapDisabled');
        area.appendChild(btn);
      });
  }

  function render(snap) {
    snapshot = snap || snapshot;
    if (!snapshot) return;

    const cur = snapshot.current;
    if (!cur) {
      // No active session
      renderButtons([], false);
      setNote(snapshot.message || 'Session ended. Waiting for next.');
      return;
    }

    const status = (cur.status || snapshot.status || 'PENDING').toUpperCase();
    const mode   = (snapshot.mode || 'DANGER').toUpperCase();

    // Buttons are enabled while RUNNING or FINISHED (drivers can cross in FINISH),
    // disabled only when session is ENDED or there is no current session
    const enabled = (status === 'RUNNING' || status === 'FINISHED');

    renderButtons(cur.drivers || [], enabled);

    if (status === 'RUNNING') {
      setNote('Race running — tap car buttons as they cross the line.');
    } else if (status === 'FINISHED') {
      setNote('Finish flag shown — cars may still cross the line until the session is ended.');
    } else if (status === 'ENDED') {
      setNote('Session ended — input is disabled.');
    } else {
      setNote('Session pending — waiting to start.');
    }

    // Update document title for a tiny bit of context
    document.title = `Lap Tracker • ${mode} • ${status}`;
  }

  function connect() {
    // Session-based auth — observer role; namespace is /laptracker
    socket = io('/laptracker', { reconnectionAttempts: 5 });

    socket.on('connect', () => {
      // console.log('[LapTracker] connected', socket.id);
    });

    socket.on('connect_error', (e) => {
      // If you hit this, your session/role isn't "observer" yet
      console.warn('[LapTracker] connect_error:', e?.message);
    });

    // Initial + subsequent snapshots from server
    socket.on('laptracker.init', (snap) => {
      // expected shape: { mode, timer, current:{ id,title,drivers,status } | null, message? }
      render(snap);
    });
  }

  // Big hit boxes: event delegation for clicks
  area?.addEventListener('click', (e) => {
    const btn = e.target.closest('.lapBtn');
    if (!btn || btn.classList.contains('lapDisabled')) return;

    const carNumber = Number(btn.dataset.car);
    if (!Number.isFinite(carNumber)) return;

    // Visual feedback (quick flash)
    btn.animate([{ transform: 'scale(1.0)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1.0)' }], {
      duration: 120,
      easing: 'ease-out',
    });

    // Emit lap.cross with ACK logging
    socket.emit('lap.cross', { carNumber }, (ack) => {
      if (!ack || ack.ok !== true) {
        console.warn('[LapTracker] lap.cross failed:', ack?.error || 'unknown');
      }
    });
  });

  connect();
})();
