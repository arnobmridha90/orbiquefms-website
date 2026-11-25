# Mobile staff app: core contract (data model v4)

Read this before you touch a module. Core files (`js/core.js`, `js/seed.js`, `js/pickers.js`, `css/base.css`, `css/pickers.css`, `js/start.js`, `index.html`, `sw.js`, manifests) belong to the core builder. Edit only the files your package owns. All scripts are classic scripts sharing globals; load order is in `index.html` (core, seed, home, bookings, new-booking, chat, inbox, more, pickers, then the module files, notifs, install, start).

Rules for every screen: phone first, 40px+ tap targets, money with `rm()` (`RM 1,234.50`, `-RM 5.00`) and centred (`.money`, `.money-col`, `.c2-end`), plain English, no em dashes, no real company names, everything company-specific from `B()`.

## State

`S` is the current company's data (one localStorage key per company: `fms.data.<co>`). `save()` after every change. `S.v === 4`. Old v3 data is migrated by `migrateV3()` (keeps its bookings, adds 40+ cars and all new collections).

A missing optional field on a seeded row means `null` (seed drops empty fields to save space). Dates are ISO strings unless noted as `YYYY-MM-DD`. A `by` field is a staff id for staff, or a plain label (`'Website'`, `'Customer'`, `'Slip reader'`, `'Auto-assign'`): show it with `who(by)`.

