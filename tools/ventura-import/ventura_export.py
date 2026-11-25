"""Read a COPY of Ventura's database and write it out in Orbique FMS's data model (app/m/CONTRACT.md).

Never point this at Ventura's live server. It only runs SELECT statements, on a copy restored from a backup
(db-ventura-<STAMP>.sql.gz loaded into a local MySQL/MariaDB).

    python ventura_export.py --mysql mysql://user:pass@127.0.0.1:3306/ventura_copy --out out/ventura-fms.json

What comes out (one JSON file):
    identity     company name, short name, booking code prefix, colours (from settings), city
    settings     FMS company settings (B()): bank, prefixes, locations, places, cover packages, expense kinds ...
    collections  {staff: [...], cars: [...], customers: [...], bookings: [...], ...} in the FMS shapes
    files        [{src: 'media/car_images/car-3.jpg', private: false, path: 'ventura/media/car_images/car-3.jpg'}]
    sources      [[coll, id, source_table, source_id]] for the import map (lets the import run again safely)
    report       counts and money totals on both sides, and every row that needed a decision
Files are referenced inside records as 'file:<path>' (path inside the company's folder in storage).
"""
import argparse
import datetime as dt
import decimal
import json
import re
import sys
from collections import defaultdict
from urllib.parse import urlparse, unquote

import pymysql

MYT = dt.timezone(dt.timedelta(hours=8))   # Ventura stores Malaysia time without a zone (USE_TZ = False)


# ------------------------------------------------------------------ helpers
def iso(v):
    """Ventura datetime (Malaysia time, no zone) -> '2026-11-03T14:00:00+08:00'; date -> '2026-11-03'."""
    if v is None:
        return None
    if isinstance(v, dt.datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=MYT)
        return v.astimezone(MYT).replace(microsecond=0).isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return str(v)


def money(v):
    if v is None or v == '':
        return 0
    d = decimal.Decimal(str(v)).quantize(decimal.Decimal('0.01'))
    return int(d) if d == d.to_integral() else float(d)


