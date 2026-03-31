// server/models/models.js
'use strict';

const { mongoose } = require('../db/connect');

const StateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' }, // always 'global'
    sessions: { type: Array, default: [] },   // JSON-safe array (drivers, results, etc.)
    currentSessionId: { type: Number, default: null },
    queuedSessionId:  { type: Number, default: null },     // <-- NEW: next session for Race Control UI
    lastFinishedSessionId: { type: Number, default: null },
    mode: { type: String, default: 'DANGER' },
    timer: {
      running: { type: Boolean, default: false },
      remainingMs: { type: Number, default: 0 },
      endsAt: { type: Number, default: null },
      durationMs: { type: Number, default: 0 },
    },
    seq: { type: Number, default: 1 }, // auto-increment counter for new session IDs
  },
  { collection: 'rt_state', minimize: true, versionKey: false }
);

const State = mongoose.model('State', StateSchema);

module.exports = { State };
