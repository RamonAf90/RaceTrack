// server/handlers/handlers.js
'use strict';

/**
 * JSON-safe in-memory state with Mongo persistence.
 * We persist only small, circular-reference-free objects.
 */

const isDevMinute = (process.env.NODE_ENV === 'development') || (process.env.RACE_DEV === '1');
const RACE_DURATION_MS = isDevMinute ? 60_000 : 10 * 60_000;
const MAX_DRIVERS = 8;

const MODES = { SAFE: 'SAFE', HAZARD: 'HAZARD', DANGER: 'DANGER', FINISH: 'FINISH' };
const STATUSES = { PENDING: 'PENDING', RUNNING: 'RUNNING', FINISHED: 'FINISHED', ENDED: 'ENDED' };

// -------- In-memory store (JSON-safe) --------
const store = {
  sessions: [],
  currentSessionId: null,
  queuedSessionId:  null,                 // <-- NEW
  lastFinishedSessionId: null,
  mode: MODES.DANGER,
  timer: { running: false, remainingMs: 0, endsAt: null, durationMs: RACE_DURATION_MS },
  _idSeq: 1,
};

// Not persisted
const runtime = {
  lastCrossMs: {},             // carNumber -> last cross timestamp
  tickCallbacks: [],           // subscribers (sockets.js) for per-second tick
};

// -------- Mongo model (set in initPersistence) --------
let StateModel = null;
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const now = () => Date.now();

// ---- helpers ----
function findSession(id) { return store.sessions.find(s => String(s.id) === String(id)) || null; }
function firstPending() { return store.sessions.find(s => s.status === STATUSES.PENDING) || null; }
function currentSession() { return findSession(store.currentSessionId); }
function queuedSession()  { return findSession(store.queuedSessionId); }

function ensureBestLapRow(session, carNumber, name) {
  if (!session.results) session.results = [];
  let row = session.results.find(r => r.carNumber === carNumber);
  if (!row) {
    row = { name, carNumber, lapCount: 0, bestLapMs: null };
    session.results.push(row);
  } else {
    row.name = name;
  }
  return row;
}

function leaderboard(session) {
  const rows = (session.results && session.results.length)
    ? session.results.map(r => ({ ...r }))
    : session.drivers.map(d => ({ name: d.name, carNumber: d.carNumber, lapCount: 0, bestLapMs: null }));

  rows.sort((a, b) => {
    const aBest = a.bestLapMs ?? Infinity;
    const bBest = b.bestLapMs ?? Infinity;
    if (aBest !== bBest) return aBest - bBest;
    const aLap = a.lapCount ?? 0, bLap = b.lapCount ?? 0;
    if (aLap !== bLap) return bLap - aLap;
    return (a.carNumber ?? 999) - (b.carNumber ?? 999);
  });
  return rows;
}

function assignCarNumber(drivers) {
  const used = new Set(drivers.map(d => d.carNumber));
  for (let n = 1; n <= MAX_DRIVERS; n++) if (!used.has(n)) return n;
  return null;
}

function resetTimer() {
  store.timer.running = false;
  store.timer.remainingMs = 0;
  store.timer.endsAt = null;
  store.timer.durationMs = RACE_DURATION_MS;
}

// -------- Persistence API --------
async function initPersistence() {
  if (!process.env.MONGO_URI) {
    console.log('💾 Persistence disabled (MONGO_URI not set) — using in-memory only.');
    return;
  }
  try {
    const { State } = require('../models/models');
    StateModel = State;

    // Restore if exists
    const doc = await StateModel.findById('global').lean();
    if (doc) {
      store.sessions = Array.isArray(doc.sessions) ? doc.sessions : [];
      store.currentSessionId = doc.currentSessionId ?? null;
      store.queuedSessionId  = doc.queuedSessionId  ?? null;   // <-- NEW
      store.lastFinishedSessionId = doc.lastFinishedSessionId ?? null;
      store.mode = doc.mode || MODES.DANGER;
      store.timer = {
        running: !!doc.timer?.running,
        remainingMs: Number(doc.timer?.remainingMs || 0),
        endsAt: (doc.timer?.endsAt != null) ? Number(doc.timer.endsAt) : null,
        durationMs: Number(doc.timer?.durationMs || RACE_DURATION_MS),
      };
      store._idSeq = Number(doc.seq || 1);

      console.log(`💾 Restored state from DB (sessions: ${store.sessions.length}, current: ${store.currentSessionId ?? '—'}, queued: ${store.queuedSessionId ?? '—'})`);
    } else {
      await persist();
      console.log('💾 No saved state found — starting fresh.');
    }
  } catch (e) {
    console.warn('💾 Persistence init failed:', e?.message || e);
    StateModel = null; // continue in-memory
  }
}

