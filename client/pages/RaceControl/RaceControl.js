/* global io */
(function () {
  'use strict';

  // DOM
  const startBtn   = document.getElementById('startRace');
  const endBtn     = document.getElementById('endSession');
  const modeSafe   = document.getElementById('modeSafe');
  const modeHazard = document.getElementById('modeHazard');
  const modeDanger = document.getElementById('modeDanger');
  const modeFinish = document.getElementById('modeFinish');

  const statusEl   = document.getElementById('status');
  const timerEl    = document.getElementById('timer');
  const listEl     = document.getElementById('currentDrivers');
  const errEl      = document.getElementById('error');

  const preGroup  = document.querySelector('[data-phase="pre"]');
  const runGroup  = document.querySelector('[data-phase="run"]');
  const postGroup = document.querySelector('[data-phase="post"]');

  let socket = null;
  let snapshot = null;

  const fmt = (ms) => {
    if (ms == null) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg || '';
    if (msg) setTimeout(() => (errEl.textContent = ''), 4000);
  }

  function phaseFromSnap(snap) {
    const status = (snap?.status || 'PENDING').toUpperCase();
    const mode   = (snap?.mode || 'DANGER').toUpperCase();

    // FINISH mode always forces post phase (per spec)
    if (mode === 'FINISH') return 'FINISHED';
    if (status === 'RUNNING') return 'RUNNING';
    if (status === 'FINISHED') return 'FINISHED';
    return 'PRE';
  }

  function setPhase(p) {
    if (preGroup)  preGroup.style.display  = (p === 'PRE')      ? '' : 'none';
    if (runGroup)  runGroup.style.display  = (p === 'RUNNING')  ? '' : 'none';
    if (postGroup) postGroup.style.display = (p === 'FINISHED') ? '' : 'none';
  }

  function render(snap) {
    snapshot = snap || snapshot;
    if (!snapshot) return;

    statusEl && (statusEl.textContent = `Mode: ${snapshot.mode} • Status: ${snapshot.status || '—'}`);

    if (timerEl && snapshot.timer) {
      timerEl.textContent = snapshot.timer.running
        ? `Remaining: ${fmt(snapshot.timer.remainingMs)}`
        : 'Timer: stopped';
      document.title = snapshot.timer.running
        ? `⏱ ${fmt(snapshot.timer.remainingMs)} • Race Control`
        : 'Race Control';
    }

    if (listEl) {
      listEl.innerHTML = '';
      const cur = snapshot.current;
      if (!cur) {
        listEl.innerHTML = '<li><i>No active session</i></li>';
      } else {
        cur.leaderboard.forEach(row => {
          const li = document.createElement('li');
          const best = row.bestLapMs != null ? fmt(row.bestLapMs) : '—';
          li.textContent = `#${row.carNumber}      ${row.name}      -     Laps: ${row.lapCount},      Best: ${best}`;
          li.style.whiteSpace = "pre";

          listEl.appendChild(li);
        });
      }
    }

    setPhase(phaseFromSnap(snapshot));
  }

  function connect() {
    socket = io('/racecontrol', { reconnectionAttempts: 3 });

    socket.on('connect', () => {});
    socket.on('connect_error', () => {
      showError('Authentication required for Race Control.');
    });

    socket.on('racecontrol.init', render);
    socket.on('racecontrol.countdown', (t) => {
      if (snapshot?.timer && typeof t?.remainingMs === 'number') {
        snapshot.timer.remainingMs = t.remainingMs;
        render(snapshot);
      }
    });
  }

  function wire() {
    // PRE: Start
    startBtn && (startBtn.onclick = () => {
      const cur = snapshot?.current;
      const drivers = cur?.leaderboard || [];
      // ✅ Need at least two drivers to start
      if (drivers.length < 2) {
        return showError("At least two drivers are required to start the race.");
      }
      socket.emit('race.start', {}, (ack) => {
        if (!ack?.ok) return showError(ack?.error || 'Failed to start race');
      });
    });

    // RUN: modes (Finish will auto-hide controls via server setMode logic)
    const setMode = (mode) => {
      socket.emit('mode.set', { mode }, (ack) => {
        if (!ack?.ok) return showError(ack?.error || `Failed to set mode: ${mode}`);
      });
    };
    modeSafe   && (modeSafe.onclick   = () => setMode('SAFE'));
    modeHazard && (modeHazard.onclick = () => setMode('HAZARD'));
    modeDanger && (modeDanger.onclick = () => setMode('DANGER'));
    modeFinish && (modeFinish.onclick = () => setMode('FINISH'));

    // POST: End Session
    endBtn && (endBtn.onclick = () => {
      socket.emit('race.endSession', (ack) => {
        if (!ack?.ok) return showError(ack?.error || 'Failed to end session');
      });
    });
  }

  wire();
  connect();
})();
