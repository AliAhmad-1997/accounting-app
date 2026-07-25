'use strict';

const { createCrudRepo } = require('../crud');
const { requireText } = require('../util');

// Warehouses (المخازن).
module.exports = createCrudRepo({
  table: 'warehouses',
  columns: ['code', 'name', 'location', 'manager', 'phone', 'status', 'notes'],
  searchColumns: ['code', 'name', 'location', 'manager', 'phone'],
  defaults: { status: 'active' },
  validate(data) {
    requireText(data.name, 'اسم المخزن');
  },
});

