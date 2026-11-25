/* ---------------- IDCHECK (M2 builder) ----------------
   IdCheck.open({onFill, onDocs, onCheck, onClose, bookingId, custId, name, ic, docs})
   A full-height sheet to photograph the customer's papers: IC front (read and checked), IC back, passport (read),
   driving licence (read), proof of address and other files. Reading and the online checks are simulated.
   - onFill(patch): patch = {name?, ic? (IC number), passport? (passport number), nationality?, licenceNo?, licenceExp? (YYYY-MM-DD)}
   - onDocs(docs): docs = {icFront, icBack, passport, licence, poa, other[]} after every change
   - onCheck(summary): summary = {at, ic (masked), valid, label, tone} after every IC check
   - bookingId / custId: the photos are also saved straight into that booking's / customer's docs.
   Reading the IC and the online checks need customers.check_ic; without it photos can still be added. */
var IdCheck = (function () {
  var SLOTS = [
    { k: 'icFront', label: 'IC front', sub: 'Reads and checks the IC', icon: 'user', demo: 'ic', main: true },
    { k: 'icBack', label: 'IC back', sub: 'Photo only', icon: 'user', demo: 'ic' },
    { k: 'passport', label: 'Passport', sub: 'Reads number, nationality, expiry', icon: 'file', demo: 'doc' },
    { k: 'licence', label: 'Driving licence', sub: 'Reads number and expiry', icon: 'car', demo: 'licence' },
    { k: 'poa', label: 'Proof of address', sub: 'Bill or bank letter', icon: 'map', demo: 'doc' },
    { k: 'other', label: 'Other', sub: 'Any other paper', icon: 'image', demo: 'doc' }
  ];
  var SITES = [{ id: 'watch', label: 'Renters watchlist' }, { id: 'court', label: 'Court records' }];
  var NAT_FOREIGN = ['Singaporean', 'Indonesian', 'Thai', 'Bangladeshi', 'Filipino', 'Chinese', 'Indian', 'British', 'Australian', 'Japanese'];
  var SHOWN = { clear: ['Clear', 'green'], flagged: ['Flagged', 'amber'], error: ['Could not check', 'red'] };

  function blankDocs() { return { icFront: null, icBack: null, passport: null, licence: null, poa: null, other: [] }; }
  function cleanName(n) { return String(n || '').toUpperCase().replace(/\b(BINTI|BINTE|BIN|A\/L|A\/P|AL|AP)\b/g, ' ').replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean); }
  /* 'match' / 'near' / 'mismatch' / '' (nothing to compare) */
  function nameMatch(read, form) {
    var a = cleanName(read), b = cleanName(form); if (!a.length || !b.length) return '';
    if (a.slice().sort().join(' ') === b.slice().sort().join(' ')) return 'match';
    var hit = b.filter(function (w) { return a.indexOf(w) >= 0; }).length;
    return hit && hit >= Math.min(a.length, b.length) / 2 ? 'near' : 'mismatch';
  }
  function titleName(n) {
    return String(n || '').toLowerCase().split(/\s+/).filter(Boolean).map(function (w) { if (w === 'a/l' || w === 'a/p') return w.toUpperCase(); if (w === 'bin' || w === 'binti') return w; return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }
  function seedOf(s) { return parseInt(strHash(String(s)).slice(0, 6), 36) || 13; }
  /* simulated online checks. Resolves [{id, label, status: 'clear'|'flagged'|'error', message}] */
  function runOnline(ic, attempt) {
    var R = rng(seedOf(digits(ic) + ':' + (attempt || 0))), d = digits(ic);
    return new Promise(function (res) {
      later(function () {
        var listed = S.customers.filter(function (c) { return c.blacklist && digits(c.ic) === d; })[0];
        res(SITES.map(function (s) {
          if (s.id === 'watch') {
            if (listed) return { id: s.id, label: s.label, status: 'flagged', message: 'Listed by a rental company: ' + (listed.blacklist.reason || 'no reason given') };
            return { id: s.id, label: s.label, status: R() < .06 ? 'flagged' : 'clear', message: '' };
          }
          var x = R();
          return { id: s.id, label: s.label, status: x < .1 ? 'error' : x < .14 ? 'flagged' : 'clear', message: x < .1 ? 'The site did not answer in time. Try again in a minute.' : '' };
        }).map(function (r) { if (r.status === 'flagged' && !r.message) r.message = 'A record with this IC number was found. Look at it before you hand over the car.'; return r; }));
      }, 900);
    });
  }
  /* fill only a valid number with nothing flagged; a site that could not answer is said out loud */
  function decide(chk) {
    if (!chk.valid) return { fill: false, why: 'This is not a valid IC number. Fix it first.' };
    if (chk.results.some(function (r) { return r.status === 'flagged'; })) return { fill: false, why: 'A site flagged this person. Nothing was filled in.' };
    if (chk.results.some(function (r) { return r.status === 'error'; })) return { fill: false, why: 'A site could not be checked just now. Try again, or fill in anyway.' };
    return { fill: true, why: '' };
  }
  function summary(chk) {
    var flagged = chk.results.some(function (r) { return r.status === 'flagged'; }), err = chk.results.some(function (r) { return r.status === 'error'; });
    var differs = chk.match === 'mismatch' || chk.match === 'near';
    var label = !chk.valid ? 'IC not valid' : flagged ? 'IC flagged' : err ? 'IC check not finished' : differs ? 'IC checked, name differs' : 'IC checked, all clear';
    return { at: new Date().toISOString(), ic: maskIC(chk.ic), valid: chk.valid, label: label, tone: !chk.valid ? 'red' : flagged || differs ? 'amber' : err ? 'grey' : 'green' };
  }
  function readDoc(kind, src, opts) {
    var R = rng(seedOf(src + kind + Date.now()));
    return new Promise(function (res) {
      later(function () {
        var nm = opts.name ? String(opts.name).toUpperCase() : ['TAN WEI LING', 'BUDI SANTOSO', 'SARAH JONES'][Math.floor(R() * 3)];
        if (kind === 'passport') {
          var exp = new Date(Date.now() + (R() < .15 ? 120 : 400 + R() * 2600) * DAY), nat = NAT_FOREIGN[Math.floor(R() * NAT_FOREIGN.length)];
          var notes = []; if (exp - Date.now() < 183 * DAY) notes.push('This passport expires in under 6 months (' + dFull(exp) + ').');
          res({ number: String.fromCharCode(65 + Math.floor(R() * 26)) + String(Math.floor(1e7 + R() * 9e7)), nationality: nat, expiry: toLocalInput(exp), name: nm, notes: notes });
        } else {
          var lexp = new Date(Date.now() + (R() < .1 ? -40 : 90 + R() * 1700) * DAY), n2 = [];
          if (lexp < new Date()) n2.push('This licence expired on ' + dFull(lexp) + '.');
          res({ number: 'D' + String(Math.floor(1e7 + R() * 9e7)), expiry: toLocalInput(lexp), name: nm, notes: n2 });
        }
      }, 900);
    });
  }

  function open(opts) {
    opts = opts || {};
    var b = opts.bookingId ? bk(opts.bookingId) : null, cu = opts.custId ? byId(S.customers, opts.custId) : null;
    var st = {
      docs: Object.assign(blankDocs(), JSON.parse(JSON.stringify(opts.docs || (b && b.docs) || (cu && cu.docs) || {}))),
      busy: null, chk: null, edIc: '', edName: '', filled: '', notes: [], err: '', sample: !('ontouchstart' in window) && !/Mobi|Android/i.test(navigator.userAgent),
      formName: opts.name || (b ? cust(b.cust).name : cu ? cu.name : ''), attempt: 0
    };
    st.docs.other = st.docs.other || [];
    var allowed = can('customers.check_ic');
    var sh = sheet(sheetHead('Check the customer\'s papers', st.formName || 'New customer') + '<div id="idc" class="idc"></div><div class="sheet-foot"><button type="button" class="btn" id="idc_done">Done</button></div>', null, {
      full: true, stack: true, cls: 'idc-sheet', onClose: function () { if (opts.onClose) opts.onClose(); }
    });
    $('#idc_done', sh).onclick = function () { closeSheet(); };

    var fill = function (patch, what) {
      var words = [];
      if (patch.name) words.push('name'); if (patch.ic || patch.passport) words.push(patch.passport ? 'passport number' : 'IC number'); if (patch.nationality) words.push('nationality');
      if (patch.licenceNo) words.push('licence number'); if (patch.licenceExp) words.push('licence expiry');
      if (!words.length || (!opts.onFill && !(cu && opts.saveToCustomer))) return;
      if (opts.onFill) opts.onFill(patch);
      if (cu && opts.saveToCustomer) { Object.keys(patch).forEach(function (k) { cu[k] = patch[k]; }); save(); }
      st.filled = words.join(', ');
    };
    var docsChanged = function (slotLabel) {
      if (opts.onDocs) opts.onDocs(JSON.parse(JSON.stringify(st.docs)));
      if (b) { b.docs = JSON.parse(JSON.stringify(st.docs)); if (slotLabel) bLog(b, slotLabel); save(); }
      if (cu) { cu.docs = JSON.parse(JSON.stringify(st.docs)); if (slotLabel) audit(slotLabel + ' for ' + cu.name, { cust: cu.id }); save(); }
    };
    var afterCheck = function () {
      var c = st.chk; c.match = nameMatch(c.name, st.formName); c.decision = decide(c);
      if (opts.onCheck) opts.onCheck(summary(c));
      if (b) { b.icCheck = summary(c); save(); }
      if (c.decision.fill) fill(icPatch(c));
    };
    /* the name read from the IC only replaces the typed or saved name when they agree (or nothing was typed); otherwise staff decide with 'Use name from IC' */
    var nameOk = function (c) { return !String(st.formName || '').trim() || c.match === 'match'; };
    var icPatch = function (c) { var p = { ic: c.ic, nationality: 'Malaysian' }; if (nameOk(c) && c.name) p.name = titleName(c.name); return p; };
    var checkOnline = function () {
      st.busy = 'online'; draw();
      return runOnline(st.chk.ic, st.attempt++).then(function (rows) { if (!st.chk) return; st.chk.results = rows; st.busy = null; afterCheck(); st.jump = '.idc-res'; draw(); });
    };
    var readIc = function (src) {
      st.busy = 'ic'; st.err = ''; st.filled = ''; st.chk = null; st.nameUsed = false; st.jump = '.idc-busy'; draw();
      var known = digits(opts.ic).length === 12 ? opts.ic : null, R = rng(seedOf(src.slice(-40) + Date.now()));
      Media.readIC(src.indexOf('demo:') === 0 ? src + Math.random() : src, { ic: known && R() < .85 ? known : null, name: st.formName && R() < .75 ? String(st.formName).toUpperCase() : null, delay: 1000 }).then(function (r) {
        if (!sh.isConnected) return;
        st.chk = { ic: r.ic, name: r.name, valid: r.valid, facts: r.facts || {}, issues: r.issues || [], results: [] };
        st.edIc = r.ic; st.edName = r.name;
        if (r.valid) checkOnline(); else { st.busy = null; afterCheck(); st.jump = '.idc-res'; draw(); }
      });
    };
    var readPaper = function (kind, src) {
      st.busy = kind; st.err = ''; st.filled = ''; st.notes = []; st.jump = '.idc-busy'; draw();
      readDoc(kind, src, { name: st.formName }).then(function (v) {
        if (!sh.isConnected) return;
        st.busy = null; st.notes = v.notes;
        if (kind === 'passport') fill({ passport: v.number, nationality: v.nationality, name: st.formName ? null : titleName(v.name) });
        else fill({ licenceNo: v.number, licenceExp: v.expiry, name: st.formName ? null : titleName(v.name) });
        st[kind + 'Read'] = v; st.jump = '.idc-paper'; draw();
      });
    };
    var take = function (slot) {
      var p = st.sample ? Media.sample(slot.demo, slot.label).then(function () { return { dataUrl: 'demo:' + slot.demo + ':' + slot.label, note: 'Sample picture (demo)' }; }) : Media.photo({ capture: 'environment', maxPx: 1000, quality: .6, accept: slot.k === 'other' || slot.k === 'poa' ? 'image/*,application/pdf' : 'image/*' });
      p.then(function (r) {
        if (!sh.isConnected) return;
        if (slot.k === 'other') st.docs.other.push(r.dataUrl); else st.docs[slot.k] = r.dataUrl;
        docsChanged('Added ' + slot.label + ' photo');
        if (r.note && !st.sample) say(r.note);
        if (allowed && slot.k === 'icFront') readIc(r.dataUrl);
        else if (allowed && (slot.k === 'passport' || slot.k === 'licence')) readPaper(slot.k, r.dataUrl);
        else draw();
      }, function (e) { if (e !== 'cancel') { st.err = 'The picture could not be opened. Try another one.'; draw(); } });
    };
    var remove = function (k, i) {
      var label = (SLOTS.filter(function (s) { return s.k === k; })[0] || {}).label || 'Photo';
      var old = JSON.parse(JSON.stringify(st.docs));
      if (k === 'other') st.docs.other.splice(i, 1); else st.docs[k] = null;
      if (k === 'icFront') st.chk = null;
      docsChanged('Removed ' + label + ' photo'); draw();
      undoSnack(label + ' removed', function () { st.docs = old; docsChanged('Put back ' + label + ' photo'); if (sh.isConnected) draw(); });
    };

    function chipT(text, tone, title) { return '<span class="chip tone-' + tone + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>'; }
    function draw() {
      var box = $('#idc', sh); if (!box) return;
      var d = st.docs, busy = st.busy;
      var tiles = SLOTS.map(function (s) {
        var has = s.k === 'other' ? d.other.length : d[s.k], spin = busy === s.k || (s.k === 'icFront' && (busy === 'ic' || busy === 'online'));
        return '<button type="button" class="idc-tile' + (s.main ? ' main' : '') + (has ? ' has' : '') + '" data-slot="' + s.k + '"' + (busy ? ' disabled' : '') + '>' +
          '<span class="idc-ic">' + (spin ? '<span class="idc-spin"></span>' : has ? I('check', 2.6) : I('camera')) + '</span><span class="idc-tl"><b>' + esc(s.label) + '</b><small>' + esc(has && s.k !== 'other' ? 'Tap to take again' : (!allowed && s.sub.indexOf('Reads') === 0 ? 'Photo only' : s.sub)) + '</small></span></button>';
      }).join('');
      var chips = [];
      SLOTS.forEach(function (s) {
        if (s.k === 'other') d.other.forEach(function (x, i) { chips.push({ k: 'other', i: i, label: 'Other ' + (i + 1), src: x }); });
        else if (d[s.k]) chips.push({ k: s.k, i: 0, label: s.label, src: d[s.k] });
      });
      var files = chips.length ? '<div class="idc-files">' + chips.map(function (c) {
        var isPdf = /^data:application\/pdf/.test(c.src);
        return '<span class="idc-file"><span class="idc-th">' + (isPdf ? I('file') : '<img src="' + esc(imgSrc(c.src)) + '" alt="">') + '</span><span class="idc-fl">' + esc(c.label) + '</span><button type="button" class="idc-x" data-rm="' + c.k + '" data-i="' + c.i + '" aria-label="Remove ' + esc(c.label) + '">' + I('x', 2.4) + '</button></span>';
      }).join('') + '</div>' : '';
      var res = '';
      if (busy === 'ic') res = '<div class="idc-busy"><span class="idc-spin"></span>Reading the IC…</div>';
      else if (busy === 'passport' || busy === 'licence') res = '<div class="idc-busy"><span class="idc-spin"></span>Reading the ' + (busy === 'passport' ? 'passport' : 'licence') + '…</div>';
      if (st.chk) {
        var c = st.chk, f = c.facts || {};
        res += '<div class="idc-res">';
        if (c.valid) res += chipT('IC ' + maskIC(c.ic) + ' looks valid', 'green') + '<div class="idc-facts">' + (f.born ? '<div><span>Born</span><b>' + esc(f.born) + (f.age != null ? ' (age ' + f.age + ')' : '') + '</b></div>' : '') + (f.state ? '<div><span>Place of birth</span><b>' + esc(f.state) + '</b></div>' : '') + (f.sex ? '<div><span>Sex</span><b>' + esc(f.sex) + '</b></div>' : '') + '</div>';
        else res += '<div class="banner amber">' + I('warn') + '<div><b>This is not a valid IC number.</b><ul class="idc-issues">' + (c.issues.length ? c.issues : ['The number could not be read']).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>Fix the number below, or take a clearer photo.</div></div>';
        if (c.valid && c.issues.length) res += '<div class="small nb-warn idc-note">' + esc(c.issues.join('. ')) + '</div>';
        if (busy === 'online') res += '<div class="idc-busy"><span class="idc-spin"></span>Checking online…</div>';
        else if (c.results.length || c.match) {
          res += '<div class="idc-chips">' + c.results.map(function (r) { var s = SHOWN[r.status]; return chipT(r.label + ': ' + s[0], s[1], r.message); }).join('') +
            (c.match ? chipT({ match: 'Name matches', near: 'Name is close', mismatch: 'Name differs' }[c.match], { match: 'green', near: 'amber', mismatch: 'red' }[c.match]) : '') + '</div>';
          c.results.filter(function (r) { return r.message && r.status !== 'clear'; }).forEach(function (r) { res += '<div class="small idc-why ' + (r.status === 'error' ? 'red' : 'amber') + '">' + esc(r.label) + ': ' + esc(r.message) + '</div>'; });
          if (c.results.some(function (r) { return r.status === 'flagged'; })) res += '<div class="banner amber">' + I('warn') + '<div>A site has flagged this person. This is a warning for you to weigh up. It does not stop the booking.</div></div>';
          if (c.match === 'mismatch' || c.match === 'near') res += '<div class="small muted idc-note">Name on the IC: <b>' + esc(c.name) + '</b>' + (st.formName ? ', name in the booking: <b>' + esc(st.formName) + '</b>' : '') + '</div>';
        }
        if (busy !== 'online' && c.decision) {
          if (c.decision.why) res += '<div class="banner ' + (c.decision.fill ? 'blue' : 'amber') + '">' + I('info') + '<div>' + esc(c.decision.why) + '</div></div>';
          if (!c.decision.fill && c.ic) res += '<button type="button" class="btn ghost idc-anyway" id="idc_anyway">' + (nameOk(c) ? 'Fill in the name and IC anyway' : 'Fill in the IC number anyway') + '</button>';
          if (!nameOk(c) && c.name && !st.nameUsed) res += '<button type="button" class="btn ghost idc-usename" id="idc_usename">Use name from IC: ' + esc(titleName(c.name)) + '</button>';
          if (c.results.some(function (r) { return r.status === 'error'; })) res += '<button type="button" class="btn link idc-retry" id="idc_retry">' + I('reset') + 'Try the online check again</button>';
        }
        res += '<div class="idc-edit"><div class="small muted">Read wrongly? Fix it here.</div><label class="field"><span>IC number</span><input class="inp" id="idc_ic" value="' + esc(st.edIc) + '" inputmode="numeric" autocomplete="off"></label>' +
          '<label class="field"><span>Name on the IC</span><input class="inp" id="idc_name" value="' + esc(st.edName) + '" autocapitalize="characters" autocomplete="off"></label>' +
          '<button type="button" class="btn ghost" id="idc_fix" disabled>Save correction and re-check</button></div></div>';
      }
      ['passport', 'licence'].forEach(function (k) {
        var v = st[k + 'Read']; if (!v) return;
        res += '<div class="idc-paper"><b>' + (k === 'passport' ? 'Passport' : 'Licence') + ' read</b><span>' + esc(v.number) + (v.nationality ? ' · ' + esc(v.nationality) : '') + ' · until ' + esc(dFull(v.expiry + 'T00:00:00')) + '</span></div>';
      });
      st.notes.forEach(function (n) { res += '<div class="banner amber">' + I('warn') + '<div>' + esc(n) + '</div></div>'; });
      if (st.filled) res += '<div class="banner green">' + I('check') + '<div>Filled in: ' + esc(st.filled) + '. Check them in the form.</div></div>';
      if (st.err) res += '<div class="banner red">' + I('warn') + '<div>' + esc(st.err) + '</div></div>';
      box.innerHTML = (allowed ? '' : '<div class="banner amber idc-noacc">' + I('lock') + '<div>Reading the IC and the online checks need <b>' + esc(CODES['customers.check_ic'] || 'IC check') + '</b> access. You can still add photos.</div></div>') +
        '<div class="idc-tiles">' + tiles + '</div>' +
        '<label class="idc-sample"><span>No camera here? Use sample pictures (demo)</span><span class="sw"><input type="checkbox" id="idc_sample"' + (st.sample ? ' checked' : '') + '><i></i></span></label>' +
        files + res + '<p class="small muted idc-foot">Pictures are kept with the booking. The checks are a guide: you decide.</p>';
      if (st.jump) { var j = $(st.jump, box); st.jump = null; if (j) setTimeout(function () { j.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }
      $$('[data-slot]', box).forEach(function (el) { el.onclick = function () { take(SLOTS.filter(function (s) { return s.k === el.dataset.slot; })[0]); }; });
      $$('[data-rm]', box).forEach(function (el) { el.onclick = function () { remove(el.dataset.rm, +el.dataset.i); }; });
      $('#idc_sample', box).onchange = function () { st.sample = this.checked; };
      var an = $('#idc_anyway', box); if (an) an.onclick = function () { fill(icPatch(st.chk)); draw(); };
      var un = $('#idc_usename', box); if (un) un.onclick = function () {
        var nm = titleName(st.chk.name); st.nameUsed = true; fill({ name: nm }); st.formName = nm; st.chk.match = 'match';
        if (opts.onCheck) opts.onCheck(summary(st.chk)); if (b) { b.icCheck = summary(st.chk); save(); } draw();
      };
      var rt = $('#idc_retry', box); if (rt) rt.onclick = function () { checkOnline(); };
      var ii = $('#idc_ic', box), nn = $('#idc_name', box), fx = $('#idc_fix', box);
      if (ii) {
        var dirty = function () { st.edIc = ii.value; st.edName = nn.value; fx.disabled = !(ii.value.trim() !== st.chk.ic.trim() || nn.value.trim() !== st.chk.name.trim()) || !!st.busy; };
        ii.addEventListener('input', dirty); nn.addEventListener('input', dirty);
        fx.onclick = function () {
          var raw = ii.value.trim(), dd = digits(raw), ic = dd.length === 12 ? dd.slice(0, 6) + '-' + dd.slice(6, 8) + '-' + dd.slice(8) : raw, fa = icFacts(ic);
          st.chk = { ic: ic, name: nn.value.trim().toUpperCase(), valid: !fa.issues.length, facts: fa.facts, issues: fa.issues, results: [] };
          st.edIc = st.chk.ic; st.edName = st.chk.name; st.filled = ''; st.nameUsed = false;
          if (st.chk.valid) checkOnline(); else { afterCheck(); draw(); }
        };
      }
    }
    draw();
    return sh;
  }
  return { open: open, nameMatch: nameMatch };
})();
