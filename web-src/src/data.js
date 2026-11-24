/* ===================================================================
   Data: three made-up rental companies, colour helpers, made-up fleet, customers and bookings.
   Every name, number and place here is invented for the sample.
   =================================================================== */
var TODAY = new Date(2026, 9, 19, 14, 32);
var DAY = 864e5;
/* the sample's clock: starts at TODAY when the page opens and runs on from there */
var T0 = Date.now();
function NOW() { return new Date(TODAY.getTime() + (Date.now() - T0)); }

/* ---------------- colour helpers ---------------- */
var C = {
  rgb: function (h) { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; }); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); },
  hex: function (r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase(); },
  mix: function (a, b, t) { var x = C.rgb(a), y = C.rgb(b); return C.hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); },
  ch: function (h) { return C.rgb(h).join(' '); },
  lum: function (h) { var c = C.rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; },
  contrast: function (a, b) { var x = C.lum(a), y = C.lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); },
  hsl: function (h) {
    var r = C.rgb(h).map(function (v) { return v / 255; }), mx = Math.max.apply(0, r), mn = Math.min.apply(0, r), l = (mx + mn) / 2, s = 0, hue = 0, d = mx - mn;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hue = mx === r[0] ? (r[1] - r[2]) / d + (r[1] < r[2] ? 6 : 0) : mx === r[1] ? (r[2] - r[0]) / d + 2 : (r[0] - r[1]) / d + 4; hue *= 60; }
    return [hue, s, l];
  },
  onColor: function (h) { return C.contrast(h, '#FFFFFF') >= 3 ? '#FFFFFF' : '#16171B'; },
  /* a darker version of a colour until it reaches the wanted contrast on white */
  readable: function (h, target) { var x = h, i = 0; while (C.contrast(x, '#FFFFFF') < (target || 4.5) && i < 20) { x = C.mix(x, '#000000', .08); i++; } return x; },
  /* a lighter version of a colour until it reaches the wanted contrast on a dark colour */
  onDark: function (h, bg, target) { var x = h, i = 0; while (C.contrast(x, bg) < (target || 3.2) && i < 20) { x = C.mix(x, '#FFFFFF', .1); i++; } return x; }
};

/* ---------------- logos (simple made-up marks) ---------------- */
var MARKS = {
  kilat: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0B0D12"/><path d="M37 8L16 37h14l-4 19 22-30H34z" fill="#1E6BFF"/><path d="M9 47h11M12 53h9" stroke="#1E6BFF" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>',
  padi: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="#17603F"/><path d="M17 40a15 15 0 0 1 30 0z" fill="#D9A520"/><path d="M13 45h38M19 51h26" stroke="#D9A520" stroke-width="3.2" stroke-linecap="round"/><path d="M32 9c5 5 5 11 0 16c-5-5-5-11 0-16z" fill="#D9A520"/><path d="M22 14c6 2 8 7 6 12c-6-2-8-7-6-12zM42 14c-6 2-8 7-6 12c6-2 8-7 6-12z" fill="#E7C15A"/></svg>',
  bara: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#26282B"/><circle cx="32" cy="35" r="19" fill="none" stroke="#45484D" stroke-width="5"/><path d="M32 11c8 9 13 15 13 24a13 13 0 0 1-26 0c0-5 3-9 6-12c0 5 2 8 5 9c-2-7 0-14 2-21z" fill="#D7192D"/><circle cx="32" cy="38" r="4" fill="#26282B"/></svg>',
  orbique: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0B5D54"/><circle cx="32" cy="32" r="15" fill="none" stroke="#fff" stroke-width="6"/><circle cx="46" cy="18" r="6" fill="#C9A227"/></svg>'
};
function initialMark(letter, bg, fg) {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="' + bg + '"/><text x="32" y="43" text-anchor="middle" font-family="Manrope,Inter,sans-serif" font-size="30" font-weight="800" fill="' + fg + '">' + letter + '</text></svg>';
}

/* ---------------- a car drawn from the side, in its own colour ---------------- */
var CAR_COLORS = { 'White': '#F1F2F4', 'Pearl White': '#EDE9E1', 'Silver': '#C2C6CB', 'Grey': '#6D727A', 'Black': '#1D1E22', 'Red': '#C3171D', 'Blue': '#1F50A8', 'Dark Blue': '#1B2C55', 'Champagne Gold': '#C7B188', 'Green': '#2E6A4E', 'Orange': '#E1661C', 'Brown': '#6B4A35' };
var SHAPES = {
  hatch: { body: 'M20 80L23 62Q26 53 40 51L70 47L95 29Q101 25 111 25L158 25Q170 25 178 33L198 50Q214 52 219 61L222 74Q222 84 213 84L28 84Q20 84 20 80Z', win: 'M77 49L98 32Q102 29 110 29L157 29Q166 29 172 35L189 50Z', pillar: 'M133 29L131 50', wb: [62, 180] },
  sedan: { body: 'M12 78L16 63Q20 55 34 53L70 49L98 31Q104 27 114 27L150 27Q160 27 168 35L186 49L214 53Q225 55 227 65L228 75Q228 84 220 84L20 84Q12 84 12 78Z', win: 'M76 50L100 34Q104 31 112 31L148 31Q157 31 162 36L177 50Z', pillar: 'M129 31L127 50', wb: [56, 184] },
  suv: { body: 'M14 80L16 58Q18 47 32 45L58 43L78 22Q84 16 94 16L176 16Q188 16 194 26L206 42Q220 45 222 57L224 75Q224 84 215 84L22 84Q14 84 14 80Z', win: 'M64 44L82 25Q86 21 94 21L174 21Q184 21 188 28L198 44Z', pillar: 'M128 21L128 44M164 21L166 44', wb: [58, 184] },
  mpv: { body: 'M14 80L16 60Q18 49 30 46L50 42L74 18Q80 13 90 13L190 13Q206 13 210 26L218 50Q224 54 224 62L224 76Q224 84 216 84L22 84Q14 84 14 80Z', win: 'M56 43L78 20Q82 17 90 17L188 17Q200 17 203 27L208 43Z', pillar: 'M118 17L118 43M160 17L160 43', wb: [56, 186] }
};
function carSVG(colorName, shape, opts) {
  opts = opts || {};
  var col = CAR_COLORS[colorName] || colorName || '#C2C6CB', s = SHAPES[shape] || SHAPES.hatch;
  var dark = C.mix(col, '#000000', .3), light = C.mix(col, '#FFFFFF', .35);
  var edge = C.lum(col) > .6 ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.15)';
  var w = function (x) { return '<g><circle cx="' + x + '" cy="84" r="17" fill="#141518"/><circle cx="' + x + '" cy="84" r="10" fill="#9CA1A8"/><circle cx="' + x + '" cy="84" r="4" fill="#4A4E55"/><path d="M' + (x - 9) + ' 84h18M' + x + ' 75v18" stroke="#6E737B" stroke-width="2"/></g>'; };
  return '<svg viewBox="0 0 240 112" ' + (opts.cls ? 'class="' + opts.cls + '" ' : '') + 'role="img" aria-label="' + (opts.label || 'Car') + '">' +
    '<ellipse cx="120" cy="101" rx="104" ry="7" fill="rgba(0,0,0,.18)"/>' +
    '<path d="' + s.body + '" fill="' + col + '" stroke="' + edge + '" stroke-width="1.2"/>' +
    '<path d="M24 70Q120 62 222 68" stroke="' + light + '" stroke-width="2.4" fill="none" opacity=".7"/>' +
    '<path d="M22 78H222" stroke="' + dark + '" stroke-width="3" opacity=".35"/>' +
    '<path d="' + s.win + '" fill="#26303B"/><path d="' + s.win + '" fill="url(#none)" opacity="0"/>' +
    '<path d="' + s.pillar + '" stroke="' + col + '" stroke-width="5"/>' +
    '<rect x="' + (s.wb[1] + 26) + '" y="58" width="9" height="5" rx="2" fill="#FFE7A8"/>' +
    '<rect x="17" y="61" width="7" height="5" rx="2" fill="#D9322E"/>' +
    w(s.wb[0]) + w(s.wb[1]) + '</svg>';
}

/* ---------------- seeded random ---------------- */
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- companies ---------------- */
var MODELS = {
  myvi: { make: 'Perodua', model: 'Myvi 1.5 AV', type: 'Hatchback', seats: 5, cc: 1496, rate: 120, shape: 'hatch', fuel: 'Petrol' },
  axia: { make: 'Perodua', model: 'Axia 1.0 SE', type: 'Hatchback', seats: 5, cc: 998, rate: 90, shape: 'hatch', fuel: 'Petrol' },
  bezza: { make: 'Perodua', model: 'Bezza 1.3 AV', type: 'Sedan', seats: 5, cc: 1329, rate: 110, shape: 'sedan', fuel: 'Petrol' },
  saga: { make: 'Proton', model: 'Saga 1.3 Premium', type: 'Sedan', seats: 5, cc: 1332, rate: 100, shape: 'sedan', fuel: 'Petrol' },
  city: { make: 'Honda', model: 'City 1.5 V', type: 'Sedan', seats: 5, cc: 1498, rate: 160, shape: 'sedan', fuel: 'Petrol' },
  vios: { make: 'Toyota', model: 'Vios 1.5 G', type: 'Sedan', seats: 5, cc: 1496, rate: 160, shape: 'sedan', fuel: 'Petrol' },
  x50: { make: 'Proton', model: 'X50 1.5T', type: 'SUV', seats: 5, cc: 1477, rate: 220, shape: 'suv', fuel: 'Petrol' },
  x70: { make: 'Proton', model: 'X70 1.5T', type: 'SUV', seats: 5, cc: 1477, rate: 260, shape: 'suv', fuel: 'Petrol' },
  hrv: { make: 'Honda', model: 'HR-V 1.5', type: 'SUV', seats: 5, cc: 1498, rate: 250, shape: 'suv', fuel: 'Petrol' },
  alza: { make: 'Perodua', model: 'Alza 1.5 AV', type: 'MPV', seats: 7, cc: 1496, rate: 180, shape: 'mpv', fuel: 'Petrol' },
  alphard: { make: 'Toyota', model: 'Alphard 2.5', type: 'MPV', seats: 7, cc: 2494, rate: 650, shape: 'mpv', fuel: 'Petrol' },
  ativa: { make: 'Perodua', model: 'Ativa 1.0T', type: 'SUV', seats: 5, cc: 998, rate: 170, shape: 'suv', fuel: 'Petrol' }
};

var BRANDS = [
  {
    id: 'kilat', name: 'Kilat Wheels', short: 'Kilat', sub: 'Wheels', legal: 'Kilat Wheels Sdn. Bhd.', reg: '202401000101 (Sample)', code: 'KLT', startNo: 386,
    primary: '#1E6BFF', secondary: '#0B0D12', accent: '#1E6BFF', colorsLabel: 'Black and blue', mark: MARKS.kilat,
    owner: 'Irfan Hakimi', staff: ['Irfan', 'Zul', 'Mei Yee'], city: 'Petaling Jaya',
    address: 'No. 8, Jalan Sampel 2/1, 46000 Petaling Jaya, Selangor', phone: '+60 00-111 2040', email: 'hello@kilatwheels.example',
    slug: 'kilat', plan: 'growth', fines: { smoking: 200, dashcam: 200, key: 600, late: 20, toll: 10 }, deposit: 200, extendHours: 12, refundHours: 24,
    locations: [{ n: 'Main office, Petaling Jaya', p: true, d: true }, { n: 'Airport arrivals (delivery)', p: true, d: true }, { n: 'Hotel delivery in the city', p: true, d: false }],
    fleet: [['myvi', 'VKP 4418', 'Red', 2023], ['axia', 'VKR 2207', 'Silver', 2024], ['city', 'VLB 7130', 'Black', 2023], ['vios', 'VLC 5512', 'White', 2022], ['x50', 'VKX 9001', 'Blue', 2024], ['alza', 'VMA 3326', 'Grey', 2023], ['hrv', 'VMB 6604', 'Pearl White', 2024], ['bezza', 'VKQ 1185', 'Silver', 2022]],
    tag: 'Fast, simple car rental in the Klang Valley'
  },
  {
    id: 'padi', name: 'Padi Emas Rent-a-Car', short: 'Padi Emas', sub: 'Rent-a-Car', legal: 'Padi Emas Kereta Sewa Enterprise', reg: 'SA0000001-X (Sample)', code: 'PDE', startNo: 152,
    primary: '#17603F', secondary: '#0F2A1D', accent: '#D9A520', colorsLabel: 'Green and gold', mark: MARKS.padi,
    owner: 'Grace Yap', staff: ['Grace', 'Hakim', 'Suresh'], city: 'Ipoh',
    address: 'No. 21, Jalan Contoh Emas, 30000 Ipoh, Perak', phone: '+60 00-525 7788', email: 'sewa@padiemas.example',
    slug: 'padiemas', plan: 'starter', fines: { smoking: 150, dashcam: 150, key: 500, late: 15, toll: 10 }, deposit: 150, extendHours: 12, refundHours: 48,
    locations: [{ n: 'Ipoh office', p: true, d: true }, { n: 'Ipoh train station', p: true, d: true }, { n: 'Hotel delivery in Ipoh', p: true, d: true }],
    fleet: [['axia', 'AKC 2210', 'Green', 2023], ['myvi', 'AKF 8812', 'White', 2024], ['saga', 'AJW 4471', 'Silver', 2022], ['bezza', 'AKA 3090', 'Champagne Gold', 2023], ['alza', 'AKH 1166', 'Silver', 2024], ['ativa', 'AKJ 5520', 'Orange', 2024], ['vios', 'AKD 7303', 'Grey', 2022]],
    tag: 'Kereta sewa yang jujur di Ipoh'
  },
  {
    id: 'bara', name: 'Bara Car Rental', short: 'Bara', sub: 'Car Rental', legal: 'Bara Mobility Sdn. Bhd.', reg: '202301000777 (Sample)', code: 'BRA', startNo: 1204,
    primary: '#D7192D', secondary: '#26282B', accent: '#D7192D', colorsLabel: 'Red and charcoal', mark: MARKS.bara,
    owner: 'Arun Pillai', staff: ['Arun', 'Nadia', 'Kok Wai'], city: 'Johor Bahru',
    address: 'Lot 5, Jalan Ujian Bara 3, 80000 Johor Bahru, Johor', phone: '+60 00-777 0303', email: 'drive@baracars.example',
    slug: 'bara', plan: 'pro', fines: { smoking: 250, dashcam: 200, key: 700, late: 25, toll: 15 }, deposit: 300, extendHours: 24, refundHours: 24,
    locations: [{ n: 'Johor Bahru office', p: true, d: true }, { n: 'Airport arrivals (delivery)', p: true, d: true }, { n: 'Checkpoint pick-up point', p: true, d: false }, { n: 'Hotel delivery in the city', p: true, d: true }],
    fleet: [['x70', 'JUV 7781', 'Black', 2024], ['city', 'JRT 4410', 'Red', 2023], ['myvi', 'JTE 1029', 'Silver', 2023], ['alphard', 'JWW 8', 'Black', 2022], ['hrv', 'JUC 3355', 'Grey', 2024], ['vios', 'JQP 6620', 'White', 2023], ['x50', 'JSM 2234', 'Red', 2024], ['alza', 'JUA 9017', 'White', 2023], ['axia', 'JTA 5546', 'Blue', 2024]],
    tag: 'Car rental in Johor Bahru, day and night'
  }
];

