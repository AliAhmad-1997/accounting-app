'use strict';

// Reusable building blocks: form fields, the two-column form card, the action
// button row, the slide-in record drawer, and the invoice line-item editor.
(function () {
  const { el, clear, money } = window.UI;

  // ---------------------------------------------------------------- Field
  function field(def, lookups) {
    const type = def.type || 'text';
    let input;
    if (type === 'textarea') {
      input = el('textarea', { rows: 2 });
    } else if (type === 'select') {
      input = el('select');
      for (const o of def.options || []) input.appendChild(el('option', { value: o.value, text: o.label }));
    } else if (type === 'fk') {
      input = el('select');
      input.appendChild(el('option', { value: '', text: '— اختر —' }));
      for (const r of (lookups && lookups[def.source]) || []) {
        input.appendChild(el('option', { value: String(r.id), text: r.name }));
      }
    } else {
      const htmlType = type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'email' ? 'email' : 'text';
      input = el('input', { type: htmlType });
      if (type === 'number') {
        input.step = def.step || 'any';
        if (def.min != null) input.min = String(def.min);
      }
    }
    if (def.readonly) input.readOnly = true;
    if (def.placeholder) input.placeholder = def.placeholder;

    const label = el('label', { html: def.label + (def.required ? ' <span class="req">*</span>' : '') });
    const wrap = el('div', { class: 'field' + (def.span ? ' span2' : '') }, [label, input]);

    return {
      def,
      wrap,
      input,
      get() {
        if (type === 'number') {
          const v = String(input.value).trim();
          return v === '' ? null : Number(v);
        }
        if (type === 'fk') return input.value === '' ? null : Number(input.value);
        if (type === 'select') return input.value === '' ? null : input.value;
        const v = String(input.value).trim();
        return v === '' ? null : v;
      },
      set(v) {
        input.value = v == null ? '' : String(v);
      },
    };
  }

  // ---------------------------------------------------------------- Form card
  function formCard({ tabLabel, deco, fields, lookups, oneCol }) {
    const controls = {};
    const grid = el('div', { class: 'form-grid' + (oneCol ? ' one-col' : '') });
    for (const def of fields) {
      const f = field(def, lookups);
      controls[def.key] = f;
      grid.appendChild(f.wrap);
    }
    const decoPanel = el('div', { class: 'deco', html: window.icon(deco) });
    const body = el('div', { class: 'screen-body' }, [decoPanel, grid]);
    const card = el('div', { class: 'screen-card' }, [el('div', { class: 'screen-tab', text: tabLabel }), body]);
    return {
      root: card,
      controls,
      values() {
        const o = {};
        for (const k in controls) o[k] = controls[k].get();
        return o;
      },
      setValues(obj) {
        for (const k in controls) controls[k].set(obj ? obj[k] : null);
      },
      clear() {
        for (const k in controls) controls[k].set(null);
      },
      append(node) {
        card.appendChild(node);
      },
    };
  }

  // ---------------------------------------------------------------- Action bar
  function actionBar(buttons) {
    return el(
      'div',
      { class: 'actionbar' },
      buttons.filter(Boolean).map((b) => el('button', { class: 'btn ' + (b.variant || ''), text: b.label, onclick: b.onClick }))
    );
  }

  // ---------------------------------------------------------------- Record drawer
  function recordDrawer({ title, fetch, renderRow, onPick }) {
    const overlay = el('div', { class: 'overlay' });
    const searchInput = el('input', { type: 'search', placeholder: 'ابحث...' });
    const list = el('div', { class: 'drawer-list' });
    const closeBtn = el('button', { class: 'drawer-close', html: '&times;' });
    const drawer = el('div', { class: 'drawer' }, [
      el('div', { class: 'drawer-head' }, [el('h3', { text: title }), closeBtn]),
      el('div', { class: 'drawer-search' }, [searchInput]),
      list,
    ]);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function close() {
      overlay.classList.remove('open');
      drawer.classList.remove('open');
    }
    async function refresh() {
      clear(list);
      try {
        const rows = await fetch(searchInput.value.trim());
        if (!rows.length) {
          list.appendChild(el('div', { class: 'empty-state', text: 'لا توجد سجلات' }));
          return;
        }
        for (const row of rows) {
          const info = renderRow(row);
          list.appendChild(
            el('div', { class: 'record', onclick: () => { onPick(row); close(); } }, [
              el('div', { class: 'r-title', text: info.title }),
              info.sub ? el('div', { class: 'r-sub', text: info.sub }) : null,
            ])
          );
        }
      } catch (err) {
        list.appendChild(el('div', { class: 'empty-state', text: err.message }));
      }
    }
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 180);
    });
    overlay.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    return {
      open() {
        overlay.classList.add('open');
        drawer.classList.add('open');
        searchInput.value = '';
        refresh();
        setTimeout(() => searchInput.focus(), 50);
      },
      close,
      refresh,
    };
  }

  // ---------------------------------------------------------------- Line editor
  // Editable invoice/return lines. When `lockItems` is set the item + price are
  // fixed (used by returns, where lines come from the original invoice).
  function lineEditor({ items, priceField, onChange, lockItems }) {
    const tbody = el('tbody');
    const table = el('table', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'الصنف' }),
          el('th', { text: 'السعر' }),
          el('th', { text: 'الكمية' }),
          el('th', { text: 'الإجمالي' }),
          lockItems ? null : el('th', { text: '' }),
        ]),
      ]),
      tbody,
    ]);
    const rows = [];

    function recalc() {
      let total = 0;
      for (const r of rows) {
        const line = (Number(r.priceInp.value) || 0) * (Number(r.qtyInp.value) || 0);
        r.totalCell.textContent = money(line);
        total += line;
      }
      if (onChange) onChange(total);
    }

    function addRow(prefill) {
      const p = prefill || {};
      const itemSel = el('select', { disabled: !!lockItems });
      if (!lockItems) itemSel.appendChild(el('option', { value: '', text: '— اختر الصنف —' }));
      for (const it of items) itemSel.appendChild(el('option', { value: String(it.id), text: it.name }));
      const priceInp = el('input', { type: 'number', step: 'any', min: '0', class: 'num', readOnly: !!lockItems });
      const qtyInp = el('input', { type: 'number', step: 'any', min: '0', class: 'num' });
      const totalCell = el('td', { text: '0.00' });
      const cells = [el('td', {}, [itemSel]), el('td', {}, [priceInp]), el('td', {}, [qtyInp]), totalCell];

      const r = { itemSel, priceInp, qtyInp, totalCell, meta: p };
      if (!lockItems) {
        const rmBtn = el('button', { class: 'btn danger sm', text: 'حذف', onclick: () => {
          const i = rows.indexOf(r);
          if (i >= 0) rows.splice(i, 1);
          tr.remove();
          recalc();
        } });
        cells.push(el('td', {}, [rmBtn]));
      }
      const tr = el('tr', {}, cells);

      if (!lockItems) {
        itemSel.addEventListener('change', () => {
          const it = items.find((i) => String(i.id) === itemSel.value);
          if (it && !priceInp.value) priceInp.value = it[priceField] != null ? it[priceField] : '';
          recalc();
        });
      }
      priceInp.addEventListener('input', recalc);
      qtyInp.addEventListener('input', recalc);

      if (prefill) {
        itemSel.value = String(prefill.item_id);
        priceInp.value = prefill.unit_price != null ? prefill.unit_price : '';
        qtyInp.value = prefill.quantity != null ? prefill.quantity : '';
      }
      rows.push(r);
      tbody.appendChild(tr);
      recalc();
      return r;
    }

    return {
      wrap: el('div', { class: 'lines' }, [table]),
      table,
      addRow,
      clearRows() {
        rows.length = 0;
        clear(tbody);
        recalc();
      },
      getLines() {
        return rows
          .map((r) => ({
            item_id: r.itemSel.value ? Number(r.itemSel.value) : null,
            unit_price: Number(r.priceInp.value) || 0,
            quantity: Number(r.qtyInp.value) || 0,
          }))
          .filter((l) => l.item_id && l.quantity > 0);
      },
      setLines(arr) {
        this.clearRows();
        (arr || []).forEach((l) => addRow(l));
      },
    };
  }

  window.W = { field, formCard, actionBar, recordDrawer, lineEditor };
})();

