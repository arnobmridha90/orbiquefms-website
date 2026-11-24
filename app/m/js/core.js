'use strict';
/* =====================================================================
   Orbique FMS staff app: phone-first demo.
   Every company, person, phone number, plate and amount here is made up.
   Data lives in this phone's browser storage only.
   ===================================================================== */
var VAPID_PUBLIC = 'BJhwm70BU_7cvAFMJ3GsWPuOkJ3ny59p7HdA6KFMSCm4O1TrpsmOveLV1atk0Rd7da2oYuvdTOZyk2aRVBzBfRo';
var DAY = 864e5, HOUR = 36e5;

/* ---------------- tiny helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function rm(n) { var neg = n < 0; n = Math.abs(Math.round(n * 100) / 100); return (neg ? '−' : '') + 'RM ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function rm0(n) { return 'RM ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function sod(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a, b) { return sod(a).getTime() === sod(b).getTime(); }
var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function hm(d) { d = new Date(d); var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
function dShort(d) { d = new Date(d); return d.getDate() + ' ' + MO[d.getMonth()]; }
function dayWord(d) { var t = sod(new Date()), x = sod(d), n = Math.round((x - t) / DAY); if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday'; return WD[x.getDay()] + ' ' + dShort(x); }
function when(d) { return dayWord(d) + ', ' + hm(d); }
function ago(d) { var s = (Date.now() - new Date(d)) / 1000; if (s < 50) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return dayWord(d); }
function nDays(a, b) { return Math.max(1, Math.ceil((new Date(b) - new Date(a) - 2 * HOUR) / DAY)); } /* 2 hours grace */
function toLocalInput(d) { d = new Date(d); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function toTimeInput(d) { d = new Date(d); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getHours()) + ':' + p(d.getMinutes()); }
function fromInputs(ds, ts) { var a = ds.split('-'), b = (ts || '10:00').split(':'); return new Date(+a[0], +a[1] - 1, +a[2], +b[0], +b[1]); }
function fmtPhone(v) {
  var d = String(v).replace(/\D/g, ''); if (!d) return '';
  if (d[0] === '0') d = '6' + d; if (d.slice(0, 2) !== '60') d = '60' + d;
  var r = d.slice(2, 12), out = '+60 ' + r.slice(0, 2);
  if (r.length > 2) out += '-' + (r.length > 9 ? r.slice(2, 6) + ' ' + r.slice(6) : r.slice(2, 5) + (r.length > 5 ? ' ' + r.slice(5) : ''));
  return out;
}
function initials(n) { return n.split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
function avColor(n) { var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return 'hsl(' + h + ',42%,46%)'; }

/* ---------------- colour helpers (brand from logo colours) ---------------- */
var C = {
  rgb: function (h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); },
  hex: function (r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); },
  mix: function (a, b, t) { var x = C.rgb(a), y = C.rgb(b); return C.hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); },
  lum: function (h) { var c = C.rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; },
  contrast: function (a, b) { var x = C.lum(a), y = C.lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); },
  readable: function (h) { var x = h, i = 0; while (C.contrast(x, '#ffffff') < 4.6 && i < 20) { x = C.mix(x, '#000000', .08); i++; } return x; }
};

/* ---------------- icons ---------------- */
var I = (function () {
  var p = {
    home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    list: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    phone: '<path d="M6.5 3.5l3 .5 1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5.5 3c-.2 1.3-1.3 2.2-2.6 2.1C10.6 19 5 13.4 4.4 6.1 4.3 4.8 5.2 3.7 6.5 3.5z"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8.2 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    car: '<path d="M4 16v-3l2-5h12l2 5v3"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
    in: '<path d="M4 12h11M11 8l4 4-4 4"/><path d="M15 4h4v16h-4"/>',
    out: '<path d="M20 12H9M13 8l-4 4 4 4"/><path d="M9 4H5v16h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    send: '<path d="M4 12l16-8-6 17-3-7z"/><path d="M11 14l9-10"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    install: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 19h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    paint: '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/><path d="M12 20.5c-1.5 0-2-1-1.5-2.2.5-1.3 2-1.3 3.5-1.3 2 0 3.5-1 3.5-3"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19l-3-3 7.5-7.5a4 4 0 0 0-2-2z"/><path d="M5 19l2-2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7h14v-7"/>'
  };
  return function (n, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (p[n] || '') + '</svg>'; };
})();