var PEOPLE = [
  ['Aiman Hakim', 'Malaysian'], ['Tan Mei Ling', 'Malaysian'], ['Ravi Kumar', 'Malaysian'], ['Nur Aisyah Rahman', 'Malaysian'], ['Daniel Lim', 'Singaporean'],
  ['Siti Hajar Osman', 'Malaysian'], ['Kavitha Subramaniam', 'Malaysian'], ['Faris Iskandar', 'Malaysian'], ['Lee Wei Jie', 'Malaysian'], ['Emily Clarke', 'British'],
  ['Priya Nair', 'Malaysian'], ['Jonathan Ong', 'Singaporean'], ['Farah Nadia', 'Malaysian'], ['Rizky Pratama', 'Indonesian'], ['Muhammad Danial', 'Malaysian'], ['Sarah Abdullah', 'Malaysian'],
  ['Chong Kah Wai', 'Malaysian'], ['Nurul Ain Kamal', 'Malaysian'], ['Ganesh Murugan', 'Malaysian'], ['Hannah Lee', 'Australian'], ['Amirul Haziq', 'Malaysian'], ['Wong Pei Shan', 'Malaysian'],
  ['Syafiq Ridzuan', 'Malaysian'], ['Deepa Krishnan', 'Malaysian'], ['Kenji Tanaka', 'Japanese'], ['Aina Sofea', 'Malaysian'], ['Ho Jun Hao', 'Malaysian'], ['Nabila Hanim', 'Malaysian']
];

/* ---------------- build each company's records ---------------- */
function buildData(B, seed) {
  var R = rng(seed), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var cars = B.fleet.map(function (f, i) {
    var m = MODELS[f[0]], tax = new Date(2026, ri(0, 11), ri(1, 28));
    if (i === 2) tax = new Date(2026, 10, 3); if (i === 5) tax = new Date(2026, 9, 12);
    if (tax < new Date(2026, 9, 1) && i !== 5) tax = new Date(2027, tax.getMonth(), tax.getDate());
    var rate = m.rate + (B.id === 'bara' ? 20 : B.id === 'padi' ? -10 : 0);
    return { i: i, key: f[0], make: m.make, model: m.model, type: m.type, seats: m.seats, cc: m.cc, shape: m.shape, fuel: m.fuel, trans: 'Auto', plate: f[1], color: f[2], year: f[3], rate: rate,
      odo: ri(8, 72) * 1000 + ri(0, 999), tax: tax, status: i === B.fleet.length - 2 ? 'workshop' : 'active', web: i !== 1 || B.id !== 'bara',
      insurer: pick(['Takaful Contoh', 'Insurans Sampel Berhad', 'Perlindungan Demo']), insExp: new Date(tax.getTime() + ri(-20, 40) * DAY), chassis: 'PM2' + String(ri(100000, 999999)) + 'K' + ri(100, 999), engine: String.fromCharCode(65 + ri(0, 20)) + ri(10, 99) + 'X' + ri(100000, 999999) };
  });
  var people = PEOPLE.map(function (p, i) {
    var parts = p[0].toLowerCase().split(' ');
    var yy = ri(78, 99), id = p[1] === 'Malaysian' ? yy + '' + String(ri(1, 12)).padStart(2, '0') + String(ri(1, 28)).padStart(2, '0') + '-' + String(ri(1, 14)).padStart(2, '0') + '-' + ri(1000, 9999) : (p[1] === 'Singaporean' ? 'K' : p[1] === 'British' ? '5' : 'C') + ri(1000000, 9999999);
    return { i: i, name: p[0], nat: p[1], phone: '+60 00-' + ri(100, 999) + ' ' + ri(1000, 9999), email: parts[0] + '.' + parts[parts.length - 1] + '@mail.example', ic: id, flag: i === 3 || i === 19 ? 'VIP' : i === 11 || i === 24 ? 'Be careful' : i === 13 || i === 27 ? 'Blacklisted' : '', since: new Date(2025, ri(0, 11), ri(1, 28)) };
  });
  /* bookings: walk every car through the weeks before and after today */
  var raw = [];
  cars.forEach(function (car) {
    var t = new Date(TODAY.getTime() - 46 * DAY); t.setHours(10, 0, 0, 0);
    while (t < new Date(TODAY.getTime() + 13 * DAY)) {
      var gap = R() < .45 ? 0 : ri(1, 3), start = new Date(t.getTime() + gap * DAY); start.setHours(pick([9, 10, 10, 11, 14, 16, 18]), 0, 0, 0);
      var dur = pick([1, 1, 2, 2, 2, 3, 3, 4, 5, 7]), end = new Date(start.getTime() + dur * DAY);
      if (car.status === 'workshop' && end > new Date(TODAY.getTime() - 3 * DAY) && start < new Date(TODAY.getTime() + 4 * DAY)) { t = new Date(TODAY.getTime() + 4 * DAY); continue; }
      raw.push({ car: car, start: start, end: end, days: dur });
      t = new Date(end.getTime() + (R() < .35 ? 0 : DAY));
    }
  });
  raw.sort(function (a, b) { return a.start - b.start; });
  var bookings = raw.map(function (r, n) {
    var cust = people[(n * 7 + ri(0, 3)) % people.length];
    if (cust.flag === 'Blacklisted' && R() < .8 && n !== 5) cust = people[(cust.i + 1) % people.length];
    var st, pay, now = TODAY.getTime();
    if (r.end.getTime() < now) {
      if (now - r.end.getTime() < 3.2 * DAY) { st = 'Car Returned'; pay = 'Refund Pending'; }
      else { st = 'Completed'; pay = 'Deposit Refunded'; }
    } else if (r.start.getTime() <= now) { var ux = R(); st = 'Car Delivered'; pay = ux < .7 ? 'Full Payment Received' : ux < .86 ? 'Extension due' : 'Extension paid'; }
    else if (r.start.getTime() - now < 3 * DAY) { st = 'Agreement Signed'; pay = R() < .6 ? 'Full Payment Received' : 'Deposit Received'; }
    else { var uf = R(); if (uf < .16) { st = 'Pending'; pay = ''; } else if (uf < .32) { st = 'Confirmed'; pay = 'Deposit due'; } else if (uf < .6) { st = 'Agreement Signed'; pay = 'Deposit Received'; } else { st = 'Agreement Sent'; pay = R() < .5 ? 'Deposit due' : 'Deposit Received'; } }
    if (R() < .05 && st !== 'Car Delivered') { st = 'Cancelled'; pay = 'Deposit Refunded'; }
    var rent = r.car.rate * r.days, dep = r.car.key === 'alphard' ? 1000 : (r.car.type === 'SUV' || r.car.type === 'MPV') ? B.deposit + 100 : B.deposit;
    var deliv = R() < .45 ? pick([30, 40, 50, 60]) : 0, ret = deliv ? pick([0, 30, 40]) : 0, dmg = R() < .35 ? 15 * r.days : 0, disc = R() < .12 ? pick([10, 20, 30]) : 0;
    var payable = rent + deliv + ret + dmg - disc + dep;
    if (pay === 'Extension paid') payable += r.car.rate;
    var received = pay === 'Full Payment Received' || pay === 'Refund Pending' || pay === 'Deposit Refunded' || pay === 'Extension paid' ? payable : pay === 'Deposit Received' ? dep + Math.round(rent / 2) : pay === 'Extension due' ? payable : 0;
    if (pay === 'Extension due') payable += r.car.rate;
    if (st === 'Cancelled') received = 0;
    var loc = B.locations[ri(0, B.locations.length - 1)].n;
    return { n: B.startNo + n, code: B.code + '-' + String(B.startNo + n).padStart(5, '0'), car: r.car, cust: cust, start: r.start, end: r.end, days: r.days, rent: rent, dep: dep, deliv: deliv, ret: ret, dmg: dmg, disc: disc,
      payable: payable, received: received, status: st, pay: pay, agent: R() < .8 ? pick(B.staff) : '', pickup: loc, drop: R() < .7 ? loc : B.locations[0].n, created: new Date(r.start.getTime() - ri(1, 12) * DAY), inspected: st === 'Completed' || st === 'Car Returned' || st === 'Car Delivered' };
  });
  /* daily income (rent and charges, not the deposit) and expenses, this month and the same days of last month */
  function incomeOn(d) { var s = 0; bookings.forEach(function (b) { if (b.status !== 'Cancelled' && sameDay(b.start, d) && b.start <= TODAY) s += b.payable - b.dep; }); return s; }
  var days = [], prev = [], exp = [], cnt = [], util = [];
  for (var d = 1; d <= 19; d++) {
    var dt = new Date(2026, 9, d), pd = new Date(2026, 8, d);
    days.push(incomeOn(dt));
    prev.push(Math.round(incomeOn(new Date(dt.getTime())) * (.55 + R() * .7) / 10) * 10 || ri(1, 6) * 80);
    exp.push(ri(1, 9) * 25 + (d % 7 === 3 ? ri(300, 900) : 0));
    cnt.push(bookings.filter(function (b) { return b.status !== 'Cancelled' && sameDay(b.start, dt); }).length);
    util.push(Math.round(100 * bookings.filter(function (b) { return b.status !== 'Cancelled' && b.start <= new Date(dt.getTime() + DAY) && b.end >= dt; }).length / cars.length));
  }
  var months = [], prevYear = [];
  for (var m = 0; m < 10; m++) {
    var base = cars.length * 130 * 30 * (.42 + R() * .3) * (m === 0 || m === 3 || m === 5 ? 1.18 : 1);
    months.push({ income: m === 9 ? sum(days) : Math.round(base / 10) * 10, expense: Math.round(base * (.22 + R() * .12) / 10) * 10 });
  }
  return { cars: cars, people: people, bookings: bookings, days: days, prev: prev, exp: exp, cnt: cnt, util: util, months: months };
}
function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

/* the build runs at the end of this file, after the extra collections are defined */

