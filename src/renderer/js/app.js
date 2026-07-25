'use strict';

// Main application shell: builds the navy sidebar, wires navigation to the
// screen builders in window.PAGES, and manages the top bar title. Lookups are
// refetched on every navigation so newly-added master data shows up in the
// foreign-key dropdowns without a reload.
(function () {
  const { el, clear, call, toast } = window.UI;

  // In browser preview mode the main window is a normal page, so guard it:
  // without a stored session, bounce back to the login screen.
  if (window.api && window.api.isHttp && !sessionStorage.getItem('auth_user')) {
    window.location.href = 'login.html';
    return;
  }

  const NAV = [
    { id: 'dashboard', label: 'الرئيسية', icon: 'reports', title: 'النظام الرئيسي لإدارة المبيعات والمخازن' },
    { id: 'customers', label: 'العملاء', icon: 'customers', title: 'إدارة العملاء' },
    { id: 'items', label: 'الأصناف', icon: 'items', title: 'إدارة الأصناف' },
    { id: 'warehouses', label: 'المخازن', icon: 'warehouses', title: 'إدارة المخازن' },
    { id: 'suppliers', label: 'الموردين', icon: 'suppliers', title: 'إدارة الموردين' },
    { id: 'sales', label: 'المبيعات', icon: 'sales', title: 'فاتورة مبيعات' },
    { id: 'purchases', label: 'المشتريات', icon: 'purchases', title: 'فاتورة مشتريات' },
    { id: 'salesReturns', label: 'مردود المبيعات', icon: 'salesReturns', title: 'مردود المبيعات' },
    { id: 'purchaseReturns', label: 'مردود المشتريات', icon: 'purchaseReturns', title: 'مردود المشتريات' },
    { id: 'reports', label: 'التقارير', icon: 'reports', title: 'التقارير' },
  ];

  const nav = document.getElementById('nav');
  const content = document.getElementById('content');
  const topbar = document.getElementById('topbar');
  const navItems = {};

  async function route(entry) {
    for (const id in navItems) navItems[id].classList.toggle('active', id === entry.id);
    topbar.textContent = entry.title;
    clear(content);
    let lookups = {};
    try {
      lookups = await call('lookups', 'all');
    } catch (err) {
      toast(err.message, 'err');
    }
    const build = window.PAGES[entry.id];
    if (build) build(content, lookups);
  }

  for (const entry of NAV) {
    const item = el('button', { class: 'nav-item' }, [
      el('span', { class: 'nav-icon', html: window.icon(entry.icon) }),
      el('span', { class: 'nav-label', text: entry.label }),
    ]);
    item.addEventListener('click', () => route(entry));
    navItems[entry.id] = item;
    nav.appendChild(item);
  }

  const exitBtn = document.getElementById('exitBtn');
  exitBtn.appendChild(el('span', { class: 'nav-icon', html: window.icon('exit') }));
  exitBtn.appendChild(el('span', { text: 'خروج' }));
  exitBtn.addEventListener('click', () => window.api.app.logout());

  route(NAV[0]);
})();