async function persist() {
  if (!StateModel) return; // no-op if not enabled
  const doc = {
    _id: 'global',
    sessions: deepClone(store.sessions),
    currentSessionId: store.currentSessionId,
    queuedSessionId:  store.queuedSessionId,      // <-- NEW
    lastFinishedSessionId: store.lastFinishedSessionId,
    mode: store.mode,
    timer: deepClone(store.timer),
    seq: store._idSeq,
  };
  await StateModel.updateOne({ _id: 'global' }, { $set: doc }, { upsert: true });
}

// For high-frequency events (laps), avoid hammering DB.
let persistScheduled = false;
function persistSoon(delayMs = 400) {
  if (persistScheduled || !StateModel) return;
  persistScheduled = true;
  setTimeout(async () => {
    try { await persist(); } finally { persistScheduled = false; }
  }, delayMs);
}

// -------- Snapshots (JSON-safe) --------
function baseSnapshotWithStatus(statusOverride) {
  const cur = currentSession();
  const status = statusOverride ?? (cur ? cur.status : STATUSES.PENDING);
  return { mode: store.mode, timer: deepClone(store.timer), status };
}

async function getFrontDeskSnapshot() {
  // Only upcoming races
  const sessions = store.sessions
    .filter(s => s.status === STATUSES.PENDING)
    .map(s => ({
      id: s.id,
      title: s.title ?? null,
      status: s.status,
      drivers: s.drivers.map(d => ({ name: d.name, carNumber: d.carNumber })),
      createdAt: s.createdAt,
    }));
  return {
    sessions,
    currentSessionId: null,
    lastFinishedSessionId: store.lastFinishedSessionId,
    mode: store.mode,
  };
}

async function getRaceControlSnapshot() {
  const cur = currentSession();
  if (cur) {
    return {
      ...baseSnapshotWithStatus(cur.status),
      current: { id: cur.id, title: cur.title ?? null, leaderboard: leaderboard(cur) },
    };
  }

  // No running session => show queued (or the first pending) to let Safety brief drivers
  const queued = queuedSession() || firstPending();
  if (queued) {
    return {
      ...baseSnapshotWithStatus(queued.status),
      current: { id: queued.id, title: queued.title ?? null, leaderboard: leaderboard(queued) },
    };
  }

  // Nothing to show
  return {
    ...baseSnapshotWithStatus(STATUSES.PENDING),
    current: null,
  };
}

async function getLapTrackerSnapshot() {
  const cur = currentSession();
  return {
    mode: store.mode,
    timer: deepClone(store.timer),
    current: cur ? {
      id: cur.id,
      title: cur.title ?? null,
      drivers: cur.drivers.map(d => ({ name: d.name, carNumber: d.carNumber })),
      status: cur.status,
    } : null,
    message: (!cur && store.lastFinishedSessionId) ? 'Session ended. Waiting for next.' : null,
  };
}

async function getPublicSnapshot() {
  const cur = currentSession();
  const last = store.lastFinishedSessionId ? findSession(store.lastFinishedSessionId) : null;
  const next = firstPending();

  return {
    // IMPORTANT: status in public is about the *running* session only
    mode: store.mode,
    timer: deepClone(store.timer),
    currentSession: cur ? { id: cur.id, title: cur.title ?? null } : null,
    leaderboard: cur ? leaderboard(cur) : (last ? leaderboard(last) : []),
    sessions: store.sessions.map(s => ({
      id: s.id,
      title: s.title ?? null,
      status: s.status,
      drivers: s.drivers.map(d => ({ name: d.name, carNumber: d.carNumber })),
      createdAt: s.createdAt,
    })),
    nextSession: next ? {
      id: next.id,
      title: next.title ?? null,
      drivers: next.drivers.map(d => ({ name: d.name, carNumber: d.carNumber })),
    } : null,
  };
}

async function getCountdownTick() {
  return { remainingMs: store.timer.remainingMs, running: store.timer.running };
}

