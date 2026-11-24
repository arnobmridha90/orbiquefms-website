/* ===================================================================
   Platform admin: Orbique's own view, in Orbique's colours (the PMS platform page, for car rental companies).
   Counts only: never a company's customers or money.
   =================================================================== */
function pfCompanies() {
  var list = BRANDS.map(function (b) {
    var oct = b.data.bookings.filter(function (x) { return x.start.getMonth() === 9 && x.start.getFullYear() === 2026 && x.status !== 'Cancelled'; }).length;
    return { id: b.id, name: b.name, owner: b.email, plan: S.pf.plans[b.id] || b.plan, status: S.pf.status[b.id] || 'active', cars: b.data.cars.length, bookings: oct, staff: b.staff.length, created: b.id === 'kilat' ? '2026-03-02' : b.id === 'padi' ? '2026-06-17' : b.id === 'bara' ? '2026-01-20' : '2026-10-19', last: b.id === 'mine' ? 'just now' : ['4 minutes ago', '1 hour ago', 'just now'][BRANDS.indexOf(b) % 3], mark: b.logoImg ? '<img src="' + b.logoImg + '" alt="">' : b.mark, slug: b.slug, setup: b.id === 'mine' ? 'none' : '' };
  });
  return list.concat(OTHER_COMPANIES.map(function (o, k) { var id = 'o' + k; return Object.assign({}, o, { id: id, plan: S.pf.plans[id] || o.plan, status: S.pf.status[id] || o.status, slug: o.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) }); })).concat(S.pf.extra);
}
function pill(t, k) { return '<span class="pill ' + k + '">' + esc(t) + '</span>'; }
function pfStatus(o) { return o.status === 'paused' ? pill('Paused', 'warn') : pill('Active', 'ok'); }
function pfSetup(o) { return o.setup === 'demo' ? pill('Demo data', 'info') : o.setup === 'none' ? pill('Not set up yet', 'neutral') : ''; }
function pfDate(s) { var p = s.split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + p[0]; }
function platformView() {
  var ops = pfCompanies(), reqs = S.pf.reqs || (S.pf.reqs = REQUESTS.map(function (r) { return Object.assign({}, r); }));
  var newReqs = reqs.filter(function (r) { return r.status === 'new'; }).length, paused = ops.filter(function (o) { return o.status === 'paused'; }).length;
  var tab = S.pf.tab, body = '';
  var kp = [['Companies', ops.length, paused ? paused + ' paused' : 'All active'], ['Cars managed', sum(ops.map(function (o) { return o.cars; })), 'Across all companies'], ['Bookings this month', sum(ops.map(function (o) { return o.bookings; })), 'October 2026'], ['New sign-up requests', newReqs, newReqs ? 'Waiting for you' : 'Nothing waiting', newReqs > 0]];
  if (tab === 'companies') {
    var q = S.pf.q.toLowerCase(), list = ops.filter(function (o) { return (S.pf.filter === 'all' || o.status === S.pf.filter) && (!q || (o.name + ' ' + o.owner).toLowerCase().indexOf(q) >= 0); });
    body = '<div class="pm-tool"><label class="pm-search">' + i('search') + '<input type="search" placeholder="Search companies or owners" aria-label="Search companies" value="' + esc(S.pf.q) + '" data-ch="pfq"></label><div class="pm-seg">' + [['all', 'All'], ['active', 'Active'], ['paused', 'Paused']].map(function (s) { return '<button type="button" class="' + (S.pf.filter === s[0] ? 'on' : '') + '" data-a="pff" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="pm-card pm-desk" style="overflow-x:auto"><table class="pm-table"><thead><tr><th>Company</th><th>Plan</th><th>Status</th><th class="num">Staff</th><th class="num">Cars</th><th class="num">Bookings this month</th><th>Created</th><th>Last activity</th><th></th></tr></thead><tbody>' +
      list.map(function (o) { return '<tr data-a="pfmanage" data-v="' + o.id + '"><td><div class="pm-co"><span class="mk">' + o.mark + '</span><div style="min-width:0"><b>' + esc(o.name) + '</b><small>' + esc(o.owner) + '</small></div></div></td><td>' + pill(planName(o.plan), 'brand') + '</td><td><span style="display:inline-flex;gap:5px">' + pfStatus(o) + pfSetup(o) + '</span></td><td class="num">' + o.staff + '</td><td class="num">' + o.cars + '</td><td class="num">' + o.bookings + '</td><td style="white-space:nowrap">' + pfDate(o.created) + '</td><td style="white-space:nowrap;color:var(--o-muted);font-size:12.5px">' + esc(o.last) + '</td><td style="text-align:right"><button type="button" class="pm-btn sm" data-a="pfmanage" data-v="' + o.id + '">Manage</button></td></tr>'; }).join('') +
      '</tbody></table></div><div class="pm-phone">' + list.map(function (o) { return '<button type="button" class="pm-mcard" data-a="pfmanage" data-v="' + o.id + '"><span class="pm-co" style="width:100%"><span class="mk">' + o.mark + '</span><span style="flex:1;min-width:0"><b class="ellip" style="display:block">' + esc(o.name) + '</b><small class="ellip">' + esc(o.owner) + '</small></span>' + pfStatus(o) + '</span><span class="pm-stats"><span>' + pill(planName(o.plan), 'brand') + '</span><span><b>' + o.staff + '</b> staff</span><span><b>' + o.cars + '</b> cars</span><span><b>' + o.bookings + '</b> bookings this month</span></span><span style="font-size:12px;color:var(--o-faint)">Since ' + pfDate(o.created) + ' · ' + esc(o.last) + '</span></button>'; }).join('') + '</div>' +
      '<div class="pm-note">' + i('lock') + 'Counts only. Customers, documents and money stay private to each company.</div>';
  } else if (tab === 'requests') {
    body = '<div class="pm-tool"><span class="pm-note">From the "Start your free trial" form on orbiquefms.com</span></div><div class="pm-req">' + reqs.map(function (r, k) {
      return '<div class="pm-card"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:14.5px">' + esc(r.co) + '</b>' + (r.status === 'new' ? pill('New', 'info') : r.status === 'declined' ? pill('Declined', 'neutral') : pill('Handled', 'ok')) + '</div>' +
        '<div class="pm-stats" style="gap:6px 14px"><span>' + i('user') + ' ' + esc(r.who) + '</span><span>' + i('mail') + ' ' + esc(r.email) + '</span><span>' + i('phone') + ' ' + esc(r.phone) + '</span><span>' + i('car') + ' ' + plural(r.cars, 'car') + '</span></div>' + (r.msg ? '<div class="pm-req-msg">' + esc(r.msg) + '</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span style="flex:1;font-size:12px;color:var(--o-faint)">Received ' + esc(r.when) + '</span>' + (r.status === 'new' ? '<button type="button" class="pm-btn sm" data-a="pfreq" data-v="' + k + ':declined">Decline</button><button type="button" class="pm-btn sm" data-a="pfreq" data-v="' + k + ':handled">Mark handled</button><button type="button" class="pm-btn sm pri" data-a="pfadd" data-v="' + k + '">' + i('plus') + 'Set up company</button>' : '<button type="button" class="pm-btn sm" data-a="pfreq" data-v="' + k + ':new">Move back to new</button>') + '</div></div>';
    }).join('') + '</div>';
  } else {
    body = '<div class="pm-plans">' + [['Starter', 'RM 199', 'a month', ['Up to 10 cars', '3 staff logins', 'Booking form, agreement and inspections', 'One website design']], ['Growth', 'RM 399', 'a month', ['Up to 30 cars', '10 staff logins', 'Everything in Starter', 'All website designs, your own domain']], ['Pro', 'RM 799', 'a month', ['Unlimited cars', 'Unlimited staff', 'Everything in Growth', 'Priority help on WhatsApp']]].map(function (p) {
      return '<div class="pm-card pm-plan"><b style="font-family:Manrope;font-size:17px">' + p[0] + '</b><div><span class="pr">' + p[1] + '</span> <span style="color:var(--o-muted)">' + p[2] + '</span></div><ul>' + p[3].map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul><div style="font-size:12.5px;color:var(--o-muted);margin-top:6px">' + ops.filter(function (o) { return o.plan === p[0].toLowerCase(); }).length + ' companies on this plan</div></div>';
    }).join('') + '</div><div class="pm-note">' + i('info-circle') + 'A new company starts on a 14 day Trial with demo data. Prices are made up for this sample.</div>';
  }
  var nav = [['companies', 'Companies', 'building-store', ops.length], ['requests', 'Sign-up requests', 'inbox', newReqs], ['plans', 'Plans', 'receipt']];
  return '<div class="pm' + (S.pf.nav ? ' open' : '') + '"><aside class="pm-side"><div class="pm-logo"><span style="width:34px;height:34px;display:block">' + MARKS.orbique + '</span><div>Orbique<small>FMS platform</small></div></div>' +
    '<div class="pm-grp">Platform</div>' + nav.map(function (n) { return '<button type="button" class="pm-it" data-a="pftab" data-v="' + n[0] + '"' + (tab === n[0] ? ' aria-current="page"' : '') + '>' + i(n[2]) + n[1] + (n[0] === 'requests' && n[3] ? '<span class="n">' + n[3] + '</span>' : '') + '</button>'; }).join('') +
    '<div class="pm-grp">Orbique</div><button type="button" class="pm-it" data-a="toast" data-v="Orbique staff and their access">' + i('users') + 'Orbique staff</button><button type="button" class="pm-it" data-a="toast" data-v="The template every company gets: pages, rules and terms">' + i('template') + 'Template system</button>' +
    '<div style="margin-top:auto;padding:12px 10px 4px;font-size:12px;color:var(--o-side-muted);line-height:1.5">Signed in as Orbique admin</div></aside><div class="pm-scrim"></div>' +
    '<div class="pm-main"><div class="pm-top"><button type="button" class="pm-btn pm-burger" data-a="pfnav" aria-label="Menu">' + i('menu-2') + '</button><div style="flex:1;min-width:0"><h1>' + (tab === 'companies' ? 'Companies' : tab === 'requests' ? 'Sign-up requests' : 'Plans') + '</h1><div class="sub">Rental companies that subscribe to Orbique FMS</div></div>' +
    '<button type="button" class="pm-btn pm-hide-sm" data-a="toast" data-v="Up to date">' + i('refresh') + '<span class="pm-hide-sm">Refresh</span></button><button type="button" class="pm-btn pri" data-a="pfadd" data-v="">' + i('plus') + 'Add company</button></div>' +
    '<div class="pm-body"><div class="pm-kpis">' + kp.map(function (k) { return '<div class="pm-kpi' + (k[3] ? ' hl' : '') + '"><div class="l">' + k[0] + '</div><div class="v">' + n0(k[1]) + '</div><div class="s">' + k[2] + '</div></div>'; }).join('') + '</div>' +
    '<div class="pm-tabs">' + nav.map(function (n) { return '<button type="button" class="' + (tab === n[0] ? 'on' : '') + '" data-a="pftab" data-v="' + n[0] + '">' + n[1] + (n[0] === 'requests' && n[3] ? '<span class="pf-n">' + n[3] + '</span>' : '') + '</button>'; }).join('') + '</div>' + body + '</div></div>' +
    (S.modal ? pfModal(ops) : '') + '</div>';
}
function pfModal(ops) {
  var m = S.modal;
  if (m.kind === 'pfmanage') {
    var o = ops.filter(function (x) { return x.id === m.ref; })[0]; if (!o) return '';
    return '<div class="ov" role="dialog" aria-modal="true"><div class="dlg"><div class="dlg-h"><span class="pm-co"><span class="mk" style="width:42px;height:42px">' + o.mark + '</span></span><div class="grow"><h2>' + esc(o.name) + '</h2><p>Counts only. Customers and money stay private to the company.</p></div><button type="button" class="ib" data-a="close" aria-label="Close">' + i('x') + '</button></div><div class="dlg-b">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + pfStatus(o) + pill(planName(o.plan), 'brand') + pfSetup(o) + '</div>' +
      '<dl class="pm-kv"><dt>Created</dt><dd>' + pfDate(o.created) + '</dd><dt>Last activity</dt><dd>' + esc(o.last) + '</dd><dt>Staff</dt><dd>' + o.staff + '</dd><dt>Cars</dt><dd>' + o.cars + '</dd><dt>Bookings this month</dt><dd>' + o.bookings + '</dd><dt>Dashboard</dt><dd>' + esc(o.slug) + '.orbiquefms.com</dd><dt>Owner</dt><dd style="overflow-wrap:anywhere">' + esc(o.owner) + '</dd></dl>' +
      '<div class="pm-f"><label for="pf-plan">Plan</label><div style="display:flex;gap:8px"><select id="pf-plan" style="flex:1;max-width:240px">' + PLANS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === o.plan ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select><button type="button" class="pm-btn" data-a="pfplan" data-v="' + o.id + '">Save plan</button></div></div>' +
      '<div class="pm-f"><label>Company</label><div style="font-size:12.5px;color:var(--o-muted);margin-bottom:6px">' + (o.status === 'paused' ? 'Paused: the team can sign in and look, but nothing can be changed and the booking form is closed.' : 'Pausing keeps all data. The team can still sign in and look, but cannot change anything.') + '</div><div>' + (o.status === 'paused' ? '<button type="button" class="pm-btn pri" data-a="pfpause" data-v="' + o.id + '">' + i('player-play') + 'Resume company</button>' : '<button type="button" class="pm-btn danger" data-a="pfpause" data-v="' + o.id + '">' + i('player-pause') + 'Pause company</button>') + '</div></div>' +
      '<div class="pm-f"><label>Owner sign-in</label><div><button type="button" class="pm-btn sm" data-a="toast" data-v="A new temporary password is ready to send on WhatsApp">' + i('key') + 'Reset password</button></div></div></div><div class="dlg-f"><button type="button" class="pm-btn" data-a="close">Close</button></div></div></div>';
  }
  if (m.kind === 'pfadd') {
    var r = m.ref !== '' && S.pf.reqs[+m.ref] ? S.pf.reqs[+m.ref] : {};
    return '<div class="ov" role="dialog" aria-modal="true"><div class="dlg"><div class="dlg-h"><div class="grow"><h2>Add a company</h2><p>A new private company and its owner\'s sign-in</p></div><button type="button" class="ib" data-a="close" aria-label="Close">' + i('x') + '</button></div><div class="dlg-b">' +
      '<div class="pm-f"><label for="pa-co">Company name</label><input id="pa-co" value="' + esc(r.co || '') + '"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="pm-f"><label for="pa-on">Owner\'s name</label><input id="pa-on" value="' + esc(r.who || '') + '"></div><div class="pm-f"><label for="pa-oe">Owner\'s email</label><input id="pa-oe" type="email" value="' + esc(r.email || '') + '"></div></div>' +
      '<div class="pm-f"><label for="pa-pl">Plan</label><select id="pa-pl">' + PLANS.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div style="font-size:12.5px;color:var(--o-muted);line-height:1.5">Orbique copies the template system for them: the same dashboard, booking form, agreement and website designs. They upload their logo and the colours are picked from it.</div></div>' +
      '<div class="dlg-f"><button type="button" class="pm-btn" data-a="close">Cancel</button><button type="button" class="pm-btn pri" data-a="pfcreate" data-v="' + esc(m.ref) + '">Create company</button></div></div></div>';
  }
  return '';
}
CH.pfq = function (v) { S.pf.q = v; render(); };
A.pff = function (v) { S.pf.filter = v; render(); };
A.pftab = function (v) { S.pf.tab = v; S.pf.nav = false; render(); };
A.pfnav = function () { S.pf.nav = !S.pf.nav; render(); };
A.pfmanage = function (v) { S.modal = { kind: 'pfmanage', ref: v }; render(); };
A.pfadd = function (v) { S.modal = { kind: 'pfadd', ref: v || '' }; render(); };
A.pfplan = function (v) { var el = document.getElementById('pf-plan'); S.pf.plans[v] = el.value; var ex = S.pf.extra.filter(function (x) { return x.id === v; })[0]; if (ex) ex.plan = el.value; S.modal = null; render(); toast('Plan saved: ' + planName(el.value)); };
A.pfpause = function (v) { var o = pfCompanies().filter(function (x) { return x.id === v; })[0]; var nx = o.status === 'paused' ? 'active' : 'paused'; S.pf.status[v] = nx; var ex = S.pf.extra.filter(function (x) { return x.id === v; })[0]; if (ex) ex.status = nx; S.modal = null; render(); toast(o.name + (nx === 'paused' ? ' is paused' : ' is active again')); };
A.pfreq = function (v) { var p = v.split(':'); S.pf.reqs[+p[0]].status = p[1]; render(); };
A.pfcreate = function (v) {
  var co = (document.getElementById('pa-co').value || '').trim(), em = (document.getElementById('pa-oe').value || '').trim(), pl = document.getElementById('pa-pl').value;
  if (!co) { toast('Enter the company name.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Enter a valid email address for the owner.'); return; }
  var hue = (co.length * 47) % 360, col = 'hsl(' + hue + ' 55% 38%)';
  S.pf.extra.push({ id: 'x' + S.pf.extra.length, name: co, owner: em, plan: pl, status: 'active', cars: 0, bookings: 0, staff: 1, created: '2026-10-19', last: 'No activity yet', setup: 'demo', mark: initialMark(co[0].toUpperCase(), col, '#FFFFFF'), slug: co.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) });
  if (v !== '' && S.pf.reqs[+v]) S.pf.reqs[+v].status = 'handled';
  S.modal = null; S.pf.tab = 'companies'; render(); toast(co + ' is ready. The sign-in details are ready to send on WhatsApp.');
};
