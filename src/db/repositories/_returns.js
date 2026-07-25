'use strict';

const { getDb } = require('../connection');
const { ValidationError, NotFoundError } = require('../errors');
const { computeNextNumber, toNumber, round2 } = require('../util');

// Shared engine for sales & purchase returns (مردود المبيعات / المشتريات).
// A return always references an original invoice, always REDUCES the party
// balance (balanceSign = -1) and moves stock opposite to that invoice:
//   sales return   -> stockSign +1 (goods come back in)
//   purchase return-> stockSign -1 (goods go back out, guarded vs. negative)
// Returned quantity per item can never exceed what remains returnable.
function createReturnRepo(config) {
  const {
    table, lineTable, prefix, partyKey, partyTable, partyLabel,
    originalTable, originalLineTable, stockSign, extraHeaderColumns = [],
  } = config;
  const balanceSign = -1;

  const headerColumns = ['return_no', 'return_date', 'original_invoice_id', partyKey, ...extraHeaderColumns, 'notes', 'total'];
  const insertHeaderSql = `INSERT INTO ${table} (${headerColumns.join(', ')}) VALUES (${headerColumns
    .map((c) => '@' + c)
    .join(', ')})`;
  const updateHeaderSql = `UPDATE ${table} SET ${headerColumns.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`;

  function nextNumber() {
    const row = getDb().prepare(`SELECT return_no FROM ${table} ORDER BY id DESC LIMIT 1`).get();
    return computeNextNumber(prefix, row && row.return_no);
  }

  function readOriginal(id) {
    const inv = getDb().prepare(`SELECT * FROM ${originalTable} WHERE id = ?`).get(id);
    if (!inv) throw new NotFoundError('الفاتورة الأصلية غير موجودة');
    return inv;
  }

  function soldQty(originalId, itemId) {
    return getDb()
      .prepare(`SELECT COALESCE(SUM(quantity), 0) AS q FROM ${originalLineTable} WHERE invoice_id = ? AND item_id = ?`)
      .get(originalId, itemId).q;
  }

  function returnedQty(originalId, itemId, excludeReturnId) {
    const exclude = excludeReturnId ? ` AND r.id <> ${Number(excludeReturnId)}` : '';
    return getDb()
      .prepare(
        `SELECT COALESCE(SUM(li.quantity), 0) AS q
         FROM ${lineTable} li JOIN ${table} r ON r.id = li.return_id
         WHERE r.original_invoice_id = ? AND li.item_id = ?${exclude}`
      )
      .get(originalId, itemId).q;
  }

  function normalizeLines(rawLines) {
    return (rawLines || [])
      .filter((l) => l.item_id && toNumber(l.quantity, 0) > 0)
      .map((l) => {
        const unit_price = toNumber(l.unit_price, 0);
        const quantity = toNumber(l.quantity, 0);
        return { item_id: l.item_id, unit_price, quantity, line_total: round2(unit_price * quantity) };
      });
  }

  function validate(originalId, lines, excludeReturnId) {
    if (!lines.length) throw new ValidationError('يجب تحديد صنف واحد على الأقل للمردود');
    for (const l of lines) {
      if (l.unit_price < 0) throw new ValidationError('السعر لا يمكن أن يكون سالبًا');
      const remaining = round2(soldQty(originalId, l.item_id) - returnedQty(originalId, l.item_id, excludeReturnId));
      if (l.quantity > remaining) {
        throw new ValidationError(`الكمية المرتجعة تتجاوز المتبقي (المتاح للإرجاع: ${remaining})`);
      }
    }
  }

  function adjustStock(db, itemId, delta) {
    const item = db.prepare('SELECT stock_qty FROM items WHERE id = ?').get(itemId);
    if (!item) throw new NotFoundError('الصنف غير موجود');
    const newQty = round2(item.stock_qty + delta);
    if (newQty < 0) throw new ValidationError('الكمية المرتجعة تتجاوز المخزون المتاح');
    db.prepare("UPDATE items SET stock_qty = ?, updated_at = datetime('now') WHERE id = ?").run(newQty, itemId);
  }

  function adjustBalance(db, partyId, delta) {
    if (!partyId) return;
    const party = db.prepare(`SELECT balance FROM ${partyTable} WHERE id = ?`).get(partyId);
    if (!party) return;
    db.prepare(`UPDATE ${partyTable} SET balance = ?, updated_at = datetime('now') WHERE id = ?`).run(round2(party.balance + delta), partyId);
  }

  function applyEffects(db, header, lines, sign) {
    for (const l of lines) adjustStock(db, l.item_id, sign * stockSign * l.quantity);
    adjustBalance(db, header[partyKey], sign * balanceSign * header.total);
  }

  function insertLines(db, returnId, lines) {
    const stmt = db.prepare(
      `INSERT INTO ${lineTable} (return_id, item_id, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?)`
    );
    for (const l of lines) stmt.run(returnId, l.item_id, l.unit_price, l.quantity, l.line_total);
  }

  function readHeader(id) {
    const header = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!header) throw new NotFoundError('المردود غير موجود');
    return header;
  }

  function readLines(id) {
    return getDb()
      .prepare(
        `SELECT li.*, it.name AS item_name, it.code AS item_code
         FROM ${lineTable} li JOIN items it ON it.id = li.item_id
         WHERE li.return_id = ? ORDER BY li.id`
      )
      .all(id);
  }

  function buildHeader(payload, original, lines) {
    const header = {
      return_no: payload.return_no || null,
      return_date: payload.return_date || new Date().toISOString().slice(0, 10),
      original_invoice_id: original.id,
      notes: payload.notes || null,
      total: round2(lines.reduce((sum, l) => sum + l.line_total, 0)),
    };
    header[partyKey] = original[partyKey];
    for (const c of extraHeaderColumns) header[c] = original[c] ?? null;
    return header;
  }

  const repo = {
    nextNumber,

    list() {
      return getDb()
        .prepare(
          `SELECT r.*, p.name AS party_name, o.invoice_no AS original_no
           FROM ${table} r
           LEFT JOIN ${partyTable} p ON p.id = r.${partyKey}
           LEFT JOIN ${originalTable} o ON o.id = r.original_invoice_id
           ORDER BY r.id DESC`
        )
        .all();
    },

    get(id) {
      const header = readHeader(id);
      const original = getDb().prepare(`SELECT invoice_no FROM ${originalTable} WHERE id = ?`).get(header.original_invoice_id);
      const party = header[partyKey] ? getDb().prepare(`SELECT * FROM ${partyTable} WHERE id = ?`).get(header[partyKey]) : null;
      return { ...header, original_no: original && original.invoice_no, party, lines: readLines(id) };
    },

    search(term) {
      if (!term) return repo.list();
      return getDb()
        .prepare(
          `SELECT r.*, p.name AS party_name, o.invoice_no AS original_no
           FROM ${table} r
           LEFT JOIN ${partyTable} p ON p.id = r.${partyKey}
           LEFT JOIN ${originalTable} o ON o.id = r.original_invoice_id
           WHERE r.return_no LIKE @like OR o.invoice_no LIKE @like OR p.name LIKE @like
           ORDER BY r.id DESC`
        )
        .all({ like: `%${term}%` });
    },

    // List candidate original invoices the user can build a return from.
    listSources(term) {
      const like = `%${term || ''}%`;
      return getDb()
        .prepare(
          `SELECT o.id, o.invoice_no, o.invoice_date, o.total, p.name AS party_name
           FROM ${originalTable} o LEFT JOIN ${partyTable} p ON p.id = o.${partyKey}
           WHERE o.invoice_no LIKE @like OR p.name LIKE @like
           ORDER BY o.id DESC LIMIT 100`
        )
        .all({ like });
    },

    // Detail of an original invoice with per-item returnable remainder.
    sourceDetail(originalInvoiceId) {
      const header = readOriginal(originalInvoiceId);
      const party = header[partyKey] ? getDb().prepare(`SELECT name FROM ${partyTable} WHERE id = ?`).get(header[partyKey]) : null;
      const rows = getDb()
        .prepare(
          `SELECT li.item_id, it.name AS item_name, it.code AS item_code, li.unit_price, li.quantity
           FROM ${originalLineTable} li JOIN items it ON it.id = li.item_id
           WHERE li.invoice_id = ? ORDER BY li.id`
        )
        .all(originalInvoiceId);
      const byItem = new Map();
      for (const r of rows) {
        const acc = byItem.get(r.item_id) || { item_id: r.item_id, item_name: r.item_name, item_code: r.item_code, unit_price: r.unit_price, sold: 0 };
        acc.sold = round2(acc.sold + r.quantity);
        acc.unit_price = r.unit_price;
        byItem.set(r.item_id, acc);
      }
      const lines = [...byItem.values()].map((a) => {
        const returned = returnedQty(originalInvoiceId, a.item_id);
        return { ...a, returned, remaining: round2(a.sold - returned) };
      });
      return {
        id: header.id,
        invoice_no: header.invoice_no,
        invoice_date: header.invoice_date,
        party_name: party && party.name,
        lines,
      };
    },

    create(payload) {
      const db = getDb();
      const tx = db.transaction(() => {
        const original = readOriginal(payload.original_invoice_id);
        const lines = normalizeLines(payload.lines);
        validate(original.id, lines, null);
        const header = buildHeader(payload, original, lines);
        if (!header.return_no) header.return_no = nextNumber();
        const info = db.prepare(insertHeaderSql).run(header);
        const returnId = info.lastInsertRowid;
        insertLines(db, returnId, lines);
        applyEffects(db, header, lines, +1);
        return returnId;
      });
      return repo.get(tx());
    },

    update(id, payload) {
      const db = getDb();
      const tx = db.transaction(() => {
        const old = readHeader(id);
        const oldLines = readLines(id);
        applyEffects(db, old, oldLines, -1);
        const original = readOriginal(payload.original_invoice_id || old.original_invoice_id);
        const lines = normalizeLines(payload.lines);
        validate(original.id, lines, id);
        const header = buildHeader(payload, original, lines);
        header.return_no = payload.return_no || old.return_no;
        header.id = id;
        db.prepare(`DELETE FROM ${lineTable} WHERE return_id = ?`).run(id);
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
        applyEffects(db, header, lines, -1);
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      });
      tx();
      return { deleted: 1 };
    },
  };

  return repo;
}

module.exports = { createReturnRepo };

