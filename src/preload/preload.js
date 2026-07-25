'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The single, audited surface the renderer is allowed to touch. No Node APIs
// and no database handles are exposed — only these typed IPC calls.
contextBridge.exposeInMainWorld('api', {
  // Generic data-access: window.api.call('customers', 'list')
  call: (entity, action, ...args) => ipcRenderer.invoke('db:call', { entity, action, args }),

  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    changePassword: (payload) => ipcRenderer.invoke('auth:change-password', payload),
  },

  app: {
    openMain: () => ipcRenderer.invoke('app:open-main'),
    logout: () => ipcRenderer.invoke('app:logout'),
  },
});

