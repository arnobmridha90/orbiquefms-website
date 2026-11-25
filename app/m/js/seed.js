'use strict';
/* =====================================================================
   Made-up demo data (data model v4) and the v3 -> v4 migration.
   seed(co) = seedCore(co) + seedExtras(d). seedExtras only reads cars, customers and bookings,
   so it also fills phones that come from the old v3 data.
   ===================================================================== */

/* ---------------- company settings (everything a company can change; read through B()) ---------------- */
function companySettings(co) {
  var common = { country: '60', cardFee: { pct: 4, fixed: 1 }, depositRefundLockFrom: '2026-11-01', invoicePrefix: 'INV', receiptPrefix: 'RCP', speedLimit: 110, expenseEditHours: 24, signature: null,
    quickReplies: ['Yes, it is available', 'Please send the transfer slip here', 'We can deliver to you for {deliveryFee}', 'See you tomorrow!', 'The deposit is returned within 3 working days after return'],
    serviceTypes: [{ name: 'Oil change', km: 10000, days: 180 }, { name: 'General service', km: 20000, days: 365 }, { name: 'Tyres', km: 40000, days: 0 }, { name: 'Brake pads', km: 30000, days: 0 }, { name: 'Battery', km: 0, days: 730 }, { name: 'Aircond', km: 0, days: 365 }, { name: 'Repair', km: 0, days: 0 }, { name: 'Car wash', km: 0, days: 0 }],
    expenseKinds: [
      { id: 'fuel', name: 'Fuel', everyday: true, needsCar: true }, { id: 'wash', name: 'Car wash', everyday: true, needsCar: true }, { id: 'toll', name: 'Toll', everyday: true },
      { id: 'parking', name: 'Parking', everyday: true }, { id: 'taxi', name: 'Grab or taxi', everyday: true }, { id: 'meal', name: 'Meal allowance', everyday: true, fixed: 15 },
      { id: 'service', name: 'Car service', needsCar: true }, { id: 'tyres', name: 'Tyres', needsCar: true }, { id: 'repair', name: 'Repair', needsCar: true },
      { id: 'roadtax', name: 'Road tax', needsCar: true, business: true }, { id: 'insurance', name: 'Insurance', needsCar: true, business: true }, { id: 'hp', name: 'Hire purchase', needsCar: true, business: true },
      { id: 'summons', name: 'Summons paid', needsCar: true }, { id: 'delivery_fuel', name: 'Fuel for delivery', needsBooking: true, needsCar: true },
      { id: 'rent', name: 'Office rent', business: true }, { id: 'salary', name: 'Salary', business: true }, { id: 'ads', name: 'Advertising', business: true },
      { id: 'utilities', name: 'Electric and water', business: true }, { id: 'phone', name: 'Phone and internet', business: true }, { id: 'stationery', name: 'Stationery' }, { id: 'other', name: 'Other' }] };
  var per = {
    kilat: { name: 'Kilat Wheels', short: 'Kilat', regNo: '202301045512 (1502231-K)', phone: '+60 3-9133 4821', email: 'hello@kilatwheels.example', address: '12 Jalan Kilat 3, Taman Segar, 56100 Cheras, Kuala Lumpur',
      site: 'https://kilat.orbique.app', appName: 'Kilat Staff', apk: 'kilat-staff.apk', codePrefix: 'KLT', summonsAdminFee: 20, clientDeliveryFee: 50, clientReturnFee: 50,
      bank: { name: 'Maybank', accName: 'Kilat Wheels Sdn Bhd', accNo: '5641 2208 7714' },
      locations: [{ id: 'L1', name: 'Kilat office, Cheras', short: 'Cheras', pickup: true, dropoff: true, agents: ['s4'] }, { id: 'L2', name: 'Kilat counter, Bangsar South', short: 'Bangsar', pickup: true, dropoff: true, agents: ['s5'] }],
      places: [{ id: 'P1', name: 'Airport, main terminal', deliveryFee: 80, returnFee: 80 }, { id: 'P2', name: 'Airport, budget terminal', deliveryFee: 80, returnFee: 80 }, { id: 'P3', name: 'KL Sentral', deliveryFee: 40, returnFee: 40 }],
      packages: [{ id: 'K1', name: 'Basic cover', daily: 15, max: 3000, default: true }, { id: 'K2', name: 'Full cover', daily: 45, max: 10000 }] },
    padi: { name: 'Padi Emas Rent-a-Car', short: 'Padi Emas', regNo: '201901018834 (1327561-W)', phone: '+60 4-731 2290', email: 'sewa@padiemas.example', address: '8 Jalan Sultanah, 05350 Alor Setar, Kedah',
      site: 'https://padiemas.orbique.app', appName: 'Padi Emas Staff', apk: '', codePrefix: 'PDE', summonsAdminFee: 10, clientDeliveryFee: 40, clientReturnFee: 40,
      bank: { name: 'Bank Islam', accName: 'Padi Emas Rent-a-Car', accNo: '0201 6011 4432 18' },
      locations: [{ id: 'L1', name: 'Padi Emas office, Alor Setar', short: 'Alor Setar', pickup: true, dropoff: true, agents: ['s4'] }],
      places: [{ id: 'P1', name: 'Alor Setar Airport', deliveryFee: 30, returnFee: 30 }, { id: 'P2', name: 'Kuala Kedah Jetty', deliveryFee: 40, returnFee: 40 }],
      packages: [{ id: 'K1', name: 'Standard cover', daily: 12, max: 2500, default: true }, { id: 'K2', name: 'Premium cover', daily: 35, max: 8000 }] },
    bara: { name: 'Bara Car Rental', short: 'Bara', regNo: '202001009921 (1366710-P)', phone: '+60 4-646 7710', email: 'book@baracars.example', address: '21 Lorong Bayan 2, 11900 Bayan Lepas, Penang',
      site: 'https://bara.orbique.app', appName: 'Bara Staff', apk: '', codePrefix: 'BRA', summonsAdminFee: 25, clientDeliveryFee: 50, clientReturnFee: 50,
      bank: { name: 'Public Bank', accName: 'Bara Car Rental Sdn Bhd', accNo: '3198 2241 07' },
      locations: [{ id: 'L1', name: 'Bara office, Bayan Lepas', short: 'Bayan Lepas', pickup: true, dropoff: true, agents: ['s4'] }, { id: 'L2', name: 'Bara counter, Georgetown', short: 'Georgetown', pickup: true, dropoff: false, agents: ['s5'] }],
      places: [{ id: 'P1', name: 'Penang Airport', deliveryFee: 30, returnFee: 30 }, { id: 'P2', name: 'Komtar', deliveryFee: 25, returnFee: 25 }, { id: 'P3', name: 'Butterworth ferry terminal', deliveryFee: 45, returnFee: 45 }],
      packages: [{ id: 'K1', name: 'Lite cover', daily: 10, max: 2000 }, { id: 'K2', name: 'Plus cover', daily: 25, max: 5000, default: true }, { id: 'K3', name: 'Max cover', daily: 50, max: 12000 }] }
  };
  var s = Object.assign({}, common, per[co]);
  /* handover fees, one per kind of trip; 'rates' gives some people a different amount */
  var hf = [];
  s.locations.forEach(function (l) { if (l.pickup) hf.push({ kind: 'Pick-up from our location, ' + l.short, group: 'delivery', amount: 10, rates: {} }); });
  hf.push({ kind: 'Delivery to client', group: 'delivery', amount: 30, rates: { s5: 35 } });
  s.places.forEach(function (p) { hf.push({ kind: 'Delivery to ' + p.name, group: 'delivery', amount: Math.max(20, p.deliveryFee / 2), rates: {} }); });
  s.locations.forEach(function (l) { if (l.dropoff) hf.push({ kind: 'Drop-off at our location, ' + l.short, group: 'return', amount: 10, rates: {} }); });
  hf.push({ kind: 'Return from client', group: 'return', amount: 30, rates: { s5: 35 } });
  s.places.forEach(function (p) { hf.push({ kind: 'Return from ' + p.name, group: 'return', amount: Math.max(20, p.returnFee / 2), rates: {} }); });
  hf.push({ kind: 'Companion', group: 'companion', amount: 15, rates: {} });
  s.handoverFees = hf;
  return s;
}
/* the handover-fee kind for one end of a booking ('pick' -> delivery group, 'ret' -> return group) */
function handoverKind(b, end) {
  var k = end === 'ret' ? b.retKind : b.pickKind, id = end === 'ret' ? b.retLoc : b.pickLoc;
  if (k === 'our') { var l = loc(id); return l ? (end === 'ret' ? 'Drop-off at our location, ' : 'Pick-up from our location, ') + l.short : ''; }
  if (k === 'client') return end === 'ret' ? 'Return from client' : 'Delivery to client';
  if (k === 'place') { var p = place(id); return p ? (end === 'ret' ? 'Return from ' : 'Delivery to ') + p.name : ''; }
  return '';
}
function feeFor(kind, staffId) { var f = (B().handoverFees || []).filter(function (x) { return x.kind === kind; })[0]; if (!f) return 0; return f.rates && f.rates[staffId] != null ? +f.rates[staffId] : +f.amount || 0; }

