'use strict';

const { createReturnRepo } = require('./_returns');

// Purchase returns (مردود المشتريات): goods leave stock (-1), supplier payable falls.
module.exports = createReturnRepo({
  table: 'purchase_returns',
  lineTable: 'purchase_return_items',
  prefix: 'PRET',
  partyKey: 'supplier_id',
  partyTable: 'suppliers',
  partyLabel: 'المورد',
  originalTable: 'purchase_invoices',
  originalLineTable: 'purchase_invoice_items',
  stockSign: -1,
  extraHeaderColumns: ['warehouse_id'],
});

