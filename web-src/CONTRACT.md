# Web sample: shared contract for the parity build

What the web core build added to the shared files, for the page builders. Read `BUILDERS.md` (page contract, UI kit,
data) first; this file only lists what is new or changed. Shared files stay read only for page builders: ask for changes
in your report.

Build: `python3 web-src/build.py` (writes `app/index.html`). Every `src/pages/*.js` and `*.css` is picked up by itself.

## 1. How a page registers (unchanged, short form)

```js
PAGES['income'] = {
  title: 'Income',
  render: function (root, ctx) { root.innerHTML = '...'; /* or return an HTML string */ },
  onData: function (root, ctx, ev) { /* optional */ },
  search: [{ label: 'Income by person', icon: 'coins', run: function (ctx) { ... } }]   // optional
};
```

- The menu entry, icon and the permission that opens the page live in `PAGE_META` (`shell.js`); the sidebar order lives
  in `DEFAULT_MENU` (`data.js`). Prefix CSS with `.pg-<id>`.
- New pages (stubs today, filled by the package builders): `leads.js` (Booking assistant, `leads.view`),
  `staff-reports.js` (Staff income and expenses, `expenses.view`), `income.js` (Income, `expenses.view`).
  Menu order follows the reference: Bookings, Customers, **Booking assistant**, Signatures, Damage Packages, Reports,
  Invoices, **Staff income and expenses**, Expenses, **Income**, Summons, Deposit refunds.
  Old addresses `#page=staff-report`, `#page=assistant` go to the new pages.
- New cross-page openers (stubs in `shell.js`; the owner replaces them in their page file):

| Call | Owner | Stub today |
|---|---|---|
| `API.bankIn(userId)` | invoices.js (`invBankInSheet`) | `#page=invoices&tab=cash&action=bankin&staff=` |
| `API.openLead(id)` | leads.js | `#page=leads&lead=` |
| `API.openStaffReport(userId, params)` | staff-reports.js | `#page=staff-reports&person=` |
| `API.openIncome(userId)` | income.js | `#page=income&person=` |
| `API.makeHandoverTasks(code)` | tasks.js | `#page=tasks&action=handover&booking=` |

  The search palette has a "Bank in cash" action (`expenses.view`) that calls `API.bankIn()`.
- `build.py` now also finds icons written as `icon: 'name'` and the `PAGE_META` icons, and adds any missing Tabler icon.

## 2. UI kit additions (`ui.js`, styles in `ui.css`)

### 2.1 Money and dates

- `UI.fmt.money(v)` always gives 2 decimals: `RM 1,234.50`; a minus is `-RM 20.00` (no space). `{dp: 0}` still exists.
- `UI.fmt.date(d)` `19 Oct 2026`; `UI.fmt.dt(d)` (= `dateTime`) `19 Oct 2026, 3:00 PM`.
- Table money columns: `{key: 'amount', label: 'Amount', money: true}` centres the column (header too), keeps it on one
  line and, without a `render`, prints `UI.fmt.money(row[key])` (`-` when empty). With a `render` it only centres.

### 2.2 Searchable pickers (mounted)

Put an empty element in your HTML, then mount. Each picker keeps its value in a hidden `<input data-key="...">`
(so `UI.form(el)` reads it) and fires `input` and `change` on it. Under 640px the list opens as a full-height sheet,
otherwise as a dropdown under the field. Typing on the closed field opens it with that letter; arrows, Enter, Escape
work; the last 5 picks show first under "Recent" (per company, per picker kind).

```js
// drawer body built as a string? mount after it is in the DOM:
UI.drawer({ title: 'Log a service', body: function (el) {
  el.innerHTML = '<div class="col gap16"><div data-car></div>...</div>';
  var cp = UI.carPicker(el.querySelector('[data-car]'), { key: 'car', label: 'Car', required: true, value: carId,
    start: s, end: e, exceptId: bookingCode, onChange: function (id, car) { ... } });
} });
```

- `UI.combo(el, o)`: the base. `o`: `key, label, required, help, error, placeholder, value` (or `values` + `multi: true`),
  `items` (array or `function (state)`), `search(item, q)` (return false/true or a score, higher first), `recentKey`,
  `title` (sheet title), `emptyText`, `noMatchHelp`, `clearable` (default on unless required), `toggles: [{key, label, value}]`,
  `onChange(value, item, ctrl)`, `disabled`, `full`. Item: `{value, label, sub, badge: {text, tone} | html, icon, html, kw, group, disabled, hint}`.
  Returns `{el, value(), item(), set(v, silent), open(q), close(), refresh(), setItems(items), setError(msg)}`.
