'use strict';

const bcrypt = require('bcryptjs');
const { getDb } = require('../connection');
const { ValidationError, NotFoundError } = require('../errors');

const SALT_ROUNDS = 10;

// Strip the password hash before anything leaves the data layer.
function toPublic(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

function findByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
}

function authenticate(username, password) {
  const user = findByUsername(username);
  if (!user || !user.is_active) return null;
  if (!bcrypt.compareSync(String(password || ''), user.password_hash)) return null;
  return toPublic(user);
}

function create({ username, password, full_name, role } = {}) {
  const uname = String(username || '').trim();
  if (!uname) throw new ValidationError('اسم المستخدم مطلوب');
  if (!password || String(password).length < 4) throw new ValidationError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
  if (findByUsername(uname)) throw new ValidationError('اسم المستخدم مستخدم بالفعل');
  const hash = bcrypt.hashSync(String(password), SALT_ROUNDS);
  const info = getDb()
    .prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
    .run(uname, hash, full_name || null, role || 'user');
  return toPublic(getDb().prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid));
}

function changePassword({ username, oldPassword, newPassword } = {}) {
  const user = findByUsername(username);
  if (!user) throw new NotFoundError('المستخدم غير موجود');
  if (!bcrypt.compareSync(String(oldPassword || ''), user.password_hash)) {
    throw new ValidationError('كلمة المرور الحالية غير صحيحة');
  }
  if (!newPassword || String(newPassword).length < 4) {
    throw new ValidationError('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل');
  }
  const hash = bcrypt.hashSync(String(newPassword), SALT_ROUNDS);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  return { ok: true };
}

function list() {
  return getDb()
    .prepare('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id')
    .all();
}

module.exports = { authenticate, create, changePassword, findByUsername, list, toPublic, SALT_ROUNDS };

