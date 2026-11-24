/* ---------------- CUSTOMERS (M6) ----------------
   #customers      the list: search (name, IC, email, booking code, phone in any form), flag chips with counts, Load more
   #customer/<id>  the customer page: banner, Call / WhatsApp, details, documents, notes, blacklist, bookings, Book again
   Cust.open(id)   opens the customer page (other modules call it)
   A "customer" on the list is a person: rows with the same IC / passport (else the same phone) are one person. */
var Cust = (function () {
  var CU = { q: '', shown: 25 };
  VIEW_STATE.push(function () { CU.q = ''; CU.shown = 25; });
  var FILTERS = [
    { k: 'all', label: 'Everyone' },
    { k: 'blacklisted', label: 'Blacklisted', need: 'customers.blacklist_view' },
    { k: 'careful', label: 'Be careful' },
    { k: 'vip', label: 'VIP' },
    { k: 'repeat', label: 'Repeat' },
    { k: 'notes', label: 'Has notes' }
  ];
  var NOTE_FLAGS = [
    { k: 'info', label: 'Info', hint: 'Something useful to know', tone: 'grey', icon: 'info' },
    { k: 'vip', label: 'VIP', hint: 'Look after this customer well', tone: 'blue', icon: 'star' },
    { k: 'careful', label: 'Be careful', hint: 'A warning for the next booking', tone: 'amber', icon: 'warn' }
  ];
  var PHRASES = ['Returns late', 'Smoker', 'Pays on time', 'Needs a baby seat', 'Prefers delivery', 'Keeps the car clean'];
  var BL_REASONS = ['Did not pay for damage', 'Returned the car very late', 'Fake documents', 'Did not pay the balance', 'Rude to staff'];
  var DOCS = [
    { k: 'icFront', label: 'IC front', demo: 'ic' }, { k: 'icBack', label: 'IC back', demo: 'ic' }, { k: 'passport', label: 'Passport', demo: 'doc' },
    { k: 'licence', label: 'Licence', demo: 'licence' }, { k: 'poa', label: 'Proof of address', demo: 'doc' }, { k: 'other', label: 'Other', demo: 'doc' }
  ];

  /* ---------- people (grouped rows) ---------- */
  function keyOf(c) {
    var id = normPlate(c.ic || c.passport || '').replace(/[^A-Z0-9]/g, '');
    if (id.length >= 6) return 'id:' + id;
    var p = phoneCore(c.phone); return p ? 'ph:' + p : 'cu:' + c.id;
  }
  function bookingsByCust() { var m = {}; S.bookings.forEach(function (b) { (m[b.cust] = m[b.cust] || []).push(b); }); return m; }
  function notesByCust() { var m = {}; (S.notes || []).forEach(function (n) { (m[n.cust] = m[n.cust] || []).push(n); }); return m; }
  function people() {
    var byKey = {}, order = [], bm = bookingsByCust(), nm = notesByCust();
    S.customers.forEach(function (c) { var k = keyOf(c); if (!byKey[k]) { byKey[k] = { key: k, members: [] }; order.push(byKey[k]); } byKey[k].members.push(c); });
    order.forEach(function (g) {
      g.bookings = []; g.notes = [];
      g.members.forEach(function (c) { g.bookings = g.bookings.concat(bm[c.id] || []); g.notes = g.notes.concat(nm[c.id] || []); });
      /* the main row: the one with the most bookings */
      g.c = g.members.slice().sort(function (a, b) { return (bm[b.id] || []).length - (bm[a.id] || []).length; })[0];
      g.rentals = g.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled'; }).length;
      g.flags = flagsOf(g);
    });
    return order;
  }
  function flagsOf(g) {
    var f = [];
    if (can('customers.blacklist_view') && g.members.some(function (c) { return c.blacklist; })) f.push('Blacklisted');
    if (can('customer_notes.view')) {
      if (g.notes.some(function (n) { return n.flag === 'careful'; })) f.push('Be careful');
      if (g.notes.some(function (n) { return n.flag === 'vip'; })) f.push('VIP');
    }
    if (g.rentals >= 2) f.push('Repeat');
    if (can('customer_notes.view') && g.notes.length && f.indexOf('Be careful') < 0 && f.indexOf('VIP') < 0) f.push('Has notes');
    return f;
  }
  function groupOf(id) { var c = byId(S.customers, id); if (!c) return null; var k = keyOf(c), g = { key: k, members: S.customers.filter(function (x) { return keyOf(x) === k; }) }; var ids = g.members.map(function (m) { return m.id; });
    g.bookings = S.bookings.filter(function (b) { return ids.indexOf(b.cust) >= 0; }); g.notes = (S.notes || []).filter(function (n) { return ids.indexOf(n.cust) >= 0; });
    g.rentals = g.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled'; }).length; g.c = c; g.flags = flagsOf(g); return g; }
  function fchip(f) { return f === 'Repeat' ? chip('Repeat', 'green') : f === 'Has notes' ? chip('Has notes', 'grey') : flagChip(f); }
  function passes(g, k) {
    if (k === 'blacklisted') return g.flags.indexOf('Blacklisted') >= 0;
    if (k === 'careful') return g.flags.indexOf('Be careful') >= 0;
    if (k === 'vip') return g.flags.indexOf('VIP') >= 0;
    if (k === 'repeat') return g.rentals >= 2;
    if (k === 'notes') return g.notes.length > 0;
    return true;
  }
  function matches(g, q) {
    if (!q) return true;
    if (g.members.some(function (c) { return Pickers.customerMatches(c, q) || wordsMatch(q, c.email); })) return true;
    if (/\d/.test(q) && g.bookings.some(function (b) { return matchBookingCode(q, b); })) return true;
    return false;
  }
  function telOf(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function flagPref() { var k = (S.prefs && S.prefs.cuFlag) || 'all'; if (!can('customer_notes.view') && k !== 'repeat') k = 'all'; var f = FILTERS.filter(function (x) { return x.k === k; })[0]; if (!f || (f.need && !can(f.need))) k = 'all'; return k; }

  /* ---------- list ---------- */
  function listView() {
    if (!can('customers.view')) return { html: topbar('Customers', { back: '#more' }) + '<main>' + noAccess('customers.view') + '</main>' };
    var all = people();
    var html = topbar('Customers', { back: '#more', sub: all.length + ' customers' }) + '<main class="cu-main">' +
      '<label class="search cu-search">' + I('search') + '<input id="cuq" type="search" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" placeholder="Name, phone, IC, email or booking no." value="' + esc(CU.q) + '"><button type="button" class="cu-clear" id="cuclr" aria-label="Clear"' + (CU.q ? '' : ' hidden') + '>' + I('x', 2.2) + '</button></label>' +
      (can('customer_notes.view') ? '<div class="chiprow cu-chips" id="cuchips"></div>' : '') +
      '<div id="culist"></div></main>';
    return { html: html, after: function () { wireList(all); } };
  }
  function wireList(all) {
    var inp = $('#cuq'), clr = $('#cuclr'), tmr = null;
    var mode = function () { inp.setAttribute('inputmode', /^[\d+]/.test(inp.value.trim()) ? 'tel' : 'search'); };
    mode();
    inp.addEventListener('input', function () { clr.hidden = !inp.value; mode(); clearTimeout(tmr); tmr = setTimeout(function () { CU.q = inp.value; CU.shown = 25; draw(all); }, 80); });
    inp.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData); t = t ? t.getData('text') : ''; var tidy = tidySearch(t);
      if (tidy && !inp.value.trim()) { e.preventDefault(); var cc = (S.settings && S.settings.country) || '60'; if (normPhone(t).indexOf(cc) === 0) tidy = '0' + tidy; inp.value = tidy; clr.hidden = false; mode(); CU.q = tidy; CU.shown = 25; draw(all); }
    });
    clr.onclick = function () { inp.value = ''; clr.hidden = true; CU.q = ''; CU.shown = 25; mode(); draw(all); inp.focus(); };
    draw(all);
  }
  function draw(all) {
    var q = CU.q.trim(), k = flagPref();
    var found = all.filter(function (g) { return matches(g, q); });
    var box = $('#cuchips');
    if (box) {
      box.innerHTML = FILTERS.filter(function (f) { return !f.need || can(f.need); }).map(function (f) {
        var n = found.filter(function (g) { return passes(g, f.k); }).length;
        return '<button type="button" class="fchip' + (f.k === k ? ' on' : '') + '" data-f="' + f.k + '">' + esc(f.label) + ' <span class="n">' + n + '</span></button>';
      }).join('');
      $$('button', box).forEach(function (b) { b.onclick = function () { usePrefs(); S.prefs.cuFlag = b.dataset.f; save(); CU.shown = 25; draw(all); }; });
    }
    var list = found.filter(function (g) { return passes(g, k); }).sort(function (a, b) { return a.c.name.localeCompare(b.c.name); });
    var shown = list.slice(0, CU.shown);
    var label = FILTERS.filter(function (f) { return f.k === k; })[0].label;
    var html = '<div class="cu-count">' + (q || k !== 'all' ? list.length + ' match' + (list.length === 1 ? '' : 'es') + (q ? ' for “' + esc(q) + '”' : '') + (k !== 'all' ? ' in ' + esc(label) : '') : list.length + ' customers, A to Z') + '</div>';
    if (!list.length) html += '<div class="empty card">' + I('users') + '<div>No customer matches' + (q ? ' “' + esc(q) + '”' : '') + (k !== 'all' ? ' in ' + esc(label) : '') + '.</div>' + (k !== 'all' ? '<button type="button" class="btn link" id="cuall">Show everyone</button>' : '') + '</div>';
    else html += '<div class="list cu-list">' + shown.map(rowHtml).join('') + '</div>' +
      (list.length > shown.length ? '<button type="button" class="btn ghost cu-more" id="cumore">Load more <span class="muted">(' + (list.length - shown.length) + ' more)</span></button>' : '');
    $('#culist').innerHTML = html;
    var mb = $('#cumore'); if (mb) mb.onclick = function () { CU.shown += 25; draw(all); };
    var ab = $('#cuall'); if (ab) ab.onclick = function () { usePrefs(); S.prefs.cuFlag = 'all'; save(); draw(all); };
  }
  function rowHtml(g) {
    var c = g.c, n = g.rentals, tel = telOf(c.phone), idTxt = c.ic ? maskIC(c.ic) : c.passport ? maskIC(c.passport) : '';
    return '<div class="cu-row" role="button" tabindex="0" data-open="' + c.id + '" onclick="Cust.open(\'' + c.id + '\')" onkeydown="if(event.key===\'Enter\')Cust.open(\'' + c.id + '\')">' +
      '<span class="av" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</span>' +
      '<span class="cu-mid"><span class="cu-name">' + esc(c.name) + '</span>' +
      '<span class="cu-sub"><span class="nowrap">' + esc(c.phone || 'No phone') + '</span>' + (idTxt ? ' · <span class="nowrap">' + esc(idTxt) + '</span>' : '') + '</span>' +
      '<span class="cu-sub2"><span class="cu-n' + (n > 1 ? ' many' : '') + '">' + n + ' booking' + (n === 1 ? '' : 's') + '</span>' + g.flags.filter(function (f) { return f !== 'Repeat' || g.flags.length < 4; }).slice(0, 3).map(fchip).join('') + '</span></span>' +
      (tel ? '<a class="cu-ic" href="tel:' + esc(tel) + '" aria-label="Call ' + esc(c.name) + '" onclick="event.stopPropagation()">' + I('phone') + '</a>' +
        '<button type="button" class="cu-ic wa" aria-label="WhatsApp ' + esc(c.name) + '" onclick="event.stopPropagation();Share.wa(\'' + esc(c.phone) + '\', \'\')">' + I('wa') + '</button>' : '') + '</div>';
  }

  /* ---------- customer page ---------- */
  function pageView(r) {
    if (!can('customers.view')) return { html: topbar('Customer', { back: '#customers' }) + '<main>' + noAccess('customers.view') + '</main>' };
    var g = groupOf(r.a);
    if (!g) return { html: topbar('Customer', { back: '#customers' }) + '<main><div class="empty card">' + I('users') + '<div>This customer is not on the list any more.</div><a class="btn link" href="#customers">All customers</a></div></main>' };
    var c = g.c, tel = telOf(c.phone);
    var right = can('customers.edit') ? '<button class="iconbtn" type="button" onclick="Cust.edit(\'' + c.id + '\')" aria-label="Edit details">' + I('edit') + '</button>' : '';
    var html = topbar(c.name, { back: '#customers', sub: (c.nationality || '') + (c.created ? (c.nationality ? ' · ' : '') + 'customer since ' + MO[new Date(c.created).getMonth()] + ' ' + new Date(c.created).getFullYear() : ''), right: right }) + '<main class="cu-page">' +
      bannerHtml(g) +
      '<div class="cu-hero card"><span class="av cu-av" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</span><div class="grow"><div class="cu-hname">' + esc(c.name) + '</div><div class="cu-hflags">' + (g.flags.length ? g.flags.map(fchip).join('') : '<span class="small muted">No flags</span>') + '</div></div></div>' +
      (tel ? '<div class="cu-call"><a class="btn big" href="tel:' + esc(tel) + '">' + I('phone') + 'Call</a><button type="button" class="btn big cu-wa" onclick="Share.wa(\'' + esc(c.phone) + '\', \'\')">' + I('wa') + 'WhatsApp</button></div>' : '') +
      detailsHtml(c) + blacklistHtml(g) + notesHtml(g) + docsHtml(c) + bookingsHtml(g) + '</main>';
    return { html: html };
  }
  function statsLine(g) {
    var canc = g.bookings.length - g.rentals, paid = g.bookings.reduce(function (s, b) { return s + calcBooking(b).received; }, 0);
    var t = g.rentals + ' rental' + (g.rentals === 1 ? '' : 's') + (canc ? ', ' + canc + ' cancelled' : '');
    if (can('bookings.see_amounts')) t += ', ' + rm(paid) + ' paid';
    var last = g.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled' && new Date(b.start) <= new Date(); }).sort(function (a, b) { return new Date(b.start) - new Date(a.start); })[0];
    return t + (last ? '. Last rental ' + dFull(last.start) : '');
  }
  function bannerHtml(g) {
    var bl = can('customers.blacklist_view') ? g.members.filter(function (c) { return c.blacklist; })[0] : null, seeNotes = can('customer_notes.view');
    var lines = function (flag) { return seeNotes ? g.notes.filter(function (n) { return n.flag === flag; }).sort(noteOrder).slice(0, 2).map(function (n) { return n.text; }) : []; };
    var tone, title, ls, icon;
    if (bl) { tone = 'red'; icon = 'shield'; title = 'Blacklisted customer since ' + dFull(bl.blacklist.at); ls = [bl.blacklist.reason ? 'Reason: ' + bl.blacklist.reason : ''].concat(lines('careful')); }
    else if (g.flags.indexOf('Be careful') >= 0) { tone = 'amber'; icon = 'warn'; title = 'Be careful with this customer'; ls = lines('careful'); }
    else if (g.flags.indexOf('VIP') >= 0) { tone = 'blue'; icon = 'star'; title = 'VIP customer'; ls = lines('vip'); }
    else if (seeNotes && g.notes.length) { tone = 'blue'; icon = 'note'; title = 'Notes about this customer'; ls = lines('info'); }
    else { tone = 'blue'; icon = 'user'; title = g.rentals >= 2 ? 'Repeat customer' : g.rentals === 1 ? 'Rented once before' : 'No rentals yet'; ls = []; }
    ls = ls.filter(Boolean);
    return '<div class="banner ' + tone + ' cu-banner">' + I(icon) + '<div class="grow"><b>' + esc(title) + '</b>' + ls.map(function (l) { return '<div class="cu-bl">' + esc(l) + '</div>'; }).join('') + '<div class="cu-stats">' + esc(statsLine(g)) + '</div></div></div>';
  }
  function kv(k, v, cls) { return '<div' + (cls ? ' class="' + cls + '"' : '') + '><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>'; }
  function detailsHtml(c) {
    var full = can('customers.edit'), idv = c.ic ? (full ? c.ic : maskIC(c.ic)) : '', pp = c.passport ? (full ? c.passport : maskIC(c.passport)) : '';
    var exp = c.licenceExp, today = toLocalInput(new Date()), expired = exp && exp < today, soon = exp && !expired && daysUntil(exp + 'T00:00:00') <= 30;
    var em = c.emergency || {}, etel = telOf(em.phone);
    var nm = '<span class="muted">Not given</span>';
    return '<div class="sec"><h2>Details</h2>' + (can('customers.edit') ? '<button type="button" onclick="Cust.edit(\'' + c.id + '\')">Edit details</button>' : '') + '</div>' +
      '<div class="card cu-card"><div class="kv cu-kv">' +
      kv('Phone', c.phone ? esc(c.phone) : nm) + kv('Nationality', c.nationality ? esc(c.nationality) : nm) +
      kv('Email', c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : nm, 'wide') +
      kv('Address', c.address ? esc(c.address) : nm, 'wide') +
      kv('IC number', idv ? esc(idv) : nm) + kv('Passport', pp ? esc(pp) : nm) +
      kv('Licence number', c.licenceNo ? esc(c.licenceNo) : nm) +
      kv('Licence expiry', exp ? '<span class="' + (expired ? 'tone-red-text' : soon ? 'tone-amber-text' : '') + '">' + esc(dFull(exp + 'T00:00:00')) + (expired ? ' (expired)' : soon ? ' (soon)' : '') + '</span>' : nm) +
      '</div>' +
      '<div class="cu-emer"><div class="grow"><div class="k">Emergency contact</div><div class="v">' + (em.name ? esc(em.name) + (em.relation ? ' <span class="muted">(' + esc(em.relation) + ')</span>' : '') + (em.phone ? '<small>' + esc(em.phone) + '</small>' : '') : nm) + '</div></div>' +
      (etel ? '<a class="cu-ic" href="tel:' + esc(etel) + '" aria-label="Call the emergency contact">' + I('phone') + '</a>' : '') + '</div></div>';
  }
  function blacklistHtml(g) {
    if (!can('customers.blacklist_view')) return '';
    var c = g.c, bl = g.members.filter(function (x) { return x.blacklist; })[0], canEdit = can('customers.blacklist_edit');
    if (!bl && !canEdit) return '';
    return '<div class="sec"><h2>Blacklist</h2></div><div class="card cu-card cu-blk">' +
      (bl ? '<div class="cu-blrow"><span class="cu-blic red">' + I('shield') + '</span><div class="grow"><b>On the blacklist</b><div class="small">' + esc(bl.blacklist.reason || 'No reason given') + '</div><div class="tiny muted">Added by ' + esc(who(bl.blacklist.by) || 'staff') + ' on ' + esc(dFull(bl.blacklist.at)) + '</div></div></div>' +
          (canEdit ? '<button type="button" class="btn ghost cu-blbtn" onclick="Cust.unblacklist(\'' + bl.id + '\')">' + I('check') + 'Remove from blacklist</button>' : '')
        : '<div class="cu-blrow"><span class="cu-blic">' + I('shield') + '</span><div class="grow"><b>Not on the blacklist</b><div class="small muted">Blacklisted customers get a red warning on every new booking.</div></div></div>' +
          '<button type="button" class="btn danger cu-blbtn" onclick="Cust.blacklist(\'' + c.id + '\')">' + I('lock') + 'Blacklist customer</button>') + '</div>';
  }
  function noteOrder(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.at) - new Date(a.at); }
  function notesHtml(g) {
    if (!can('customer_notes.view')) return '';
    var list = g.notes.slice().sort(noteOrder), canEdit = can('customer_notes.edit'), canDel = can('customer_notes.delete');
    return '<div class="sec"><h2>Notes' + (list.length ? ' (' + list.length + ')' : '') + '</h2>' + (can('customer_notes.add') ? '<button type="button" onclick="Cust.note(\'' + g.c.id + '\')">' + 'Add note</button>' : '') + '</div>' +
      (list.length ? '<div class="list cu-notes">' + list.map(function (n) {
        var f = NOTE_FLAGS.filter(function (x) { return x.k === n.flag; })[0] || NOTE_FLAGS[0], b = n.booking ? bk(n.booking) : null;
        return '<div class="cu-note' + (n.pinned ? ' pinned' : '') + '"><div class="cu-nmain"><div class="cu-nhead">' + chip(f.label, f.tone) + (n.pinned ? '<span class="cu-pin" title="Pinned">' + I('pin') + 'Pinned</span>' : '') + '</div>' +
          '<div class="cu-ntext">' + esc(n.text) + '</div><div class="cu-nby">' + esc(who(n.by) || 'Staff') + ' · ' + esc(dFull(n.at)) + (b ? ' · from <a href="#booking/' + b.id + '">' + esc(b.code) + '</a>' : '') + '</div></div>' +
          ((canEdit || canDel) ? '<div class="cu-nact">' + (canEdit ? '<button type="button" class="cu-ic sm' + (n.pinned ? ' on' : '') + '" onclick="Cust.pin(\'' + n.id + '\')" aria-label="' + (n.pinned ? 'Unpin' : 'Pin to the top') + '">' + I('pin') + '</button><button type="button" class="cu-ic sm" onclick="Cust.note(\'' + n.cust + '\', \'' + n.id + '\')" aria-label="Edit note">' + I('edit') + '</button>' : '') +
            (canDel ? '<button type="button" class="cu-ic sm red" onclick="Cust.delNote(\'' + n.id + '\')" aria-label="Delete note">' + I('trash') + '</button>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div>' : '<div class="card cu-card cu-none">No notes yet.' + (can('customer_notes.add') ? ' Add a note so the next person who books this customer knows, like a warning or a VIP mark.' : '') + '</div>');
  }
  function docsHtml(c) {
    if (!can('customers.view_documents')) return '';
    var d = c.docs || {}, items = [];
    DOCS.forEach(function (s) { if (s.k === 'other') (d.other || []).forEach(function (o, i) { items.push({ k: 'other', i: i, label: 'Other ' + (i + 1), src: o && o.src ? o.src : o }); }); else if (d[s.k]) items.push({ k: s.k, label: s.label, src: d[s.k] }); });
    var missing = DOCS.filter(function (s) { return s.k !== 'other' && s.k !== 'passport' && !d[s.k]; }).map(function (s) { return s.label; });
    return '<div class="sec"><h2>Documents</h2></div><div class="card cu-card">' +
      (items.length ? '<div class="thumbs cu-thumbs">' + items.map(function (it) { return '<button type="button" class="thumb cu-thumb" onclick="Cust.zoom(\'' + c.id + '\', \'' + it.k + '\', ' + (it.i == null ? -1 : it.i) + ')"><img src="' + esc(imgSrc(it.src)) + '" alt="' + esc(it.label) + '"><span>' + esc(it.label) + '</span></button>'; }).join('') + '</div>' : '<div class="small muted">No IC or licence photos yet.</div>') +
      (missing.length && items.length ? '<div class="tiny muted cu-miss">Missing: ' + esc(missing.join(', ')) + '</div>' : '') +
      '<div class="cu-docbtns">' + (can('customers.edit') ? '<button type="button" class="btn ghost sm" onclick="Cust.addDoc(\'' + c.id + '\')">' + I('camera') + 'Add photo</button>' : '') +
      (can('customers.check_ic') ? '<button type="button" class="btn ghost sm" onclick="Cust.checkIC(\'' + c.id + '\')">' + I('shield') + 'Check IC</button>' : '') + '</div></div>';
  }
  function bookingsHtml(g) {
    var c = g.c, canBook = can('bookings.create');
    if (!can('bookings.view')) return canBook ? '<button type="button" class="btn big cu-again" onclick="Cust.bookAgain(\'' + c.id + '\')">' + I('plus') + 'Book again</button>' : '';
    var list = g.bookings.slice().sort(function (a, b) { return new Date(b.start) - new Date(a.start); }), more = list.length > 6 && !Cust._all;
    var shown = more ? list.slice(0, 6) : list;
    return '<div class="sec"><h2>Bookings (' + list.length + ')</h2></div>' +
      (list.length ? '<div class="list cu-bks">' + shown.map(function (b) {
        var cr = car(b.car) || {};
        return '<a class="card2 cu-bk" href="#booking/' + b.id + '"><div class="c2-main"><div class="c2-t1"><span class="cu-code">' + esc(b.code) + '</span> ' + statusChip(b) + '</div>' +
          '<div class="c2-t2">' + esc((cr.plate || 'No car') + (cr.model ? ' · ' + cr.make + ' ' + cr.model : '')) + '</div><div class="c2-t2">' + esc(dShort(b.start) + ', ' + hm(b.start) + ' → ' + dShort(b.end) + ', ' + hm(b.end)) + (new Date(b.start).getFullYear() !== new Date().getFullYear() ? ' ' + new Date(b.start).getFullYear() : '') + '</div></div>' +
          (can('bookings.see_amounts') && b.bookingStatus !== 'Cancelled' ? '<div class="c2-end money">' + rm(calcBooking(b).payable) + '<small>' + (calcBooking(b).due > 0.99 ? 'due ' + rm(calcBooking(b).due) : 'paid') + '</small></div>' : '<span class="cu-chev">' + I('chev') + '</span>') + '</a>';
      }).join('') + '</div>' + (more ? '<button type="button" class="btn link cu-all" onclick="Cust._all=true;render(false,true)">Show all ' + list.length + ' bookings</button>' : '') : '<div class="card cu-card cu-none">No bookings yet.</div>') +
      (canBook ? '<button type="button" class="btn big cu-again" onclick="Cust.bookAgain(\'' + c.id + '\')">' + I('plus') + (list.length ? 'Book again' : 'Make a booking') + '</button>' : '');
  }

  /* ---------- actions ---------- */
  function refresh() { if (route().name === 'customer') render(false, true); }
  function editSheet(id) {
    var c = byId(S.customers, id); if (!c || !can('customers.edit')) return;
    var em = c.emergency || {};
    var f = function (k, label, v, type, extra) { return '<label class="field"><span>' + esc(label) + '</span><input class="inp" id="ce_' + k + '" type="' + (type || 'text') + '" value="' + esc(v || '') + '"' + (extra || '') + '><div class="err" id="ce_' + k + '_err"></div></label>'; };
    var nats = ['Malaysian', 'Singaporean', 'Indonesian', 'Thai', 'Bangladeshi', 'Filipino', 'Chinese', 'Indian', 'British', 'Australian', 'Japanese', 'Other'];
    if (c.nationality && nats.indexOf(c.nationality) < 0) nats.unshift(c.nationality);
    sheet(sheetHead('Edit details', c.name) + '<div class="cu-form">' +
      f('name', 'Full name', c.name, 'text', ' autocomplete="off"') + f('phone', 'Phone', c.phone, 'tel', ' inputmode="tel"') + f('email', 'Email', c.email, 'email', ' inputmode="email" autocapitalize="off"') +
      '<label class="field"><span>Nationality</span><select class="inp" id="ce_nat">' + nats.map(function (n) { return '<option' + (n === (c.nationality || 'Malaysian') ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      f('ic', 'IC number', c.ic, 'text', ' inputmode="numeric" placeholder="900101-14-5678"') + f('passport', 'Passport number', c.passport, 'text', ' autocapitalize="characters"') +
      '<div class="cu-2">' + f('lic', 'Licence number', c.licenceNo, 'text', ' autocapitalize="characters"') + f('exp', 'Licence expiry', c.licenceExp, 'date') + '</div>' +
      '<label class="field"><span>Address</span><textarea class="inp" id="ce_addr" rows="2">' + esc(c.address || '') + '</textarea></label>' +
      '<div class="cu-sub-h">Emergency contact</div>' + f('ename', 'Name', em.name) + '<div class="cu-2">' + f('ephone', 'Phone', em.phone, 'tel', ' inputmode="tel"') + f('erel', 'Relation', em.relation) + '</div>' +
      '</div><div class="sheet-foot"><button type="button" class="btn" id="ce_save">Save details</button></div>', function (sh) {
        $('#ce_save', sh).onclick = function () {
          var v = function (k) { return $('#ce_' + k, sh).value.trim(); }, bad = false;
          $$('.err', sh).forEach(function (e) { e.textContent = ''; }); $$('.inp.bad', sh).forEach(function (e) { e.classList.remove('bad'); });
          var err = function (k, t) { $('#ce_' + k + '_err', sh).textContent = t; $('#ce_' + k, sh).classList.add('bad'); if (!bad) $('#ce_' + k, sh).focus(); bad = true; };
          if (v('name').length < 2) err('name', 'Type the customer’s full name');
          if (digits(v('phone')).length < 9) err('phone', 'Type a phone number with at least 9 digits');
          if (v('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) err('email', 'This email does not look right');
          var ic = v('ic'); if (ic) { if (digits(ic).length === 12) { var d = digits(ic); ic = d.slice(0, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8); } else err('ic', 'An IC number has 12 digits'); }
          if (v('ephone') && digits(v('ephone')).length < 9) err('ephone', 'At least 9 digits');
          if (bad) return;
          var next = { name: v('name'), phone: fmtPhone(v('phone')), email: v('email'), nationality: $('#ce_nat', sh).value, ic: ic, passport: v('passport').toUpperCase(), licenceNo: v('lic').toUpperCase(), licenceExp: v('exp') || null, address: v('addr') };
          var changes = {}, labels = { name: 'Name', phone: 'Phone', email: 'Email', nationality: 'Nationality', ic: 'IC', passport: 'Passport', licenceNo: 'Licence no.', licenceExp: 'Licence expiry', address: 'Address' };
          Object.keys(next).forEach(function (k) { if (String(c[k] || '') !== String(next[k] || '')) changes[labels[k]] = [k === 'ic' ? maskIC(c[k]) : c[k] || '', k === 'ic' ? maskIC(next[k]) : next[k] || '']; });
          var ne = { name: v('ename'), phone: v('ephone') ? fmtPhone(v('ephone')) : '', relation: v('erel') };
          if (JSON.stringify(ne) !== JSON.stringify({ name: em.name || '', phone: em.phone || '', relation: em.relation || '' })) changes['Emergency contact'] = [em.name || '', ne.name];
          if (!Object.keys(changes).length) { closeSheet(); say('Nothing changed'); return; }
          Object.assign(c, next); c.emergency = ne;
          audit('Changed the details of ' + c.name, { cust: c.id, changes: changes, link: '#customer/' + c.id });
          save(); closeSheet(); refresh(); say('Details saved');
        };
      });
  }
  function noteSheet(custId, noteId) {
    var c = byId(S.customers, custId); if (!c) return;
    var n = noteId ? byId(S.notes, noteId) : null;
    if (n ? !can('customer_notes.edit') : !can('customer_notes.add')) { say('Ask the owner for note access'); return; }
    var flag = n ? n.flag : 'info', pinned = n ? !!n.pinned : false;
    var bks = S.bookings.filter(function (b) { return b.cust === custId; }).sort(function (a, b) { return new Date(b.start) - new Date(a.start); }).slice(0, 8);
    sheet(sheetHead(n ? 'Edit note' : 'Add a note', 'About ' + c.name + '. Every staff member sees it on this customer’s bookings.') +
      '<div class="cu-flags" id="cn_flags">' + NOTE_FLAGS.map(function (f) { return '<button type="button" class="cu-flag t-' + f.tone + (f.k === flag ? ' on' : '') + '" data-f="' + f.k + '">' + I(f.icon) + '<b>' + esc(f.label) + '</b><small>' + esc(f.hint) + '</small></button>'; }).join('') + '</div>' +
      '<label class="field"><span>What should staff know?</span><textarea class="inp cu-ta" id="cn_text" rows="3" placeholder="For example: always returns the car late, remind about the late fee.">' + esc(n ? n.text : '') + '</textarea><div class="err" id="cn_err"></div></label>' +
      '<div class="chiprow cu-phr">' + PHRASES.map(function (p) { return '<button type="button" class="fchip" data-p="' + esc(p) + '">' + I('plus', 2.2) + esc(p) + '</button>'; }).join('') + '</div>' +
      (bks.length ? '<label class="field"><span>From a booking (optional)</span><select class="inp" id="cn_bk"><option value="">Not about one booking</option>' + bks.map(function (b) { return '<option value="' + b.id + '"' + (n && n.booking === b.id ? ' selected' : '') + '>' + esc(b.code + ' · ' + dShort(b.start) + ' · ' + ((car(b.car) || {}).plate || '')) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="cu-pinrow"><span class="grow"><b>Pin to the top</b><small>Pinned notes show first, and in the warning on new bookings</small></span><span class="sw"><input type="checkbox" id="cn_pin"' + (pinned ? ' checked' : '') + '><i></i></span></label>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="cn_save">' + (n ? 'Save note' : 'Add note') + '</button></div>', function (sh) {
        $$('#cn_flags button', sh).forEach(function (b) { b.onclick = function () { $$('#cn_flags button', sh).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); flag = b.dataset.f; }; });
        var ta = $('#cn_text', sh);
        $$('.cu-phr button', sh).forEach(function (b) { b.onclick = function () { var t = ta.value.trim(); ta.value = t ? t.replace(/[.\s]*$/, '') + '. ' + b.dataset.p + '.' : b.dataset.p + '.'; $('#cn_err', sh).textContent = ''; ta.classList.remove('bad'); }; });
        $('#cn_save', sh).onclick = function () {
          var t = ta.value.trim();
          if (t.length < 3) { $('#cn_err', sh).textContent = 'Write a few words for the note'; ta.classList.add('bad'); ta.focus(); return; }
          if (t.length > 500) { $('#cn_err', sh).textContent = 'Keep it under 500 letters'; ta.classList.add('bad'); return; }
          var bsel = $('#cn_bk', sh), bid = bsel ? bsel.value || null : null, pin = $('#cn_pin', sh).checked;
          S.notes = S.notes || [];
          if (n) { var ch = {}; if (n.text !== t) ch.Text = [n.text, t]; if (n.flag !== flag) ch.Flag = [n.flag, flag]; n.text = t; n.flag = flag; n.pinned = pin; n.booking = bid; audit('Changed a note about ' + c.name, { cust: c.id, changes: ch, link: '#customer/' + c.id }); }
          else { S.notes.push({ id: uid(), cust: c.id, flag: flag, text: t, pinned: pin, by: S.me, at: new Date().toISOString(), booking: bid }); audit('Added a ' + (NOTE_FLAGS.filter(function (x) { return x.k === flag; })[0].label) + ' note about ' + c.name, { cust: c.id, link: '#customer/' + c.id }); }
          save(); closeSheet(); refresh(); say(n ? 'Note saved' : 'Note added');
        };
        if (!n) setTimeout(function () { try { ta.focus({ preventScroll: true }); } catch (e) {} }, 320);
      });
  }
  function togglePin(id) { var n = byId(S.notes, id); if (!n || !can('customer_notes.edit')) return; n.pinned = !n.pinned; save(); refresh(); say(n.pinned ? 'Pinned to the top' : 'Unpinned'); }
  function delNote(id) {
    var n = byId(S.notes, id); if (!n || !can('customer_notes.delete')) return;
    confirm({ icon: 'danger', title: 'Delete this note?', text: 'It will disappear for everyone and cannot be brought back.', ok: 'Yes, delete', cancel: 'Keep it', danger: true }).then(function (ok) {
      if (!ok) return; S.notes = S.notes.filter(function (x) { return x.id !== id; });
      audit('Deleted a note about ' + cust(n.cust).name + ': ' + n.text, { cust: n.cust, link: '#customer/' + n.cust }); save(); refresh(); say('Note deleted');
    });
  }
  function blacklistSheet(id) {
    var c = byId(S.customers, id); if (!c || !can('customers.blacklist_edit')) return;
    if (!String(c.ic || c.passport || '').trim()) {
      confirm({ icon: 'warn', title: 'This customer has no IC / Passport No.', text: 'The blacklist works on the IC or passport number. Add it to the customer’s details first.', ok: can('customers.edit') ? 'Add the IC now' : 'OK', cancel: 'Not now' }).then(function (ok) { if (ok && can('customers.edit')) editSheet(id); });
      return;
    }
    sheet(sheetHead('Blacklist ' + c.name + '?', 'IC / passport ' + maskIC(c.ic || c.passport) + '. Staff will see a red warning when they book this person.') +
      '<label class="field"><span>Why? (required)</span><textarea class="inp" id="bl_reason" rows="3" placeholder="What happened"></textarea><div class="err" id="bl_err"></div></label>' +
      '<div class="chiprow cu-phr">' + BL_REASONS.map(function (p) { return '<button type="button" class="fchip" data-p="' + esc(p) + '">' + esc(p) + '</button>'; }).join('') + '</div>' +
      '<div class="sheet-foot"><button type="button" class="btn danger solid" id="bl_go">' + I('lock') + 'Blacklist customer</button></div>', function (sh) {
        var ta = $('#bl_reason', sh);
        $$('.cu-phr button', sh).forEach(function (b) { b.onclick = function () { ta.value = b.dataset.p; $('#bl_err', sh).textContent = ''; ta.classList.remove('bad'); }; });
        $('#bl_go', sh).onclick = function () {
          var t = ta.value.trim(); if (t.length < 3) { $('#bl_err', sh).textContent = 'Write the reason, so other staff know what happened'; ta.classList.add('bad'); ta.focus(); return; }
          c.blacklist = { reason: t, by: S.me, at: new Date().toISOString() };
          audit('Blacklisted ' + c.name + ': ' + t, { cust: c.id, link: '#customer/' + c.id }); save(); closeSheet(); refresh(); say('Customer added to the blacklist');
        };
      });
  }
  function unblacklist(id) {
    var c = byId(S.customers, id); if (!c || !c.blacklist || !can('customers.blacklist_edit')) return;
    confirm({ icon: 'warn', title: 'Remove from the blacklist?', text: c.name + ' will be able to book again without the red warning.', ok: 'Yes, remove', cancel: 'Keep on the blacklist' }).then(function (ok) {
      if (!ok) return; var old = c.blacklist; c.blacklist = null;
      audit('Removed ' + c.name + ' from the blacklist (was: ' + (old.reason || 'no reason') + ')', { cust: c.id, link: '#customer/' + c.id }); save(); refresh(); say('Customer removed from the blacklist');
    });
  }
  function bookAgain(id) {
    var g = groupOf(id); if (!g) return;
    var go = function () { location.hash = hashWith('new', { cust: id }); };
    if (g.flags.indexOf('Blacklisted') >= 0) confirm({ icon: 'danger', title: 'This customer is blacklisted', text: 'Check with the owner before you book a car for ' + g.c.name + '.', ok: 'Book anyway', cancel: 'Do not book', primary: 'cancel', danger: true }).then(function (ok) { if (ok) go(); });
    else go();
  }
  function zoom(id, k, i) {
    var c = byId(S.customers, id); if (!c) return; var d = c.docs || {};
    var src = k === 'other' ? d.other && d.other[i] : d[k], label = k === 'other' ? 'Other ' + (i + 1) : (DOCS.filter(function (s) { return s.k === k; })[0] || {}).label;
    if (src && src.src) src = src.src;
    if (!src) return;
    sheet(sheetHead(label, c.name) + '<div class="cu-zoom"><img src="' + esc(imgSrc(src)) + '" alt="' + esc(label) + '"></div>' +
      (can('customers.edit') ? '<div class="sheet-foot cu-zfoot"><button type="button" class="btn ghost" id="cz_new">' + I('camera') + 'New photo</button><button type="button" class="btn link red" id="cz_del">Remove photo</button></div>' : ''), function (sh) {
        var nb = $('#cz_new', sh); if (nb) nb.onclick = function () { closeSheet(); takeDoc(id, k, i); };
        var db = $('#cz_del', sh); if (db) db.onclick = function () {
          confirm({ icon: 'danger', title: 'Remove this photo?', text: label + ' of ' + c.name + ' will be removed.', ok: 'Yes, remove', cancel: 'Keep it', danger: true }).then(function (ok) {
            if (!ok) return; if (k === 'other') d.other.splice(i, 1); else d[k] = null; c.docs = d; audit('Removed the ' + label + ' photo of ' + c.name, { cust: c.id }); save(); closeAllSheets(); refresh(); say('Photo removed');
          });
        };
      }, { stack: true, full: true });
  }
  function addDoc(id) {
    var c = byId(S.customers, id); if (!c) return; var d = c.docs || {};
    sheet(sheetHead('Add a photo', 'Which paper is it?') + '<div class="list cu-slots">' + DOCS.map(function (s) {
      var has = s.k === 'other' ? (d.other || []).length : !!d[s.k];
      return '<button type="button" class="row" data-k="' + s.k + '">' + I(s.k === 'licence' ? 'car' : s.k === 'poa' ? 'map' : s.k === 'other' ? 'image' : 'user') + '<div class="grow"><div class="t1">' + esc(s.label) + '</div><div class="t2">' + (has ? (s.k === 'other' ? has + ' added, add one more' : 'Already added, this replaces it') : 'Not added yet') + '</div></div>' + (has && s.k !== 'other' ? chip('Added', 'green') : '') + '</button>';
    }).join('') + '</div><button type="button" class="btn link cu-sample" id="cd_sample">No camera? Use a sample picture</button>', function (sh) {
      var sample = false;
      $('#cd_sample', sh).onclick = function () { sample = !sample; this.textContent = sample ? 'Sample picture on: tap a paper' : 'No camera? Use a sample picture'; };
      $$('[data-k]', sh).forEach(function (b) { b.onclick = function () { var k = b.dataset.k; closeSheet(); takeDoc(id, k, -1, sample); }; });
    });
  }
  function takeDoc(id, k, i, sample) {
    var c = byId(S.customers, id); if (!c) return; var s = DOCS.filter(function (x) { return x.k === k; })[0];
    var p = sample ? Media.sample(s.demo, s.label) : Media.photo({ maxPx: 1000, quality: 0.7 });
    p.then(function (res) {
      var d = c.docs = c.docs || { icFront: null, icBack: null, passport: null, licence: null, poa: null, other: [] }; d.other = d.other || [];
      if (k === 'other') { if (i >= 0) d.other[i] = res.dataUrl; else d.other.push(res.dataUrl); } else d[k] = res.dataUrl;
      audit('Added the ' + s.label + ' photo of ' + c.name, { cust: c.id }); save(); refresh(); say(res.note && res.note !== 'Sample picture (demo)' ? s.label + ' saved. ' + res.note : s.label + ' saved');
    }, function (e) { if (e !== 'cancel') say('Could not read that picture. Try another one.'); });
  }
  function checkIC(id) {
    var c = byId(S.customers, id); if (!c) return;
    if (typeof IdCheck === 'undefined' || !IdCheck.open) { comingSoon('IC check'); return; }
    IdCheck.open({ custId: c.id, name: c.name, ic: c.ic, docs: c.docs,
      onFill: function (p) { if (!p || !can('customers.edit')) return; var ch = {}; ['name', 'ic', 'passport', 'nationality', 'licenceNo', 'licenceExp'].forEach(function (k) { if (p[k] && p[k] !== c[k]) { ch[k] = [c[k] || '', p[k]]; c[k] = p[k]; } }); if (Object.keys(ch).length) { audit('Filled details of ' + c.name + ' from the IC check', { cust: c.id, changes: ch }); save(); } },
      onDocs: function (docs) { if (docs) { c.docs = Object.assign({}, c.docs || {}, docs); save(); } },
      onClose: function () { refresh(); } });
  }

  VIEWS.customers = listView;
  VIEWS.customer = function (r) { if (Cust._for !== r.a) { Cust._all = false; Cust._for = r.a; } return pageView(r); };
  return {
    open: function (id) { location.hash = '#customer/' + id; },
    edit: editSheet, note: noteSheet, pin: togglePin, delNote: delNote, blacklist: blacklistSheet, unblacklist: unblacklist,
    bookAgain: bookAgain, zoom: zoom, addDoc: addDoc, checkIC: checkIC, people: people, groupOf: groupOf,
    /* the customer whose phone matches (used by WhatsApp threads) */
    byPhone: function (phone) { var p = phoneCore(phone); if (!p) return null; return S.customers.filter(function (c) { return phoneCore(c.phone) === p; })[0] || null; }
  };
})();
