'use strict';

const { getDb } = require('./connection');
const users = require('./repositories/users');

// Idempotent seeding: a default admin (only if there are no users yet) plus a
// starter set of units/categories. Safe to run on every launch.
function seed() {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    users.create({ username: 'admin', password: 'admin123', full_name: 'مدير النظام', role: 'admin' });
  }

  const units = ['قطعة', 'علبة', 'كرتون', 'كيلو', 'لتر', 'متر'];
  const categories = ['عام', 'أدوية', 'مواد غذائية', 'ملابس', 'كهربائيات'];
  const insertUnit = db.prepare('INSERT OR IGNORE INTO units (name) VALUES (?)');
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  const tx = db.transaction(() => {
    units.forEach((u) => insertUnit.run(u));
    categories.forEach((c) => insertCategory.run(c));
  });
  tx();
}

module.exports = { seed };

