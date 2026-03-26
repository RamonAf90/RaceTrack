/* global io */
(function () {
  'use strict';

  const flagEl = document.getElementById('flagBox');
  const fsBtn  = document.getElementById('rf-fullscreen');

  function setMode(mode) {
    if (!flagEl) return;
    const m = String(mode || '').toUpperCase();

    // reset classes
    flagEl.classList.remove('flag-safe', 'flag-hazard', 'flag-danger', 'flag-finish');

    // apply + set text (fits your CSS)
    switch (m) {
      case 'SAFE':
        flagEl.classList.add('flag-safe');
        flagEl.textContent = 'SAFE';
        document.title = 'Flags • SAFE';
        break;
      case 'HAZARD':
        flagEl.classList.add('flag-hazard');
        flagEl.textContent = 'HAZARD';
        document.title = 'Flags • HAZARD';
        break;
      case 'FINISH':
        flagEl.classList.add('flag-finish');
        flagEl.textContent = 'FINISH';
        document.title = 'Flags • FINISH';
        break;
      case 'DANGER':
      default:
        flagEl.classList.add('flag-danger');
        flagEl.textContent = 'DANGER';
        document.title = 'Flags • DANGER';
        break;
    }
  }

  function enableFullscreenButton() {
    const fsBtn = document.getElementById('rf-fullscreen');
    if (!fsBtn) return;
    fsBtn.addEventListener('click', () => {
      const box = document.getElementById('flagBox');
      if (!box) return;
      if (!document.fullscreenElement) {
        box.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  function connect() {
    // Public namespace; no auth helpers needed
    const socket = io('/public', { reconnectionAttempts: 5 });

    socket.on('public.snapshot', (snap) => {
      if (snap && 'mode' in snap) setMode(snap.mode);
    });

    // If you ever emit a mode-only event, this is ready:
    // socket.on('public.mode', ({ mode }) => setMode(mode));
  }

  // Initial visual (matches your markup)
  document.addEventListener('DOMContentLoaded', () => {
    enableFullscreenButton();
    setMode('DANGER');
    connect();
  });
})();
