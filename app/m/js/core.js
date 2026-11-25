'use strict';
/* =====================================================================
   Orbique FMS staff app: phone-first demo.
   Every company, person, phone number, plate and amount here is made up.
   Data lives in this phone's browser storage only.
   Read CONTRACT.md (next to index.html) for the data model and the shared API.
   ===================================================================== */
var VAPID_PUBLIC = 'BJhwm70BU_7cvAFMJ3GsWPuOkJ3ny59p7HdA6KFMSCm4O1TrpsmOveLV1atk0Rd7da2oYuvdTOZyk2aRVBzBfRo';
var DAY = 864e5, HOUR = 36e5, MIN = 6e4;
var DATA_VERSION = 5; /* 5: two months of history, odometer readings that follow each other */

/* ---------------- tiny helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
/* money: 'RM 1,234.50', negatives as '-RM 1,234.50' (plain ASCII minus) */
function rm(n) { n = +n || 0; var neg = n < 0; n = Math.abs(Math.round(n * 100) / 100); return (neg ? '-' : '') + 'RM ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function rm0(n) { return rm(n); } /* old name, kept as an alias: always use rm() */
/* '1,234.5' -> 1234.5; anything else (letters, 3 decimals, negative) -> NaN */
function parseMoney(v) { var s = String(v == null ? '' : v).replace(/,/g, '').replace(/^\s*RM\s*/i, '').trim(); return /^\d+(\.\d{1,2})?$/.test(s) ? parseFloat(s) : NaN; }
function money2(n) { return (Math.round((+n || 0) * 100) / 100).toFixed(2); } /* for input values */
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = '0' + n; return n; }
function sod(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a, b) { return sod(a).getTime() === sod(b).getTime(); }
function clampNow(d) { var t = new Date(d).getTime(), n = Date.now(); return new Date(Math.min(t, n)).toISOString(); }
var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function hm(d) { d = new Date(d); var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' AM' : ' PM'); }
function dShort(d) { d = new Date(d); return d.getDate() + ' ' + MO[d.getMonth()]; }            /* 3 Nov */
function dLong(d) { d = new Date(d); return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()]; } /* Thu 26 Nov */
function dFull(d) { d = new Date(d); return d.getDate() + ' ' + MO[d.getMonth()] + ' ' + d.getFullYear(); } /* 3 Nov 2026 */
function dayWord(d) { var t = sod(new Date()), x = sod(d), n = Math.round((x - t) / DAY); if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday'; return WD[x.getDay()] + ' ' + dShort(x); }
function when(d) { return dayWord(d) + ', ' + hm(d); }
function ago(d) { var s = (Date.now() - new Date(d)) / 1000; if (s < 50) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return dayWord(d); }
/* days counted for cover and day chips: under 24 h is 1, part days round up */
function nDays(a, b) { var s = (new Date(b) - new Date(a)) / 1000; if (s < 86400) return 1; return Math.floor(s / 86400) + (s % 86400 > 0 ? 1 : 0); }
/* '3 days, 2 hours' / '5 hours' / '1 day' / '2 hours 30 min' */
function durationText(a, b) {
  var mins = Math.max(0, Math.round((new Date(b) - new Date(a)) / MIN)), d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60, out = [];
  if (d) out.push(d + ' day' + (d > 1 ? 's' : ''));
  if (h) out.push(h + ' hour' + (h > 1 ? 's' : '') + (m && !d ? ' ' + m + ' min' : ''));
  else if (m && !d) out.push(m + ' min');
  return out.join(', ') || '0 hours';
}
function toLocalInput(d) { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function toTimeInput(d) { d = new Date(d); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function fromInputs(ds, ts) { var a = ds.split('-'), b = (ts || '10:00').split(':'); return new Date(+a[0], +a[1] - 1, +a[2], +b[0], +b[1]); }
function initials(n) { return String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
function avColor(n) { n = String(n || ''); var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return 'hsl(' + h + ',42%,46%)'; }
function strHash(s) { s = String(s || ''); var h = 5381; for (var i = 0; i < s.length; i += Math.max(1, Math.floor(s.length / 4000))) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }

/* ---------------- search helpers ---------------- */
function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
/* any way of writing a phone -> digits with the country code: '012-345 6789', '+60 12...', '6012...' -> '60123456789' */
function normPhone(s) {
  var raw = String(s == null ? '' : s).trim(), d = digits(raw), cc = (S && S.settings && S.settings.country) || '60';
  if (!d) return '';
  if (raw[0] === '+' || raw.slice(0, 2) === '00') return raw.slice(0, 2) === '00' ? d.slice(2) : d;
  if (d[0] === '0') return cc + d.slice(1);
  if (d.indexOf(cc) === 0 && d.length >= cc.length + 8) return d;
  return cc + d;
}
/* the bare local part used for matching: '+60 15-634 0276', '015-634', '60156340276' -> '156340276' / '15634' */
function phoneCore(s) { var d = digits(s), cc = (S && S.settings && S.settings.country) || '60'; if (d.indexOf(cc) === 0 && d.length > cc.length + 6) d = d.slice(cc.length); return d.replace(/^0+/, ''); }
/* a search that looks like a phone (digits, spaces, dashes, brackets, +; 3+ digits) -> its core digits, else '' */
function tidySearch(q) { q = String(q || '').trim(); if (!/^[\d\s\-+().]+$/.test(q) || digits(q).length < 3) return ''; return phoneCore(q); }
function phoneMatch(q, phone) { var t = tidySearch(q); return !!t && phoneCore(phone).indexOf(t) >= 0; }
function normPlate(s) { return String(s || '').toUpperCase().replace(/[\s\-]/g, ''); }
/* 'KLT-00012', '00012', '12', '#12', 'klt 12' are all booking 12 */
function matchBookingCode(q, b) {
  var m = String(q || '').trim().replace(/^#/, '').match(/^([a-z]{2,5})?[\s\-]*0*(\d{1,7})$/i);
  if (!m || !b) return false;
  if (m[1] && m[1].toUpperCase() !== String(b.code).split('-')[0].toUpperCase()) return false;
  return +m[2] === +b.no;
}
/* every word of q is somewhere in the text (case-insensitive) */
function wordsMatch(q, text) { var t = String(text || '').toLowerCase(); return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return t.indexOf(w) >= 0; }); }
/* phone number for showing: '+60 12-345 6789'; a foreign '+CC' stays as typed with digits grouped */
var CCODES = ['1', '7', '20', '27', '30', '31', '33', '34', '39', '41', '44', '49', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98', '673', '852', '853', '855', '856', '880', '886', '960', '966', '971', '974', '977'];
function fmtPhone(v) {
  var raw = String(v == null ? '' : v).trim(), cc = (S && S.settings && S.settings.country) || '60';
  if (!digits(raw)) return '';
  var d = normPhone(raw);
  if (d.indexOf(cc) !== 0) {
    var code = ''; for (var l = 3; l >= 1 && !code; l--) if (CCODES.indexOf(d.slice(0, l)) >= 0) code = d.slice(0, l);
    if (!code) code = d.slice(0, 2);
    var rest = d.slice(code.length), parts = rest.match(/\d{1,4}/g) || [];
    if (parts.length > 1 && parts[parts.length - 1].length < 3) parts[parts.length - 2] += parts.pop();
    return '+' + code + ' ' + parts.join(' ');
  }
  var r = d.slice(cc.length), out = '+' + cc + ' ' + r.slice(0, 2);
  if (r.length > 2) out += '-' + (r.length > 9 ? r.slice(2, 6) + ' ' + r.slice(6) : r.slice(2, 5) + (r.length > 5 ? ' ' + r.slice(5) : ''));
  return out;
}

/* ---------------- colour helpers (brand from logo colours) ---------------- */
var C = {
  rgb: function (h) { h = String(h || '').replace('#', ''); if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(function (c) { return c + c; }).join(''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); },
  hex: function (r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); },
  mix: function (a, b, t) { var x = C.rgb(a), y = C.rgb(b); return C.hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); },
  lum: function (h) { var c = C.rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; },
  contrast: function (a, b) { var x = C.lum(a), y = C.lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); },
  readable: function (h) { var x = h, i = 0; while (C.contrast(x, '#ffffff') < 4.6 && i < 20) { x = C.mix(x, '#000000', .08); i++; } return x; },
  hue: function (h) { var c = C.rgb(h).map(function (v) { return v / 255; }), mx = Math.max.apply(0, c), mn = Math.min.apply(0, c), d = mx - mn, hu = 0; if (!d) return -1; if (mx === c[0]) hu = ((c[1] - c[2]) / d) % 6; else if (mx === c[1]) hu = (c[2] - c[0]) / d + 2; else hu = (c[0] - c[1]) / d + 4; hu *= 60; return hu < 0 ? hu + 360 : hu; },
  sat: function (h) { var c = C.rgb(h).map(function (v) { return v / 255; }), mx = Math.max.apply(0, c), mn = Math.min.apply(0, c); return mx ? (mx - mn) / mx : 0; }
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
    down: '<path d="M5 9l7 7 7-7"/>',
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
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>',
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
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.3h.01"/>',
    paint: '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/><path d="M12 20.5c-1.5 0-2-1-1.5-2.2.5-1.3 2-1.3 3.5-1.3 2 0 3.5-1 3.5-3"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19l-3-3 7.5-7.5a4 4 0 0 0-2-2z"/><path d="M5 19l2-2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7h14v-7"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M6.5 7l1 13h9l1-13"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    map: '<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
    fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M14 9h2.5l2 2V17a1.5 1.5 0 0 1-3 0v-3H14"/><path d="M7.5 7.5h4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    signout: '<path d="M15 4h4v16h-4"/><path d="M10 16l4-4-4-4M14 12H4"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>'
  };
  return function (n, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (p[n] || '') + '</svg>'; };
})();

