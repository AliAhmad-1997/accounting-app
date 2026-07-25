'use strict';

const { getDb } = require('../connection');
const { ValidationError } = require('../errors');
const { round2 } = require('../util');

// Report types offered in the نوع التقرير dropdown.
const TYPES = [
  { value: 'sales', label: 'تقرير المبيعات (حسب التاريخ)' },
  { value: 'purchases', label: 'تقرير المشتريات (حسب التاريخ)' },
  { value: 'sales_returns', label: 'تقرير مردود المبيعات' },
  { value: 'purchase_returns', label: 'تقرير مردود المشتريات' },
  { value: 'inventory', label: 'تقرير المخزون' },
  { value: 'low_stock', label: 'الأصناف تحت حد إعادة الطلب' },
  { value: 'customer_balances', label: 'أرصدة العملاء' },
  { value: 'supplier_balances', label: 'أرصدة الموردين' },
];

function types() {
  return TYPES;
}

function range(params) {
  return {
    from: (params && params.from) || '0000-01-01',
    to: (params && params.to) || '9999-12-31',
  };
}

function sum(rows, key) {
  return round2(rows.reduce((s, r) => s + (r[key] || 0), 0));
}

function invoiceReport({ table, partyTable, partyKey, partyLabel, title }, params) {
  const p = range(params);
  const rows = getDb()
    .prepare(
      `SELECT h.invoice_no, h.invoice_date, COALESCE(pt.name, '-') AS party, h.subtotal, h.discount, h.total
       FROM ${table} h LEFT JOIN ${partyTable} pt ON pt.id = h.${partyKey}
       WHERE h.invoice_date BETWEEN @from AND @to
       ORDER BY h.invoice_date, h.id`
    )
    .all(p);
  return {
    title: `${title} (${p.from} ← ${p.to})`,
    columns: [
      { key: 'invoice_no', label: 'رقم الفاتورة' },
      { key: 'invoice_date', label: 'التاريخ' },
      { key: 'party', label: partyLabel },
      { key: 'subtotal', label: 'الإجمالي' },
      { key: 'discount', label: 'الخصم' },
      { key: 'total', label: 'الصافي' },
    ],
    rows,
    summary: `عدد الفواتير: ${rows.length}  |  الصافي الإجمالي: ${sum(rows, 'total')}`,
  };
}

function returnReport({ table, partyTable, partyKey, originalTable, partyLabel, title }, params) {
  const p = range(params);
  const rows = getDb()
    .prepare(
      `SELECT r.return_no, r.return_date, o.invoice_no AS original_no, COALESCE(pt.name, '-') AS party, r.total
       FROM ${table} r
       LEFT JOIN ${partyTable} pt ON pt.id = r.${partyKey}
       LEFT JOIN ${originalTable} o ON o.id = r.original_invoice_id
       WHERE r.return_date BETWEEN @from AND @to
       ORDER BY r.return_date, r.id`
    )
    .all(p);
  return {
    title: `${title} (${p.from} ← ${p.to})`,
    columns: [
      { key: 'return_no', label: 'رقم المردود' },
      { key: 'return_date', label: 'التاريخ' },
      { key: 'original_no', label: 'الفاتورة الأصلية' },
      { key: 'party', label: partyLabel },
      { key: 'total', label: 'القيمة' },
    ],
    rows,
    summary: `عدد المردودات: ${rows.length}  |  إجمالي القيمة: ${sum(rows, 'total')}`,
  };
}

function inventoryReport() {
  const rows = getDb()
    .prepare(
      `SELECT it.code, it.name, w.name AS warehouse, it.stock_qty, it.cost_price,
              ROUND(it.stock_qty * it.cost_price, 2) AS stock_value, it.reorder_point
       FROM items it LEFT JOIN warehouses w ON w.id = it.warehouse_id
       ORDER BY it.name`
    )
    .all();
  return {
    title: 'تقرير المخزون الحالي',
    columns: [
      { key: 'code', label: 'الكود' },
      { key: 'name', label: 'الصنف' },
      { key: 'warehouse', label: 'المخزن' },
      { key: 'stock_qty', label: 'الكمية' },
      { key: 'cost_price', label: 'سعر التكلفة' },
      { key: 'stock_value', label: 'قيمة المخزون' },
    ],
    rows,
    summary: `عدد الأصناف: ${rows.length}  |  إجمالي قيمة المخزون: ${sum(rows, 'stock_value')}`,
  };
}

function lowStockReport() {
  const rows = getDb()
    .prepare(
      `SELECT code, name, stock_qty, reorder_point
       FROM items WHERE stock_qty <= reorder_point ORDER BY stock_qty`
    )
    .all();
  return {
    title: 'الأصناف تحت حد إعادة الطلب',
    columns: [
      { key: 'code', label: 'الكود' },
      { key: 'name', label: 'الصنف' },
      { key: 'stock_qty', label: 'الكمية الحالية' },
      { key: 'reorder_point', label: 'حد إعادة الطلب' },
    ],
    rows,
    summary: `عدد الأصناف التي تحتاج إعادة طلب: ${rows.length}`,
  };
}

function balanceReport({ table, title, label }) {
  const rows = getDb()
    .prepare(`SELECT code, name, phone, balance FROM ${table} WHERE balance <> 0 ORDER BY balance DESC`)
    .all();
  return {
    title,
    columns: [
      { key: 'code', label: 'الكود' },
      { key: 'name', label: label },
      { key: 'phone', label: 'الهاتف' },
      { key: 'balance', label: 'الرصيد' },
    ],
    rows,
    summary: `عدد السجلات: ${rows.length}  |  إجمالي الأرصدة: ${sum(rows, 'balance')}`,
  };
}

// Single entry point used by the Reports screen.
function run(type, params) {
  switch (type) {
    case 'sales':
      return invoiceReport({ table: 'sales_invoices', partyTable: 'customers', partyKey: 'customer_id', partyLabel: 'العميل', title: 'تقرير المبيعات' }, params);
    case 'purchases':
      return invoiceReport({ table: 'purchase_invoices', partyTable: 'suppliers', partyKey: 'supplier_id', partyLabel: 'المورد', title: 'تقرير المشتريات' }, params);
    case 'sales_returns':
      return returnReport({ table: 'sales_returns', partyTable: 'customers', partyKey: 'customer_id', originalTable: 'sales_invoices', partyLabel: 'العميل', title: 'تقرير مردود المبيعات' }, params);
    case 'purchase_returns':
      return returnReport({ table: 'purchase_returns', partyTable: 'suppliers', partyKey: 'supplier_id', originalTable: 'purchase_invoices', partyLabel: 'المورد', title: 'تقرير مردود المشتريات' }, params);
    case 'inventory':
      return inventoryReport();
    case 'low_stock':
      return lowStockReport();
    case 'customer_balances':
      return balanceReport({ table: 'customers', title: 'أرصدة العملاء', label: 'العميل' });
    case 'supplier_balances':
      return balanceReport({ table: 'suppliers', title: 'أرصدة الموردين', label: 'المورد' });
    default:
      throw new ValidationError('نوع التقرير غير معروف');
  }
}

module.exports = { types, run };

