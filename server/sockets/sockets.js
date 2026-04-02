// server/sockets/sockets.js
'use strict';

const { receptionistKey, observerKey, safetyKey } = require('../config');
const handlers = require('../handlers/handlers');

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const norm  = (v) => (v == null ? '' : String(v).trim());

/** Normalize acks: (ok:true, result?) or (ok:false, error) */
async function ackWrap(fn, ack) {
  try {
    const result = await fn();
    if (typeof ack === 'function') ack({ ok: true, result });
  } catch (err) {
    const msg = err?.message || String(err);
    if (typeof ack === 'function') ack({ ok: false, error: msg });
  }
}

/** Emit snapshots to all UIs */
async function broadcastFrontDesk(io) {
  try {
    const snap = await handlers.getFrontDeskSnapshot();
    io.of('/frontdesk').emit('frontdesk.init', snap);
  } catch (e) { console.warn('[broadcastFrontDesk]', e?.message || e); }
}
async function broadcastRaceControl(io) {
  try {
    const snap = await handlers.getRaceControlSnapshot();
    io.of('/racecontrol').emit('racecontrol.init', snap);
  } catch (e) { console.warn('[broadcastRaceControl]', e?.message || e); }
}
async function broadcastLapTracker(io) {
  try {
    const snap = await handlers.getLapTrackerSnapshot();
    io.of('/laptracker').emit('laptracker.init', snap);
  } catch (e) { console.warn('[broadcastLapTracker]', e?.message || e); }
}
async function broadcastPublic(io) {
  try {
    const snap = await handlers.getPublicSnapshot();
    io.of('/public').emit('public.snapshot', snap);
  } catch (e) { console.warn('[broadcastPublic]', e?.message || e); }
}
async function rebroadcastAll(io) {
  await Promise.all([
    broadcastFrontDesk(io),
    broadcastRaceControl(io),
    broadcastLapTracker(io),
    broadcastPublic(io),
  ]);
}

/** Session-aware auth for namespaces (also allows optional auth.key fallback) */
function protectByRole(expectedRole, fallbackEnvKey) {
  return async (socket, next) => {
    try {
      const sess = socket.request?.session;
      const role = sess?.role;

      const providedKey = norm(socket.handshake?.auth?.key);
      const okViaKey = providedKey && fallbackEnvKey && providedKey === norm(fallbackEnvKey);
      const ok = role === expectedRole || okViaKey;

      console.log(`[auth:${expectedRole}]`, { role, viaKey: okViaKey, hasSess: !!sess });

      if (ok) return next();
      await delay(500);
      next(new Error('unauthorized'));
    } catch (e) {
      next(e);
    }
  };
}

module.exports = function attachNamespaces(io) {
  // ---------------- /frontdesk ----------------
  const fd = io.of('/frontdesk');
  fd.use(protectByRole('receptionist', receptionistKey));
  fd.on('connection', async (socket) => {
    console.log('[frontdesk] connected', socket.id);

    // initial snapshot
    try {
      const snap = await handlers.getFrontDeskSnapshot();
      socket.emit('frontdesk.init', snap);
    } catch (e) { console.warn('[frontdesk] init error', e?.message || e); }

    // Session CRUD
    socket.on('session.create', (payload, ack) =>
      ackWrap(async () => {
        await handlers.createSession(payload || {});
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('session.update', ({ sessionId, patch }, ack) =>
      ackWrap(async () => {
        await handlers.updateSession(sessionId, patch || {});
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('session.remove', ({ sessionId }, ack) =>
      ackWrap(async () => {
        await handlers.removeSession(sessionId);
        await rebroadcastAll(io);
      }, ack)
    );

    // Drivers
    socket.on('driver.add', ({ sessionId, driver }, ack) =>
      ackWrap(async () => {
        await handlers.addDriver(sessionId, driver || {});
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('driver.update', ({ sessionId, name, patch }, ack) =>
      ackWrap(async () => {
        await handlers.updateDriver(sessionId, name, patch || {});
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('driver.remove', ({ sessionId, name }, ack) =>
      ackWrap(async () => {
        await handlers.removeDriver(sessionId, name);
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('disconnect', () => console.log('[frontdesk] disconnected', socket.id));
  });

  // ---------------- /racecontrol ----------------
  const rc = io.of('/racecontrol');
  rc.use(protectByRole('safety', safetyKey));
  rc.on('connection', async (socket) => {
    console.log('[racecontrol] connected', socket.id);

    try {
      const snap = await handlers.getRaceControlSnapshot();
      socket.emit('racecontrol.init', snap);
    } catch (e) { console.warn('[racecontrol] init error', e?.message || e); }

    socket.on('race.start', (payload, ack) =>
      ackWrap(async () => {
        await handlers.startRace(payload || {});
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('race.finish', (ack) =>
      ackWrap(async () => {
        await handlers.finishRace();
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('race.endSession', (ack) =>
      ackWrap(async () => {
        await handlers.endSession();
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('mode.set', ({ mode }, ack) =>
      ackWrap(async () => {
        await handlers.setMode(mode);
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('disconnect', () => console.log('[racecontrol] disconnected', socket.id));
  });

  // ---------------- /laptracker ----------------
  const lt = io.of('/laptracker');
  lt.use(protectByRole('observer', observerKey));
  lt.on('connection', async (socket) => {
    console.log('[laptracker] connected', socket.id);

    try {
      const snap = await handlers.getLapTrackerSnapshot();
      socket.emit('laptracker.init', snap);
    } catch (e) { console.warn('[laptracker] init error', e?.message || e); }

    socket.on('lap.cross', ({ carNumber }, ack) =>
      ackWrap(async () => {
        await handlers.recordLap({ carNumber });
        await rebroadcastAll(io);
      }, ack)
    );

    socket.on('disconnect', () => console.log('[laptracker] disconnected', socket.id));
  });

  // ---------------- /public ----------------
  const pub = io.of('/public');
  pub.on('connection', async (socket) => {
    console.log('[public] connected', socket.id);
    try {
      const snap = await handlers.getPublicSnapshot();
      socket.emit('public.snapshot', snap);
    } catch (e) { console.warn('[public] snapshot error', e?.message || e); }
    socket.on('disconnect', () => console.log('[public] disconnected', socket.id));
  });

  // Allow timer tick push (optional)
  if (typeof handlers.onTick === 'function') {
    handlers.onTick(async () => {
      try {
        const t = await handlers.getCountdownTick();
        io.of('/public').emit('public.countdown', t);
        io.of('/racecontrol').emit('racecontrol.countdown', t);
      } catch (e) {
        console.warn('[tick broadcast]', e?.message || e);
      }
    });
  }

  console.log('[sockets] namespaces attached.');
};
