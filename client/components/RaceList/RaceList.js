// Renders sessions (current/upcoming/last) and exposes hooks for user actions.
// Usage:
//   const rl = new Components.RaceList(document.getElementById('fd-sessions-upcoming'), {
//     onDelete: (id) => socket.emit('session.delete', { sessionId: id }),
//     onSelect: (id) => { /* highlight/select in UI */ },
//     showDelete: true
//   });
//   rl.render({ current, upcoming, last });

(function (global) {
  'use strict';

  function RaceList(rootEl, opts) {
    if (!rootEl) throw new Error('RaceList: root element is required');
    this.root = rootEl;
    this.opts = Object.assign({ showDelete: false, onDelete: null, onSelect: null }, opts || {});
    this._bind();
  }

  RaceList.prototype._bind = function () {
    this.root.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      // delete
      if (t.matches('[data-action="delete"]')) {
        const id = t.getAttribute('data-id');
        if (id && typeof this.opts.onDelete === 'function') this.opts.onDelete(id);
        return;
      }
      // select session
      const card = t.closest('[data-session-id]');
      if (card && typeof this.opts.onSelect === 'function') {
        this.opts.onSelect(card.getAttribute('data-session-id'));
      }
    });
  };

  RaceList.prototype._renderSessionCard = function (s, extraControls) {
    const drivers = (s.drivers || []).map(d => `${d.name} (Car ${d.carNumber})`).join(', ') || '—';
    const delBtn = this.opts.showDelete && s.status === 'PENDING'
      ? `<button type="button" data-action="delete" data-id="${s._id}">Delete</button>`
      : '';
    const controls = extraControls ? `<div class="rl-controls">${extraControls}</div>` : '';
    return `
      <div class="rl-card" data-session-id="${s._id}">
        <div class="rl-header">
          <strong>Session ${s._id}</strong>
          <span class="rl-status">${s.status}</span>
        </div>
        <div class="rl-body">${drivers}</div>
        ${controls}
        ${delBtn}
      </div>
    `;
  };

  RaceList.prototype.render = function ({ current, upcoming, last }) {
    const up = (upcoming || []).map(s => this._renderSessionCard(s)).join('');
    const cur = current ? this._renderSessionCard(current) : '<div class="rl-empty">No current session</div>';
    const lst = last ? this._renderSessionCard(last) : '<div class="rl-empty">No finished sessions yet</div>';

    this.root.innerHTML = `
      <section class="rl-section rl-current"><h3>Current</h3>${cur}</section>
      <section class="rl-section rl-upcoming"><h3>Upcoming</h3>${up || '<div class="rl-empty">—</div>'}</section>
      <section class="rl-section rl-last"><h3>Last</h3>${lst}</section>
    `;
  };

  global.Components = global.Components || {};
  global.Components.RaceList = RaceList;
})(window);