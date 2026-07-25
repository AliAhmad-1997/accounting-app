'use strict';

const { getDb } = require('./connection');
const { ValidationError, NotFoundError } = require('./errors');

// Factory that builds a standard master-data repository backed by a single
// table with an integer primary key and an updated_at column. Callers supply
// the writable column list, the searchable columns, per-column defaults and an
// optional validate(data) hook. Writes are proper INSERT / UPDATE / DELETE by
// id — never a delete-and-reinsert-everything pattern.
function createCrudRepo({ table, columns, searchColumns = [], defaults = {}, validate }) {
  const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns
    .map((c) => '@' + c)
    .join(', ')})`;
  const updateSql = `UPDATE ${table} SET ${columns
    .map((c) => `${c} = @${c}`)
    .join(', ')}, updated_at = datetime('now') WHERE id = @id`;

  function pick(data) {
    const row = {};
    for (const c of columns) {
      const value = data[c];
      row[c] = value === undefined || value === '' ? defaults[c] ?? null : value;
    }
    return row;
  }

  const repo = {
    list() {
      return getDb().prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    },

    get(id) {
      const row = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
      if (!row) throw new NotFoundError('السجل غير موجود');
      return row;
    },

    create(data) {
      if (validate) validate(data);
      const info = getDb().prepare(insertSql).run(pick(data));
      return repo.get(info.lastInsertRowid);
    },

    update(id, data) {
      if (!id) throw new ValidationError('معرّف السجل مطلوب للتعديل');
      repo.get(id); // throws NotFoundError if missing
      if (validate) validate(data);
      const row = pick(data);
      row.id = id;
      getDb().prepare(updateSql).run(row);
      return repo.get(id);
    },

    // Upsert helper used by the UI Save button: create when no id, else update.
    save(data) {
      const id = data && data.id;
      return id ? repo.update(id, data) : repo.create(data);
    },

    remove(id) {
      if (!id) throw new ValidationError('معرّف السجل مطلوب للحذف');
      const info = getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      if (info.changes === 0) throw new NotFoundError('السجل غير موجود');
      return { deleted: info.changes };
    },

    search(term) {
      if (!term || !searchColumns.length) return repo.list();
      const where = searchColumns.map((c) => `${c} LIKE @like`).join(' OR ');
      return getDb()
        .prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY id DESC`)
        .all({ like: `%${term}%` });
    },
  };

  return repo;
}

module.exports = { createCrudRepo };