- `UI.carPicker(el, {key: 'car', label, start, end, exceptId, value, onChange(id, car), cars, hideInactive, badges, required})`:
  rows are the plate in bold, then model and colour, then a badge: `Free` (or `Free, back at 9:00 AM, 1 hr before`),
  `Booked KLT-00468 until 23 Oct`, `In workshop until 23 Oct`, `Not in use`, `Sold`. With dates free cars come first.
  Plate search ignores spaces and dashes (`vkp4418`). Extra: `ctrl.setDates(start, end, exceptId)`, `ctrl.car()`, `ctrl.busy()`.
  Without dates only fleet status and a workshop period covering now show.
- `UI.bookingPicker(el, {key: 'booking', label, value, filter(b), onChange(code, booking), showCancelled, bookings})`:
  finds by code in any form (`3`, `00003`, `KLT 3`), name words, phone digits in any format, or plate. Every match shows
  (no cap), newest first. A "Show cancelled bookings" switch; if only cancelled ones match it says so with a "Show them" button.
  Extra: `ctrl.booking()`.
- `UI.staffPicker(el, {key, label, value | values, multi, source: 'users' | 'employees', includeInactive, exclude, me, onChange})`:
  logins (user ids `usr-1`, default) or field agents (`emp-1`). The person signed in is marked "Me" (type "me" to find them).
  `multi: true` gives chips and a Done button; the hidden input holds the ids joined with commas.

### 2.3 Date fields (HTML strings, like `UI.input`)

- `UI.dateField({key, label, value, required, min, max, chips, help, error, disabled, placeholder, compact})`
- `UI.dateTimeField({... , step: 15})` adds a time list in 15-minute steps (`3:00 PM`).
- They always show `19 Oct 2026` whatever the browser language; tapping opens the browser's own calendar.
  Default chips: Today, Tomorrow (`chips: false` for none, or `[{label: '+1 day', days: 1}]`, days from today).
- The value sits in a hidden `<input data-key>`: `'YYYY-MM-DD'` or `'YYYY-MM-DDTHH:MM'` (read with `UI.parseDate`).
  It fires `input` and `change`, so `UI.on(root, 'change', '[data-key="start"]', fn)` works.
- From code: `UI.setDateField(elInsideField, date, silent)`, `UI.dateFieldValue(elInsideField)` -> Date or null.
  Length chips (1 day, 2 days, 1 week, +12 h) are a page's own buttons that call `UI.setDateField` on the end field.
- `UI.filters` `date` and `daterange` fields now use these (same values as before: `'YYYY-MM-DD'` strings).

### 2.4 Sideways rows

`.tabs`, `.ptabs`, `.ui-fchips`, `.ui-choice` and anything with `data-srow` get a fade on the side that has more
(automatic). `UI.scrollRow(el)` also adds arrow buttons on mouse screens (wraps `el` in `.ui-srow`).

### 2.5 Small changes

- `UI.popover(..., {keepOnResize: true})` moves with the window instead of closing.
- `UI.wordsMatch(text, q)`: every typed word is in the text (case blind).

## 3. Data additions (`data.js`)

### 3.1 Company settings: `D().company` (Settings edits them, every page reads them)

| Field | Meaning |
|---|---|
| `bank {bank, name, accNo, accName, duitnow, note}` | bank details for invoices, statements, the summons message (`name` = `bank`) |
| `packageDefault` | damage package a new booking starts with (`'dp-1'`, `''` = none) |
| `cardFee {localPct, foreignPct, fixed}` | card payments: after charge = amount - amount x pct% - fixed |
| `summonsAdminFee` | default admin fee on a summons (20 / 15 / 25) |
| `fleet {overspeed, historyDays, reminderRecipients [user ids], reminderTime 'HH:MM', warnDays {paper kind: days}}` | Fleet settings |
| `trackerPlatforms` | list for the tracker and dashcam platform fields |
| `assistant {hours {from, to}, turnaroundH, airportTurnaroundH, holdMin, minNoticeH, deliveryTiers [{upToKm, fee}], stayOutDays}` | booking assistant rules |
| `turnaroundH` | availability: warn when the car is back less than this before the next start (3) |
| `expenseEditDays` | days people may change or delete their own expenses (`null` = no limit) |
| `carsNotCounted` | car ids left out of report and dashboard figures (Bara starts with its sold car) |
| `refundLockDate` | Date, default 1 Nov 2026 (see `canPickRefunded`) |
| `invoiceShowPaid` | invoices print "Payments received / Balance due" (default off) |

