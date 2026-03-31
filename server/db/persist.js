
'use strict';

const { isConnected, getMongoose } = require('./connect');

let StateModel = null;

function getModel() {
  if (!isConnected()) return null;
  if (StateModel) return StateModel;

  const mongoose = getMongoose();
  const StateSchema = new mongoose.Schema({
    _id: { type: String, default: 'singleton' },
    // we store your handler state verbatim (see handlers.js "state")
    state: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now },
  }, { collection: 'racetrack_state' });

  StateModel = mongoose.model('State', StateSchema);
  return StateModel;
}

async function load() {
  if (!isConnected()) return null;
  const M = getModel();
  if (!M) return null;
  const doc = await M.findById('singleton').lean();
  return doc ? doc.state : null;
}

async function save(state) {
  if (!isConnected()) return;
  const M = getModel();
  if (!M) return;
  await M.updateOne(
    { _id: 'singleton' },
    { $set: { state, updatedAt: new Date() } },
    { upsert: true }
  );
}

module.exports = { load, save };
