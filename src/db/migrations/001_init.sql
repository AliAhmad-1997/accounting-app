-- 001_init.sql : initial normalised schema for the sales & warehouse system.
-- All monetary/quantity columns are REAL. All relationships are by integer id
-- (foreign keys), never by name string.

-- ---------------------------------------------------------------------------
-- Authentication
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- bcrypt hash, never plaintext/base64
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS units (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT UNIQUE,
  name          TEXT NOT NULL,
  phone         TEXT,
  phone2        TEXT,
  email         TEXT,
  address       TEXT,
  region        TEXT,
  customer_type TEXT,
  sales_rep     TEXT,
  credit_limit  REAL NOT NULL DEFAULT 0,
  balance       REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT UNIQUE,
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  balance        REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warehouses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT UNIQUE,
  name       TEXT NOT NULL,
  location   TEXT,
  manager    TEXT,
  phone      TEXT,
  status     TEXT NOT NULL DEFAULT 'active',
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT UNIQUE,
  name             TEXT NOT NULL,
  barcode          TEXT,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit_id          INTEGER REFERENCES units(id) ON DELETE SET NULL,
  warehouse_id     INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  supplier_id      INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  cost_price       REAL NOT NULL DEFAULT 0,
  sale_price       REAL NOT NULL DEFAULT 0,
  stock_qty        REAL NOT NULL DEFAULT 0,
  reorder_point    REAL NOT NULL DEFAULT 0,
  default_discount REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_warehouse ON items(warehouse_id);

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT NOT NULL UNIQUE,
  invoice_date   TEXT NOT NULL DEFAULT (date('now')),
  customer_id    INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
  payment_method TEXT,
  status         TEXT NOT NULL DEFAULT 'confirmed',
  notes          TEXT,
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sales_invoice_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity   REAL NOT NULL DEFAULT 0,
  discount   REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sales_items_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON sales_invoices(invoice_date);

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT NOT NULL UNIQUE,
  invoice_date   TEXT NOT NULL DEFAULT (date('now')),
  supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
  warehouse_id   INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  payment_method TEXT,
  status         TEXT NOT NULL DEFAULT 'confirmed',
  notes          TEXT,
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity   REAL NOT NULL DEFAULT 0,
  discount   REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_date ON purchase_invoices(invoice_date);

-- ---------------------------------------------------------------------------
-- Sales returns (مردود المبيعات)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_returns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no           TEXT NOT NULL UNIQUE,
  return_date         TEXT NOT NULL DEFAULT (date('now')),
  original_invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  customer_id         INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
  notes               TEXT,
  total               REAL NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sales_return_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id  INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity   REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sales_return_items ON sales_return_items(return_id);

-- ---------------------------------------------------------------------------
-- Purchase returns (مردود المشتريات)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_returns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no           TEXT NOT NULL UNIQUE,
  return_date         TEXT NOT NULL DEFAULT (date('now')),
  original_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE RESTRICT,
  supplier_id         INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
  warehouse_id        INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  notes               TEXT,
  total               REAL NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id  INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity   REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items ON purchase_return_items(return_id);