var STAFF_SEED = {
  kilat: [['Aina Rahman', 'owner'], ['Hafiz Zul', 'manager'], ['Mei Ling Tan', 'frontdesk'], ['Ravi Kumar', 'agent'], ['Danish Hakimi', 'agent'], ['Kavitha Raj', 'accountant'], ['Wong Kar Fai', 'fleet'], ['Zul Ariffin', 'agent', 'nologin']],
  padi: [['Nurul Huda', 'owner'], ['Azman Saad', 'manager'], ['Siew Lan', 'frontdesk'], ['Kumar Pillai', 'agent'], ['Rosli Hamzah', 'agent'], ['Faridah Ali', 'accountant']],
  bara: [['Farah Iskandar', 'owner'], ['Jason Ooi', 'manager'], ['Priya Devi', 'frontdesk'], ['Ismail Hamid', 'agent'], ['Lim Boon Keat', 'agent'], ['Shalini Nair', 'accountant'], ['Teoh Chee Wah', 'fleet'], ['Azri Shah', 'agent', 'off']]
};
function seedStaff(co, R) {
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var bloods = ['A+', 'B+', 'O+', 'AB+', 'O-', 'A-'];
  return STAFF_SEED[co].map(function (p, k) {
    var ph = fmtPhone('01' + ri(1, 9) + ri(1000000, 9999999)), nologin = p[2] === 'nologin', off = p[2] === 'off';
    return { id: 's' + (k + 1), name: p[0], username: p[0].split(' ')[0].toLowerCase() + (k > 5 ? k : ''), role: p[1], phone: ph, wa: ph, email: p[0].split(' ')[0].toLowerCase() + '@' + co + '.example',
      active: !off, isAgent: p[1] === 'agent', hasLogin: !nologin, loginActive: !nologin && !off, emergency: { name: 'Family of ' + p[0].split(' ')[0], phone: fmtPhone('01' + ri(1, 9) + ri(1000000, 9999999)), relation: k % 2 ? 'Spouse' : 'Parent' },
      blood: bloods[k % bloods.length], lastSeen: k === 7 ? null : new Date(Date.now() - ri(3, 60 * 30) * MIN).toISOString(), codes: null };
  });
}

var CAR_MODELS = [['Perodua', 'Axia', 'hatch', 110], ['Perodua', 'Bezza', 'sedan', 130], ['Perodua', 'Myvi', 'hatch', 140], ['Proton', 'Saga', 'sedan', 120], ['Honda', 'City', 'sedan', 180], ['Proton', 'X50', 'suv', 230], ['Toyota', 'Vios', 'sedan', 170], ['Perodua', 'Alza', 'mpv', 200], ['Proton', 'X70', 'suv', 260], ['Toyota', 'Innova', 'mpv', 250],
  ['Proton', 'Persona', 'sedan', 125], ['Proton', 'Iriz', 'hatch', 115], ['Nissan', 'Almera', 'sedan', 160], ['Honda', 'HR-V', 'suv', 270], ['Perodua', 'Ativa', 'suv', 190], ['Perodua', 'Aruz', 'suv', 210], ['Honda', 'Civic', 'sedan', 260], ['Mazda', 'CX-5', 'suv', 300], ['Toyota', 'Corolla Cross', 'suv', 280], ['Hyundai', 'Starex', 'mpv', 380], ['Toyota', 'Alphard', 'mpv', 650]];
var CAR_COLOR_LIST = ['White', 'Silver', 'Grey', 'Black', 'Red', 'Blue', 'Dark Blue', 'White', 'Silver', 'Gold', 'White', 'Brown', 'Green', 'Orange'];
function plateFor(co, R, used) {
  var L = 'ABCDEFGHJKLMNPQRSTUVWXY', pre = { kilat: ['W', 'V'], padi: ['K', 'K'], bara: ['P', 'P'] }[co], p;
  do { p = pre[Math.floor(R() * 2)] + L[Math.floor(R() * L.length)] + L[Math.floor(R() * L.length)] + ' ' + (1000 + Math.floor(R() * 8899)); } while (used[normPlate(p)]);
  used[normPlate(p)] = 1; return p;
}
function makeCar(co, k, R, used) {
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var m = CAR_MODELS[k % CAR_MODELS.length], rate = m[3] + (k >= CAR_MODELS.length ? 10 : 0), year = ri(2018, 2025);
  var VIN = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789', serial = ''; for (var i = 0; i < 13; i++) serial += VIN[Math.floor(R() * VIN.length)];
  return { id: 'car' + (k + 1), plate: plateFor(co, R, used), make: m[0], model: m[1], shape: m[2], type: CAR_TYPES[m[2]], color: CAR_COLOR_LIST[k % CAR_COLOR_LIST.length], year: year,
    rate: rate, hourly: Math.max(10, Math.round(rate / 8)), deposit: rate >= 250 ? 500 : rate >= 200 ? 300 : 200,
    serial: (m[0] === 'Perodua' ? 'PM2' : m[0] === 'Proton' ? 'PL1' : 'MR0') + serial, engineNo: m[0].slice(0, 2).toUpperCase() + ri(100000, 999999),
    status: 'active', km: ri(18, 140) * 1000 + ri(0, 999), owner: k % 7 === 3 ? { name: ['Encik Roslan Idris', 'Madam Loh Siew Mei', 'Mr Ganesh Pillai'][k % 3], phone: fmtPhone('01' + ri(2, 9) + ri(1000000, 9999999)) } : null,
    instalment: k % 4 === 1 ? { monthly: Math.round(rate * 4.2), day: ri(3, 25), bank: ['Maybank Islamic', 'CIMB', 'Public Bank', 'RHB'][k % 4], endsOn: toLocalInput(new Date(Date.now() + ri(200, 1500) * DAY)) } : null,
    gallery: [], showOnWebsite: k % 9 !== 4, serviceEveryKm: 10000, lastServiceKm: null, lastServiceAt: null, note: '' };
}
var CUST_NAMES = ['Nur Aisyah Kamal', 'Daniel Lee', 'Muhammad Irfan', 'Siti Khadijah', 'Kevin Tan', 'Arun Rajan', 'Hannah Wong', 'Amir Hakim', 'Farhana Yusof', 'Chong Wei Jie', 'Lakshmi Nair', 'Haziq Osman', 'Emily Lim', 'Zulkifli Ahmad', 'Grace Teoh', 'Syafiq Rosli', 'Deepa Menon', 'Aiman Faris', 'Rachel Goh', 'Iskandar Musa',
  'Melissa Ong', 'Hairul Nizam', 'Wan Nur Izzati', 'Jonathan Yap', 'Kamala Devi', 'Faiz Rahim', 'Sharon Chua', 'Mohd Khairul', 'Yvonne Low', 'Ravi Shankar', 'Puteri Balqis', 'Benjamin Koh', 'Adibah Salleh', 'Gopal Krishnan', 'Tasha Lim', 'Rizal Zainal', 'Budi Santoso', 'Wei Ling Ho', 'Anita Subramaniam', 'Hafizah Noor'];
/* Bara (Penang) has its own customers, so its lists do not repeat Kilat's names */
var CUST_NAMES_BARA = ['Ooi Kah Seng', 'Nurul Huda Ismail', 'Lim Chee Keong', 'Thinesh Kumar', 'Khoo Siew Lan', 'Ahmad Fauzi', 'Teh Bee Lian', 'Mohd Hafiz Razak', 'Cheah Wai Mun', 'Priya Ramasamy',
  'Yeoh Jia Hui', 'Shahrul Nizam', 'Lee Mei Fong', 'Kavitha Arumugam', 'Goh Boon Huat', 'Nor Azlina', 'Tan Kok Wai', 'Vinod Nair', 'Chew Pei Shan', 'Azman Hashim',
  'Loh Kar Mun', 'Sabrina Yusri', 'Ng Teck Soon', 'Meena Pillai', 'Saw Chin Hong', 'Faridah Hamzah', 'Lau Wen Jie', 'Zainab Omar', 'Quah Li Ting', 'Suresh Menon',
  'Heng Yi Xuan', 'Nik Amirul', 'Choo Siew Ping', 'Rajesh Gopal', 'Tay Hui Min', 'Hidayah Kamil', 'Ong Beng Chuan', 'Aishah Mokhtar', 'Foo Kian Ming', 'Lavanya Sekar'];
function makeCustomer(k, n, R) {
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var foreign = n === 'Budi Santoso' ? 'Indonesian' : n === 'Wei Ling Ho' ? 'Singaporean' : 'Malaysian';
  var y = ri(70, 102) % 100, ic = foreign === 'Malaysian' ? pad(y) + pad(ri(1, 12)) + pad(ri(1, 28)) + '-' + ['01', '02', '07', '08', '10', '14'][k % 6] + '-' + pad(ri(1000, 9998), 4) : '';
  var phone = foreign === 'Singaporean' ? fmtPhone('+65 9' + ri(1000000, 9999999)) : foreign === 'Indonesian' ? fmtPhone('+62 812' + ri(10000000, 99999999)) : fmtPhone('01' + ri(1, 9) + ri(1000000, 9999999));
  var first = n.split(' ')[0].toLowerCase();
  return { id: 'cu' + (k + 1), name: n, phone: phone, email: k % 3 === 2 ? '' : first + '.' + (n.split(' ')[1] || 'x').toLowerCase() + '@mail.example', ic: ic, passport: foreign !== 'Malaysian' ? (foreign === 'Singaporean' ? 'K' : 'C') + ri(1000000, 9999999) + 'X' : '',
    nationality: foreign, licenceNo: 'D' + ri(10000000, 99999999), licenceExp: toLocalInput(new Date(Date.now() + (k === 6 ? -20 : ri(60, 1600)) * DAY)),
    address: ri(1, 88) + ', Jalan ' + ['Mawar', 'Cempaka', 'Kenanga', 'Melati', 'Teratai'][k % 5] + ' ' + ri(1, 12) + ', ' + ['Cheras', 'Petaling Jaya', 'Shah Alam', 'Alor Setar', 'Bayan Lepas', 'Ipoh'][k % 6],
    emergency: { name: ['Kamal', 'Lee', 'Rahman', 'Omar', 'Tan'][k % 5] + ' (family)', phone: fmtPhone('01' + ri(1, 9) + ri(1000000, 9999999)), relation: ['Father', 'Mother', 'Spouse', 'Brother', 'Sister'][k % 5] },
    blacklist: null, docs: k % 4 === 3 ? { icFront: null, icBack: null, passport: null, licence: null, poa: null, other: [] } : { icFront: 'demo:ic:IC front', icBack: 'demo:ic:IC back', passport: foreign !== 'Malaysian' ? 'demo:doc:Passport' : null, licence: 'demo:licence:Licence', poa: k % 2 ? 'demo:doc:Utility bill' : null, other: [] },
    created: new Date(Date.now() - ri(30, 400) * DAY).toISOString() };
}

