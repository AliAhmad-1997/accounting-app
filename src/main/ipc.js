'use strict';

const { ipcMain } = require('electron');
const repos = require('../db/repositories');
const windows = require('./windows');

// Entities reachable through the generic db:call bridge. `users` is deliberately
// excluded — authentication goes through dedicated channels so password hashes
// are never addressable from the renderer.
const CALLABLE = new Set([
  'customers', 'suppliers', 'warehouses', 'items',
  'sales', 'purchases', 'salesReturns', 'purchaseReturns',
  'reports', 'lookups',
]);

const ok = (data) => ({ ok: true, data });
const fail = (err) => ({ ok: false, error: { message: err.message || 'خطأ غير متوقع', code: err.code || 'ERROR' } });

function registerIpc() {
  // Generic data-access bridge: dispatch { entity, action, args } to a repo.
  ipcMain.handle('db:call', (_event, payload) => {
    try {
      const { entity, action, args } = payload || {};
      if (!CALLABLE.has(entity)) throw new Error(`كيان غير معروف: ${entity}`);
      const repo = repos[entity];
      const fn = repo && repo[action];
      if (typeof fn !== 'function') throw new Error(`إجراء غير معروف: ${entity}.${action}`);
      return ok(fn(...(args || [])));
    } catch (err) {
      return fail(err);
    }
  });

  ipcMain.handle('auth:login', (_event, { username, password } = {}) => {
    try {
      const user = repos.users.authenticate(username, password);
      if (!user) return { ok: false, error: { message: 'اسم المستخدم أو كلمة المرور غير صحيحة' } };
      return ok(user);
    } catch (err) {
      return fail(err);
    }
  });

  ipcMain.handle('auth:change-password', (_event, payload) => {
    try {
      return ok(repos.users.changePassword(payload));
    } catch (err) {
      return fail(err);
    }
  });

  ipcMain.handle('app:open-main', () => {
    windows.openMainFromLogin();
    return { ok: true };
  });

  ipcMain.handle('app:logout', () => {
    windows.logoutToLogin();
    return { ok: true };
  });
}

module.exports = { registerIpc };