| Collection | Fields |
|---|---|
| `S.settings` | company settings, read through `B()` (below) |
| `S.staff[]` | `id ('s1'), name, username, role (ROLES key), phone, wa, email, active (field agent on), isAgent, hasLogin, loginActive, emergency{name,phone,relation}, blood, lastSeen, codes (null = role's codes)` |
| `S.me` | signed-in staff id (`null` = signed out, start goes to `#signin`). `me()`, `myName()` |
| `S.prefs` | the signed-in person's prefs (object inside `S.prefsBy[staffId]`): `new, change, staff, wa, pay, due` (notification kinds), `startTab` ('home','bookings','schedule','chat'). Add your own keys freely. |
| `S.cars[]` | `id ('car1'), plate ('WXY 1234'), make, model, shape (hatch/sedan/suv/mpv), type (Hatchback/Sedan/SUV/MPV), color, year, rate (daily RM), hourly, deposit, serial (VIN), engineNo, status ('active'/'inactive'/'sold'), km, owner{name,phone}/null, instalment{monthly,day,bank,endsOn}/null, gallery[], showOnWebsite, serviceEveryKm, lastServiceKm, lastServiceAt, note` |
| `S.customers[]` | `id ('cu1'), name, phone (formatted), email, ic, passport, nationality, licenceNo, licenceExp (YYYY-MM-DD), address, emergency{name,phone,relation}, blacklist {reason,by,at}/null, docs{icFront,icBack,passport,licence,poa,other[]}, created`. Flags come from notes + blacklist: `custFlags(c)`, `custFlag(c)` ('Blacklisted' > 'Be careful' > 'VIP') |
| `S.bookings[]` | see Booking below |
| `S.notes[]` | customer notes `id, cust, flag ('info'/'vip'/'careful'), text, pinned, by, at, booking` |
| `S.downtime[]` | `id, car, from, to (null = open ended), reason, jobId, by` (busy() honours it) |
| `S.jobs[]` | maintenance `id, car, type, status ('done'/'planned'/'workshop'/'cancelled'), at, cost, km, vendor, note, photo, remindKm, remindDays, by, created, backAt` |
| `S.vendors[]` | `id, name, kind ('Workshop'/'Tyres'/'Car wash'/'Towing'), phone, area` |
| `S.papers[]` | car papers `id, car, type ('Road tax'/'Insurance'/'PUSPAKOM'/'Grant'/'Permit'), until (YYYY-MM-DD), insurer, cost, ref, warnDays, photo, at, by`. Latest: `carPaper(carId, type)` |
| `S.odometer[]` | `id, car, km, at, source ('typed'/'service'/'handover'/'return'), by, trusted (false = 'Not trusted'), booking, note` |
| `S.summons[]` | `id, car, booking/null, authority, notice, plate, at, offence, amount, status ('Needs review'/'No booking'/'Ready to charge'/'Charged'/'Paid'/'Waived'/'Disputed'), photo, chargedAmt, chargedAt, paidAt, reason, by, created`. Booking keeps `summonsIds[]` |
| `S.tasks[]` | `id, name, type, booking/null, staff[ids], at, status ('Pending'/'In Progress'/'Completed'/'Cancelled'), note, photos[{src,caption}], voice[], wa{staffId: 'Template sent'/'Reply received'/'Details sent'/'Failed'}, auto, by, created`. `openTasksOf(staffId)` |
| `S.autoRules[]` | `id, kind ('everything'/'car'/'location'), car, location, staff[]` |
| `S.deductions[]` | deposit adjustments `id, booking, kind ('Damage'/'Fuel'/'Cleaning'/'Summons'/'Late return fee'/'Other'/'Used for a payment'), amt, note, photo, by, at, paymentId` |
| `S.refunds[]` | deposit refunds `id, booking, amt, method ('Bank transfer'/'Card'/'Cash'), slip, slipHash, ref, at, by, note, voided` |
| `S.bankIns[]` | `id, staff, amt, at, slip, slipHash, ref, note, by, voided, voidReason` |
| `S.expenses[]` | `id, kind (name from B().expenseKinds or a handover-fee kind), amt, at, car, booking, paidWith ('Cash'/'Card'/'Bank transfer'/'E-wallet'/'Other'), paidTo, note, receipt, by, created, agentFee (handover fee), group ('delivery'/'return'/'companion'), toStaff (money from the company to a person: 'Float from the company'), changedBy, changedAt, voided`. Instalment expenses use id `installment-<rowId>` |
| `S.instalments[]` | `id, car, due (YYYY-MM-DD), amt, paidAt (YYYY-MM-DD)/null, paidAmt, paidWith, expenseId` |
| `S.tracker[]` | `car, lat, lng, speed, ignition, state ('Moving'/'Parked'/'Offline'), at, heading`; `S.alarms[]` `id, car, kind, at` |
| `S.wa[]` | WhatsApp threads `id, name ('' = no name), phone, status ('Lead'/'Booked'/'Asking price'/'Closed'), unread, handled ('bot'/'staff'), msgs[{from:'cust'/'bot'/'staff', by, text, at}], bookingId, lead{state ('waiting'/'assistant'/'taken'/'closed'/'booked'), start, end, car, holdUntil, pickKind, pickLoc, pickNote, retKind, retLoc, retNote, estimate, deposit, question, takenBy, takenAt, closedAt, bookingId, km, at}` |
| `S.assistant` | `{on, by, at}` |
| `S.staffChat[]` | `id, from (staff id), text, at`; `S.staffUnread` |
| `S.notifs[]` | `id, kind, title, body, at, read, link` |
| `S.invoices[]`, `S.receipts[]` | empty; M3 defines rows (keep `id, no, booking, at, by, voided, voidReason, lines`) and may seed through SEEDERS |
| `S.audit[]` | `id, at, by, text, booking, cust, car, changes{field:[old,new]}, link` (written by `audit()` and `bLog()`) |
| `S.recentCars[]`, `S.recentBookings[]` | ids, used by the pickers |
| `S.nextNo` | next booking number. `bookingCode(no)` gives `KLT-00702` |

### Booking

```
id, no (number), code ('KLT-00702'), cust, car, start, end, created, createdBy, source ('Staff'/'Website'/'WhatsApp'/'Walk-in'),
bookingStatus: 'Pending' | 'Confirmed' | 'Agreement Sent' | 'Agreement Signed' | 'Car Delivered' | 'Car Returned' | 'Completed' | 'Cancelled'
paymentStatus: null | 'Deposit Due' | 'Deposit Received' | 'Full Payment Received' | 'Extension Due' | 'Extension Paid' | 'Refund Pending' | 'Deposit Refunded'
rates {daily, hourly, deposit, discount, delivery, return, others}
cover {packageId, name, daily, max} | null
pickKind / retKind: 'our' | 'client' | 'place';  pickLoc / retLoc: location id (our) or place id (place);  pickNote / retNote (address for client)
method ('Cash'/'Card'/'Online Transfer'), submitted, submittedAt, formId, agentToken
inspection { agent: {photos{handover[], id, licence, odometer}, km, fuel, note, at, gps{lat,lng}, by} | null, customer: {photos[], at} | null }
returnKm, returnFuel, docs {icFront, icBack, passport, licence, poa, other[]}, assigned [staffIds], log [{at, by, text, changes}], summonsIds [],
payments [Payment], note, cancelReason, leadId, refundPendingAt
```
Make a new one with `blankBooking({...})`. Stored names say 'Agreement'; `EXPORT_STATUS` maps to the old 'Aggreement' spelling for exports only. Use the names Car Delivered / Car Returned everywhere.