/* a booking in the v4 shape, filled with defaults */
function blankBooking(o) {
  return Object.assign({ id: uid(), no: 0, code: '', cust: null, car: null, start: null, end: null, created: new Date().toISOString(), createdBy: null, source: 'Staff',
    bookingStatus: 'Pending', paymentStatus: null, rates: { daily: 0, hourly: 0, deposit: 0, discount: 0, delivery: 0, 'return': 0, others: 0 }, cover: null,
    pickKind: 'our', pickLoc: 'L1', pickNote: '', retKind: 'our', retLoc: 'L1', retNote: '', method: 'Cash', submitted: false, submittedAt: null,
    formId: uid() + uid().slice(0, 4), agentToken: uid() + uid(), inspection: { agent: null, customer: null }, returnKm: null, returnFuel: null,
    docs: { icFront: null, icBack: null, passport: null, licence: null, poa: null, other: [] }, assigned: [], log: [], summonsIds: [], payments: [], note: '', cancelReason: null, leadId: null, refundPendingAt: null }, o || {});
}
function newPayment(o) { return Object.assign({ id: uid(), at: new Date().toISOString(), items: [], method: 'Cash', depositOf: null, cashTo: null, afterCharge: null, ref: '', note: '', slip: null, slipHash: null, receiptNo: null, voided: false, voidReason: null, voidedAt: null, voidedBy: null, by: null }, o || {}); }

/* ---------------- fresh demo data ---------------- */
function seed(co) {
  var d = seedCore(co);
  S = d; /* helpers such as B(), car() read S */
  seedExtras(d);
  return d;
}
function seedCore(co) {
  var base = COMPANIES[co], R = rng({ kilat: 11, padi: 23, bara: 37 }[co]);
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var settings = companySettings(co), staffList = seedStaff(co, R);
  var d = { v: DATA_VERSION, co: co, settings: settings, staff: staffList, me: 's1', cars: [], customers: [], bookings: [], staffChat: [], wa: [], notifs: [], nextNo: base.no, prefsBy: {} };
  S = d;
  var used = {}, nCars = { kilat: 44, padi: 14, bara: 42 }[co];
  for (var k = 0; k < nCars; k++) d.cars.push(makeCar(co, k, R, used));
  /* a few cars that are not for rent right now */
  if (nCars > 20) { d.cars[15].status = 'inactive'; d.cars[15].note = 'Waiting for new tyres'; d.cars[20].status = 'sold'; d.cars[20].note = 'Sold in October'; }
  else { d.cars[9].status = 'inactive'; d.cars[9].note = 'Not in use this month'; }
  var nCu = co === 'padi' ? 24 : 40;
  var names = co === 'bara' ? CUST_NAMES_BARA : CUST_NAMES;
  for (k = 0; k < nCu; k++) d.customers.push(makeCustomer(k, names[k], R));
  d.downtime = [];
  var now = new Date(), nowT = now.getTime(), base0 = sod(now).getTime();
  var dtCars = nCars > 20 ? [6, 11] : [4];
  d.downtime.push({ id: 'dt1', car: d.cars[dtCars[0]].id, from: new Date(base0 - 2 * DAY + 9 * HOUR).toISOString(), to: new Date(base0 + 3 * DAY + 17 * HOUR).toISOString(), reason: 'Gearbox repair', jobId: null, by: 's1' });
  if (dtCars[1]) d.downtime.push({ id: 'dt2', car: d.cars[dtCars[1]].id, from: new Date(base0 - DAY + 10 * HOUR).toISOString(), to: null, reason: 'Accident repair, waiting for insurer', jobId: null, by: 's2' });
  var ids = function (role) { return staffList.filter(function (p) { return p.role === role && p.active; }).map(function (p) { return p.id; }); };
  var agents = ids('agent'), desk = ids('frontdesk').concat(ids('owner'), ids('manager'));
  var no = base.no, sh = [8, 9, 10, 10, 11, 13, 14, 15, 16, 18];
  d.cars.forEach(function (c, ci) {
    if ((ci % 5 === 4 || ci % 7 === 3) && ci > 0 && R() < .6) return; /* some cars stay quiet */
    var t = base0 - ri(44, 50) * DAY; /* about six weeks back, so last month has real figures in reports and My money (storage stays small) */
    var endLimit = c.status === 'sold' ? base0 - 30 * DAY : base0 + 28 * DAY;
    while (t < endLimit) {
      var start = sod(t + ri(0, 4) * DAY).getTime() + pick(sh) * HOUR;
      if (start < t + HOUR) start += DAY;
      if (R() < .12) start = t + ri(1, 2) * HOUR; /* a quick turnaround after the last return */
      var len = pick([1, 1, 2, 2, 2, 3, 3, 4, 5, 7]) * DAY + pick([0, 0, 0, 0, 2, 4, -1]) * HOUR, end = start + len;
      if (start >= endLimit || (c.status === 'sold' && end >= endLimit)) break; /* a sold car has no rentals near now */
      var inDown = d.downtime.some(function (x) { return x.car === c.id && new Date(x.from).getTime() < end && (x.to ? new Date(x.to).getTime() : Infinity) > start; });
      if (c.status === 'inactive' && start > nowT - 7 * DAY) inDown = true;
      if (!inDown) d.bookings.push(seedBooking(d, c, start, end, no++, R, agents, desk));
      t = end + (R() < .25 ? 0 : ri(4, 60) * HOUR);
    }
  });
  d.nextNo = no;
  /* order by start, then number again so codes follow time like a real company */
  d.bookings.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
  d.bookings.forEach(function (b, i) { b.no = base.no + i; b.code = settings.codePrefix + '-' + pad(b.no, 5); });
  d.nextNo = base.no + d.bookings.length;
  /* a missed pick-up and a late return for the Home screen */
  var cur = d.bookings.filter(function (b) { return b.bookingStatus === 'Car Delivered' && new Date(b.start) > nowT - 5 * HOUR; })[0];
  if (cur) { cur.bookingStatus = 'Agreement Signed'; cur.inspection.agent = null; cur.log = cur.log.filter(function (l) { return !/handed over/.test(l.text); }); }
  var lateOne = d.bookings.filter(function (b) { return b.bookingStatus === 'Car Returned' && new Date(b.end) > nowT - 20 * HOUR && !d.bookings.some(function (x) { return x.car === b.car && x !== b && new Date(x.start) > new Date(b.start) && new Date(x.start).getTime() < nowT + 6 * HOUR && x.bookingStatus !== 'Cancelled'; }); })[0];
  if (lateOne) { lateOne.bookingStatus = 'Car Delivered'; lateOne.paymentStatus = 'Extension Due'; lateOne.returnKm = null; lateOne.returnFuel = null; lateOne.refundPendingAt = null; lateOne.log = lateOne.log.filter(function (l) { return !/returned/.test(l.text); }); }
  seedKm(d, R);
  seedToday(d, nowT, base0);
  seedChats(d, R);
  return d;
}
/* odometer readings that follow each other: every handover reads what the car showed at the end of the rental before it,
   and a car that is out on rent shows the km of its handover */
