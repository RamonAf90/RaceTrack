// Renders a sortable leaderboard table into a root container.
// Usage:
//   const lb = new Components.LeaderBoard(document.getElementById('lb-root'));
//   lb.update({ entries, mode: 'SAFE', remainingMs: 12345 });

(function (global) {
  'use strict';

  function msToLap(ms) {
    if (ms == null) return '—';
    const t = Math.floor(ms);
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const ms3 = String(t % 1000).padStart(3, '0');
    return `${m}:${String(s).padStart(2, '0')}.${ms3}`;
  }
  function msToClock(ms) {
    const t = Math.max(0, Math.floor(ms || 0));
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function LeaderBoard(rootEl, opts) {
    if (!rootEl) throw new Error('LeaderBoard: root element is required');
    this.root = rootEl;
    this.opts = Object.assign({}, opts || {});
    this._ensureSkeleton();
  }

  LeaderBoard.prototype._ensureSkeleton = function () {
    // If root already contains a table, reuse it; else create a simple table.
    if (!this.root.querySelector('table')) {
      this.root.innerHTML = `
        <div class="lb-header">
          <span>Mode: <strong class="lb-mode">—</strong></span>
          <span>Time: <strong class="lb-timer">00:00</strong></span>
        </div>
        <table class="lb-table">
          <thead>
            <tr><th>#</th><th>Driver</th><th>Car</th><th>Best Lap</th><th>Lap</th></tr>
          </thead>
          <tbody class="lb-body"></tbody>
        </table>
      `;
    }
    this._els = {
      body: this.root.querySelector('.lb-body') || this.root.querySelector('tbody'),
      mode: this.root.querySelector('.lb-mode'),
      timer: this.root.querySelector('.lb-timer'),
    };
  };

  LeaderBoard.prototype.update = function ({ entries, mode, remainingMs }) {
    const body = this._els.body;
    if (!body) return;

    const sorted = [...(entries || [])].sort((a, b) => {
      if (a.bestLapMs == null && b.bestLapMs == null) return a.carNumber - b.carNumber;
      if (a.bestLapMs == null) return 1;
      if (b.bestLapMs == null) return -1;
      return a.bestLapMs - b.bestLapMs;
    });

    body.innerHTML = sorted.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.driverName}</td>
        <td>${e.carNumber}</td>
        <td>${msToLap(e.bestLapMs)}</td>
        <td>${e.currentLap ?? 0}</td>
      </tr>
    `).join('');

    if (this._els.mode && mode) this._els.mode.textContent = mode;
    if (this._els.timer && typeof remainingMs === 'number') this._els.timer.textContent = msToClock(remainingMs);
  };

  global.Components = global.Components || {};
  global.Components.LeaderBoard = LeaderBoard;
})(window);