/* ---------------- companies (made up; brand colours come from each logo) ---------------- */
var MARKS = {
  kilat: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0B0D12"/><path d="M37 8L16 37h14l-4 19 22-30H34z" fill="#1E6BFF"/><path d="M9 47h11M12 53h9" stroke="#1E6BFF" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>',
  padi: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#17603F"/><path d="M17 40a15 15 0 0 1 30 0z" fill="#D9A520"/><path d="M13 45h38M19 51h26" stroke="#D9A520" stroke-width="3.2" stroke-linecap="round"/><path d="M32 9c5 5 5 11 0 16c-5-5-5-11 0-16z" fill="#D9A520"/><path d="M22 14c6 2 8 7 6 12c-6-2-8-7-6-12zM42 14c-6 2-8 7-6 12c6-2 8-7 6-12z" fill="#E7C15A"/></svg>',
  bara: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#26282B"/><circle cx="32" cy="35" r="19" fill="none" stroke="#45484D" stroke-width="5"/><path d="M32 11c8 9 13 15 13 24a13 13 0 0 1-26 0c0-5 3-9 6-12c0 5 2 8 5 9c-2-7 0-14 2-21z" fill="#D7192D"/><circle cx="32" cy="38" r="4" fill="#26282B"/></svg>'
};
var COMPANIES = {
  kilat: { id: 'kilat', name: 'Kilat Wheels', short: 'Kilat', code: 'KLT', no: 386, primary: '#1E6BFF', dark: '#0B0D12', accent: '#1E6BFF', colours: 'Black and blue', city: 'Kuala Lumpur',
    places: ['Kilat office, Cheras', 'KLIA Terminal 1', 'KLIA2', 'KL Sentral', 'Customer address (delivery)'], staff: ['Aina Rahman', 'Hafiz Zul', 'Mei Ling Tan', 'Ravi Kumar'] },
  padi: { id: 'padi', name: 'Padi Emas Rent-a-Car', short: 'Padi Emas', code: 'PDE', no: 152, primary: '#17603F', dark: '#0F2A1D', accent: '#D9A520', colours: 'Green and gold', city: 'Alor Setar',
    places: ['Padi Emas office, Alor Setar', 'Alor Setar Airport', 'Kuala Kedah Jetty', 'Customer address (delivery)'], staff: ['Nurul Huda', 'Azman Saad', 'Siew Lan', 'Kumar Pillai'] },
  bara: { id: 'bara', name: 'Bara Car Rental', short: 'Bara', code: 'BRA', no: 1204, primary: '#D7192D', dark: '#26282B', accent: '#D7192D', colours: 'Red and charcoal', city: 'Penang',
    places: ['Bara office, Bayan Lepas', 'Penang Airport', 'Komtar', 'Customer address (delivery)'], staff: ['Farah Iskandar', 'Jason Ooi', 'Priya Devi', 'Ismail Hamid'] }
};
var COVERS = [{ id: 'none', name: 'No cover', daily: 0 }, { id: 'basic', name: 'Basic cover', daily: 15 }, { id: 'full', name: 'Full cover', daily: 45 }];
var DELIVERY_FEE = 50, AIRPORT_FEE = 30;
function placeFee(p) { if (/delivery/i.test(p)) return DELIVERY_FEE; if (/airport|klia|terminal/i.test(p)) return AIRPORT_FEE; return 0; }

