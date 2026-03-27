// Connects to /frontdesk, renders sessions, performs CRUD via ACKs.
// DOM kept as-is: #raceList, .drivers-section, #selectedRaceName, #driverList
// Buttons: #addRaceBtn, #addDriverBtn
// Modal: #formModal, #formTitle, #formArea, #closeModal

/* global io */
(function () {
  'use strict';

  // ---------------- State ----------------
  let socket;
  let sessions = [];           // [{ id, title|null, status, drivers:[{name,carNumber}] }]
  let selectedSessionId = null;

  // ---------------- DOM ----------------
  const raceListEl       = document.getElementById('raceList');
  const driversSectionEl = document.querySelector('.drivers-section');
  const selectedNameEl   = document.getElementById('selectedRaceName');
  const driverListEl     = document.getElementById('driverList');

  const addRaceBtn   = document.getElementById('addRaceBtn');
  const addDriverBtn = document.getElementById('addDriverBtn');

  const formModal  = document.getElementById('formModal');
  const formTitle  = document.getElementById('formTitle');
  const formArea   = document.getElementById('formArea');
  const closeModal = document.getElementById('closeModal');

  // ---------------- Utilities ----------------
  const byId = (id) => sessions.find(s => String(s.id) === String(id)) || null;
  const statusLocked = (s) => s && (s.status === 'RUNNING' || s.status === 'FINISHED' || s.status === 'ENDED');

  function openForm(title, formHTML, onSubmit) {
    formTitle.textContent = title;
    formArea.innerHTML = formHTML;
    formModal.classList.remove('hidden');
    formArea.onsubmit = onSubmit;
  }
  function closeForm() {
    formModal.classList.add('hidden');
    formArea.onsubmit = null;
    formArea.innerHTML = '';
  }

  // ---------------- Rendering ----------------
  function renderSessions(all) {
    raceListEl.innerHTML = '';

    const order = { PENDING: 0, RUNNING: 1, FINISHED: 2, ENDED: 3 };
    const list = [...all].sort((a, b) => {
      const oa = order[a.status] ?? 99;
      const ob = order[b.status] ?? 99;
      if (oa !== ob) return oa - ob;
      return (a.title || '').localeCompare(b.title || '');
    });

    list.forEach((s) => {
      const locked = statusLocked(s);
      const li = document.createElement('li');
      const label = s.title ? `${s.title}` : `Session ${s.id}`;
      li.innerHTML = `
        <span>${label} — <small>${s.status}</small></span>
        <div>
          <button data-action="select" data-id="${s.id}">Drivers</button>
          <button data-action="edit"   data-id="${s.id}" ${locked ? 'disabled' : ''}>Edit</button>
          <button data-action="delete" data-id="${s.id}" ${locked ? 'disabled' : ''}>Delete</button>
        </div>
      `;
      raceListEl.appendChild(li);
    });
  }

  function renderDrivers() {
    const s = byId(selectedSessionId);
    if (!s) {
      driversSectionEl.style.display = 'none';
      return;
    }
    driversSectionEl.style.display = 'block';
    selectedNameEl.textContent = s.title ? s.title : `Session ${s.id}`;

    driverListEl.innerHTML = '';
    const locked = statusLocked(s);
    (s.drivers || []).forEach((d, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${d.name} (#${d.carNumber})</span>
        <div>
          <button data-action="edit-driver" data-index="${idx}" ${locked ? 'disabled' : ''}>Edit</button>
          <button data-action="delete-driver" data-index="${idx}" ${locked ? 'disabled' : ''}>Delete</button>
        </div>
      `;
      driverListEl.appendChild(li);
    });

    addDriverBtn.disabled = locked || (s.drivers || []).length >= 8;
  }

  function fullRender(frontdeskSnapshot) {
    // { sessions, currentSessionId, lastFinishedSessionId, mode }
    sessions = frontdeskSnapshot.sessions || [];
    if (!byId(selectedSessionId)) selectedSessionId = null;
    renderSessions(sessions);
    renderDrivers();
  }

  // ---------------- Socket wiring ----------------
  function connect() {
    socket = io('/frontdesk', { reconnectionAttempts: 5 });

    socket.on('connect_error', (e) => {
      console.warn('[FrontDesk] connect_error:', e && e.message);
    });

    // Server sends an initial + subsequent snapshot here
    socket.on('frontdesk.init', (snap) => {
      if (snap) fullRender(snap);
    });
  }

  // ---------------- Handlers: Sessions ----------------
  function onAddRaceClick() {
    openForm('Add Race', `
      <form>
        <input type="text" id="raceName" placeholder="Race title (optional)" />
        <button type="submit">Save</button>
      </form>
    `, (e) => {
      e.preventDefault();
      const title = (document.getElementById('raceName').value || '').trim() || null;

      socket.emit('session.create', { title }, (ack) => {
        if (!ack || ack.ok !== true) {
          alert((ack && ack.error) || 'Failed to create session');
          return;
        }
        // Server rebroadcasts frontdesk.init; just close modal.
        closeForm();
      });
    });
  }

  function onEditRace(sessionId) {
    const s = byId(sessionId);
    if (!s) return;

    openForm('Edit Race', `
      <form>
        <input type="text" id="raceName" value="${s.title || ''}" placeholder="Race title (optional)" />
        <button type="submit">Save</button>
      </form>
    `, (e) => {
      e.preventDefault();
      const title = (document.getElementById('raceName').value || '').trim() || null;

      socket.emit('session.update', { sessionId: s.id, patch: { title } }, (ack) => {
        if (!ack || ack.ok !== true) {
          alert((ack && ack.error) || 'Failed to update session');
          return;
        }
        closeForm();
      });
    });
  }

  function onDeleteRace(sessionId) {
    if (!confirm('Delete this session?')) return;
    socket.emit('session.remove', { sessionId }, (ack) => {
      if (!ack || ack.ok !== true) {
        alert((ack && ack.error) || 'Failed to delete session');
        return;
      }
      if (selectedSessionId === sessionId) selectedSessionId = null;
    });
  }

  // ---------------- Handlers: Drivers ----------------
  function onAddDriverClick() {
    const s = byId(selectedSessionId);
    if (!s) return alert('Select a session first.');
    if ((s.drivers || []).length >= 8) return alert('A race can have a maximum of 8 drivers.');
    if (statusLocked(s)) return;

    openForm('Add Driver', `
      <form>
        <input type="text"   id="driverName"  placeholder="Driver Name" required />
        <input type="number" id="carNumber"   placeholder="Car Number (1-8)" min="1" max="8" />
        <button type="submit">Save</button>
      </form>
    `, (e) => {
      e.preventDefault();
      const name = (document.getElementById('driverName').value || '').trim();
      const carNumberRaw = document.getElementById('carNumber').value;
      const carNumber = carNumberRaw ? Number(carNumberRaw) : undefined;

      // Client-side duplicate check for UX; server enforces too
      const dup = (s.drivers || []).some(d => d.name.trim().toLowerCase() === name.toLowerCase());
      if (dup) { alert('Driver name must be unique within the session'); return; }

      socket.emit('driver.add', { sessionId: s.id, driver: { name, carNumber } }, (ack) => {
        if (!ack || ack.ok !== true) {
          alert((ack && ack.error) || 'Failed to add driver');
          return;
        }
        closeForm();
      });
    });
  }

  function onEditDriver(index) {
    const s = byId(selectedSessionId);
    if (!s) return;
    if (statusLocked(s)) return;

    const d = (s.drivers || [])[index];
    if (!d) return;

    openForm('Edit Driver', `
      <form>
        <input type="text"   id="driverName" value="${d.name}" required />
        <input type="number" id="carNumber"  value="${d.carNumber}" min="1" max="8" required />
        <button type="submit">Save</button>
      </form>
    `, (e) => {
      e.preventDefault();
      const newName   = (document.getElementById('driverName').value || '').trim();
      const carNumber = Number(document.getElementById('carNumber').value);

      const dup = (s.drivers || []).some((x) =>
        x !== d && x.name.trim().toLowerCase() === newName.toLowerCase()
      );
      if (dup) { alert('Driver name must be unique within the session'); return; }

      socket.emit('driver.update', { sessionId: s.id, name: d.name, patch: { name: newName, carNumber } }, (ack) => {
        if (!ack || ack.ok !== true) {
          alert((ack && ack.error) || 'Failed to update driver');
          return;
        }
        closeForm();
      });
    });
  }

  function onDeleteDriver(index) {
    const s = byId(selectedSessionId);
    if (!s) return;
    const d = (s.drivers || [])[index];
    if (!d) return;
    if (!confirm(`Remove ${d.name}?`)) return;

    socket.emit('driver.remove', { sessionId: s.id, name: d.name }, (ack) => {
      if (!ack || ack.ok !== true) {
        alert((ack && ack.error) || 'Failed to remove driver');
      }
    });
  }

  // ---------------- Event delegation ----------------
  raceListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id     = btn.getAttribute('data-id');
    if (!action) return;

    if (action === 'select') {
      selectedSessionId = id;
      renderDrivers();
    } else if (action === 'edit') {
      onEditRace(id);
    } else if (action === 'delete') {
      onDeleteRace(id);
    }
  });

  driverListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const idx = Number(btn.getAttribute('data-index'));
    if (action === 'edit-driver') onEditDriver(idx);
    if (action === 'delete-driver') onDeleteDriver(idx);
  });

  // ---------------- Wire buttons ----------------
  addRaceBtn?.addEventListener('click', onAddRaceClick);
  addDriverBtn?.addEventListener('click', onAddDriverClick);
  closeModal?.addEventListener('click', closeForm);

  // ---------------- Boot ----------------
  connect();
})();
