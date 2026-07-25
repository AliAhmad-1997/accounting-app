'use strict';

const { createCrudRepo } = require('../crud');
const { requireText } = require('../util');

// Suppliers (الموردين). balance holds the running payable.
module.exports = createCrudRepo({
  table: 'suppliers',
  columns: [
    'code', 'name', 'contact_person', 'phone', 'email', 'address',
    'balance', 'status', 'notes',
  ],
  searchColumns: ['code', 'name', 'contact_person', 'phone', 'email'],
  defaults: { balance: 0, status: 'active' },
  validate(data) {
    requireText(data.name, 'اسم المورد');
  },
});

