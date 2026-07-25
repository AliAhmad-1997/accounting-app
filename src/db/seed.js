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

// Realistic demo dataset for the browser preview (and manual testing). Uses the
// real repositories so stock movements and party balances are computed exactly
// as in production. Idempotent: a no-op once any customer exists.
function seedSample() {
  const db = getDb();
  const repos = require('./repositories');
  if (db.prepare('SELECT COUNT(*) AS c FROM customers').get().c > 0) return { skipped: true };

  const unitId = (db.prepare('SELECT id FROM units WHERE name = ?').get('قطعة') || {}).id || null;
  const catMeds = (db.prepare('SELECT id FROM categories WHERE name = ?').get('أدوية') || {}).id || null;
  const catGeneral = (db.prepare('SELECT id FROM categories WHERE name = ?').get('عام') || {}).id || null;
  const day = new Date().toISOString().slice(0, 10);

  const wh1 = repos.warehouses.create({ code: 'WH-01', name: 'المخزن الرئيسي', location: 'المبنى أ', manager: 'أحمد سالم', phone: '0770000001' });
  const wh2 = repos.warehouses.create({ code: 'WH-02', name: 'مخزن الفرع', location: 'المبنى ب', manager: 'ليلى حسن', phone: '0770000002' });

  const sup1 = repos.suppliers.create({ code: 'SUP-01', name: 'شركة الشفاء للأدوية', contact_person: 'مروان', phone: '0781111111', email: 'info@shifa.example', address: 'بغداد' });
  const sup2 = repos.suppliers.create({ code: 'SUP-02', name: 'مؤسسة النور للتجارة', contact_person: 'سعاد', phone: '0782222222', email: 'sales@noor.example', address: 'البصرة' });

  const cust1 = repos.customers.create({ code: 'CUS-01', name: 'صيدلية الرحمة', phone: '0790000001', region: 'بغداد', customer_type: 'تجزئة', credit_limit: 500000 });
  repos.customers.create({ code: 'CUS-02', name: 'مركز الحياة الطبي', phone: '0790000002', region: 'أربيل', customer_type: 'جملة', credit_limit: 1000000 });
  repos.customers.create({ code: 'CUS-03', name: 'سوبر ماركت السلام', phone: '0790000003', region: 'الموصل', customer_type: 'تجزئة', credit_limit: 250000 });

  const it1 = repos.items.create({ code: 'IT-01', name: 'باراسيتامول 500 مج', barcode: '6000000001', category_id: catMeds, unit_id: unitId, warehouse_id: wh1.id, supplier_id: sup1.id, cost_price: 800, sale_price: 1200, stock_qty: 500, reorder_point: 50 });
  const it2 = repos.items.create({ code: 'IT-02', name: 'أموكسيسيلين 250 مج', barcode: '6000000002', category_id: catMeds, unit_id: unitId, warehouse_id: wh1.id, supplier_id: sup1.id, cost_price: 1500, sale_price: 2200, stock_qty: 300, reorder_point: 40 });
  repos.items.create({ code: 'IT-03', name: 'شامبو طبي', barcode: '6000000003', category_id: catGeneral, unit_id: unitId, warehouse_id: wh2.id, supplier_id: sup2.id, cost_price: 2500, sale_price: 4000, stock_qty: 120, reorder_point: 20 });
  repos.items.create({ code: 'IT-04', name: 'قفازات طبية (علبة)', barcode: '6000000004', category_id: catGeneral, unit_id: unitId, warehouse_id: wh2.id, supplier_id: sup2.id, cost_price: 3000, sale_price: 5000, stock_qty: 80, reorder_point: 15 });

  repos.sales.create({
    customer_id: cust1.id, payment_method: 'آجل', invoice_date: day, notes: 'فاتورة مبيعات تجريبية',
    lines: [
      { item_id: it1.id, unit_price: 1200, quantity: 20 },
      { item_id: it2.id, unit_price: 2200, quantity: 10 },
    ],
  });
  repos.purchases.create({
    supplier_id: sup1.id, warehouse_id: wh1.id, payment_method: 'نقدي', invoice_date: day, notes: 'فاتورة مشتريات تجريبية',
    lines: [
      { item_id: it1.id, unit_price: 800, quantity: 100 },
      { item_id: it2.id, unit_price: 1500, quantity: 50 },
    ],
  });

  return { skipped: false };
}

module.exports = { seed, seedSample };