/* ---------------- other subscribers (platform admin view: counts only) ---------------- */
var OTHER_COMPANIES = [
  { name: 'Sinar Kereta Sewa', owner: 'owner@sinarkereta.example', plan: 'starter', status: 'active', cars: 6, bookings: 31, staff: 2, created: '2026-08-14', last: '2 hours ago', mark: initialMark('S', '#F2B705', '#1B1B1B') },
  { name: 'Teluk Car Hire', owner: 'admin@telukcars.example', plan: 'growth', status: 'active', cars: 18, bookings: 96, staff: 5, created: '2026-07-02', last: '12 minutes ago', mark: initialMark('T', '#0E7C86', '#FFFFFF') },
  { name: 'Bukit Drive Co.', owner: 'hello@bukitdrive.example', plan: 'trial', status: 'active', cars: 3, bookings: 4, staff: 1, created: '2026-10-11', last: 'yesterday', setup: 'demo', mark: initialMark('B', '#5B3FD6', '#FFFFFF') },
  { name: 'Tropika Wheels', owner: 'boss@tropikawheels.example', plan: 'starter', status: 'paused', cars: 9, bookings: 0, staff: 3, created: '2026-05-20', last: '24 days ago', mark: initialMark('T', '#FF7A45', '#FFFFFF') },
  { name: 'Hijau Travel Rent', owner: 'team@hijautravel.example', plan: 'trial', status: 'active', cars: 0, bookings: 0, staff: 1, created: '2026-10-18', last: 'No activity yet', setup: 'none', mark: initialMark('H', '#2F9E44', '#FFFFFF') }
];
var REQUESTS = [
  { co: 'Gemilang Auto Rental', who: 'Hafsah Ismail', email: 'hafsah@gemilang.example', phone: '+60 00-301 4471', cars: 12, msg: 'We run 12 cars in Melaka and use WhatsApp and Excel today. We want the booking form and the agreement for our customers.', when: '35 minutes ago', status: 'new' },
  { co: 'Kenari Car Rent', who: 'Wong Kar Hoe', email: 'karhoe@kenari.example', phone: '+60 00-918 2205', cars: 25, msg: 'Can we bring our own domain for the website?', when: '3 hours ago', status: 'new' },
  { co: 'Sutera Wheels', who: 'Liyana Azmi', email: 'liyana@sutera.example', phone: '+60 00-640 1189', cars: 5, msg: '', when: '2 days ago', status: 'handled' }
];
var PLANS = [['trial', 'Trial'], ['starter', 'Starter'], ['growth', 'Growth'], ['pro', 'Pro']];

/* ===================================================================
   Everything else the reference system stores, per company.
   All names, numbers, plates, places and amounts are made up.
   Collections are listed in BUILDERS.md with their fields.
   =================================================================== */
var LISTS = {
  bookingStatus: ['Pending', 'Confirmed', 'Agreement Sent', 'Agreement Signed', 'Car Delivered', 'Car Returned', 'Completed', 'Cancelled'],
  paymentStatus: ['Deposit due', 'Deposit Received', 'Full Payment Received', 'Extension due', 'Extension paid', 'Refund Pending', 'Deposit Refunded'],
  payKinds: ['Security deposit', 'Rental payment', 'Delivery charge', 'Return charge', 'Damage coverage', 'Extension payment', 'Other payment'],
  methods: ['Cash', 'Card', 'Online Transfer'],
  expenseMethods: ['Cash', 'Card', 'Bank transfer', 'E-wallet', 'Other'],
  startOpts: ['Not chosen', 'Pick-up from our location', 'Delivery to client location', 'Delivery to KLIA'],
  endOpts: ['Not chosen', 'Drop-off at our location', 'Return from client location', 'Return from KLIA'],
  taskTypes: ['General', 'Car delivery from our location', 'Car return to our location', "Car delivery to client's location", "Car return from client's location", 'Car delivery to KLIA', 'Car return from KLIA'],
  taskStatus: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
  waStatus: ['Not Sent', 'Template Sent', 'Reply Received', 'Details Sent', 'Failed'],
  serviceTypes: ['Car wash and polish', 'Engine oil and filter', 'General service', 'Tyres', 'Brakes', 'Battery', 'Aircond service', 'Transmission fluid', 'Alignment and balancing', 'Wipers', 'Detailing', 'Accident repair', 'Other'],
  jobStatus: ['Planned', 'In the workshop', 'Done', 'Cancelled'],
  paperTypes: ['Road tax', 'Insurance', 'PUSPAKOM', 'Rental permit', 'Car grant', 'Other'],
  vendorKinds: ['Workshop', 'Tyre shop', 'Aircond specialist', 'Body shop', 'Dealer / service centre', 'Insurance', 'Other'],
  downtimeReasons: ['Service', 'Repair', 'Accident', 'Inspection', 'Other'],
  deductionKinds: ['Damage', 'Fuel', 'Cleaning', 'Summons', 'Late return fee', 'Other'],
  summonsStatus: ['Needs a booking', 'Ready to charge', 'Check, then charge', 'Charged', 'Paid', 'Waived', 'Disputed'],
  authorities: ['PDRM', 'JPJ', 'Other'],
  activityActions: ['Created', 'Changed', 'Deleted', 'Signed in', 'Failed sign-in', 'Signed out', 'Exported', 'Sent', 'Access change', 'Password reset', 'Viewed a document', 'Other'],
  activityWhere: ['Booking', 'Payment', 'Invoice', 'Receipt', 'Car', 'Customer', 'Expense', 'Summons', 'Deposit refund', 'Car instalment', 'Team member', 'Car owner document', 'Maintenance record', 'Task', 'Settings'],
  manufacturers: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Volkswagen', 'Hyundai', 'Kia', 'Mercedes-Benz', 'BMW', 'Audi', 'Lexus', 'Volvo', 'Porsche', 'Land Rover', 'Jeep', 'Dodge', 'GMC', 'Ram', 'Tesla', 'Subaru', 'Mazda', 'Mitsubishi', 'Ferrari', 'Lamborghini', 'Proton', 'Perodua', 'Other'],
  carTypes: ['Sedan', 'SUV', 'Hatchback', 'MPV', 'Other'],
  fuels: ['Petrol', 'Diesel', 'Hydrogen', 'Electric', 'CNG', 'Other'],
  transmissions: ['Auto', 'Manual'],
  fleetStatus: ['Active', 'Not in use', 'Sold'],
  nationalities: ['Malaysian', 'Singaporean', 'Indonesian', 'Thai', 'Bruneian', 'Filipino', 'Vietnamese', 'Indian', 'Chinese', 'Japanese', 'Korean', 'Australian', 'British', 'American', 'German', 'French', 'Saudi', 'Emirati', 'Other'],
  relationships: ['Spouse', 'Father', 'Mother', 'Sibling', 'Child', 'Relative', 'Friend', 'Colleague', 'Other'],
  noteFlags: ['Info', 'VIP', 'Be careful'],
  bloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  trackerStates: ['Moving', 'Parked', 'Offline'],
  alarmTypes: ['Over-speed', 'Power cut', 'SOS', 'Low battery', 'Vibration', 'Geo-fence exit'],
  dashSections: [['overview', 'Overview', 'The headline figures, "Right now" and the key numbers.'], ['today', 'Today', 'What is going out, coming back and waiting, and what needs attention.'], ['period', 'How the period went', 'Income, expenses and bookings for the chosen period.'], ['months', 'Month by month', 'The year, month by month, against last year.'], ['cars', 'Car by car', 'Which cars earn, cost and work the most.'], ['habits', 'Habits and customers', 'When people come, who they are, and a typical booking.'], ['fleet', 'Fleet and papers', 'Where every car is, maintenance, instalments and the week ahead.'], ['cash', 'Cash', 'Money held and deposits waiting.']]
};

/* expense categories: [name, group, icon, also kept on a service record or paper] */
var EXPENSE_CATS = [
  ['Fuel', 'Everyday', 'gas-station'], ['Toll', 'Everyday', 'road'], ['Parking', 'Everyday', 'parking'], ['Grab fare', 'Everyday', 'car'], ['Bolt fare', 'Everyday', 'car'], ['Car wash', 'Everyday', 'droplet'],
  ['Cleaning supplies and small purchases', 'Everyday', 'spray'], ['Delivery and pick-up costs', 'Everyday', 'truck-delivery'], ['Other (staff)', 'Everyday', 'dots'],
  ['Office rent', 'Office and admin', 'building'], ['Salary and allowances', 'Office and admin', 'users'], ['Commission', 'Office and admin', 'percentage'], ['Road tax (RT)', 'Office and admin', 'license', 1], ['Insurance', 'Office and admin', 'shield', 1],
  ['PUSPAKOM / inspection', 'Office and admin', 'clipboard-check', 1], ['Damage repair', 'Office and admin', 'hammer', 1], ['Servicing and parts', 'Office and admin', 'tool', 1], ['Tyres and batteries', 'Office and admin', 'battery', 1],
  ['Police report', 'Office and admin', 'file-alert'], ['Summons and fines paid', 'Office and admin', 'gavel'], ['SIM and phone recharge', 'Office and admin', 'device-mobile'], ['Internet', 'Office and admin', 'wifi'],
  ['Electricity and water', 'Office and admin', 'bulb'], ['Marketing and ads', 'Office and admin', 'speakerphone'], ['Software and subscriptions', 'Office and admin', 'apps'], ['Accounting and legal fees', 'Office and admin', 'calculator'],
  ['Bank and payment charges', 'Office and admin', 'building-bank'], ['Office supplies', 'Office and admin', 'paperclip'], ['Staff meals and welfare', 'Office and admin', 'tools-kitchen-2'], ['Car loan / hire-purchase instalment', 'Office and admin', 'calendar-dollar'],
  ['Towing and roadside help', 'Office and admin', 'truck'], ['Accessories and child seats', 'Office and admin', 'armchair'], ['Licences and permits', 'Office and admin', 'certificate'], ['Other', 'Office and admin', 'dots']
];

/* role templates (built in), codes chosen from PERM_SECTIONS (perms.js) */
function roleCodes(kind) {
  var all = PERM_CODES.slice(), has = function (list) { return all.filter(function (c) { return list.some(function (p) { return p.slice(-1) === '.' ? c.indexOf(p) === 0 : c === p; }); }); };
  if (kind === 'owner' || kind === 'legacy') return all;
  if (kind === 'none') return [];
  if (kind === 'manager') return all.filter(function (c) { return !/^users\.(create|edit|deactivate|reset_password|manage_roles|manage_menu)$/.test(c) && c.indexOf('ic_check.') !== 0; });
  if (kind === 'front') return has(['dashboard.view', 'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.change_status', 'bookings.view_documents', 'bookings.see_amounts', 'customers.view', 'customers.view_documents', 'customers.check_ic', 'customers.blacklist_view', 'customer_notes.view', 'customer_notes.add', 'inspections.view', 'inspections.create', 'inspections.view_photos', 'cars.view', 'calendar.view', 'calendar.see_amounts', 'tasks.', 'billing.view', 'billing.record_payment', 'billing.issue_receipt', 'billing.send', 'deposits.view', 'deposits.send', 'expenses.view', 'expenses.add', 'expenses.edit_own', 'damage_packages.view', 'signatures.view', 'signatures.use_on_booking', 'summons.view', 'employees.view']);
  if (kind === 'accountant') return has(['dashboard.', 'bookings.view', 'bookings.see_amounts', 'bookings.export', 'reports.', 'billing.', 'expenses.view', 'expenses.view_all', 'expenses.export', 'expenses.add_business', 'deposits.view', 'customers.view', 'summons.view', 'calendar.view', 'calendar.see_amounts', 'cars.view', 'cars.see_instalment']);
  if (kind === 'fleet') return has(['dashboard.view', 'cars.view', 'cars.create', 'cars.edit', 'cars.manage_gallery', 'maintenance.', 'inspections.', 'tracking.', 'calendar.view', 'tasks.view', 'expenses.view', 'expenses.add']);
  if (kind === 'readonly') return all.filter(function (c) { return /\.view$/.test(c) && !/^(billing|summons|deposits|ic_check)\./.test(c); });
  if (kind === 'weekend') return has(['tasks.view', 'calendar.view', 'cars.view', 'inspections.view', 'inspections.create', 'inspections.view_photos']);
  return [];
}
var ROLE_TEMPLATES = [
  ['owner', 'Owner', 'Everything, including team and access settings; cannot be changed.'],
  ['manager', 'Manager', 'Runs day-to-day operations and sees all money. Can see the team list but not change it.'],
  ['front', 'Front desk', 'Takes bookings, talks to customers, hands cars over and gives out tasks. Records payments and payment slips. Cannot delete anything, cancel a payment or see profit.'],
  ['accountant', 'Accountant', 'Sees bookings, revenue, profit and costs, and handles invoices and reports. Changes nothing else.'],
  ['fleet', 'Fleet & maintenance', 'Looks after the cars: car details, photos, inspections and service records with costs.'],
  ['readonly', 'Read-only', 'Can look at every operational page but not change anything or see money or documents.'],
  ['legacy', 'Full access (legacy)', 'Given to everyone who could log in before access control was added.'],
  ['none', 'No access', 'Can sign in but sees nothing. New staff logins start here.']
];