/* ---------------- companies (made up; brand colours come from each logo) ---------------- */
var MARKS = {
  kilat: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0B0D12"/><path d="M37 8L16 37h14l-4 19 22-30H34z" fill="#1E6BFF"/><path d="M9 47h11M12 53h9" stroke="#1E6BFF" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>',
  padi: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#17603F"/><path d="M17 40a15 15 0 0 1 30 0z" fill="#D9A520"/><path d="M13 45h38M19 51h26" stroke="#D9A520" stroke-width="3.2" stroke-linecap="round"/><path d="M32 9c5 5 5 11 0 16c-5-5-5-11 0-16z" fill="#D9A520"/><path d="M22 14c6 2 8 7 6 12c-6-2-8-7-6-12zM42 14c-6 2-8 7-6 12c6-2 8-7 6-12z" fill="#E7C15A"/></svg>',
  bara: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#26282B"/><circle cx="32" cy="35" r="19" fill="none" stroke="#45484D" stroke-width="5"/><path d="M32 11c8 9 13 15 13 24a13 13 0 0 1-26 0c0-5 3-9 6-12c0 5 2 8 5 9c-2-7 0-14 2-21z" fill="#D7192D"/><circle cx="32" cy="38" r="4" fill="#26282B"/></svg>'
};
/* Fixed identity of the three demo companies. Everything a company can change lives in S.settings (see companySettings in seed.js), and B() merges both. */
var COMPANIES = {
  kilat: { id: 'kilat', name: 'Kilat Wheels', short: 'Kilat', code: 'KLT', no: 386, primary: '#1E6BFF', dark: '#0B0D12', accent: '#1E6BFF', colours: 'Black and blue', city: 'Kuala Lumpur', lat: 3.1209, lng: 101.7406 },
  padi: { id: 'padi', name: 'Padi Emas Rent-a-Car', short: 'Padi Emas', code: 'PDE', no: 152, primary: '#17603F', dark: '#0F2A1D', accent: '#D9A520', colours: 'Green and gold', city: 'Alor Setar', lat: 6.1248, lng: 100.3678 },
  bara: { id: 'bara', name: 'Bara Car Rental', short: 'Bara', code: 'BRA', no: 1204, primary: '#D7192D', dark: '#26282B', accent: '#D7192D', colours: 'Red and charcoal', city: 'Penang', lat: 5.2946, lng: 100.2593 }
};

/* ---------------- car drawing ---------------- */
var CAR_COLORS = { 'White': '#F1F2F4', 'Silver': '#C2C6CB', 'Grey': '#6D727A', 'Black': '#1D1E22', 'Red': '#C3171D', 'Blue': '#1F50A8', 'Dark Blue': '#1B2C55', 'Gold': '#C7B188', 'Green': '#2E6A4E', 'Orange': '#E1661C', 'Brown': '#6B4A33' };
var SHAPES = {
  hatch: { body: 'M20 80L23 62Q26 53 40 51L70 47L95 29Q101 25 111 25L158 25Q170 25 178 33L198 50Q214 52 219 61L222 74Q222 84 213 84L28 84Q20 84 20 80Z', win: 'M77 49L98 32Q102 29 110 29L157 29Q166 29 172 35L189 50Z', wb: [62, 180] },
  sedan: { body: 'M12 78L16 63Q20 55 34 53L70 49L98 31Q104 27 114 27L150 27Q160 27 168 35L186 49L214 53Q225 55 227 65L228 75Q228 84 220 84L20 84Q12 84 12 78Z', win: 'M76 50L100 34Q104 31 112 31L148 31Q157 31 162 36L177 50Z', wb: [56, 184] },
  suv: { body: 'M14 80L16 58Q18 47 32 45L58 43L78 22Q84 16 94 16L176 16Q188 16 194 26L206 42Q220 45 222 57L224 75Q224 84 215 84L22 84Q14 84 14 80Z', win: 'M64 44L82 25Q86 21 94 21L174 21Q184 21 188 28L198 44Z', wb: [58, 184] },
  mpv: { body: 'M14 80L16 60Q18 49 30 46L50 42L74 18Q80 13 90 13L190 13Q206 13 210 26L218 50Q224 54 224 62L224 76Q224 84 216 84L22 84Q14 84 14 80Z', win: 'M56 43L78 20Q82 17 90 17L188 17Q200 17 203 27L208 43Z', wb: [56, 186] }
};
var CAR_TYPES = { hatch: 'Hatchback', sedan: 'Sedan', suv: 'SUV', mpv: 'MPV' };
function carSVG(color, shape) {
  var col = CAR_COLORS[color] || '#C2C6CB', s = SHAPES[shape] || SHAPES.hatch, edge = C.lum(col) > .6 ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.15)';
  var w = function (x) { return '<circle cx="' + x + '" cy="84" r="16" fill="#17181C"/><circle cx="' + x + '" cy="84" r="7.5" fill="#9DA2AA"/>'; };
  return '<svg viewBox="0 0 240 104" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><ellipse cx="120" cy="99" rx="104" ry="4" fill="rgba(0,0,0,.12)"/><path d="' + s.body + '" fill="' + col + '" stroke="' + edge + '" stroke-width="1.5"/><path d="' + s.win + '" fill="#2B3644" opacity=".88"/>' + w(s.wb[0]) + w(s.wb[1]) + '</svg>';
}

/* ---------------- seeded random ---------------- */
function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

/* ---------------- state ---------------- */
var CO = window.__CO || 'kilat', S = null, GEN = 0;
function key() { return 'fms.data.' + CO; }
/* Feature modules add their own made-up data here: SEEDERS.push({ key: 'expenses', fn: function (d, x) { d.expenses = [...]; } }).
   x = { B: company settings + identity, R: random 0..1, ri(a, b), pick(list), now, staffIds(role?) }. A seeder runs once, when d[key] is undefined,
   so phones that already have demo data get the new parts too. */
