/* ===================================================================
   UI kit shared by every page. Read BUILDERS.md for the full API with examples.
   - Formatters: UI.fmt.*
   - HTML builders (return strings): UI.chip, UI.status, UI.btn, UI.iconBtn, UI.empty, UI.kv, UI.section, UI.stat,
     UI.input, UI.select, UI.textarea, UI.switch, UI.check, UI.alert, UI.avatar, UI.phone, UI.money
   - Mounted parts (take an element, return a controller): UI.table, UI.filters, UI.tabs, UI.dropzone
   - Layers (open over the page): UI.drawer, UI.dialog, UI.confirm, UI.menu, UI.popover, UI.toast, UI.palette
   - Files: UI.download, UI.csv, UI.xlsx, UI.pdf, UI.copy, UI.readImage
   - Charts: UI.chart.line / spark / bars / donut / ring (plain SVG)
   =================================================================== */
var UI = (function () {
  var U = {};
  var e = function (s) { return esc(s); };
  U.esc = esc; U.icon = i;

  /* ---------------- small helpers ---------------- */
  U.debounce = function (fn, ms) { var t; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms || 200); }; };
  U.uid = function (p) { return (p || 'id') + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36); };
  /* delegated events: UI.on(root, 'click', '[data-act="save"]', function (ev, el) {...}) */
  U.on = function (root, type, sel, fn) { var h = function (ev) { var el = ev.target.closest(sel); if (el && root.contains(el)) fn(ev, el); }; root.addEventListener(type, h); return function () { root.removeEventListener(type, h); }; };
  U.attrs = function (o) { if (!o) return ''; return Object.keys(o).map(function (k) { return o[k] === false || o[k] == null ? '' : o[k] === true ? ' ' + k : ' ' + k + '="' + e(o[k]) + '"'; }).join(''); };
  /* read every [data-key] field inside an element into an object */
  U.form = function (el) {
    var out = {};
    el.querySelectorAll('[data-key]').forEach(function (f) {
      var k = f.getAttribute('data-key');
      if (f.type === 'checkbox') out[k] = f.checked;
      else if (f.type === 'radio') { if (f.checked) out[k] = f.value; }
      else if (f.type === 'number') out[k] = f.value === '' ? null : Number(f.value);
      else out[k] = f.value;
    });
    return out;
  };
  U.parseDate = function (s) { if (!s) return null; var p = String(s).split(/[-T:]/); return new Date(+p[0], +p[1] - 1, +p[2], +(p[3] || 0), +(p[4] || 0)); };
  U.isoDate = function (d) { return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : ''; };
  U.isoDateTime = function (d) { return d ? U.isoDate(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''; };

  /* ---------------- formatters ---------------- */
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function words(n) {
    if (n === 0) return 'Zero';
    var w = function (x) {
      var s = '';
      if (x >= 100) { s += ONES[Math.floor(x / 100)] + ' Hundred'; x %= 100; if (x) s += ' and '; }
      if (x >= 20) { s += TENS[Math.floor(x / 10)]; if (x % 10) s += '-' + ONES[x % 10]; } else if (x) s += ONES[x];
      return s;
    };
    var parts = [], units = [['Billion', 1e9], ['Million', 1e6], ['Thousand', 1e3]];
    units.forEach(function (u) { if (n >= u[1]) { parts.push(w(Math.floor(n / u[1])) + ' ' + u[0]); n %= u[1]; } });
    if (n) parts.push((parts.length && n < 100 ? 'and ' : '') + w(n));
    return parts.join(' ');
  }
  U.fmt = {
    /* "RM 1,234.50"; {dp:0} for "RM 1,235"; negative "- RM 20.00" */
    money: function (v, o) { o = o || {}; var n = Number(v) || 0, dp = o.dp == null ? 2 : o.dp; return (n < 0 ? '- ' : '') + 'RM ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); },
    num: function (v, dp) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); },
    pct: function (v, dp) { return (Number(v) || 0).toFixed(dp || 0) + '%'; },
    date: function (d) { return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; },            /* 17 Oct 2026 */
    dateTime: function (d) { return d ? U.fmt.date(d) + ', ' + tm(d) : ''; },                                          /* 17 Oct 2026, 9:00 AM */
    dmy: function (d) { return d ? dNum(d) : ''; },                                                                      /* 17/10/2026 */
    time: function (d) { return d ? tm(d) : ''; },                                                                       /* 9:00 AM */
    short: function (d) { return d ? dShort(d) : ''; },                                                                  /* Sat 17 Oct */
    long: function (d) { return d ? WDL[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; },
    month: function (d) { return d ? MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; },
    /* Today / Yesterday / Tomorrow / Sat, 17 Oct */
    day: function (d) { if (!d) return ''; var n = NOW(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate()), x = new Date(d.getFullYear(), d.getMonth(), d.getDate()), k = Math.round((x - t) / DAY); return k === 0 ? 'Today' : k === -1 ? 'Yesterday' : k === 1 ? 'Tomorrow' : WD[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; },
    /* just now / 5 min ago / 3 h ago / 2 d ago */
    ago: function (d) { if (!d) return ''; var m = Math.round((NOW() - d) / 6e4); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' h ago'; var dd = Math.round(h / 24); return dd < 45 ? dd + ' d ago' : U.fmt.date(d); },
    /* whole days from today: -3, 0, 12 */
    daysFrom: function (d) { var n = NOW(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate()), x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return Math.round((x - t) / DAY); },
    /* "in 5 days" / "today" / "3 days ago" */
    inDays: function (d) { var k = U.fmt.daysFrom(d); return k === 0 ? 'today' : k > 0 ? 'in ' + plural(k, 'day') : plural(-k, 'day') + ' ago'; },
    duration: function (ms) { var h = Math.round(ms / 36e5), dd = Math.floor(h / 24), r = h % 24; return (dd ? plural(dd, 'day') : '') + (dd && r ? ' ' : '') + (r ? plural(r, 'hour') : '') || '0 hours'; },
    /* "Ringgit Malaysia Two Thousand Five Hundred and Eighty-Five Only" */
    words: function (v) { var n = Math.round((Number(v) || 0) * 100), rm0 = Math.floor(n / 100), sen = n % 100; return 'Ringgit Malaysia ' + words(rm0) + (sen ? ' and Sen ' + words(sen) : '') + ' Only'; },
    /* IC 900101-14-5521 -> 900XXX-XX-X521; passport A1234567 -> A1XXXX567 */
    ic: function (id) { if (!id) return ''; var s = String(id), digits = 0, total = s.replace(/[^0-9A-Za-z]/g, '').length; return s.replace(/[0-9A-Za-z]/g, function (c) { digits++; return digits <= (total > 9 ? 3 : 2) || digits > total - 3 ? c : 'X'; }); },
    size: function (b) { return !b ? '' : b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; },
    plural: plural
  };
  /* phone numbers never wrap */
  U.phone = function (p, o) { if (!p) return '<span class="faint">-</span>'; o = o || {}; return '<span class="ui-phone">' + e(p) + (o.wa ? ' <a class="ui-wa" href="https://wa.me/' + String(p).replace(/\D/g, '') + '" target="_blank" rel="noopener" title="Open WhatsApp chat" data-stop>' + i('brand-whatsapp') + '</a>' : '') + '</span>'; };
  U.money = function (v, o) { return '<span class="ui-money num">' + U.fmt.money(v, o) + '</span>'; };

  /* ---------------- statuses and chips ---------------- */
  /* the reference colours for every status family; UI.status(family, value) draws the tonal chip */
  U.STATUS = {
    booking: { 'Pending': '#94a3b8', 'Confirmed': '#94a3b8', 'Agreement Sent': '#ef4444', 'Agreement Signed': '#ef4444', 'Car Delivered': '#22c55e', 'Car Returned': '#3b82f6', 'Completed': '#6b7280', 'Cancelled': '#9ca3af' },
    payment: { '': '#94a3b8', 'None': '#94a3b8', 'Deposit due': '#ef4444', 'Deposit Received': '#eab308', 'Full Payment Received': '#10b981', 'Extension due': '#ef4444', 'Extension paid': '#22c55e', 'Refund Pending': '#3b82f6', 'Deposit Refunded': '#f97316' },
    task: { 'Pending': '#f59e0b', 'In Progress': '#3b82f6', 'Completed': '#22c55e', 'Cancelled': '#9ca3af' },
    wa: { 'Not Sent': '#9ca3af', 'Template Sent': '#3b82f6', 'Reply Received': '#f59e0b', 'Details Sent': '#22c55e', 'Failed': '#ef4444' },
    summons: { 'Needs a booking': '#f59e0b', 'Ready to charge': '#3b82f6', 'Check, then charge': '#f59e0b', 'Charged': 'primary', 'Paid': '#22c55e', 'Waived': '#9ca3af', 'Disputed': '#ef4444' },
    doc: { 'Issued': '#22c55e', 'Void': '#ef4444', 'Active': '#22c55e' },
    job: { 'Planned': '#3b82f6', 'In the workshop': '#f59e0b', 'Done': '#22c55e', 'Cancelled': '#9ca3af' },
    fleet: { 'Active': '#22c55e', 'Not in use': '#9ca3af', 'Sold': '#ef4444' },
    tracker: { 'Moving': '#22c55e', 'Parked': '#3b82f6', 'Offline': '#9ca3af' },
    account: { 'Working': '#22c55e', 'Problem': '#ef4444', 'Switched off': '#9ca3af', 'Not read yet': '#f59e0b' },
    flag: { 'Blacklisted': '#ef4444', 'Be careful': '#f59e0b', 'VIP': '#3b82f6', 'Has notes': '#6b7280', 'Repeat': '#22c55e', 'Info': '#6b7280' },
    active: { 'Active': '#22c55e', 'Inactive': '#9ca3af', 'Switched off': '#9ca3af', 'On': '#22c55e', 'Off': '#9ca3af' }
  };
  U.status = function (family, value, label, o) {
    var map = U.STATUS[family] || {}, c = map[value] || '#94a3b8';
    if (c === 'primary') c = B().primary;
    return '<span class="ui-st' + (o && o.sm ? ' sm' : '') + '" style="--sc:' + c + '"' + (o && o.attrs ? U.attrs(o.attrs) : '') + '>' + (o && o.icon ? i(o.icon) : '') + e(label || value || 'None') + '</span>';
  };
  /* tone: ok | warn | bad | info | pri | grey, or any #hex colour */
  U.chip = function (label, tone, o) {
    o = o || {};
    if (tone && tone[0] === '#') return '<span class="ui-st' + (o.sm ? ' sm' : '') + '" style="--sc:' + tone + '"' + (o.title ? ' title="' + e(o.title) + '"' : '') + '>' + (o.icon ? i(o.icon) : '') + e(label) + '</span>';
    return '<span class="chip ' + (tone || '') + (o.round ? ' round' : '') + (o.lg ? ' lg' : '') + '"' + (o.title ? ' title="' + e(o.title) + '"' : '') + U.attrs(o.attrs) + '>' + (o.icon ? i(o.icon) : '') + e(label) + '</span>';
  };
  U.badge = function (n, tone) { return '<span class="ui-badge ' + (tone || 'bad') + '">' + e(n) + '</span>'; };
  U.avatar = function (name, o) { o = o || {}; var tones = ['var(--primary-rgb)', 'var(--success-rgb)', 'var(--warning-rgb)', 'var(--info-rgb)', 'var(--grey-rgb)'], h = 0; String(name || '').split('').forEach(function (c) { h += c.charCodeAt(0); }); return '<span class="av' + (o.lg ? ' lg' : '') + (o.sq ? ' sq' : '') + '" style="--c:' + tones[h % 5] + '" aria-hidden="true">' + e(initials(name || '?')) + '</span>'; };

  /* ---------------- buttons ---------------- */
  /* kind: c (filled) | o (outlined) | t (text) | tonal | g (grey) | err; size: sm | lg */
  U.btn = function (label, o) {
    o = o || {};
    return '<button type="button" class="btn ' + (o.kind || 'c') + (o.size ? ' ' + o.size : '') + (o.cls ? ' ' + o.cls : '') + '"' + (o.disabled ? ' disabled' : '') + (o.title ? ' title="' + e(o.title) + '"' : '') + U.attrs(o.attrs) + '>' + (o.icon ? i(o.icon) : '') + (label ? '<span>' + e(label) + '</span>' : '') + '</button>';
  };
  U.iconBtn = function (icon, label, o) { o = o || {}; return '<button type="button" class="ib' + (o.size === 'sm' ? ' sm' : '') + (o.cls ? ' ' + o.cls : '') + '" aria-label="' + e(label) + '" title="' + e(label) + '"' + (o.disabled ? ' disabled' : '') + U.attrs(o.attrs) + '>' + i(icon) + (o.dot ? '<span class="dot"></span>' : '') + '</button>'; };

  /* ---------------- blocks ---------------- */
  U.empty = function (o) { o = o || {}; return '<div class="empty ui-empty">' + i(o.icon || 'inbox') + (o.title ? '<div class="h6">' + e(o.title) + '</div>' : '') + (o.text ? '<div class="b2" style="max-width:460px">' + e(o.text) + '</div>' : '') + (o.action || '') + '</div>'; };
  U.kv = function (label, value, o) { return '<div class="kv' + (o && o.full ? ' full' : '') + '"><span>' + e(label) + '</span><b>' + (value == null || value === '' ? '<span class="faint">-</span>' : value) + '</b></div>'; };
  /* a bordered block with a heading; collapsible ones open and close on click */
  U.section = function (o) {
    var id = o.id || U.uid('sec');
    return '<section class="sect ui-sect' + (o.collapsible ? ' coll' : '') + (o.collapsible && o.open === false ? ' shut' : '') + '" id="' + e(id) + '"><div class="sect-h"' + (o.collapsible ? ' role="button" tabindex="0" data-ui-toggle' : '') + '>' + (o.icon ? i(o.icon) : '') + '<span class="grow">' + e(o.title) + '</span>' + (o.actions || '') + (o.collapsible ? i('chevron-down', 'ui-chev') : '') + '</div><div class="' + (o.grid === false ? 'ui-sect-b' : 'sect-b') + '">' + (o.body || '') + '</div></section>';
  };
  U.stat = function (o) { var tag = o.attrs ? 'button type="button"' : 'div'; return '<' + tag + ' class="card stat ui-stat"' + U.attrs(o.attrs) + ' style="--c:' + ({ ok: 'var(--success-rgb)', warn: 'var(--warning-rgb)', bad: 'var(--error-rgb)', info: 'var(--info-rgb)', grey: 'var(--grey-rgb)' }[o.tone] || 'var(--primary-rgb)') + '"><div><div class="v num">' + o.value + '</div><div class="l">' + e(o.label) + '</div>' + (o.note ? '<div class="s">' + e(o.note) + '</div>' : '') + '</div>' + (o.icon ? '<span class="ic">' + i(o.icon) + '</span>' : '') + '</' + tag.split(' ')[0] + '>'; };
  U.alert = function (text, tone, o) { o = o || {}; return '<div class="alert ' + ({ ok: 'ok', warn: 'warn', bad: 'bad', pri: 'pri' }[tone] || '') + '" role="' + (tone === 'bad' ? 'alert' : 'status') + '">' + i(o.icon || ({ ok: 'circle-check', warn: 'alert-triangle', bad: 'alert-circle' }[tone] || 'info-circle')) + '<div class="grow">' + (o.html ? text : e(text)) + '</div>' + (o.action || '') + '</div>'; };
  U.progress = function (pct, tone) { return '<span class="ui-prog" style="--c:' + ({ ok: 'var(--success-rgb)', warn: 'var(--warning-rgb)', bad: 'var(--error-rgb)' }[tone] || 'var(--primary-rgb)') + '"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>'; };

  /* ---------------- form fields (each carries data-key so UI.form(el) can read it) ---------------- */
  var fid = function (o) { return o.id || 'f-' + (o.key || U.uid('x')).replace(/[^a-z0-9_-]/gi, '-'); };
  var lab = function (o, id) { return o.label ? '<label for="' + id + '">' + e(o.label) + (o.required ? ' <span class="ui-req">*</span>' : '') + '</label>' : ''; };
  var tail = function (o) { return (o.error ? '<span class="ui-err">' + e(o.error) + '</span>' : '') + (o.help ? '<span class="help">' + e(o.help) + '</span>' : ''); };
  U.input = function (o) {
    var id = fid(o), v = o.value == null ? '' : o.value;
    if (v instanceof Date) v = o.type === 'date' ? U.isoDate(v) : U.isoDateTime(v);
    return '<div class="inp' + (o.error ? ' bad' : '') + (o.full ? ' full' : '') + (o.icon ? ' srch' : '') + '"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + lab(o, id) + (o.icon ? i(o.icon) : '') + (o.prefix ? '<div class="ui-affix"><span>' + e(o.prefix) + '</span>' : '') +
      '<input id="' + id + '" type="' + (o.type || 'text') + '" data-key="' + e(o.key || '') + '" value="' + e(v) + '"' + (o.placeholder ? ' placeholder="' + e(o.placeholder) + '"' : '') + (o.required ? ' required' : '') + (o.readonly ? ' readonly' : '') + (o.disabled ? ' disabled' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + U.attrs(o.attrs) + '>' +
      (o.prefix ? '</div>' : '') + tail(o) + '</div>';
  };
  /* options: ['A', 'B'] or [['a', 'Label A'], ...] or [{value, label, group}] */
  U.options = function (opts, value) {
    var html = '', grp = null;
    (opts || []).forEach(function (op) {
      var v = Array.isArray(op) ? op[0] : typeof op === 'object' ? op.value : op, l = Array.isArray(op) ? op[1] : typeof op === 'object' ? op.label : op, g = typeof op === 'object' && !Array.isArray(op) ? op.group : null;
      if (g !== grp) { if (grp) html += '</optgroup>'; if (g) html += '<optgroup label="' + e(g) + '">'; grp = g; }
      html += '<option value="' + e(v) + '"' + (String(v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + e(l) + '</option>';
    });
    return html + (grp ? '</optgroup>' : '');
  };
  U.select = function (o) { var id = fid(o); return '<div class="inp' + (o.error ? ' bad' : '') + (o.full ? ' full' : '') + '"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + lab(o, id) + '<select id="' + id + '" data-key="' + e(o.key || '') + '"' + (o.disabled ? ' disabled' : '') + (o.label ? '' : ' aria-label="' + e(o.aria || o.placeholder || o.key) + '"') + U.attrs(o.attrs) + '>' + (o.placeholder != null ? '<option value="">' + e(o.placeholder) + '</option>' : '') + U.options(o.options, o.value) + '</select>' + tail(o) + '</div>'; };
  U.textarea = function (o) { var id = fid(o); return '<div class="inp' + (o.error ? ' bad' : '') + (o.full !== false ? ' full' : '') + '">' + lab(o, id) + '<textarea id="' + id + '" data-key="' + e(o.key || '') + '" rows="' + (o.rows || 3) + '"' + (o.placeholder ? ' placeholder="' + e(o.placeholder) + '"' : '') + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + (o.readonly ? ' readonly' : '') + U.attrs(o.attrs) + '>' + e(o.value || '') + '</textarea>' + tail(o) + '</div>'; };
  U.switch = function (o) { var id = fid(o); return '<label class="ui-swrow' + (o.full ? ' full' : '') + '" for="' + id + '"><span class="sw"><input id="' + id + '" type="checkbox" data-key="' + e(o.key || '') + '"' + (o.checked ? ' checked' : '') + (o.disabled ? ' disabled' : '') + U.attrs(o.attrs) + '><span></span></span><span class="grow"><span class="t1c">' + e(o.label) + '</span>' + (o.help ? '<span class="b2" style="display:block">' + e(o.help) + '</span>' : '') + '</span></label>'; };
  U.check = function (o) { var id = fid(o); return '<label class="cb' + (o.full ? ' full' : '') + '" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="' + e(o.key || '') + '"' + (o.checked ? ' checked' : '') + (o.disabled ? ' disabled' : '') + U.attrs(o.attrs) + '><span class="box">' + i('check') + '</span><span>' + e(o.label) + '</span></label>'; };
  /* a row of choice chips (single choice); reads back through data-key on the hidden input */
  U.choice = function (o) { var id = fid(o); return '<div class="inp' + (o.full ? ' full' : '') + '">' + lab(o, id) + '<div class="ui-choice" role="radiogroup" data-ui-choice>' + (o.options || []).map(function (op) { var v = Array.isArray(op) ? op[0] : op, l = Array.isArray(op) ? op[1] : op; return '<button type="button" role="radio" aria-checked="' + (String(v) === String(o.value)) + '" data-v="' + e(v) + '">' + e(l) + '</button>'; }).join('') + '<input type="hidden" id="' + id + '" data-key="' + e(o.key || '') + '" value="' + e(o.value == null ? '' : o.value) + '"></div>' + tail(o) + '</div>'; };

  /* ---------------- table ----------------
     UI.table(el, {columns, rows, rowKey, density, sticky, maxHeight, onRowClick, selectable, onSelect, pageSize, pageSizes,
                   sort, card, empty, minWidth, footer, rowClass, noun, bulk}) -> {setRows, selected, clear, refresh, el} */
  U.table = function (el, o) {
    var st = { sort: o.sort || null, page: o.page || 1, size: o.pageSize || 10, sel: o.selected ? o.selected : {}, rows: o.rows || [] };
    var cols = o.columns.filter(function (c) { return !c.hidden; });
    var keyOf = function (r) { return String(typeof o.rowKey === 'function' ? o.rowKey(r) : r[o.rowKey || 'id'] != null ? r[o.rowKey || 'id'] : r.code); };
    var colBy = function (k) { return cols.filter(function (c) { return c.key === k; })[0]; };
    var cmp = function (a, b) { if (a instanceof Date) a = +a; if (b instanceof Date) b = +b; if (a == null) a = ''; if (b == null) b = ''; return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en', { numeric: true }); };
    function view() {
      var rows = st.rows;
      if (st.sort && colBy(st.sort.key)) { var c = colBy(st.sort.key), get = typeof c.sort === 'function' ? c.sort : function (r) { return r[c.key]; }; rows = rows.slice().sort(function (a, b) { return cmp(get(a), get(b)) * (st.sort.dir === 'desc' ? -1 : 1); }); }
      return rows;
    }
    function draw() {
      var rows = view(), paged = o.pageSize !== false, pages = paged ? Math.max(1, Math.ceil(rows.length / st.size)) : 1;
      if (st.page > pages) st.page = pages;
      var shown = paged ? rows.slice((st.page - 1) * st.size, st.page * st.size) : rows;
      var selKeys = Object.keys(st.sel).filter(function (k) { return st.sel[k]; });
      var pageKeys = shown.map(keyOf), allOn = pageKeys.length && pageKeys.every(function (k) { return st.sel[k]; });
      var head = '<tr>' + (o.selectable ? '<th class="ui-ck"><label class="cb" data-stop><input type="checkbox" data-ui-all aria-label="Tick every row on this page"' + (allOn ? ' checked' : '') + '><span class="box">' + i('check') + '</span></label></th>' : '') +
        cols.map(function (c) {
          var sorted = st.sort && st.sort.key === c.key;
          return '<th' + (c.width ? ' style="width:' + c.width + (typeof c.width === 'number' ? 'px' : '') + '"' : '') + ' class="' + (c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : '') + (c.sort ? ' ui-sortable' : '') + '"' + (c.sort ? ' data-ui-sort="' + e(c.key) + '" tabindex="0" aria-sort="' + (sorted ? (st.sort.dir === 'desc' ? 'descending' : 'ascending') : 'none') + '"' : '') + '>' + (c.labelHtml || e(c.label || '')) + (c.sort ? i(sorted ? (st.sort.dir === 'desc' ? 'arrow-down' : 'arrow-up') : 'arrows-sort', 'ui-si') : '') + '</th>';
        }).join('') + '</tr>';
      var body = shown.map(function (r, k) {
        var key = keyOf(r);
        return '<tr data-k="' + e(key) + '" class="' + (o.onRowClick ? 'click ' : '') + (st.sel[key] ? 'on ' : '') + (o.rowClass ? o.rowClass(r) || '' : '') + '"' + (o.onRowClick ? ' tabindex="0"' : '') + '>' + (o.selectable ? '<td class="ui-ck"><label class="cb" data-stop><input type="checkbox" data-ui-row="' + e(key) + '" aria-label="Tick this row"' + (st.sel[key] ? ' checked' : '') + '><span class="box">' + i('check') + '</span></label></td>' : '') +
          cols.map(function (c) { var v = c.render ? c.render(r, k) : e(r[c.key] == null ? '' : r[c.key]); return '<td class="' + (c.align === 'right' ? 'r num' : c.align === 'center' ? 'c' : '') + (c.nowrap ? ' nw' : '') + (c.cls ? ' ' + c.cls : '') + '">' + v + '</td>'; }).join('') + '</tr>';
      }).join('');
      var emptyHtml = U.empty(o.empty || { icon: 'database-off', title: 'Nothing here yet', text: 'Try clearing the search or the filters.' });
      var other = selKeys.filter(function (k) { return pageKeys.indexOf(k) < 0; }).length;
      var bar = o.selectable && selKeys.length ? '<div class="ui-selbar"><b>' + selKeys.length + ' ' + e(o.noun ? (selKeys.length === 1 ? o.noun : o.noun + 's') : 'ticked') + (o.noun ? ' ticked' : '') + '</b>' + (other ? '<span class="b2">(' + other + ' on other pages)</span>' : '') + '<button type="button" class="btn t sm" data-ui-clear>Clear</button><span class="grow"></span>' + (o.bulk ? o.bulk(selKeys) : '') + '</div>' : '';
      var cards = o.card ? '<div class="ui-cards">' + (shown.length ? shown.map(function (r, k) { var key = keyOf(r); return '<div class="ui-card' + (o.onRowClick ? ' click' : '') + (st.sel[key] ? ' on' : '') + '" data-k="' + e(key) + '"' + (o.onRowClick ? ' tabindex="0" role="button"' : '') + '>' + (o.selectable ? '<label class="cb ui-card-ck" data-stop><input type="checkbox" data-ui-row="' + e(key) + '" aria-label="Tick"' + (st.sel[key] ? ' checked' : '') + '><span class="box">' + i('check') + '</span></label>' : '') + o.card(r, k) + '</div>'; }).join('') : emptyHtml) + '</div>' : '';
      var pager = '';
      if (paged && rows.length > Math.min.apply(0, o.pageSizes || [10])) {
        var from = rows.length ? (st.page - 1) * st.size + 1 : 0, to = Math.min(rows.length, st.page * st.size), nums = [];
        for (var p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - st.page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
        pager = '<div class="pager ui-pager"><span>Showing ' + from + ' to ' + to + ' of ' + rows.length + '</span><span class="row gap8"><label class="row gap6 b2">Rows<span class="inp"><select data-ui-size aria-label="Rows per page">' + (o.pageSizes || [10, 25, 50, 100]).map(function (n) { return '<option' + (n === st.size ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></span></label>' +
          '<span class="pgs"><button type="button" data-ui-page="' + (st.page - 1) + '"' + (st.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">' + i('chevron-left') + '</button>' + nums.map(function (n) { return n === '…' ? '<span class="ui-gap">…</span>' : '<button type="button" data-ui-page="' + n + '" aria-current="' + (n === st.page) + '">' + n + '</button>'; }).join('') + '<button type="button" data-ui-page="' + (st.page + 1) + '"' + (st.page === pages ? ' disabled' : '') + ' aria-label="Next page">' + i('chevron-right') + '</button></span></span></div>';
      }
      el.innerHTML = '<div class="ui-tbl' + (o.density === 'compact' ? ' compact' : '') + (o.sticky !== false ? ' sticky' : '') + (o.card ? ' has-cards' : '') + '">' + bar +
        '<div class="ui-tbl-scroll" style="' + (o.sticky !== false ? 'max-height:' + (o.maxHeight || 'min(70vh,760px)') : '') + '"><table class="tbl ui-t" style="min-width:' + (o.minWidth || 720) + 'px"><thead>' + head + '</thead><tbody>' + (shown.length ? body : '<tr class="ui-none"><td colspan="' + (cols.length + (o.selectable ? 1 : 0)) + '">' + emptyHtml + '</td></tr>') + '</tbody>' + (o.footer && shown.length ? '<tfoot>' + o.footer(rows) + '</tfoot>' : '') + '</table></div>' + cards + pager + '</div>';
    }
    var rowOf = function (k) { var all = st.rows; for (var j = 0; j < all.length; j++) if (keyOf(all[j]) === k) return all[j]; return null; };
    var fireSel = function () { if (o.onSelect) o.onSelect(Object.keys(st.sel).filter(function (k) { return st.sel[k]; }), ctrl); };
    el.addEventListener('click', function (ev) {
      var t = ev.target, x;
      if ((x = t.closest('[data-ui-sort]'))) { var k = x.getAttribute('data-ui-sort'); st.sort = st.sort && st.sort.key === k ? { key: k, dir: st.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }; draw(); if (o.onSort) o.onSort(st.sort); return; }
      if ((x = t.closest('[data-ui-page]'))) { st.page = +x.getAttribute('data-ui-page'); draw(); if (o.onPage) o.onPage(st.page); var sc = el.querySelector('.ui-tbl-scroll'); if (sc) sc.scrollTop = 0; return; }
      if (t.closest('[data-ui-clear]')) { st.sel = {}; draw(); fireSel(); return; }
      if (t.closest('[data-stop]') || t.closest('button,a,input,select,textarea,label,[role="button"]:not(.ui-card)')) return;
      var tr = t.closest('tr[data-k],.ui-card[data-k]');
      if (tr && o.onRowClick) { var r = rowOf(tr.getAttribute('data-k')); if (r) o.onRowClick(r, ev); }
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var x = ev.target.closest('[data-ui-sort]'); if (x) { ev.preventDefault(); x.click(); return; }
      var tr = ev.target; if (o.onRowClick && tr.matches && tr.matches('tr[data-k],.ui-card[data-k]') && ev.key === 'Enter') { var r = rowOf(tr.getAttribute('data-k')); if (r) o.onRowClick(r, ev); }
    });
    el.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.matches('[data-ui-size]')) { st.size = +t.value; st.page = 1; draw(); return; }
      if (t.matches('[data-ui-all]')) { view().slice(o.pageSize === false ? 0 : (st.page - 1) * st.size, o.pageSize === false ? undefined : st.page * st.size).forEach(function (r) { st.sel[keyOf(r)] = t.checked; }); draw(); fireSel(); return; }
      if (t.matches('[data-ui-row]')) { st.sel[t.getAttribute('data-ui-row')] = t.checked; draw(); fireSel(); }
    });
    var ctrl = {
      el: el,
      setRows: function (rows, keepPage) { st.rows = rows || []; if (!keepPage) st.page = 1; draw(); },
      selected: function () { return Object.keys(st.sel).filter(function (k) { return st.sel[k]; }); },
      selectedRows: function () { return ctrl.selected().map(rowOf).filter(Boolean); },
      clear: function () { st.sel = {}; draw(); fireSel(); },
      refresh: draw, state: st
    };
    draw();
    return ctrl;
  };

  /* ---------------- filters bar ----------------
     UI.filters(el, {fields, values, onChange}) fields:
       {type:'search', key, placeholder} | {type:'select', key, label, options, all} | {type:'date', key, label}
       {type:'daterange', from, to, label} | {type:'chips', key, options:[[value, label, count, tone]]} | {type:'toggle', key, label}
     values is your own object (keep it in ctx.state so it survives redraws). */
  U.filters = function (el, o) {
    var v = o.values || {}, deb = U.debounce(function (k) { o.onChange && o.onChange(v, k); }, 220);
    var isSet = function (f) { if (f.type === 'daterange') return !!(v[f.from] || v[f.to]); var d = f.default == null ? (f.type === 'toggle' ? false : f.type === 'chips' ? (f.options[0] && (Array.isArray(f.options[0]) ? f.options[0][0] : f.options[0])) : '') : f.default; return v[f.key] != null && v[f.key] !== d && v[f.key] !== ''; };
    function draw() {
      var any = o.fields.some(function (f) { return f.type !== 'chips' && isSet(f); }) || o.fields.some(function (f) { return f.type === 'chips' && isSet(f); });
      var count = o.fields.filter(function (f) { return f.type !== 'search' && isSet(f); }).length;
      var main = '', chips = '';
      o.fields.forEach(function (f) {
        if (f.type === 'search') main += '<div class="inp srch ui-fsearch">' + i('search') + '<input type="search" data-f="' + e(f.key) + '" data-key="flt-' + e(f.key) + '" placeholder="' + e(f.placeholder || 'Search') + '" aria-label="' + e(f.placeholder || 'Search') + '" value="' + e(v[f.key] || '') + '"></div>';
        else if (f.type === 'select') main += '<div class="inp ui-fsel ui-fx"' + (f.width ? ' style="width:' + f.width + 'px"' : '') + '><select data-f="' + e(f.key) + '" aria-label="' + e(f.label || f.key) + '">' + (f.all !== false ? '<option value="">' + e(f.all || 'All') + '</option>' : '') + U.options(f.options, v[f.key]) + '</select></div>';
        else if (f.type === 'date') main += '<div class="inp ui-fdate ui-fx"><input type="date" data-f="' + e(f.key) + '" aria-label="' + e(f.label || f.key) + '" title="' + e(f.label || '') + '" value="' + e(v[f.key] || '') + '"></div>';
        else if (f.type === 'daterange') main += '<div class="ui-frange ui-fx" role="group" aria-label="' + e(f.label || 'Dates') + '">' + (f.label ? '<span class="b2">' + e(f.label) + '</span>' : '') + '<span class="inp"><input type="date" data-f="' + e(f.from) + '" aria-label="From" value="' + e(v[f.from] || '') + '"></span><span class="faint">to</span><span class="inp"><input type="date" data-f="' + e(f.to) + '" aria-label="To" value="' + e(v[f.to] || '') + '"' + (v[f.from] ? ' min="' + e(v[f.from]) + '"' : '') + '></span></div>';
        else if (f.type === 'toggle') main += '<label class="ui-ftog ui-fx row gap6 b2"><span class="sw"><input type="checkbox" data-f="' + e(f.key) + '"' + (v[f.key] ? ' checked' : '') + '><span></span></span>' + e(f.label) + '</label>';
        else if (f.type === 'chips') chips += '<div class="ui-fchips" role="group" aria-label="' + e(f.label || f.key) + '">' + (f.label ? '<span class="b2">' + e(f.label) + '</span>' : '') + f.options.map(function (op) { var val = Array.isArray(op) ? op[0] : op, lb = Array.isArray(op) ? op[1] : op, n = Array.isArray(op) ? op[2] : null, tone = Array.isArray(op) ? op[3] : null; var on = String(v[f.key] == null ? (f.default != null ? f.default : (Array.isArray(f.options[0]) ? f.options[0][0] : f.options[0])) : v[f.key]) === String(val); return '<button type="button" class="ui-fchip' + (tone ? ' ' + tone : '') + '" data-fc="' + e(f.key) + '" data-v="' + e(val) + '" aria-pressed="' + on + '">' + e(lb) + (n != null ? '<span class="n">' + n + '</span>' : '') + '</button>'; }).join('') + '</div>';
      });
      el.innerHTML = '<div class="ui-fb' + (st.open ? ' open' : '') + '"><div class="ui-frow">' + main + '<button type="button" class="btn o sm ui-fmore" data-fmore aria-expanded="' + !!st.open + '">' + i('filter') + 'Filters' + (count ? ' (' + count + ')' : '') + '</button>' + (any ? '<button type="button" class="btn t sm ui-fclear" data-fclear>' + i('x') + 'Clear filters</button>' : '') + (o.extra || '') + '</div>' + (chips ? '<div class="ui-frow">' + chips + '</div>' : '') + '</div>';
    }
    var st = { open: false };
    el.addEventListener('input', function (ev) { var t = ev.target; if (t.matches('input[type="search"][data-f]')) { v[t.getAttribute('data-f')] = t.value; deb(t.getAttribute('data-f')); } });
    el.addEventListener('change', function (ev) { var t = ev.target, k = t.getAttribute('data-f'); if (!k || t.type === 'search') return; v[k] = t.type === 'checkbox' ? t.checked : t.value; draw(); o.onChange && o.onChange(v, k); });
    el.addEventListener('click', function (ev) {
      var t = ev.target, x;
      if ((x = t.closest('[data-fc]'))) { v[x.getAttribute('data-fc')] = x.getAttribute('data-v'); draw(); o.onChange && o.onChange(v, x.getAttribute('data-fc')); }
      else if (t.closest('[data-fclear]')) { o.fields.forEach(function (f) { if (f.type === 'daterange') { delete v[f.from]; delete v[f.to]; } else delete v[f.key]; }); draw(); o.onChange && o.onChange(v, '*'); }
      else if (t.closest('[data-fmore]')) { st.open = !st.open; draw(); }
    });
    draw();
    return { values: v, redraw: draw, set: function (k, val) { v[k] = val; draw(); o.onChange && o.onChange(v, k); }, isSet: function () { return o.fields.some(isSet); } };
  };

  /* ---------------- tabs ----------------
     UI.tabs(el, {items:[{id, label, icon, count, hidden}], value, onChange, kind:'line'|'pill'}) */
  U.tabsHtml = function (items, value, kind) { return '<div class="' + (kind === 'pill' ? 'ptabs' : 'tabs') + '" role="tablist">' + items.filter(function (t) { return !t.hidden; }).map(function (t) { return '<button type="button" role="tab" class="' + (kind === 'pill' ? 'ptab' : 'tab') + '" data-ui-tab="' + e(t.id) + '" aria-selected="' + (t.id === value) + '">' + (t.icon ? i(t.icon) : '') + e(t.label) + (t.count != null ? ' <span class="chip ' + (t.tone || 'pri') + '">' + t.count + '</span>' : '') + '</button>'; }).join('') + '</div>'; };
  U.tabs = function (el, o) {
    var cur = o.value;
    var draw = function () { el.innerHTML = U.tabsHtml(o.items, cur, o.kind); };
    el.addEventListener('click', function (ev) { var x = ev.target.closest('[data-ui-tab]'); if (!x) return; cur = x.getAttribute('data-ui-tab'); draw(); o.onChange && o.onChange(cur); });
    el.addEventListener('keydown', function (ev) { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; var bs = [].slice.call(el.querySelectorAll('[data-ui-tab]')), k = bs.indexOf(document.activeElement); if (k < 0) return; var n = bs[(k + (ev.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click(); });
    draw();
    return { set: function (v) { cur = v; draw(); }, value: function () { return cur; }, setItems: function (items) { o.items = items; draw(); } };
  };

  /* ---------------- layers: drawer, dialog, confirm ---------------- */
  var stack = [];
  function layer() { var l = document.getElementById('ui-layer'); if (!l) { l = document.createElement('div'); l.id = 'ui-layer'; document.body.appendChild(l); } return l; }
  function lockScroll() { document.documentElement.classList.toggle('ui-locked', stack.some(function (s) { return s.modal; })); }
  function focusFirst(box) { var f = box.querySelector('[autofocus],input:not([type=hidden]):not([disabled]),select,textarea,button:not([data-ui-x])'); if (f) try { f.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  function footHtml(foot) {
    if (!foot) return '';
    if (typeof foot === 'string') return foot;
    return foot.map(function (b, k) { return b.spacer ? '<span class="grow"></span>' : '<button type="button" class="btn ' + (b.kind || (k === foot.length - 1 ? 'c' : 'o')) + '" data-ui-fb="' + k + '"' + (b.disabled ? ' disabled' : '') + (b.title ? ' title="' + e(b.title) + '"' : '') + '>' + (b.icon ? i(b.icon) : '') + e(b.label) + '</button>'; }).join('');
  }
  function makeLayer(kind, o) {
    var prev = document.activeElement, wrap = document.createElement('div');
    wrap.className = 'ui-ov ui-' + kind + '-ov';
    var w = typeof o.width === 'number' ? o.width + 'px' : ({ sm: '420px', md: '560px', lg: '860px', xl: '1100px' }[o.width] || (kind === 'drawer' ? '620px' : '560px'));
    var box = kind === 'drawer'
      ? '<aside class="ui-drw" role="dialog" aria-modal="true" aria-label="' + e(o.title || 'Details') + '" style="width:min(' + w + ',100%)"><header class="ui-drw-h"><div class="grow ui-lh"></div><div class="ui-drw-acts"></div><button type="button" class="ib" data-ui-x aria-label="Close">' + i('x') + '</button></header><div class="ui-drw-b"></div><footer class="ui-drw-f"></footer></aside>'
      : '<div class="ui-dlg" role="' + (o.alert ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-label="' + e(o.title || 'Dialog') + '" style="width:min(' + w + ',calc(100% - 24px))"><header class="ui-dlg-h"><div class="grow ui-lh"></div>' + (o.dismissable === false ? '' : '<button type="button" class="ib sm" data-ui-x aria-label="Close">' + i('x') + '</button>') + '</header><div class="ui-dlg-b"></div><footer class="ui-dlg-f"></footer></div>';
    wrap.innerHTML = box;
    var panel = wrap.firstChild, bodyEl = wrap.querySelector('.ui-drw-b,.ui-dlg-b'), footEl = wrap.querySelector('.ui-drw-f,.ui-dlg-f'), headEl = wrap.querySelector('.ui-lh'), actEl = wrap.querySelector('.ui-drw-acts');
    var ctrl = { el: panel, body: bodyEl, closed: false, data: o.data || {} };
    ctrl.setTitle = function (t, sub) { headEl.innerHTML = '<h2>' + e(t) + '</h2>' + (sub ? '<p>' + (o.subHtml ? sub : e(sub)) + '</p>' : ''); };
    ctrl.setHeader = function (html) { headEl.innerHTML = html; };
    ctrl.setActions = function (html) { if (actEl) actEl.innerHTML = html || ''; };
    ctrl.setBody = function (b) { o.body = b; if (typeof b === 'function') { var r = b(bodyEl, ctrl); if (typeof r === 'string') bodyEl.innerHTML = r; } else bodyEl.innerHTML = b || ''; };
    ctrl.setFoot = function (f) { o.foot = f; footEl.innerHTML = footHtml(f); footEl.style.display = f ? '' : 'none'; };
    ctrl.refresh = function () { var sc = bodyEl.scrollTop; ctrl.setBody(o.body); bodyEl.scrollTop = sc; };
    ctrl.busy = function (on, label) { footEl.querySelectorAll('button').forEach(function (b) { b.disabled = !!on; }); if (on && label) { var last = footEl.querySelector('button:last-child'); if (last) last.textContent = label; } if (!on) ctrl.setFoot(o.foot); };
    ctrl.close = function (force) {
      if (ctrl.closed) return Promise.resolve(true);
      var go = function () { ctrl.closed = true; stack.splice(stack.indexOf(ctrl), 1); wrap.classList.add('out'); setTimeout(function () { wrap.remove(); }, 160); lockScroll(); if (offData) offData(); if (o.onClose) o.onClose(ctrl); if (prev && prev.focus && document.contains(prev)) try { prev.focus({ preventScroll: true }); } catch (err) { /* ignore */ } return true; };
      if (!force && o.dirty && o.dirty(ctrl)) return U.confirm({ title: o.dirtyTitle || 'Discard your changes?', text: 'What you typed here is not saved yet.', ok: 'Discard', cancel: 'Keep editing', danger: true }).then(function (y) { return y ? go() : false; });
      return Promise.resolve(go());
    };
    if (o.headerHtml) headEl.innerHTML = o.headerHtml; else ctrl.setTitle(o.title || '', o.subtitle || o.text);
    ctrl.setActions(o.actions);
    ctrl.setFoot(o.foot || o.buttons);
    wrap.addEventListener('mousedown', function (ev) { ctrl._down = ev.target === wrap; });
    wrap.addEventListener('click', function (ev) {
      var t = ev.target, x;
      if (t === wrap && ctrl._down && o.dismissable !== false) { ctrl.close(); return; }
      if (t.closest('[data-ui-x]')) { ctrl.close(); return; }
      if ((x = t.closest('[data-ui-fb]'))) { var b = (o.foot || o.buttons)[+x.getAttribute('data-ui-fb')]; if (!b) return; var r = b.onClick ? b.onClick(ctrl, ev) : null; if (b.close !== false && r !== false && !(r && r.then)) ctrl.close(true); else if (r && r.then) r.then(function (v) { if (v !== false && b.close !== false) ctrl.close(true); }); return; }
    });
    var offData = o.live ? on('data', function () { if (!ctrl.closed) ctrl.refresh(); }) : null;
    layer().appendChild(wrap);
    ctrl.modal = true; stack.push(ctrl); lockScroll();
    ctrl.setBody(o.body);
    setTimeout(function () { if (!panel.contains(document.activeElement)) focusFirst(panel); }, 30);
    return ctrl;
  }
  /* UI.drawer({title, subtitle, width, body (html or function (bodyEl, drawer)), foot (html or [{label, kind, icon, onClick(drawer), close}]), actions, onClose, dirty, live}) */
  U.drawer = function (o) { return makeLayer('drawer', o || {}); };
  /* UI.dialog({title, text, width:'sm'|'md'|'lg', body, buttons:[{label, kind, onClick(dlg) -> false keeps it open}], onClose}) */
  U.dialog = function (o) { return makeLayer('dialog', o || {}); };
  /* await UI.confirm({title, text, ok, cancel, danger, input:{label, placeholder, required, multiline}}) -> true / false, or the typed text */
  U.confirm = function (o) {
    o = typeof o === 'string' ? { title: o } : o || {};
    return new Promise(function (res) {
      var done = false, finish = function (v) { if (!done) { done = true; res(v); } };
      var body = (o.text ? '<p class="ui-ctext">' + e(o.text) + '</p>' : '') + (o.html || '') + (o.input ? (o.input.multiline ? U.textarea({ key: 'answer', label: o.input.label, placeholder: o.input.placeholder, value: o.input.value }) : U.input({ key: 'answer', label: o.input.label, placeholder: o.input.placeholder, value: o.input.value })) + '<span class="ui-err" hidden>' + e(o.input.error || 'Type a reason first.') + '</span>' : '');
      var d = U.dialog({ title: o.title || 'Are you sure?', width: o.width || 'sm', alert: true, body: body, onClose: function () { finish(false); },
        buttons: [{ label: o.cancel || 'Cancel', kind: 'g', onClick: function () { finish(false); } }, { label: o.ok || 'OK', kind: o.danger ? 'err' : 'c', onClick: function (dl) {
          if (o.input) { var f = dl.body.querySelector('[data-key="answer"]'), v = f.value.trim(); if (o.input.required !== false && !v) { dl.body.querySelector('.ui-err[hidden]') && (dl.body.querySelector('.ui-err').hidden = false); f.focus(); return false; } finish(v); } else finish(true);
        } }] });
      if (o.danger) d.el.classList.add('danger');
    });
  };
  U.closeAll = function () { stack.slice().reverse().forEach(function (s) { s.close(true); }); U.closePops(); };
  U.top = function () { return stack[stack.length - 1] || null; };

  /* ---------------- popovers and menus ---------------- */
  var pops = [];
  U.closePops = function () { pops.slice().forEach(function (p) { p.close(); }); };
  /* UI.popover(anchor, html or function (el, pop), {width, align:'start'|'end', cls, onClose}) */
  U.popover = function (anchor, content, o) {
    o = o || {};
    U.closePops();
    var el = document.createElement('div'); el.className = 'ui-pop ' + (o.cls || ''); el.setAttribute('role', o.role || 'dialog');
    if (o.width) el.style.width = typeof o.width === 'number' ? 'min(' + o.width + 'px, calc(100vw - 16px))' : o.width;
    var pop = { el: el, close: function () { if (pop.closed) return; pop.closed = true; el.remove(); pops.splice(pops.indexOf(pop), 1); document.removeEventListener('mousedown', outside, true); window.removeEventListener('resize', pop.close); if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'false'); if (o.onClose) o.onClose(); }, place: place, refresh: function () { fill(); place(); } };
    function fill() { if (typeof content === 'function') { var r = content(el, pop); if (typeof r === 'string') el.innerHTML = r; } else el.innerHTML = content; }
    function place() {
      var r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight;
      var left = o.align === 'start' ? r.left : r.right - w; left = Math.max(8, Math.min(vw - w - 8, left));
      var top = r.bottom + 6; if (top + h > vh - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
      el.style.left = left + 'px'; el.style.top = Math.max(8, top) + 'px';
    }
    function outside(ev) { if (!el.contains(ev.target) && !anchor.contains(ev.target)) pop.close(); }
    fill(); layer().appendChild(el); place();
    if (anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
    setTimeout(function () { document.addEventListener('mousedown', outside, true); }, 0);
    window.addEventListener('resize', pop.close);
    pops.push(pop);
    return pop;
  };
  /* UI.menu(anchor, [{label, icon, onClick, danger, disabled, hint, checked} | {divider:true} | {header:'Text'}], {width}) */
  U.menu = function (anchor, items, o) {
    o = o || {};
    var pop = U.popover(anchor, '<div class="ui-menu" role="menu">' + items.filter(Boolean).map(function (it, k) {
      if (it.divider) return '<div class="ui-mdiv" role="separator"></div>';
      if (it.header) return '<div class="ui-mhead">' + e(it.header) + '</div>';
      if (it.html) return it.html;
      return '<button type="button" role="menuitem" class="ui-mi' + (it.danger ? ' danger' : '') + '" data-mi="' + k + '"' + (it.disabled ? ' disabled' : '') + (it.title ? ' title="' + e(it.title) + '"' : '') + '>' + (it.icon ? i(it.icon) : it.checked != null ? i(it.checked ? 'check' : 'point', it.checked ? '' : 'ui-hide') : '') + '<span class="grow">' + e(it.label) + (it.hint ? '<small>' + e(it.hint) + '</small>' : '') + '</span>' + (it.kbd ? '<kbd>' + e(it.kbd) + '</kbd>' : '') + '</button>';
    }).join('') + '</div>', { width: o.width || 240, align: o.align, role: 'presentation' });
    pop.el.addEventListener('click', function (ev) { var x = ev.target.closest('[data-mi]'); if (!x) return; var it = items.filter(Boolean)[+x.getAttribute('data-mi')]; pop.close(); if (it && it.onClick) it.onClick(ev); });
    pop.el.addEventListener('keydown', function (ev) {
      var bs = [].slice.call(pop.el.querySelectorAll('[data-mi]:not([disabled])')), k = bs.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); var n = bs[(k + (ev.key === 'ArrowDown' ? 1 : bs.length - 1) + (k < 0 && ev.key === 'ArrowUp' ? 1 : 0)) % bs.length]; if (n) n.focus(); }
    });
    var first = pop.el.querySelector('[data-mi]:not([disabled])'); if (first) first.focus({ preventScroll: true });
    return pop;
  };

  /* ---------------- toasts (top right; bottom on a phone) ---------------- */
  /* UI.toast('Saved', {tone:'ok'|'warn'|'bad'|'info', action:{label, run}, ms}) */
  U.toast = function (msg, o) {
    o = o || {};
    var box = document.getElementById('ui-toasts'); if (!box) { box = document.createElement('div'); box.id = 'ui-toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div'), tone = o.tone || 'ok';
    t.className = 'ui-toast ' + tone;
    t.innerHTML = i({ ok: 'circle-check', warn: 'alert-triangle', bad: 'alert-circle', info: 'info-circle' }[tone] || 'circle-check') + '<span class="grow">' + e(msg) + '</span>' + (o.action ? '<button type="button" class="ui-tact">' + e(o.action.label) + '</button>' : '') + '<button type="button" class="ui-tx" aria-label="Close">' + i('x') + '</button>';
    var kill = function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 200); };
    t.addEventListener('click', function (ev) { if (ev.target.closest('.ui-tact')) { o.action.run(); kill(); } else if (ev.target.closest('.ui-tx')) kill(); });
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    var timer = setTimeout(kill, o.ms || (o.action ? 6000 : 3800));
    t.addEventListener('mouseenter', function () { clearTimeout(timer); }); t.addEventListener('mouseleave', function () { timer = setTimeout(kill, 1800); });
    return { close: kill };
  };

  /* ---------------- copy to clipboard ---------------- */
  /* UI.copy(text, {label:'Link copied', show:true}) */
  U.copy = function (text, o) {
    o = o || {};
    var ok = function () { U.toast((o.label || 'Copied') + (o.show !== false ? ': ' + text : ''), { tone: 'ok' }); return true; };
    var manual = function () { U.dialog({ title: 'Copy it by hand', width: 'sm', body: '<p class="ui-ctext">This viewer does not allow copying. Select the text and copy it.</p>' + U.input({ key: 'copy', value: text, readonly: true }), buttons: [{ label: 'Close' }] }); setTimeout(function () { var f = document.querySelector('.ui-dlg [data-key="copy"]'); if (f) { f.focus(); f.select(); } }, 60); return false; };
    var legacy = function () { try { var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); var r = document.execCommand('copy'); ta.remove(); return r; } catch (err) { return false; } };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(ok, function () { return legacy() ? ok() : manual(); });
    return Promise.resolve(legacy() ? ok() : manual());
  };

  /* ---------------- files: build a real file in the browser and offer it ---------------- */
  var scripts = {};
  U.loadScript = function (url) {
    if (!scripts[url]) scripts[url] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = url; s.async = true; s.onload = res; s.onerror = function () { delete scripts[url]; rej(new Error('Could not load ' + url)); }; document.head.appendChild(s); });
    return scripts[url];
  };
  U.LIB = { xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' };
  var dlCap = null;
  function downloadsCap() {
    if (dlCap) return dlCap;
    var use = window.claude && window.claude.use;
    dlCap = !use ? Promise.resolve(null) : Promise.race([Promise.resolve(use.call(window.claude, 'downloads')).catch(function () { return null; }), new Promise(function (r) { setTimeout(function () { r(null); }, 4000); })]);
    return dlCap;
  }
  /* UI.download({filename, data (string | Blob | ArrayBuffer | Uint8Array), mime}) -> Promise<'saved'|'declined'|'fallback'|'error'> */
  U.download = function (o) {
    return downloadsCap().then(function (dl) {
      if (dl && dl.save) {
        return dl.save({ filename: o.filename, data: o.data }).then(function () { U.toast(o.filename + ' saved'); return 'saved'; }, function (err) {
          var code = err && err.code;
          if (code === 'declined') { U.toast('Download cancelled', { tone: 'info' }); return 'declined'; }
          if (code === 'rate_limited') { U.toast('A save is already waiting for your answer. Try again in a moment.', { tone: 'warn' }); return 'error'; }
          return fallback(o, code);
        });
      }
      return fallback(o);
    });
  };
  function fallback(o, code) {
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: o.mime || 'application/octet-stream' }), url = URL.createObjectURL(blob);
    U.dialog({ title: 'Your file is ready', width: 'sm', body: '<p class="ui-ctext">' + e(o.filename) + ' (' + U.fmt.size(blob.size) + ') was made in your browser. ' + (code ? 'This viewer could not save it (' + e(code) + ').' : 'This viewer cannot save files for you.') + ' If the link below does nothing, open the sample in a normal browser tab to save it.</p><a class="btn c" href="' + url + '" download="' + e(o.filename) + '">' + i('download') + 'Save ' + e(o.filename) + '</a>', buttons: [{ label: 'Close', kind: 'g' }], onClose: function () { setTimeout(function () { URL.revokeObjectURL(url); }, 4000); } });
    return 'fallback';
  }
  /* UI.csv('bookings.csv', [['Booking ID', 'Customer'], ['KLT-00412', 'Aiman']]) */
  U.csv = function (filename, rows) {
    var cell = function (v) { if (v instanceof Date) v = U.fmt.dateTime(v); v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return U.download({ filename: filename, data: '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n'), mime: 'text/csv' });
  };
  /* UI.xlsx('report.xlsx', [{name:'Summary', rows:[[...], ...], cols:[18, 12], money:[3, 4], merges:['A1:F1'], filter:true}]) */
  U.xlsx = function (filename, sheets) {
    U.toast('Preparing ' + filename + '...', { tone: 'info', ms: 1600 });
    return U.loadScript(U.LIB.xlsx).then(function () {
      var X = window.XLSX, wb = X.utils.book_new();
      sheets.forEach(function (s) {
        var ws = X.utils.aoa_to_sheet(s.rows, { cellDates: true });
        if (s.cols) ws['!cols'] = s.cols.map(function (w) { return { wch: w }; });
        if (s.merges) ws['!merges'] = s.merges.map(function (m) { return X.utils.decode_range(m); });
        var rg = X.utils.decode_range(ws['!ref'] || 'A1');
        for (var r = rg.s.r; r <= rg.e.r; r++) for (var c = rg.s.c; c <= rg.e.c; c++) {
          var cl = ws[X.utils.encode_cell({ r: r, c: c })]; if (!cl) continue;
          if (cl.t === 'n' && s.money && s.money.indexOf(c) >= 0) cl.z = '#,##0.00';
          if (cl.t === 'd') cl.z = s.dateFormat || 'dd mmm yyyy hh:mm';
        }
        if (s.filter) ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: s.headerRow || 0, c: rg.s.c }, e: { r: rg.e.r, c: rg.e.c } }) };
        X.utils.book_append_sheet(wb, ws, String(s.name || 'Sheet').slice(0, 31));
      });
      return U.download({ filename: filename, data: new Uint8Array(X.write(wb, { bookType: 'xlsx', type: 'array', compression: true })), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }, function () { U.toast('The spreadsheet tool could not load. Check the connection and try again.', { tone: 'bad' }); return 'error'; });
  };
  /* UI.pdf('invoice.pdf', function (doc, kit) { kit.header({...}); kit.table({...}); }) */
  U.pdf = function (filename, build, o) {
    o = o || {};
    U.toast('Preparing ' + filename + '...', { tone: 'info', ms: 1600 });
    return U.loadScript(U.LIB.jspdf).then(function () {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: o.landscape ? 'landscape' : 'portrait' }), kit = U.pdfKit(doc);
      return Promise.resolve(build(doc, kit)).then(function () { kit.finish(o.footer); return U.download({ filename: filename, data: doc.output('arraybuffer'), mime: 'application/pdf' }); });
    }, function () { U.toast('The PDF tool could not load. Check the connection and try again.', { tone: 'bad' }); return 'error'; });
  };
  /* small drawing kit for branded A4 documents (jsPDF) */
  U.pdfKit = function (doc) {
    var b = B(), co = D().company || {}, W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
    var rgb = function (h) { return C.rgb(h); }, P = rgb(C.readable(b.primary, 4.5)), S2 = rgb(b.secondary);
    var k = { doc: doc, W: W, H: H, M: M, y: M, primary: P, secondary: S2 };
    k.font = function (size, style, color) { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size || 10); var c = color || [33, 33, 40]; doc.setTextColor(c[0], c[1], c[2]); };
    k.text = function (s, x, y, opt) { doc.text(String(s == null ? '' : s), x, y, opt || {}); };
    k.wrap = function (s, x, y, width, lh) { var lines = doc.splitTextToSize(String(s || ''), width); doc.text(lines, x, y); return y + lines.length * (lh || 4.6); };
    k.line = function (y, color) { var c = color || [220, 220, 228]; doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(.3); doc.line(M, y, W - M, y); };
    k.ensure = function (need) { if (k.y + need > H - 20) { doc.addPage(); k.y = M + 6; } };
    /* brand band with company name, then the document title and number on the right */
    k.header = function (h) {
      doc.setFillColor(S2[0], S2[1], S2[2]); doc.rect(0, 0, W, 26, 'F');
      doc.setFillColor(P[0], P[1], P[2]); doc.rect(0, 26, W, 1.6, 'F');
      k.font(15, 'bold', [255, 255, 255]); k.text(co.trading || b.name, M, 12);
      k.font(8.5, 'normal', [220, 222, 230]); k.text((co.legal || b.legal) + (co.reg ? ' · Reg. ' + co.reg : ''), M, 18); k.text((co.phone || b.phone) + ' · ' + (co.email || b.email), M, 22.5);
      k.font(16, 'bold', [255, 255, 255]); k.text(h.title || '', W - M, 12, { align: 'right' });
      k.font(9, 'normal', [220, 222, 230]); (h.lines || []).forEach(function (l, j) { k.text(l, W - M, 18 + j * 4.5, { align: 'right' }); });
      k.y = 36;
    };
    /* two blocks side by side: [{title:'FROM', lines:[...]}, {title:'BILL TO', lines:[...]}] */
    k.parties = function (blocks) {
      var w = (W - 2 * M - 8) / blocks.length, maxY = k.y;
      blocks.forEach(function (bl, j) { var x = M + j * (w + 8), y = k.y; k.font(8, 'bold', P); k.text(bl.title, x, y); y += 5; k.font(9.5, 'normal'); (bl.lines || []).forEach(function (l, n) { if (n === 0) k.font(10, 'bold'); else k.font(9, 'normal', [70, 70, 80]); y = k.wrap(l, x, y, w, 4.4); }); maxY = Math.max(maxY, y); });
      k.y = maxY + 4;
    };
    /* table: {columns:[{label, w (mm), align}], rows:[[...]], zebra, total:[...]} */
    k.table = function (t) {
      var x0 = M, widths = t.columns.map(function (c) { return c.w; }), total = widths.reduce(function (a, b2) { return a + b2; }, 0), scale = (W - 2 * M) / total;
      widths = widths.map(function (w) { return w * scale; });
      var head = function () { doc.setFillColor(S2[0], S2[1], S2[2]); doc.rect(x0, k.y, W - 2 * M, 7.5, 'F'); k.font(8.5, 'bold', [255, 255, 255]); var x = x0; t.columns.forEach(function (c, j) { k.text(c.label, c.align === 'right' ? x + widths[j] - 2 : x + 2, k.y + 5, { align: c.align === 'right' ? 'right' : 'left' }); x += widths[j]; }); k.y += 7.5; };
      head();
      t.rows.forEach(function (r, n) {
        var cells = r.map(function (v, j) { return doc.splitTextToSize(String(v == null ? '' : v), widths[j] - 4); }), hgt = Math.max.apply(0, cells.map(function (c) { return c.length; })) * 4.3 + 3;
        if (k.y + hgt > H - 22) { doc.addPage(); k.y = M + 6; head(); }
        if (t.zebra !== false && n % 2) { doc.setFillColor(246, 246, 249); doc.rect(x0, k.y, W - 2 * M, hgt, 'F'); }
        k.font(9, r.bold ? 'bold' : 'normal'); var x = x0;
        cells.forEach(function (c, j) { var al = t.columns[j].align === 'right'; doc.text(c, al ? x + widths[j] - 2 : x + 2, k.y + 4.6, { align: al ? 'right' : 'left' }); x += widths[j]; });
        k.y += hgt; k.line(k.y, [232, 232, 238]);
      });
      (t.totals || []).forEach(function (tr) { k.ensure(7); k.font(tr[2] ? 10.5 : 9.5, tr[2] ? 'bold' : 'normal', tr[2] ? P : null); k.text(tr[0], W - M - 46, k.y + 5, { align: 'right' }); k.text(tr[1], W - M - 2, k.y + 5, { align: 'right' }); k.y += 6.5; });
      k.y += 4;
    };
    k.watermark = function (s) { var n = doc.getNumberOfPages(); for (var p = 1; p <= n; p++) { doc.setPage(p); doc.saveGraphicsState && doc.saveGraphicsState(); if (doc.GState) doc.setGState(new doc.GState({ opacity: .12 })); k.font(90, 'bold', [200, 30, 40]); doc.text(s, W / 2, H / 2, { align: 'center', angle: 35 }); doc.restoreGraphicsState && doc.restoreGraphicsState(); } };
    k.finish = function (footer) { var n = doc.getNumberOfPages(); for (var p = 1; p <= n; p++) { doc.setPage(p); k.font(7.5, 'normal', [120, 120, 130]); k.text(footer || (co.trading || b.name) + ' · ' + (co.phone || b.phone) + ' · ' + (co.website || ''), M, H - 8); k.text('Page ' + p + ' of ' + n, W - M, H - 8, { align: 'right' }); } };
    return k;
  };

  /* ---------------- reading files people add ---------------- */
  /* UI.readImage(file, {max:1600}) -> Promise<{dataUrl, name, size, type, w, h}> (images are made smaller; PDFs pass through) */
  U.readImage = function (file, o) {
    o = o || {};
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onerror = function () { rej(new Error('The file could not be read.')); };
      rd.onload = function () {
        if (!/^image\//.test(file.type)) { res({ dataUrl: rd.result, name: file.name, size: file.size, type: file.type }); return; }
        var img = new Image();
        img.onload = function () {
          var mx = o.max || 1600, sc = Math.min(1, mx / Math.max(img.width, img.height));
          if (sc === 1 && file.size < 900000) { res({ dataUrl: rd.result, name: file.name, size: file.size, type: file.type, w: img.width, h: img.height }); return; }
          var cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL('image/jpeg', o.quality || .85);
          res({ dataUrl: url, name: file.name.replace(/\.\w+$/, '.jpg'), size: Math.round(url.length * .75), type: 'image/jpeg', w: cv.width, h: cv.height, shrunk: true });
        };
        img.onerror = function () { rej(new Error('That picture could not be opened.')); };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  };
  /* UI.dropzone(el, {accept, multiple, label, hint, camera, onFiles(files)}) : drag and drop, choose, take a photo, paste with Ctrl+V */
  U.dropzone = function (el, o) {
    o = o || {};
    var id = U.uid('dz');
    el.innerHTML = '<div class="ui-dz" tabindex="0" role="button" aria-label="' + e(o.label || 'Drop files here') + '">' + i(o.icon || 'cloud-upload') + '<div class="t1c fw5">' + e(o.label || 'Drop files here') + '</div><div class="b2">' + e(o.hint || 'or choose them. You can also paste with Ctrl+V.') + '</div><div class="row wrap gap8" style="justify-content:center"><label class="btn o sm" for="' + id + '">' + i('folder-open') + 'Choose ' + (o.multiple ? 'files' : 'a file') + '</label>' + (o.camera ? '<label class="btn t sm ui-cam" for="' + id + '-cam">' + i('camera') + 'Take a photo</label><input id="' + id + '-cam" type="file" accept="image/*" capture="environment" hidden>' : '') + '</div><input id="' + id + '" type="file" hidden' + (o.accept ? ' accept="' + e(o.accept) + '"' : '') + (o.multiple ? ' multiple' : '') + '></div>';
    var dz = el.firstChild, give = function (list) { var fs = [].slice.call(list || []); if (!o.multiple) fs = fs.slice(0, 1); if (fs.length && o.onFiles) o.onFiles(fs); };
    dz.addEventListener('dragover', function (ev) { ev.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
    dz.addEventListener('drop', function (ev) { ev.preventDefault(); dz.classList.remove('over'); give(ev.dataTransfer.files); });
    dz.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.querySelector('#' + id).click(); } });
    el.addEventListener('change', function (ev) { if (ev.target.type === 'file') { give(ev.target.files); ev.target.value = ''; } });
    var paste = function (ev) { if (!document.contains(dz)) { document.removeEventListener('paste', paste); return; } var items = ev.clipboardData && ev.clipboardData.files; if (items && items.length) { ev.preventDefault(); give(items); } };
    document.addEventListener('paste', paste);
    return { el: dz };
  };

  /* collapsible sections and choice chips work anywhere (pages, drawers, dialogs) */
  document.addEventListener('click', function (ev) {
    var x;
    if ((x = ev.target.closest('[data-ui-toggle]'))) { x.parentNode.classList.toggle('shut'); return; }
    if ((x = ev.target.closest('[data-ui-choice] [data-v]'))) { var g = x.parentNode; g.querySelectorAll('[data-v]').forEach(function (z) { z.setAttribute('aria-checked', z === x); }); var hid = g.querySelector('input[type=hidden]'); hid.value = x.getAttribute('data-v'); hid.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  document.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[data-ui-toggle]')) { ev.preventDefault(); ev.target.click(); } });

  return U;
})();

/* ===================================================================
   Charts (plain SVG). lineChart, spark, changeChip and niceMax are kept as plain functions for the Dashboard.
   =================================================================== */
function niceMax(v) { if (v <= 0) return 10; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function lineChart(vals, prev, labels, o) {
  o = o || {};
  var nar = window.innerWidth < 620, W = nar ? 380 : 640, H = o.h || (nar ? 220 : 230), L = 52, Rr = 10, T = 12, Bt = 26, max = niceMax(Math.max.apply(0, vals.concat(prev || [0])) * 1.08), n = vals.length;
  var x = function (k) { return L + (n === 1 ? 0 : k * (W - L - Rr) / (n - 1)); }, y = function (v) { return T + (H - T - Bt) * (1 - v / max); };
  var pts = vals.map(function (v, k) { return x(k).toFixed(1) + ' ' + y(v).toFixed(1); });
  var line = 'M' + pts.join(' L'), area = line + ' L' + x(n - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + 'Z';
  var grid = '', k;
  for (k = 0; k <= 4; k++) { var v = max * k / 4; grid += '<line class="vd-grid" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="vd-axis" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (o.fmt ? o.fmt(v) : rmk(v)) + '</text>'; }
  var step = Math.ceil(n / 7), xl = '';
  labels.forEach(function (lb, k) { if (k % step === 0 || k === n - 1) xl += '<text class="vd-axis" x="' + x(k) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
  var pl = prev ? '<path d="M' + prev.map(function (v, k) { return x(k).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' L') + '" fill="none" stroke="var(--vd-ink2)" stroke-width="1.6" stroke-dasharray="5 5" opacity=".8"/>' : '';
  var id = 'g' + Math.floor(Math.random() * 1e6);
  var last = '<circle cx="' + x(n - 1) + '" cy="' + y(vals[n - 1]) + '" r="4.5" fill="var(--vd-revenue)" stroke="var(--vd-paper)" stroke-width="2"/>';
  return '<div class="vd-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Chart') + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--vd-revenue)" stop-opacity=".32"/><stop offset="1" stop-color="var(--vd-revenue)" stop-opacity="0"/></linearGradient></defs>' +
    grid + xl + pl + '<path d="' + area + '" fill="url(#' + id + ')"/><path class="vd-draw" pathLength="1" d="' + line + '" fill="none" stroke="var(--vd-revenue)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' + last + '</svg></div>';
}
function spark(vals, color) {
  var W = 200, H = 38, max = Math.max.apply(0, vals) || 1, min = Math.min.apply(0, vals), n = vals.length;
  var p = vals.map(function (v, k) { return (k * W / (n - 1)).toFixed(1) + ' ' + (H - 3 - (H - 8) * (v - min) / ((max - min) || 1)).toFixed(1); });
  return '<svg class="vd-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="M' + p.join(' L') + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
}
function changeChip(now, before, goodUp, label) {
  if (!before) return '<span class="vd-chip">New</span>';
  var pc = Math.round((now - before) / before * 100), up = pc >= 0, good = goodUp ? up : !up;
  return '<span class="row gap6" style="flex-wrap:wrap"><span class="vd-chip" data-good="' + (pc === 0 ? '' : good) + '">' + i(up ? 'arrow-up-right' : 'arrow-down-right') + (up ? '+' : '') + pc + '%</span>' + (label ? '<span class="vd-chip-note">' + esc(label) + '</span>' : '') + '</span>';
}
UI.chart = {
  /* colours for series, in order; brand first */
  colors: ['var(--primary)', '#4a6b8f', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#9ca3af'],
  line: lineChart, spark: spark, change: changeChip, niceMax: niceMax,
  /* UI.chart.bars({labels, series:[{name, values, color}], stacked, height, fmt, onClickAttr}) */
  bars: function (o) {
    var W = 640, H = o.height || 220, L = 48, T = 10, Bt = 24, n = o.labels.length, ser = o.series, cs = UI.chart.colors;
    var totals = o.labels.map(function (_, k) { return o.stacked ? ser.reduce(function (s, x) { return s + (x.values[k] || 0); }, 0) : Math.max.apply(0, ser.map(function (x) { return x.values[k] || 0; })); });
    var max = niceMax(Math.max.apply(0, totals.concat([1])) * 1.05), bw = (W - L - 8) / n, y = function (v) { return T + (H - T - Bt) * (1 - v / max); }, out = '';
    for (var g = 0; g <= 4; g++) { var v = max * g / 4; out += '<line class="vd-grid" x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="vd-axis" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (o.fmt ? o.fmt(v) : rmk(v)) + '</text>'; }
    o.labels.forEach(function (lb, k) {
      var x0 = L + k * bw + bw * .14, inner = bw * .72, acc = 0;
      ser.forEach(function (s, j) {
        var val = s.values[k] || 0, col = s.color || cs[j % cs.length];
        if (o.stacked) { out += '<rect x="' + x0.toFixed(1) + '" y="' + y(acc + val).toFixed(1) + '" width="' + inner.toFixed(1) + '" height="' + Math.max(0, y(acc) - y(acc + val)).toFixed(1) + '" fill="' + col + '" rx="2"><title>' + esc(lb + ', ' + s.name + ': ' + (o.fmt ? o.fmt(val) : val)) + '</title></rect>'; acc += val; }
        else { var w = inner / ser.length; out += '<rect x="' + (x0 + j * w).toFixed(1) + '" y="' + y(val).toFixed(1) + '" width="' + Math.max(1, w - 2).toFixed(1) + '" height="' + Math.max(0, y(0) - y(val)).toFixed(1) + '" fill="' + col + '" rx="2"><title>' + esc(lb + ', ' + s.name + ': ' + (o.fmt ? o.fmt(val) : val)) + '</title></rect>'; }
      });
      if (n <= 16 || k % Math.ceil(n / 12) === 0) out += '<text class="vd-axis" x="' + (x0 + inner / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>';
    });
    var legend = ser.length > 1 ? '<div class="legend ui-legend">' + ser.map(function (s, j) { return '<span><i style="background:' + (s.color || cs[j % cs.length]) + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>' : '';
    return '<div class="ui-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Bar chart') + '">' + out + '</svg>' + legend + '</div>';
  },
  /* UI.chart.donut({items:[{label, value, color}], size, center:{value, label}, fmt}) */
  donut: function (o) {
    var S0 = o.size || 168, r = S0 / 2 - 14, c = 2 * Math.PI * r, tot = o.items.reduce(function (s, x) { return s + x.value; }, 0) || 1, off = 0, cs = UI.chart.colors;
    var arcs = o.items.map(function (x, k) { var len = c * x.value / tot, s = '<circle cx="' + S0 / 2 + '" cy="' + S0 / 2 + '" r="' + r + '" fill="none" stroke="' + (x.color || cs[k % cs.length]) + '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + S0 / 2 + ' ' + S0 / 2 + ')"><title>' + esc(x.label + ': ' + (o.fmt ? o.fmt(x.value) : x.value)) + '</title></circle>'; off += len; return s; }).join('');
    var center = o.center ? '<text x="50%" y="48%" text-anchor="middle" class="ui-dn-v">' + esc(o.center.value) + '</text><text x="50%" y="62%" text-anchor="middle" class="ui-dn-l">' + esc(o.center.label || '') + '</text>' : '';
    return '<div class="ui-donut"><svg viewBox="0 0 ' + S0 + ' ' + S0 + '" width="' + S0 + '" height="' + S0 + '" role="img" aria-label="' + esc(o.label || 'Donut chart') + '"><circle cx="' + S0 / 2 + '" cy="' + S0 / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="22"/>' + arcs + center + '</svg><ul class="ui-dn-legend">' + o.items.map(function (x, k) { return '<li><i style="background:' + (x.color || cs[k % cs.length]) + '"></i><span class="grow">' + esc(x.label) + '</span><b class="num">' + (o.fmt ? o.fmt(x.value) : x.value) + '</b><small>' + Math.round(x.value / tot * 100) + '%</small></li>'; }).join('') + '</ul></div>';
  },
  /* UI.chart.ring(62, {size:64, label:'62%'}) */
  ring: function (pct, o) {
    o = o || {}; var S0 = o.size || 64, r = S0 / 2 - 6, c = 2 * Math.PI * r, len = c * Math.max(0, Math.min(100, pct)) / 100;
    return '<svg class="ui-ring" viewBox="0 0 ' + S0 + ' ' + S0 + '" width="' + S0 + '" height="' + S0 + '" role="img" aria-label="' + esc(o.label || Math.round(pct) + '%') + '"><circle cx="' + S0 / 2 + '" cy="' + S0 / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="7"/><circle cx="' + S0 / 2 + '" cy="' + S0 / 2 + '" r="' + r + '" fill="none" stroke="' + (o.color || 'var(--primary)') + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + len.toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 ' + S0 / 2 + ' ' + S0 / 2 + ')"/><text x="50%" y="56%" text-anchor="middle" class="ui-ring-t">' + esc(o.text != null ? o.text : Math.round(pct) + '%') + '</text></svg>';
  }
};

/* ===================================================================
   Domain helpers shared by several pages (read only for page builders)
   =================================================================== */
/* Total / Received / Still due bar for a booking */
function moneyBar(x) {
  if (x.status === 'Cancelled') return '';
  var due = x.payable - x.received, tone = due <= 0 ? 'var(--success-rgb)' : x.received > 0 ? 'var(--warning-rgb)' : 'var(--error-rgb)';
  return '<div class="money" style="--c:' + tone + '"><span>Total <b>' + rm2(x.payable) + '</b></span><span>Received <b>' + rm2(x.received) + '</b></span><span>' + (due <= 0 ? '<b>Paid in full</b>' : 'Still due <b>' + rm2(due) + '</b>') + '</span></div>';
}
/* road tax chip: Valid / Expires in N days / Expires today / Expired N days ago / Not recorded */
function taxChip(c) { if (!c.tax) return '<span class="chip">Not recorded</span>'; var dd = Math.round((c.tax - TODAY) / DAY); return '<span class="chip ' + (dd < 0 ? 'bad' : dd <= 30 ? 'warn' : 'ok') + '">' + (dd < 0 ? 'Expired ' + (-dd) + ' day' + (dd === -1 ? '' : 's') + ' ago' : dd === 0 ? 'Expires today' : dd <= 30 ? 'Expires in ' + dd + ' days' : 'Valid') + '</span>'; }
function kv(l, v) { return '<div class="kv"><span>' + l + '</span><b>' + v + '</b></div>'; }
/* the address of a booking's customer pages */
function siteLink(x, kind) { var base = 'https://' + B().slug + '.orbiquefms.com/book/'; return kind === 'pdf' ? base + x.formId + '/download' : kind === 'agent' ? base + 'vehicle-inspection/agent/' + x.agentToken : kind === 'customer' ? base + 'vehicle-inspection/customer/' + x.formId : base + x.formId; }
