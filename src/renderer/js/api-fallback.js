'use strict';

// Transport adapter. In Electron the preload script has already installed a
// context-isolated `window.api` backed by IPC, so this file is a no-op there.
// In the browser preview there is no preload, so we install an equivalent
// `window.api` backed by the Express REST endpoints. Same shape, same
// { ok, data } / { ok, error } contract, so the renderer code is transport-
// agnostic and the real IPC path is never touched.
(function () {
  if (window.api) return; // Electron preload already provided the bridge.

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) return { ok: false, error: { message: 'HTTP ' + res.status } };
    return res.json();
  }

  window.api = {
    isHttp: true,
    call: (entity, action, ...args) => post('/api/call', { entity, action, args }),
    auth: {
      login: (username, password) => post('/api/auth/login', { username, password }),
      changePassword: (payload) => post('/api/auth/change-password', payload),
    },
    app: {
      openMain: () => {
        window.location.href = 'index.html';
        return Promise.resolve({ ok: true });
      },
      logout: () => {
        try { sessionStorage.removeItem('auth_user'); } catch (e) { /* ignore */ }
        window.location.href = 'login.html';
        return Promise.resolve({ ok: true });
      },
    },
  };
})();