`CO()` returns `D().company`.

### 3.2 Locations and places (on the brand, `B()`)

- `B().locations [{id: 'loc-1', n, p, d, agents: [employee ids]}]`: our own pick-up and drop-off points. `agents` are the
  field agents who usually hand cars over there (task auto-assign).
- `B().places [{id: 'pl-1', name, deliveryFee, returnFee}]`: other places (airport, station, ferry terminal) with fees.
  No fixed airport anywhere: everything comes from these.
- `LISTS.startOpts`, `LISTS.endOpts`, `LISTS.taskTypes` are getters that follow the company on screen:
  `Delivery to <place>`, `Return from <place>`, `Car delivery to <place>`, `Car return from <place>`.
- Bookings delivered to a place have `startOpt: 'Delivery to Ipoh airport'`, `startPlace: 'pl-1'` (and `endOpt`, `endPlace`),
  and their delivery and return charges are the place fees.
- Helpers: `companyPlaces(b)`, `placeById(id)`, `placeOfOpt('Delivery to X')`, `handoverOptions('start' | 'end')` ->
  `[{value, label, kind: 'office' | 'client' | 'place', loc, place, fee}]` (office values are
  `'Pick-up from our location|<name>'`, as the booking form already stores), `taskTypesFor(b)`, `taskTypeFor(booking, 'start' | 'end')`.

### 3.3 Payments, deposits, bank-ins