/* ---------------- car drawing ---------------- */
var CAR_COLORS = { 'White': '#F1F2F4', 'Silver': '#C2C6CB', 'Grey': '#6D727A', 'Black': '#1D1E22', 'Red': '#C3171D', 'Blue': '#1F50A8', 'Dark Blue': '#1B2C55', 'Gold': '#C7B188', 'Green': '#2E6A4E', 'Orange': '#E1661C' };
var SHAPES = {
  hatch: { body: 'M20 80L23 62Q26 53 40 51L70 47L95 29Q101 25 111 25L158 25Q170 25 178 33L198 50Q214 52 219 61L222 74Q222 84 213 84L28 84Q20 84 20 80Z', win: 'M77 49L98 32Q102 29 110 29L157 29Q166 29 172 35L189 50Z', wb: [62, 180] },
  sedan: { body: 'M12 78L16 63Q20 55 34 53L70 49L98 31Q104 27 114 27L150 27Q160 27 168 35L186 49L214 53Q225 55 227 65L228 75Q228 84 220 84L20 84Q12 84 12 78Z', win: 'M76 50L100 34Q104 31 112 31L148 31Q157 31 162 36L177 50Z', wb: [56, 184] },
  suv: { body: 'M14 80L16 58Q18 47 32 45L58 43L78 22Q84 16 94 16L176 16Q188 16 194 26L206 42Q220 45 222 57L224 75Q224 84 215 84L22 84Q14 84 14 80Z', win: 'M64 44L82 25Q86 21 94 21L174 21Q184 21 188 28L198 44Z', wb: [58, 184] },
  mpv: { body: 'M14 80L16 60Q18 49 30 46L50 42L74 18Q80 13 90 13L190 13Q206 13 210 26L218 50Q224 54 224 62L224 76Q224 84 216 84L22 84Q14 84 14 80Z', win: 'M56 43L78 20Q82 17 90 17L188 17Q200 17 203 27L208 43Z', wb: [56, 186] }
};
function carSVG(color, shape) {
  var col = CAR_COLORS[color] || '#C2C6CB', s = SHAPES[shape] || SHAPES.hatch, edge = C.lum(col) > .6 ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.15)';
  var w = function (x) { return '<circle cx="' + x + '" cy="84" r="16" fill="#17181C"/><circle cx="' + x + '" cy="84" r="7.5" fill="#9DA2AA"/>'; };
  return '<svg viewBox="0 0 240 104" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><ellipse cx="120" cy="99" rx="104" ry="4" fill="rgba(0,0,0,.12)"/><path d="' + s.body + '" fill="' + col + '" stroke="' + edge + '" stroke-width="1.5"/><path d="' + s.win + '" fill="#2B3644" opacity=".88"/>' + w(s.wb[0]) + w(s.wb[1]) + '</svg>';
}

/* ---------------- seeded random ---------------- */
function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

