// Applies flag classes to a container element.
// Expected CSS classes (not included): .flag-safe, .flag-hazard, .flag-danger, .flag-finish
// Usage:
//   const fd = new Components.FlagDisplay(document.getElementById('flagBox'));
//   fd.setMode('SAFE');

(function (global) {
  'use strict';

  function FlagDisplay(el) {
    if (!el) throw new Error('FlagDisplay: element is required');
    this.el = el;
  }

  FlagDisplay.prototype.setMode = function (mode) {
    const m = (mode || '').toString().trim().toUpperCase();
    const el = this.el;
    el.classList.remove('flag-safe', 'flag-hazard', 'flag-danger', 'flag-finish');
    switch (m) {
      case 'SAFE':   el.classList.add('flag-safe');   el.textContent = 'SAFE'; break;
      case 'HAZARD': el.classList.add('flag-hazard'); el.textContent = 'HAZARD'; break;
      case 'DANGER': el.classList.add('flag-danger'); el.textContent = 'DANGER'; break;
      case 'FINISH': el.classList.add('flag-finish'); el.textContent = 'FINISH'; break;
      default:       el.textContent = 'No flag';
    }
  };

  global.Components = global.Components || {};
  global.Components.FlagDisplay = FlagDisplay;
})(window);