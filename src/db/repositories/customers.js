'use strict';

const { createCrudRepo } = require('../crud');
const { requireText, requireNonNegative } = require('../util');

// Customers (العملاء). balance holds the running receivable and is normally
// driven by sales/returns; it is editable here only to set an opening balance.
module.exports = createCrudRepo({
  table: 'customers',
  columns: [
    'code', 'name', 'phone', 'phone2', 'email', 'address', 'region',
    'customer_type', 'sales_rep', 'credit_limit', 'balance', 'status', 'notes',
  ],
  searchColumns: ['code', 'name', 'phone', 'phone2', 'email', 'region'],
  defaults: { credit_limit: 0, balance: 0, status: 'active' },
  validate(data) {
    requireText(data.name, 'اسم العميل');
    requireNonNegative(data.credit_limit, 'حد الائتمان');
  },
});