Payment: `newPayment({...})` gives `{id, at, items:[{kind, amt}], method ('Cash'/'Card'/'Online Transfer'/'Deposit adjustment'), depositOf (booking id when paid from a deposit), cashTo (staff id), afterCharge, ref, note, slip, slipHash, receiptNo, voided, voidReason, voidedAt, voidedBy, by}`.
Kinds (`PAY_KINDS`): Security deposit, Rental payment, Delivery charge, Return charge, Damage coverage, Extension payment, Other payment. `TOTAL_KINDS` count toward the booking total; Extension and Other are extra.

## Company settings: `B()`

`B()` = fixed identity (`id, name, short, code, primary, dark, accent, colours, city, lat, lng`) merged with `S.settings`. Read only; to change a setting: `S.settings.x = v; save(); applyTheme()`.
Settings: `name, short, regNo, phone, email, address, site, appName, apk, codePrefix, invoicePrefix, receiptPrefix, country ('60'), bank{name,accName,accNo}, cardFee{pct,fixed}, summonsAdminFee, depositRefundLockFrom ('2026-11-01'), speedLimit, expenseEditHours, signature,
locations[{id,name,short,pickup,dropoff,agents[]}], places[{id,name,deliveryFee,returnFee}], clientDeliveryFee, clientReturnFee, packages[{id,name,daily,max,default}], handoverFees[{kind,group,amount,rates{staffId:amt}}], quickReplies[] ({deliveryFee},{returnFee},{company} tokens; fillReply(t)), serviceTypes[{name,km,days}], expenseKinds[{id,name,everyday,needsCar,needsBooking,business,fixed}]`.
Helpers: `loc(id)`, `place(id)`, `pkg(id)`, `placeText(b,'pick'|'ret')`, `placeKindText(b,end)` ('Delivery · KLIA2'), `placeFee(kind,id,end)`, `placeChoices(end)` ([{v:'our:L1'|'client'|'place:P1', kind, id, label, fee}]), `parsePlace(v)` (in bookings.js), `handoverKind(b,end)`, `feeFor(kind, staffId)`.

## Helpers (core.js)

- Money: `rm(n)`, `rm0` (alias, do not use), `parseMoney(v)` (NaN unless `^\d+(\.\d{1,2})?$` after removing commas), `money2(n)` ('12.50' for inputs).
- Dates: `hm, dShort ('3 Nov'), dLong ('Thu 26 Nov'), dFull ('3 Nov 2026'), dayWord, when, ago, durationText(a,b) ('3 days, 2 hours'), nDays(a,b) (cover days), daysUntil(d), toLocalInput, toTimeInput, fromInputs, sod, sameDay, clampNow`.
- Search: `digits, normPhone (-> '60123456789'), phoneCore, tidySearch(q) (phone-like query -> core digits or ''), phoneMatch(q, phone), normPlate, matchBookingCode(q, b), wordsMatch(q, text), fmtPhone`. `Pickers.bookingMatches(b, q)` and `Pickers.customerMatches(c, q)` are the shared list filters.
- Lookups: `car(id), cust(id), bk(id), staff(id), byId(list,id), who(by), firstName(n), carLabel(c), maskIC(ic), icFacts(ic), imgSrc(x)` (photos may be `'demo:<kind>:<label>'` placeholders; always render `<img src="imgSrc(x)">`), `demoImg(kind,label)`.
- Money of a booking: `calcBooking(b)` -> `{hours, days, remHours, coverDays, rent, coverTotal, deposit, delivery, return, others, discount, charges (payable minus deposit), payable, received, extra, depositReceived, rentPaid, due, overpaid, settled, tone ('red'/'amber'/'green'/'blue'/'grey'), duration}`. Rent: under 24 h hourly x hours, else days x daily + remaining hours x hourly, whole RM. Cover x days (under 24 h = 1, part day rounds up). Payable = rent + deposit + cover + delivery + return + others - discount. 99 sen slack. `activePays(b)`, `paidOf(b, kinds)`, `payTotal(p)`, `moneyLine(b)` (small due/paid/extra span). `priceOf` is a legacy wrapper: do not use.
- Status: `BK_STATUSES, PAY_STATUSES, BK_TONE, PAY_TONE, UPCOMING, EARLY, statusChip(b), payChip(b), chip(text, tone), isLate(b), isMissedPickup(b)`.
  `setBookingStatus(b, status, {text})` is the one way to change a status (logs, runs `applyStatusRules(b, prev)`, saves, runs `ON_SIGNED` hooks). `setPaymentStatus(b, status, why)`. `nextPaymentStatus(b, items)` after pushing a payment (forward only; returns the new status or null). `depositDueAfterVoid(b)` after voiding. `canPickRefunded(b)`: false for bookings ending on/after `B().depositRefundLockFrom` unless already Deposit Refunded; only deposits.js recording a refund reaches Deposit Refunded then.
