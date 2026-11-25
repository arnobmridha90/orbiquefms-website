/* ---------------- PICKERS (core builder owns this file; nobody else edits it) ----------------
   Full-height searchable sheets, stacked over whatever is open, closed by the phone's Back button.
   Pickers.car({start, end, exceptId, selected, onPick, showBusy, title, all})
   Pickers.booking({filter, onPick, title, selected})
   Pickers.customer({onPick, title, allowNew})
   Pickers.staff({multi, preferIds, selected, onPick, title, includeOff})
   onPick gets the picked object (car / booking / customer / staff, or an array of staff when multi). */
var Pickers = (function () {
  function shell(title, sub, extra) {
    return '<div class="pk-head"><div class="sheet-head"><div class="grow"><h3>' + esc(title) + '</h3>' + (sub ? '<p class="lead">' + esc(sub) + '</p>' : '') + '</div><button class="iconbtn" type="button" onclick="closeSheet()" aria-label="Close">' + I('x', 2.2) + '</button></div>' +
      '<label class="search pk-search">' + I('search') + '<input id="pkq" type="search" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"><button type="button" class="pk-clear" aria-label="Clear" hidden>' + I('x', 2.2) + '</button></label>' + (extra || '') + '</div><div class="pk-list" id="pklist"></div>';
  }
  function wireSearch(sh, draw, opts) {
    var q = $('#pkq', sh), clr = $('.pk-clear', sh), tmr = null;
    if (opts && opts.caps) q.setAttribute('autocapitalize', 'characters');
    q.setAttribute('inputmode', opts && opts.mode || 'text');
    q.addEventListener('input', function () { clr.hidden = !q.value; clearTimeout(tmr); tmr = setTimeout(draw, 90); });
    clr.onclick = function () { q.value = ''; clr.hidden = true; draw(); q.focus(); };
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var first = $('#pklist [data-pick]:not([disabled])', sh); if (first) { e.preventDefault(); first.click(); } } });
    setTimeout(function () { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } }, 320);
    return q;
  }
  function remember(listKey, id) { var a = (S[listKey] || []).filter(function (x) { return x !== id; }); a.unshift(id); S[listKey] = a.slice(0, 5); save(); }

  /* ---------- car ---------- */
  function carPick(o) {
    o = o || {};
    var hasDates = !!(o.start && o.end), freeOnly = hasDates && !o.showBusy, type = 'All';
    var types = ['All'].concat(Object.keys(S.cars.reduce(function (m, c) { if (c.status !== 'sold') m[c.type || 'Car'] = 1; return m; }, {})).sort());
    var sub = hasDates ? dLong(o.start) + ', ' + hm(o.start) + ' to ' + dLong(o.end) + ', ' + hm(o.end) : 'Search by plate, model or colour';
    var extra = (hasDates ? '<label class="pk-toggle"><span>Free for these dates only</span><span class="sw"><input type="checkbox" id="pkfree"' + (freeOnly ? ' checked' : '') + '><i></i></span></label>' : '') +
      '<div class="chiprow pk-types">' + types.map(function (t) { return '<button type="button" class="fchip' + (t === 'All' ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
    var sh = sheet(shell(o.title || 'Choose a car', sub, extra), null, { full: true, stack: true, cls: 'picker' });
    var q;
    var draw = function () {
      var term = q.value.trim(), np = normPlate(term), rows = [];
      S.cars.forEach(function (c) {
        if ((c.status === 'sold' || c.status === 'inactive') && c.id !== o.selected && !o.all) return; /* o.all: also sold and not-in-use cars (filters on old bookings) */
        if (type !== 'All' && (c.type || 'Car') !== type) return;
        if (term) { var hit = normPlate(c.plate).indexOf(np) >= 0 || wordsMatch(term, [c.make, c.model, c.color, c.type, c.serial, c.year].join(' ')); if (!hit) return; }
        var bz = hasDates ? busy(c.id, o.start, o.end, o.exceptId) : { free: c.status === 'active', reason: c.status === 'inactive' ? 'Not in use' : c.status === 'sold' ? 'Sold' : '' };
        rows.push({ c: c, bz: bz });
      });
      var recent = !term ? (S.recentCars || []) : [];
      var rank = function (r) { return r.bz.free ? (r.bz.soon ? 1 : 0) : 2; };
      rows.sort(function (a, b) { var ra = recent.indexOf(a.c.id), rb = recent.indexOf(b.c.id); if (ra >= 0 || rb >= 0) { if (ra < 0) return 1; if (rb < 0) return -1; if (rank(a) !== rank(b)) return rank(a) - rank(b); return ra - rb; } return rank(a) - rank(b) || a.c.plate.localeCompare(b.c.plate); });
      var hidden = 0;
      if (freeOnly) rows = rows.filter(function (r) { if (!r.bz.free && r.c.id !== o.selected) { hidden++; return false; } return true; });
      var nFree = rows.filter(function (r) { return r.bz.free; }).length;
      var html = '';
      var row = function (r) {
        var c = r.c, bz = r.bz, pickable = bz.free || o.showBusy, badge;
        if (!bz.free) badge = '<span class="chip tone-red pk-badge">' + esc(bz.reason) + '</span>';
        else if (bz.soon) badge = '<span class="chip tone-amber pk-badge">Check: ' + esc(bz.soon.replace(/^Returned at /, 'returned ').replace(/^Next rental at /, 'next rental ')) + '</span>';
        else if (c.status === 'active' && carPaper && (function () { var rt = carPaper(c.id, 'Road tax'); return rt && rt.until < toLocalInput(new Date()); })()) badge = '<span class="chip tone-red pk-badge">Road tax expired</span>';
        else if (hasDates) badge = '<span class="chip tone-green pk-badge">Free</span>';
        else badge = '';
        return '<button type="button" class="pk-row car' + (c.id === o.selected ? ' on' : '') + (pickable ? '' : ' busy') + '" data-pick="' + c.id + '"' + (pickable ? '' : ' disabled aria-disabled="true"') + '>' +
          '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model + ' · ' + c.color) + ' · <span class="money">' + rm(c.rate) + '</span> / day</span></span>' + badge + '</button>';
      };
      if (recent.length && !term) {
        var rec = rows.filter(function (r) { return recent.indexOf(r.c.id) >= 0; }), rest = rows.filter(function (r) { return recent.indexOf(r.c.id) < 0; });
        if (rec.length) html += '<div class="pk-sec">Recently picked</div>' + rec.map(row).join('');
        if (rest.length) html += '<div class="pk-sec">' + (hasDates ? nFree + ' free' + (freeOnly ? '' : ' of ' + rows.length) : 'All cars') + '</div>' + rest.map(row).join('');
      } else html += (term ? '<div class="pk-sec">' + rows.length + ' match' + (rows.length === 1 ? '' : 'es') + ' for “' + esc(term) + '”</div>' : '<div class="pk-sec">' + (hasDates ? nFree + ' free' : rows.length + ' cars') + '</div>') + rows.map(row).join('');
      if (!rows.length) html += '<div class="empty">No car matches' + (term ? ' “' + esc(term) + '”' : '') + (hidden ? '.<br>' + hidden + ' booked car' + (hidden > 1 ? 's are' : ' is') + ' hidden.' : '.') + '</div>';
      if (hidden) html += '<button type="button" class="pk-more" id="pkshowbusy">' + hidden + ' booked or blocked car' + (hidden > 1 ? 's' : '') + ' hidden · Show them</button>';
      $('#pklist', sh).innerHTML = html;
      $$('#pklist [data-pick]', sh).forEach(function (b) { b.onclick = function () { var c = car(b.dataset.pick); remember('recentCars', c.id); closeSheet(); if (o.onPick) o.onPick(c); }; });
      var sb = $('#pkshowbusy', sh); if (sb) sb.onclick = function () { freeOnly = false; var t = $('#pkfree', sh); if (t) t.checked = false; draw(); };
    };
    q = wireSearch(sh, draw, { caps: true });
    q.placeholder = 'Plate, model or colour';
    var fr = $('#pkfree', sh); if (fr) fr.onchange = function () { freeOnly = fr.checked; draw(); };
    $$('.pk-types button', sh).forEach(function (b) { b.onclick = function () { $$('.pk-types button', sh).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); type = b.dataset.t; draw(); }; });
    draw();
    return sh;
  }

  /* ---------- booking ---------- */
  function bookingMatches(b, term) {
    if (!term) return true;
    if (matchBookingCode(term, b)) return true;
    var c = cust(b.cust), k = car(b.car) || {};
    if (tidySearch(term)) return phoneMatch(term, c.phone);
    if (normPlate(term).length >= 3 && normPlate(k.plate).indexOf(normPlate(term)) >= 0) return true;
    return wordsMatch(term, [b.code, c.name, k.make, k.model, k.plate].join(' '));
  }
  function bookingPick(o) {
    o = o || {};
    var showCancelled = false;
    var extra = '<label class="pk-toggle"><span>Show cancelled</span><span class="sw"><input type="checkbox" id="pkcan"><i></i></span></label>';
    var sh = sheet(shell(o.title || 'Choose a booking', 'Booking number, name, phone or plate'), null, { full: true, stack: true, cls: 'picker' });
    $('.pk-head', sh).insertAdjacentHTML('beforeend', extra);
    var q;
    var draw = function () {
      var term = q.value.trim(), now = Date.now();
      var list = S.bookings.filter(function (b) { return (showCancelled || b.bookingStatus !== 'Cancelled') && (!o.filter || o.filter(b)) && bookingMatches(b, term); });
      var recent = S.recentBookings || [];
      var score = function (b) { if (recent.indexOf(b.id) >= 0 && !term) return -10 + recent.indexOf(b.id); if (b.bookingStatus === 'Car Delivered') return 0; return 1 + Math.abs(new Date(b.start) - now) / DAY / 1000; };
      list.sort(function (a, b) { return score(a) - score(b); });
      var total = list.length; list = list.slice(0, 60);
      var html = '<div class="pk-sec">' + (term ? total + ' match' + (total === 1 ? '' : 'es') : 'Recent and out now first') + '</div>' + list.map(function (b) {
        var c = cust(b.cust), k = car(b.car) || {}, m = calcBooking(b);
        return '<button type="button" class="pk-row' + (b.id === o.selected ? ' on' : '') + '" data-pick="' + b.id + '"><span class="grow"><span class="pk-l1"><b>' + esc(b.code) + '</b> ' + esc(c.name) + '</span>' +
          '<span class="pk-sub">' + esc(k.plate || '') + ' · ' + dShort(b.start) + ' to ' + dShort(b.end) + '</span></span><span class="pk-end">' + (payChip(b) || statusChip(b)) + (m.due && b.bookingStatus !== 'Cancelled' ? '<span class="bal due money">' + rm(m.due) + ' due</span>' : '') + '</span></button>';
      }).join('') + (total > 60 ? '<div class="empty small">Showing 60 of ' + total + '. Type more to narrow it down.</div>' : '') + (!total ? '<div class="empty">No booking matches “' + esc(term) + '”.</div>' : '');
      $('#pklist', sh).innerHTML = html;
      $$('#pklist [data-pick]', sh).forEach(function (el) { el.onclick = function () { var b = bk(el.dataset.pick); remember('recentBookings', b.id); closeSheet(); if (o.onPick) o.onPick(b); }; });
    };
    q = wireSearch(sh, draw);
    q.placeholder = 'KLT-00012, 12, name, phone or plate'.replace('KLT', B().codePrefix || B().code);
    $('#pkcan', sh).onchange = function () { showCancelled = this.checked; draw(); };
    draw();
    return sh;
  }

  /* ---------- customer ---------- */
  function customerMatches(c, term) {
    if (!term) return true;
    if (tidySearch(term)) return phoneMatch(term, c.phone) || digits(c.ic).indexOf(digits(term)) >= 0;
    return wordsMatch(term, [c.name, c.email, c.ic, c.passport, c.licenceNo].join(' ')) || normPlate(c.ic).indexOf(normPlate(term)) >= 0;
  }
  function customerPick(o) {
    o = o || {};
    var sh = sheet(shell(o.title || 'Choose a customer', 'Name, phone, IC or email'), null, { full: true, stack: true, cls: 'picker' });
    var q;
    var count = function (c) { return S.bookings.filter(function (b) { return b.cust === c.id && b.bookingStatus !== 'Cancelled'; }).length; };
    var draw = function () {
      var term = q.value.trim(), list = S.customers.filter(function (c) { return customerMatches(c, term); });
      list.sort(function (a, b) { return term ? a.name.localeCompare(b.name) : count(b) - count(a); });
      var total = list.length; list = list.slice(0, 60);
      var html = (o.allowNew && term ? '<button type="button" class="pk-row pk-new" id="pknew">' + I('plus', 2.2) + '<span class="grow"><span class="pk-l1">New customer</span><span class="pk-sub">“' + esc(term) + '”</span></span></button>' : '') +
        '<div class="pk-sec">' + (term ? total + ' match' + (total === 1 ? '' : 'es') : 'Most bookings first') + '</div>' + list.map(function (c) {
          var n = count(c);
          return '<button type="button" class="pk-row" data-pick="' + c.id + '"><span class="av sm" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</span><span class="grow"><span class="pk-l1">' + esc(c.name) + '</span><span class="pk-sub nowrap">' + esc(c.phone) + (c.ic ? ' · ' + esc(maskIC(c.ic)) : '') + ' · ' + n + ' booking' + (n === 1 ? '' : 's') + '</span></span><span class="pk-end">' + custFlags(c).slice(0, 2).map(flagChip).join('') + '</span></button>';
        }).join('') + (!total ? '<div class="empty">No customer matches “' + esc(term) + '”.</div>' : '');
      $('#pklist', sh).innerHTML = html;
      $$('#pklist [data-pick]', sh).forEach(function (el) { el.onclick = function () { var c = cust(el.dataset.pick); closeSheet(); if (o.onPick) o.onPick(c); }; });
      var nw = $('#pknew', sh); if (nw) nw.onclick = function () { closeSheet(); if (o.onPick) o.onPick(null, term); };
    };
    q = wireSearch(sh, draw);
    q.placeholder = 'Name, phone, IC or email';
    q.addEventListener('input', function () { q.setAttribute('inputmode', /^[\d+]/.test(q.value) ? 'tel' : 'text'); });
    draw();
    return sh;
  }

  /* ---------- staff ---------- */
  function staffPick(o) {
    o = o || {};
    var chosen = (o.selected || []).slice(), prefer = o.preferIds || [];
    var sh = sheet(shell(o.title || (o.multi ? 'Choose staff' : 'Choose a person'), o.multi ? 'Tick everyone who should get it' : '') + (o.multi ? '<div class="sheet-foot"><button type="button" class="btn" id="pkdone">Done</button></div>' : ''), null, { full: true, stack: true, cls: 'picker' });
    var q;
    var draw = function () {
      var term = q.value.trim();
      var list = S.staff.filter(function (p) { return (o.includeOff || p.active !== false) && (!term || (tidySearch(term) ? phoneMatch(term, p.phone) : wordsMatch(term, p.name + ' ' + p.username + ' ' + roleName(p.role)))); });
      list.sort(function (a, b) { var pa = prefer.indexOf(a.id) >= 0 ? 0 : 1, pb = prefer.indexOf(b.id) >= 0 ? 0 : 1; return pa - pb || a.name.localeCompare(b.name); });
      $('#pklist', sh).innerHTML = list.map(function (p) {
        var on = chosen.indexOf(p.id) >= 0, n = openTasksOf(p.id);
        return '<button type="button" class="pk-row' + (on ? ' on' : '') + '" data-pick="' + p.id + '"><span class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span><span class="grow"><span class="pk-l1">' + esc(p.name) + (p.id === S.me ? ' (me)' : '') + '</span><span class="pk-sub">' + esc(roleName(p.role)) + (prefer.indexOf(p.id) >= 0 ? ' · works at this place' : '') + ' · ' + n + ' open task' + (n === 1 ? '' : 's') + '</span></span>' + (o.multi ? '<span class="pk-tick">' + (on ? I('check', 2.6) : '') + '</span>' : '') + '</button>';
      }).join('') || '<div class="empty">Nobody matches “' + esc(term) + '”.</div>';
      $$('#pklist [data-pick]', sh).forEach(function (el) {
        el.onclick = function () {
          var id = el.dataset.pick;
          if (!o.multi) { closeSheet(); if (o.onPick) o.onPick(staff(id)); return; }
          var i = chosen.indexOf(id); if (i >= 0) chosen.splice(i, 1); else chosen.push(id); draw();
        };
      });
    };
    q = wireSearch(sh, draw);
    q.placeholder = 'Name or phone';
    var dn = $('#pkdone', sh); if (dn) dn.onclick = function () { closeSheet(); if (o.onPick) o.onPick(chosen.map(staff).filter(Boolean)); };
    draw();
    return sh;
  }

  return { car: carPick, booking: bookingPick, customer: customerPick, staff: staffPick, bookingMatches: bookingMatches, customerMatches: customerMatches };
})();