/* ---------------- seed data ---------------- */
function seed(co) {
  var B = COMPANIES[co], R = rng({ kilat: 11, padi: 23, bara: 37 }[co]);
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var models = [['Perodua', 'Axia', 'hatch', 110], ['Perodua', 'Bezza', 'sedan', 130], ['Perodua', 'Myvi', 'hatch', 140], ['Proton', 'Saga', 'sedan', 120], ['Honda', 'City', 'sedan', 180], ['Proton', 'X50', 'suv', 230], ['Toyota', 'Vios', 'sedan', 170], ['Perodua', 'Alza', 'mpv', 200], ['Proton', 'X70', 'suv', 260], ['Toyota', 'Innova', 'mpv', 250]];
  var colors = ['White', 'Silver', 'Grey', 'Black', 'Red', 'Blue', 'Dark Blue', 'White', 'Silver', 'Gold'];
  var pre = { kilat: 'W', padi: 'K', bara: 'P' }[co];
  var cars = models.map(function (m, k) {
    return { id: 'car' + (k + 1), make: m[0], model: m[1], shape: m[2], rate: m[3], deposit: m[3] >= 200 ? 300 : 200, color: colors[k], plate: pre + pick(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V']) + pick(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']) + ' ' + ri(1000, 9899), year: ri(2019, 2025) };
  });
  var names = ['Nur Aisyah Kamal', 'Daniel Lee', 'Muhammad Irfan', 'Siti Khadijah', 'Kevin Tan', 'Arun Rajan', 'Hannah Wong', 'Amir Hakim', 'Farhana Yusof', 'Chong Wei Jie', 'Lakshmi Nair', 'Haziq Osman', 'Emily Lim', 'Zulkifli Ahmad', 'Grace Teoh', 'Syafiq Rosli', 'Deepa Menon', 'Aiman Faris', 'Rachel Goh', 'Iskandar Musa', 'Melissa Ong', 'Hairul Nizam'];
  var customers = names.map(function (n, k) {
    return { id: 'cu' + (k + 1), name: n, phone: fmtPhone('01' + ri(1, 9) + ri(1000000, 9999999)), flag: k === 3 || k === 12 ? 'VIP' : k === 9 ? 'Be careful' : k === 17 ? 'Blacklisted' : '' };
  });
  var now = new Date(), base = sod(now), no = B.no, bookings = [], who = B.staff;
  for (var k = 0; k < 34; k++) {
    var car = cars[k % cars.length], cu = customers[ri(0, customers.length - 1)];
    if (cu.flag === 'Blacklisted') cu = customers[0];
    var startDay = ri(-12, 13), len = ri(1, 5), sh = pick([9, 10, 10.5, 11, 13, 14, 15, 16.5, 18]);
    var start = new Date(base.getTime() + startDay * DAY + sh * HOUR), end = new Date(start.getTime() + len * DAY + pick([0, 0, -1, 1, 2]) * HOUR);
    /* keep a car from being double booked */
    var clash = bookings.some(function (b) { return b.car === car.id && new Date(b.start) < end && new Date(b.end) > start; });
    if (clash) continue;
    var pp = R() < .55 ? B.places[0] : pick(B.places), rp = R() < .7 ? pp : pick(B.places);
    var cover = pick(['none', 'none', 'basic', 'full']), days = nDays(start, end);
    var b = { id: uid(), code: B.code + '-' + String(no++).padStart(5, '0'), cust: cu.id, car: car.id, start: start.toISOString(), end: end.toISOString(), pickPlace: pp, retPlace: rp,
      cover: cover, deposit: car.deposit, rate: car.rate, extras: [], payments: [], log: [], source: pick(['Staff', 'Staff', 'Website', 'WhatsApp']), note: '', status: 'Confirmed', createdBy: pick(who) };
    b.status = end < now ? 'Returned' : start < now ? 'Picked up' : 'Confirmed';
    if (k === 5 || k === 21) b.status = 'Cancelled';
    var tot = priceOf(b).total, created = new Date(start.getTime() - ri(1, 9) * DAY);
    b.created = created.toISOString();
    b.log.push({ at: created.toISOString(), by: b.source === 'Staff' ? b.createdBy : b.source, text: 'Booking made' + (b.source !== 'Staff' ? ' on ' + b.source : '') });
    if (b.status !== 'Cancelled') {
      var paidPart = b.status === 'Returned' ? 1 : pick([0, .3, .5, 1, 1]);
      if (paidPart > 0) b.payments.push({ id: uid(), amt: Math.round(tot * paidPart), kind: 'Rental', method: pick(['Online Transfer', 'Cash', 'Card']), at: new Date(created.getTime() + 2 * HOUR).toISOString(), by: pick(who) });
      if (b.status !== 'Confirmed' || R() < .4) b.payments.push({ id: uid(), amt: b.deposit, kind: 'Deposit', method: pick(['Online Transfer', 'Cash']), at: new Date(Math.min(start.getTime(), now.getTime())).toISOString(), by: pick(who) });
      if (b.status === 'Picked up' || b.status === 'Returned') b.log.push({ at: start.toISOString(), by: pick(who), text: 'Car handed over at ' + pp });
      if (b.status === 'Returned') b.log.push({ at: end.toISOString(), by: pick(who), text: 'Car returned at ' + rp });
    } else b.log.push({ at: new Date(created.getTime() + DAY).toISOString(), by: pick(who), text: 'Booking cancelled' });
    bookings.push(b);
  }
  var t = function (minsAgo) { return new Date(now.getTime() - minsAgo * 60000).toISOString(); };
  var staffChat = [
    { id: uid(), from: who[1], text: 'Morning all. ' + cars[2].plate + ' is back from the car wash.', at: t(300) },
    { id: uid(), from: who[2], text: 'Thanks! I have 2 pick-ups at ' + B.places[1] + ' this afternoon.', at: t(260) },
    { id: uid(), from: who[0], text: 'Noted. Please take photos of all four sides at handover 🙏', at: t(255) },
    { id: uid(), from: who[3], text: 'Customer for ' + cars[5].plate + ' asked to return 2 hours later. I said OK, no extra charge.', at: t(90) },
    { id: uid(), from: who[1], text: 'Ok boss', at: t(85) }
  ];
  var wa = [
    { id: uid(), name: 'Faizal Hassan', phone: fmtPhone('0127788123'), status: 'Lead', unread: 2, handled: 'bot', msgs: [
      { from: 'cust', text: 'Hi, is a Myvi available this Saturday to Monday?', at: t(42) },
      { from: 'bot', text: 'Hi Faizal! Yes, a Perodua Myvi is free from Sat to Mon. That is 2 days at RM 140.00 a day, so RM 280.00, plus a RM 200.00 deposit that we refund after return. Where would you like to pick it up?', at: t(41) },
      { from: 'cust', text: 'KL Sentral please. Can I pay half first?', at: t(12) },
      { from: 'cust', text: 'And do you deliver?', at: t(11) }] },
    { id: uid(), name: 'Tan Bee Choo', phone: fmtPhone('0163344556'), status: 'Booked', unread: 0, handled: 'staff', msgs: [
      { from: 'cust', text: 'I have sent the transfer slip for my booking.', at: t(400) },
      { from: 'staff', by: who[0], text: 'Received, thank you! See you tomorrow at 10 am.', at: t(380) }] },
    { id: uid(), name: 'Ahmad Danial', phone: fmtPhone('0192233445'), status: 'Asking price', unread: 1, handled: 'bot', msgs: [
      { from: 'cust', text: 'How much for an SUV for 1 week?', at: t(130) },
      { from: 'bot', text: 'For 7 days a Proton X50 is RM 1,610.00 (RM 230.00 a day) and an X70 is RM 1,820.00. Both need a RM 300.00 deposit. Would you like me to hold one for you?', at: t(129) },
      { from: 'cust', text: 'Can give discount ah?', at: t(60) }] }
  ];
  var notifs = [
    { id: uid(), kind: 'wa', title: 'Faizal Hassan on WhatsApp', body: 'And do you deliver?', at: t(11), read: false, link: '#chat/wa/' + wa[0].id },
    { id: uid(), kind: 'staff', title: who[3] + ' in Team chat', body: staffChat[3].text, at: t(90), read: false, link: '#chat/staff' }
  ];
  var up = bookings.filter(function (b) { return b.status === 'Confirmed'; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
  if (up) notifs.push({ id: uid(), kind: 'new', title: 'New booking ' + up.code, body: nameOf(customers, up.cust) + ' · ' + carName(cars, up.car) + ' · ' + when(up.start), at: t(150), read: true, link: '#booking/' + up.id });
  return { v: 3, co: co, cars: cars, customers: customers, bookings: bookings, staffChat: staffChat, wa: wa, notifs: notifs, nextNo: no,
    prefs: { new: true, change: true, staff: true, wa: true, pay: true, due: true }, me: who[0] };
}
function nameOf(list, id) { var c = list.filter(function (x) { return x.id === id; })[0]; return c ? c.name : '?'; }
function carName(list, id) { var c = list.filter(function (x) { return x.id === id; })[0]; return c ? c.make + ' ' + c.model : '?'; }

/* ---------------- state ---------------- */
var CO = window.__CO || 'kilat', S;
function key() { return 'fms.data.' + CO; }
/* Feature modules add their own made-up data here: SEEDERS.push({ key: 'expenses', fn: function (d, x) { d.expenses = [...]; } }).
   x = { B: company, R: random 0..1, ri(a, b), pick(list), now }. A seeder runs once, when its key is missing,
   so phones that already have demo data get the new parts too. */
var SEEDERS = [];
function runSeeders(d) {
  var R = rng({ kilat: 101, padi: 202, bara: 303 }[d.co] || 7);
  var x = { B: COMPANIES[d.co], R: R, ri: function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick: function (a) { return a[Math.floor(R() * a.length)]; }, now: new Date() };
  SEEDERS.forEach(function (sd) { if (d[sd.key] === undefined) { try { sd.fn(d, x); } catch (e) { console.error('seed ' + sd.key, e); } } });
  return d;
}
function load() { var j = null; try { j = JSON.parse(localStorage.getItem(key())); } catch (e) {} if (!j || j.v !== 3) j = seed(CO); return runSeeders(j); }
function save() { try { localStorage.setItem(key(), JSON.stringify(S)); } catch (e) {} }
function B() { return COMPANIES[CO]; }
function car(id) { return S.cars.filter(function (c) { return c.id === id; })[0]; }
function cust(id) { return S.customers.filter(function (c) { return c.id === id; })[0]; }
function bk(id) { return S.bookings.filter(function (b) { return b.id === id; })[0]; }
function priceOf(b) {
  var days = nDays(b.start, b.end), rent = days * b.rate, cv = COVERS.filter(function (c) { return c.id === b.cover; })[0] || COVERS[0];
  var cover = cv.daily * days, pf = placeFee(b.pickPlace) + placeFee(b.retPlace), ex = (b.extras || []).reduce(function (s, e) { return s + e.amt; }, 0);
  var total = rent + cover + pf + ex;
  var paid = (b.payments || []).filter(function (p) { return p.kind === 'Rental'; }).reduce(function (s, p) { return s + p.amt; }, 0);
  var dep = (b.payments || []).filter(function (p) { return p.kind === 'Deposit'; }).reduce(function (s, p) { return s + p.amt; }, 0);
  return { days: days, rent: rent, cover: cover, coverName: cv.name, places: pf, extras: ex, total: total, paid: paid, balance: total - paid, depPaid: dep };
}
function liveStatus(b) { return b.status; }
function statusChip(b) {
  var s = b.status, cls = { Confirmed: 'brand', 'Picked up': 'warn', Returned: 'ok', Cancelled: '' }[s];
  var label = s === 'Picked up' ? 'On road' : s;
  if (s === 'Picked up' && new Date(b.end) < new Date()) { cls = 'bad'; label = 'Late return'; }
  return '<span class="chip ' + cls + '">' + label + '</span>';
}

/* ---------------- brand theme ---------------- */
function applyTheme() {
  var b = B(), r = document.documentElement.style, ink = C.readable(b.primary);
  r.setProperty('--brand', b.primary); r.setProperty('--brand-ink', ink); r.setProperty('--dark', b.dark); r.setProperty('--accent', b.accent);
  r.setProperty('--on-brand', C.contrast(b.primary, '#fff') >= 3 ? '#fff' : '#111');
  r.setProperty('--tint', C.mix(b.primary, '#ffffff', .89));
  $('#themeColor').content = '#F4F5F7';
}

/* ---------------- notifications ---------------- */
var KINDS = {
  new: { label: 'New bookings', desc: 'Someone books on the website, WhatsApp or by staff', icon: 'plus' },
  change: { label: 'Booking changes', desc: 'Dates, car, place or status change, or a cancellation', icon: 'edit' },
  staff: { label: 'Staff chat', desc: 'New messages in the team chat', icon: 'users' },
  wa: { label: 'Customer chat (WhatsApp)', desc: 'Customers writing to the booking assistant', icon: 'wa' },
  pay: { label: 'Payments', desc: 'Money recorded or a transfer slip received', icon: 'cash' },
  due: { label: 'Handovers due', desc: 'Pick-ups and returns in the next hour, late returns', icon: 'clock' }
};
function notify(kind, title, body, link, opts) {
  opts = opts || {};
  var n = { id: uid(), kind: kind, title: title, body: body, at: new Date().toISOString(), read: false, link: link || '#inbox' };
  S.notifs.unshift(n); S.notifs = S.notifs.slice(0, 60); save();
  if (!S.prefs[kind]) { refreshBadges(); return; }
  if (!opts.silentToast) toast(n);
  /* Android app (APK): hand it to the phone when the app is not on screen */
  if (ANDROID) { try { if (!FMSAndroid.inFront()) FMSAndroid.notify(title, body, n.link || '#inbox'); } catch (e) {} refreshBadges(); return; }
  /* when the app is in the background, also show it as a phone notification */
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, { body: body, tag: n.id, icon: 'icons/' + CO + '-192.png', badge: 'icons/badge-96.png', data: { url: './' + (n.link || '') } }); });
  }
  refreshBadges();
}
function kindIcon(kind) { return '<div class="ic k-' + kind + '">' + I(KINDS[kind] ? KINDS[kind].icon : 'bell') + '</div>'; }
function toast(n) {
  var el = document.createElement('button');
  el.className = 'toast';
  el.innerHTML = '<div class="ic">' + MARKS[CO] + '</div><div style="min-width:0;flex:1"><b>' + esc(n.title) + '</b><span>' + esc(n.body) + '</span></div>';
  el.onclick = function () { n.read = true; save(); hideT(); location.hash = n.link; };
  var box = $('#toasts'); while (box.children.length >= 2) box.removeChild(box.firstChild);
  box.appendChild(el);
  if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
  requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); }); });
  var hideT = function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 350); };
  setTimeout(hideT, 4800);
}
function say(msg) {
  var el = document.createElement('div'); el.className = 'toast plain'; el.textContent = msg; $('#toasts').appendChild(el);
  requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); }); });
  setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 350); }, 2400);
}
function unreadCount() { return S.notifs.filter(function (n) { return !n.read; }).length; }
function chatUnread() { return S.wa.reduce(function (s, c) { return s + (c.unread || 0); }, 0) + (S.staffUnread || 0); }
function refreshBadges() {
  var u = unreadCount(), bell = $('#bellDot'); if (bell) { bell.textContent = u; bell.style.display = u ? '' : 'none'; }
  var cu = chatUnread(), cd = $('#chatDot'); if (cd) { cd.textContent = cu; cd.style.display = cu ? '' : 'none'; }
}