var SEEDERS = [];
function runSeeders(d) {
  var R = rng({ kilat: 101, padi: 202, bara: 303 }[d.co] || 7);
  var BB = Object.assign({}, COMPANIES[d.co], d.settings || {});
  var x = { B: BB, R: R, ri: function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick: function (a) { return a[Math.floor(R() * a.length)]; }, now: new Date(),
    staffIds: function (role) { return (d.staff || []).filter(function (p) { return !role || p.role === role; }).map(function (p) { return p.id; }); } };
  SEEDERS.forEach(function (sd) { if (d[sd.key] === undefined) { try { sd.fn(d, x); } catch (e) { console.error('seed ' + sd.key, e); } } });
  return d;
}
function load() {
  var j = null; try { j = JSON.parse(localStorage.getItem(key())); } catch (e) {}
  if (j && j.v === 3 && typeof migrateV3 === 'function') { try { j = migrateV3(j); } catch (e) { console.error('migration failed, fresh demo data', e); j = null; } }
  if (!j || j.v !== DATA_VERSION) j = seed(CO);
  S = j; /* B() needs S while the seeders run */
  runSeeders(j); usePrefs(j);
  return j;
}
function save() {
  try { localStorage.setItem(key(), JSON.stringify(S)); }
  catch (e) {
    /* storage full: make room from old notifications and activity, then tell the person once */
    try { S.notifs = (S.notifs || []).slice(0, 20); S.audit = (S.audit || []).slice(0, 80); ['kilat', 'padi', 'bara'].forEach(function (k) { if (k !== CO) localStorage.removeItem('fms.data.' + k); }); localStorage.setItem(key(), JSON.stringify(S)); }
    catch (e2) { if (!save.warned) { save.warned = true; say('This phone\u2019s demo storage is full. Reset the demo in More, or use smaller photos.'); } }
  }
}
/* company settings + identity. Read with B().x. To change a setting: S.settings.x = v; save(); */
function B() { return S && S.settings ? Object.assign({}, COMPANIES[CO], S.settings) : COMPANIES[CO]; }
function byId(list, id) { if (!list) return undefined; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return undefined; }
function car(id) { return byId(S.cars, id); }
function cust(id) { return byId(S.customers, id) || { id: id, name: 'Unknown customer', phone: '' }; }
function bk(id) { return byId(S.bookings, id); }
function staff(id) { return byId(S.staff, id); }
function me() { return staff(S.me) || { id: S.me, name: 'Guest', role: 'readonly' }; }
function myName() { return me().name; }
function firstName(n) { return String(n || '').split(' ')[0]; }
/* a `by` field is a staff id for staff, or a plain label ('Website', 'Customer', 'Slip reader'). who() shows either. */
function who(by) { var p = staff(by); return p ? p.name : (by || ''); }
function loc(id) { return byId(B().locations, id); }
function place(id) { return byId(B().places, id); }
function pkg(id) { return byId(B().packages, id); }
function nameOf(list, id) { var c = byId(list, id); return c ? c.name : '?'; }
function carName(list, id) { var c = byId(list, id); return c ? c.make + ' ' + c.model : '?'; }
function carLabel(c) { return c ? c.plate + ' · ' + c.make + ' ' + c.model : 'No car'; }
function bookingCode(no) { return (B().codePrefix || B().code) + '-' + pad(no, 5); }
function custFlags(c) { /* ['Blacklisted', 'Be careful', 'VIP'] from the blacklist and the customer's notes */
  if (!c) return []; var out = [];
  if (c.blacklist) out.push('Blacklisted');
  var ns = (S.notes || []).filter(function (n) { return n.cust === c.id; });
  if (ns.some(function (n) { return n.flag === 'careful'; })) out.push('Be careful');
  if (ns.some(function (n) { return n.flag === 'vip'; })) out.push('VIP');
  return out;
}
function custFlag(c) { return custFlags(c)[0] || ''; }
function flagChip(f) { return f ? '<span class="chip ' + (f === 'VIP' ? 'tone-blue' : f === 'Blacklisted' ? 'tone-red' : 'tone-amber') + '">' + esc(f) + '</span>' : ''; }
/* photos are data URLs, or 'demo:<kind>:<label>' placeholders that imgSrc() draws as a small picture */
function imgSrc(x) { if (!x) return ''; if (/^(data:|https?:|blob:)/.test(x)) return x; if (/^demo:/.test(x)) { var p = x.split(':'); return demoImg(p[1], p.slice(2).join(':')); } return x; }
function demoImg(kind, label) {
  var bg = { car: '#DCE3EA', ic: '#E7EEF7', licence: '#F3EBDD', slip: '#F4F6F8', receipt: '#FBF8F1', odo: '#1C1F25', paper: '#EEF3EE', summons: '#FDF3E7', doc: '#EFF1F4' }[kind] || '#E9ECF0';
  var fg = kind === 'odo' ? '#9BE59B' : '#4A5160';
  var body = kind === 'car' ? '<rect x="22" y="46" width="76" height="22" rx="8" fill="#9AA6B2"/><rect x="36" y="34" width="46" height="18" rx="6" fill="#B9C4CF"/><circle cx="40" cy="70" r="7" fill="#2B2F36"/><circle cx="80" cy="70" r="7" fill="#2B2F36"/>' :
    kind === 'ic' || kind === 'licence' ? '<rect x="12" y="20" width="96" height="58" rx="7" fill="#fff" stroke="#C9D2DC"/><rect x="20" y="30" width="26" height="32" rx="3" fill="#C9D2DC"/><path d="M54 34h44M54 44h36M54 54h40M20 68h78" stroke="#C9D2DC" stroke-width="4"/>' :
    kind === 'odo' ? '<text x="60" y="58" font-family="monospace" font-size="20" fill="#9BE59B" text-anchor="middle">' + esc(label || '045210') + '</text>' :
    '<rect x="30" y="14" width="60" height="72" rx="4" fill="#fff" stroke="#D3D8DE"/><path d="M38 28h44M38 38h34M38 48h40M38 58h28M38 72h44" stroke="#D3D8DE" stroke-width="4"/>';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><rect width="120" height="100" fill="' + bg + '"/>' + body + (kind !== 'odo' && label ? '<text x="60" y="95" font-family="sans-serif" font-size="9" fill="' + fg + '" text-anchor="middle">' + esc(label) + '</text>' : '') + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------------- statuses (stored names; 'Aggreement' only in exports) ---------------- */
var BK_STATUSES = ['Pending', 'Confirmed', 'Agreement Sent', 'Agreement Signed', 'Car Delivered', 'Car Returned', 'Completed', 'Cancelled'];
var PAY_STATUSES = ['Deposit Due', 'Deposit Received', 'Full Payment Received', 'Extension Due', 'Extension Paid', 'Refund Pending', 'Deposit Refunded'];
var EXPORT_STATUS = { 'Agreement Sent': 'Aggreement Sent', 'Agreement Signed': 'Aggreement Signed' };
/* fixed chip colours, never the brand colour */
var BK_TONE = { 'Pending': 'amber', 'Confirmed': 'grey', 'Agreement Sent': 'red', 'Agreement Signed': 'orange', 'Car Delivered': 'green', 'Car Returned': 'blue', 'Completed': 'grey', 'Cancelled': 'grey' };
var PAY_TONE = { 'Deposit Due': 'red', 'Deposit Received': 'amber', 'Full Payment Received': 'emerald', 'Extension Due': 'red', 'Extension Paid': 'green', 'Refund Pending': 'blue', 'Deposit Refunded': 'orange' };
var EARLY = ['Pending', 'Confirmed', 'Agreement Sent'];
var UPCOMING = ['Pending', 'Confirmed', 'Agreement Sent', 'Agreement Signed'];
function isLate(b) { return b.bookingStatus === 'Car Delivered' && new Date(b.end) < new Date(); }
function isMissedPickup(b) { return (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Agreement Signed' || b.bookingStatus === 'Agreement Sent') && new Date(b.start) < new Date(); }
function chip(text, tone, extra) { return '<span class="chip tone-' + (tone || 'grey') + '"' + (extra || '') + '>' + esc(text) + '</span>'; }
function statusChip(b) {
  if (isLate(b)) return chip('Late return', 'red');
  return chip(b.bookingStatus, BK_TONE[b.bookingStatus]);
}
function payChip(b) { return b.paymentStatus ? chip(b.paymentStatus, PAY_TONE[b.paymentStatus]) : ''; }
function liveStatus(b) { return isLate(b) ? 'Late return' : b.bookingStatus; }

/* ---------------- money for one booking (the company pricing rule) ---------------- */
var PAY_KINDS = ['Security deposit', 'Rental payment', 'Delivery charge', 'Return charge', 'Damage coverage', 'Extension payment', 'Other payment'];
var TOTAL_KINDS = ['Security deposit', 'Rental payment', 'Delivery charge', 'Return charge', 'Damage coverage']; /* count toward the booking total */
var RENT_LIKE = ['Rental payment', 'Delivery charge', 'Return charge', 'Damage coverage'];
var PAY_METHODS = ['Cash', 'Card', 'Online Transfer', 'Deposit adjustment'];
function activePays(b) { return (b.payments || []).filter(function (p) { return !p.voided; }); }
function paidOf(b, kinds) { kinds = [].concat(kinds); return activePays(b).reduce(function (s, p) { return s + (p.items || []).reduce(function (t, it) { return t + (kinds.indexOf(it.kind) >= 0 ? +it.amt || 0 : 0); }, 0); }, 0); }
function payTotal(p) { return (p.items || []).reduce(function (s, it) { return s + (+it.amt || 0); }, 0); }
/* rent: under 24 h = hourly x exact hours; else full days x daily + remaining exact hours x hourly; whole RM.
   cover: daily x days (under 24 h = 1, part days round up). payable = rent + deposit + cover + delivery + return + others - discount, whole RM. */
function calcBooking(b) {
  var r = b.rates || {}, secs = Math.max(0, (new Date(b.end) - new Date(b.start)) / 1000), hours = secs / 3600, days = 0, remHours = hours, rent;
  if (secs < 86400) rent = (+r.hourly || 0) * hours;
  else { days = Math.floor(secs / 86400); remHours = (secs % 86400) / 3600; rent = (+r.daily || 0) * days + (+r.hourly || 0) * remHours; }
  rent = Math.round(rent);
  var coverDays = secs < 86400 ? 1 : days + (secs % 86400 > 0 ? 1 : 0);
  var coverTotal = b.cover && +b.cover.daily ? Math.round(+b.cover.daily * coverDays) : 0;
  var deposit = +r.deposit || 0, delivery = +r.delivery || 0, ret = +r['return'] || 0, others = +r.others || 0, discount = +r.discount || 0;
  var payable = Math.round(rent + deposit + coverTotal + delivery + ret + others - discount);
  var received = paidOf(b, TOTAL_KINDS), extra = paidOf(b, ['Extension payment', 'Other payment']), depositReceived = paidOf(b, 'Security deposit');
  var gap = payable - received, due = gap > 0.99 ? gap : 0, overpaid = gap < -0.99 ? -gap : 0, settled = payable > 0 && due === 0;
  var tone = payable <= 0 ? 'blue' : settled ? (overpaid ? 'blue' : 'green') : received > 0 ? 'amber' : 'red';
  if (b.bookingStatus === 'Cancelled') tone = 'grey';
  return { hours: hours, days: days, remHours: remHours, coverDays: coverDays, rent: rent, coverTotal: coverTotal, deposit: deposit, delivery: delivery, 'return': ret, others: others, discount: discount,
    charges: payable - deposit, payable: payable, received: received, extra: extra, depositReceived: depositReceived, rentPaid: paidOf(b, 'Rental payment'),
    due: due, overpaid: overpaid, settled: settled, tone: tone, duration: durationText(b.start, b.end) };
}
/* old name: some screens still call priceOf; it returns calcBooking plus the old keys */
function priceOf(b) { var m = calcBooking(b); m.total = m.charges; m.balance = m.due; m.paid = m.received; m.depPaid = m.depositReceived; m.cover = m.coverTotal; return m; }
function moneyLine(b) { /* 'RM 680.00 due' / 'Paid' / 'RM 20.00 extra' as a small coloured span */
  if (b.bookingStatus === 'Cancelled') return '';
  var m = calcBooking(b);
  if (m.overpaid) return '<span class="bal extra money">' + rm(m.overpaid) + ' extra</span>';
  if (m.due) return '<span class="bal due money">' + rm(m.due) + ' due</span>';
  return '<span class="bal paid">Paid</span>';
}

/* ---------------- status rules ---------------- */
/* call after changing b.bookingStatus / b.submitted. prevStatus = the booking status before the change. Returns a list of what changed. */
function applyStatusRules(b, prevStatus) {
  var ch = [];
  if (b.submitted && !b.submittedAt) { b.submittedAt = new Date().toISOString(); ch.push('form signed'); }
  if (b.submitted && EARLY.indexOf(b.bookingStatus) >= 0) {
    b.bookingStatus = 'Agreement Signed'; ch.push('status to Agreement Signed');
    if (['Deposit Received', 'Full Payment Received', 'Refund Pending', 'Deposit Refunded'].indexOf(b.paymentStatus) < 0) {
      var moved = activePays(b).length ? nextPaymentStatus(b, [].concat.apply([], activePays(b).map(function (p) { return p.items || []; })), '') : null;
      b.paymentStatus = moved || 'Deposit Due'; ch.push('payment status to ' + b.paymentStatus);
    }
  }
  if (b.bookingStatus === 'Car Returned' && prevStatus !== 'Car Returned' && b.paymentStatus !== 'Deposit Refunded') {
    if ((+(b.rates || {}).deposit || 0) <= 0) b.paymentStatus = 'Deposit Refunded';
    else { b.paymentStatus = 'Refund Pending'; b.refundPendingAt = b.refundPendingAt || new Date().toISOString(); }
    ch.push('payment status to ' + b.paymentStatus);
  }
  if (b.bookingStatus === 'Agreement Signed' && prevStatus !== 'Agreement Signed') ON_SIGNED.forEach(function (fn) { try { fn(b); } catch (e) { console.error(e); } });
  return ch;
}
/* modules push function (booking) here; runs when a booking becomes Agreement Signed (tasks.js auto-assign) */
var ON_SIGNED = [];
/* the one way to change a booking status from a screen: logs, applies the rules, saves */
function setBookingStatus(b, status, opts) {
  opts = opts || {}; var prev = b.bookingStatus; if (prev === status) return [];
  b.bookingStatus = status;
  var ch = applyStatusRules(b, prev);
  bLog(b, (opts.text || 'Status changed from ' + prev + ' to ' + b.bookingStatus) + (ch.length ? ' (' + ch.join(', ') + ')' : ''), { bookingStatus: [prev, b.bookingStatus] });
  save(); return ch;
}
function setPaymentStatus(b, status, why) {
  var prev = b.paymentStatus || null; if (prev === status) return;
  b.paymentStatus = status || null; bLog(b, 'Payment status changed from ' + (prev || 'None') + ' to ' + (status || 'None') + (why ? ' (' + why + ')' : ''), { paymentStatus: [prev, status || null] }); save();
}
/* the payment status after recording these items (the payment must already be in b.payments). Moves forward only. Returns the new status, or null to leave it. */
function nextPaymentStatus(b, items, fromStatus) {
  var m = calcBooking(b), coversTotal = m.payable <= 0 || m.received >= m.payable - 0.99, coversDeposit = m.deposit <= 0 || m.depositReceived >= m.deposit;
  var cur = fromStatus !== undefined ? (fromStatus || '') : (b.paymentStatus || ''), start = cur, unset = ['', 'Deposit Due'];
  (items || []).forEach(function (it) {
    var k = it.kind, t = null;
    if (k === 'Security deposit' && unset.indexOf(cur) >= 0 && coversDeposit) t = 'Deposit Received';
    else if (RENT_LIKE.indexOf(k) >= 0 && coversTotal && unset.concat(['Deposit Received']).indexOf(cur) >= 0) t = 'Full Payment Received';
    else if (k === 'Extension payment' && unset.concat(['Deposit Received', 'Full Payment Received', 'Extension Due']).indexOf(cur) >= 0) t = 'Extension Paid';
    if (t) cur = t;
  });
  return cur !== start ? cur : null;
}
/* after voiding a deposit payment: 'Deposit Received' goes back to 'Deposit Due' when the deposit recorded is no longer whole. Returns the new status or null. */
function depositDueAfterVoid(b) {
  var m = calcBooking(b);
  if (b.paymentStatus !== 'Deposit Received' || m.deposit <= 0 || m.depositReceived >= m.deposit) return null;
  setPaymentStatus(b, 'Deposit Due', 'a deposit payment was voided'); return 'Deposit Due';
}
/* Deposit Refunded can be picked by hand only for bookings that end before the lock date; after it, only recording the refund (deposits.js) sets it */
function canPickRefunded(b) { if (b.paymentStatus === 'Deposit Refunded') return true; return new Date(b.end) < new Date((B().depositRefundLockFrom || '2026-11-01') + 'T00:00:00'); }

/* ---------------- availability: the one rule ---------------- */
var TURNAROUND_H = 3;
function blocksCar(b) { return b.bookingStatus !== 'Completed' && b.bookingStatus !== 'Cancelled'; }
/* { free, reason, soon, booking, downtime }. Touching periods do not clash. */
function busy(carId, start, end, exceptId) {
  var s = new Date(start).getTime(), e = new Date(end).getTime(), c = car(carId), out = { free: true, reason: '', soon: '' };
  if (!c) return { free: false, reason: 'Car not found' };
  if (c.status === 'sold') return { free: false, reason: 'Sold' };
  if (c.status === 'inactive') return { free: false, reason: 'Not in use' };
  var hit = null;
  S.bookings.forEach(function (b) { if (hit || b.car !== carId || b.id === exceptId || !blocksCar(b)) return; if (new Date(b.start).getTime() < e && new Date(b.end).getTime() > s) hit = b; });
  if (hit) return { free: false, reason: 'Booked: ' + hit.code + ' until ' + dShort(hit.end), booking: hit };
  var dt = null;
  (S.downtime || []).forEach(function (d) { if (dt || d.car !== carId) return; var f = new Date(d.from).getTime(), t = d.to ? new Date(d.to).getTime() : Infinity; if (f < e && t > s) dt = d; });
  if (dt) return { free: false, reason: dt.to ? 'Workshop until ' + dShort(dt.to) : 'Workshop, no return date yet', downtime: dt };
  var gap = TURNAROUND_H * HOUR;
  S.bookings.forEach(function (b) {
    if (out.soon || b.car !== carId || b.id === exceptId || b.bookingStatus === 'Cancelled') return;
    var be = new Date(b.end).getTime(), bs = new Date(b.start).getTime();
    if (be <= s && s - be < gap) { var h = Math.max(1, Math.round((s - be) / HOUR)); out.soon = 'Returned at ' + hm(be) + ', ' + (s === be ? 'right at the start' : h + ' hr' + (h > 1 ? 's' : '') + ' before'); out.booking = b; }
    else if (bs >= e && bs - e < gap) { var h2 = Math.max(1, Math.round((bs - e) / HOUR)); out.soon = 'Next rental at ' + hm(bs) + ', ' + (bs === e ? 'right at the end' : h2 + ' hr' + (h2 > 1 ? 's' : '') + ' after'); out.booking = b; }
  });
  return out;
}
function isFree(carId, start, end, exceptId) { return busy(carId, start, end, exceptId).free; }
function carNow(carId) { /* the booking the car is on now, or null */
  var n = Date.now(); return S.bookings.filter(function (b) { return b.car === carId && (b.bookingStatus === 'Car Delivered' || (blocksCar(b) && new Date(b.start) <= n && new Date(b.end) > n)); })[0] || null;
}
function carPaper(carId, type) { /* latest paper of a type ('Road tax', 'Insurance', 'PUSPAKOM', 'Grant', 'Permit') */
  return (S.papers || []).filter(function (p) { return p.car === carId && p.type === type; }).sort(function (a, b) { return new Date(b.until) - new Date(a.until); })[0] || null;
}
function daysUntil(d) { return Math.ceil((sod(d) - sod(new Date())) / DAY); }

/* ---------------- places (from company settings) ---------------- */
/* a booking end: kind 'our' (loc = location id), 'client' (address in the note), 'place' (loc = place id) */
function placeText(b, end) {
  var k = end === 'ret' ? b.retKind : b.pickKind, id = end === 'ret' ? b.retLoc : b.pickLoc, note = end === 'ret' ? b.retNote : b.pickNote;
  if (k === 'our') { var l = loc(id); return l ? l.name : 'Our location'; }
  if (k === 'place') { var p = place(id); return p ? p.name : 'Other place'; }
  if (k === 'client') return note ? note : (end === 'ret' ? 'Collect from client' : 'Delivery to client');
  return 'Not chosen';
}
function placeKindText(b, end) { /* 'Pick-up · Cheras', 'Delivery · Client', 'Delivery · KL Sentral', 'Return · ...' */
  var out = end === 'ret', k = out ? b.retKind : b.pickKind, id = out ? b.retLoc : b.pickLoc;
  if (k === 'our') { var l = loc(id); return (out ? 'Drop-off' : 'Pick-up') + ' · ' + (l ? l.short || l.name : 'Our location'); }
  if (k === 'place') { var p = place(id); return (out ? 'Return' : 'Delivery') + ' · ' + (p ? p.name : 'Place'); }
  if (k === 'client') return (out ? 'Return' : 'Delivery') + ' · Client';
  return out ? 'Return' : 'Pick-up';
}
function placeFee(kind, id, end) { /* the delivery (end 'pick') or return (end 'ret') charge for a place choice */
  var s = B();
  if (kind === 'client') return end === 'ret' ? +s.clientReturnFee || 0 : +s.clientDeliveryFee || 0;
  if (kind === 'place') { var p = place(id); return p ? (end === 'ret' ? +p.returnFee || 0 : +p.deliveryFee || 0) : 0; }
  return 0;
}
/* every choice for a select: [{v:'our:L1', kind, id, label, fee}] */
function placeChoices(end) {
  var s = B(), out = [];
  (s.locations || []).forEach(function (l) { if (end === 'ret' ? l.dropoff : l.pickup) out.push({ v: 'our:' + l.id, kind: 'our', id: l.id, label: (end === 'ret' ? 'Drop-off at our location, ' : 'Pick-up from our location, ') + l.name, fee: 0 }); });
  out.push({ v: 'client', kind: 'client', id: null, label: end === 'ret' ? 'Collect from client location' : 'Delivery to client location', fee: placeFee('client', null, end) });
  (s.places || []).forEach(function (p) { out.push({ v: 'place:' + p.id, kind: 'place', id: p.id, label: (end === 'ret' ? 'Return from ' : 'Delivery to ') + p.name, fee: placeFee('place', p.id, end) }); });
  return out;
}

/* ---------------- people and permissions ---------------- */
var CODES = {
  'bookings.view': 'See bookings', 'bookings.create': 'Make bookings', 'bookings.edit': 'Change bookings', 'bookings.edit_amounts': 'Edit amounts', 'bookings.see_amounts': 'See amounts',
  'bookings.see_revenue': 'See revenue', 'bookings.change_status': 'Change booking status', 'bookings.delete': 'Delete bookings', 'bookings.export': 'Export bookings', 'bookings.view_documents': 'Booking documents',
  'billing.view': 'Invoices and payments', 'billing.record_payment': 'Record payments', 'billing.void': 'Void payments', 'billing.issue_invoice': 'Make invoices', 'billing.issue_receipt': 'Make receipts',
  'billing.send': 'Send invoices', 'billing.manage_cash': 'Manage cash and bank-ins', 'billing.settings': 'Billing settings',
  'deposits.view': 'Deposits', 'deposits.edit_deductions': 'Deposit adjustments', 'deposits.refund': 'Return deposits', 'deposits.reopen': 'Reopen deposits', 'deposits.send': 'Send deposit statements',
  'customers.view': 'Customers', 'customers.edit': 'Edit customers', 'customers.view_documents': 'Customer documents', 'customers.check_ic': 'IC checks', 'customers.blacklist_view': 'See the blacklist', 'customers.blacklist_edit': 'Edit the blacklist',
  'customer_notes.view': 'Customer notes', 'customer_notes.add': 'Add customer notes', 'customer_notes.edit': 'Edit customer notes', 'customer_notes.delete': 'Delete customer notes',
  'cars.view': 'Cars', 'cars.create': 'Add cars', 'cars.edit': 'Edit cars', 'cars.delete': 'Delete cars', 'cars.manage_gallery': 'Car photos', 'cars.see_owner_details': 'Car owner details', 'cars.see_instalment': 'Instalments',
  'maintenance.view': 'Maintenance', 'maintenance.create': 'Log services', 'maintenance.edit': 'Edit services', 'maintenance.delete': 'Delete services', 'maintenance.see_costs': 'Maintenance costs',
  'maintenance.manage_downtime': 'Workshop blocks', 'maintenance.manage_documents': 'Car papers',
  'summons.view': 'Summons', 'summons.upload': 'Add summons', 'summons.charge': 'Charge summons', 'summons.record_payment': 'Record summons payments', 'summons.waive': 'Waive summons',
  'tracking.view': 'Where cars are', 'tracking.alarms': 'Tracker alarms',
  'expenses.view': 'Expenses', 'expenses.view_all': 'Everyone’s expenses', 'expenses.add': 'Add expenses', 'expenses.add_business': 'Business expenses', 'expenses.edit_own': 'Edit my expenses',
  'expenses.edit_all': 'Edit all expenses', 'expenses.staff_reports_all': 'Everyone’s money', 'expenses.manage_categories': 'Expense kinds',
  'reports.view': 'Reports', 'reports.see_amounts': 'Report amounts', 'reports.export_excel': 'Export reports',
  'tasks.view': 'Tasks', 'tasks.create': 'Make tasks', 'tasks.edit': 'Edit tasks', 'tasks.assign': 'Assign tasks', 'tasks.delete': 'Delete tasks', 'tasks.send_whatsapp': 'Send tasks on WhatsApp',
  'users.view': 'Team', 'users.create': 'Add people', 'users.edit': 'Edit people', 'users.deactivate': 'Switch logins off', 'users.reset_password': 'Reset passwords',
  'users.manage_roles': 'Roles', 'users.view_audit': 'Activity', 'users.manage': 'Settings',
  'employees.view': 'Field agents', 'employees.view_documents': 'Staff documents',
  'leads.view': 'Leads', 'leads.manage': 'Handle leads', 'leads.settings': 'Assistant settings'
};
var ROLES = {
  owner: { name: 'Owner', codes: ['*'] },
  manager: { name: 'Manager', codes: ['bookings.*', 'billing.*', 'deposits.*', 'customers.*', 'customer_notes.*', 'cars.*', 'maintenance.*', 'summons.*', 'tracking.*', 'expenses.view', 'expenses.view_all', 'expenses.add', 'expenses.add_business', 'expenses.edit_own', 'expenses.staff_reports_all', 'reports.*', 'tasks.*', 'leads.*', 'users.view', 'users.view_audit', 'employees.view'] },
  frontdesk: { name: 'Front desk', codes: ['bookings.view', 'bookings.create', 'bookings.edit', 'bookings.see_amounts', 'bookings.edit_amounts', 'bookings.change_status', 'bookings.view_documents', 'billing.view', 'billing.record_payment', 'billing.issue_receipt', 'billing.issue_invoice', 'billing.send', 'deposits.view', 'customers.view', 'customers.edit', 'customers.view_documents', 'customers.check_ic', 'customers.blacklist_view', 'customer_notes.view', 'customer_notes.add', 'cars.view', 'maintenance.view', 'summons.view', 'tracking.view', 'expenses.view', 'expenses.add', 'expenses.edit_own', 'tasks.view', 'tasks.create', 'tasks.assign', 'leads.view', 'leads.manage', 'users.view'] },
  fleet: { name: 'Fleet', codes: ['bookings.view', 'cars.*', 'maintenance.*', 'summons.view', 'summons.upload', 'tracking.*', 'expenses.view', 'expenses.add', 'expenses.edit_own', 'tasks.view', 'tasks.create', 'customers.view'] },
  agent: { name: 'Driver / Agent', codes: ['bookings.view', 'customers.view', 'cars.view', 'tasks.view', 'expenses.view', 'expenses.add', 'expenses.edit_own', 'tracking.view'] },
  accountant: { name: 'Accountant', codes: ['bookings.view', 'bookings.see_amounts', 'bookings.see_revenue', 'bookings.export', 'billing.*', 'deposits.*', 'expenses.*', 'reports.*', 'customers.view', 'cars.view', 'cars.see_instalment', 'maintenance.view', 'maintenance.see_costs', 'summons.view', 'summons.record_payment', 'users.view'] },
  readonly: { name: 'Read-only', codes: ['bookings.view', 'customers.view', 'cars.view', 'maintenance.view', 'summons.view', 'tasks.view', 'reports.view'] }
};
function roleName(id) { return (ROLES[id] || { name: id || 'No role' }).name; }
function codesOf(p) { if (!p) return []; return p.codes && p.codes.length ? p.codes : (ROLES[p.role] || { codes: [] }).codes; }
function canP(p, code) { var cs = codesOf(p); if (cs.indexOf('*') >= 0 || cs.indexOf(code) >= 0) return true; var area = String(code).split('.')[0]; return cs.indexOf(area + '.*') >= 0; }
function can(code) { if (!S || !S.me) return false; return canP(me(), code); }
function noAccess(code) { return '<div class="empty noaccess">' + I('lock') + '<div>Ask the owner for <b>' + esc(CODES[code] || code) + '</b> access</div></div>'; }
function openTasksOf(staffId) { return (S.tasks || []).filter(function (t) { return (t.staff || []).indexOf(staffId) >= 0 && (t.status === 'Pending' || t.status === 'In Progress'); }).length; }

/* per-person preferences: S.prefs is the signed-in person's object inside S.prefsBy */
var PREF_DEFAULTS = { new: true, change: true, staff: true, wa: true, pay: true, due: true, job: true, tomorrow: true, lead: true, service: true, alarm: true, startTab: 'home' };
function usePrefs(d) { d = d || S; if (!d) return; d.prefsBy = d.prefsBy || {}; var k = d.me || 'guest'; d.prefsBy[k] = Object.assign({}, PREF_DEFAULTS, d.prefsBy[k] || {}); d.prefs = d.prefsBy[k]; }

/* ---------------- logs and activity ---------------- */
function bLog(b, text, changes) { b.log = b.log || []; b.log.push({ at: new Date().toISOString(), by: S.me, text: text, changes: changes || null }); audit(text, { booking: b.id, changes: changes }); }
function logIt(b, text) { bLog(b, text); } /* old name */
/* S.audit: what people did outside a booking log too. opts: {booking, cust, car, changes, link} */
function audit(text, opts) { opts = opts || {}; S.audit = S.audit || []; S.audit.unshift({ id: uid(), at: new Date().toISOString(), by: S.me, text: text, booking: opts.booking || null, cust: opts.cust || null, car: opts.car || null, changes: opts.changes || null, link: opts.link || (opts.booking ? '#booking/' + opts.booking : null) }); if (S.audit.length > 400) S.audit.length = 400; }

/* ---------------- brand theme ---------------- */
function applyTheme() {
  var b = B(), r = document.documentElement.style, brand = b.primary, h = C.hue(brand), sat = C.sat(brand);
  /* a red or amber brand would look like a warning: use the dark brand colour for accents, keep red for money due and late */
  var nearDanger = sat > .35 && h >= 0 && (Math.min(Math.abs(h - 0), Math.abs(h - 360)) <= 25 || Math.abs(h - 38) <= 25);
  if (nearDanger) brand = b.dark;
  var ink = C.readable(brand);
  r.setProperty('--brand', brand); r.setProperty('--brand-ink', ink); r.setProperty('--dark', b.dark); r.setProperty('--accent', b.accent);
  r.setProperty('--on-brand', C.contrast(brand, '#ffffff') >= 3 ? '#fff' : '#111');
  r.setProperty('--tint', C.mix(brand, '#ffffff', nearDanger ? .9 : .89));
  document.documentElement.classList.toggle('brand-dark-accent', nearDanger);
  var tc = $('#themeColor'); if (tc) tc.content = '#F4F5F7';
}

/* ---------------- notifications ---------------- */
var KINDS = {
  new: { label: 'New bookings', desc: 'Someone books on the website, WhatsApp or by staff', icon: 'plus' },
  change: { label: 'Booking changes', desc: 'Dates, car, place or status change, or a cancellation', icon: 'edit' },
  staff: { label: 'Staff chat', desc: 'New messages in the team chat', icon: 'users' },
  wa: { label: 'Customer chat (WhatsApp)', desc: 'Customers writing to the booking assistant', icon: 'wa' },
  pay: { label: 'Payments', desc: 'Money recorded or a transfer slip received', icon: 'cash' },
  due: { label: 'Handovers due', desc: 'Pick-ups and returns in the next hour, late returns', icon: 'clock' },
  job: { label: 'My job in 30 minutes', desc: 'A pick-up, return or task given to you starts soon', icon: 'key' },
  tomorrow: { label: 'Tomorrow\u2019s schedule', desc: 'An evening summary of what goes out and comes back tomorrow', icon: 'cal' },
  lead: { label: 'New lead waiting', desc: 'A customer on WhatsApp is ready for a person to take over', icon: 'bot' },
  service: { label: 'Service or paper due', desc: 'A service, road tax, insurance or inspection is due soon', icon: 'wrench' },
  alarm: { label: 'Tracker alarm', desc: 'A car tracker reports a power cut, tow or a move without a booking', icon: 'warn' }
};
/* opts: {self:true} for your own action (no toast, no inbox; a small say() snackbar), {silentToast:true} */
function notify(kind, title, body, link, opts) {
  opts = opts || {};
  if (opts.self) { say(title); return; }
  var n = { id: uid(), kind: kind, title: title, body: body, at: new Date().toISOString(), read: false, link: link || '' };
  S.notifs.unshift(n); S.notifs = S.notifs.slice(0, 60); save();
  if (S.prefs && S.prefs[kind] === false) { refreshBadges(); return; }
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
/* toasts and snackbars sit at the bottom, above the nav / sticky bar / composer; one at a time; swipe to dismiss */
function placeToasts() {
  var box = $('#toasts'); if (!box) return; var off = 10;
  ['.nav', '.stickybar', '.composer'].forEach(function (s) { var el = $(s); if (el && el.getClientRects().length) off = Math.max(off, el.getBoundingClientRect().height + 10); });
  /* with a sheet open: the toast must not cover its heading or its buttons.
     A short sheet leaves the top of the screen free, so the toast goes there.
     A tall or full-height sheet: the toast sits just above its footer (or near the bottom when it has none). */
  if (SHEETS.length) {
    var sh = SHEETS[SHEETS.length - 1].sh, r = sh.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top > 90 && !sh.classList.contains('full')) { box.style.bottom = 'auto'; box.style.top = 'calc(var(--safe-t) + 10px)'; return; }
    var foot = sh.querySelector('.sheet-foot'), fb = 10;
    if (foot && foot.getClientRects().length) { var fr = foot.getBoundingClientRect(); if (fr.top < vh && fr.bottom > 0) fb = Math.max(10, vh - fr.top + 8); }
    else fb = Math.max(10, vh - Math.min(vh, r.bottom) + 10);
    box.style.top = 'auto'; box.style.bottom = fb + 'px'; return;
  }
  box.style.top = 'auto'; box.style.bottom = off + 'px';
}
function _showToastEl(el, ms) {
  var box = $('#toasts'); if (!box) return function () {};
  $$('.toast', box).forEach(function (x) { x.remove(); });
  placeToasts(); box.appendChild(el);
  requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); }); });
  var gone = false, hide = function () { if (gone) return; gone = true; el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); };
  var x0 = null, y0 = null;
  el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', function (e) { if (x0 == null) return; var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0; el.style.transition = 'none'; el.style.transform = Math.abs(dx) > Math.abs(dy) ? 'translateX(' + dx + 'px)' : 'translateY(' + Math.max(0, dy) + 'px)'; el.style.opacity = String(1 - Math.min(.8, Math.max(Math.abs(dx), dy) / 200)); }, { passive: true });
  el.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; el.style.transition = ''; if (Math.abs(dx) > 70 || dy > 40) { el.dataset.swiped = '1'; el.style.transform = Math.abs(dx) > 70 ? 'translateX(' + (dx > 0 ? 120 : -120) + '%)' : 'translateY(120%)'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 250); gone = true; } else { el.style.transform = ''; el.style.opacity = ''; } });
  if (ms) setTimeout(hide, ms);
  return hide;
}
function toast(n) {
  var el = document.createElement('button');
  el.className = 'toast'; el.type = 'button';
  el.innerHTML = '<div class="ic">' + MARKS[CO] + '</div><div style="min-width:0;flex:1"><b>' + esc(n.title) + '</b><span>' + esc(n.body) + '</span></div>';
  var hide = _showToastEl(el, 4800);
  el.onclick = function () { if (el.dataset.swiped) return; n.read = true; save(); hide(); if (n.link) location.hash = n.link; else refreshBadges(); };
  if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
}
function say(msg) { var el = document.createElement('div'); el.className = 'toast plain'; el.setAttribute('role', 'status'); el.textContent = msg; _showToastEl(el, 2600); }
/* a snackbar with an Undo button; undoFn runs when tapped within ms (default 6 s) */
function undoSnack(text, undoFn, ms) {
  var el = document.createElement('div'); el.className = 'toast plain snack'; el.setAttribute('role', 'status');
  el.innerHTML = '<span class="st">' + esc(text) + '</span><button type="button" class="undo">Undo</button>';
  var hide = _showToastEl(el, ms || 6000);
  $('.undo', el).onclick = function () { hide(); try { undoFn && undoFn(); } catch (e) { console.error(e); } };
  return hide;
}
function unreadCount() { return S.notifs.filter(function (n) { return !n.read; }).length; }
function chatUnread() { return S.wa.reduce(function (s, c) { return s + (c.unread || 0); }, 0) + (S.staffUnread || 0); }
function refreshBadges() {
  var u = unreadCount(), bell = $('#bellDot'); if (bell) { bell.textContent = u; bell.style.display = u ? '' : 'none'; }
  var cu = chatUnread(), cd = $('#chatDot'); if (cd) { cd.textContent = cu; cd.style.display = cu ? '' : 'none'; }
}
/* timers that belong to a company: dropped when the company switches or the demo resets */
function later(fn, ms) { var co = CO, gen = GEN; return setTimeout(function () { if (CO === co && GEN === gen && S) fn(); }, ms); }
/* modules push a function that clears their view state (search text, filters, drafts held in memory) */
var VIEW_STATE = [];
function resetViewState() { GEN++; VIEW_STATE.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

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
  }).then(function (s) { PUSH.sub = s || null; if (S && route().name === 'notifs') render(); }).catch(function () {});
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
/* '#booking/abc' -> {name:'booking', a:'abc'}; '#new?car=car3&start=...' -> {name:'new', q:{car:'car3', start:'...'}} */
function route() {
  var raw = (location.hash || '#home').slice(1), qi = raw.indexOf('?'), path = qi >= 0 ? raw.slice(0, qi) : raw, qs = qi >= 0 ? raw.slice(qi + 1) : '', q = {};
  qs.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); try { q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); } catch (e) { q[p[0]] = p[1] || ''; } });
  var h = path.split('/');
  return { name: h[0] || 'home', a: h[1], b: h[2], q: q, path: path };
}
function hashWith(name, q) { var ks = Object.keys(q || {}).filter(function (k) { return q[k] != null && q[k] !== ''; }); return '#' + name + (ks.length ? '?' + ks.map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&') : ''); }
/* change the hash without adding a Back step (after saving, so Back does not reopen a finished form) */
function replaceHash(h) { history.replaceState(history.state, '', location.pathname + location.search + h); render(true); }
var TAB_OF = { home: 'home', inbox: 'home', bookings: 'bookings', booking: 'bookings', availability: 'bookings', calendar: 'bookings', new: 'new', chat: 'chat',
  more: 'more', schedules: 'more', schedule: 'more', tasks: 'more', task: 'more', cars: 'more', car: 'more', carinfo: 'more', customers: 'more', customer: 'more',
  money: 'more', mymoney: 'more', deposits: 'more', deposit: 'more', cash: 'more', invoices: 'more', instalments: 'more', expenses: 'more', expense: 'more', reports: 'more',
  maintenance: 'more', summons: 'more', tracking: 'more', team: 'more', person: 'more', settings: 'more', activity: 'more', leads: 'chat', notifs: 'more', company: 'more', install: 'more', slip: 'home' };
window.addEventListener('hashchange', function () { closeAllSheets(); render(true); });
window.addEventListener('scroll', function () { var t = $('.top'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });

function topbar(title, opts) {
  opts = opts || {};
  var left = opts.back ? '<button class="iconbtn back" onclick="goBack(\'' + opts.back + '\')" aria-label="Back">' + I('back', 2.2) + '</button>' : '<div class="mark">' + MARKS[CO] + '</div>';
  return '<header class="top"><div class="top-in">' + left + '<h1>' + esc(title) + (opts.sub ? '<span class="sub">' + esc(opts.sub) + '</span>' : '') + '</h1>' + (opts.right || '') +
    (opts.noBell ? '' : '<a class="iconbtn" href="#inbox" aria-label="Notifications">' + I('bell') + '<span class="dot" id="bellDot" style="display:none"></span></a>') + '</div></header>';
}
function goBack(fallback) { if (history.length > 1 && window.__nav > 0) { window.__nav -= 2; history.back(); } else location.hash = fallback; }
window.__nav = 0;
window.addEventListener('hashchange', function () { window.__nav++; });
function nav(active) {
  var it = function (k, href, icon, label, extra) { return '<a href="' + href + '" class="' + (active === k ? 'on' : '') + '">' + I(icon, active === k ? 2.2 : 1.9) + label + (extra || '') + '</a>'; };
  return '<nav class="nav"><div class="nav-in">' + it('home', '#home', 'home', 'Home') + it('bookings', '#bookings', 'list', 'Bookings') +
    '<a href="#new" aria-label="New booking"><span class="plus">' + I('plus', 2.4) + '</span></a>' +
    it('chat', '#chat', 'chat', 'Chat', '<span class="dot" id="chatDot" style="display:none"></span>') + it('more', '#more', 'grid', 'More') + '</div></nav>';
}

/* a screen: VIEWS.name = function (r) { return { html, after?, noNav?, keepScroll? }; } */
var VIEWS = {};
/* used by stub modules: registers a 'Coming soon' screen only when no screen has that name yet */
function stubView(name, title, back) {
  if (VIEWS[name]) return;
  VIEWS[name] = function () { return { html: topbar(title, { back: back || '#more' }) + '<main><div class="empty soon">' + I('clock') + '<div><b>' + esc(title) + '</b><br>Coming soon</div></div></main>' }; };
}
function comingSoon(what) { say((what ? what + ': ' : '') + 'coming soon'); }
function render(nav_) {
  if (!S) return;
  var r = route(), v = VIEWS[r.name] || VIEWS.home, out;
  try { out = v(r); } catch (e) { console.error(e); out = { html: topbar('Something went wrong', { back: '#home' }) + '<main><div class="empty">This screen could not open. ' + esc(e.message) + '</div></main>' }; }
  out = out || { html: '' };
  var withNav = !out.noNav;
  $('#app').innerHTML = out.html + (withNav ? nav(TAB_OF[r.name]) : '');
  var m = $('main'); if (m) { m.classList.toggle('no-nav', !withNav); if (nav_) m.classList.add('fade-in'); }
  if (out.after) out.after();
  refreshBadges(); placeToasts();
  if (nav_ && !out.keepScroll) window.scrollTo(0, 0);
}
var _render = render;
render = function (navd, keep) { var y = window.scrollY; _render(navd); if (keep) window.scrollTo(0, y); };

/* ---------------- sheets (bottom sheets with Back-button support) ---------------- */
/* sheet(html, after?, opts?) or sheet(html, opts). opts: {stack:true (open over the current sheet), full:true (full height), cls, onClose, noSwipe}.
   Opening pushes a history step, so the phone's Back button closes the top sheet first. Put the main button in <div class="sheet-foot"> so it stays at the bottom. */
var SHEETS = [], _sheetSeq = 0, _ignorePop = 0;
function sheet(html, after, opts) {
  if (after && typeof after === 'object') { opts = after; after = opts.after; }
  opts = opts || {};
  var replacing = !opts.stack && SHEETS.length > 0, oldTopId = replacing ? SHEETS[SHEETS.length - 1].id : null;
  if (replacing) _dropSheets(SHEETS.length, true);
  var id = 'sh' + (++_sheetSeq), z = 50 + SHEETS.length * 2;
  var sc = document.createElement('div'); sc.className = 'scrim'; sc.style.zIndex = z; sc.onclick = function () { closeSheet(); };
  var sh = document.createElement('div'); sh.className = 'sheet' + (opts.full ? ' full' : '') + (opts.cls ? ' ' + opts.cls : ''); sh.style.zIndex = z + 1; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = '<div class="grab"></div>' + html;
  SHEETS.forEach(function (s) { s.sh.removeAttribute('id'); s.sc.removeAttribute('id'); });
  sh.id = 'sheet'; sc.id = 'scrim';
  document.body.appendChild(sc); document.body.appendChild(sh);
  var rec = { id: id, sh: sh, sc: sc, onClose: opts.onClose };
  SHEETS.push(rec);
  try { if (replacing && history.state && history.state.fmsSheet === oldTopId) history.replaceState({ fmsSheet: id }, '', location.href); else history.pushState({ fmsSheet: id }, '', location.href); } catch (e) {}
  requestAnimationFrame(function () { requestAnimationFrame(function () { sc.classList.add('show'); sh.classList.add('show'); }); });
  fitSheets(); placeToasts();
  if (after) after(sh);
  if (!opts.noSwipe) {
    /* swipe down to close, from the top of the sheet */
    var y0 = null; sh.addEventListener('touchstart', function (e) { var t = e.target; if (sh.scrollTop > 0 || (t.closest && t.closest('input,textarea,select,.noswipe'))) return; y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)'; } }, { passive: true });
    sh.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; sh.style.transition = ''; sh.style.transform = ''; y0 = null; if (dy > 90) closeSheet(); });
  }
  return sh;
}
function _removeSheetEl(rec, now) {
  var sc = rec.sc, sh = rec.sh;
  if (now) { sc.remove(); sh.remove(); } else { sc.classList.remove('show'); sh.classList.remove('show'); setTimeout(function () { sc.remove(); sh.remove(); }, 280); }
  if (rec.onClose) { try { rec.onClose(); } catch (e) { console.error(e); } }
}
function _dropSheets(n, now) { while (n-- > 0 && SHEETS.length) _removeSheetEl(SHEETS.pop(), now); var top = SHEETS[SHEETS.length - 1]; if (top) { top.sh.id = 'sheet'; top.sc.id = 'scrim'; } placeToasts(); }
/* close the top sheet (now = no animation). Its history step is taken back too. */
function closeSheet(now) {
  if (!SHEETS.length) return;
  var rec = SHEETS[SHEETS.length - 1];
  _dropSheets(1, now);
  setTimeout(function () { if (history.state && history.state.fmsSheet === rec.id) { _ignorePop++; history.back(); } }, 0);
}
function closeAllSheets() { _dropSheets(SHEETS.length, true); }
window.addEventListener('popstate', function (e) {
  if (_ignorePop > 0) { _ignorePop--; return; }
  var st = e.state && e.state.fmsSheet, idx = -1;
  for (var i = 0; i < SHEETS.length; i++) if (SHEETS[i].id === st) idx = i;
  if (SHEETS.length) { _dropSheets(SHEETS.length - (idx + 1), false); if (st && idx < 0) history.back(); return; }
  if (st) history.back(); /* a step left by a sheet that is already closed: skip it */
});
function fitSheets() {
  var vv = window.visualViewport; if (!vv) return;
  var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  SHEETS.forEach(function (s) { s.sh.style.bottom = kb + 'px'; s.sh.style.maxHeight = (vv.height - (s.sh.classList.contains('full') ? 0 : 24)) + 'px'; if (s.sh.classList.contains('full')) s.sh.style.height = vv.height + 'px'; });
}
if (window.visualViewport) { window.visualViewport.addEventListener('resize', fitSheets); window.visualViewport.addEventListener('scroll', fitSheets); }
function segPick(sel, cb) { $$(sel + ' button').forEach(function (b) { b.onclick = function () { $$(sel + ' button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); if (cb) cb(b.textContent, b); }; }); }
/* a sheet header row with a title and a close button */
function sheetHead(title, sub) { return '<div class="sheet-head"><div class="grow"><h3>' + esc(title) + '</h3>' + (sub ? '<p class="lead">' + esc(sub) + '</p>' : '') + '</div><button class="iconbtn" type="button" onclick="closeSheet()" aria-label="Close">' + I('x', 2.2) + '</button></div>'; }

/* confirm({title, text, html, ok, cancel, primary:'ok'|'cancel', danger, icon:'warn'|'info'|'danger', onOk, onCancel}) -> Promise<boolean>.
   The big button is the primary one (default 'ok'); the second is small. Replaces window.confirm on purpose. */
function confirm(opts) {
  if (typeof opts === 'string') opts = { text: opts };
  opts = opts || {};
  return new Promise(function (resolve) {
    var done = false, finish = function (v) { if (done) return; done = true; resolve(v); try { (v ? opts.onOk : opts.onCancel) && (v ? opts.onOk : opts.onCancel)(); } catch (e) { console.error(e); } };
    var okT = opts.ok || 'Yes', noT = opts.cancel || 'Cancel', okBig = opts.primary !== 'cancel';
    var big = okBig ? '<button type="button" class="btn ' + (opts.danger ? 'danger solid' : '') + '" data-v="1">' + esc(okT) + '</button>' : '<button type="button" class="btn" data-v="0">' + esc(noT) + '</button>';
    var small = okBig ? '<button type="button" class="btn link" data-v="0">' + esc(noT) + '</button>' : '<button type="button" class="btn link ' + (opts.danger ? 'red' : '') + '" data-v="1">' + esc(okT) + '</button>';
    var ic = opts.icon ? '<div class="confirm-ic ' + opts.icon + '">' + I(opts.icon === 'info' ? 'info' : 'warn', 2) + '</div>' : '';
    sheet('<div class="confirm">' + ic + (opts.title ? '<h3>' + esc(opts.title) + '</h3>' : '') + (opts.text ? '<p class="lead">' + esc(opts.text) + '</p>' : '') + (opts.html || '') +
      '<div class="sheet-foot stack">' + big + small + '</div></div>', function (sh) {
        $$('[data-v]', sh).forEach(function (b) { b.onclick = function () { var v = b.dataset.v === '1'; finish(v); closeSheet(); }; });
      }, { stack: true, onClose: function () { finish(false); } });
  });
}

/* ---------------- photos, slips and IC reading (simulated) ---------------- */
var Media = {
  /* opens the camera (phones) or a file chooser; resolves {dataUrl, note, w, h, before, after, hash}; rejects 'cancel' */
  photo: function (opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = opts.accept || 'image/*'; inp.className = 'media-in';
      if (opts.capture !== false) inp.setAttribute('capture', opts.capture || 'environment');
      if (opts.multiple) inp.multiple = true;
      inp.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
      document.body.appendChild(inp);
      var fin = function () { setTimeout(function () { inp.remove(); }, 0); };
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; fin();
        if (!f) { reject('cancel'); return; }
        Media.fromFile(f, opts).then(resolve, reject);
      });
      inp.addEventListener('cancel', function () { fin(); reject('cancel'); });
      inp.click();
    });
  },
  /* a File or Blob -> the same result as photo() (used for shared images and pasted pictures) */
  fromFile: function (f, opts) {
    opts = opts || {}; var maxPx = opts.maxPx || 1600, q = opts.quality || .78;
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onerror = function () { reject('read'); };
      rd.onload = function () {
        var src = rd.result;
        if (!/^data:image\//.test(src) || /^data:image\/svg/.test(src)) { resolve({ dataUrl: src, note: '', before: f.size, after: f.size, hash: strHash(src), name: f.name || '' }); return; }
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxPx / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
          var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          var out = cv.toDataURL('image/jpeg', q), after = Math.round(out.length * .75);
          if (after >= f.size && /jpe?g/i.test(f.type)) { out = src; after = f.size; }
          resolve({ dataUrl: out, w: cw, h: ch, before: f.size, after: after, hash: strHash(src), name: f.name || '', note: after < f.size * .9 ? 'Photo made smaller: ' + Media.size(f.size) + ' to ' + Media.size(after) : '' });
        };
        img.onerror = function () { reject('image'); };
        img.src = src;
      };
      rd.readAsDataURL(f);
    });
  },
  size: function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; },
  /* a made-up picture for the demo (no camera on a laptop): Media.sample('slip', 'Bank slip') -> same shape as photo() */
  sample: function (kind, label) { var u = demoImg(kind || 'doc', label || ''); return Promise.resolve({ dataUrl: u, note: 'Sample picture (demo)', before: u.length, after: u.length, hash: strHash(u + Math.random()) }); },
  /* simulated slip / receipt reading. opts.expect = the amount you expect (the read lands on it most of the time). Resolves after ~0.9 s. */
  readSlip: function (dataUrl, opts) {
    opts = opts || {}; var h = parseInt(strHash(dataUrl).slice(0, 6), 36) || 7, R = rng(h);
    return new Promise(function (res) {
      setTimeout(function () {
        var now = new Date(Date.now() - Math.round(R() * 5) * HOUR), amt = opts.expect != null && R() < .8 ? +opts.expect : Math.round((50 + R() * 900) * 100) / 100;
        var banks = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong', 'Bank Islam', 'DuitNow QR'];
        res({ amount: amt, date: toLocalInput(now), time: toTimeInput(now), ref: (R() < .5 ? 'M' : 'C') + String(Math.floor(1e9 + R() * 8e9)), bank: banks[Math.floor(R() * banks.length)], confidence: Math.round(70 + R() * 28) });
      }, opts.delay != null ? opts.delay : 900);
    });
  },
  /* simulated IC reading. opts: {name, ic} to steer the result. Resolves {ic, name, valid, facts:{born, age, state, sex}, issues[]} */
  readIC: function (dataUrl, opts) {
    opts = opts || {}; var h = parseInt(strHash(dataUrl).slice(0, 6), 36) || 11, R = rng(h);
    return new Promise(function (res) {
      setTimeout(function () {
        var ic = opts.ic;
        if (!ic) { var y = 70 + Math.floor(R() * 34), mo = 1 + Math.floor(R() * 12), d = 1 + Math.floor(R() * 28), st = ['01', '02', '07', '08', '10', '14'][Math.floor(R() * 6)]; ic = pad(y % 100) + pad(mo) + pad(d) + '-' + st + '-' + pad(Math.floor(R() * 9999), 4); }
        var f = icFacts(ic), issues = f.issues.slice();
        if (R() < .12) issues.push('The photo is a bit blurry: check the number');
        res({ ic: ic, name: opts.name || ['NUR AISYAH BINTI KAMAL', 'DANIEL LEE WEI MING', 'ARUN A/L RAJAN', 'SITI KHADIJAH BINTI OMAR'][Math.floor(R() * 4)], valid: !f.issues.length, facts: f.facts, issues: issues });
      }, opts.delay != null ? opts.delay : 1100);
    });
  },
  hash: function (dataUrl) { return strHash(dataUrl); }
};
var IC_STATES = { '01': 'Johor', '02': 'Kedah', '03': 'Kelantan', '04': 'Melaka', '05': 'Negeri Sembilan', '06': 'Pahang', '07': 'Penang', '08': 'Perak', '09': 'Perlis', '10': 'Selangor', '11': 'Terengganu', '12': 'Sabah', '13': 'Sarawak', '14': 'Kuala Lumpur', '15': 'Labuan', '16': 'Putrajaya' };
/* checks the shape of a Malaysian-style IC number: 'YYMMDD-SS-NNNN' -> {facts:{born, age, state, sex}, issues[]} */
function icFacts(ic) {
  var d = digits(ic), issues = [], facts = {};
  if (d.length !== 12) { issues.push('An IC number has 12 digits'); return { facts: facts, issues: issues }; }
  var yy = +d.slice(0, 2), mm = +d.slice(2, 4), dd = +d.slice(4, 6), cy = new Date().getFullYear() % 100, year = (yy > cy ? 1900 : 2000) + yy, born = new Date(year, mm - 1, dd);
  if (mm < 1 || mm > 12 || born.getDate() !== dd) issues.push('The birth date in the IC is not a real date');
  else { facts.born = dFull(born); facts.age = Math.floor((Date.now() - born) / (365.25 * DAY)); if (facts.age < 18) issues.push('Younger than 18'); }
  var sc = d.slice(6, 8); facts.state = IC_STATES[sc] || (+sc >= 60 ? 'Born outside Malaysia' : ''); if (!facts.state) issues.push('Unknown state code ' + sc);
  facts.sex = (+d[11]) % 2 ? 'Male' : 'Female';
  return { facts: facts, issues: issues };
}
function maskIC(ic) { var s = String(ic || ''); if (s.length < 8) return s; return s.slice(0, 3) + s.slice(3, -3).replace(/\d/g, 'X') + s.slice(-3); }