/* each company's team: logins [name, username, role, active] and field agents [name, linked username] */
var TEAMS = {
  kilat: { logins: [['Irfan Hakimi', 'irfan', 'owner', 1], ['Zulkifli Omar', 'zul', 'manager', 1], ['Mei Yee Chong', 'meiyee', 'front', 1], ['Harith Azman', 'harith', 'accountant', 1], ['Siva Raman', 'siva', 'fleet', 1], ['Danish Amri', 'danish', 'weekend', 0]], agents: [['Zulkifli Omar', 'zul'], ['Mei Yee Chong', 'meiyee'], ['Kamal Ariffin'], ['Raju Selvam'], ['Farid Yusof']] },
  padi: { logins: [['Grace Yap', 'grace', 'owner', 1], ['Hakim Rosli', 'hakim', 'manager', 1], ['Suresh Nair', 'suresh', 'front', 1], ['Liew Siew Lan', 'siewlan', 'accountant', 1], ['Ahmad Fauzi', 'fauzi', 'fleet', 1]], agents: [['Hakim Rosli', 'hakim'], ['Suresh Nair', 'suresh'], ['Rahim Said'], ['Tan Boon Keat']] },
  bara: { logins: [['Arun Pillai', 'arun', 'owner', 1], ['Nadia Iskandar', 'nadia', 'manager', 1], ['Kok Wai Leong', 'kokwai', 'front', 1], ['Shalini Devi', 'shalini', 'accountant', 1], ['Hairul Nizam', 'hairul', 'fleet', 1], ['Jason Teo', 'jason', 'readonly', 1], ['Azri Kassim', 'azri', 'weekend', 0]], agents: [['Nadia Iskandar', 'nadia'], ['Kok Wai Leong', 'kokwai'], ['Arun Pillai', 'arun'], ['Velu Muthu'], ['Lim Ah Seng']] },
  mine: { logins: [['You', 'you', 'owner', 1], ['Aina Rashid', 'aina', 'front', 1], ['Ken Lau', 'ken', 'fleet', 1]], agents: [['Aina Rashid', 'aina'], ['Ken Lau', 'ken'], ['Sam Wong']] }
};
var CITY_POS = { kilat: [3.1073, 101.6067], padi: [4.5975, 101.0901], bara: [1.4927, 103.7414], mine: [3.1390, 101.6869] };

/* a made-up handwritten signature as an SVG data address */
function scribble(seed, color) {
  var R = rng(seed), d = 'M10 ' + (40 + R() * 10);
  for (var k = 0; k < 9; k++) d += ' Q' + (20 + k * 22 + R() * 10) + ' ' + (10 + R() * 50) + ' ' + (30 + k * 22) + ' ' + (25 + R() * 30);
  d += ' M30 58 L' + (150 + R() * 40) + ' ' + (50 + R() * 8);
  return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 70"><path d="' + d + '" fill="none" stroke="' + (color || '#1b2a6b') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');
}