/* ---------------- push (real phone notifications through the server) ---------------- */
var PUSH = { supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, sub: null, server: null };
var ANDROID = !!window.FMSAndroid;
function standalone() { return ANDROID || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function b64ToBytes(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
var swReg = null;
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(function (r) {
    swReg = r; return r.pushManager && r.pushManager.getSubscription();
  }).then(function (s) { PUSH.sub = s || null; if (route().name === 'notifs') render(); }).catch(function () {});
  navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.open) location.hash = e.data.open.replace(/^.*#/, '#'); });
}
function enablePush() {
  if (!PUSH.supported) { say(isIOS() && !standalone() ? 'Add the app to your Home Screen first' : 'This browser cannot show notifications'); return Promise.resolve(); }
  return Notification.requestPermission().then(function (perm) {
    if (perm !== 'granted') { say('Notifications were not allowed'); render(); return; }
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) }); });
    }).then(function (s) { PUSH.sub = s; say('Phone notifications are on'); render(); })
      .catch(function () { say('Turned on, but push could not start here'); render(); });
  });
}
/* ask the server to push to this phone after a delay, so it arrives even when the app is closed or the phone is locked */
function serverPush(kind, title, body, link, delaySec) {
  if (!PUSH.sub) return Promise.reject(new Error('no-sub'));
  return fetch('../api/push', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: PUSH.sub.toJSON(), delay: delaySec || 0, title: title, body: body, url: location.pathname + link, tag: kind + '-' + Date.now(), icon: 'icons/' + CO + '-192.png' }) })
    .then(function (r) { if (!r.ok) throw new Error('push ' + r.status); return r; });
}

