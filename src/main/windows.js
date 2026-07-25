'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');

let loginWin = null;
let mainWin = null;

function webPreferences() {
  return {
    preload: path.join(__dirname, '../preload/preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  };
}

function createLoginWindow() {
  if (loginWin) {
    loginWin.focus();
    return loginWin;
  }
  loginWin = new BrowserWindow({
    width: 1000,
    height: 660,
    resizable: false,
    autoHideMenuBar: true,
    title: 'تسجيل الدخول',
    webPreferences: webPreferences(),
  });
  loginWin.loadFile(path.join(__dirname, '../renderer/login.html'));
  loginWin.on('closed', () => {
    loginWin = null;
  });
  return loginWin;
}

function createMainWindow() {
  if (mainWin) {
    mainWin.focus();
    return mainWin;
  }
  mainWin = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 1040,
    minHeight: 660,
    autoHideMenuBar: true,
    title: 'النظام الرئيسي لإدارة المبيعات والمخازن',
    webPreferences: webPreferences(),
  });
  mainWin.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWin.on('closed', () => {
    mainWin = null;
  });
  return mainWin;
}

// Transition helpers keep exactly one of {login, main} visible at a time.
function openMainFromLogin() {
  createMainWindow();
  if (loginWin) loginWin.close();
}

function logoutToLogin() {
  createLoginWindow();
  if (mainWin) mainWin.close();
}

module.exports = { createLoginWindow, createMainWindow, openMainFromLogin, logoutToLogin };