/* ---------------- sharing and customer links ---------------- */
var Links = {
  form: function (b) { return B().site + '/' + b.formId; },
  pdf: function (b) { return B().site + '/download/' + b.formId; },
  agent: function (b) { return b.agentToken ? B().site + '/vehicle-inspection/agent/' + b.agentToken : ''; },
  customer: function (b) { return B().site + '/vehicle-inspection/customer/' + b.formId; }
};
var Share = {
  /* opens WhatsApp with the number in full international form and the message filled in */
  wa: function (phone, text) { var n = normPhone(phone); var url = 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : ''); try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; } return url; },
  /* the phone's share sheet, or copy when there is none. {title, text, url, files} */
  native: function (o) {
    o = o || {};
    if (navigator.share) { var data = { title: o.title, text: o.text, url: o.url }; if (o.files && navigator.canShare && navigator.canShare({ files: o.files })) data.files = o.files; return navigator.share(data).catch(function () {}); }
    return Share.copy([o.text, o.url].filter(Boolean).join(' '));
  },
  copy: function (text, msg) {
    var fallback = function () { var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-999px;top:0'; document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove(); return ok; };
    var p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); }) : Promise.resolve(fallback());
    return p.then(function (ok) { say(ok === false ? 'Could not copy. Press and hold to copy.' : (msg || 'Copied')); return ok; });
  },
  /* an image shared into the app from WhatsApp (share target, see sw.js). Resolves a File or null and forgets it. */
  takeShared: function () {
    if (!('caches' in window)) return Promise.resolve(null);
    return caches.open('fms-share').then(function (c) { return c.match('shared-file').then(function (r) { if (!r) return null; return r.blob().then(function (b) { c.delete('shared-file'); return new File([b], 'shared-slip', { type: b.type || 'image/jpeg' }); }); }); }).catch(function () { return null; });
  }
};
function copyText(t) { return Share.copy(t); } /* old name */