function extendData(B, d, seed) {
  var R = rng(seed), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var at = function (daysAgo, h, m) { var x = new Date(TODAY.getTime() - daysAgo * DAY); x.setHours(h == null ? ri(8, 20) : h, m == null ? pick([0, 5, 10, 15, 20, 30, 40, 45, 50]) : m, 0, 0); return x; };
  var hex = function (n) { var s = ''; for (var k = 0; k < n; k++) s += '0123456789abcdef'[Math.floor(R() * 16)]; return s; };
  var phone = function () { return '+60 00-' + ri(100, 999) + ' ' + ri(1000, 9999); };
  var team = TEAMS[B.id] || TEAMS.mine, Y = 2026, seq = {};
  var nextNo = function (k, start) { seq[k] = (seq[k] || start || 0) + 1; return seq[k]; };

  /* ---------- company details (printed on invoices, receipts, statements) ---------- */
  d.company = {
    legal: B.legal, trading: B.name, reg: B.reg, phone: B.phone, address: B.address, email: B.email, website: B.slug + '.orbiquefms.site', logo: null,
    bank: { bank: B.id === 'padi' ? '' : 'Bank Contoh Berhad', accNo: B.id === 'padi' ? '' : '0000 ' + ri(1000, 9999) + ' ' + ri(1000, 9999) + ' (sample)', accName: B.legal, note: 'Please use the booking ID as the payment reference.' },
    numbering: { invPrefix: 'INV-', rcpPrefix: 'RCP-', digits: 5, resetYearly: true },
    tax: { on: B.id === 'bara', name: 'SST', rate: 8, regNo: B.id === 'bara' ? 'W10-0000-00000000 (sample)' : '' },
    footers: { invoice: 'Thank you for renting with ' + B.name + '.', receipt: 'This receipt confirms the payment above.' }, countryCode: '+60'
  };

  /* ---------- team: logins, field agents, roles ---------- */
  d.roles = ROLE_TEMPLATES.map(function (r) { return { id: 'role-' + r[0], key: r[0], name: r[1], desc: r[2], builtIn: true, codes: roleCodes(r[0]) }; });
  d.roles.push({ id: 'role-weekend', key: 'weekend', name: 'Weekend driver', desc: 'Sees the tasks, the calendar and the cars, and does handover photos at weekends.', builtIn: false, codes: roleCodes('weekend') });
  d.users = team.logins.map(function (l, k) {
    var nm = l[0] === 'You' ? B.owner : l[0];
    return { id: 'usr-' + (k + 1), name: nm, username: l[1], email: l[1] + '@' + B.slug + '.example', role: 'role-' + l[2], extra: k === 2 ? ['bookings.delete'] : [], removed: k === 2 ? ['deposits.send'] : [], active: !!l[3], superAdmin: k === 0, agent: null,
      lastSignIn: k === 0 ? new Date(TODAY.getTime() - 4 * 6e4) : l[3] ? at(ri(0, 6)) : null, created: at(200 + k * 20) };
  });
  d.employees = team.agents.map(function (a, k) {
    var u = a[1] ? d.users.filter(function (x) { return x.username === a[1]; })[0] : null;
    var e = { id: 'emp-' + (k + 1), name: u ? u.name : a[0], wa: phone(), email: (u ? u.username : a[0].split(' ')[0].toLowerCase()) + '.field@' + B.slug + '.example', blood: pick(LISTS.bloodGroups),
      emergency: { name: pick(['Siti', 'Lim', 'Raj', 'Aminah', 'Wong', 'Devi']) + ' ' + pick(['Hassan', 'Mei', 'Kumar', 'Yusof', 'Tan']), rel: pick(['Spouse', 'Mother', 'Sibling', 'Father']), phone: phone() },
      docs: { idCard: k % 3 === 2 ? null : { name: 'id-card-' + (k + 1) + '.jpg', size: ri(90, 400) * 1024 }, poa: k % 2 ? null : { name: 'proof-of-address-' + (k + 1) + '.pdf', size: ri(80, 300) * 1024 } },
      active: k !== team.agents.length - 1 || B.id !== 'kilat', login: u ? u.id : null };
    if (u) u.agent = e.id;
    return e;
  });
  var staffNames = d.users.filter(function (u) { return u.active; }).map(function (u) { return u.name; });
  var byFirst = function (first) { var e = d.employees.filter(function (x) { return x.name.split(' ')[0] === first; })[0]; return e || d.employees[0]; };

  /* ---------- cars: extra fields ---------- */
  d.cars.forEach(function (c, k) {
    c.id = 'car-' + (k + 1); c.serial = k + 1;
    c.fleet = k === d.cars.length - 1 && B.id === 'bara' ? 'Sold' : k === 1 && B.id === 'padi' ? 'Not in use' : 'Active';
    c.inWorkshop = c.status === 'workshop';
    c.hourly = Math.round(c.rate / 6); c.deposit = c.key === 'alphard' ? 1000 : (c.type === 'SUV' || c.type === 'MPV') ? B.deposit + 100 : B.deposit;
    c.vin = c.chassis; c.spec = (c.type === 'Sedan' ? 'SALOON' : c.type === 'MPV' ? 'MPV' : c.type.toUpperCase()) + ' / ' + c.fuel.toUpperCase();
    c.boughtOn = new Date(c.year, ri(0, 11), ri(1, 28)); c.boughtFor = Math.round((MODELS[c.key].rate * 420 + ri(-8, 8) * 1000) / 100) * 100;
    c.owner = { name: k % 3 === 0 ? B.owner : pick(['Rosli Bakar', 'Chan Wai Ming', 'Mohan Das', 'Zaleha Ismail']), mobile: phone(), ic: String(ri(600101, 891228)) + String(ri(10, 14)) + String(ri(1000, 9999)) };
    c.instalment = k % 4 === 3 ? null : { day: [5, 12, 18, 28, 1, 25][k % 6], amount: Math.round(MODELS[c.key].rate * (5 + R() * 3) / 10) * 10 };
    c.tracker = k === d.cars.length - 1 ? null : { platform: 'Tracksolid Pro', imei: '86' + String(ri(1000000, 9999999)) + String(ri(100000, 999999)), sim: '011-' + ri(1000, 9999) + ' ' + ri(1000, 9999) };
    c.dashcam = k % 2 ? { platform: 'Dashcam app', imei: '35' + String(ri(1000000, 9999999)) + String(ri(100000, 999999)), sim: '011-' + ri(1000, 9999) + ' ' + ri(1000, 9999) } : null;
    c.odoAt = at(ri(0, 12));
    var file = function (nm) { return { name: nm, size: ri(120, 900) * 1024, added: at(ri(10, 200)) }; };
    c.papers = { roadtax: file('road-tax-' + c.plate.replace(/ /g, '') + '.pdf'), insurance: k % 5 === 4 ? null : file('insurance-' + c.plate.replace(/ /g, '') + '.pdf'), grant: k % 3 === 1 ? null : file('grant-' + c.plate.replace(/ /g, '') + '.jpg') };
    c.ownerDocs = { ic: file('owner-ic.jpg'), licence: k % 2 ? null : file('owner-licence.jpg'), agreement: k % 3 ? file('owner-agreement.pdf') : null };
    c.gallery = [1, 2, 3].slice(0, 1 + (k % 3)).map(function (n) { return { id: 'img-' + (k + 1) + '-' + n, order: n, name: c.plate.replace(/ /g, '') + '-' + n + '.jpg', angle: ['side', 'front', 'back'][n - 1] }; });
  });

  /* ---------- customers: extra fields ---------- */
  var streets = ['Jalan Contoh', 'Jalan Sampel', 'Lorong Ujian', 'Jalan Demo', 'Persiaran Rekaan'];
  d.people.forEach(function (p, k) {
    p.id = 'cus-' + (k + 1);
    p.address = 'No. ' + ri(1, 88) + ', ' + pick(streets) + ' ' + ri(1, 12) + '/' + ri(1, 9) + ', ' + ri(40, 81) + '000 ' + pick([B.city, 'Shah Alam', 'Kajang', 'Seremban', 'Melaka']);
    p.licenceNo = p.nat === 'Malaysian' ? p.ic.replace(/-/g, '').slice(0, 8) + String(ri(1000, 9999)) : 'DL' + ri(100000, 999999);
    p.licenceExp = new Date(2026 + ri(0, 4), ri(0, 11), ri(1, 28)); if (k === 8) p.licenceExp = new Date(2026, 9, 2);
    p.emergency = { name: pick(['Aminah', 'Lim', 'Raj', 'Siti', 'Wong', 'Devi', 'Ahmad']) + ' ' + pick(['Hassan', 'Mei Fong', 'Kumar', 'Yusof', 'Tan', 'Abdullah']), phone: phone(), rel: pick(LISTS.relationships) };
    p.docs = { icFront: { name: 'ic-front.jpg', size: ri(200, 800) * 1024 }, icBack: k % 4 === 1 ? null : { name: 'ic-back.jpg', size: ri(200, 800) * 1024 }, dl: { name: 'licence.jpg', size: ri(200, 800) * 1024 }, poa: k % 3 ? null : { name: 'utility-bill.pdf', size: ri(100, 400) * 1024 }, other: null };
    p.blacklist = p.flag === 'Blacklisted' ? { since: new Date(2026, ri(2, 8), ri(1, 28)), reason: pick(['Returned the car two days late and stopped answering.', 'Car came back with damage that was hidden from us.', 'Paid with a slip that turned out to be fake.']) } : null;
    p.notes = [];
    var note = function (flag, text, pinned, daysAgo) { p.notes.push({ id: 'note-' + (k + 1) + '-' + (p.notes.length + 1), flag: flag, text: text, pinned: !!pinned, by: pick(staffNames), at: at(daysAgo) }); };
    if (p.flag === 'VIP') { note('VIP', 'Corporate client. Always give a freshly washed car and call before delivery.', 1, 60); note('Info', 'Prefers WhatsApp, not calls.', 0, 20); }
    if (p.flag === 'Be careful') note('Be careful', 'Returned the car late twice. Ask for the full deposit and check the fuel.', 1, 35);
    if (p.flag === 'Blacklisted') note('Be careful', 'Do not rent again. See the blacklist reason.', 1, 50);
    if (k === 6 || k === 15) note('Info', 'Needs a child seat for every booking.', 0, 12);
    p.icCheck = k % 3 === 0 ? { at: at(ri(1, 40)), by: pick(staffNames), valid: p.nat === 'Malaysian', results: [['IC check site A', p.flag === 'Blacklisted' ? 'Flagged' : 'Clear'], ['IC check site B', k % 2 ? 'Could not check' : 'Clear']] } : null;
  });

  /* ---------- damage packages and signatures ---------- */
  d.damagePackages = [{ id: 'dp-1', name: 'Basic cover', daily: 15, max: 3000 }, { id: 'dp-2', name: 'Full cover', daily: 45, max: 8000 }, { id: 'dp-3', name: 'Premium cover', daily: 65, max: 15000 }];
  d.signatures = [{ id: 'sig-1', name: B.owner + ' (Director)', img: scribble(seed + 1) }, { id: 'sig-2', name: d.users[1] ? d.users[1].name + ' (Manager)' : 'Manager', img: scribble(seed + 2, '#202020') }];

  /* ---------- bookings: extra fields ---------- */
  d.bookings.forEach(function (x, k) {
    x.id = x.code; x.formId = B.id.slice(0, 3) + '-' + hex(8); x.agentToken = 'agt-' + hex(8);
    x.hourly = x.car.hourly; x.rate = x.car.rate; x.others = k % 17 === 4 ? 30 : 0; if (x.others) { x.payable += x.others; if (x.received) x.received += x.others; }
    x.pkg = x.dmg ? 'dp-1' : null;
    x.method = pick(['Online Transfer', 'Online Transfer', 'Online Transfer', 'Cash', 'Card']);
    x.startOpt = x.deliv ? (R() < .25 ? 'Delivery to KLIA' : 'Delivery to client location') : 'Pick-up from our location';
    x.endOpt = x.ret ? (x.startOpt === 'Delivery to KLIA' ? 'Return from KLIA' : 'Return from client location') : 'Drop-off at our location';
    x.delNote = x.deliv ? pick(['Hotel lobby, call on arrival', 'Condo guard house, block B', 'Arrival hall door 3']) : '';
    x.retNote = x.ret ? pick(['Same place as delivery', 'Office car park, level 2']) : '';
    x.signature = x.status === 'Pending' ? null : 'sig-1';
    x.filledByAdmin = k % 9 === 0; x.submitted = ['Pending', 'Confirmed', 'Agreement Sent'].indexOf(x.status) < 0;
    x.submittedAt = x.submitted ? new Date(x.created.getTime() + ri(2, 30) * 36e5) : null;
    x.ip = x.submitted ? '10.' + ri(0, 255) + '.' + ri(0, 255) + '.' + ri(1, 254) : '';
    x.updated = new Date(Math.max(x.created.getTime(), Math.min(TODAY.getTime() - ri(4, 900) * 6e4, x.created.getTime() + ri(1, 9) * DAY)));
    x.agentIds = x.agent ? [byFirst(x.agent).id] : [];
  });

  /* ---------- payments, receipts, invoices ---------- */
  d.payments = []; d.invoices = []; d.receipts = [];
  var payNo = 0;
  var addPay = function (x, kind, amount, when) {
    if (amount <= 0) return null;
    var method = x.method, staff = pick(staffNames);
    if (kind === 'Security deposit' && R() < .3) method = 'Online Transfer';
    var p = { id: 'pay-' + (++payNo), booking: x.code, kind: kind, amount: amount, method: method, at: when > TODAY ? new Date(TODAY.getTime() - ri(1, 30) * 36e5) : when, by: staff,
      depositedTo: method === 'Card' ? 'Stripe' : method === 'Online Transfer' ? 'Bank' : 'Cash to ' + staff, heldBy: method === 'Cash' ? staff : null,
      afterCharge: method === 'Card' ? Math.round((amount * .96 - 1) * 100) / 100 : null, ref: method === 'Online Transfer' ? 'FT' + ri(10000000, 99999999) + ri(1000, 9999) : method === 'Card' ? 'ch_' + hex(10) : '',
      note: '', receipt: null, void: null, banked: null, slips: method === 'Online Transfer' && R() < .7 ? [{ name: 'slip-' + x.code + '-' + payNo + '.jpg', size: ri(80, 600) * 1024, at: when }] : [] };
    if (method === 'Cash' && (TODAY - p.at) > 5 * DAY && R() < .8) p.banked = { at: new Date(p.at.getTime() + ri(1, 4) * DAY), by: d.users[0].name };
    d.payments.push(p);
    return p;
  };
  d.bookings.forEach(function (x, k) {
    if (x.received <= 0) return;
    var depPaid = Math.min(x.dep, x.received), rest = x.received - depPaid, t0 = new Date(x.created.getTime() + ri(2, 30) * 36e5);
    addPay(x, 'Security deposit', depPaid, t0);
    if (rest > 0) {
      if (x.pay === 'Extension paid' || (x.pay === 'Extension due' && rest > x.car.rate)) { var ext = x.pay === 'Extension paid' ? x.car.rate : 0; addPay(x, 'Rental payment', rest - ext, new Date(x.start.getTime() - ri(1, 20) * 36e5)); if (ext) addPay(x, 'Extension payment', ext, new Date(x.start.getTime() + DAY)); }
      else if (x.deliv && rest > x.deliv && k % 3 === 0) { addPay(x, 'Rental payment', rest - x.deliv, new Date(x.start.getTime() - ri(1, 20) * 36e5)); addPay(x, 'Delivery charge', x.deliv, new Date(x.start.getTime() - 36e5)); }
      else addPay(x, 'Rental payment', rest, new Date(x.start.getTime() - ri(1, 20) * 36e5));
    }
  });
  d.payments.sort(function (a, b) { return a.at - b.at; });
  var rcp = 0, inv = 0, pad = function (n) { return String(n).padStart(5, '0'); };
  d.payments.forEach(function (p, k) {
    if (k % 11 === 7 && p.at < new Date(TODAY.getTime() - 3 * DAY)) return;  /* some payments have no receipt yet */
    var r = { no: 'RCP-' + Y + '-' + pad(++rcp), id: null, payment: p.id, booking: p.booking, issued: new Date(p.at.getTime() + 6e5), amount: p.amount, kind: p.kind, method: p.method, status: 'Issued', voidReason: '', sent: [] };
    r.id = r.no;
    if (k % 3 === 0) r.sent.push({ channel: k % 2 ? 'WhatsApp' : 'Download', to: '', at: new Date(r.issued.getTime() + 36e5), by: p.by, ok: true });
    p.receipt = r.no; d.receipts.push(r);
  });
  d.bookings.forEach(function (x, k) {
    if (['Pending', 'Cancelled'].indexOf(x.status) >= 0 || x.created > TODAY || k % 10 === 3) return;
    var lines = [{ desc: 'Car rental: ' + plural(x.days, 'day') + ' x RM ' + x.rate.toFixed(2), qty: x.days, unit: x.rate, amount: x.rent }];
    if (x.dmg) lines.push({ desc: 'Damage cover: Basic cover (' + x.days + ' days x RM 15.00)', qty: x.days, unit: 15, amount: x.dmg });
    if (x.deliv) lines.push({ desc: 'Delivery charge', qty: 1, unit: x.deliv, amount: x.deliv });
    if (x.ret) lines.push({ desc: 'Return charge', qty: 1, unit: x.ret, amount: x.ret });
    if (x.others) lines.push({ desc: 'Other charges', qty: 1, unit: x.others, amount: x.others });
    if (x.disc) lines.push({ desc: 'Discount', qty: 1, unit: -x.disc, amount: -x.disc });
    var charges = sum(lines.map(function (l) { return l.amount; }));
    var iv = { no: 'INV-' + Y + '-' + pad(++inv), id: null, booking: x.code, issued: new Date(Math.min(TODAY.getTime(), x.created.getTime() + ri(1, 20) * 36e5)), lines: lines, charges: charges, deposit: x.dep, tax: 0, note: '', status: 'Issued', voidReason: '', sent: [] };
    iv.id = iv.no;
    if (k % 7 === 2) iv.sent.push({ channel: 'WhatsApp', to: x.cust.phone, at: new Date(iv.issued.getTime() + 2 * 36e5), by: pick(staffNames), ok: k % 14 !== 2, error: k % 14 === 2 ? 'The number is not on WhatsApp.' : '' });
    else if (k % 7 === 5) iv.sent.push({ channel: 'Email', to: x.cust.email, at: new Date(iv.issued.getTime() + 36e5), by: pick(staffNames), ok: true });
    d.invoices.push(iv);
  });
  /* a voided invoice and a voided payment */
  if (d.invoices.length > 4) { var vi = d.invoices[2]; vi.status = 'Void'; vi.voidReason = 'Wrong customer name on the invoice'; vi.voidAt = new Date(vi.issued.getTime() + 36e5); vi.voidBy = d.users[0].name; }
  var vp = d.payments.filter(function (p) { return p.kind === 'Rental payment'; })[3];
  if (vp) { vp.void = { at: new Date(vp.at.getTime() + 2 * 36e5), by: d.users[0].name, reason: 'Recorded twice by mistake' }; d.receipts.forEach(function (r) { if (r.payment === vp.id) { r.status = 'Void'; r.voidReason = 'The payment was voided'; } }); }

  /* ---------- deposits waiting or returned ---------- */
  d.deposits = d.bookings.filter(function (x) { return x.pay === 'Refund Pending' || (x.pay === 'Deposit Refunded' && x.status !== 'Cancelled' && TODAY - x.end < 90 * DAY && x.dep > 0); }).map(function (x, k) {
    var ded = [];
    if (k % 4 === 1) ded.push({ kind: 'Fuel', amount: 25, note: 'Fuel gauge one bar lower than at pick-up' });
    if (k % 6 === 2) ded.push({ kind: 'Cleaning', amount: 40, note: 'Sand and food stains on the back seat' });
    if (k % 9 === 4) ded.push({ kind: 'Late return fee', amount: B.fines.late * 2, note: 'Returned two hours late' });
    if (k % 13 === 6) ded.push({ kind: 'Damage', amount: 150, note: 'Scratch on the rear bumper' });
    var kept = sum(ded.map(function (z) { return z.amount; })), done = x.pay === 'Deposit Refunded';
    var how = pick(['Bank transfer', 'Bank transfer', 'Cash', 'Stripe']);
    return { id: 'dep-' + x.code, booking: x.code, deductions: ded, message: '', saved: true,
      refund: done && k % 8 !== 5 ? { method: how, amount: Math.max(0, x.dep - kept), by: pick(staffNames), at: new Date(x.end.getTime() + ri(4, 30) * 36e5), ref: how === 'Bank transfer' ? 'FT' + ri(10000000, 99999999) + ri(1000, 9999) : '', slip: how === 'Bank transfer' ? { name: 'refund-slip-' + x.code + '.jpg', size: ri(60, 300) * 1024 } : null, toBank: how === 'Bank transfer' ? pick(['Bank Contoh', 'Bank Sampel', 'Bank Demo']) : '', toAcct: how === 'Bank transfer' ? String(ri(1000, 9999)) : '' } : null,
      markedByHand: done && k % 8 === 5, statementSent: k % 3 === 0 ? { at: new Date(x.end.getTime() + 2 * DAY), by: pick(staffNames) } : null };
  });

  /* ---------- inspections ---------- */
  d.inspections = d.bookings.filter(function (x) { return x.inspected; }).map(function (x, k) {
    var c0 = new Date(x.start.getTime() + ri(5, 14) * 6e4);
    return { id: 'ins-' + hex(8), booking: x.code, gps: (CITY_POS[B.id][0] + (R() - .5) / 20).toFixed(5) + ', ' + (CITY_POS[B.id][1] + (R() - .5) / 20).toFixed(5),
      agentAt: new Date(x.start.getTime() + ri(1, 4) * 6e4), custAt: k % 7 === 3 ? null : c0,
      photos: k % 7 === 3 ? [] : [1, 2, 3, 4, 5].slice(0, ri(2, 5)).map(function (n) { return { name: 'photo-' + n + '.jpg', at: new Date(c0.getTime() - (6 - n) * 3e4), note: n === 2 ? pick(['Small scratch on the left door', 'Chip on the windscreen', 'Kerb mark on the front rim']) : '' }; }),
      agent: { handover: 'handover.jpg', idCard: 'customer-id.jpg', licence: 'driving-licence.jpg', odometer: 'odometer.jpg' }, note: k % 4 === 0 ? 'Customer checked the car with me. Fuel full.' : '' };
  });

  /* ---------- summons ---------- */
  var held = function (car, when) { return d.bookings.filter(function (x) { return x.car === car && x.status !== 'Cancelled' && x.start <= when && x.end >= when; }); };
  var offences = ['Exceeding the speed limit', 'Beating a red light', 'Parking in a no-parking zone', 'Using the emergency lane', 'Not wearing a seat belt', 'Double parking'];
  var places = ['Jalan Contoh 3, KM 12', 'Lebuhraya Sampel, KM 41.2', 'Persiaran Demo, near the mall', 'Jalan Ujian 7'];
  d.summons = [];
  var addSum = function (o) {
    var car = o.car, when = o.at, found = car ? held(car, when) : [];
    var s = { id: 'sum-' + (d.summons.length + 1), authority: o.auth || 'PDRM', council: o.auth === 'Other' ? 'Council (sample)' : '', notice: o.notice === null ? '' : (o.auth === 'JPJ' ? 'JPJ' : 'PD') + '-' + ri(1000, 9999) + '-' + ri(10000, 99999),
      plate: o.plate || (car ? car.plate : ''), car: car ? car.id : null, at: when, offence: o.offence || pick(offences), speed: 0, limit: 0, place: pick(places), fine: o.fine || pick([150, 200, 300]), fee: 20, asked: 0,
      booking: found.length === 1 ? found[0].code : o.booking || null, candidates: found.length > 1 ? found.map(function (x) { return x.code; }) : [], chosenByHand: false, fromPicture: !!o.pic, reviewed: !o.review, picture: o.pic ? { name: 'summons-' + (d.summons.length + 1) + '.jpg' } : null,
      status: '', paidOn: null, receipt: null, reason: '', addedAt: at(ri(1, 20)), addedBy: pick(staffNames), chargedAt: null };
    if (/speed/.test(s.offence)) { s.limit = pick([80, 90, 110]); s.speed = s.limit + ri(15, 40); }
    s.status = !s.reviewed ? 'Check, then charge' : !s.booking ? 'Needs a booking' : o.status || 'Ready to charge';
    if (s.status === 'Charged' || s.status === 'Paid') { s.asked = s.fine + s.fee; s.chargedAt = new Date(when.getTime() + 6 * DAY); }
    if (s.status === 'Paid') { s.paidOn = new Date(when.getTime() + 9 * DAY); }
    if (s.status === 'Waived') s.reason = 'Our own driver was moving the car.';
    if (s.status === 'Disputed') s.reason = 'The customer says the car was parked at the hotel at that time.';
    d.summons.push(s);
    return s;
  };
  var pastB = d.bookings.filter(function (x) { return x.status === 'Completed' || x.status === 'Car Returned'; });
  var mid = function (x) { return new Date(x.start.getTime() + (x.end - x.start) / 2); };
  [['Ready to charge'], ['Charged'], ['Paid'], ['Paid'], ['Waived'], ['Disputed'], ['Ready to charge']].forEach(function (st, k) { var x = pastB[(k * 5 + 2) % pastB.length]; if (x) addSum({ car: x.car, at: mid(x), status: st[0], auth: k === 3 ? 'JPJ' : k === 6 ? 'Other' : 'PDRM' }); });
  addSum({ car: null, plate: d.cars[0].plate.replace(/\d$/, function (m) { return String((+m + 3) % 10); }), at: at(12, 22, 40), offence: 'Exceeding the speed limit' });   /* plate not in fleet */
  var gapCar = d.cars[2]; addSum({ car: gapCar, at: new Date(TODAY.getTime() - 40 * DAY - 9 * 36e5) });  /* nobody had the car */
  var pastX = pastB[7]; if (pastX) addSum({ car: pastX.car, at: mid(pastX), pic: true, review: true });  /* read from a picture, needs review */
  if (pastB[3]) addSum({ car: pastB[3].car, at: new Date(pastB[3].start.getTime() + 36e5), pic: true });
  d.summons.forEach(function (s) { if (s.status === 'Paid') { var r = d.receipts[d.receipts.length - 1]; s.receipt = r ? r.no : null; } });

  /* ---------- maintenance: vendors, jobs, papers, workshop time, reminders, odometer ---------- */
  d.vendors = [
    { id: 'ven-1', name: 'Bengkel Contoh Auto', kind: 'Workshop', phone: phone(), wa: '', email: 'service@bengkelcontoh.example', address: 'Lot 3, Jalan Bengkel 2, ' + B.city, notes: 'Open 9 am to 6 pm, closed Sunday. Ask for Ah Kow.', active: true },
    { id: 'ven-2', name: 'Tayar Sampel Centre', kind: 'Tyre shop', phone: phone(), wa: phone(), email: '', address: 'No. 9, Jalan Tayar, ' + B.city, notes: '', active: true },
    { id: 'ven-3', name: 'Sejuk Aircond Specialist', kind: 'Aircond specialist', phone: phone(), wa: '', email: '', address: B.city, notes: 'Bring the car before 10 am.', active: true },
    { id: 'ven-4', name: 'Kilau Body and Paint', kind: 'Body shop', phone: phone(), wa: phone(), email: 'kilau@body.example', address: B.city, notes: '', active: true },
    { id: 'ven-5', name: 'Pusat Servis Demo (authorised)', kind: 'Dealer / service centre', phone: phone(), wa: '', email: 'bookings@servisdemo.example', address: B.city, notes: 'Warranty services only.', active: true },
    { id: 'ven-6', name: 'Old Workshop Rekaan', kind: 'Workshop', phone: phone(), wa: '', email: '', address: B.city, notes: 'Closed down in 2025.', active: false }
  ];
  d.jobs = [];
  var jobNo = 0, addJob = function (car, type, status, date, o) {
    o = o || {};
    var parts = type === 'Car wash and polish' ? 0 : ri(4, 40) * 10, labour = ri(3, 15) * 10;
    if (type === 'Accident repair') { parts = ri(80, 200) * 10; labour = ri(30, 80) * 10; }
    var j = { id: 'job-' + (++jobNo), car: car.id, type: type, title: type, status: status, date: date, plannedFor: status === 'Planned' ? date : null,
      vendor: type === 'Tyres' ? 'ven-2' : type === 'Aircond service' ? 'ven-3' : type === 'Accident repair' ? 'ven-4' : pick(['ven-1', 'ven-1', 'ven-5']), odo: Math.max(1000, car.odo - Math.round((TODAY - date) / DAY) * 90),
      lines: (parts ? [{ what: type === 'Tyres' ? 'Tyre 185/55 R15' : type === 'Battery' ? 'Battery NS40' : 'Parts', type: 'Part', qty: type === 'Tyres' ? 2 : 1, price: type === 'Tyres' ? parts / 2 : parts, partNo: 'P-' + ri(1000, 9999) }] : []).concat([{ what: 'Labour', type: 'Labour', qty: 1, price: labour, partNo: '' }]),
      tax: 0, invoiceNo: status === 'Done' ? 'WS-' + ri(10000, 99999) : '', paid: status === 'Done' && R() < .85, paidOn: null, warranty: type === 'Battery' || type === 'Tyres' ? new Date(date.getTime() + 365 * DAY) : null,
      booking: o.booking || null, charge: o.charge || 0, note: o.note || '', files: status === 'Done' ? [{ name: 'workshop-invoice-' + jobNo + '.pdf', size: ri(60, 300) * 1024 }] : [], by: pick(staffNames), at: date,
      inAt: status === 'In the workshop' ? date : null, backAt: o.backAt || null, block: !!o.block, doneAt: status === 'Done' ? date : null };
    j.total = sum(j.lines.map(function (l) { return l.qty * l.price; })) + j.tax;
    if (j.paid) j.paidOn = new Date(date.getTime() + ri(0, 5) * DAY);
    d.jobs.push(j); return j;
  };
  d.cars.forEach(function (c, k) {
    for (var mth = 11; mth >= 0; mth--) { if (R() < .32) addJob(c, pick(['Engine oil and filter', 'General service', 'Car wash and polish', 'Tyres', 'Brakes', 'Battery', 'Aircond service', 'Alignment and balancing', 'Wipers']), 'Done', at(mth * 30 + ri(0, 25))); }
  });
  var wcar = d.cars.filter(function (c) { return c.inWorkshop; })[0] || d.cars[0];
  var wj = addJob(wcar, 'General service', 'In the workshop', new Date(TODAY.getTime() - 3 * DAY), { backAt: new Date(TODAY.getTime() + 4 * DAY), block: true, note: 'Service and two new tyres.' });
  addJob(d.cars[1], 'Aircond service', 'Planned', new Date(TODAY.getTime() + 6 * DAY));
  addJob(d.cars[3], 'Engine oil and filter', 'Planned', new Date(TODAY.getTime() + 2 * DAY));
  var accB = pastB[9];
  if (accB) addJob(accB.car, 'Accident repair', 'Done', new Date(accB.end.getTime() + 2 * DAY), { booking: accB.code, charge: 450, note: 'Rear bumper dented by the renter in a car park.' });
  addJob(d.cars[4], 'Detailing', 'Cancelled', at(15));
  d.jobs.sort(function (a, b) { return b.date - a.date; });
  d.downtime = [{ id: 'dt-1', car: wcar.id, reason: 'Service', from: wj.date, to: wj.backAt, job: wj.id, note: 'Service and tyres', back: false },
    { id: 'dt-2', car: d.cars[1].id, reason: 'Inspection', from: new Date(TODAY.getTime() + 6 * DAY), to: new Date(TODAY.getTime() + 7 * DAY), job: null, note: 'PUSPAKOM inspection', back: false },
    { id: 'dt-3', car: d.cars[0].id, reason: 'Repair', from: at(28, 9, 0), to: at(26, 17, 0), job: null, note: 'Window motor', back: true },
    { id: 'dt-4', car: (accB ? accB.car : d.cars[2]).id, reason: 'Accident', from: accB ? new Date(accB.end.getTime() + 2 * DAY) : at(40), to: accB ? new Date(accB.end.getTime() + 6 * DAY) : at(36), job: null, note: 'Body shop', back: true }];
  d.papers = [];
  var addPaper = function (c, kind, until, o) { o = o || {}; d.papers.push({ id: 'pap-' + (d.papers.length + 1), car: c.id, kind: kind, name: kind, until: until, issued: until ? new Date(until.getTime() - 365 * DAY) : null, provider: o.provider || '', cost: o.cost || 0, ref: o.ref || '', warnDays: 30, note: '', file: o.file === false ? null : { name: kind.toLowerCase().replace(/ /g, '-') + '-' + c.plate.replace(/ /g, '') + '.pdf', size: ri(80, 500) * 1024 } }); };
  d.cars.forEach(function (c, k) {
    addPaper(c, 'Road tax', c.tax, { provider: 'JPJ', cost: c.cc > 1500 ? 280 : 90, ref: 'RT-' + ri(100000, 999999) });
    addPaper(c, 'Insurance', c.insExp, { provider: c.insurer, cost: Math.round(c.boughtFor * .028), ref: 'POL-' + ri(1000000, 9999999) });
    if (k % 2 === 0) addPaper(c, 'PUSPAKOM', new Date(2027, ri(0, 11), ri(1, 28)), { provider: 'PUSPAKOM', cost: 30 });
    if (k % 3 !== 2) addPaper(c, 'Rental permit', new Date(TODAY.getTime() + ri(-10, 300) * DAY), { provider: 'APAD', cost: 50 });
    if (k % 3 !== 1) addPaper(c, 'Car grant', null, { provider: 'JPJ', file: true });
  });
  d.reminders = [];
  d.cars.forEach(function (c, k) {
    [['Engine oil and filter', 10000, 180], ['General service', 20000, 365], ['Tyres', 40000, 0], ['Aircond service', 0, 365]].forEach(function (r, j) {
      if (j === 3 && k % 2) return;
      var last = d.jobs.filter(function (x) { return x.car === c.id && x.type === r[0] && x.status === 'Done'; })[0];
      d.reminders.push({ id: 'rem-' + (d.reminders.length + 1), car: c.id, service: r[0], km: r[1], days: r[2], lastAt: last ? last.date : null, lastKm: last ? last.odo : null, on: !(k === 2 && j === 2), snoozedUntil: null });
    });
  });
  d.odometer = [];
  d.cars.forEach(function (c) { for (var q = 4; q >= 0; q--) d.odometer.push({ car: c.id, km: c.odo - q * ri(800, 2200), at: at(q * 18 + 1), by: pick(staffNames) }); });

  /* ---------- car instalments, May to November 2026 ---------- */
  d.instalments = [];
  d.cars.forEach(function (c) {
    if (!c.instalment) return;
    for (var mo = 4; mo <= 10; mo++) {
      var due = new Date(Y, mo, Math.min(c.instalment.day, 28)), paidIt = due < new Date(TODAY.getTime() - 20 * DAY) || (due < TODAY && R() < .55);
      var it = { id: 'inst-' + c.id + '-' + mo, car: c.id, month: Y + '-' + String(mo + 1).padStart(2, '0'), due: due, amount: c.instalment.amount, paid: null };
      if (paidIt) it.paid = { on: new Date(due.getTime() - ri(0, 3) * DAY), amount: c.instalment.amount + (R() < .1 ? 20 : 0), method: pick(['Bank transfer', 'Bank transfer', 'Card']), expense: null, by: d.users[0].name };
      d.instalments.push(it);
    }
  });

  /* ---------- expenses: categories and what the team recorded ---------- */
  d.expenseCats = EXPENSE_CATS.map(function (e, k) { return { id: 'cat-' + (k + 1), name: e[0], group: e[1], icon: e[2], alsoKept: !!e[3], hidden: e[0] === 'Bolt fare' && B.id === 'padi', order: k }; });
  var catId = function (name) { return d.expenseCats.filter(function (c) { return c.name === name; })[0].id; };
  d.expenses = [];
  var addExp = function (name, amount, day, o) {
    o = o || {};
    var by = o.by || pick(d.users.filter(function (u) { return u.active; }));
    d.expenses.push({ id: 'exp-' + (d.expenses.length + 1), day: day, amount: amount, cat: catId(name), car: o.car || null, booking: o.booking || null, method: o.method || pick(['Cash', 'Cash', 'Card', 'E-wallet', 'Bank transfer']), paidTo: o.paidTo || '', note: o.note || '',
      receipt: R() < .55 ? { name: 'receipt-' + (d.expenses.length + 1) + '.jpg', size: ri(30, 400) * 1024 } : null, by: by.id || by, at: new Date(day.getTime() + ri(1, 10) * 36e5), source: 'recorded', ref: null });
  };
  for (var ed = 0; ed < 80; ed++) {
    var day = new Date(TODAY.getTime() - ri(0, 75) * DAY); day.setHours(0, 0, 0, 0);
    var cname = pick(['Fuel', 'Fuel', 'Fuel', 'Toll', 'Toll', 'Parking', 'Grab fare', 'Car wash', 'Car wash', 'Delivery and pick-up costs', 'Cleaning supplies and small purchases', 'SIM and phone recharge', 'Staff meals and welfare', 'Office supplies']);
    var amt = { 'Fuel': ri(40, 120), 'Toll': ri(3, 25) + .5, 'Parking': ri(2, 12), 'Grab fare': ri(12, 45), 'Car wash': ri(15, 35), 'Delivery and pick-up costs': ri(20, 60) }[cname] || ri(10, 90);
    var cc = R() < .7 ? pick(d.cars) : null;
    addExp(cname, amt, day, { car: cc ? cc.id : null, paidTo: { 'Fuel': pick(['Petrol station Contoh', 'Stesen Minyak Sampel']), 'Toll': 'Toll plaza', 'Car wash': 'Cuci Kereta Demo' }[cname] || '', note: cname === 'Grab fare' ? 'Driver back to the office after a delivery' : '' });
  }
  [['Office rent', 2800, 1], ['Salary and allowances', 9600, 28], ['Internet', 159, 5], ['Electricity and water', 420, 9], ['Marketing and ads', 600, 14], ['Software and subscriptions', 199, 2], ['Accounting and legal fees', 350, 20], ['Bank and payment charges', 48.6, 30]].forEach(function (o) {
    [8, 9].forEach(function (mo) { var dd = new Date(Y, mo, o[2]); if (dd <= TODAY) addExp(o[0], o[1], dd, { method: 'Bank transfer', by: d.users[0], paidTo: o[0] === 'Office rent' ? 'Landlord (sample)' : '' }); });
  });
  d.instalments.forEach(function (it) {
    if (!it.paid) return;
    var car = d.cars.filter(function (c) { return c.id === it.car; })[0];
    addExp('Car loan / hire-purchase instalment', it.paid.amount, it.paid.on, { car: it.car, method: it.paid.method, by: d.users[0], note: 'Instalment for ' + car.plate + ' (' + it.month + ')' });
    it.paid.expense = d.expenses[d.expenses.length - 1].id;
  });
  d.expenses.sort(function (a, b) { return b.day - a.day || b.at - a.at; });

  /* ---------- tasks for field agents ---------- */
  d.tasks = [];
  var taskFor = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && Math.abs(x.start - TODAY) < 9 * DAY; }).slice(0, 14);
  taskFor.forEach(function (x, k) {
    var out = k % 2 === 0, when = out ? x.start : x.end, ag = [pick(d.employees.filter(function (e) { return e.active; }))];
    if (k % 5 === 0) ag.push(d.employees[(d.employees.indexOf(ag[0]) + 1) % d.employees.length]);
    var type = out ? (x.startOpt === 'Delivery to KLIA' ? 'Car delivery to KLIA' : x.deliv ? "Car delivery to client's location" : 'Car delivery from our location') : (x.endOpt === 'Return from KLIA' ? 'Car return from KLIA' : x.ret ? "Car return from client's location" : 'Car return to our location');
    var st = when < TODAY ? (k % 6 === 5 ? 'Cancelled' : 'Completed') : Math.abs(when - TODAY) < 4 * 36e5 ? 'In Progress' : 'Pending';
    var wa = {}; ag.forEach(function (e, j) { wa[e.id] = st === 'Completed' ? 'Details Sent' : st === 'Cancelled' ? 'Template Sent' : ['Template Sent', 'Reply Received', 'Details Sent', 'Not Sent', 'Failed'][(k + j) % 5]; });
    d.tasks.push({ id: 'task-' + (k + 1), name: (out ? 'Deliver ' : 'Collect ') + carModel(x.car) + ' ' + x.car.plate + (out ? ' to ' : ' from ') + x.cust.name.split(' ')[0], type: type, at: when, status: st, agents: ag.map(function (e) { return e.id; }), wa: wa,
      booking: x.code, note: out ? 'Bring the agreement copy and the toll card. ' + (x.delNote || '') : 'Check the fuel and take odometer photo. ' + (x.retNote || ''), voice: k % 4 === 1 ? [{ id: 'vn-' + k, len: ri(6, 40), at: at(1) }] : [], photos: k % 3 === 0 ? [{ name: 'task-photo-' + k + '.jpg' }] : [], created: new Date(when.getTime() - ri(1, 4) * DAY), by: pick(staffNames) });
    x.agentIds = ag.map(function (e) { return e.id; });
  });
  d.tasks.push({ id: 'task-' + (d.tasks.length + 1), name: 'Send ' + d.cars[1].plate + ' for PUSPAKOM inspection', type: 'General', at: new Date(TODAY.getTime() + 6 * DAY + 2 * 36e5), status: 'Pending', agents: [d.employees[2].id], wa: (function () { var o = {}; o[d.employees[2].id] = 'Not Sent'; return o; })(), booking: null, note: 'Bring the grant and the insurance.', voice: [], photos: [], created: at(1), by: staffNames[0] });

  /* ---------- website: reviews, FAQs, home settings ---------- */
  var rv = [['Aiman H.', 'The car was spotless and the hand-over took five minutes. Will rent again.', 5], ['Mei Ling T.', 'Easy booking form on my phone and the deposit came back the next day.', 5], ['Ravi K.', 'Good price for a week. The car smelled a bit of smoke but they sorted it.', 4], ['Emily C.', 'Delivered to my hotel on time, very friendly driver.', 5], ['Jonathan O.', 'Fair and clear about the rules and the deposit.', 4], ['Siti H.', 'Second time renting, same great service.', 5], ['Kenji T.', 'Airport delivery was smooth even with my late flight.', 5], ['Farah N.', 'The aircond was weak, otherwise fine.', 3]];
  d.reviews = rv.map(function (r, k) { return { id: 'rev-' + (k + 1), name: r[0], text: r[1], rating: r[2], date: at(10 + k * 17, 12, 0), order: k + 1, photo: null }; });
  var fq = [['What do I need to rent a car?', 'Your IC or passport and a valid driving licence. Foreign visitors need an international driving permit if their licence is not in English.'], ['How much is the deposit?', 'Usually RM ' + B.deposit + ', more for SUVs and MPVs. It is refunded within ' + B.refundHours + ' hours after the car is checked.'], ['Can you deliver the car?', 'Yes, to your home, hotel or the airport for a small charge.'], ['Can I extend my rental?', 'Yes. Ask us at least ' + B.extendHours + ' hours before the return time.'], ['What if I return the car late?', 'We charge RM ' + B.fines.late + ' for every started hour.'], ['Is insurance included?', 'The rent does not include insurance. You can add damage cover when you book.'], ['Can I drive to Singapore or Thailand?', 'No, our cars must stay in Malaysia.'], ['How do I pay?', 'Online transfer, card or cash at the office.']];
  d.faqs = fq.map(function (f, k) { return { id: 'faq-' + (k + 1), q: f[0], a: f[1], order: k + 1, active: k !== 6 }; });
  d.home = { hero: { name: 'hero-' + B.slug + '.jpg' }, formNumber: B.phone,
    logos: ['Perodua', 'Proton', 'Honda', 'Toyota'].map(function (n, k) { return { id: 'logo-' + (k + 1), name: n, img: null, order: k + 1 }; }),
    socials: [['WhatsApp', 'https://wa.me/600000000', true], ['Instagram', 'https://instagram.example/' + B.slug, true], ['Facebook', 'https://facebook.example/' + B.slug, true], ['TikTok', 'https://tiktok.example/@' + B.slug, false]].map(function (s, k) { return { id: 'soc-' + (k + 1), name: s[0], link: s[1], order: k + 1, active: s[2], logo: null }; }) };

  /* ---------- tracking ---------- */
  var pos = CITY_POS[B.id] || CITY_POS.mine;
  d.trackerAccounts = [{ id: 'trk-1', name: 'Tracksolid Pro', platform: 'Tracksolid Pro', api: '', appKey: 'saved', user: B.slug + '-fleet', status: 'Working', count: 0, lastRead: new Date(TODAY.getTime() - 4e4), every: true },
    { id: 'trk-2', name: 'Old account', platform: 'Tracksolid Pro', api: '', appKey: 'saved', user: B.slug + '-old', status: B.id === 'kilat' ? 'Problem' : 'Switched off', count: 0, lastRead: at(9), every: false, error: 'The app key was refused.' }];
  d.trackers = d.cars.filter(function (c) { return c.tracker; }).map(function (c, k) {
    var state = k === 2 ? 'Offline' : d.bookings.some(function (x) { return x.car === c && x.status === 'Car Delivered'; }) && k % 2 ? 'Moving' : 'Parked';
    return { id: 'dev-' + (k + 1), name: 'GT06-' + c.plate.replace(/ /g, ''), imei: c.tracker.imei, account: 'trk-1', car: c.id, state: state, speed: state === 'Moving' ? ri(30, 118) : 0, ign: state === 'Moving', at: state === 'Offline' ? at(3) : new Date(TODAY.getTime() - ri(1, 40) * 6e4), lat: pos[0] + (R() - .5) / 10, lng: pos[1] + (R() - .5) / 10 };
  });
  d.trackers.push({ id: 'dev-x', name: 'GT06-SPARE', imei: '86' + ri(1000000, 9999999) + ri(100000, 999999), account: 'trk-1', car: null, state: 'Parked', speed: 0, ign: false, at: at(1), lat: pos[0], lng: pos[1] });
  d.trackerAccounts[0].count = d.trackers.length;
  d.alarms = [];
  for (var al = 0; al < 9; al++) { var tcar = pick(d.trackers.filter(function (t) { return t.car; })); d.alarms.push({ id: 'alm-' + (al + 1), at: at(ri(0, 6)), car: tcar.car, type: pick(LISTS.alarmTypes), lat: tcar.lat + (R() - .5) / 30, lng: tcar.lng + (R() - .5) / 30 }); }
  d.alarms.sort(function (a, b) { return b.at - a.at; });

  /* ---------- settings ---------- */
  d.settings = {
    menu: DEFAULT_MENU.map(function (g) { return { label: g.label, items: g.items.slice() }; }),
    dashLayout: LISTS.dashSections.map(function (s) { return { id: s[0], on: true }; }),
    startPage: {},
    icSites: [{ id: 'ic-1', name: 'IC check site A (sample)', url: 'https://ic-check-a.example', searchBy: 'IC number only', saved: true, user: 'checks@' + B.slug + '.example', lastChecked: at(2), on: true, words: 'flagged, default, warning', wired: false },
      { id: 'ic-2', name: 'IC check site B (sample)', url: 'https://ic-check-b.example', searchBy: 'IC number or name', saved: false, user: '', lastChecked: null, on: false, words: '', wired: false }]
  };

  /* ---------- activity log and notifications ---------- */
  d.activity = [];
  var log = function (when, who, action, where, ref, text, changes) { d.activity.push({ id: 'act-' + (d.activity.length + 1), at: when, who: who, action: action, where: where, ref: ref, text: text, changes: changes || [], ip: '10.0.' + ri(0, 9) + '.' + ri(2, 250) }); };
  d.bookings.filter(function (x) { return x.created <= TODAY && TODAY - x.created < 12 * DAY; }).forEach(function (x) {
    var who = pick(staffNames);
    log(x.created, who, 'Created', 'Booking', x.code, who + ' created booking ' + x.code + ' (' + x.car.plate + ')');
    var who2 = pick(staffNames); if (x.status !== 'Pending' && x.updated <= TODAY) log(x.updated, who2, 'Changed', 'Booking', x.code, who2 + ' changed booking ' + x.code, [{ f: 'Status', from: 'Pending', to: x.status }]);
  });
  d.payments.filter(function (p) { return TODAY - p.at < 10 * DAY; }).forEach(function (p) { log(p.at, p.by, 'Created', 'Payment', p.id, p.by + ' recorded a payment of RM ' + p.amount.toFixed(2) + ' on ' + p.booking, [{ f: 'Type', from: '', to: p.kind }, { f: 'Method', from: '', to: p.method }]); });
  d.expenses.filter(function (e) { return TODAY - e.at < 6 * DAY; }).slice(0, 12).forEach(function (e) { var u = d.users.filter(function (x) { return x.id === e.by; })[0]; var c = d.expenseCats.filter(function (x) { return x.id === e.cat; })[0]; log(e.at, u ? u.name : staffNames[0], 'Created', 'Expense', e.id, (u ? u.name : staffNames[0]) + ' recorded expense ' + c.name + ': RM ' + e.amount.toFixed(2)); });
  d.users.forEach(function (u) { if (u.lastSignIn) log(u.lastSignIn, u.name, 'Signed in', 'Team member', u.id, u.name + ' signed in'); });
  log(at(1, 16, 5), staffNames[0], 'Exported', 'Booking', '', staffNames[0] + ' downloaded the bookings and income report');
  log(at(2, 11, 40), staffNames[0], 'Viewed a document', 'Car owner document', d.cars[0].id, staffNames[0] + ' opened the owner IC of ' + d.cars[0].plate);
  log(at(3, 10, 15), staffNames[0], 'Access change', 'Team member', d.users[2].id, staffNames[0] + ' gave ' + d.users[2].name + ' "Delete bookings"', [{ f: 'Delete bookings', from: 'Off', to: 'On' }]);
  log(at(4, 9, 0), staffNames[1] || staffNames[0], 'Failed sign-in', 'Team member', '', 'A sign-in with the username "admin" failed');
  log(at(0, 13, 50), staffNames[2] || staffNames[0], 'Sent', 'Invoice', d.invoices.length ? d.invoices[d.invoices.length - 1].no : '', (staffNames[2] || staffNames[0]) + ' sent invoice ' + (d.invoices.length ? d.invoices[d.invoices.length - 1].no : '') + ' on WhatsApp');
  d.summons.filter(function (s) { return s.status === 'Paid'; }).forEach(function (s) { log(s.paidOn > TODAY ? at(1) : s.paidOn, staffNames[0], 'Changed', 'Summons', s.id, staffNames[0] + ' changed summons ' + s.authority + ' ' + s.notice + ' (' + s.plate + ')', [{ f: 'Status', from: 'charged', to: 'paid' }]); });
  d.activity.sort(function (a, b) { return b.at - a.at; });
  var nb = d.bookings.filter(function (x) { return x.status === 'Agreement Signed'; }).slice(-1)[0], late = d.bookings.filter(function (x) { return x.status === 'Car Delivered' && x.end < TODAY; })[0];
  d.notifications = [
    nb && { icon: 'signature', tone: 'ok', title: 'Agreement signed', text: nb.cust.name + ' signed the agreement for ' + nb.code + '.', page: 'bookings', params: { booking: nb.code }, at: new Date(TODAY.getTime() - 25 * 6e4) },
    { icon: 'receipt', tone: 'info', title: 'Payment slip uploaded', text: 'A customer sent a payment slip on WhatsApp. Record it on Invoices.', page: 'invoices', params: { tab: 'payments' }, at: new Date(TODAY.getTime() - 70 * 6e4) },
    { icon: 'cash-banknote', tone: 'warn', title: 'Deposits waiting', text: d.deposits.filter(function (z) { return !z.refund && !z.markedByHand; }).length + ' deposits are waiting to be given back.', page: 'deposits', params: {}, at: new Date(TODAY.getTime() - 3 * 36e5) },
    { icon: 'license', tone: 'warn', title: 'Road tax expiring', text: d.cars[2].plate + ' road tax runs out on ' + dFull(d.cars[2].tax) + '.', page: 'maintenance', params: { tab: 'documents' }, at: new Date(TODAY.getTime() - 5 * 36e5) },
    { icon: 'gavel', tone: 'bad', title: 'Summons with no booking', text: 'Nobody had the car at the time of one summons.', page: 'summons', params: { view: 'no-booking' }, at: new Date(TODAY.getTime() - 26 * 36e5) },
    { icon: 'calendar-dollar', tone: 'bad', title: 'Instalment overdue', text: 'A car instalment is past its due date.', page: 'instalments', params: {}, at: new Date(TODAY.getTime() - 30 * 36e5) },
    { icon: 'brand-whatsapp', tone: 'info', title: 'Agent replied', text: 'A field agent replied on WhatsApp and got the task details.', page: 'tasks', params: {}, at: new Date(TODAY.getTime() - 2 * DAY) },
    late && { icon: 'alert-triangle', tone: 'bad', title: 'Car not back yet', text: late.car.plate + ' was due back ' + dFull(late.end) + '.', page: 'bookings', params: { booking: late.code }, at: new Date(TODAY.getTime() - 50 * 6e4) }
  ].filter(Boolean).map(function (n, k) { n.id = 'ntf-' + (k + 1); n.read = k > 3; return n; }).sort(function (a, b) { return b.at - a.at; });

  d.customers = d.people;   /* the same list under its plain name */
  return d;
}

