'use strict';

const { getDb } = require('../connection');

// Lightweight read helpers that feed the dropdowns in the transaction screens.
function all() {
  const db = getDb();
  return {
    customers: db.prepare('SELECT id, code, name, phone, address, balance FROM customers ORDER BY name').all(),
    suppliers: db.prepare('SELECT id, code, name, phone, address, balance FROM suppliers ORDER BY name').all(),
    warehouses: db.prepare('SELECT id, code, name FROM warehouses ORDER BY name').all(),
    items: db
      .prepare(
        'SELECT id, code, name, barcode, sale_price, cost_price, stock_qty, default_discount, unit_id FROM items ORDER BY name'
      )
      .all(),
    categories: db.prepare('SELECT id, name FROM categories ORDER BY name').all(),
    units: db.prepare('SELECT id, name FROM units ORDER BY name').all(),
  };
}

function categories() {
  return getDb().prepare('SELECT id, name FROM categories ORDER BY name').all();
}

function units() {
  return getDb().prepare('SELECT id, name FROM units ORDER BY name').all();
}

function addCategory(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  getDb().prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(clean);
  return getDb().prepare('SELECT id, name FROM categories WHERE name = ?').get(clean);
}

function addUnit(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  getDb().prepare('INSERT OR IGNORE INTO units (name) VALUES (?)').run(clean);
  return getDb().prepare('SELECT id, name FROM units WHERE name = ?').get(clean);
}

module.exports = { all, categories, units, addCategory, addUnit };

