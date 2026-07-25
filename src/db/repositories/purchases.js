'use strict';

const { createInvoiceRepo } = require('./_invoice');

// Purchase invoices (المشتريات): stock arrives (+1), supplier payable rises (+1).
module.exports = createInvoiceRepo({
  table: 'purchase_invoices',
  lineTable: 'purchase_invoice_items',
  prefix: 'PUR',
  partyKey: 'supplier_id',
  partyTable: 'suppliers',
  partyLabel: 'المورد',
  stockSign: +1,
  balanceSign: +1,
  extraHeaderColumns: ['warehouse_id', 'payment_method'],
});

