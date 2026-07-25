'use strict';

const { createReturnRepo } = require('./_returns');

// Sales returns (مردود المبيعات): goods return to stock (+1), customer receivable falls.
module.exports = createReturnRepo({
  table: 'sales_returns',
  lineTable: 'sales_return_items',
  prefix: 'SRET',
  partyKey: 'customer_id',
  partyTable: 'customers',
  partyLabel: 'العميل',
  originalTable: 'sales_invoices',
  originalLineTable: 'sales_invoice_items',
  stockSign: +1,
});

