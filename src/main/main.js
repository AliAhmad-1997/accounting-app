'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { initDatabase, closeDatabase } = require('../db/connection');
const { runMigrations } = require('../db/migrate');
const { seed } = require('../db/seed');
const { registerIpc } = require('./ipc');
const { createLoginWindow } = require('./windows');

// Open the persistent database in the OS per-user app-data directory, run any
// pending migrations and seed defaults. Data survives every app restart.
function bootstrap() {
  const dbPath = path.join(app.getPath('userData'), 'data', 'accounting.sqlite');
  initDatabase(dbPath);
  runMigrations();
  seed();
  console.log('[db] ready at', dbPath);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    bootstrap();
    registerIpc();
    createLoginWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => closeDatabase());
}

