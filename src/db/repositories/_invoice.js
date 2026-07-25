'use strict';

const { getDb } = require('../connection');
const { ValidationError, NotFoundError } = require('../errors');
const { computeNextNumber, toNumber, round2 } = require('../util');

// Shared engine for sales & purchase invoices. Both are header + line-item
// documents that move stock and a party balance. They differ only in:
//   stockSign   : sale = -1 (stock leaves), purchase = +1 (stock arrives)
//   balanceSign : +1 for both (sale raises receivable, purchase raises payable)
// Every mutation runs in a single transaction, and edits/deletes REVERSE the
// prior stock/balance effect before re-applying — never a blind wipe.
function createInvoiceRepo(config) {
  const {
    table, lineTable, prefix, partyKey, partyTable, partyLabel,
    stockSign, balanceSign, extraHeaderColumns = [],
  } = config;

  const headerColumns = ['invoice_no', 'invoice_date', partyKey, ...extraHeaderColumns, 'status', 'notes'];
  const totalColumns = ['subtotal', 'discount', 'total'];
  const insertColumns = [...headerColumns, ...totalColumns];

  const insertHeaderSql = `INSERT INTO ${table} (${insertColumns.join(', ')}) VALUES (${insertColumns
    .map((c) => '@' + c)
    .join(', ')})`;
  const updateHeaderSql = `UPDATE ${table} SET ${insertColumns
    .map((c) => `${c} = @${c}`)
    .join(', ')}, updated_at = datetime('now') WHERE id = @id`;

  function nextNumber() {
    const row = getDb().prepare(`SELECT invoice_no FROM ${table} ORDER BY id DESC LIMIT 1`).get();
    return computeNextNumber(prefix, row && row.invoice_no);
  }

  function normalizeLines(rawLines) {
    const lines = (rawLines || []).map((l) => {
      const unit_price = toNumber(l.unit_price, 0);
      const quantity = toNumber(l.quantity, 0);
      const discount = toNumber(l.discount, 0);
      const line_total = round2(unit_price * quantity - discount);
      return { item_id: l.item_id, unit_price, quantity, discount, line_total };
    });
    return lines;
  }

  function computeTotals(lines) {
    let subtotal = 0;
    let discount = 0;
    for (const l of lines) {
      subtotal += l.unit_price * l.quantity;
      discount += l.discount;
    }
    subtotal = round2(subtotal);
    discount = round2(discount);
    return { subtotal, discount, total: round2(subtotal - discount) };
  }

  function validate(header, lines) {
    if (!header[partyKey]) throw new ValidationError(`يجب اختيار ${partyLabel}`);
    if (!lines.length) throw new ValidationError('يجب إضافة صنف واحد على الأقل');
    for (const l of lines) {
      if (!l.item_id) throw new ValidationError('يجب اختيار الصنف في كل سطر');
      if (l.quantity <= 0) throw new ValidationError('الكمية يجب أن تكون أكبر من صفر');
      if (l.unit_price < 0) throw new ValidationError('السعر لا يمكن أن يكون سالبًا');
    }
  }

  function adjustStock(db, itemId, delta) {
    const item = db.prepare('SELECT stock_qty FROM items WHERE id = ?').get(itemId);
    if (!item) throw new NotFoundError('الصنف غير موجود');
    const newQty = round2(item.stock_qty + delta);
    if (newQty < 0) throw new ValidationError('الكمية المطلوبة تتجاوز المخزون المتاح');
    db.prepare("UPDATE items SET stock_qty = ?, updated_at = datetime('now') WHERE id = ?").run(newQty, itemId);
  }

  function adjustBalance(db, partyId, delta) {
    if (!partyId) return;
    const party = db.prepare(`SELECT balance FROM ${partyTable} WHERE id = ?`).get(partyId);
    if (!party) throw new NotFoundError(`${partyLabel} غير موجود`);
    const newBalance = round2(party.balance + delta);
    db.prepare(`UPDATE ${partyTable} SET balance = ?, updated_at = datetime('now') WHERE id = ?`).run(newBalance, partyId);
  }

  function applyEffects(db, header, lines, sign) {
    for (const l of lines) adjustStock(db, l.item_id, sign * stockSign * l.quantity);
    adjustBalance(db, header[partyKey], sign * balanceSign * header.total);
  }

  function insertLines(db, invoiceId, lines) {
    const stmt = db.prepare(
      `INSERT INTO ${lineTable} (invoice_id, item_id, unit_price, quantity, discount, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const l of lines) stmt.run(invoiceId, l.item_id, l.unit_price, l.quantity, l.discount, l.line_total);
  }

  function readHeader(id) {
    const header = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!header) throw new NotFoundError('الفاتورة غير موجودة');
    return header;
  }

  function readLines(id) {
    return getDb()
      .prepare(
        `SELECT li.*, it.name AS item_name, it.code AS item_code
         FROM ${lineTable} li JOIN items it ON it.id = li.item_id
         WHERE li.invoice_id = ? ORDER BY li.id`
      )
      .all(id);
  }

  const repo = {
    nextNumber,

    list() {
      return getDb()
        .prepare(
          `SELECT h.*, p.name AS party_name
           FROM ${table} h LEFT JOIN ${partyTable} p ON p.id = h.${partyKey}
           ORDER BY h.id DESC`
        )
        .all();
    },

    get(id) {
      const header = readHeader(id);
      const party = header[partyKey]
        ? getDb().prepare(`SELECT * FROM ${partyTable} WHERE id = ?`).get(header[partyKey])
        : null;
      return { ...header, party, lines: readLines(id) };
    },

    search(term) {
      if (!term) return repo.list();
      return getDb()
        .prepare(
          `SELECT h.*, p.name AS party_name
           FROM ${table} h LEFT JOIN ${partyTable} p ON p.id = h.${partyKey}
           WHERE h.invoice_no LIKE @like OR p.name LIKE @like
           ORDER BY h.id DESC`
        )
        .all({ like: `%${term}%` });
    },

    create(payload) {
      const db = getDb();
      const tx = db.transaction(() => {
        const lines = normalizeLines(payload.lines);
        const header = buildHeader(payload, lines);
        validate(header, lines);
        if (!header.invoice_no) header.invoice_no = nextNumber();
        const info = db.prepare(insertHeaderSql).run(header);
        const invoiceId = info.lastInsertRowid;
        insertLines(db, invoiceId, lines);
        applyEffects(db, header, lines, +1);
        return invoiceId;
      });
      return repo.get(tx());
    },

    update(id, payload) {
      const db = getDb();
      const tx = db.transaction(() => {
        const old = readHeader(id);
        const oldLines = readLines(id);
        applyEffects(db, old, oldLines, -1); // reverse prior effect
        const lines = normalizeLines(payload.lines);
        const header = buildHeader(payload, lines);
        header.invoice_no = payload.invoice_no || old.invoice_no;
        validate(header, lines);
        header.id = id;
        db.prepare(`DELETE FROM ${lineTable} WHERE invoice_id = ?`).run(id);
        db.prepare(updateHeaderSql).run(header);
        insertLines(db, id, lines);
        applyEffects(db, header, lines, +1);
        return id;
      });
      return repo.get(tx());
    },

    save(payload) {
      return payload && payload.id ? repo.update(payload.id, payload) : repo.create(payload);
    },

    remove(id) {
      const db = getDb();
      const tx = db.transaction(() => {
        const header = readHeader(id);
        const lines = readLines(id);
        applyEffects(db, header, lines, -1); // reverse before deleting
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id); // lines cascade
      });
      tx();
      return { deleted: 1 };
    },
  };

  // Assemble the persisted header row from the incoming payload + computed totals.
  function buildHeader(payload, lines) {
    const header = {};
    for (const c of headerColumns) header[c] = payload[c] === undefined || payload[c] === '' ? null : payload[c];
    header.invoice_date = payload.invoice_date || new Date().toISOString().slice(0, 10);
    if (payload.status === undefined || payload.status === null || payload.status === '') header.status = 'confirmed';
    Object.assign(header, computeTotals(lines));
    return header;
  }

  return repo;
}

module.exports = { createInvoiceRepo };