/* ---------------- A4 documents: invoice, receipt, deposit statement, report ---------------- */
/* pdfDoc(kind, data) opens a preview sheet with Share and Download (print to PDF). data:
   { no, title, date, to:{name, phone, extra}, booking (code), lines:[{text, sub, amt}], totals:[{label, amt, big}], notes, footer }  -> returns the html */
function pdfHtml(kind, data) {
  var b = B(), t = data.title || { invoice: 'Invoice', receipt: 'Receipt', deposit: 'Deposit statement', report: 'Report', summons: 'Summons charge' }[kind] || 'Document';
  var lines = (data.lines || []).map(function (l) { return '<tr><td>' + esc(l.text) + (l.sub ? '<div class="sub">' + esc(l.sub) + '</div>' : '') + '</td><td class="amt">' + (l.amt == null ? '' : rm(l.amt)) + '</td></tr>'; }).join('');
  var totals = (data.totals || []).map(function (l) { return '<tr class="' + (l.big ? 'big' : '') + '"><td>' + esc(l.label) + '</td><td class="amt">' + rm(l.amt) + '</td></tr>'; }).join('');
  var css = 'body{margin:0;font:12px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#16181D;background:#fff}.pg{width:794px;min-height:1123px;padding:56px 60px;box-sizing:border-box;margin:0 auto}' +
    '.hd{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid ' + b.dark + ';padding-bottom:16px}.lg{display:flex;gap:12px;align-items:center}.lg .m{width:52px;height:52px}.lg .m svg{width:100%;height:100%}.co b{font-size:17px;display:block}.co{color:#4A5160}' +
    'h1{font-size:24px;margin:0;text-align:right;color:' + b.dark + '}.meta{text-align:right;color:#4A5160}.to{margin:22px 0;display:flex;justify-content:space-between;gap:20px}.to b{font-size:14px}table{width:100%;border-collapse:collapse;margin-top:8px}' +
    'td{padding:9px 6px;border-bottom:1px solid #E6E8EC;vertical-align:top}td.amt{text-align:center;white-space:nowrap;width:150px;font-variant-numeric:tabular-nums}.sub{color:#697080;font-size:11px}tr.big td{font-weight:700;font-size:14px;border-bottom:2px solid #16181D}' +
    '.tot{margin-left:auto;width:60%}.notes{margin-top:26px;color:#4A5160;white-space:pre-line}.ft{margin-top:40px;color:#697080;font-size:11px;border-top:1px solid #E6E8EC;padding-top:12px}.demo{color:#B4610B;font-size:11px;margin-top:6px}';
  var bank = b.bank ? 'Bank: ' + b.bank.name + ' · ' + b.bank.accName + ' · ' + b.bank.accNo : '';
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc((data.no || t) + ' ' + b.name) + '</title><style>' + css + '</style></head><body><div class="pg">' +
    '<div class="hd"><div class="lg"><div class="m">' + MARKS[CO] + '</div><div class="co"><b>' + esc(b.name) + '</b>' + esc(b.regNo ? 'Reg. no ' + b.regNo : '') + '<br>' + esc(b.address || '') + '<br>' + esc(b.phone || '') + '</div></div>' +
    '<div><h1>' + esc(t) + '</h1><div class="meta">' + (data.no && data.no !== t ? '<b>' + esc(data.no) + '</b><br>' : '') + esc(dFull(data.date || new Date())) + (data.booking ? '<br>Booking ' + esc(data.booking) : '') + '</div></div></div>' +
    (data.to ? '<div class="to"><div><div class="sub">' + (kind === 'report' ? 'For' : 'Bill to') + '</div><b>' + esc(data.to.name || '') + '</b><br>' + esc(data.to.phone || '') + (data.to.extra ? '<br>' + esc(data.to.extra) : '') + '</div></div>' : '<div style="height:18px"></div>') +
    (lines ? '<table>' + lines + '</table>' : '') + (totals ? '<table class="tot">' + totals + '</table>' : '') +
    (data.notes ? '<div class="notes">' + esc(data.notes) + '</div>' : '') +
    '<div class="ft">' + esc(data.footer || bank) + '<div class="demo">Demo document with made-up data.</div></div></div></body></html>';
}
function pdfDoc(kind, data) {
  data = data || {};
  var html = pdfHtml(kind, data), name = (data.no || kind).replace(/[^\w\-]+/g, '_') + '.html';
  sheet(sheetHead(data.no || data.title || 'Preview', data.to ? data.to.name : '') +
    '<div class="pdfwrap noswipe"><iframe class="pdfframe" title="Preview" sandbox="allow-same-origin allow-modals"></iframe></div>' +
    '<div class="sheet-foot"><div class="btnrow"><button type="button" class="btn ghost" id="pdfDl">' + I('install') + 'Download</button><button type="button" class="btn" id="pdfSh">' + I('share') + 'Share</button></div></div>', function (sh) {
      var fr = $('.pdfframe', sh); fr.srcdoc = html;
      var fit = function () { var w = fr.parentNode.clientWidth, k = w / 794; fr.style.transform = 'scale(' + k + ')'; fr.parentNode.style.height = Math.round(1123 * k) + 'px'; };
      setTimeout(fit, 30);
      $('#pdfDl', sh).onclick = function () { pdfDoc.print(html); };
      $('#pdfSh', sh).onclick = function () {
        var file = null; try { file = new File([html], name, { type: 'text/html' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: data.no || kind }).catch(function () {});
        else if (data.shareText || data.link) Share.native({ title: data.no, text: data.shareText || '', url: data.link || '' });
        else pdfDoc.print(html);
      };
    }, { full: true, stack: !!data.stack });
  return html;
}
pdfDoc.html = pdfHtml;
pdfDoc.print = function (html) { var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f); f.srcdoc = html; f.onload = function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { say('Printing is not available here'); } setTimeout(function () { f.remove(); }, 60000); }; };