// -------- CRUD --------
async function createSession(payload) {
  const title = (payload?.title ?? null) ? String(payload.title).trim() : null;
  const id = store._idSeq++;
  store.sessions.push({ id, title: title || null, status: STATUSES.PENDING, createdAt: new Date().toISOString(), drivers: [], results: [] });
  await persist();
  return { id };
}

async function updateSession(sessionId, patch) {
  const s = findSession(sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== STATUSES.PENDING) throw new Error('Cannot edit a non-pending session');
  if (patch && 'title' in patch) s.title = (patch.title ?? null) ? String(patch.title).trim() : null;
  await persist();
  return { id: s.id };
}

async function removeSession(sessionId) {
  const s = findSession(sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== STATUSES.PENDING) throw new Error('Cannot delete a non-pending session');
  store.sessions = store.sessions.filter(x => x.id !== s.id);
  if (store.currentSessionId === s.id) store.currentSessionId = null;
  if (store.queuedSessionId  === s.id) store.queuedSessionId  = null;
  if (store.lastFinishedSessionId === s.id) store.lastFinishedSessionId = null;
  await persist();
  return { id: s.id };
}

async function addDriver(sessionId, driver) {
  const s = findSession(sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== STATUSES.PENDING) throw new Error('Cannot edit drivers for a non-pending session');

  const name = String(driver?.name || '').trim();
  if (!name) throw new Error('Driver name is required');
  if (s.drivers.some(d => d.name.toLowerCase() === name.toLowerCase()))
    throw new Error('Driver name must be unique within the session');

  let carNumber = driver?.carNumber != null ? Number(driver.carNumber) : null;
  if (!carNumber) {
    const assigned = assignCarNumber(s.drivers);
    if (!assigned) throw new Error('No car numbers available');
    carNumber = assigned;
  } else {
    if (carNumber < 1 || carNumber > MAX_DRIVERS) throw new Error('Car number must be between 1 and 8');
    if (s.drivers.some(d => d.carNumber === carNumber))
      throw new Error('Car number already taken');
  }

  s.drivers.push({ name, carNumber });
  await persist();
  return { id: s.id };
}

async function updateDriver(sessionId, name, patch) {
  const s = findSession(sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== STATUSES.PENDING) throw new Error('Cannot edit drivers for a non-pending session');

  const d = s.drivers.find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
  if (!d) throw new Error('Driver not found');

  const newName = (patch?.name ?? d.name).trim();
  if (!newName) throw new Error('Driver name is required');

  if (newName.toLowerCase() !== d.name.toLowerCase() &&
      s.drivers.some(x => x !== d && x.name.toLowerCase() === newName.toLowerCase())) {
    throw new Error('Driver name must be unique within the session');
  }

  let carNumber = ('carNumber' in patch) ? Number(patch.carNumber) : d.carNumber;
  if (carNumber < 1 || carNumber > MAX_DRIVERS) throw new Error('Car number must be between 1 and 8');
  if (s.drivers.some(x => x !== d && x.carNumber === carNumber))
    throw new Error('Car number already taken');

  d.name = newName;
  d.carNumber = carNumber;
  await persist();
  return { id: s.id };
}

async function removeDriver(sessionId, name) {
  const s = findSession(sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== STATUSES.PENDING) throw new Error('Cannot edit drivers for a non-pending session');

  const before = s.drivers.length;
  s.drivers = s.drivers.filter(x => x.name.toLowerCase() !== String(name || '').trim().toLowerCase());
  if (s.drivers.length === before) throw new Error('Driver not found');

  await persist();
  return { id: s.id };
}

// -------- Race ops --------
async function startRace(_payload) {
  if (store.timer.running) throw new Error('Race already running');

  // Use queued if set; otherwise first pending
  let cur = currentSession();
  if (!cur) {
    const pick = queuedSession() || firstPending();
    if (!pick) throw new Error('No pending session to start');
    store.currentSessionId = pick.id;
    store.queuedSessionId  = null; // promote queued -> current
    cur = pick;
  }

  if (!Array.isArray(cur.drivers) || cur.drivers.length === 0)
    throw new Error('Cannot start: no drivers in session');

  runtime.lastCrossMs = {};
  cur.status = STATUSES.RUNNING;
  store.mode = MODES.SAFE;                      // per spec when race starts
  store.timer.running = true;
  store.timer.durationMs = RACE_DURATION_MS;
  store.timer.endsAt = now() + RACE_DURATION_MS;
  store.timer.remainingMs = store.timer.durationMs;

  await persist();
  return { id: cur.id };
}

