'use strict';

// Browser preview server. Electron cannot be previewed in a browser, so this
// thin Express app serves the exact same renderer (src/renderer) and exposes
// the same repository operations the Electron IPC bridge does — backed by the
// same SQLite database and repository modules. The renderer's HTTP transport
// adapter (js/api-fallback.js) talks to these endpoints when window.api is not
// provided by an Electron preload. The real IPC path is untouched.
const path = require('path');
const express = require('express');
const { initDatabase } = require('../src/db/connection');
const { runMigrations } = require('../src/db/migrate');
const { seed, seedSample } = require('../src/db/seed');
const repos = require('../src/db/repositories');

// Mirror of ipc.js CALLABLE: users is intentionally excluded from the generic
// bridge; authentication has dedicated endpoints so hashes stay server-side.
const CALLABLE = new Set([
  'customers', 'suppliers', 'warehouses', 'items',
  'sales', 'purchases', 'salesReturns', 'purchaseReturns',
  'reports', 'lookups',
]);

const ok = (data) => ({ ok: true, data });
const fail = (err) => ({ ok: false, error: { message: err.message || 'خطأ غير متوقع', code: err.code || 'ERROR' } });

const dbPath = process.env.PREVIEW_DB || path.join(__dirname, 'data', 'preview.sqlite');
initDatabase(dbPath);
runMigrations();
seed();
const seededSample = seedSample();
console.log('[preview] db ready at', dbPath, '| sample:', seededSample.skipped ? 'already present' : 'inserted');

const app = express();
app.use(express.json());

app.post('/api/call', (req, res) => {
  try {
    const { entity, action, args } = req.body || {};
    if (!CALLABLE.has(entity)) throw new Error('كيان غير معروف: ' + entity);
    const repo = repos[entity];
    const fn = repo && repo[action];
    if (typeof fn !== 'function') throw new Error('إجراء غير معروف: ' + entity + '.' + action);
    res.json(ok(fn(...(args || []))));
  } catch (err) {
    res.json(fail(err));
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = repos.users.authenticate(username, password);
    if (!user) return res.json({ ok: false, error: { message: 'اسم المستخدم أو كلمة المرور غير صحيحة' } });
    res.json(ok(user));
  } catch (err) {
    res.json(fail(err));
  }
});

app.post('/api/auth/change-password', (req, res) => {
  try {
    res.json(ok(repos.users.changePassword(req.body || {})));
  } catch (err) {
    res.json(fail(err));
  }
});

const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
app.use(express.static(rendererDir));
app.get('/', (_req, res) => res.redirect('/login.html'));

const PORT = process.env.PORT || 8091;
app.listen(PORT, () => console.log('[preview] listening on http://localhost:' + PORT));

