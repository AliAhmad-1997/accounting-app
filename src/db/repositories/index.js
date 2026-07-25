'use strict';

// Central registry of data-access repositories. The IPC layer dispatches
// renderer requests through this map — an entity/action not present here is
// simply rejected, so the renderer can never reach arbitrary code.
module.exports = {
  customers: require('./customers'),
  suppliers: require('./suppliers'),
  warehouses: require('./warehouses'),
  items: require('./items'),
  sales: require('./sales'),
  purchases: require('./purchases'),
  salesReturns: require('./salesReturns'),
  purchaseReturns: require('./purchaseReturns'),
  reports: require('./reports'),
  lookups: require('./lookups'),
  users: require('./users'),
};

