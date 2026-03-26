// Shared Socket.IO helpers + small utilities for all pages.

/* global io */

// ===== Utilities =====
function msToClock(ms) {
  const t = Math.max(0, Math.floor(ms || 0));
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function msToLap(ms) {
  if (ms == null) return '—';
  const t = Math.floor(ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const ms3 = String(t % 1000).padStart(3, '0');
  return `${m}:${String(s).padStart(2, '0')}.${ms3}`;
}

function fullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen();
}

async function promptKey(label) {
  let key = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    key = window.prompt(`Enter ${label} access key:`);
    if (key === null) throw new Error('Access key entry cancelled');
    if (key.trim()) return key.trim();
  }
}

// ===== Socket helpers =====
/**
 * Connect to a protected namespace with auth:
 * 1) Attempt cookie-based auth first (after logging in via /api/login).
 * 2) If that fails, fall back to prompting for the interface access key and use handshake auth.
 *
 * @param {string} namespace - e.g. '/frontdesk'
 * @param {string} roleLabel - e.g. 'Receptionist'
 * @returns {Promise<import("socket.io-client").Socket>}
 */


/**
 * Connect to the public namespace and join a room.
 * @param {'leaderboard'|'nextrace'|'countdown'|'flags'} room
 * @returns {import("socket.io-client").Socket}
 */
function connectPublic(room) {
  const socket = io('/public', { autoConnect: true });
  socket.on('connect', () => socket.emit('public.join', { room }));
  return socket;
}

// Expose utilities and helpers globally for vanilla pages
window.RT = {
  connectProtected,
  connectPublic,
  msToClock,
  msToLap,
  fullscreen,
};
