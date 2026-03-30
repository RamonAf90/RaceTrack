// server/index.js
'use strict';

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { Server } = require('socket.io');

const routes = require('./routes/routes');
const attachNamespaces = require('./sockets/sockets');
const handlers = require('./handlers/handlers');
const { port } = require('./config');

async function main() {
  // Optional DB connect (required for persistence)
  if (process.env.MONGO_URI) {
    const { connect } = require('./db/connect');
    await connect(process.env.MONGO_URI);
  }

  // Initialize persistence (loads state if DB available)
  await handlers.initPersistence();

  const app = express();

  // Core middleware
  app.use(express.json());
  app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-cookie-secret'));

  const sessionMw = session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    name: 'rt.sid',
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: 'lax', httpOnly: true },
  });
  app.use(sessionMw);

  // Static mounts
  const ROOT_DIR    = path.resolve(__dirname, '..');
  const CLIENT_ROOT = path.join(ROOT_DIR, 'client');
  app.use('/static', express.static(path.join(CLIENT_ROOT, 'static')));
  app.use('/client', express.static(CLIENT_ROOT));
  app.use('/pages',  express.static(path.join(CLIENT_ROOT, 'pages')));

  // Routes
  app.use(routes);

  // HTTP + Socket.IO
  const server = http.createServer(app);
  const io = new Server(server);
  io.engine.use(sessionMw);
  attachNamespaces(io);

  server.listen(port, () => {
    console.log(`✅ Server listening on http://localhost:${port}`);
    console.log('   Static roots:');
    console.log('    • /static  ->', path.join(CLIENT_ROOT, 'static'));
    console.log('    • /client  ->', CLIENT_ROOT);
    console.log('    • /pages   ->', path.join(CLIENT_ROOT, 'pages'));
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err?.stack || err);
  process.exit(1);
});