/* ---------------- router ---------------- */
function route() {
  var h = (location.hash || '#home').slice(1).split('/');
  return { name: h[0] || 'home', a: h[1], b: h[2] };
}
var TAB_OF = { home: 'home', bookings: 'bookings', booking: 'bookings', new: 'new', chat: 'chat', more: 'more', schedules: 'more', cars: 'more', customers: 'more', money: 'more', notifs: 'more', company: 'more', install: 'more', inbox: 'home', customer: 'more', carinfo: 'more' };
window.addEventListener('hashchange', function () { closeSheet(true); render(true); });
window.addEventListener('scroll', function () { var t = $('.top'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });

function topbar(title, opts) {
  opts = opts || {};
  var left = opts.back ? '<button class="iconbtn back" onclick="goBack(\'' + opts.back + '\')" aria-label="Back">' + I('back', 2.2) + '</button>' : '<div class="mark">' + MARKS[CO] + '</div>';
  return '<header class="top"><div class="top-in">' + left + '<h1>' + esc(title) + (opts.sub ? '<span class="sub">' + esc(opts.sub) + '</span>' : '') + '</h1>' + (opts.right || '') +
    '<a class="iconbtn" href="#inbox" aria-label="Notifications">' + I('bell') + '<span class="dot" id="bellDot" style="display:none"></span></a></div></header>';
}
function goBack(fallback) { if (history.length > 1 && document.referrer !== undefined && window.__nav > 0) { window.__nav -= 2; history.back(); } else location.hash = fallback; }
window.__nav = 0;
window.addEventListener('hashchange', function () { window.__nav++; });
function nav(active) {
  var it = function (k, href, icon, label, extra) { return '<a href="' + href + '" class="' + (active === k ? 'on' : '') + '">' + I(icon, active === k ? 2.2 : 1.9) + label + (extra || '') + '</a>'; };
  return '<nav class="nav"><div class="nav-in">' + it('home', '#home', 'home', 'Home') + it('bookings', '#bookings', 'list', 'Bookings') +
    '<a href="#new" aria-label="New booking"><span class="plus">' + I('plus', 2.4) + '</span></a>' +
    it('chat', '#chat', 'chat', 'Chat', '<span class="dot" id="chatDot" style="display:none"></span>') + it('more', '#more', 'grid', 'More') + '</div></nav>';
}

var VIEWS = {};
function render(nav_) {
  var r = route(), v = VIEWS[r.name] || VIEWS.home, out = v(r);
  var withNav = !out.noNav;
  $('#app').innerHTML = out.html + (withNav ? nav(TAB_OF[r.name]) : '');
  var m = $('main'); if (m) { m.classList.toggle('no-nav', !withNav); if (nav_) m.classList.add('fade-in'); }
  if (out.after) out.after();
  refreshBadges();
  if (nav_ && !out.keepScroll) window.scrollTo(0, 0);
}

/* ---------------- sheet ---------------- */
function sheet(html, after) {
  closeSheet(true);
  var sc = document.createElement('div'); sc.className = 'scrim'; sc.id = 'scrim'; sc.onclick = function () { closeSheet(); };
  var sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'sheet'; sh.setAttribute('role', 'dialog'); sh.innerHTML = '<div class="grab"></div>' + html;
  document.body.appendChild(sc); document.body.appendChild(sh);
  requestAnimationFrame(function () { requestAnimationFrame(function () { sc.classList.add('show'); sh.classList.add('show'); }); });
  if (after) after();
  /* swipe down to close */
  var y0 = null; sh.addEventListener('touchstart', function (e) { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)'; } }, { passive: true });
  sh.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; sh.style.transition = ''; sh.style.transform = ''; y0 = null; if (dy > 90) closeSheet(); });
}
function closeSheet(now) {
  var sc = $('#scrim'), sh = $('#sheet'); if (!sh) return;
  if (now) { sc.remove(); sh.remove(); return; }
  sc.classList.remove('show'); sh.classList.remove('show'); setTimeout(function () { sc.remove(); sh.remove(); }, 280);
}
function segPick(sel, cb) { $$(sel + ' button').forEach(function (b) { b.onclick = function () { $$(sel + ' button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); if (cb) cb(b.textContent); }; }); }

var _render = render;
render = function (navd, keep) { var y = window.scrollY; _render(navd); if (keep) window.scrollTo(0, y); };
