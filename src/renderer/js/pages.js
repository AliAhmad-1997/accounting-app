'use strict';

// All application screens. Each screen is a builder `build(container, lookups)`
// registered on window.PAGES by nav id. The master/document/return factories
// keep the New/Delete/Edit/Save/Search behaviour consistent everywhere.
(function () {
  const { el, call, toast, money, today, confirm } = window.UI;
  const W = window.W;

  const STATUS_OPTS = [
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'غير نشط' },
  ];

  // ================================================================ Master
  function masterPage({ entity, tabLabel, deco, fields, rowLabel }) {
    return function build(container, lookups) {
      const form = W.formCard({ tabLabel, deco, fields, lookups });
      let currentId = null;

      async function load(id) {
        try {
          const row = await call(entity, 'get', id);
          form.setValues(row);
          currentId = row.id;
          toast('تم تحميل السجل');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      function reset() {
        form.clear();
        currentId = null;
      }
      async function save() {
        try {
          const values = form.values();
          values.id = currentId;
          const saved = await call(entity, 'save', values);
          form.setValues(saved);
          currentId = saved.id;
          toast('تم الحفظ بنجاح', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      async function remove() {
        if (!currentId) return toast('اختر سجلاً أولاً للحذف', 'err');
        if (!confirm('هل تريد حذف هذا السجل؟')) return;
        try {
          await call(entity, 'remove', currentId);
          reset();
          toast('تم الحذف', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      }

      const drawer = W.recordDrawer({
        title: tabLabel,
        fetch: (term) => call(entity, 'search', term),
        renderRow: (row) => ({
          title: rowLabel ? rowLabel(row) : row.name,
          sub: [row.code, row.phone].filter(Boolean).join(' · '),
        }),
        onPick: (row) => load(row.id),
      });

      form.append(
        W.actionBar([
          { label: 'جديد', variant: 'ghost', onClick: reset },
          { label: 'حذف', variant: 'danger', onClick: remove },
          { label: 'تعديل', onClick: () => drawer.open() },
          { label: 'حفظ', onClick: save },
          { label: 'بحث', onClick: () => drawer.open() },
        ])
      );
      container.appendChild(form.root);
    };
  }

  // ================================================================ Document (sales / purchases)
  function documentPage({ entity, partyEntity, partyKey, partyWord, tabLabel, deco, priceField, extras }) {
    return function build(container, lookups) {
      const parties = lookups[partyEntity] || [];
      const headerFields = [
        { key: 'invoice_no', label: 'رقم الفاتورة', placeholder: 'يُولّد تلقائياً' },
        { key: 'invoice_date', label: 'التاريخ', type: 'date' },
        { key: partyKey, label: partyWord, type: 'fk', source: partyEntity, required: true },
        { key: 'party_phone', label: 'الهاتف', readonly: true },
        { key: 'party_address', label: 'العنوان', readonly: true },
        ...(extras || []),
        { key: 'notes', label: 'ملاحظات', type: 'textarea', span: true },
      ];
      const form = W.formCard({ tabLabel, deco, fields: headerFields, lookups });
      form.controls.invoice_date.set(today());
      let currentId = null;

      const partyInput = form.controls[partyKey].input;
      function syncParty() {
        const p = parties.find((x) => String(x.id) === partyInput.value);
        form.controls.party_phone.set(p ? p.phone : '');
        form.controls.party_address.set(p ? p.address : '');
      }
      partyInput.addEventListener('change', syncParty);

      const totalChip = el('span', { class: 'chip', text: 'الإجمالي: 0.00' });
      const editor = W.lineEditor({
        items: lookups.items,
        priceField,
        onChange: (t) => { totalChip.textContent = 'الإجمالي: ' + money(t); },
      });
      const addBtn = el('button', { class: 'btn ghost sm', text: '+ إضافة صنف', onclick: () => editor.addRow() });
      form.append(
        el('div', { style: 'margin-top:8px' }, [
          el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin:6px 0' }, [
            el('strong', { text: 'أصناف الفاتورة' }),
            addBtn,
          ]),
          editor.wrap,
          el('div', { class: 'totals' }, [totalChip]),
        ])
      );

      function reset() {
        form.clear();
        form.controls.invoice_date.set(today());
        editor.clearRows();
        editor.addRow();
        currentId = null;
      }
      async function load(id) {
        try {
          const doc = await call(entity, 'get', id);
          form.setValues(doc);
          syncParty();
          editor.setLines((doc.lines || []).map((l) => ({ item_id: l.item_id, unit_price: l.unit_price, quantity: l.quantity })));
          currentId = doc.id;
          toast('تم تحميل الفاتورة');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      async function save() {
        const v = form.values();
        if (!v[partyKey]) return toast('اختر ' + partyWord, 'err');
        const lines = editor.getLines();
        if (!lines.length) return toast('أضف صنفاً واحداً على الأقل', 'err');
        const payload = {
          id: currentId,
          invoice_no: v.invoice_no || undefined,
          invoice_date: v.invoice_date || today(),
          [partyKey]: v[partyKey],
          notes: v.notes || null,
          lines,
        };
        if ('warehouse_id' in v) payload.warehouse_id = v.warehouse_id;
        if ('payment_method' in v) payload.payment_method = v.payment_method;
        try {
          const saved = await call(entity, 'save', payload);
          currentId = saved.id;
          form.controls.invoice_no.set(saved.invoice_no);
          toast('تم حفظ الفاتورة بنجاح', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      async function remove() {
        if (!currentId) return toast('اختر فاتورة أولاً', 'err');
        if (!confirm('حذف الفاتورة سيعكس أثرها على المخزون والأرصدة. متابعة؟')) return;
        try {
          await call(entity, 'remove', currentId);
          reset();
          toast('تم الحذف', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      }

      const drawer = W.recordDrawer({
        title: tabLabel,
        fetch: (term) => call(entity, 'search', term),
        renderRow: (row) => ({
          title: row.invoice_no,
          sub: [row.invoice_date, row.party_name, 'إجمالي: ' + money(row.total)].filter(Boolean).join(' · '),
        }),
        onPick: (row) => load(row.id),
      });

      form.append(
        W.actionBar([
          { label: 'جديد', variant: 'ghost', onClick: reset },
          { label: 'حذف', variant: 'danger', onClick: remove },
          { label: 'عرض / تعديل', onClick: () => drawer.open() },
          { label: 'حفظ', onClick: save },
          { label: 'بحث', onClick: () => drawer.open() },
        ])
      );
      container.appendChild(form.root);
      editor.addRow();
    };
  }

  // ================================================================ Returns
  function returnPage({ entity, tabLabel, deco, partyWord }) {
    return function build(container, lookups) {
      const fields = [
        { key: 'return_no', label: 'رقم المردود', placeholder: 'يُولّد تلقائياً' },
        { key: 'return_date', label: 'التاريخ', type: 'date' },
        { key: 'original_no', label: 'الفاتورة الأصلية', readonly: true, placeholder: 'اختر فاتورة...' },
        { key: 'party_name', label: partyWord, readonly: true },
        { key: 'notes', label: 'ملاحظات', type: 'textarea', span: true },
      ];
      const form = W.formCard({ tabLabel, deco, fields, lookups });
      form.controls.return_date.set(today());
      let currentId = null;
      let originalId = null;

      const totalChip = el('span', { class: 'chip', text: 'قيمة المردود: 0.00' });
      const editor = W.lineEditor({
        items: lookups.items,
        priceField: 'sale_price',
        lockItems: true,
        onChange: (t) => { totalChip.textContent = 'قيمة المردود: ' + money(t); },
      });

      const sourceDrawer = W.recordDrawer({
        title: 'اختر الفاتورة الأصلية',
        fetch: (term) => call(entity, 'listSources', term),
        renderRow: (row) => ({
          title: row.invoice_no,
          sub: [row.invoice_date, row.party_name, 'إجمالي: ' + money(row.total)].filter(Boolean).join(' · '),
        }),
        onPick: (row) => loadOriginal(row.id),
      });

      async function loadOriginal(id) {
        try {
          const detail = await call(entity, 'sourceDetail', id);
          originalId = detail.id;
          form.controls.original_no.set(detail.invoice_no);
          form.controls.party_name.set(detail.party_name || '');
          const returnable = detail.lines
            .filter((l) => l.remaining > 0)
            .map((l) => ({ item_id: l.item_id, unit_price: l.unit_price, quantity: l.remaining }));
          editor.setLines(returnable);
          if (!returnable.length) toast('لا توجد كميات قابلة للإرجاع في هذه الفاتورة', 'err');
        } catch (err) {
          toast(err.message, 'err');
        }
      }

      function reset() {
        form.clear();
        form.controls.return_date.set(today());
        editor.clearRows();
        currentId = null;
        originalId = null;
      }
      async function load(id) {
        try {
          const r = await call(entity, 'get', id);
          form.clear();
          form.controls.return_no.set(r.return_no);
          form.controls.return_date.set(r.return_date);
          form.controls.original_no.set(r.original_no);
          form.controls.party_name.set(r.party ? r.party.name : '');
          form.controls.notes.set(r.notes);
          originalId = r.original_invoice_id;
          currentId = r.id;
          editor.setLines((r.lines || []).map((l) => ({ item_id: l.item_id, unit_price: l.unit_price, quantity: l.quantity })));
          toast('تم تحميل المردود');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      async function save() {
        if (!originalId) return toast('اختر الفاتورة الأصلية أولاً', 'err');
        const lines = editor.getLines();
        if (!lines.length) return toast('أدخل كمية مرتجعة واحدة على الأقل', 'err');
        const v = form.values();
        try {
          const saved = await call(entity, 'save', {
            id: currentId,
            original_invoice_id: originalId,
            return_date: v.return_date || today(),
            notes: v.notes || null,
            lines,
          });
          currentId = saved.id;
          form.controls.return_no.set(saved.return_no);
          toast('تم حفظ المردود بنجاح', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      async function remove() {
        if (!currentId) return toast('اختر مردوداً أولاً', 'err');
        if (!confirm('حذف المردود سيعكس أثره على المخزون والأرصدة. متابعة؟')) return;
        try {
          await call(entity, 'remove', currentId);
          reset();
          toast('تم الحذف', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      }

      const returnsDrawer = W.recordDrawer({
        title: tabLabel,
        fetch: (term) => call(entity, 'search', term),
        renderRow: (row) => ({
          title: row.return_no,
          sub: [row.return_date, row.original_no && 'أصل: ' + row.original_no, 'قيمة: ' + money(row.total)].filter(Boolean).join(' · '),
        }),
        onPick: (row) => load(row.id),
      });

      form.append(
        el('div', { style: 'margin-top:8px' }, [
          el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin:6px 0' }, [
            el('strong', { text: 'الأصناف المرتجعة' }),
            el('button', { class: 'btn gold sm', text: 'اختيار الفاتورة الأصلية', onclick: () => sourceDrawer.open() }),
          ]),
          editor.wrap,
          el('div', { class: 'totals' }, [totalChip]),
        ])
      );
      form.append(
        W.actionBar([
          { label: 'جديد', variant: 'ghost', onClick: reset },
          { label: 'حذف', variant: 'danger', onClick: remove },
          { label: 'عرض / تعديل', onClick: () => returnsDrawer.open() },
          { label: 'حفظ', onClick: save },
          { label: 'بحث', onClick: () => returnsDrawer.open() },
        ])
      );
      container.appendChild(form.root);
    };
  }

  // ================================================================ Reports
  function buildReports(container) {
    (async () => {
      const types = await call('reports', 'types');
      const typeSel = el('select');
      for (const t of types) typeSel.appendChild(el('option', { value: t.value, text: t.label }));
      const fromInp = el('input', { type: 'date' });
      const toInp = el('input', { type: 'date' });
      const output = el('div', { class: 'report-output' }, [el('div', { class: 'empty-state', text: 'اختر نوع التقرير ثم اضغط عرض' })]);

      function field(label, node) {
        return el('div', { class: 'field' }, [el('label', { text: label }), node]);
      }
      function renderReport(data) {
        window.UI.clear(output);
        output.appendChild(el('div', { class: 'report-title', text: data.title }));
        output.appendChild(el('div', { class: 'report-summary', text: data.summary || '' }));
        if (!data.rows.length) {
          output.appendChild(el('div', { class: 'empty-state', text: 'لا توجد بيانات للعرض' }));
          return;
        }
        const thead = el('thead', {}, [el('tr', {}, data.columns.map((c) => el('th', { text: c.label })))]);
        const tbody = el('tbody', {}, data.rows.map((row) =>
          el('tr', {}, data.columns.map((c) => {
            const val = row[c.key];
            return el('td', { text: typeof val === 'number' ? money(val) : val == null ? '' : String(val) });
          }))
        ));
        output.appendChild(el('table', { class: 'report-table' }, [thead, tbody]));
      }
      async function run() {
        try {
          const data = await call('reports', 'run', typeSel.value, { from: fromInp.value || undefined, to: toInp.value || undefined });
          renderReport(data);
        } catch (err) {
          toast(err.message, 'err');
        }
      }

      const controls = el('div', { class: 'report-controls' }, [
        field('نوع التقرير', typeSel),
        field('من تاريخ', fromInp),
        field('إلى تاريخ', toInp),
        el('button', { class: 'btn', text: 'عرض التقرير', onclick: run }),
        el('button', { class: 'btn ghost', text: 'طباعة', onclick: () => window.print() }),
        el('button', { class: 'btn ghost', text: 'مسح', onclick: () => { window.UI.clear(output); output.appendChild(el('div', { class: 'empty-state', text: 'تم المسح' })); } }),
      ]);

      const rightCol = el('div', {}, [controls, output]);
      const body = el('div', { class: 'screen-body' }, [el('div', { class: 'deco', html: window.icon('reports') }), rightCol]);
      const card = el('div', { class: 'screen-card', style: 'padding-bottom:26px' }, [el('div', { class: 'screen-tab', text: 'التقارير' }), body]);
      container.appendChild(card);
    })();
  }

  // ================================================================ Dashboard
  function buildDashboard(container) {
    (async () => {
      const lk = await call('lookups', 'all');
      const lowStock = (lk.items || []).filter((i) => i.stock_qty <= (i.reorder_point || 0)).length;
      const cards = [
        { n: lk.customers.length, l: 'العملاء' },
        { n: lk.suppliers.length, l: 'الموردين' },
        { n: lk.items.length, l: 'الأصناف' },
        { n: lk.warehouses.length, l: 'المخازن' },
        { n: lowStock, l: 'أصناف تحت حد الطلب' },
      ];
      const hero = el('div', { class: 'hero' }, [
        el('div', { class: 'hero-art', html: window.icon('logo') }),
        el('h2', { text: 'مرحباً بك في نظام إدارة المبيعات والمخازن' }),
        el('p', { text: 'نظام محاسبي متكامل لإدارة العملاء والموردين والأصناف والمبيعات والمشتريات والمردودات مع حفظ دائم للبيانات.' }),
        el('div', { class: 'hero-cards' }, cards.map((c) =>
          el('div', { class: 'hero-card' }, [el('div', { class: 'n', text: String(c.n) }), el('div', { class: 'l', text: c.l })])
        )),
      ]);
      const card = el('div', { class: 'screen-card', style: 'padding-bottom:26px' }, [hero]);
      container.appendChild(card);
    })();
  }

  // ================================================================ Registry
  window.PAGES = {
    dashboard: buildDashboard,

    customers: masterPage({
      entity: 'customers', tabLabel: 'بيانات العميل', deco: 'customers',
      fields: [
        { key: 'code', label: 'رقم العميل', placeholder: 'اختياري' },
        { key: 'name', label: 'اسم العميل', required: true },
        { key: 'phone', label: 'رقم الهاتف' },
        { key: 'phone2', label: 'رقم هاتف إضافي' },
        { key: 'email', label: 'البريد الإلكتروني', type: 'email' },
        { key: 'address', label: 'العنوان' },
        { key: 'region', label: 'المحافظة أو المنطقة' },
        { key: 'customer_type', label: 'نوع العميل', type: 'select', options: [{ value: '', label: '—' }, { value: 'تجزئة', label: 'تجزئة' }, { value: 'جملة', label: 'جملة' }] },
        { key: 'sales_rep', label: 'المندوب المسؤول' },
        { key: 'credit_limit', label: 'حد الائتمان', type: 'number', min: 0 },
        { key: 'balance', label: 'الرصيد (افتتاحي)', type: 'number' },
        { key: 'status', label: 'الحالة', type: 'select', options: STATUS_OPTS },
        { key: 'notes', label: 'ملاحظات', type: 'textarea', span: true },
      ],
    }),

    items: masterPage({
      entity: 'items', tabLabel: 'بيانات الصنف', deco: 'items',
      rowLabel: (r) => r.name,
      fields: [
        { key: 'code', label: 'رقم الصنف', placeholder: 'اختياري' },
        { key: 'name', label: 'اسم الصنف', required: true },
        { key: 'barcode', label: 'الباركود' },
        { key: 'category_id', label: 'الفئة', type: 'fk', source: 'categories' },
        { key: 'unit_id', label: 'الوحدة', type: 'fk', source: 'units' },
        { key: 'warehouse_id', label: 'المخزن', type: 'fk', source: 'warehouses' },
        { key: 'supplier_id', label: 'المورد', type: 'fk', source: 'suppliers' },
        { key: 'cost_price', label: 'سعر الشراء', type: 'number', min: 0 },
        { key: 'sale_price', label: 'سعر البيع', type: 'number', min: 0 },
        { key: 'stock_qty', label: 'الكمية بالمخزون', type: 'number', min: 0 },
        { key: 'reorder_point', label: 'حد إعادة الطلب', type: 'number', min: 0 },
        { key: 'default_discount', label: 'الخصم الافتراضي', type: 'number', min: 0 },
        { key: 'status', label: 'الحالة', type: 'select', options: STATUS_OPTS },
        { key: 'notes', label: 'ملاحظات', type: 'textarea', span: true },
      ],
    }),

    warehouses: masterPage({
      entity: 'warehouses', tabLabel: 'بيانات المخزن', deco: 'warehouses',
      fields: [
        { key: 'code', label: 'رقم المخزن', placeholder: 'اختياري' },
        { key: 'name', label: 'اسم المخزن', required: true },
        { key: 'location', label: 'الموقع' },
        { key: 'manager', label: 'المسؤول' },
        { key: 'phone', label: 'الهاتف' },
        { key: 'status', label: 'الحالة', type: 'select', options: STATUS_OPTS },
        { key: 'notes', label: 'ملاحظات', type: 'textarea', span: true },
      ],
    }),

    suppliers: masterPage({
      entity: 'suppliers', tabLabel: 'بيانات المورد', deco: 'suppliers',
      fields: [
        { key: 'code', label: 'رقم المورد', placeholder: 'اختياري' },
        { key: 'name', label: 'اسم المورد', required: true },
        { key: 'contact_person', label: 'الشخص المسؤول' },
        { key: 'phone', label: 'رقم الهاتف' },
        { key: 'email', label: 'البريد الإلكتروني', type: 'email' },
        { key: 'address', label: 'العنوان' },
        { key: 'balance', label: 'الرصيد (افتتاحي)', type: 'number' },
        { key: 'status', label: 'الحالة', type: 'select', options: STATUS_OPTS },
        { key: 'notes', label: 'ملاحظات', type: 'textarea', span: true },
      ],
    }),

    sales: documentPage({
      entity: 'sales', partyEntity: 'customers', partyKey: 'customer_id', partyWord: 'العميل',
      tabLabel: 'فاتورة مبيعات', deco: 'sales', priceField: 'sale_price',
      extras: [{ key: 'payment_method', label: 'طريقة الدفع', type: 'select', options: [{ value: 'نقدي', label: 'نقدي' }, { value: 'آجل', label: 'آجل' }] }],
    }),

    purchases: documentPage({
      entity: 'purchases', partyEntity: 'suppliers', partyKey: 'supplier_id', partyWord: 'المورد',
      tabLabel: 'فاتورة مشتريات', deco: 'purchases', priceField: 'cost_price',
      extras: [
        { key: 'warehouse_id', label: 'المخزن', type: 'fk', source: 'warehouses' },
        { key: 'payment_method', label: 'طريقة الدفع', type: 'select', options: [{ value: 'نقدي', label: 'نقدي' }, { value: 'آجل', label: 'آجل' }] },
      ],
    }),

    salesReturns: returnPage({ entity: 'salesReturns', tabLabel: 'مردود المبيعات', deco: 'salesReturns', partyWord: 'العميل' }),
    purchaseReturns: returnPage({ entity: 'purchaseReturns', tabLabel: 'مردود المشتريات', deco: 'purchaseReturns', partyWord: 'المورد' }),

    reports: buildReports,
  };
})();