/* ---------------- date and time fields ----------------
   Native date / time inputs show the phone's own format (10/19/2026, 15:00). Every <input class="inp"> of type date, time,
   datetime-local or month gets a visible label on top that always reads "19 Oct 2026", "3:00 PM", "19 Oct 2026, 3:00 PM" or "Oct 2026".
   The native input stays underneath (its text made clear), so a tap still opens the phone's own picker, and code keeps using .value.
   Add data-nodtf to an input to leave it alone. */
var DTF_TYPES = { date: 1, time: 1, 'datetime-local': 1, month: 1 };
function dtfTime(v) { var p = String(v || '').split(':'), h = +p[0], m = +p[1]; if (isNaN(h) || isNaN(m)) return ''; return (h % 12 || 12) + ':' + pad(m) + (h < 12 ? ' AM' : ' PM'); }
function dtfDate(v) { var p = String(v || '').split('-'); if (p.length < 3 || !MO[+p[1] - 1]) return ''; return (+p[2]) + ' ' + MO[+p[1] - 1] + ' ' + p[0]; }
function dtfText(type, v) {
  if (!v) return '';
  if (type === 'date') return dtfDate(v);
  if (type === 'time') return dtfTime(v);
  if (type === 'month') { var p = v.split('-'); return MO[+p[1] - 1] ? MO[+p[1] - 1] + ' ' + p[0] : v; }
  if (type === 'datetime-local') { var q = v.split('T'); return dtfDate(q[0]) + (q[1] ? ', ' + dtfTime(q[1].slice(0, 5)) : ''); }
  return v;
}
function dtfSync(inp) {
  var l = inp && inp._dtfLbl; if (!l) return;
  var t = dtfText(inp.type, inp.value);
  l.textContent = t || inp.getAttribute('placeholder') || (inp.type === 'time' ? 'Pick a time' : inp.type === 'month' ? 'Pick a month' : 'Pick a date');
  l.classList.toggle('ph', !t);
  if (l.parentNode) l.parentNode.hidden = !!inp.hidden;
}
function dtfEnhance(root) {
  if (!root || !root.querySelectorAll) return;
  var list = root.matches && root.matches('input.inp') ? [root] : $$('input.inp', root);
  list.forEach(function (inp) {
    if (!DTF_TYPES[inp.type] || inp._dtfLbl || inp.hasAttribute('data-nodtf') || !inp.parentNode) return;
    var w = document.createElement('span'); w.className = 'dtf';
    if (inp.style.width) { w.style.width = inp.style.width; inp.style.width = ''; }
    if (inp.style.flex) { w.style.flex = inp.style.flex; inp.style.flex = ''; }
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    var l = document.createElement('span'); l.className = 'dtf-l'; l.setAttribute('aria-hidden', 'true'); w.appendChild(l);
    inp.classList.add('dtf-i'); inp._dtfLbl = l;
    inp.addEventListener('input', function () { dtfSync(inp); }); inp.addEventListener('change', function () { dtfSync(inp); });
    dtfSync(inp);
  });
}
(function () {
  /* code that sets .value directly (no input event) still updates the label */
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (d && d.set) Object.defineProperty(HTMLInputElement.prototype, 'value', { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, v); if (this._dtfLbl) dtfSync(this); } });
  } catch (e) {}
  if (!window.MutationObserver) return;
  var mo = new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) for (var j = 0; j < recs[i].addedNodes.length; j++) { var n = recs[i].addedNodes[j]; if (n.nodeType === 1) dtfEnhance(n); }
  });
  var go = function () { mo.observe(document.body, { childList: true, subtree: true }); dtfEnhance(document.body); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();
