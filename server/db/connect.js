// server/db/connect.js
'use strict';

const mongoose = require('mongoose');

let connected = false;

async function connect(uri) {
  if (connected) return mongoose;
  if (!uri) throw new Error('MONGO_URI is not set');

  mongoose.set('strictQuery', true);
  // Optional: enable Mongoose debug
  if (process.env.MONGOOSE_DEBUG === '1') mongoose.set('debug', true);

  await mongoose.connect(uri, {
    // Use options as needed; Mongoose v7+ uses sensible defaults
  });

  connected = true;

  mongoose.connection.on('connected', () => {
    console.log('✅ Mongo connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('❌ Mongo connection error:', err?.message || err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Mongo disconnected');
    connected = false;
  });

  return mongoose;
}

module.exports = { connect, mongoose };
