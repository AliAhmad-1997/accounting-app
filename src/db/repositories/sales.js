'use strict';

const { createInvoiceRepo } = require('./_invoice');

// Sales invoices (المبيعات): stock leaves (-1), customer receivable rises (+1).
module.exports = createInvoiceRepo({
  table: 'sales_invoices',
  lineTable: 'sales_invoice_items',
  prefix: 'SAL',
  partyKey: 'customer_id',
  partyTable: 'customers',
  partyLabel: 'العميل',
  stockSign: -1,
  balanceSign: +1,
  extraHeaderColumns: ['payment_method'],
});