async function finishRace() {
  const cur = currentSession();
  if (!cur) throw new Error('No active session');
  if (cur.status !== STATUSES.RUNNING && cur.status !== STATUSES.FINISHED) {
    throw new Error('Cannot finish: session is not running');
  }
  store.mode = MODES.FINISH;                    // chequered
  store.timer.running = false;
  store.timer.remainingMs = 0;
  store.timer.endsAt = null;
  cur.status = STATUSES.FINISHED;

  await persist();
  return { id: cur.id };
}

async function endSession() {
  const cur = currentSession();
  if (!cur) throw new Error('No active session');
  if (cur.status !== STATUSES.FINISHED) throw new Error('Can only end a finished session');

  cur.status = STATUSES.ENDED;
  store.lastFinishedSessionId = cur.id;
  store.currentSessionId = null;
  store.mode = MODES.DANGER;                    // per spec after ending session
  resetTimer();

  // Queue up the next pending session for Race Control UI
  const next = firstPending();
  store.queuedSessionId = next ? next.id : null;

  await persist();
  return { id: cur.id, queued: store.queuedSessionId };
}

async function setMode(mode) {
  const cur = currentSession();
  if (!cur) throw new Error('No active session');

  const m = String(mode || '').toUpperCase();
  if (!Object.values(MODES).includes(m)) throw new Error('Invalid mode');

  // Cannot change mode before the race starts
  if (cur.status === STATUSES.PENDING) {
    throw new Error('Cannot change mode before the race starts');
  }

  // FINISH mode is authoritative: stop timer + FINISHED + lock controls
  if (m === MODES.FINISH) {
    store.mode = MODES.FINISH;
    store.timer.running = false;
    store.timer.remainingMs = 0;
    store.timer.endsAt = null;
    cur.status = STATUSES.FINISHED;
    await persist();
    return { mode: store.mode, status: cur.status };
  }

  // Once FINISHED, cannot change mode (only End Session)
  if (cur.status === STATUSES.FINISHED) {
    throw new Error('Mode cannot change after FINISH. End the session to continue.');
  }

  // RUNNING phase mode change
  store.mode = m;
  await persist();
  return { mode: store.mode, status: cur.status };
}

// -------- Lap tracking --------
async function recordLap({ carNumber }) {
  const cur = currentSession();
  if (!cur) throw new Error('No active session');
  if (!Number.isFinite(carNumber)) throw new Error('carNumber required');

  const driver = cur.drivers.find(d => d.carNumber === Number(carNumber));
  if (!driver) throw new Error('Unknown car number');

  const t = now();
  const last = runtime.lastCrossMs[carNumber];

  const row = ensureBestLapRow(cur, driver.carNumber, driver.name);
  row.lapCount += 1;

  if (last != null) {
    const lapMs = t - last;
    if (row.bestLapMs == null || lapMs < row.bestLapMs) row.bestLapMs = lapMs;
  }
  runtime.lastCrossMs[carNumber] = t;

  // Persist less aggressively for laps
  persistSoon(500);
  return { carNumber };
}

// -------- Timer tick --------
setInterval(() => {
  if (store.timer.running) {
    const rem = (store.timer.endsAt ?? now()) - now();
    store.timer.remainingMs = Math.max(0, rem);
    if (rem <= 0) {
      store.timer.running = false;
      store.timer.remainingMs = 0;
      store.timer.endsAt = null;
      const cur = currentSession();
      if (cur && cur.status === STATUSES.RUNNING) {
        cur.status = STATUSES.FINISHED;
        store.mode = MODES.FINISH;
        // Persist once when auto-finish happens
        persistSoon(0);
      }
    }
  }
  runtime.tickCallbacks.forEach(fn => { try { fn(); } catch {} });
}, 1000);

function onTick(fn) { if (typeof fn === 'function') runtime.tickCallbacks.push(fn); }

// -------- Exports --------
module.exports = {
  // persistence
  initPersistence,

  // snapshots
  getFrontDeskSnapshot,
  getRaceControlSnapshot,
  getLapTrackerSnapshot,
  getPublicSnapshot,
  getCountdownTick,

  // CRUD
  createSession, updateSession, removeSession,
  addDriver, updateDriver, removeDriver,

  // race ops
  startRace, finishRace, endSession, setMode,

  // laps
  recordLap,

  // tick subscription
  onTick,
};