- Availability: `busy(carId, start, end, exceptBookingId)` -> `{free, reason ('Booked: KLT-00123 until 5 Nov' / 'Workshop until 8 Nov' / 'Not in use' / 'Sold'), soon ('Returned at 2:00 pm, 3 hrs before'), booking, downtime}`. Every booking except Completed/Cancelled blocks; touching periods do not clash. `isFree(...)`, `carNow(carId)`.
- People: `ROLES` (owner, manager, frontdesk, fleet, agent, accountant, readonly), `CODES` (code -> label), `can(code)`, `canP(person, code)`, `noAccess(code)` (html: 'Ask the owner for X access'), `roleName(id)`, `openTasksOf(id)`.
- Logs: `bLog(b, text, changes)` (booking log + activity), `audit(text, {booking, cust, car, changes, link})`.
- Screens: `VIEWS.name = function (r) { return { html, after?, noNav?, keepScroll? } }`. `route()` -> `{name, a, b, q (query object), path}`; `hashWith(name, q)`; `replaceHash(h)` (no Back step: use after saving); `topbar(title, {back, sub, right, noBell})`; `render(nav, keepScroll)`; `goBack(fallback)`; `stubView`.
- Sheets: `sheet(html, after?, opts?)` with opts `{stack (open over the current sheet), full (full height), cls, onClose, noSwipe}`. Every sheet adds a history step: the phone's Back closes the top sheet first. `closeSheet()` closes the top one (and takes its history step back); `closeAllSheets()`. Put the main button inside `<div class="sheet-foot">` (sticky). `sheetHead(title, sub)` gives a title row with a close X. visualViewport keeps sheets above the keyboard. `SHEETS` is the open stack.
- `confirm({title, text, html, ok, cancel, primary:'ok'|'cancel', danger, icon:'warn'|'info'|'danger'})` -> Promise<boolean> (big button = primary; it stacks over open sheets; Back = false). Example: `confirm({icon:'warn', text:'...', ok:'Yes, record anyway', cancel:'Go back and check', primary:'cancel'})`.
- `undoSnack(text, undoFn, ms=6000)`, `say(text)` (small snackbar).
- Date and time fields: write a plain `<input class="inp" type="date|time|datetime-local|month">`. Core wraps every such input with a visible label that always reads "19 Oct 2026", "3:00 PM", "19 Oct 2026, 3:00 PM" or "Oct 2026" (the native picker still opens on tap; `.value` works as usual and setting it updates the label). `data-nodtf` opts out. `hm(d)` gives "3:00 PM".
- Fields: a `<span class="hint">` or `<span class="err">` straight inside `label.field` keeps its own small style (base.css). `.sheet-foot` is opaque.
- Notifications: `notify(kind, title, body, link, opts)`. For your own action pass `{self:true}` (only a `say()`, no inbox). One toast at a time, bottom above the nav; while a sheet is open it never covers the sheet's heading or `.sheet-foot` (top of the screen for a short sheet, just above the footer for a tall or full one); swipe to dismiss. `KINDS` lists all kinds (new, change, staff, wa, pay, due, job, tomorrow, lead, service, alarm) and `PREF_DEFAULTS` their default on/off, both in core.
- Timers: use `later(fn, ms)` for simulated replies/sends: dropped when the company switches or the demo resets. Register view state resets with `VIEW_STATE.push(fn)`; `resetViewState()` runs them (switchCo and Reset demo call it).
- Media: `Media.photo({capture:'environment'|false, maxPx:1600, quality, accept, multiple})` -> Promise `{dataUrl, note ('Photo made smaller: 5.2 MB to 640 KB'), w, h, before, after, hash, name}` (rejects 'cancel'). `Media.fromFile(file, opts)`, `Media.sample(kind, label)` (made-up picture for laptops), `Media.readSlip(dataUrl, {expect, delay})` -> `{amount, date, time, ref, bank, confidence}`, `Media.readIC(dataUrl, {name, ic, delay})` -> `{ic, name, valid, facts{born,age,state,sex}, issues[]}`, `Media.hash(dataUrl)` for duplicate checks. Keep photos small: localStorage is about 5 MB for all three companies; `save()` warns when full.
- Sharing: `Share.wa(phone, text)`, `Share.native({title,text,url,files})`, `Share.copy(text, msg)` (awaits, then says 'Copied'), `Share.takeShared()` (File shared into the app, for `#slip`). Links: `Links.form(b)`, `Links.pdf(b)`, `Links.agent(b)` ('' without token), `Links.customer(b)`. Never build '/c/CODE' links.
- Documents: `pdfDoc(kind, {no, title, date, to{name,phone,extra}, booking, lines[{text,sub,amt}], totals[{label,amt,big}], notes, footer, shareText, link, stack})` opens a full-height A4 preview with Share and Download (print to PDF). `pdfDoc.html(kind, data)` returns the html only.

