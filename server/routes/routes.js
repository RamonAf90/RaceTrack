'use strict';

const path = require('path');
const express = require('express');
const router = express.Router();
const { receptionistKey, observerKey, safetyKey } = require('../config');

// ---------- Paths & helpers ----------
const ROOT_DIR    = path.resolve(__dirname, '..', '..');      // <repo>
const CLIENT_ROOT = path.join(ROOT_DIR, 'client');
const page = (...s) => path.join(CLIENT_ROOT, 'pages', ...s);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const norm  = (v) => (v == null ? '' : String(v).trim());

// Serve protected page if role matches; else serve Login.html at the same URL (no redirect).
function requireRoleOrLogin(role) {
  return (req, res) => {
    if (req.session?.role === role) {
      const file =
        role === 'receptionist' ? page('FrontDesk', 'FrontDesk.html') :
        role === 'safety'       ? page('RaceControl', 'RaceControl.html') :
                                  page('LapTracker', 'LapTracker.html');
      return res.sendFile(file);
    }
    // Not logged/wrong role → show login form (served from file)
    return res.sendFile(page('Login', 'Login.html'));
  };
}

// ---------- Public pages ----------
router.get('/', (_req, res) => res.redirect('/home'));
router.get('/home', (_req, res) => res.sendFile(page('Home', 'Home.html')));

router.get('/leader-board',   (_req, res) => res.sendFile(page('LeaderBoardPage', 'LeaderBoardPage.html')));
router.get('/next-race',      (_req, res) => res.sendFile(page('NextRacePage', 'NextRacePage.html')));
router.get('/race-countdown', (_req, res) => res.sendFile(page('CountdownPage', 'CountdownPage.html')));
router.get('/race-flags',     (_req, res) => res.sendFile(page('FlagsPage', 'FlagsPage.html')));

// ---------- Login page ----------
router.get('/login', (_req, res) => res.sendFile(page('Login', 'Login.html')));

// ---------- Employee pages (server-guarded) ----------
router.get('/front-desk',       requireRoleOrLogin('receptionist'));
router.get('/race-control',     requireRoleOrLogin('safety'));
router.get('/lap-line-tracker', requireRoleOrLogin('observer'));

// ---------- Auth APIs ----------
router.post('/api/login', async (req, res) => {
  const role = norm(req.body?.role);
  const key  = norm(req.body?.key);

  const expected =
    role === 'receptionist' ? receptionistKey :
    role === 'observer'     ? observerKey     :
    role === 'safety'       ? safetyKey       : '';

  if (!expected) {
    await delay(500);
    return res.status(400).json({ ok: false, error: 'Invalid role' });
  }
  if (key !== norm(expected)) {
    await delay(500);
    return res.status(401).json({ ok: false, error: 'Incorrect access key' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ ok: false, error: 'Session error' });
    req.session.role = role;
    req.session.save(() => res.json({ ok: true, role }));
  });
});

router.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('rt.sid');
    res.json({ ok: true });
  });
});

router.get('/api/me', (req, res) => {
  res.json({ ok: true, role: req.session?.role || null });
});

// ---------- 404 (keep last) ----------
router.use((_req, res) => res.status(404).send('Not Found'));

module.exports = router;