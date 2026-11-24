/* ===================================================================
   Website designs: three customer websites built from the company's cars, prices, logo and colours.
   Design 1 follows the template system's own customer site (dark, Poppins, red glow, cars on dark cards).
   =================================================================== */
function siteCars(b) {
  var seen = {}, out = [];
  b.data.cars.forEach(function (c) { if (!c.web || c.status === 'workshop' && false) return; var k = c.key; if (seen[k]) return; seen[k] = 1; out.push(c); });
  return out;
}
var TEMPLATES = [
  { id: 'night', name: 'Night Drive', mood: 'Dark and bold, cars glowing in your colour', best: 'Best for city and airport rentals', from: 'The template system\'s own customer site' },
  { id: 'day', name: 'Daylight', mood: 'Light, friendly and quick to book', best: 'Best for families and first-time renters', from: 'New' },
  { id: 'show', name: 'Showroom', mood: 'A magazine-style list with big prices', best: 'Best for premium cars and MPVs', from: 'New' }
];
var SI = {
  user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3 2.8 3 6"/></svg>',
  wheel: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V21M9.6 11.2L3.5 9.5M14.4 11.2l6.1-1.7"/></svg>',
  fuel: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 8h5M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/></svg>',
  cal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  wa: '<svg width="26" height="26" viewBox="0 0 24 24"><path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
  key: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/></svg>',
  doc: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  car: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 17h14v-5l-2-5H7l-2 5zM5 12h14"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
  shield: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  clock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  chat: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H8l-4 4z"/></svg>'
};
function siteMark(b) { return '<span class="mk">' + (b.logoImg ? '<img src="' + b.logoImg + '" alt="">' : b.mark) + '</span>'; }
function renderSite(t, b) {
  var cars = siteCars(b), first = cars.filter(function (c) { return c.type === 'SUV' || c.type === 'MPV'; })[0] || cars[0];
  var tom = new Date(TODAY.getTime() + DAY), ret = new Date(TODAY.getTime() + 4 * DAY);
  if (t === 0) {
    return '<div class="site t1"><div class="t1-hero"><div class="t1-nav"><div class="lg">' + siteMark(b) + esc(b.short) + '</div><nav><span>Home</span><span>Cars</span><span>How it works</span><span>About</span><span>FAQ</span></nav><span class="t1-btn">Book now</span></div>' +
      '<div class="t1-h"><p>Welcome to ' + esc(b.name) + '</p><h1><span>Rent</span><em>-</em>Ride<em>-</em>Explore</h1></div>' + carSVG(first.color, first.shape, { cls: 't1-hero-car', label: carName(first) }) + '<div class="t1-arc"></div></div>' +
      '<div class="t1-main"><div class="t1-pick"><div><small>Pick-up location</small><b>' + esc(b.locations[0].n) + '</b></div><div><small>Pick-up date</small><b>' + dShort(tom) + ', 10:00 am</b></div><div><small>Return date</small><b>' + dShort(ret) + ', 10:00 am</b></div><div><small>Car type</small><b>Any car</b></div><span class="t1-btn glow">Find a car</span></div>' +
      '<div class="t1-sec"><h2>Our cars</h2><p class="lead">Clean, checked and ready. Prices are per day.</p><div class="t1-cars">' + cars.slice(0, 6).map(function (c) {
        return '<div class="t1-car"><span class="go">' + SI.arrow + '</span>' + carSVG(c.color, c.shape, { cls: 'img', label: carName(c) }) + '<h3>' + esc(carName(c)) + '</h3><div class="pr">From ' + rm(c.rate) + ' a day</div><div class="facts"><span>' + c.seats + ' Person</span><span>Auto</span><span>' + c.fuel + '</span><span>' + c.year + '</span></div></div>';
      }).join('') + '</div></div>' +
      '<div class="t1-sec"><h2>How it works</h2><p class="lead">Three steps, all on your phone.</p><div class="t1-how"><div><div class="ic r">' + SI.car + '</div><h3>Choose your car</h3><p>Pick the dates and the car that fits your trip.</p></div><div><div class="ic">' + SI.doc + '</div><h3>Sign on your phone</h3><p>Check the booking, read the rules and sign the agreement.</p></div><div><div class="ic">' + SI.key + '</div><h3>Get the keys</h3><p>Collect at ' + esc(b.locations[0].n.split(',')[0].toLowerCase()) + ' or we deliver.</p></div></div></div>' +
      '<div class="t1-sec"><div class="t1-offer"><div><h2>What we offer</h2><p style="color:#969696;margin:0 0 20px">Everything you need for a smooth rental with ' + esc(b.short) + '.</p>' + ['Delivery to your hotel or the airport', 'Clean cars, checked before every rental', 'Deposit back within ' + b.refundHours + ' hours', 'Help on WhatsApp, day and night'].map(function (s, k) { return '<div class="it"><b>0' + (k + 1) + '</b><span>' + s + '</span></div>'; }).join('') + '</div><div class="pics"><div>' + carSVG(cars[1 % cars.length].color, cars[1 % cars.length].shape).replace('<svg', '<svg style="width:90%"') + '</div><div>' + carSVG(cars[2 % cars.length].color, cars[2 % cars.length].shape).replace('<svg', '<svg style="width:90%"') + '</div></div></div></div>' +
      '<div class="t1-sec"><h2>Questions</h2><p class="lead">The things people ask us most.</p><div class="t1-faq">' + ['What do I need to rent a car?', 'How much is the deposit?', 'Can you deliver the car?', 'What if I return late?'].map(function (q) { return '<div><span>' + q + '</span><span style="color:var(--t1-red)">+</span></div>'; }).join('') + '</div></div></div>' +
      '<div class="t1-foot" style="position:relative"><div><b>' + esc(b.legal) + '</b><br>' + esc(b.address) + '</div><div>' + esc(b.phone) + '<br>' + esc(b.email) + '</div><div>© 2026 ' + esc(b.name) + '</div><span class="t1-wa">' + SI.wa + '</span></div></div>';
  }
  if (t === 1) {
    return '<div class="site t2"><div class="t2-nav"><div class="lg">' + siteMark(b) + esc(b.name) + '</div><nav><a>Cars</a><a>How it works</a><a>Questions</a><span class="t2-btn">Book a car</span></nav></div>' +
      '<div class="t2-hero"><div><span class="kick">' + esc(b.city.toUpperCase()) + ' · FROM ' + rm(Math.min.apply(0, cars.map(function (c) { return c.rate; }))) + ' A DAY</span><h1>The easy way to <span>rent a car</span> in ' + esc(b.city) + '.</h1><p>' + esc(b.tag) + '. Book in two minutes, sign on your phone and drive away.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><span class="t2-btn">See our cars ' + SI.arrow + '</span><span class="t2-btn ghost">WhatsApp us</span></div></div>' +
      '<div class="t2-blob">' + carSVG(first.color, first.shape, { label: carName(first) }) + '</div></div>' +
      '<div class="t2-book"><div><small>Pick-up</small><b>' + esc(b.locations[0].n) + '</b></div><div><small>From</small><b>' + dShort(tom) + ', 10:00 am</b></div><div><small>To</small><b>' + dShort(ret) + ', 10:00 am</b></div><span class="t2-btn" style="border-radius:12px;padding:13px 22px;justify-content:center">Find a car</span></div>' +
      '<div class="t2-sec"><h2>Pick your car</h2><p class="lead">' + plural(cars.length, 'car') + ' ready to book. Prices per day, deposit refundable.</p><div class="t2-cars">' + cars.slice(0, 8).map(function (c) {
        return '<div class="t2-car"><div class="img">' + carSVG(c.color, c.shape, { label: carName(c) }) + '</div><div class="bd"><h3>' + esc(carModel(c)) + '</h3><div class="meta">' + c.type + ' · ' + c.seats + ' seats · Auto</div><div class="ft"><b>' + rm(c.rate) + ' <small>/ day</small></b><span>' + SI.arrow + '</span></div></div></div>';
      }).join('') + '</div></div>' +
      '<div class="t2-sec"><h2>Why ' + esc(b.short) + '</h2><p class="lead">Simple rules, written down before you sign.</p><div class="t2-why"><div>' + SI.shield + '<b>Checked cars</b><p>Every car is inspected with photos at handover and return.</p></div><div>' + SI.clock + '<b>Deposit back fast</b><p>Refunded within ' + b.refundHours + ' hours after the car is checked.</p></div><div>' + SI.pin + '<b>We come to you</b><p>' + esc(b.locations.map(function (l) { return l.n.split(',')[0]; }).slice(0, 2).join(' or ')) + '.</p></div><div>' + SI.chat + '<b>Real people</b><p>Ask us anything on WhatsApp at ' + esc(b.phone) + '.</p></div></div></div>' +
      '<div class="t2-cta"><div><h2>Ready when you are.</h2><div style="opacity:.75;margin-top:4px">Book online, sign on your phone, collect the keys.</div></div><span class="t2-btn">Book a car ' + SI.arrow + '</span></div>' +
      '<div class="t2-foot"><span>© 2026 ' + esc(b.legal) + ' · ' + esc(b.reg) + '</span><span>' + esc(b.address) + '</span></div></div>';
  }
  return '<div class="site t3"><div class="t3-top"><span>' + esc(b.phone) + ' · ' + esc(b.email) + '</span><span>Open every day, 8 am to 10 pm</span></div><div class="t3-nav"><div class="lg">' + siteMark(b) + esc(b.name) + '</div><nav><span>Fleet</span><span>Rates</span><span>Locations</span><span>Contact</span></nav><span class="t3-btn">Reserve</span></div>' +
    '<div class="t3-hero"><div class="l"><div style="font-weight:700;letter-spacing:.14em;font-size:12px;color:var(--primary)">' + esc(b.city.toUpperCase()) + '</div><h1>Drive something <i>better</i> this weekend.</h1><p>' + esc(b.tag) + '. Hand-picked cars, clear prices, and an agreement you sign on your phone.</p><div><span class="t3-btn">See the fleet ' + SI.arrow + '</span></div></div>' +
    '<div class="r">' + carSVG(first.color, first.shape, { label: carName(first) }) + '<div class="tag">' + esc(carName(first)) + '<b>' + rm(first.rate) + ' a day</b></div></div></div>' +
    '<div class="t3-list"><h2>The fleet</h2>' + cars.slice(0, 6).map(function (c) {
      return '<div class="t3-row">' + carSVG(c.color, c.shape, { label: carName(c) }) + '<div><h3>' + esc(carName(c)) + '</h3><div class="meta">' + c.year + ' · ' + c.type + ' · ' + c.seats + ' seats · ' + c.color + '</div></div><div class="pr">' + rm(c.rate) + ' <small>/ day</small></div><span class="t3-btn">Reserve</span></div>';
    }).join('') + '</div>' +
    '<div class="t3-band"><div><b>' + cars.length + '</b>cars ready to book</div><div><b>' + b.refundHours + 'h</b>to get your deposit back</div><div><b>' + b.locations.length + '</b>places to pick up</div></div>' +
    '<div class="t3-foot"><span>© 2026 ' + esc(b.legal) + '</span><span>' + esc(b.address) + '</span></div></div>';
}
PAGES.website = function () {
  var b = B(), pub = S.ws.published[b.id], cur = S.ws.cur[b.id] || 0, domain = b.slug + '.orbiquefms.site';
  var gal = '<div class="wg-gal">' + TEMPLATES.map(function (t, k) {
    var live = pub && pub.t === k;
    return '<article class="card wg-card' + (cur === k ? ' cur' : '') + '"><button type="button" class="wg-thumb" data-fit="1" data-a="wsprev" data-v="' + k + '" aria-label="Preview ' + t.name + '"><div class="wg-shot" aria-hidden="true" inert>' + renderSite(k, b) + '</div><span class="wg-hover">' + i('eye') + '&nbsp;Preview</span></button>' +
      '<div class="wg-info"><div class="row wrap gap8"><b class="h5" style="margin-right:auto">' + t.name + '</b>' + (live ? '<span class="chip ok">Live</span>' : '') + (cur === k ? '<span class="chip pri">In use</span>' : '') + '</div><div class="b2">' + t.mood + '. ' + t.best + '.</div><div class="cap faint">' + (k === 0 ? i('star') + ' Based on the template system\'s own customer site' : 'Built from your cars, prices, logo and colours') + '</div>' +
      '<div class="acts"><button type="button" class="btn o sm" data-a="wsprev" data-v="' + k + '">' + i('eye') + 'Preview</button>' + (cur === k ? '<button type="button" class="btn c sm" data-a="wspub" data-v="' + k + '">' + i('upload') + 'Publish</button>' : '<button type="button" class="btn t sm" data-a="wsuse" data-v="' + k + '">Use this design</button>') + '</div></div></article>';
  }).join('') + '</div>';
  var full = '';
  if (S.ws.full !== null) {
    var f = S.ws.full, t = TEMPLATES[f];
    full = '<div class="wg-full" role="dialog" aria-modal="true" aria-label="' + t.name + ' preview"><div class="wg-fbar"><button type="button" class="ib" data-a="wsstep" data-v="-1" aria-label="Previous design">' + i('chevron-left') + '</button><div class="ttl"><b>' + t.name + '</b><small>' + (f + 1) + ' of ' + TEMPLATES.length + ' · ' + t.best + '</small></div><button type="button" class="ib" data-a="wsstep" data-v="1" aria-label="Next design">' + i('chevron-right') + '</button><span class="grow"></span>' +
      '<div class="wg-seg"><button type="button" class="' + (S.ws.device === 'desktop' ? 'on' : '') + '" data-a="wsdev" data-v="desktop">Desktop</button><button type="button" class="' + (S.ws.device === 'phone' ? 'on' : '') + '" data-a="wsdev" data-v="phone">Phone</button></div>' +
      (cur === f ? '<button type="button" class="btn c sm" data-a="wspub" data-v="' + f + '">' + i('upload') + 'Publish</button>' : '<button type="button" class="btn c sm" data-a="wsuse" data-v="' + f + '">Use this design</button>') + '<button type="button" class="ib" data-a="wsclose" aria-label="Close preview">' + i('x') + '</button></div>' +
      '<div class="wg-fbody"><div class="wg-frame' + (S.ws.device === 'phone' ? ' phone' : '') + '"><div class="wg-url">' + i('lock') + domain + '</div>' + renderSite(f, b) + '</div></div></div>';
  }
  return '<div class="pg-h"><div><h1>Website</h1><p>Pick a design, check the preview, then publish. Every design uses ' + esc(b.short) + '\'s logo, colours, cars and prices, and the Book buttons open the booking form.</p></div><div class="acts"><button type="button" class="btn o" data-a="wsprev" data-v="' + cur + '">' + i('eye') + 'Preview site</button><button type="button" class="btn c" data-a="wspub" data-v="' + cur + '">' + i('upload') + 'Publish</button></div></div>' +
    '<div class="card mb24"><div class="card-b tight row wrap gap16"><span class="av sq lg">' + i('world') + '</span><div class="grow"><div class="t1c fw5">' + domain + '</div><div class="b2">' + (pub ? 'Live: ' + TEMPLATES[pub.t].name + ', published ' + pub.at + ' by ' + esc(pub.by) : 'Not published yet') + '. Your own domain can point here too.</div></div>' + (pub ? (pub.t === cur ? '<span class="chip ok lg">Up to date</span>' : '<span class="chip warn lg">Unpublished changes</span>') : '<span class="chip lg">Not published</span>') + '</div></div>' +
    '<div class="row wrap mb16" style="justify-content:space-between"><div><div class="h5">Choose a design</div><div class="b2">' + TEMPLATES.length + ' complete websites. Switching keeps your text and settings.</div></div></div>' + gal + full;
};
A.wsprev = function (v) { S.ws.full = +v; S.ws.device = window.innerWidth < 760 ? 'phone' : 'desktop'; render(); };
A.wsclose = function () { S.ws.full = null; render(); };
A.wsstep = function (v) { S.ws.full = (S.ws.full + (+v) + TEMPLATES.length) % TEMPLATES.length; render(); var fb = document.querySelector('.wg-fbody'); if (fb) fb.scrollTop = 0; };
A.wsdev = function (v) { S.ws.device = v; render(); };
A.wsuse = function (v) { S.ws.cur[B().id] = +v; render(); toast('Now using ' + TEMPLATES[+v].name + '. Publish when you are happy.'); };
A.wspub = function (v) { var b = B(); S.ws.cur[b.id] = +v; S.ws.published[b.id] = { t: +v, at: '19 Oct 2026, ' + tm(TODAY), by: b.owner.split(' ')[0] }; S.ws.full = null; render(); toast(TEMPLATES[+v].name + ' is live at ' + b.slug + '.orbiquefms.site (sample, nothing goes online).'); };