## SEEDERS

```js
SEEDERS.push({ key: 'receipts', fn: function (d, x) { d.receipts = [...]; } });
```
Runs once when `d[key] === undefined` (fresh, migrated or old phones). `x = {B, R, ri(a,b), pick(list), now, staffIds(role?)}`. Core already seeds most collections; a seeder only fires for a key that is still undefined, so to add rows to an existing collection use your own key (for example `key: 'receiptsSeeded'`). Data must be made up and dated now or earlier when it is a record of the past.

## Module globals (API contract)

Stubs exist for all of these; fill your own file and keep the names.

| Global | Owner | What |
|---|---|---|
| `Pickers.car({start,end,exceptId,selected,onPick,showBusy,title,all})` (`all`: also sold and not-in-use cars; an expired road tax shows a red chip), `Pickers.booking({filter,onPick,title,selected})`, `Pickers.customer({onPick(c|null, typed),title,allowNew})`, `Pickers.staff({multi,preferIds,selected,onPick,title,includeOff})` | core | full-height search sheets, stacked, close on Back |
| `Pay.open(bookingId, {kinds, amount, voidId})`, `Pay.slip(bookingId|null, file)` | M3 payments.js | a payment from a deposit runs `Deposit.sync` on record and void |
| `Docs.open(bookingId)` | M3 invoices.js | invoice / receipts / deposit statement |
| `Deposit.open(bookingId)`, `Deposit.adjust(bookingId)`, `Deposit.sync(bookingId)` | M4 deposits.js | Take back ends on "Next: check the deposit" (`Deposit.adjust`) while a refund is pending |
| `moneyIn(from,to)`, `MONEY_TODAY()`, `INSTALMENTS_DUE_SOON()` | M4 money.js | Home uses MONEY_TODAY |
| `Handover.start(bookingId, 'out'|'in')`, `Fees.claim(bookingId, group)`, `HANDOVER_DRAFTS()` | M5 handover.js | the old simple sheets in bookings.js are gone |
| `Tasks.newFor(bookingId)`; push to `ON_SIGNED` for auto-assign | M5 tasks.js | |
| `Cust.open(id)` | M6 customers.js | |
| `IdCheck.open({onFill, bookingId, name})` | M2 idcheck.js | |
| `Leads.summary(waId)` -> html | M6 leads.js | |
| `CarPage.open(id)` | M7 cars.js | |
| `Summons.forBooking(bookingId)` -> html ('' when none) | M7 summons.js | |
| `Expenses.add({car, booking, kind})` | M8 expenses.js | |
| `NB_DRAFT()` | M2 new-booking.js | |
| `signIn(id)`, `signOut()` | M9 signin.js | stub signs in from a list |

## Routes