function seedKm(d, R) {
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var kmText = function (fuel, km) { return '(' + fuel + ', ' + km.toLocaleString('en-US') + ' km)'; };
  d.cars.forEach(function (c) {
    var list = d.bookings.filter(function (b) { return b.car === c.id && b.inspection && b.inspection.agent; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (!list.length) return;
    var legs = list.map(function (b) { return { b: b, drive: b.returnKm ? ri(80, 900) : 0, gap: ri(5, 60) }; });
    var run = Math.max(1000, c.km - legs.reduce(function (s, x) { return s + x.drive + x.gap; }, 0)), last = null;
    legs.forEach(function (x) {
      var b = x.b, ag = b.inspection.agent;
      ag.km = run; ag.photos.odometer = 'demo:odo:' + pad(run, 6);
      if (b.returnKm) { b.returnKm = run + x.drive; run = b.returnKm; }
      (b.log || []).forEach(function (l) {
        if (/^Car handed over at /.test(l.text)) l.text = l.text.replace(/\([^()]*, [\d,]+ km\)$/, kmText(ag.fuel, ag.km));
        else if (/^Car returned at /.test(l.text) && b.returnKm) l.text = l.text.replace(/\([^()]*, [\d,]+ km\)$/, kmText(b.returnFuel, b.returnKm));
      });
      last = b; run += x.gap;
    });
    c.km = last.returnKm ? run : last.inspection.agent.km;
  });
}
/* the Today board: a couple of pick-ups and returns still to come later today, whatever the hour the data is made
   (nothing is moved late at night: then an empty "later today" is true) */
function seedToday(d, nowT, base0) {
  var eod = base0 + DAY, first = Math.ceil((nowT + 60 * MIN) / (30 * MIN)) * 30 * MIN;
  if (first > eod - 45 * MIN) return;
  var slots = [first, Math.min(eod - 15 * MIN, first + (first < eod - 4 * HOUR ? 2 * HOUR : 45 * MIN))];
  var free = function (b, s, e) {
    return !d.bookings.some(function (x) { return x !== b && x.car === b.car && x.bookingStatus !== 'Cancelled' && new Date(x.start).getTime() < e + 3 * HOUR && new Date(x.end).getTime() + 3 * HOUR > s; }) &&
      !(d.downtime || []).some(function (x) { return x.car === b.car && new Date(x.from).getTime() < e && (x.to ? new Date(x.to).getTime() : Infinity) > s; });
  };
  var shift = function (b, delta) {
    var os = new Date(b.start).getTime();
    b.start = new Date(os + delta).toISOString(); b.end = new Date(new Date(b.end).getTime() + delta).toISOString();
    var ins = b.inspection || {};
    if (ins.agent) ins.agent.at = new Date(new Date(ins.agent.at).getTime() + delta).toISOString();
    if (ins.customer) ins.customer.at = new Date(new Date(ins.customer.at).getTime() + delta).toISOString();
    (b.log || []).forEach(function (l) { if (/^Car handed over/.test(l.text)) l.at = ins.agent ? ins.agent.at : l.at; });
  };
  var later = function (t) { t = new Date(t).getTime(); return t > nowT && t < eod; };
  /* going out later today */
  var outN = d.bookings.filter(function (b) { return UPCOMING.indexOf(b.bookingStatus) >= 0 && b.bookingStatus !== 'Pending' && later(b.start); }).length;
  d.bookings.filter(function (b) { return (b.bookingStatus === 'Agreement Signed' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Agreement Sent') && new Date(b.start).getTime() >= eod && new Date(b.start).getTime() < eod + 2 * DAY; })
    .sort(function (a, b) { return new Date(a.start) - new Date(b.start); }).forEach(function (b) {
      if (outN >= 2) return;
      var slot = slots[outN], delta = slot - new Date(b.start).getTime();
      if (free(b, slot, new Date(b.end).getTime() + delta)) { shift(b, delta); outN++; }
    });
  /* coming back later today */
  var backN = d.bookings.filter(function (b) { return b.bookingStatus === 'Car Delivered' && later(b.end); }).length;
  d.bookings.filter(function (b) { return b.bookingStatus === 'Car Delivered' && new Date(b.end).getTime() >= eod && new Date(b.end).getTime() < eod + DAY; })
    .sort(function (a, b) { return new Date(a.end) - new Date(b.end); }).forEach(function (b) {
      if (backN >= 2) return;
      var slot = Math.min(eod - 5 * MIN, slots[backN] + 15 * MIN), delta = slot - new Date(b.end).getTime();
      if (new Date(b.start).getTime() + delta < nowT - 2 * HOUR && free(b, new Date(b.start).getTime() + delta, slot)) { shift(b, delta); backN++; }
    });
  d.bookings.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
}
function seedBooking(d, c, start, end, no, R, agents, desk) {
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var st = d.settings, nowT = Date.now(), cus = d.customers.filter(function (x) { return !x.blacklist; });
  var cu = pick(cus.slice(0, Math.min(cus.length, 28))), src = pick(['Staff', 'Staff', 'Website', 'WhatsApp', 'Walk-in']);
  /* made 1 to 12 days before the start; a booking that would be made in the future was made some time in the last 10 days instead */
  var created = start - ri(1, 12) * DAY + ri(0, 10) * HOUR;
  if (created > nowT - 20 * MIN) created = Math.min(start - HOUR, nowT - ri(1, 240) * HOUR);
  var kindOf = function () { var x = R(); return x < .6 ? 'our' : x < .8 ? 'client' : 'place'; };
  var pk = kindOf(), rk = R() < .7 ? pk : kindOf();
  var locOf = function (k, end) { if (k === 'our') { var ls = st.locations.filter(function (l) { return end === 'ret' ? l.dropoff : l.pickup; }); return pick(ls).id; } if (k === 'place') return pick(st.places).id; return null; };
  var pl = locOf(pk, 'pick'), rl = rk === pk && pk !== 'client' && (pk !== 'our' || (byId(st.locations, pl) || {}).dropoff) ? pl : locOf(rk, 'ret');
  var addr = cu.address;
  var defPkg = st.packages.filter(function (p) { return p.default; })[0] || st.packages[0], pkR = R(), pkgPick = pkR < .5 ? defPkg : pkR < .72 ? pick(st.packages) : null;
  var fee = function (k, id, end) { if (k === 'client') return end === 'ret' ? st.clientReturnFee : st.clientDeliveryFee; if (k === 'place') { var p = byId(st.places, id); return end === 'ret' ? p.returnFee : p.deliveryFee; } return 0; };
  var b = blankBooking({ no: no, code: st.codePrefix + '-' + pad(no, 5), cust: cu.id, car: c.id, start: new Date(start).toISOString(), end: new Date(end).toISOString(), created: new Date(created).toISOString(),
    createdBy: src === 'Website' ? 'Website' : pick(desk), source: src, method: pick(['Cash', 'Online Transfer', 'Online Transfer', 'Card']),
    rates: { daily: c.rate, hourly: c.hourly, deposit: c.deposit, discount: R() < .1 ? pick([20, 30, 50]) : 0, delivery: fee(pk, pl, 'pick'), 'return': fee(rk, rl, 'ret'), others: R() < .06 ? 30 : 0 },
    cover: pkgPick ? { packageId: pkgPick.id, name: pkgPick.name, daily: pkgPick.daily, max: pkgPick.max } : null,
    pickKind: pk, pickLoc: pl, pickNote: pk === 'client' ? addr : pk === 'place' && R() < .5 ? 'Flight arrives ' + pick(['9:40 am', '1:15 pm', '6:05 pm']) : '',
    retKind: rk, retLoc: rl, retNote: rk === 'client' ? addr : '', note: R() < .15 ? pick(['Customer asked for a baby seat', 'Please fill the tank before handover', 'Customer will pay the balance in cash at pick-up', 'Wedding trip, please give a clean car']) : '' });
  if (b.rates.others) b.note = b.note || 'Child seat RM 30.00';
  var who = function () { return pick(agents.length ? agents : desk); };
  b.log.push({ at: b.created, by: b.createdBy, text: 'Booking made' + (src !== 'Staff' ? ' (' + src + ')' : '') });
  /* status by time */
  var s = start, e = end, status;
  if (e < nowT - 3 * DAY) status = 'Completed';
  else if (e < nowT) status = R() < .7 ? 'Car Returned' : 'Completed';
  else if (s <= nowT) status = 'Car Delivered';
  else if (s - nowT < 2 * DAY) status = pick(['Agreement Signed', 'Agreement Signed', 'Agreement Signed', 'Agreement Sent', 'Confirmed']);
  else status = pick(['Pending', 'Confirmed', 'Confirmed', 'Agreement Sent', 'Agreement Signed']);
  var cancelled = R() < .06;
  b.bookingStatus = cancelled ? 'Cancelled' : status;
  var m0 = calcBooking(b), at = function (t) { if (t > nowT - 5 * MIN) { var c0 = new Date(b.created).getTime(); t = c0 + (nowT - 5 * MIN - c0) * R(); } return new Date(t).toISOString(); };
  var pay = function (t, items, method) {
    var p = newPayment({ at: at(t), items: items, method: method, by: pick(desk) });
    if (method === 'Cash') p.cashTo = pick(desk.concat(agents));
    if (method === 'Online Transfer') { p.slip = 'demo:slip:Bank slip'; p.slipHash = uid(); p.ref = (R() < .5 ? 'M' : 'C') + ri(100000000, 999999999); }
    if (method === 'Card') p.afterCharge = Math.round((payTotal(p) * (1 - st.cardFee.pct / 100) - st.cardFee.fixed) * 100) / 100;
    b.payments.push(p); return p;
  };
  var depMethod = pick(['Online Transfer', 'Online Transfer', 'Cash', 'Card']), restMethod = pick(['Online Transfer', 'Cash', 'Cash', 'Card']);
  var chargeItems = function (part) {
    var it = [{ kind: 'Rental payment', amt: Math.round((m0.rent - m0.discount + m0.others) * part) }];
    if (part === 1) { if (m0.delivery) it.push({ kind: 'Delivery charge', amt: m0.delivery }); if (m0['return']) it.push({ kind: 'Return charge', amt: m0['return'] }); if (m0.coverTotal) it.push({ kind: 'Damage coverage', amt: m0.coverTotal }); }
    return it;
  };
  var created0 = new Date(b.created).getTime();
  var signed = ['Agreement Signed', 'Car Delivered', 'Car Returned', 'Completed'].indexOf(status) >= 0;
  if (!cancelled) {
    if (status === 'Agreement Sent' || signed) b.log.push({ at: at(created0 + HOUR), by: b.createdBy === 'Website' ? pick(desk) : b.createdBy, text: 'Agreement sent to the customer' });
    if (signed) { b.submitted = true; b.submittedAt = at(created0 + ri(2, 20) * HOUR); b.log.push({ at: b.submittedAt, by: 'Customer', text: 'Customer signed the booking form' }); }
    var full = function () { pay(created0 + 2 * HOUR, [{ kind: 'Security deposit', amt: m0.deposit }], depMethod); pay(Math.min(s, created0 + ri(3, 30) * HOUR), chargeItems(1), restMethod); };
    if (status === 'Completed' || status === 'Car Returned') { full(); b.paymentStatus = status === 'Completed' ? 'Deposit Refunded' : 'Refund Pending'; if (status === 'Car Returned') b.refundPendingAt = new Date(e).toISOString(); }
    else if (status === 'Car Delivered') { if (R() < .72) { full(); b.paymentStatus = 'Full Payment Received'; } else { pay(created0 + 2 * HOUR, [{ kind: 'Security deposit', amt: m0.deposit }], depMethod); pay(s, chargeItems(.5), restMethod); b.paymentStatus = 'Deposit Received'; } }
    else if (status === 'Agreement Signed') { var x = R(); if (x < .55) { pay(created0 + 3 * HOUR, [{ kind: 'Security deposit', amt: m0.deposit }], depMethod); b.paymentStatus = 'Deposit Received'; } else if (x < .75) { full(); b.paymentStatus = 'Full Payment Received'; } else b.paymentStatus = 'Deposit Due'; }
    else if (status === 'Agreement Sent') b.paymentStatus = R() < .5 ? 'Deposit Due' : null;
    else if (status === 'Confirmed' && R() < .35) { pay(created0 + 3 * HOUR, [{ kind: 'Security deposit', amt: m0.deposit }], depMethod); b.paymentStatus = 'Deposit Received'; }
    /* handover and return */
    if (status === 'Car Delivered' || status === 'Car Returned' || status === 'Completed') {
      var ag = who(), km0 = Math.max(1000, c.km - ri(300, 4000));
      b.assigned = [ag];
      b.inspection.agent = { photos: { handover: ['demo:car:Front', 'demo:car:Back', 'demo:car:Left', 'demo:car:Right'], id: 'demo:ic:IC', licence: 'demo:licence:Licence', odometer: 'demo:odo:' + pad(km0, 6) }, km: km0, fuel: pick(['Full', 'Full', '3/4']), note: '', at: at(s + ri(-5, 25) * MIN), gps: { lat: COMPANIES[d.co].lat + (R() - .5) * .05, lng: COMPANIES[d.co].lng + (R() - .5) * .05 }, by: ag };
      if (R() < .6) b.inspection.customer = { photos: ['demo:car:Front', 'demo:car:Side', 'demo:car:Dashboard'], at: at(s + 10 * MIN) };
      b.log.push({ at: b.inspection.agent.at, by: ag, text: 'Car handed over at ' + placeTextRaw(st, b, 'pick') + ' (' + b.inspection.agent.fuel + ', ' + km0.toLocaleString('en-US') + ' km)' });
      if (status !== 'Car Delivered') {
        b.returnKm = km0 + ri(80, 900); b.returnFuel = pick(['Full', '3/4', '1/2']);
        b.log.push({ at: at(e + ri(-30, 30) * MIN), by: ag, text: 'Car returned at ' + placeTextRaw(st, b, 'ret') + ' (' + b.returnFuel + ', ' + b.returnKm.toLocaleString('en-US') + ' km)' });
      }
      if (status === 'Completed') b.log.push({ at: at(e + DAY), by: pick(desk), text: 'Booking completed' });
    } else if (status === 'Agreement Signed' && agents.length) b.assigned = [who()];
  } else {
    b.cancelReason = pick(['Customer cancelled', 'Customer cancelled', 'No-show', 'Car problem']);
    if (R() < .4) { pay(created0 + 2 * HOUR, [{ kind: 'Security deposit', amt: m0.deposit }], depMethod); b.paymentStatus = 'Deposit Received'; }
    b.log.push({ at: at(created0 + DAY), by: pick(desk), text: 'Booking cancelled: ' + b.cancelReason });
  }
  return b;
}
function placeTextRaw(st, b, end) { /* placeText before S exists */
  var k = end === 'ret' ? b.retKind : b.pickKind, id = end === 'ret' ? b.retLoc : b.pickLoc;
  if (k === 'our') return (byId(st.locations, id) || {}).name || 'our location';
  if (k === 'place') return (byId(st.places, id) || {}).name || 'the place';
  return 'the customer’s address';
}
function seedChats(d, R) {
  var now = Date.now(), t = function (minsAgo) { return new Date(now - minsAgo * MIN).toISOString(); }, st = d.settings, c = d.cars;
  var S1 = 's1', S2 = 's2', S3 = 's3', S4 = 's4';
  d.staffChat = [
    { id: uid(), from: S2, text: 'Morning all. ' + c[2].plate + ' is back from the car wash.', at: t(300) },
    { id: uid(), from: S3, text: 'Thanks! I have 2 pick-ups at ' + st.places[0].name + ' this afternoon.', at: t(260) },
    { id: uid(), from: S1, text: 'Noted. Please take photos of all four sides at handover.', at: t(255) },
    { id: uid(), from: S4, text: 'Customer for ' + c[5].plate + ' asked to return 2 hours later. I said OK, no extra charge.', at: t(90) },
    { id: uid(), from: S2, text: 'Ok boss', at: t(85) }
  ];
  var day = sod(new Date()).getTime(), sat = day + ((6 - new Date().getDay() + 7) % 7 || 7) * DAY;
  var myvi = c.filter(function (x) { return x.model === 'Myvi'; })[0] || c[2], x50 = c.filter(function (x) { return x.model === 'X50'; })[0] || c[5];
  var booked = d.bookings.filter(function (b) { return b.bookingStatus === 'Agreement Signed'; })[0];
  d.wa = [
    { id: 'wa1', name: 'Faizal Hassan', phone: fmtPhone('0127788123'), status: 'Lead', unread: 2, handled: 'bot', msgs: [
      { from: 'cust', text: 'Hi, is a Myvi available this Saturday to Monday?', at: t(42) },
      { from: 'bot', text: 'Hi Faizal! Yes, a ' + myvi.make + ' ' + myvi.model + ' is free from Sat to Mon. That is 2 days at ' + rm(myvi.rate) + ' a day, so ' + rm(myvi.rate * 2) + ', plus a ' + rm(myvi.deposit) + ' deposit that we return after the trip. Where would you like to pick it up?', at: t(41) },
      { from: 'cust', text: st.places[st.places.length - 1].name + ' please. Can I pay half first?', at: t(12) },
      { from: 'cust', text: 'And do you deliver?', at: t(11) }],
      lead: { state: 'waiting', start: new Date(sat + 10 * HOUR).toISOString(), end: new Date(sat + 2 * DAY + 10 * HOUR).toISOString(), car: myvi.id, holdUntil: new Date(now + 18 * MIN).toISOString(),
        pickKind: 'place', pickLoc: st.places[st.places.length - 1].id, pickNote: '', retKind: 'place', retLoc: st.places[st.places.length - 1].id, retNote: '', estimate: myvi.rate * 2, deposit: myvi.deposit, question: 'Can I pay half first? Do you deliver?', takenBy: null, takenAt: null, closedAt: null, bookingId: null, km: 14, at: t(42) } },
    { id: 'wa2', name: booked ? d.customers.filter(function (x) { return x.id === booked.cust; })[0].name : 'Tan Bee Choo', phone: booked ? d.customers.filter(function (x) { return x.id === booked.cust; })[0].phone : fmtPhone('0163344556'), status: 'Booked', unread: 0, handled: 'staff', msgs: [
      { from: 'cust', text: 'I have sent the transfer slip for my booking.', at: t(400) },
      { from: 'staff', by: S1, text: 'Received, thank you! See you soon.', at: t(380) }],
      lead: { state: 'booked', start: booked ? booked.start : null, end: booked ? booked.end : null, car: booked ? booked.car : null, bookingId: booked ? booked.id : null, takenBy: S1, takenAt: t(420), at: t(500) } },
    { id: 'wa3', name: 'Ahmad Danial', phone: fmtPhone('0192233445'), status: 'Asking price', unread: 1, handled: 'bot', msgs: [
      { from: 'cust', text: 'How much for an SUV for 1 week?', at: t(130) },
      { from: 'bot', text: 'For 7 days a ' + x50.make + ' ' + x50.model + ' is ' + rm(x50.rate * 7) + ' (' + rm(x50.rate) + ' a day). It needs a ' + rm(x50.deposit) + ' deposit. Would you like me to hold one for you?', at: t(129) },
      { from: 'cust', text: 'Can give discount ah?', at: t(60) }],
      lead: { state: 'assistant', start: new Date(day + 4 * DAY + 9 * HOUR).toISOString(), end: new Date(day + 11 * DAY + 9 * HOUR).toISOString(), car: x50.id, holdUntil: null, pickKind: 'our', pickLoc: 'L1', retKind: 'our', retLoc: 'L1', estimate: x50.rate * 7, deposit: x50.deposit, question: 'Can give discount?', takenBy: null, at: t(130) } },
    { id: 'wa4', name: '', phone: fmtPhone('+65 9123 4567'), status: 'Lead', unread: 0, handled: 'bot', msgs: [
      { from: 'cust', text: 'Hello, need a 7 seater for 3 days next week, family trip', at: t(220) },
      { from: 'bot', text: 'Hello! We have MPVs from ' + rm(200) + ' a day. Which day would you like to pick up?', at: t(219) }],
      lead: { state: 'assistant', start: null, end: null, car: null, question: '7 seater for 3 days next week', takenBy: null, at: t(220) } },
    { id: 'wa5', name: 'Lina Marlina', phone: fmtPhone('0135566778'), status: 'Closed', unread: 0, handled: 'staff', msgs: [
      { from: 'cust', text: 'Never mind, I found a car already. Thanks', at: t(3000) },
      { from: 'staff', by: S3, text: 'No problem, have a good trip!', at: t(2990) }],
      lead: { state: 'closed', closedAt: t(2990), takenBy: S3, at: t(3100) } }
  ];
  d.assistant = { on: true, by: S1, at: t(5000) };
  d.notifs = [
    { id: uid(), kind: 'wa', title: 'Faizal Hassan on WhatsApp', body: 'And do you deliver?', at: t(11), read: false, link: '#chat/wa/wa1' },
    { id: uid(), kind: 'staff', title: 'Ravi in Team chat', body: d.staffChat[3].text, at: t(90), read: false, link: '#chat/staff' }
  ];
  var up = d.bookings.filter(function (b) { return UPCOMING.indexOf(b.bookingStatus) >= 0 && new Date(b.start) > now; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
  if (up) d.notifs.push({ id: uid(), kind: 'new', title: 'New booking ' + up.code, body: nameOf(d.customers, up.cust) + ' · ' + carName(d.cars, up.car) + ' · ' + when(up.start), at: t(150), read: true, link: '#booking/' + up.id });
}

/* ---------------- everything else, built from cars, customers and bookings ---------------- */
function seedExtras(d) {
  var R = rng({ kilat: 71, padi: 83, bara: 97 }[d.co] || 5), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var now = Date.now(), base = sod(new Date()).getTime(), iso = function (t) { return new Date(Math.min(t, now - MIN)).toISOString(); };
  S = d;
  if (!d.settings) d.settings = companySettings(d.co);
  if (!d.staff) d.staff = seedStaff(d.co, R);
  if (!d.me || !byId(d.staff, d.me)) d.me = 's1';
  var st = d.settings, staffIds = d.staff.map(function (p) { return p.id; }), agents = d.staff.filter(function (p) { return p.isAgent && p.active; }).map(function (p) { return p.id; }), desk = d.staff.filter(function (p) { return ['owner', 'manager', 'frontdesk'].indexOf(p.role) >= 0; }).map(function (p) { return p.id; });
  if (!agents.length) agents = desk;
  /* what each car's odometer showed over time, from the handovers and returns */
  var kmPoints = function (c) {
    var pts = [];
    d.bookings.forEach(function (b) {
      if (b.car !== c.id || !b.inspection || !b.inspection.agent || !b.inspection.agent.km) return;
      var ag = b.inspection.agent; pts.push({ t: new Date(ag.at).getTime(), km: +ag.km, src: 'handover', by: ag.by, booking: b.id });
      if (b.returnKm) { var rl = (b.log || []).filter(function (l) { return /^Car returned at /.test(l.text); })[0]; pts.push({ t: new Date(rl ? rl.at : b.end).getTime(), km: +b.returnKm, src: 'return', by: ag.by, booking: b.id }); }
    });
    return pts.filter(function (p) { return p.t < now; }).sort(function (a, b) { return a.t - b.t; });
  };
  var kmAt = function (c, t) { /* the reading at a time; before the first rental about 40 km a day less */
    var pts = kmPoints(c); if (!pts.length) return Math.max(1000, Math.round(c.km - Math.max(0, now - t) / DAY * 40));
    var before = pts.filter(function (p) { return p.t <= t; }); if (before.length) return before[before.length - 1].km;
    return Math.max(1000, Math.round(pts[0].km - (pts[0].t - t) / DAY * 40));
  };
  d.downtime = d.downtime || [];
  d.vendors = d.vendors || [
    { id: 'v1', name: { kilat: 'Bengkel Maju Jaya', padi: 'Bengkel Sri Kedah', bara: 'Ah Seng Motor Works' }[d.co], kind: 'Workshop', phone: fmtPhone('0123456701'), area: COMPANIES[d.co].city },
    { id: 'v2', name: 'Tayar Pro Centre', kind: 'Tyres', phone: fmtPhone('0167788902'), area: COMPANIES[d.co].city },
    { id: 'v3', name: 'Kilauan Car Wash', kind: 'Car wash', phone: fmtPhone('0139988123'), area: COMPANIES[d.co].city },
    { id: 'v4', name: 'Tunda 24 Jam', kind: 'Towing', phone: fmtPhone('0191122334'), area: COMPANIES[d.co].city }];
  /* papers: road tax and insurance for every car, PUSPAKOM for big cars */
  if (!d.papers) {
    d.papers = [];
    d.cars.forEach(function (c, i) {
      var rt = i === 3 ? -6 : i === 8 ? 12 : i === 17 ? 25 : ri(40, 340), ins = i === 3 ? -6 : i === 12 ? 9 : ri(40, 340);
      d.papers.push({ id: uid(), car: c.id, type: 'Road tax', until: toLocalInput(base + rt * DAY), insurer: '', cost: c.rate > 200 ? 380 : 90, ref: 'RT' + ri(100000, 999999), warnDays: 30, photo: null, at: iso(base + (rt - 365) * DAY), by: 's1' });
      d.papers.push({ id: uid(), car: c.id, type: 'Insurance', until: toLocalInput(base + ins * DAY), insurer: pick(['Etiqa', 'Allianz', 'Zurich', 'Takaful Malaysia', 'AmGeneral']), cost: Math.round(c.rate * 9.5), ref: 'POL-' + ri(1000000, 9999999), warnDays: 30, photo: null, at: iso(base + (ins - 365) * DAY), by: 's1' });
      if ((c.type === 'MPV' || c.type === 'SUV') && c.year < 2022) d.papers.push({ id: uid(), car: c.id, type: 'PUSPAKOM', until: toLocalInput(base + ri(-3, 200) * DAY), insurer: '', cost: 60, ref: 'PK' + ri(10000, 99999), warnDays: 21, photo: null, at: iso(base - 100 * DAY), by: 's1' });
    });
  }
  /* odometer readings */
  if (!d.odometer) {
    d.odometer = [];
    /* the readings come from the handovers and returns of the last 45 days, so they follow each other and match each booking */
    d.cars.forEach(function (c, i) {
      c.km = c.km || ri(20000, 120000);
      var pts = kmPoints(c), recent = pts.filter(function (p) { return p.t > base - 45 * DAY; }), firstKm = recent.length ? recent[0].km : c.km;
      d.odometer.push({ id: uid(), car: c.id, km: Math.max(1000, firstKm - ri(2500, 6000)), at: iso(base - ri(50, 90) * DAY), source: 'service', by: 's1', trusted: true, booking: null });
      recent.forEach(function (p) { d.odometer.push({ id: uid(), car: c.id, km: p.km, at: iso(p.t), source: p.src, by: p.by || pick(agents), trusted: true, booking: p.booking }); });
      var lastP = pts[pts.length - 1], out = d.bookings.some(function (b) { return b.car === c.id && b.bookingStatus === 'Car Delivered'; });
      if (!out && (!lastP || lastP.t < now - 6 * DAY)) d.odometer.push({ id: uid(), car: c.id, km: c.km, at: iso(Math.max(lastP ? lastP.t + DAY : 0, base - ri(0, 6) * DAY)), source: 'typed', by: pick(desk), trusted: true, booking: null });
      if (i === 5) d.odometer.push({ id: uid(), car: c.id, km: c.km - 30000, at: iso(base - 3 * DAY), source: 'handover', by: pick(agents), trusted: false, booking: null, note: 'Lower than the last reading' });
    });
  }
  /* maintenance jobs */
  if (!d.jobs) {
    d.jobs = [];
    var types = st.serviceTypes.map(function (x) { return x.name; });
    d.cars.forEach(function (c, i) {
      if (c.status === 'sold') return;
      var dn = ri(20, 160), km = Math.max(1000, kmAt(c, base - dn * DAY) - ri(0, 60));
      d.jobs.push({ id: uid(), car: c.id, type: 'Oil change', status: 'done', at: iso(base - dn * DAY), cost: ri(140, 320), km: km, vendor: 'v1', note: '', photo: i % 3 ? null : 'demo:receipt:Workshop bill', remindKm: 10000, remindDays: 180, by: pick(desk), created: iso(base - dn * DAY) });
      c.lastServiceKm = km; c.lastServiceAt = iso(base - dn * DAY);
      if (i % 6 === 2) d.jobs.push({ id: uid(), car: c.id, type: pick(['Tyres', 'Brake pads', 'Battery', 'Aircond']), status: 'planned', at: new Date(base + ri(1, 12) * DAY + 10 * HOUR).toISOString(), cost: 0, km: null, vendor: pick(['v1', 'v2']), note: 'Planned', photo: null, remindKm: null, remindDays: null, by: 's1', created: iso(base - 2 * DAY) });
      var rj; if (i % 11 === 7) d.jobs.push({ id: uid(), car: c.id, type: 'Repair', status: 'done', at: iso(base - (rj = ri(5, 40)) * DAY), cost: ri(250, 1800), km: kmAt(c, base - rj * DAY), vendor: 'v1', note: pick(['Side mirror replaced', 'Bumper respray', 'Aircond compressor']), photo: 'demo:receipt:Repair bill', remindKm: null, remindDays: null, by: 's2', created: iso(base - 10 * DAY) });
    });
    d.downtime.forEach(function (dt) { var j = { id: uid(), car: dt.car, type: 'Repair', status: 'workshop', at: dt.from, cost: dt.to ? 1450 : 0, km: (byId(d.cars, dt.car) || {}).km || null, vendor: 'v1', note: dt.reason, photo: null, remindKm: null, remindDays: null, by: dt.by || 's1', created: dt.from, backAt: dt.to }; d.jobs.push(j); dt.jobId = j.id; });
    /* one car is overdue for its oil change */
    var od = d.cars[2]; if (od) { od.lastServiceKm = od.km - 11200; od.lastServiceAt = iso(base - 200 * DAY); }
  }
  /* customer notes and the blacklist */
  if (!d.notes) {
    d.notes = [];
    var cs = d.customers;
    var note = function (i, flag, text, pinned, bkno) { if (!cs[i]) return; var bb = bkno ? d.bookings.filter(function (b) { return b.cust === cs[i].id; })[0] : null; d.notes.push({ id: uid(), cust: cs[i].id, flag: flag, text: text, pinned: !!pinned, by: pick(desk), at: iso(base - ri(3, 120) * DAY), booking: bb ? bb.id : null }); };
    note(3, 'vip', 'Regular corporate customer. Give a clean car and a full tank.', true); note(12, 'vip', 'Books every school holiday. Offer the family MPV first.'); note(20, 'vip', 'Pays on time, always returns early.');
    note(9, 'careful', 'Returned late twice. Ask for the full deposit before handover.', true, true); note(9, 'careful', 'Smoker: check the car for smell at return.');
    note(14, 'careful', 'Argued about the fuel charge last time.', false, true);
    note(1, 'info', 'Prefers delivery to the office in the morning.'); note(5, 'info', 'Needs a baby seat.'); note(25, 'info', 'Speaks Tamil and English.');
    if (cs[17]) { cs[17].blacklist = { reason: 'Car returned with damage and did not pay for the repair', by: 's1', at: iso(base - 60 * DAY) }; if (!cs[17].ic) cs[17].ic = '901212-10-5521'; }
  }
  /* deposits: adjustments and refunds for returned bookings */
  if (!d.deductions) {
    d.deductions = []; d.refunds = d.refunds || [];
    d.bookings.forEach(function (b, i) {
      var m = calcBooking(b);
      if (b.paymentStatus === 'Deposit Refunded' && m.depositReceived > 0) {
        var ded = 0;
        if (i % 5 === 1) { ded = pick([20, 30, 40]); d.deductions.push({ id: uid(), booking: b.id, kind: pick(['Fuel', 'Cleaning', 'Late return fee']), amt: ded, note: pick(['Tank was at 1/2', 'Sand in the car', 'Returned 2 hours late']), photo: null, by: pick(desk), at: iso(new Date(b.end).getTime() + HOUR), paymentId: null }); }
        var method = pick(['Bank transfer', 'Bank transfer', 'Cash']);
        d.refunds.push({ id: uid(), booking: b.id, amt: m.depositReceived - ded, method: method, slip: method === 'Bank transfer' ? 'demo:slip:Refund slip' : null, slipHash: uid(), ref: method === 'Bank transfer' ? 'IBG' + ri(1000000, 9999999) : '', at: iso(new Date(b.end).getTime() + ri(4, 40) * HOUR), by: pick(desk), note: '', voided: false });
        b.log.push({ at: d.refunds[d.refunds.length - 1].at, by: d.refunds[d.refunds.length - 1].by, text: 'Deposit returned: ' + rm(m.depositReceived - ded) + ' by ' + method.toLowerCase() });
      }
    });
  }
  d.refunds = d.refunds || [];
  /* tasks for handovers */
  if (!d.tasks) {
    d.tasks = [];
    d.bookings.forEach(function (b) {
      if (b.bookingStatus === 'Cancelled' || new Date(b.start) < base - 10 * DAY || new Date(b.start) > base + 10 * DAY) return;
      if (['Agreement Signed', 'Car Delivered', 'Car Returned', 'Completed'].indexOf(b.bookingStatus) < 0) return;
      var ag = b.assigned && b.assigned[0] ? b.assigned[0] : pick(agents); b.assigned = [ag];
      var cu = byId(d.customers, b.cust) || {}, c = byId(d.cars, b.car) || {};
      var outDone = b.bookingStatus !== 'Agreement Signed', inDone = b.bookingStatus === 'Car Returned' || b.bookingStatus === 'Completed';
      var typeOf = function (end) { var k = end === 'ret' ? b.retKind : b.pickKind, id = end === 'ret' ? b.retLoc : b.pickLoc; if (k === 'our') return (end === 'ret' ? 'Return to our location, ' : 'Delivery from our location, ') + ((byId(st.locations, id) || {}).short || ''); if (k === 'client') return end === 'ret' ? 'Return from client' : 'Delivery to client'; return (end === 'ret' ? 'Return from ' : 'Delivery to ') + ((byId(st.places, id) || {}).name || ''); };
      d.tasks.push({ id: uid(), name: (b.pickKind === 'our' ? 'Hand over ' : 'Deliver ') + c.plate + ' to ' + firstName(cu.name), type: typeOf('pick'), booking: b.id, staff: [ag], at: b.start, status: outDone ? 'Completed' : 'Pending', note: b.pickNote || '', photos: [], voice: [], wa: { }, auto: true, by: 'Auto-assign', created: iso(new Date(b.start).getTime() - 2 * DAY) });
      d.tasks.push({ id: uid(), name: 'Collect ' + c.plate + ' from ' + firstName(cu.name), type: typeOf('ret'), booking: b.id, staff: [ag], at: b.end, status: inDone ? 'Completed' : 'Pending', note: b.retNote || '', photos: [], voice: [], wa: {}, auto: true, by: 'Auto-assign', created: iso(new Date(b.start).getTime() - 2 * DAY) });
      d.tasks[d.tasks.length - 2].wa[ag] = outDone ? 'Reply received' : pick(['Template sent', 'Reply received', 'Details sent']);
      d.tasks[d.tasks.length - 1].wa[ag] = inDone ? 'Reply received' : 'Template sent';
    });
    d.tasks.push({ id: uid(), name: 'Send ' + (d.cars[2] || {}).plate + ' for car wash', type: 'General', booking: null, staff: [agents[0]], at: new Date(base + 15 * HOUR).toISOString(), status: 'Pending', note: 'Before 5 pm', photos: [], voice: [], wa: {}, auto: false, by: 's2', created: iso(base) });
    d.tasks.push({ id: uid(), name: 'Top up coolant for ' + (d.cars[7] || {}).plate, type: 'General', booking: null, staff: [agents[agents.length - 1]], at: new Date(base + DAY + 11 * HOUR).toISOString(), status: 'In Progress', note: '', photos: [], voice: [], wa: {}, auto: false, by: 's1', created: iso(base - DAY) });
  }
  d.autoRules = d.autoRules || [{ id: 'ar1', kind: 'everything', car: null, location: null, staff: [agents[0]] }];
  /* summons */
  if (!d.summons) {
    d.summons = [];
    var past = d.bookings.filter(function (b) { return (b.bookingStatus === 'Completed' || b.bookingStatus === 'Car Returned') && new Date(b.end) > base - 40 * DAY; });
    var offences = [['PDRM', 'Speeding 92 km/h in a 70 zone', 150], ['JPJ', 'Beating the red light', 300], ['DBKL', 'Parking without a coupon', 30], ['PDRM', 'Using a phone while driving', 300], ['MBPP', 'Double parking', 50], ['PDRM', 'Speeding 128 km/h in a 110 zone', 150]];
    var statuses = ['Needs review', 'Ready to charge', 'Charged', 'Paid', 'Charged', 'Waived'];
    for (var si = 0; si < 6 && si < past.length; si++) {
      var b = past[(si * 3) % past.length], c = byId(d.cars, b.car), o = offences[si], tt = new Date(b.start).getTime() + (new Date(b.end) - new Date(b.start)) * .4;
      var sm = { id: uid(), car: c.id, booking: b.id, authority: o[0], notice: o[0] + '/' + ri(100000, 999999), plate: c.plate, at: new Date(tt).toISOString(), offence: o[1], amount: o[2], status: statuses[si], photo: 'demo:summons:Notice', chargedAmt: null, chargedAt: null, paidAt: null, reason: si === 5 ? 'First offence, customer is a regular' : '', by: pick(desk), created: iso(tt + 7 * DAY) };
      if (sm.status === 'Charged' || sm.status === 'Paid') { sm.chargedAmt = o[2] + (st.summonsAdminFee || 0); sm.chargedAt = iso(tt + 8 * DAY); }
      if (sm.status === 'Paid') sm.paidAt = iso(tt + 9 * DAY);
      d.summons.push(sm); b.summonsIds = (b.summonsIds || []).concat(sm.id);
    }
    var idle = d.cars[1]; if (idle) d.summons.push({ id: uid(), car: idle.id, booking: null, authority: 'DBKL', notice: 'DBKL/' + ri(100000, 999999), plate: idle.plate, at: iso(base - 9 * DAY + 3 * HOUR), offence: 'Parking on a yellow line', amount: 50, status: 'No booking', photo: 'demo:summons:Notice', chargedAmt: null, chargedAt: null, paidAt: null, reason: '', by: 's1', created: iso(base - 2 * DAY) });
  }
  /* money: expenses, handover fees, bank-ins, instalments */
  if (!d.expenses) {
    d.expenses = [];
    var kinds = st.expenseKinds, kOf = function (id) { return kinds.filter(function (k) { return k.id === id; })[0]; };
    var exp = function (kindName, amt, t, o) { d.expenses.push(Object.assign({ id: uid(), kind: kindName, amt: amt, at: iso(t), car: null, booking: null, paidWith: pick(['Cash', 'Cash', 'Bank transfer', 'Card', 'E-wallet']), paidTo: '', note: '', receipt: R() < .7 ? 'demo:receipt:Receipt' : null, by: pick(staffIds), created: iso(t), agentFee: false, group: null, changedBy: null, changedAt: null, voided: false }, o || {})); };
    for (var ei = 0; ei < 50; ei++) {
      var kk = pick(['fuel', 'fuel', 'fuel', 'wash', 'wash', 'toll', 'parking', 'taxi', 'meal', 'service', 'tyres', 'repair', 'stationery']), kd = kOf(kk), c2 = pick(d.cars);
      var amt = { fuel: ri(40, 120), wash: ri(15, 30), toll: ri(3, 25), parking: ri(2, 15), taxi: ri(12, 45), meal: 15, service: ri(150, 400), tyres: ri(300, 900), repair: ri(120, 1500), stationery: ri(10, 80) }[kk];
      exp(kd.name, amt, base - ri(0, 62) * DAY + ri(8, 19) * HOUR, { car: kd.needsCar ? c2.id : null, paidTo: { fuel: pick(['Petronas', 'Shell', 'Petron']), wash: 'Kilauan Car Wash', service: 'Bengkel', tyres: 'Tayar Pro Centre' }[kk] || '' });
    }
    [0, 1, 2].forEach(function (mo) { var t0 = new Date(new Date().getFullYear(), new Date().getMonth() - mo, 1, 10).getTime(); exp('Office rent', d.co === 'padi' ? 1800 : 3500, t0, { by: 's1', paidWith: 'Bank transfer', paidTo: 'Landlord' }); exp('Phone and internet', 189, t0 + 4 * DAY, { by: 's1', paidWith: 'Card', paidTo: 'Telco' }); });
    /* handover fees the agents recorded */
    d.bookings.forEach(function (b) {
      if (!b.inspection || !b.inspection.agent) return;
      var ag = b.inspection.agent.by; if (!byId(d.staff, ag)) return;
      var k1 = handoverKind(b, 'pick'); if (k1) exp(k1, feeFor(k1, ag), new Date(b.start).getTime() + HOUR, { by: ag, booking: b.id, car: b.car, agentFee: true, group: 'delivery', paidWith: 'Cash', receipt: null });
      if (b.returnKm) { var k2 = handoverKind(b, 'ret'); if (k2) exp(k2, feeFor(k2, ag), new Date(b.end).getTime() + HOUR, { by: ag, booking: b.id, car: b.car, agentFee: true, group: 'return', paidWith: 'Cash', receipt: null }); }
    });
    /* money from the owner to field staff */
    agents.slice(0, 2).forEach(function (a) { exp('Float from the company', 300, base - ri(5, 20) * DAY, { by: 's1', paidTo: who(a), toStaff: a, paidWith: 'Cash', receipt: null, note: 'Cash float for fuel and tolls' }); });
  }
  if (!d.instalments) {
    d.instalments = [];
    d.cars.forEach(function (c, ci) {
      if (!c.instalment) return;
      for (var mo = -3; mo <= 2; mo++) {
        var due = new Date(new Date().getFullYear(), new Date().getMonth() + mo, c.instalment.day, 0, 0, 0);
        var paid = due.getTime() < base - (ci % 5 === 1 && mo === -1 ? 999 : 0) * DAY && !(ci === 1 && mo === 0) && due.getTime() < now;
        var row = { id: uid(), car: c.id, due: toLocalInput(due), amt: c.instalment.monthly, paidAt: paid ? toLocalInput(due) : null, paidAmt: paid ? c.instalment.monthly : null, paidWith: paid ? 'Bank transfer' : null, expenseId: null };
        if (paid) { var ex = { id: 'installment-' + row.id, kind: 'Hire purchase', amt: row.amt, at: iso(due.getTime() + 10 * HOUR), car: c.id, booking: null, paidWith: 'Bank transfer', paidTo: c.instalment.bank, note: 'Instalment ' + MO[due.getMonth()], receipt: null, by: 's1', created: iso(due.getTime() + 10 * HOUR), agentFee: false, group: null, voided: false }; d.expenses.push(ex); row.expenseId = ex.id; }
        d.instalments.push(row);
      }
    });
  }
  if (!d.bankIns) {
    d.bankIns = [];
    desk.slice(0, 3).forEach(function (p, i) { d.bankIns.push({ id: uid(), staff: p, amt: [800, 1250, 420][i], at: iso(base - (i * 3 + 2) * DAY + 16 * HOUR), slip: 'demo:slip:Cash deposit', slipHash: uid(), ref: 'CDM' + ri(100000, 999999), note: '', by: p, voided: false, voidReason: null }); });
  }
  /* trackers */
  if (!d.tracker) {
    var co0 = COMPANIES[d.co];
    d.tracker = d.cars.filter(function (c) { return c.status !== 'sold'; }).map(function (c, i) {
      var onRent = d.bookings.some(function (b) { return b.car === c.id && b.bookingStatus === 'Car Delivered'; }), moving = onRent && R() < .55, offline = i % 13 === 5;
      return { car: c.id, lat: co0.lat + (R() - .5) * (onRent ? .4 : .03), lng: co0.lng + (R() - .5) * (onRent ? .4 : .03), speed: moving ? ri(20, 125) : 0, ignition: moving, state: offline ? 'Offline' : moving ? 'Moving' : 'Parked', at: iso(now - (offline ? ri(300, 3000) : ri(0, 9)) * MIN), heading: ri(0, 359) };
    });
    d.alarms = [{ id: uid(), car: d.cars[4].id, kind: 'Power cut', at: iso(now - 190 * MIN) }, { id: uid(), car: d.cars[9].id, kind: 'Tow alarm', at: iso(now - 26 * HOUR) }];
  }
  d.alarms = d.alarms || [];
  /* lead fields on WhatsApp threads */
  (d.wa || []).forEach(function (w) { if (!w.lead) w.lead = { state: w.status === 'Booked' ? 'booked' : w.handled === 'bot' ? 'assistant' : 'waiting', start: null, end: null, car: null, takenBy: null, question: '', at: (w.msgs[0] || {}).at }; });
  d.assistant = d.assistant || { on: true, by: 's1', at: iso(now - 5 * DAY) };
  d.invoices = d.invoices || []; d.receipts = d.receipts || []; d.audit = d.audit || [];
  d.recentCars = d.recentCars || []; d.recentBookings = d.recentBookings || [];
  d.prefsBy = d.prefsBy || {};
  /* keep storage small: drop empty optional fields on seeded rows (a missing field means null) */
  d.bookings.forEach(function (b) { (b.payments || []).forEach(compactRow); if (new Date(b.end) < base - 7 * DAY && b.inspection && b.inspection.agent) { b.inspection.customer = null; b.inspection.agent.gps = null; } });
  d.expenses.forEach(compactRow); d.tasks.forEach(compactRow); (d.refunds || []).forEach(compactRow);
  return d;
}
function compactRow(o) { Object.keys(o).forEach(function (k) { if (o[k] === null || o[k] === '' || (k === 'voided' && o[k] === false && false)) delete o[k]; }); }

/* ---------------- v3 -> v4 ---------------- */
/* keeps the phone's own bookings, customers and chats; adds the new fields and the new kinds of data */
function migrateV3(j) {
  var co = j.co || CO, st = companySettings(co), R = rng(5), d = { v: DATA_VERSION, co: co, settings: st, staff: seedStaff(co, R), cars: j.cars || [], customers: j.customers || [], bookings: [], staffChat: [], wa: j.wa || [], notifs: j.notifs || [], nextNo: j.nextNo || COMPANIES[co].no, prefsBy: {} };
  S = d;
  var byName = {}; d.staff.forEach(function (p) { byName[p.name] = p.id; });
  var sid = function (n) { return byName[n] || n; };
  d.me = sid(j.me) && byId(d.staff, sid(j.me)) ? sid(j.me) : 's1';
  d.prefsBy[d.me] = Object.assign({}, PREF_DEFAULTS, j.prefs || {});
  var used = {};
  d.cars.forEach(function (c, k) { used[normPlate(c.plate)] = 1; c.type = c.type || CAR_TYPES[c.shape] || 'Sedan'; c.hourly = c.hourly || Math.max(10, Math.round(c.rate / 8)); c.status = c.status || 'active'; c.km = c.km || 30000 + k * 4100; c.serial = c.serial || 'PM2' + uid().toUpperCase().slice(0, 10); c.gallery = c.gallery || []; c.showOnWebsite = c.showOnWebsite !== false; c.instalment = c.instalment || null; c.owner = c.owner || null; c.serviceEveryKm = 10000; });
  /* add cars so the car picker has a real fleet to search */
  var want = { kilat: 44, padi: 14, bara: 42 }[co] || 20, R2 = rng(17);
  for (var k = d.cars.length; k < want; k++) { var nc = makeCar(co, k, R2, used); while (byId(d.cars, nc.id)) nc.id = 'car' + uid(); d.cars.push(nc); }
  d.customers.forEach(function (c, k) {
    var flag = c.flag; delete c.flag;
    var x = makeCustomer(k, c.name, R); x.id = c.id; x.phone = c.phone; Object.keys(x).forEach(function (kk) { if (c[kk] === undefined) c[kk] = x[kk]; });
    c.blacklist = flag === 'Blacklisted' ? { reason: 'Moved from the old app', by: 's1', at: new Date().toISOString() } : c.blacklist || null;
    if (flag === 'VIP' || flag === 'Be careful') { d.notes = d.notes || []; d.notes.push({ id: uid(), cust: c.id, flag: flag === 'VIP' ? 'vip' : 'careful', text: flag === 'VIP' ? 'VIP customer' : 'Be careful with this customer', pinned: true, by: 's1', at: new Date().toISOString(), booking: null }); }
  });
  if (d.notes) { /* keep the notes the migration made, and let seedExtras add the rest */ var keep = d.notes; delete d.notes; seedExtrasNotesKeep = keep; }
  var oldPlace = function (p) { /* old place names -> v4 kind/loc */
    p = String(p || '');
    if (/delivery|customer address/i.test(p)) return { kind: 'client', id: null };
    var pl = st.places.filter(function (x) { return x.name === p; })[0]; if (pl) return { kind: 'place', id: pl.id };
    if (/airport|klia|terminal/i.test(p)) return { kind: 'place', id: st.places[0].id };
    return { kind: 'our', id: st.locations[0].id };
  };
  var coverMap = function (id) { var ps = st.packages; if (id === 'basic') return ps[0]; if (id === 'full') return ps[ps.length - 1]; return null; };
  var now = Date.now();
  (j.bookings || []).forEach(function (o) {
    var m = String(o.code || '').match(/(\d+)$/), pp = oldPlace(o.pickPlace), rp = oldPlace(o.retPlace), c = byId(d.cars, o.car) || {}, pk = coverMap(o.cover);
    var status = { Confirmed: 'Confirmed', 'Picked up': 'Car Delivered', Returned: new Date(o.end) < now - 3 * DAY ? 'Completed' : 'Car Returned', Cancelled: 'Cancelled' }[o.status] || 'Confirmed';
    var b = blankBooking({ id: o.id, no: m ? +m[1] : 0, code: o.code, cust: o.cust, car: o.car, start: o.start, end: o.end, created: clampNow(o.created || o.start), createdBy: sid(o.createdBy) || 's1', source: o.source || 'Staff',
      bookingStatus: status, rates: { daily: +o.rate || c.rate || 0, hourly: c.hourly || Math.round((+o.rate || 0) / 8), deposit: +o.deposit || 0, discount: 0, delivery: 0, 'return': 0, others: (o.extras || []).reduce(function (s, e) { return s + (+e.amt || 0); }, 0) },
      cover: pk ? { packageId: pk.id, name: pk.name, daily: pk.daily, max: pk.max } : null, pickKind: pp.kind, pickLoc: pp.id, pickNote: pp.kind === 'client' ? 'Customer address' : '', retKind: rp.kind, retLoc: rp.id, retNote: rp.kind === 'client' ? 'Customer address' : '',
      note: o.note || '', log: (o.log || []).map(function (l) { return { at: clampNow(l.at), by: sid(l.by), text: l.text }; }) });
    b.rates.delivery = pp.kind === 'client' ? st.clientDeliveryFee : pp.kind === 'place' ? byId(st.places, pp.id).deliveryFee : 0;
    b.rates['return'] = rp.kind === 'client' ? st.clientReturnFee : rp.kind === 'place' ? byId(st.places, rp.id).returnFee : 0;
    b.payments = (o.payments || []).map(function (p) { return newPayment({ id: p.id, at: clampNow(p.at), items: [{ kind: p.kind === 'Deposit' ? 'Security deposit' : 'Rental payment', amt: +p.amt || 0 }], method: p.method || 'Cash', by: sid(p.by), cashTo: p.method === 'Cash' ? sid(p.by) : null }); });
    if (status !== 'Pending' && status !== 'Cancelled' && status !== 'Confirmed') { b.submitted = true; b.submittedAt = b.created; }
    var mm = calcBooking(b);
    if (status === 'Car Returned') b.paymentStatus = mm.deposit > 0 ? 'Refund Pending' : 'Deposit Refunded';
    else if (status === 'Completed') b.paymentStatus = 'Deposit Refunded';
    else if (mm.due <= 0 && mm.received > 0) b.paymentStatus = 'Full Payment Received';
    else if (mm.depositReceived >= mm.deposit && mm.deposit > 0) b.paymentStatus = 'Deposit Received';
    else if (b.submitted) b.paymentStatus = 'Deposit Due';
    if (status === 'Car Delivered' || status === 'Car Returned' || status === 'Completed') b.inspection.agent = { photos: { handover: [], id: null, licence: null, odometer: null }, km: c.km || null, fuel: 'Full', note: 'Moved from the old app', at: b.start, gps: null, by: d.me };
    if (b.no >= d.nextNo) d.nextNo = b.no + 1;
    d.bookings.push(b);
  });
  d.staffChat = (j.staffChat || []).map(function (m) { return { id: m.id || uid(), from: sid(m.from), text: m.text, at: clampNow(m.at) }; });
  d.wa.forEach(function (w) { (w.msgs || []).forEach(function (m) { if (m.by) m.by = sid(m.by); }); });
  d.staffUnread = j.staffUnread || 0; d.dueSeen = j.dueSeen || {};
  seedExtras(d);
  if (seedExtrasNotesKeep) { d.notes = seedExtrasNotesKeep.concat(d.notes || []); seedExtrasNotesKeep = null; }
  return d;
}
var seedExtrasNotesKeep = null;
