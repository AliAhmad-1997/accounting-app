'use strict';

// Modern line-style icons rendered with currentColor so they inherit the
// navy/gold palette in the sidebar and the accent colour in decorative panels.
(function () {
  const svg = (body, vb) =>
    `<svg viewBox="0 0 ${vb || 24} ${vb || 24}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  const ICONS = {
    customers: svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15 19a4.5 4.5 0 0 1 6.5-4"/>'),
    items: svg('<path d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
    warehouses: svg('<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5z"/><path d="M7 21v-6h10v6M7 15h10"/>'),
    suppliers: svg('<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5H18l3 3v3h-7.5"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    sales: svg('<path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>'),
    purchases: svg('<path d="M6 8V7a4 4 0 0 1 8 0v1"/><path d="M4.5 8h13l1 12H3.5l1-12z"/>'),
    salesReturns: svg('<path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L20 8H6"/><path d="M15 4.5 12.5 7 15 9.5M12.7 7H16a3 3 0 0 1 0 6"/>'),
    purchaseReturns: svg('<path d="M4.5 8h13l1 12H3.5l1-12z"/><path d="M6 8V7a4 4 0 0 1 8 0v1"/><path d="M10 13.5 8 15.5l2 2M8 15.5h4a3 3 0 0 1 0 0"/>'),
    reports: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 16v-3M12 16v-6M16 16v-4"/>'),
    exit: svg('<path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"/><path d="M18 12H9M15 8.5 18.5 12 15 15.5"/>'),
    user: svg('<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    lock: svg('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/><circle cx="12" cy="15" r="1.3"/>'),
    logo: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 13h5M7 16h8"/><circle cx="16.5" cy="12.7" r="1.4"/>'),
  };

  window.ICONS = ICONS;
  window.icon = (name) => ICONS[name] || '';
})();