Existing: `#home, #bookings[/upcoming|road|unpaid|done|all|cancelled], #booking/<id>, #new, #chat, #chat/team, #chat/staff, #chat/wa/<id>, #more, #inbox, #notifs, #install, #company, #schedules (old), #cars, #customers, #money`.
New (stubbed until filled): `#customer/<id>, #car/<id>, #availability, #calendar, #schedule, #tasks, #task/<id>, #maintenance, #summons, #tracking, #expenses, #expense/<id>, #mymoney, #deposits, #deposit/<bookingId>, #cash, #invoices, #instalments, #reports, #team, #person/<id>, #settings, #activity, #leads, #signin, #slip`.
Stubs register with `stubView()` only when the route is free, so the old more.js screens (schedules, cars, customers, money) keep working until your module sets `VIEWS.x` itself (module files load after more.js, so a plain `VIEWS.cars = ...` replaces the old one).
Deep link: `#new?car=<id>&start=<iso>&end=<iso>&cust=<id>&lead=<waId>` prefills New booking (`nbFromQuery`), then the hash becomes `#new`. Use `hashWith('new', {...})`. `TAB_OF` maps routes to nav tabs.
The share target posts to `/m/?share=slip`; sw.js keeps the file and opens `#slip` (read it with `Share.takeShared()`).

## CSS (base.css)

Tokens: `--brand, --brand-ink, --on-brand, --tint, --dark, --accent` (brand; for a red/amber brand like Bara, applyTheme uses the dark colour), fixed tones `--t-red/-amber/-green/-emerald/-blue/-orange/-grey` (+ `-bg`), `--tap: 40px`.
Classes: `.chip.tone-red|amber|green|emerald|blue|orange|grey` (fixed, never brand), `.money` (centred, tabular, nowrap), `.money-col`, `.card2 > .c2-main(.c2-t1,.c2-t2) + .c2-end` (two-line row instead of 4-column tables), `.fab`, `.sheet-foot` (+`.stack`), `.sheet-head`, `.sheet.full`, `.chiprow` (scrolling filter-chip row with a fade edge; put `.fchip` inside; `.seg` stays the existing choice-button group), `.banner.red|amber|blue|green`, `.empty`, `.noaccess`, `.btn.link`, `.btn.big`, `.btn.danger.solid`, `.confirm-ic`, `.thumbs/.thumb`, `.kpis`, `.field .err`, `.inp.bad`, `.hint`, `.rmfield` (RM prefix around an `.inp`), `.carfield` (a field that opens a picker), `.bal.due|paid|extra`. Existing: `.list .row .t1 .t2`, `.tiles .tile`, `.fchip`, `.filters`, `.seg`, `.formcard`, `.stickybar`, `.kv`, `.actions .act`, `.sumline`, `.log`, `.sw` (switch), `table.money`.
Each module has its own css file (empty now) linked in index.html.

## can() codes

`bookings.view, create, edit, edit_amounts, see_amounts, see_revenue, change_status, delete, export, view_documents` ·
`billing.view, record_payment, void, issue_invoice, issue_receipt, send, manage_cash, settings` ·
`deposits.view, edit_deductions, refund, reopen, send` ·
`customers.view, edit, view_documents, check_ic, blacklist_view, blacklist_edit` · `customer_notes.view, add, edit, delete` ·
`cars.view, create, edit, delete, manage_gallery, see_owner_details, see_instalment` ·
`maintenance.view, create, edit, delete, see_costs, manage_downtime, manage_documents` ·
`summons.view, upload, charge, record_payment, waive` · `tracking.view, alarms` ·
`expenses.view, view_all, add, add_business, edit_own, edit_all, staff_reports_all, manage_categories` ·
`reports.view, see_amounts, export_excel` · `tasks.view, create, edit, assign, delete, send_whatsapp` ·
`users.view, create, edit, deactivate, reset_password, manage_roles, view_audit, manage` · `employees.view, view_documents` · `leads.view, manage, settings`.
Role presets live in `ROLES` (owner has `*`; `area.*` means every code of an area). A person's `codes` array overrides the role.

## Demo people

Kilat: s1 Aina Rahman (Owner), s2 Hafiz Zul (Manager), s3 Mei Ling Tan (Front desk), s4 Ravi Kumar and s5 Danish Hakimi (Driver / Agent), s6 Kavitha Raj (Accountant), s7 Wong Kar Fai (Fleet), s8 Zul Ariffin (agent without login). Padi Emas and Bara follow the same ids. Fresh data signs in as s1.

## Testing tips

Playwright: `serviceWorkers: 'block'`, `devices['iPhone 13']` with `deviceScaleFactor: 1`. For `Media.photo()` use `const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(...)]); await fc.setFiles(path)`. Reset with `localStorage.clear()` then reload. Core tests: `/home/claude/scratch/build/core-mobile/t1.js` to `t4.js`.