def txt(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def digits(s):
    return re.sub(r'\D', '', s or '')


def norm_phone(raw):
    """Malaysian numbers to 60xxxxxxxxx (same rule as Ventura's phone_key); other numbers keep their digits."""
    d = digits(raw)
    if not d:
        return ''
    if d.startswith('0'):
        d = '6' + d
    elif d.startswith('1') and 9 <= len(d) <= 10:
        d = '60' + d
    return d


def fmt_phone(raw):
    """'+60 12-345 6789' the way the FMS app shows numbers; keeps the original when it is not Malaysian."""
    d = norm_phone(raw)
    if d.startswith('60') and 10 <= len(d) <= 12:
        rest = d[2:]
        if rest.startswith('1'):
            head, tail = rest[:2], rest[2:]
            if len(tail) == 8:
                return '+60 %s-%s %s' % (head, tail[:4], tail[4:])
            return '+60 %s-%s %s' % (head, tail[:3], tail[3:])
        return '+60 %s-%s %s' % (rest[:1], rest[1:5], rest[5:])
    return txt(raw) or ''


def id_key(raw):
    k = re.sub(r'[^A-Z0-9]', '', (raw or '').upper())
    return k if len(k) >= 5 else ''


def file_ref(path, private, files):
    """Register an uploaded file and return the reference stored in the record."""
    path = txt(path)
    if not path:
        return None
    root = 'media_private' if private else 'media'
    dest = 'ventura/%s/%s' % (root, path.lstrip('/'))
    files[dest] = {'src': '%s/%s' % (root, path.lstrip('/')), 'path': dest, 'private': private}
    return 'file:' + dest


class Export:
    def __init__(self, conn):
        self.conn = conn
        self.files = {}
        self.sources = []
        self.warnings = []
        self.counts = {}
        self.tables = self._tables()

    def _tables(self):
        with self.conn.cursor() as c:
            c.execute('show tables')
            return {list(r.values())[0] for r in c.fetchall()}

    def rows(self, table, order='id'):
        if table not in self.tables:
            self.warnings.append('Table %s is not in this copy; skipped.' % table)
            return []
        with self.conn.cursor() as c:
            c.execute('select * from `%s` order by %s' % (table, order))
            out = c.fetchall()
        self.counts[table] = len(out)
        return out

    def src(self, coll, fid, table, sid):
        self.sources.append([coll, fid, table, str(sid)])

    def warn(self, text):
        self.warnings.append(text)


# ------------------------------------------------------------------ the mapping
ROLE_BY_NAME = {
    'owner': 'owner', 'full access (legacy)': 'owner', 'manager': 'manager', 'front desk': 'frontdesk',
    'fleet & maintenance': 'fleet', 'fleet': 'fleet', 'accountant': 'accountant', 'read-only': 'readonly',
    'driver': 'agent', 'field agent': 'agent', 'agent': 'agent',
}
BOOKING_STATUS = {
    'Pending': 'Pending', 'Confirmed': 'Confirmed', 'Aggreement Sent': 'Agreement Sent', 'Agreement Sent': 'Agreement Sent',
    'Aggreement Signed': 'Agreement Signed', 'Agreement Signed': 'Agreement Signed', 'Car Delivered': 'Car Delivered',
    'Car Returned': 'Car Returned', 'Completed': 'Completed', 'Cancelled': 'Cancelled',
}
PAYMENT_STATUS = {
    'deposit due': 'Deposit Due', 'deposit received': 'Deposit Received', 'full payment received': 'Full Payment Received',
    'extension due': 'Extension Due', 'extension paid': 'Extension Paid', 'refund pending': 'Refund Pending',
    'deposit refunded': 'Deposit Refunded',
}
PAY_KIND = {
    'deposit': 'Security deposit', 'rent': 'Rental payment', 'extension': 'Extension payment', 'delivery': 'Delivery charge',
    'return': 'Return charge', 'coverage': 'Damage coverage', 'other': 'Other payment',
}
DEDUCTION_KIND = {
    'damage': 'Damage', 'fuel': 'Fuel', 'cleaning': 'Cleaning', 'summons': 'Summons', 'late_fee': 'Late return fee',
    'payment': 'Used for a payment', 'used_for_payment': 'Used for a payment', 'other': 'Other',
}
SUMMONS_STATUS = {
    'new': 'Needs review', 'needs_review': 'Needs review', 'no_booking': 'No booking', 'matched': 'Ready to charge',
    'ready': 'Ready to charge', 'charged': 'Charged', 'paid': 'Paid', 'waived': 'Waived', 'disputed': 'Disputed',
}
JOB_STATUS = {'completed': 'done', 'done': 'done', 'scheduled': 'planned', 'planned': 'planned', 'in_progress': 'workshop',
              'workshop': 'workshop', 'cancelled': 'cancelled'}
PAPER_TYPE = {'road_tax': 'Road tax', 'insurance': 'Insurance', 'puspakom': 'PUSPAKOM', 'grant': 'Grant', 'rental_permit': 'Permit',
              'permit': 'Permit'}
PAID_WITH = {'cash': 'Cash', 'card': 'Card', 'bank_transfer': 'Bank transfer', 'e_wallet': 'E-wallet', 'other': 'Other'}
VENDOR_KIND = {'workshop': 'Workshop', 'tyre_shop': 'Tyres', 'car_wash': 'Car wash', 'towing': 'Towing', 'bodyshop': 'Workshop',
               'aircond': 'Workshop', 'dealer': 'Workshop', 'insurer': 'Insurer'}
SHAPE = {'hatchback': 'hatch', 'sedan': 'sedan', 'suv': 'suv', 'mpv': 'mpv'}
TASK_WA = {'Template Sent': 'Template sent', 'Reply Received': 'Reply received', 'Details Sent': 'Details sent', 'Failed': 'Failed'}


def export(conn, company_code):
    x = Export(conn)
    C = {}

    # ---------- company profile -> settings
    prof = (x.rows('billing_companyprofile') or [{}])[0]
    locs = x.rows('booking_handoverlocation')
    pkgs = x.rows('booking_damagecoveragepackage')
    cats = x.rows('expenses_expensecategory', 'sort_order, id')
    stypes = x.rows('maintenance_servicetype', 'serial, id')
    sigs = x.rows('booking_signature')
    name = txt(prof.get('trading_name')) or txt(prof.get('legal_name')) or 'Ventura'
    settings = {
        'name': name, 'short': name.split(' ')[0], 'legalName': txt(prof.get('legal_name')),
        'regNo': txt(prof.get('registration_no')) or '', 'taxId': txt(prof.get('tax_id')),
        'phone': fmt_phone(prof.get('phone')), 'email': txt(prof.get('email')) or '', 'address': (txt(prof.get('address')) or '').replace('\n', ', '),
        'site': txt(prof.get('website')) or '', 'logo': file_ref(prof.get('logo'), False, x.files),
        'country': txt(prof.get('default_country_code')) or '60', 'codePrefix': company_code,
        'invoicePrefix': txt(prof.get('invoice_prefix')) or 'INV', 'receiptPrefix': txt(prof.get('receipt_prefix')) or 'RCP',
        'numberPadding': prof.get('number_padding') or 5, 'resetYearly': bool(prof.get('reset_yearly')),
        'tax': {'on': bool(prof.get('tax_enabled')), 'name': txt(prof.get('tax_name')) or 'SST', 'rate': money(prof.get('tax_rate'))},
        'bank': {'name': txt(prof.get('bank_name')) or '', 'accName': txt(prof.get('bank_account_name')) or '', 'accNo': txt(prof.get('bank_account_no')) or ''},
        'paymentNote': txt(prof.get('payment_note')), 'invoiceFooter': txt(prof.get('invoice_footer')), 'receiptFooter': txt(prof.get('receipt_footer')),
        'cardFee': {'pct': 4, 'fixed': 1},           # Ventura's Stripe charge (4% + RM 1), see billing.Payment.amount_after_charge
        'depositRefundLockFrom': '2026-11-01', 'speedLimit': 110, 'expenseEditHours': 24,
        'locations': [{'id': 'L%d' % l['id'], 'name': l['name'], 'short': l['name'].split(',')[0][:24], 'pickup': bool(l['for_pickup']),
                       'dropoff': bool(l['for_dropoff']), 'active': bool(l['is_active']), 'agents': []} for l in locs],
        'places': [{'id': 'KLIA', 'name': 'KLIA', 'deliveryFee': 0, 'returnFee': 0}],
        'clientDeliveryFee': 0, 'clientReturnFee': 0,
        'packages': [{'id': 'K%d' % p['id'], 'name': p['name'], 'daily': money(p['daily_rate']), 'max': money(p['maximum_coverage']),
                      'default': i == 0} for i, p in enumerate(pkgs)],
        'serviceTypes': [{'name': s['name'], 'km': s['default_interval_km'] or 0, 'days': s['default_interval_days'] or 0,
                          'category': s['category'], 'active': bool(s['is_active'])} for s in stypes],
        'expenseKinds': [], 'handoverFees': [],
        'signatures': [{'id': 'sig%d' % s['id'], 'name': s['name'], 'image': txt(s.get('signature_base64')) or file_ref(s.get('signature'), False, x.files)} for s in sigs],
    }
    settings['signature'] = settings['signatures'][0]['image'] if settings['signatures'] else None
    for c in cats:
        if c.get('agent_fee'):
            group = 'companion' if 'companion' in (c['key'] or '') else ('return' if re.search(r'dropoff|return', c['key'] or '') else 'delivery')
            settings['handoverFees'].append({'kind': c['name'], 'group': group, 'amount': money(c.get('fixed_amount')), 'rates': {},
                                             'key': c['key'], 'active': bool(c['is_active']), 'needsBooking': bool(c.get('needs_booking'))})
        else:
            settings['expenseKinds'].append({'id': c['key'] or 'c%d' % c['id'], 'name': c['name'], 'everyday': c['kind'] == 'staff',
                                             'business': c['kind'] == 'business', 'needsCar': bool(c.get('needs_car')),
                                             'needsBooking': bool(c.get('needs_booking')), 'fixed': money(c['fixed_amount']) or None,
                                             'paysStaff': bool(c.get('pays_staff')), 'active': bool(c['is_active'])})
    cat_by_id = {c['id']: c for c in cats}

    # ---------- staff: logins (auth_user + access) and field agents (employee)
    users = x.rows('auth_user')
    access = {a['user_id']: a for a in x.rows('access_staffaccess') if a.get('user_id')}
    roles = {r['id']: r for r in x.rows('access_accessrole')}
    emps = x.rows('employee_employee')
    emp_user = {a['employee_id']: uid for uid, a in access.items() if a.get('employee_id')}
    staff, staff_of_user, staff_of_emp = [], {}, {}
    for u in users:
        a = access.get(u['id'])
        rname = (roles.get(a['role_id'], {}).get('name') if a else ('Owner' if u['is_superuser'] else '')) or ''
        role = ROLE_BY_NAME.get(rname.lower())
        codes = None
        if a:
            grants = json.loads(roles.get(a['role_id'], {}).get('grants') or '[]')
            extra = json.loads(a.get('extra_grants') or '[]')
            revoke = set(json.loads(a.get('extra_revokes') or '[]'))
            if not role or extra or revoke:
                codes = sorted((set(grants) | set(extra)) - revoke)
                if not role:
                    role = 'agent' if not codes else 'readonly'
                    x.warn('Login %s has the custom role "%s"; imported as %s with its own access codes.' % (u['username'], rname, role))
        if not role:
            role = 'readonly'
            x.warn('Login %s has no role in Ventura; imported as Read-only.' % u['username'])
        emp = next((e for e in emps if emp_user.get(e['id']) == u['id']), None)
        nm = ' '.join(p for p in [txt(u['first_name']), txt(u['last_name'])] if p) or (emp and emp['name']) or u['username']
        sid = 'u%d' % u['id']
        p = {'id': sid, 'name': nm, 'username': u['username'], 'role': role, 'email': txt(u['email']) or '',
             'phone': fmt_phone(emp['whatsapp_number']) if emp else '', 'wa': norm_phone(emp['whatsapp_number']) if emp else '',
             'active': bool(emp and emp['is_active']), 'isAgent': bool(emp), 'hasLogin': True, 'loginActive': bool(u['is_active']),
             'lastSeen': iso(u['last_login']), 'codes': codes, 'needsPassword': True,
             'emergency': {'name': emp['emergency_contact_name'] or '', 'phone': fmt_phone(emp['emergency_contact_number']),
                           'relation': emp['emergency_contact_relation'] or ''} if emp else None,
             'blood': (emp or {}).get('blood_group') or ''}
        staff.append(p)
        staff_of_user[u['id']] = sid
        x.src('staff', sid, 'auth_user', u['id'])
        if emp:
            staff_of_emp[emp['id']] = sid
    for e in emps:
        if e['id'] in staff_of_emp:
            continue
        sid = 'e%d' % e['id']
        staff.append({'id': sid, 'name': e['name'], 'username': '', 'role': 'agent', 'email': txt(e['email']) or '',
                      'phone': fmt_phone(e['whatsapp_number']), 'wa': norm_phone(e['whatsapp_number']), 'active': bool(e['is_active']),
                      'isAgent': True, 'hasLogin': False, 'loginActive': False, 'codes': None,
                      'emergency': {'name': e['emergency_contact_name'] or '', 'phone': fmt_phone(e['emergency_contact_number']),
                                    'relation': e['emergency_contact_relation'] or ''},
                      'blood': e.get('blood_group') or '', 'docs': {'ic': file_ref(e.get('id_card'), True, x.files), 'poa': file_ref(e.get('proof_of_address'), True, x.files)}})
        staff_of_emp[e['id']] = sid
        x.src('staff', sid, 'employee_employee', e['id'])
    C['staff'] = staff
    who = lambda uid: staff_of_user.get(uid) if uid else None

    # ---------- cars
    cars = x.rows('booking_car')
    gallery = defaultdict(list)
    for g in x.rows('booking_cargallery', 'car_id, serial, id'):
        gallery[g['car_id']].append(file_ref(g['image'], False, x.files))
    owner_files = defaultdict(list)
    for f in x.rows('booking_carownerfile'):
        owner_files[f['car_id']].append({'kind': f['kind'], 'file': file_ref(f['file'], True, x.files), 'name': f['original_name'], 'at': iso(f['uploaded_at'])})
    C['cars'] = []
    for c in cars:
        typ = txt(c['type']) or 'Sedan'
        car = {'id': 'car%d' % c['id'], 'plate': (c['plate_number'] or '').strip().upper(), 'make': txt(c['manufacturer']) or '',
               'model': txt(c['model']) or '', 'shape': SHAPE.get(typ.lower(), 'sedan'), 'type': typ, 'color': txt(c['color']) or '',
               'year': c['manfacture_year'], 'rate': money(c['daily_rate']), 'hourly': money(c['hourly_rate']), 'deposit': money(c['deposit']),
               'serial': txt(c['vin']), 'engineNo': txt(c['engine_no']), 'status': c['status'] or 'active', 'km': c['odometer_km'] or 0,
               'kmBase': c['odometer_km'] or 0, 'seats': c['seat_capacity'], 'fuel': c['fuel_type'], 'gear': c['transmission_type'],
               'cc': c['engine_capacity_cc'], 'spec': txt(c['spec']), 'image': file_ref(c['image'], False, x.files),
               'gallery': gallery.get(c['id'], []), 'showOnWebsite': bool(c['show_on_website']), 'inReports': bool(c.get('in_reports', 1)),
               'owner': {'name': c['owner_name'], 'phone': fmt_phone(c['owner_phone']), 'ic': txt(c['owner_ic_no'])} if txt(c['owner_name']) else None,
               'instalment': {'monthly': money(c['installment_amount']), 'day': c['installment_day']} if c['installment_amount'] else None,
               'ownerFiles': owner_files.get(c['id'], []), 'purchase': {'date': iso(c['purchase_date']), 'price': money(c['purchase_price'])},
               'tracker': {'imei': c['tracker_imei'], 'platform': c['tracker_platform'], 'sim': c['tracker_sim']} if txt(c['tracker_imei']) else None,
               'dashcam': {'imei': c['dashcam_imei'], 'platform': c['dashcam_platform'], 'sim': c['dashcam_sim']} if txt(c['dashcam_imei']) else None,
               'sort': c['serial']}
        C['cars'].append(car)
        x.src('cars', car['id'], 'booking_car', c['id'])
    car_id = lambda vid: 'car%d' % vid if vid else None

    # ---------- bookings, and the customers they name
    bookings = x.rows('booking_booking')
    customers, cust_by_key = [], {}
    black = x.rows('booking_blacklistedcustomer')

    def customer_for(b):
        ik, pk = id_key(b['ic_or_passport_no']), norm_phone(b['phone_number'])
        key = ('ic:' + ik) if ik else ('ph:' + pk) if pk else ('nm:' + (b['full_name'] or '').strip().lower()) if txt(b['full_name']) else None
        if not key:
            return None
        cu = cust_by_key.get(key) or (pk and cust_by_key.get('ph:' + pk))
        if not cu:
            ic = txt(b['ic_or_passport_no'])
            is_ic = bool(ic and re.fullmatch(r'\d{6}-?\d{2}-?\d{4}', ic))
            cu = {'id': 'cb%d' % b['id'], 'name': txt(b['full_name']) or 'No name', 'phone': fmt_phone(b['phone_number']),
                  'email': txt(b['email']) or '', 'ic': ic if is_ic else '', 'passport': '' if is_ic else (ic or ''),
                  'nationality': txt(b['nationality']) or ('Malaysian' if is_ic else ''), 'licenceNo': txt(b['driver_license_no']) or '',
                  'licenceExp': iso(b['driver_license_expiry']), 'address': txt(b['residential_address']) or '',
                  'emergency': {'name': b['emergency_contact_name'] or '', 'phone': fmt_phone(b['emergency_contact_phone']),
                                'relation': b['emergency_contact_relationship'] or ''},
                  'blacklist': None, 'docs': {}, 'created': iso(b['created_at']), 'keys': {'ic': ik, 'phone': pk}}
            customers.append(cu)
            x.src('customers', cu['id'], 'booking_booking:customer', b['id'])
        else:
            # a later booking may carry newer details: keep the newest non-empty value
            for f, v in (('phone', fmt_phone(b['phone_number'])), ('email', txt(b['email'])), ('address', txt(b['residential_address'])),
                         ('licenceNo', txt(b['driver_license_no'])), ('licenceExp', iso(b['driver_license_expiry']))):
                if v:
                    cu[f] = v
            if pk and not cu['keys']['phone']:
                cu['keys']['phone'] = pk
        if ik:
            cust_by_key['ic:' + ik] = cu
        if pk:
            cust_by_key.setdefault('ph:' + pk, cu)
        if key.startswith('nm:'):
            cust_by_key[key] = cu
        return cu

    payments = defaultdict(list)
    pay_rows = x.rows('billing_payment')
    slips = defaultdict(list)
    for s in x.rows('billing_paymentslip'):
        slips[s['payment_id']].append(s)
    for p in pay_rows:
        payments[p['booking_id']].append(p)
    inspections = {i['booking_id']: i for i in x.rows('booking_vehicleinspection')}
    insp_photos = defaultdict(list)
    for ph in x.rows('booking_vehicleinspectioncustomerphoto'):
        insp_photos[ph['inspection_id']].append(ph)
    receipts_by_payment = {}
    for r in x.rows('billing_receipt'):
        if r.get('payment_id') and r['status'] == 'issued':
            receipts_by_payment[r['payment_id']] = r['number']
    tasks_rows = x.rows('task_task')
    assigns = defaultdict(list)
    for a in x.rows('task_taskassignment'):
        assigns[a['task_id']].append(a)
    settlements = {s['booking_id']: s for s in x.rows('deposits_depositsettlement')}

    C['bookings'] = []
    pay_id_of = {}
    money_src = defaultdict(decimal.Decimal)
    for b in bookings:
        cu = customer_for(b)
        if cu:
            for k, f, priv in (('icFront', 'id_card_front', True), ('icBack', 'id_card_back', True), ('licence', 'driving_license_scan', True),
                               ('poa', 'proof_of_address', True)):
                r = file_ref(b.get(f), priv, x.files)
                if r:
                    cu['docs'][k] = r
        pk_kind = {'our_location': 'our', 'client_location': 'client', 'klia': 'place'}
        pick, ret = b.get('pickup_place') or '', b.get('return_place') or ''
        bs = BOOKING_STATUS.get(b['booking_status'])
        if not bs:
            bs = 'Pending'
            x.warn('Booking VEN-%05d has the status "%s", which FMS does not have; imported as Pending.' % (b['id'], b['booking_status']))
        ps = PAYMENT_STATUS.get((b['payment_status'] or '').strip().lower())
        if b['payment_status'] and not ps:
            x.warn('Booking VEN-%05d has the payment status "%s"; left empty.' % (b['id'], b['payment_status']))
        pays = []
        for p in payments.get(b['id'], []):
            pid = 'p%d' % p['id']
            pay_id_of[p['id']] = pid
            kind = PAY_KIND.get(p['kind'])
            if not kind:
                kind = 'Other payment'
                x.warn('Payment %d (VEN-%05d) has the kind "%s"; imported as Other payment.' % (p['id'], b['id'], p['kind']))
            sl = slips.get(p['id'], [])
            pays.append({'id': pid, 'at': iso(p['paid_at']), 'items': [{'kind': kind, 'amt': money(p['amount'])}],
                         'method': p['method'], 'depositOf': ('b%d' % p['from_deposit_of_id']) if p.get('from_deposit_of_id') else None,
                         'cashTo': who(p['deposited_staff_id']) if p['deposited_to'] == 'staff' else None,
                         'cashToName': txt(p['deposited_staff_name']), 'depositedTo': txt(p['deposited_to']),
                         'bankedAt': iso(p['banked_at']), 'bankedBy': who(p.get('banked_by_id')),
                         'afterCharge': money(p['amount_after_charge']) if p['amount_after_charge'] is not None else None,
                         'ref': txt(p['reference']), 'note': txt(p['note']),
                         'slip': file_ref(sl[0]['file'], True, x.files) if sl else None, 'slipHash': sl[0]['sha256'] if sl else None,
                         'slips': [file_ref(s['file'], True, x.files) for s in sl[1:]],
                         'receiptNo': receipts_by_payment.get(p['id']),
                         'voided': p['status'] == 'void', 'voidReason': txt(p['void_reason']), 'voidedAt': iso(p['voided_at']),
                         'by': who(p['received_by_id']) or 'Ventura'})
            if p['status'] != 'void':
                money_src[p['kind']] += decimal.Decimal(str(p['amount']))
            x.src('payments', pid, 'billing_payment', p['id'])
        ins = inspections.get(b['id'])
        inspection = {'agent': None, 'customer': None}
        if ins:
            if ins['agent_submitted_at'] or ins['agent_handover_photo']:
                gps = None
                try:
                    g = json.loads(ins['gps_coordinates'] or 'null')
                    if isinstance(g, dict) and 'lat' in g:
                        gps = {'lat': g.get('lat'), 'lng': g.get('lng') or g.get('lon')}
                except (ValueError, TypeError):
                    pass
                inspection['agent'] = {'photos': {'handover': [r for r in [file_ref(ins['agent_handover_photo'], True, x.files)] if r],
                                                  'id': file_ref(ins['agent_id_photo'], True, x.files),
                                                  'licence': file_ref(ins['agent_driving_licence_photo'], True, x.files),
                                                  'odometer': file_ref(ins['agent_odometer_photo'], True, x.files)},
                                       'km': ins['agent_odometer_km'], 'note': txt(ins['agent_note']), 'at': iso(ins['agent_submitted_at']),
                                       'gps': gps, 'by': None}
            cph = insp_photos.get(ins['id'], [])
            if cph or ins['customer_submitted_at']:
                inspection['customer'] = {'photos': [file_ref(ph['photo'], True, x.files) for ph in cph], 'at': iso(ins['customer_submitted_at']),
                                          'notes': [txt(ph['note']) for ph in cph]}
        bid = 'b%d' % b['id']
        bk = {'id': bid, 'no': b['id'], 'code': '%s-%05d' % (company_code, b['id']), 'formId': b['form_id'],
              'cust': cu['id'] if cu else None, 'car': car_id(b['car_id']), 'start': iso(b['rental_start']), 'end': iso(b['rental_end']),
              'created': iso(b['created_at']), 'createdBy': 'Ventura', 'source': 'Staff' if b['filled_by_admin'] else 'Website',
              'bookingStatus': bs, 'paymentStatus': ps,
              'rates': {'daily': money(b['daily_rate']), 'hourly': money(b['hourly_rate']), 'deposit': money(b['security_payment']),
                        'discount': money(b['discount']), 'delivery': money(b['delivery_charge']), 'return': money(b['return_charge']),
                        'others': money(b['others_charge'])},
              'cover': {'packageId': 'K%d' % b['damage_coverage_id'] if b['damage_coverage_id'] else None, 'name': b['damage_coverage_name'],
                        'daily': money(b['damage_coverage_daily_rate']), 'max': money(b['damage_coverage_maximum_coverage'])}
                       if txt(b['damage_coverage_name']) or b['damage_coverage_daily_rate'] else None,
              'pickKind': pk_kind.get(pick, 'our'), 'retKind': pk_kind.get(ret, 'our'),
              'pickLoc': ('L%d' % b['pickup_location_id']) if b['pickup_location_id'] else ('KLIA' if pick == 'klia' else None),
              'retLoc': ('L%d' % b['return_location_id']) if b['return_location_id'] else ('KLIA' if ret == 'klia' else None),
              'pickNote': txt(b['delivery_note']) if pick == 'client_location' else None, 'retNote': None, 'deliveryNote': txt(b['delivery_note']),
              'placeUnknown': not pick,
              'method': b['payment_method'], 'submitted': bool(b['is_submitted']), 'submittedAt': iso(b['submitted_at']), 'agentToken': txt(b['inspection_agent_token']),
              'signature': txt(b['signature']), 'signatureTyped': txt(b['signature_typed']), 'authoritySignature': ('sig%d' % b['authority_signature_id']) if b['authority_signature_id'] else None,
              'inspection': inspection, 'returnKm': ins['return_odometer_km'] if ins else None, 'returnFuel': None,
              'docs': {k: file_ref(b.get(f), True, x.files) for k, f in (('icFront', 'id_card_front'), ('icBack', 'id_card_back'),
                                                                          ('licence', 'driving_license_scan'), ('poa', 'proof_of_address'))},
              'otherFile': file_ref(b.get('other_files'), True, x.files),
              'assigned': [], 'log': [], 'summonsIds': [], 'payments': pays, 'note': None, 'refundNote': txt(b['refund_note']),
              'refundPendingAt': iso(b['refund_pending_marked_at'])}
        bk['docs']['other'] = [bk.pop('otherFile')] if bk.get('otherFile') else []
        C['bookings'].append(bk)
        x.src('bookings', bid, 'booking_booking', b['id'])

    # ---------- blacklist and notes
    for bl in black:
        ik, pk = id_key(bl['ic_or_passport']), norm_phone(bl['phone'])
        cu = (ik and cust_by_key.get('ic:' + ik)) or (pk and cust_by_key.get('ph:' + pk))
        if not cu:
            cu = {'id': 'cbl%d' % bl['id'], 'name': bl['name'] or 'No name', 'phone': fmt_phone(bl['phone']), 'email': '',
                  'ic': txt(bl['ic_or_passport']) or '', 'passport': '', 'nationality': '', 'licenceNo': '', 'licenceExp': None, 'address': '',
                  'emergency': None, 'docs': {}, 'created': iso(bl['created_at']), 'keys': {'ic': ik, 'phone': pk}}
            customers.append(cu)
            x.src('customers', cu['id'], 'booking_blacklistedcustomer', bl['id'])
        cu['blacklist'] = {'reason': 'On Ventura’s blacklist', 'by': 'Ventura', 'at': iso(bl['created_at'])}
    C['customers'] = customers
    C['notes'] = []
    flag = {'vip': 'vip', 'caution': 'careful', 'careful': 'careful', 'info': 'info'}
    for n in x.rows('customer_notes_customernote'):
        cu = (n['ic_key'] and cust_by_key.get('ic:' + n['ic_key'])) or (n['phone_key'] and cust_by_key.get('ph:' + n['phone_key']))
        if not cu:
            x.warn('Customer note %d (%s) matches no customer; kept on a customer of its own.' % (n['id'], n['customer_name']))
            cu = {'id': 'cn%d' % n['id'], 'name': n['customer_name'] or 'No name', 'phone': fmt_phone(n['phone_key']), 'email': '',
                  'ic': n['ic_key'] or '', 'passport': '', 'docs': {}, 'blacklist': None, 'created': iso(n['created_at']), 'keys': {'ic': n['ic_key'], 'phone': n['phone_key']}}
            customers.append(cu)
        C['notes'].append({'id': 'n%d' % n['id'], 'cust': cu['id'], 'flag': flag.get(n['flag'], 'info'), 'text': n['text'], 'pinned': bool(n['pinned']),
                           'by': who(n['created_by_id']) or n['created_by_name'] or 'Ventura', 'at': iso(n['created_at']),
                           'booking': ('b%d' % n['booking_id']) if n['booking_id'] else None})
        x.src('notes', 'n%d' % n['id'], 'customer_notes_customernote', n['id'])

    # ---------- deposits: deductions and refunds
    C['deductions'], C['refunds'] = [], []
    ded_rows = defaultdict(list)
    for d in x.rows('deposits_depositdeduction', 'settlement_id, position, id'):
        ded_rows[d['settlement_id']].append(d)
    for bid_v, s in settlements.items():
        for d in ded_rows.get(s['id'], []):
            C['deductions'].append({'id': 'dd%d' % d['id'], 'booking': 'b%d' % bid_v, 'kind': DEDUCTION_KIND.get(d['kind'], 'Other'),
                                    'amt': money(d['amount']), 'note': txt(d['note']), 'by': who(s['created_by_id']) or 'Ventura',
                                    'at': iso(s['created_at']), 'paymentId': pay_id_of.get(d.get('payment_id'))})
            x.src('deductions', 'dd%d' % d['id'], 'deposits_depositdeduction', d['id'])
        if s['status'] == 'refunded':
            C['refunds'].append({'id': 'rf%d' % s['id'], 'booking': 'b%d' % bid_v, 'amt': money(s['net_refund']),
                                 'method': {'Online Transfer': 'Bank transfer'}.get(s['refund_method'], s['refund_method'] or 'Bank transfer'),
                                 'from': s.get('refund_from'), 'staff': who(s.get('refund_staff_id')), 'ref': txt(s['refund_reference']),
                                 'at': iso(s['refunded_at']), 'by': who(s['refunded_by_id']) or 'Ventura', 'note': txt(s['note']),
                                 'cashSettledAt': iso(s.get('refund_cash_settled_at')), 'voided': False})
            x.src('refunds', 'rf%d' % s['id'], 'deposits_depositsettlement', s['id'])

    # ---------- tasks
    C['tasks'] = []
    for t in tasks_rows:
        a = assigns.get(t['id'], [])
        tid = 't%d' % t['id']
        C['tasks'].append({'id': tid, 'name': t['name'], 'type': (t['task_type'] or 'General').replace('’', "'").replace('�', "'"),
                           'booking': ('b%d' % t['booking_id']) if t['booking_id'] else None,
                           'staff': [staff_of_emp.get(r['agent_id'], 'e%d' % r['agent_id']) for r in a],
                           'at': iso(t['scheduled_at']), 'status': t['status'] or 'Pending', 'note': txt(t['note']), 'photos': [], 'voice': [],
                           'wa': {staff_of_emp.get(r['agent_id'], 'e%d' % r['agent_id']): TASK_WA.get(r['wa_status']) for r in a if TASK_WA.get(r['wa_status'])},
                           'auto': False, 'by': 'Ventura', 'created': iso(t['created_at'])})
        x.src('tasks', tid, 'task_task', t['id'])

    # ---------- cars: maintenance, downtime, papers, odometer, vendors
    C['vendors'] = [{'id': 'v%d' % v['id'], 'name': v['name'], 'kind': VENDOR_KIND.get(v['vendor_type'], 'Workshop'), 'phone': fmt_phone(v['phone']),
                     'wa': norm_phone(v['whatsapp']), 'email': txt(v['email']), 'area': (txt(v['address']) or '').split('\n')[-1], 'note': txt(v['notes']),
                     'active': bool(v['is_active'])} for v in x.rows('maintenance_vendor')]
    stype_name = {s['id']: s['name'] for s in stypes}
    items = defaultdict(list)
    for it in x.rows('maintenance_maintenanceitem'):
        items[it['maintenance_record_id']].append({'kind': it['kind'], 'name': it['name'], 'partNo': txt(it['part_no']), 'qty': money(it['quantity']),
                                                   'unit': money(it['unit_cost']), 'warrantyMonths': it['warranty_months']})
    mfiles = defaultdict(list)
    for f in x.rows('maintenance_maintenanceinvoice'):
        mfiles[f['maintenance_record_id']].append({'kind': f['kind'], 'file': file_ref(f['file'], True, x.files), 'caption': txt(f['caption'])})
    vendor_name = {v['id']: v['name'] for v in x.rows('maintenance_vendor')}
    C['jobs'] = []
    for m in x.rows('maintenance_maintenancerecord'):
        C['jobs'].append({'id': 'j%d' % m['id'], 'car': car_id(m['car_id']), 'type': stype_name.get(m['service_type_id'], 'Other'),
                          'status': JOB_STATUS.get(m['status'], 'done'), 'at': iso(m['date']), 'cost': money(m['expense']),
                          'parts': money(m['parts_cost']), 'labour': money(m['labour_cost']), 'tax': money(m['tax_amount']),
                          'km': m['odometer_km'], 'vendor': 'v%d' % m['vendor_id'] if m['vendor_id'] else None,
                          'vendorName': vendor_name.get(m['vendor_id']), 'note': txt(m['description']),
                          'photo': (mfiles.get(m['id']) or [{}])[0].get('file'), 'files': mfiles.get(m['id'], []), 'items': items.get(m['id'], []),
                          'booking': ('b%d' % m['booking_id']) if m['booking_id'] else None, 'chargeCustomer': bool(m['charge_to_customer']),
                          'recoverable': money(m['recoverable_amount']), 'paidStatus': m['paid_status'], 'paidOn': iso(m['paid_on']),
                          'vendorInvoiceNo': txt(m['vendor_invoice_no']), 'warrantyUntil': iso(m['warranty_until']),
                          'by': who(m['created_by_id']) or 'Ventura', 'created': iso(m['created_at']), 'startedAt': iso(m['started_at']),
                          'backAt': iso(m['completed_at'])})
        x.src('jobs', 'j%d' % m['id'], 'maintenance_maintenancerecord', m['id'])
    C['downtime'] = [{'id': 'dt%d' % d['id'], 'car': car_id(d['car_id']), 'from': iso(d['start']), 'to': iso(d['end']),
                      'reason': (d['reason'] or '').replace('_', ' ').capitalize() + ((': ' + d['note']) if txt(d['note']) else ''),
                      'jobId': ('j%d' % d['maintenance_record_id']) if d['maintenance_record_id'] else None, 'by': 'Ventura'}
                     for d in x.rows('maintenance_cardowntime')]
    C['papers'] = []
    for p in x.rows('maintenance_cardocument'):
        C['papers'].append({'id': 'pp%d' % p['id'], 'car': car_id(p['car_id']), 'type': PAPER_TYPE.get(p['doc_type'], p['doc_type']),
                            'title': txt(p['title']), 'issued': iso(p['issue_date']), 'until': iso(p['expiry_date']), 'insurer': txt(p['provider']),
                            'cost': money(p['cost']), 'ref': txt(p['reference_no']), 'warnDays': p['remind_days'] or 30,
                            'photo': file_ref(p['file'], True, x.files), 'note': txt(p['note']), 'at': iso(p['created_at']), 'by': 'Ventura'})
        x.src('papers', 'pp%d' % p['id'], 'maintenance_cardocument', p['id'])
    C['odometer'] = [{'id': 'od%d' % o['id'], 'car': car_id(o['car_id']), 'km': o['km'], 'at': iso(o['recorded_at']),
                      'source': {'manual': 'typed', 'handover': 'handover', 'return': 'return', 'service': 'service'}.get(o['source'], 'typed'),
                      'by': who(o['recorded_by_id']) or 'Ventura', 'trusted': True, 'booking': ('b%d' % o['booking_id']) if o['booking_id'] else None,
                      'note': txt(o['note'])} for o in x.rows('maintenance_odometerreading')]
    C['schedules'] = [{'id': 'ss%d' % s['id'], 'car': car_id(s['car_id']), 'type': stype_name.get(s['service_type_id']), 'everyKm': s['interval_km'],
                       'everyDays': s['interval_days'], 'lastKm': s['last_done_km'], 'lastAt': iso(s['last_done_date']), 'nextKm': s['next_due_km'],
                       'nextAt': iso(s['next_due_date']), 'warnDays': s['warn_days'], 'warnKm': s['warn_km'], 'snoozedUntil': iso(s['snoozed_until']),
                       'active': bool(s['is_active'])} for s in x.rows('maintenance_serviceschedule')]

    # ---------- summons
    C['summons'] = []
    bk_by_id = {b['id']: b for b in C['bookings']}
    for s in x.rows('summons_summons'):
        sid = 'sm%d' % s['id']
        st = SUMMONS_STATUS.get(s['status'], 'Needs review')
        if s['status'] == 'new' and not s['booking_id']:
            st = 'No booking' if not s.get('needs_review') else 'Needs review'
        C['summons'].append({'id': sid, 'car': car_id(s['car_id']), 'booking': ('b%d' % s['booking_id']) if s['booking_id'] else None,
                             'authority': s['authority'], 'notice': txt(s['notice_no']), 'plate': s['plate'], 'at': iso(s['offence_at']),
                             'offence': txt(s['offence']), 'place': txt(s['location']), 'amount': money(s['amount']), 'adminFee': money(s['admin_fee']),
                             'status': st, 'photo': file_ref(s['image'], True, x.files), 'chargedAmt': money(s['charged_amount']) or None,
                             'chargedAt': iso(s['charged_at']), 'paidAt': iso(s['paid_at']), 'paymentId': pay_id_of.get(s['payment_id']),
                             'reason': txt(s['status_reason']), 'note': txt(s['notes']), 'speed': {'actual': s['speed_actual'], 'limit': s['speed_limit']}
                             if s.get('speed_actual') else None, 'by': who(s['created_by_id']) or 'Ventura', 'created': iso(s['created_at'])})
        if s['booking_id'] and ('b%d' % s['booking_id']) in bk_by_id:
            bk_by_id['b%d' % s['booking_id']]['summonsIds'].append(sid)
        x.src('summons', sid, 'summons_summons', s['id'])

    # ---------- expenses and instalments
    C['expenses'] = []
    exp_src = decimal.Decimal(0)
    for e in x.rows('expenses_expense'):
        c = cat_by_id.get(e['category_id'], {})
        eid = 'x%d' % e['id']
        C['expenses'].append({'id': eid, 'kind': c.get('name') or 'Other', 'kindId': c.get('key'), 'amt': money(e['amount']), 'at': iso(e['expense_date']),
                              'car': car_id(e['car_id']), 'booking': ('b%d' % e['booking_id']) if e['booking_id'] else None,
                              'paidWith': PAID_WITH.get(e['paid_with'], 'Other'), 'paidTo': txt(e['payee']), 'note': txt(e['note']),
                              'receipt': file_ref(e['receipt'], True, x.files), 'by': who(e['created_by_id']) or 'Ventura',
                              'staff': who(e.get('staff_id')), 'created': iso(e['created_at']), 'agentFee': bool(c.get('agent_fee')),
                              'group': next((h['group'] for h in settings['handoverFees'] if h['key'] == c.get('key')), None),
                              'toStaff': bool(c.get('pays_staff')), 'changedBy': who(e['updated_by_id']), 'changedAt': iso(e['updated_at']),
                              'voided': bool(e['deleted_at']), 'voidedBy': who(e['deleted_by_id'])})
        if not e['deleted_at']:
            exp_src += decimal.Decimal(str(e['amount']))
        x.src('expenses', eid, 'expenses_expense', e['id'])
    C['instalments'] = [{'id': 'in%d' % i['id'], 'car': car_id(i['car_id']), 'due': iso(i['due_date']), 'amt': money(i['amount']),
                         'paidAt': iso(i['paid_on']), 'paidAmt': money(i['amount']) if i['paid_on'] else None,
                         'expenseId': ('x%d' % i['expense_id']) if i['expense_id'] else None} for i in x.rows('expenses_carinstallment')]

    # ---------- invoices and receipts (kept exactly as issued: numbers, amounts, the company details at the time)
    lines = defaultdict(list)
    for l in x.rows('billing_invoiceline', 'invoice_id, position, id'):
        lines[l['invoice_id']].append({'text': l['description'], 'qty': money(l['quantity']), 'unit': money(l['unit_price']), 'amt': money(l['amount'])})
    C['invoices'] = [{'id': 'inv%d' % i['id'], 'no': i['number'], 'booking': ('b%d' % i['booking_id']) if i['booking_id'] else None,
                      'bookingRef': i['booking_ref'], 'at': iso(i['issued_at']), 'by': who(i['issued_by_id']) or 'Ventura', 'status': i['status'],
                      'voided': i['status'] == 'void', 'voidReason': txt(i['void_reason']), 'lines': lines.get(i['id'], []),
                      'to': {'name': i['customer_name'], 'ic': i['customer_ic'], 'address': i['customer_address'], 'phone': i['customer_phone'], 'email': i['customer_email']},
                      'car': {'name': i['car_name'], 'plate': i['car_plate'], 'details': i.get('car_details')}, 'start': iso(i['rental_start']), 'end': iso(i['rental_end']),
                      'company': json.loads(i['company']) if (i['company'] or '').startswith('{') else i['company'],
                      'subtotal': money(i['subtotal']), 'tax': {'name': i['tax_name'], 'rate': money(i['tax_rate']), 'amt': money(i['tax_amount'])},
                      'charges': money(i['total_charges']), 'deposit': money(i['deposit_amount']), 'payable': money(i['total_payable']),
                      'notes': txt(i['notes']), 'footer': txt(i['footer'])} for i in x.rows('billing_invoice') if i['status'] != 'draft']
    rl = defaultdict(list)
    for l in x.rows('billing_receiptline', 'receipt_id, id'):
        rl[l['receipt_id']].append({k: (money(v) if isinstance(v, decimal.Decimal) else v) for k, v in l.items() if k not in ('id', 'receipt_id')})
    C['receipts'] = [{'id': 'rc%d' % r['id'], 'no': r['number'], 'booking': ('b%d' % r['booking_id']) if r.get('booking_id') else None,
                      'bookingRef': r['booking_ref'], 'payment': pay_id_of.get(r['payment_id']), 'invoice': ('inv%d' % r['invoice_id']) if r['invoice_id'] else None,
                      'at': iso(r['issued_at']), 'by': who(r['issued_by_id']) or 'Ventura', 'voided': r['status'] == 'void', 'voidReason': txt(r['void_reason']),
                      'to': {'name': r['customer_name'], 'ic': r['customer_ic'], 'phone': r.get('customer_phone'), 'email': r.get('customer_email')},
                      'car': {'name': r['car_name'], 'plate': r['car_plate'], 'details': r.get('car_details')}, 'start': iso(r['rental_start']), 'end': iso(r['rental_end']),
                      'company': json.loads(r['company']) if (r['company'] or '').startswith('{') else r['company'],
                      'text': r['description'], 'amt': money(r['amount']), 'method': r['method'], 'paidAt': iso(r['paid_at']), 'ref': txt(r['reference']),
                      'lines': rl.get(r['id'], []), 'footer': txt(r['footer'])} for r in x.rows('billing_receipt')]

    # ---------- activity log (who did what; the text is kept, Ventura's internal ids are not)
    C['audit'] = []
    for a in x.rows('access_auditlog'):
        try:
            ch = json.loads(a['changes'] or '{}')
        except ValueError:
            ch = {}
        C['audit'].append({'id': 'au%d' % a['id'], 'at': iso(a['at']), 'by': who(a['actor_id']) or a['actor_name'] or 'Ventura',
                           'text': '%s %s %s' % (a['action'].capitalize(), (a['model'] or '').split('.')[-1], a['object_repr'] or ''),
                           'changes': ch if isinstance(ch, dict) else {}, 'source': 'Ventura'})

    # ---------- the WhatsApp assistant's saved answers (never its access token)
    C['answers'] = [{'id': 'qa%d' % q['id'], 'question': q['question'], 'keywords': q['keywords'], 'answer': q['answer'], 'active': bool(q['is_active']),
                     'used': q['times_used']} for q in x.rows('leads_assistantanswer')]
    a_set = (x.rows('leads_assistantsettings') or [{}])[0]

    # ---------- what came over: counts and money on both sides
    fms_money = defaultdict(decimal.Decimal)
    rev = {v: k for k, v in PAY_KIND.items()}
    for b in C['bookings']:
        for p in b['payments']:
            if not p['voided']:
                for it in p['items']:
                    fms_money[rev[it['kind']]] += decimal.Decimal(str(it['amt']))
    report = {
        'source_rows': x.counts,
        'fms_rows': {k: len(v) for k, v in C.items()},
        'payments_by_kind': {k: {'ventura': str(money_src[k]), 'fms': str(fms_money[k])} for k in sorted(set(money_src) | set(fms_money))},
        'expenses_total': {'ventura': str(exp_src), 'fms': str(sum(decimal.Decimal(str(e['amt'])) for e in C['expenses'] if not e['voided']))},
        'customers_from_bookings': len(customers), 'files': len(x.files), 'warnings': x.warnings,
        'not_imported': ['Ventura passwords (staff set new ones on first sign-in)', 'WhatsApp access token (connect WhatsApp again in FMS)',
                         'GPS tracker position history (the latest position comes back once the tracker account is connected)',
                         'login sessions, Django admin log'],
    }
    identity = {'name': name, 'short': settings['short'], 'code': company_code, 'primary': '#0F4C81', 'dark': '#0B1F33', 'accent': '#C8A444',
                'colours': 'Navy and gold', 'city': 'Kuala Lumpur', 'lat': 3.139, 'lng': 101.6869, 'logo': settings['logo']}
    next_no = max([b['no'] for b in C['bookings']] or [0]) + 1
    return {'identity': identity, 'settings': settings, 'assistant': {'on': bool(a_set.get('is_on')), 'by': a_set.get('updated_by'), 'at': iso(a_set.get('updated_at'))},
            'nextNo': next_no, 'collections': C, 'files': sorted(x.files.values(), key=lambda f: f['path']), 'sources': x.sources, 'report': report}


def connect(url):
    u = urlparse(url)
    return pymysql.connect(host=u.hostname or '127.0.0.1', port=u.port or 3306, user=unquote(u.username or ''), password=unquote(u.password or ''),
                           database=u.path.lstrip('/'), charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor, autocommit=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--mysql', required=True, help='mysql://user:pass@host:port/db of a COPY restored from a backup')
    ap.add_argument('--code', default='VEN', help='booking code prefix (VEN keeps every booking number as it is)')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    if any(h in a.mysql for h in ('venturacars.my',)):
        sys.exit('This points at Ventura’s live server. Restore a backup copy and point at that instead.')
    conn = connect(a.mysql)
    with conn.cursor() as c:
        c.execute('set session transaction read only')
    data = export(conn, a.code)
    with open(a.out, 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'), default=str)
    r = data['report']
    print(json.dumps({k: r[k] for k in ('fms_rows', 'payments_by_kind', 'expenses_total', 'files')}, indent=1))
    print('%d warnings' % len(r['warnings']))
    for w in r['warnings'][:40]:
        print(' -', w)


if __name__ == '__main__':
    main()