/* ---------------- the default menu (reference sidebar, section 0) ---------------- */
var DEFAULT_MENU = [
  { label: 'Bookings', items: ['bookings', 'customers', 'signatures', 'damage-packages', 'reports', 'invoices', 'expenses', 'summons', 'deposits'] },
  { label: 'Operations', items: ['tasks', 'calendar'] },
  { label: 'Fleet Management', items: ['cars', 'availability', 'maintenance', 'schedules', 'instalments'] },
  { label: 'System Settings', items: ['faqs', 'reviews', 'home-settings'] },
  { label: 'Team & access', items: ['team', 'activity'] }
];

/* ---------------- look-ups and derived lists ---------------- */
function byId(list, id) { for (var k = 0; k < list.length; k++) if (list[k].id === id) return list[k]; return null; }
function carById(id, d) { return byId((d || D()).cars, id); }
function findBooking(code, d) { var l = (d || D()).bookings; for (var k = 0; k < l.length; k++) if (l[k].code === code) return l[k]; return null; }
function userById(id, d) { return byId((d || D()).users, id); }
function employeeById(id, d) { return byId((d || D()).employees, id); }
/* every expense in one list: recorded entries plus finished service jobs and papers with a cost */
function allExpenses(d) {
  d = d || D();
  var rows = d.expenses.slice();
  d.jobs.forEach(function (j) { if (j.status === 'Done' && j.total) rows.push({ id: 'x-' + j.id, day: j.doneAt || j.date, amount: j.total, cat: null, kind: j.type, car: j.car, booking: j.booking, method: j.paid ? 'Bank transfer' : '', paidTo: (byId(d.vendors, j.vendor) || {}).name || '', note: j.note, receipt: j.files[0] || null, by: null, at: j.at, source: 'job', ref: j.id }); });
  d.papers.forEach(function (p) { if (p.cost && p.issued && p.issued <= TODAY) rows.push({ id: 'x-' + p.id, day: p.issued, amount: p.cost, cat: null, kind: p.kind, car: p.car, booking: null, method: '', paidTo: p.provider, note: p.ref, receipt: p.file, by: null, at: p.issued, source: 'paper', ref: p.id }); });
  return rows.sort(function (a, b) { return b.day - a.day; });
}
/* handovers: one per booking start (delivery or pick-up) and end (return or drop-off) */
function handovers(d) {
  d = d || D();
  var out = [];
  d.bookings.forEach(function (x) {
    if (x.status === 'Cancelled') return;
    out.push({ id: 'ho-' + x.code + '-s', kind: 'Delivery', booking: x.code, at: x.start, label: x.startOpt === 'Pick-up from our location' ? 'Pick-up at our location - ' + x.pickup : x.startOpt, note: x.delNote, agents: x.agentIds || [] });
    out.push({ id: 'ho-' + x.code + '-e', kind: 'Return', booking: x.code, at: x.end, label: x.endOpt === 'Drop-off at our location' ? 'Drop-off at our location - ' + x.drop : x.endOpt, note: x.retNote, agents: x.agentIds || [] });
  });
  return out.sort(function (a, b) { return a.at - b.at; });
}