- `LISTS.methods` adds `'Deposit adjustment'`; show it with `methodLabel(m)` ("Adjustment from deposit").
  `LISTS.bookingMethods` is the list without it (for the booking's own method field).
- Every payment has `items: [{kind, amount}]` (adding up to `amount`; `kind` = the first item's kind) and `depositOf`
  (booking code whose deposit paid it, for `Deposit adjustment`). A few seeded payments carry two items.
- One seeded `Deposit adjustment` payment per company; its deposit has a deduction
  `{kind: 'Used for a payment', amount, note, fromPayment: payId}`: leave those out of money reports and give them back
  when the payment is voided.
- `D().bankIns [{id, staff (user id), amount, at, slip {name, size}, ref, note, voided null | {at, by (user id), reason}, by (user id), payments [ids]}]`,
  newest first, one voided sample. They come from the old "banked" cash; `payment.banked` is still filled but is old: use bank-ins.
- `cashHeldBy(userId)` = cash payments given to them - their bank-ins - cash deposit refunds they handed back.

### 3.4 Expense categories and handover fees

- Every category has: `key, needsBooking, needsCar, fixedAmount, locked, agentFee, feeGroup ('delivery' | 'return' |
  'companion' | 'other' | null), oncePerPerson, noBooking, paysStaff, loc, place` (and the old `group`, which stays the
  "who can use it" group: 'Everyday', 'Office and admin', and now 'Handover fees'). `expCatDefaults(c)` fills them.
  Note: the spec's fee `group` is **`feeGroup`** here, because `group` was already taken.
- Handover fee kinds (`agentFee: true, locked: true`, keys `fee:pickup:<locId>`, `fee:dropoff:<locId>`,
  `fee:delivery:client`, `fee:return:client`, `fee:delivery:<placeId>`, `fee:return:<placeId>`, `fee:companion:delivery`,
  `fee:companion:return`, `fee:companion:delivery:<placeId>`, `fee:companion:return:<placeId>`, `fee:companion:other`,
  `fee:other` (no booking)) follow the locations and places: call `syncFeeKinds()` after changing them (adds, renames, hides).
  `Companion - other trip` has no amount yet, so it cannot be chosen until Settings gives it one.
- `Payment to staff` (`id 'cat-staffpay'`, `paysStaff: true`); its expenses carry `staff` (user id).
- `D().agentFeeRates [{id, cat, user, amount}]`: a person's own rate. `feeRate(cat, userId)` gives their amount, else the
  kind's `fixedAmount`, else null. `feeKindFor(booking, 'start' | 'end')` gives the fee kind that fits a booking's handover.
- Seeded handover-fee expenses (agents' income on recent bookings, some companion fees) and two Payment to staff entries.

### 3.5 Shared rules (one copy; delete your page's own copy and call these)

| Helper | What it does |
|---|---|
| `bkCalc({start, end, rate, hourly, dep, covDaily, deliv, ret, others, disc})` | `{hrs, days, fullDays, remHours, rent, cover, dur, payable}`. Under 24 h: exact hours x hourly. Else whole days x rate + exact remaining hours x hourly (no rounding up). Rent and payable rounded to whole RM as the backend does (half to even: 262.5 -> 262, 263.5 -> 264). Example: 2 days 1.5 h at RM 120/day and RM 15/h = 240 + 22.5 = RM 262 (the old code said RM 270). Cover: under 24 h = 1 day, else whole days + 1 for a part day. `bookings.js` still has its own `bkCalc`, which overrides this one until W1 removes it. |
| `applyStatusRules(before, patch)` | copy of `patch` with the automatic changes and `notes []`: submitted + Pending/Confirmed/Agreement Sent -> Agreement Signed and Deposit due (unless Deposit Received, Full Payment Received, Refund Pending or Deposit Refunded); a change to Car Returned -> Refund Pending, or Deposit Refunded when the deposit is 0 (unless already Deposit Refunded). |
| `nextPaymentStatus(current, kind, coversTotal, coversDeposit)` | status a payment kind moves to, or null; never down. |
| `payStatusAfter(booking, payment)` | runs it for every item of a payment (after the payment is in `D().payments`). |
| `bookingPaid(b)`, `coversTotal(b)`, `coversDeposit(b)` | money recorded (non-void), and whether it reaches the total (99 sen grace) / the deposit. |
| `depositDueAfterVoid(booking)` | after a void: `'Deposit due'` if the booking is Deposit Received and its deposit is no longer covered, else null. Save it yourself and say so in the confirm. |
| `canPickRefunded(booking)` | false for bookings ending on or after `company.refundLockDate` unless already Deposit Refunded. Show the option disabled as "Deposit Refunded (set by recording the refund on the deposits page)". |
| `busy(car, start, end, exceptCode)` | `{free, kind: 'booking' \| 'workshop' \| 'fleet' \| null, reason, booking, downtime, soon}`; blocks on Not in use / Sold, overlapping bookings that are not Completed/Cancelled, and workshop downtime (no end = never ends). Touching periods do not clash. |
| `matchBookingCode(q, code)` | `'3'`, `'00003'`, `'KLT 3'`, `'klt-00003'` all match `KLT-00003` exactly. |
| `tidySearch(q)` | trims; a pasted phone becomes digits. |
| `normPhone(p)`, `phoneHas(phone, q)` | digits with 0 / 60 / +60 the same. |
| `normPlate(p)` | `'VKP 4418'` -> `'VKP4418'`. |
| `overlaps(b, from, to)` | rental end >= from and start <= to, whole days; a single date means that day. |
| `countedCars()`, `isCounted(carId)` | cars in the main figures (not in `company.carsNotCounted`). |
| `userByName(name)`, `staffName(userId)` | payments and refunds store names; bank-ins and expenses store user ids. |

### 3.6 Lists

- `LISTS.taskTypes` no longer has a fixed airport (see 3.2).
- `EARLY_STATUSES`, `RENT_LIKE_KINDS` are exported for pages that need them.

## 4. Permissions (`perms.js`)

- New codes: `bookings.billing` (Invoice and receipts in bookings), `expenses.staff_reports_all` (see every staff
  member's report), `reports.choose_cars` (choose the cars counted), new section `leads` (`leads.view`, `leads.manage`,
  `leads.settings`, after Customers). `summons.waive` already existed.
- Every section has `requires: [codes]` (Bookings needs `cars.view`, `damage_packages.view`, `signatures.view`; Tasks needs
  `employees.view`, `bookings.view`; Deposits and Billing need `bookings.view`, `bookings.see_amounts`; Maintenance and
  Tracking need `cars.view`; Calendar, Reports and Leads need `bookings.view`, `cars.view`; Inspections and Summons need
  `bookings.view`; Customer notes need `customers.view`, `bookings.view`).
  `permRequires(sectionId)`, `permMissing(codesSetOrArray, sectionId)` read them (Team page warnings).
- Presets: Front desk adds `bookings.billing`, `leads.view`, `leads.manage` (it already had `billing.record_payment`,
  expenses view/add/edit own and `customer_notes.view`); Accountant adds `bookings.billing`, `expenses.staff_reports_all`.
  Manager and Read-only pick the new codes up by their rules (all but team settings / every `.view`).

## 5. Layout fix

`space.css`: the Edit Booking drawer's two columns (`.bkx-dl.two`) only apply from 1101px; below that it is one column,
so the drawer works on phones and tablets.
