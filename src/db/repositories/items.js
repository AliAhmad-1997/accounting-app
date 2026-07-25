'use strict';

const { createCrudRepo } = require('../crud');
const { requireText, requireNonNegative } = require('../util');

// Items / products (الأصناف). Numeric fields are guarded against negatives;
// stock_qty is thereafter maintained by sales/purchases/returns transactions.
module.exports = createCrudRepo({
  table: 'items',
  columns: [
    'code', 'name', 'barcode', 'category_id', 'unit_id', 'warehouse_id',
    'supplier_id', 'cost_price', 'sale_price', 'stock_qty', 'reorder_point',
    'default_discount', 'status', 'notes',
  ],
  searchColumns: ['code', 'name', 'barcode'],
  defaults: {
    cost_price: 0, sale_price: 0, stock_qty: 0, reorder_point: 0,
    default_discount: 0, status: 'active',
  },
  validate(data) {
    requireText(data.name, 'اسم الصنف');
    requireNonNegative(data.cost_price, 'سعر الشراء');
    requireNonNegative(data.sale_price, 'سعر البيع');
    requireNonNegative(data.stock_qty, 'الكمية بالمخزون');
    requireNonNegative(data.reorder_point, 'حد إعادة الطلب');
    requireNonNegative(data.default_discount, 'الخصم الافتراضي');
  },
});