/* ===================================================================
   Event bus and changes. Every change goes through DB so every page and the
   activity log follow: DB.update(...) -> emit('data') -> the shell redraws the open page.
   =================================================================== */
var BUS = {};
function on(evt, fn) { (BUS[evt] = BUS[evt] || []).push(fn); return function () { off(evt, fn); }; }
function off(evt, fn) { BUS[evt] = (BUS[evt] || []).filter(function (f) { return f !== fn; }); }
function emit(evt, payload) { (BUS[evt] || []).slice().forEach(function (f) { try { f(payload); } catch (e) { console.warn(e); } }); }

var NOUNS = { people: 'customer', customers: 'customer', bookings: 'booking', payments: 'payment', invoices: 'invoice', receipts: 'receipt', cars: 'car', expenses: 'expense', expenseCats: 'expense category', summons: 'summons', deposits: 'deposit refund', instalments: 'instalment', users: 'team member', employees: 'employee', jobs: 'maintenance record', papers: 'car paper', reminders: 'service reminder', tasks: 'task', faqs: 'FAQ', reviews: 'review', damagePackages: 'damage package', signatures: 'signature', vendors: 'workshop', trackers: 'tracker', roles: 'role', downtime: 'downtime' };
function noun(coll) { return NOUNS[coll] || coll.replace(/s$/, ''); }
var DB = {
  /* who is doing it: the person signed in (see me() in core.js) */
  actor: function () { return typeof me === 'function' && me() ? me().name : B().owner; },
  list: function (coll) { return D()[coll]; },
  get: function (coll, id) { var l = D()[coll] || []; for (var k = 0; k < l.length; k++) if (l[k].id === id || l[k].code === id || l[k].no === id) return l[k]; return null; },
  add: function (coll, rec, o) {
    o = o || {};
    if (!rec.id) rec.id = coll.replace(/s$/, '') + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    var l = D()[coll]; if (o.first) l.unshift(rec); else l.push(rec);
    DB.log(o.action || 'Created', o.where || coll, rec.id, o.text || DB.actor() + ' created ' + (o.label || noun(coll)) + ' ' + (rec.code || rec.no || rec.name || rec.id), o.changes);
    emit('data', { coll: coll, op: 'add', rec: rec });
    return rec;
  },
  update: function (coll, recOrId, patch, o) {
    o = o || {};
    var rec = typeof recOrId === 'object' ? recOrId : DB.get(coll, recOrId); if (!rec) return null;
    var changes = [];
    Object.keys(patch).forEach(function (k) { var a = rec[k], b = patch[k]; if (a !== b && typeof b !== 'object') changes.push({ f: k, from: a == null ? '' : String(a), to: b == null ? '' : String(b) }); rec[k] = b; });
    if (!o.silent) DB.log(o.action || 'Changed', o.where || coll, rec.id, o.text || DB.actor() + ' changed ' + (o.label || noun(coll)) + ' ' + (rec.code || rec.no || rec.name || rec.id), o.changes || changes);
    emit('data', { coll: coll, op: 'update', rec: rec, changes: changes });
    return rec;
  },
  remove: function (coll, recOrId, o) {
    o = o || {};
    var l = D()[coll], rec = typeof recOrId === 'object' ? recOrId : DB.get(coll, recOrId), k = l.indexOf(rec); if (k < 0) return false;
    l.splice(k, 1);
    DB.log('Deleted', o.where || coll, rec.id, o.text || DB.actor() + ' deleted ' + (o.label || noun(coll)) + ' ' + (rec.code || rec.no || rec.name || rec.id));
    emit('data', { coll: coll, op: 'remove', rec: rec });
    return true;
  },
  /* write one line in the activity log (the ticker and the bell read it) */
  log: function (action, where, ref, text, changes) {
    var w = { bookings: 'Booking', payments: 'Payment', invoices: 'Invoice', receipts: 'Receipt', cars: 'Car', people: 'Customer', customers: 'Customer', expenses: 'Expense', summons: 'Summons', deposits: 'Deposit refund', instalments: 'Car instalment', users: 'Team member', employees: 'Team member', jobs: 'Maintenance record', papers: 'Maintenance record', tasks: 'Task' }[where] || where;
    var rec = { id: 'act-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), at: NOW(), who: DB.actor(), action: action, where: w, ref: ref || '', text: text, changes: changes || [], ip: '10.0.0.1', live: true };
    D().activity.unshift(rec);
    emit('activity', rec);
    return rec;
  },
  notify: function (n) { n.id = n.id || 'ntf-' + Date.now().toString(36); n.at = n.at || NOW(); n.read = false; D().notifications.unshift(n); emit('data', { coll: 'notifications', op: 'add', rec: n }); return n; },
  /* the money a booking still owes, from its non-void payments */
  received: function (code) { return sum(D().payments.filter(function (p) { return p.booking === code && !p.void; }).map(function (p) { return p.amount; })); }
};

/* extra initialisers a page file may add: DATA_INIT.push(function (d, brand) { ... }) runs for every company */
var DATA_INIT = [];
function buildAll(B, seed) { var d = buildData(B, seed); extendData(B, d, seed + 5); DATA_INIT.forEach(function (f) { try { f(d, B); } catch (e) { console.warn(e); } }); return d; }
/* build now (core.js uses the data straight away); runInits() re-runs page initialisers once all page files have loaded */
BRANDS.forEach(function (B, i) { B.data = buildAll(B, 1009 + i * 77); B.custom = false; });
function runInits() { BRANDS.forEach(function (B) { DATA_INIT.forEach(function (f) { if (!f.done || f.done.indexOf(B.id) < 0) { try { f(B.data, B); } catch (e) { console.warn(e); } (f.done = f.done || []).push(B.id); } }); }); }
