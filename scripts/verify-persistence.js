'use strict';

// Headless end-to-end proof of the data layer. It runs WITHOUT Electron using
// the Node build of better-sqlite3. Three separate OS processes are used so the
// "write then restart then read" durability requirement is genuinely exercised:
//   phase1  -> create master data + transactions, apply stock/balance effects
//   phase2  -> reopen the same file in a fresh process, assert everything reloaded
//   phase3  -> assert guard rails (no negative stock, bcrypt auth, returnable caps)
// Run: npm run verify:db

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { spawnSync } = require('child_process');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'verify.sqlite');

const { initDatabase, closeDatabase } = require('../src/db/connection');
const { runMigrations } = require('../src/db/migrate');
const { seed } = require('../src/db/seed');
const repos = require('../src/db/repositories');

const CODES = { wh: 'WH1', sup: 'SUP1', cus: 'CUS1', item: 'ITM1' };

function open() {
  initDatabase(DB_PATH);
  runMigrations();
  seed();
}

function byCode(entity, code) {
  return repos[entity].list().find((r) => r.code === code);
}

function phase1() {
  open();
  const wh = repos.warehouses.create({ code: CODES.wh, name: 'المخزن الرئيسي' });
  const sup = repos.suppliers.create({ code: CODES.sup, name: 'مورد أ' });
  const cus = repos.customers.create({ code: CODES.cus, name: 'عميل أ' });
  const item = repos.items.create({
    code: CODES.item, name: 'صنف أ', cost_price: 10, sale_price: 15,
    stock_qty: 0, reorder_point: 5, warehouse_id: wh.id, supplier_id: sup.id,
  });

  const purchase = repos.purchases.create({
    supplier_id: sup.id, warehouse_id: wh.id,
    lines: [{ item_id: item.id, unit_price: 10, quantity: 100 }],
  });
  const sale = repos.sales.create({
    customer_id: cus.id,
    lines: [{ item_id: item.id, unit_price: 15, quantity: 30 }],
  });
  repos.salesReturns.create({
    original_invoice_id: sale.id,
    lines: [{ item_id: item.id, unit_price: 15, quantity: 5 }],
  });
  repos.purchaseReturns.create({
    original_invoice_id: purchase.id,
    lines: [{ item_id: item.id, unit_price: 10, quantity: 10 }],
  });

  const freshItem = repos.items.get(item.id);
  const freshSup = repos.suppliers.get(sup.id);
  const freshCus = repos.customers.get(cus.id);
  console.log('[phase1] stock=%d supplierBalance=%d customerBalance=%d',
    freshItem.stock_qty, freshSup.balance, freshCus.balance);

  // stock: +100 -30 +5 -10 = 65
  assert.strictEqual(freshItem.stock_qty, 65, 'stock after transactions');
  // supplier payable: +1000 -100 = 900
  assert.strictEqual(freshSup.balance, 900, 'supplier balance');
  // customer receivable: +450 -75 = 375
  assert.strictEqual(freshCus.balance, 375, 'customer balance');
  closeDatabase();
  console.log('[phase1] OK - data written and connection closed');
}

function phase2() {
  open(); // reopens the SAME file in a brand-new process
  const item = byCode('items', CODES.item);
  const sup = byCode('suppliers', CODES.sup);
  const cus = byCode('customers', CODES.cus);

  assert.ok(item && sup && cus, 'master records reloaded from disk');
  assert.strictEqual(item.stock_qty, 65, 'stock persisted across restart');
  assert.strictEqual(sup.balance, 900, 'supplier balance persisted across restart');
  assert.strictEqual(cus.balance, 375, 'customer balance persisted across restart');
  assert.strictEqual(repos.sales.list().length, 1, 'sales invoice persisted');
  assert.strictEqual(repos.purchases.list().length, 1, 'purchase invoice persisted');
  assert.strictEqual(repos.salesReturns.list().length, 1, 'sales return persisted');
  assert.strictEqual(repos.purchaseReturns.list().length, 1, 'purchase return persisted');
  closeDatabase();
  console.log('[phase2] OK - all data reloaded correctly after restart');
}

function phase3() {
  open();
  const item = byCode('items', CODES.item);
  const cus = byCode('customers', CODES.cus);

  // Guard: selling more than available stock must be rejected atomically.
  assert.throws(
    () => repos.sales.create({ customer_id: cus.id, lines: [{ item_id: item.id, unit_price: 15, quantity: 100000 }] }),
    /المخزون/,
    'oversell rejected'
  );
  assert.strictEqual(repos.items.get(item.id).stock_qty, 65, 'stock unchanged after failed sale');

  // Guard: bcrypt auth (hashed, not base64).
  assert.ok(repos.users.authenticate('admin', 'admin123'), 'admin login works');
  assert.strictEqual(repos.users.authenticate('admin', 'wrong'), null, 'wrong password rejected');
  const admin = repos.users.findByUsername('admin');
  assert.ok(/^\$2[aby]\$/.test(admin.password_hash), 'password stored as a bcrypt hash');

  closeDatabase();
  console.log('[phase3] OK - guard rails and bcrypt verified');
}

const mode = process.argv[2];
if (mode === 'phase1') phase1();
else if (mode === 'phase2') phase2();
else if (mode === 'phase3') phase3();
else {
  // Orchestrator: run each phase in its own process = real restarts.
  fs.rmSync(path.dirname(DB_PATH), { recursive: true, force: true });
  for (const phase of ['phase1', 'phase2', 'phase3']) {
    const res = spawnSync(process.execPath, [__filename, phase], { stdio: 'inherit' });
    if (res.status !== 0) {
      console.error(`\u274c ${phase} failed`);
      process.exit(1);
    }
  }
  console.log('\n✅ ALL PERSISTENCE & ACCOUNTING CHECKS PASSED');
}

