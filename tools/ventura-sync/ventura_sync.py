"""One-way sync: Ventura's database -> Orbique FMS, every few minutes.

Runs on Ventura's server (cron). It only READS Ventura's database (a MySQL login that can do nothing but SELECT) and the
upload folders, and only WRITES to the FMS company in Supabase. Ventura's app is never changed.

Each run:
  1. Exports the whole database into FMS records with ventura_export.export() (same mapping as the first import).
  2. Compares every record with what the last run sent (fingerprints in STATE_DIR/state.json).
  3. Sends only new or changed records; records that disappeared from Ventura are marked deleted in FMS (never removed).
  4. Uploads photos and documents that FMS does not have yet (at most FILE_BUDGET_MB per run, so the first big copy is
     spread over many runs and never loads the server).
A lock file stops two runs overlapping. Nothing is printed that holds a secret.

    python3 ventura_sync.py --config /etc/ventura-sync/env            normal run (cron)
    python3 ventura_sync.py --config /etc/ventura-sync/env --dry-run  shows what would be sent, sends nothing

Config file (KEY=VALUE lines, root/sync-user only, chmod 600):
    MYSQL_DEFAULTS=/etc/ventura-sync/my.cnf   [client] user/password of the read-only MySQL login
    MYSQL_DB=ventura
    FMS_URL=https://<project>.supabase.co
    FMS_SERVICE_KEY=<service role key: paste it yourself, never in a chat>
    FMS_SLUG=ventura
    MEDIA_ROOT=/var/www/ventura-api/media
    PRIVATE_MEDIA_ROOT=/var/www/ventura-api/media_private
    STATE_DIR=/var/lib/ventura-sync
    FILE_BUDGET_MB=300
"""
import argparse
import base64
import fcntl
import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'ventura-import'))
sys.path.insert(0, os.path.join(HERE, 'vendor', 'PyMySQL-1.1.1-py3-none-any.whl'))   # pure Python, so no pip needed on the server
import ventura_export  # noqa: E402

BATCH = 100


def read_config(path):
    cfg = {}
    for line in open(path):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ('MYSQL_DEFAULTS', 'MYSQL_DB', 'FMS_URL', 'FMS_SLUG', 'STATE_DIR'):
        if not cfg.get(k):
            sys.exit('config: %s is missing' % k)
    if not cfg.get('FMS_SERVICE_KEY') and not (cfg.get('SYNC_CLIENT_ID') and cfg.get('SYNC_KEY')):
        sys.exit('config: set SYNC_CLIENT_ID and SYNC_KEY (key pair), or FMS_SERVICE_KEY')
    cfg.setdefault('MEDIA_ROOT', '/var/www/ventura-api/media')
    cfg.setdefault('PRIVATE_MEDIA_ROOT', '/var/www/ventura-api/media_private')
    cfg['FILE_BUDGET_MB'] = int(cfg.get('FILE_BUDGET_MB') or 300)
    return cfg


def fp(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':'), default=str).encode()).hexdigest()[:24]


class FMS:
    """Service-key mode (FMS_SERVICE_KEY): talks to Supabase REST and Storage directly."""
    def __init__(self, cfg):
        self.url = cfg['FMS_URL'].rstrip('/')
        self.key = cfg['FMS_SERVICE_KEY']
        self.slug = cfg['FMS_SLUG']
        self.org = None

    def call(self, method, path, body=None, headers=None, raw=None, ctype='application/json'):
        h = {'apikey': self.key}
        if self.key.startswith('eyJ'):           # legacy service_role key (a JWT); new sb_secret_ keys go in apikey only
            h['Authorization'] = 'Bearer ' + self.key
        data = None
        if raw is not None:
            data, h['Content-Type'] = raw, ctype
        elif body is not None:
            data, h['Content-Type'] = json.dumps(body, ensure_ascii=False, default=str).encode(), 'application/json'
        h.update(headers or {})
        return http(self.url + path, method, data, h)

    def hello(self):
        org = self.call('GET', '/rest/v1/orgs?slug=eq.%s&select=id,next_no' % urllib.parse.quote(self.slug))
        if not org:
            sys.exit('FMS has no company "%s" yet.' % self.slug)
        self.org = org[0]['id']
        return org[0]

    def upsert(self, table, rows):
        conflict = {'records': 'org_id,coll,id', 'blobs': 'org_id,key', 'import_map': 'org_id,source,source_table,source_id'}[table]
        for r in rows:
            r['org_id'] = self.org
        for i in range(0, len(rows), BATCH):
            self.call('POST', '/rest/v1/%s?on_conflict=%s' % (table, conflict), rows[i:i + BATCH],
                      {'Prefer': 'resolution=merge-duplicates,return=minimal'})

    def mark_deleted(self, coll, ids):
        q = ','.join('"%s"' % x.replace('"', '') for x in ids)
        self.call('PATCH', '/rest/v1/records?org_id=eq.%s&coll=eq.%s&id=in.(%s)' % (self.org, urllib.parse.quote(coll), urllib.parse.quote(q)),
                  {'deleted': True}, {'Prefer': 'return=minimal'})

    def next_no(self, n):
        self.call('PATCH', '/rest/v1/orgs?id=eq.%s&next_no=lt.%d' % (self.org, n), {'next_no': n}, {'Prefer': 'return=minimal'})

    def upload(self, path, body, ctype):
        self.call('POST', '/storage/v1/object/company-files/%s/%s' % (self.org, urllib.parse.quote(path)), raw=body, ctype=ctype,
                  headers={'x-upsert': 'true'})


class SignedFMS(FMS):
    """Key-pair mode (SYNC_CLIENT_ID + SYNC_KEY): every request is signed with this server's Ed25519 private key and goes
    through the ventura-sync function, which only lets it write into its own company. No FMS secret is kept here."""
    def __init__(self, cfg):
        self.fn = cfg['FMS_URL'].rstrip('/') + '/functions/v1/ventura-sync'
        self.client = cfg['SYNC_CLIENT_ID']
        self.keyfile = cfg['SYNC_KEY']
        self.org = None

    def op(self, op, args=None, body=b'', ctype='application/json'):
        a = json.dumps(args or {}, separators=(',', ':'))
        t = str(int(time.time()))
        msg = '\n'.join([t, self.client, op, a, hashlib.sha256(body).hexdigest()]).encode()
        sig = subprocess.run(['openssl', 'pkeyutl', '-sign', '-inkey', self.keyfile, '-rawin'], input=msg, capture_output=True)
        if sig.returncode != 0:
            raise RuntimeError('openssl could not sign: ' + sig.stderr.decode()[:200])
        h = {'X-Sync-Client': self.client, 'X-Sync-Op': op, 'X-Sync-Args': a, 'X-Sync-Time': t,
             'X-Sync-Sig': base64.b64encode(sig.stdout).decode(), 'Content-Type': ctype}
        return http(self.fn, 'POST', body, h)

    def hello(self):
        r = self.op('hello')
        self.org = r['id']
        return r

    def upsert(self, table, rows):
        for i in range(0, len(rows), BATCH):
            self.op('upsert', {'table': table}, json.dumps(rows[i:i + BATCH], ensure_ascii=False, default=str).encode())

    def mark_deleted(self, coll, ids):
        self.op('mark_deleted', {'coll': coll}, json.dumps(ids).encode())

    def next_no(self, n):
        self.op('next_no', {'n': n})

    def upload(self, path, body, ctype):
        self.op('upload', {'path': path}, body, ctype)


def http(url, method, data, h):
    for attempt in range(4):
        req = urllib.request.Request(url, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                txt = r.read()
                return json.loads(txt) if txt and r.headers.get('Content-Type', '').startswith('application/json') else None
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode('utf-8', 'replace')
            if e.code < 500 or attempt == 3:
                raise RuntimeError('FMS said %s on %s %s: %s' % (e.code, method, url.split('?')[0].split('/v1/')[-1], msg))
        except urllib.error.URLError as e:
            if attempt == 3:
                raise RuntimeError('cannot reach FMS: %s' % e.reason)
        time.sleep(2 ** attempt)


def load_state(d):
    try:
        return json.load(open(os.path.join(d, 'state.json')))
    except (OSError, ValueError):
        return {'h': {}, 'files': {}, 'src': [], 'missing': {}}


def save_state(d, st):
    tmp = os.path.join(d, 'state.json.tmp')
    with open(tmp, 'w') as f:
        json.dump(st, f, separators=(',', ':'))
    os.replace(tmp, os.path.join(d, 'state.json'))


def connect(cfg):
    import pymysql
    conn = pymysql.connect(read_default_file=cfg['MYSQL_DEFAULTS'], database=cfg['MYSQL_DB'], charset='utf8mb4',
                           cursorclass=pymysql.cursors.DictCursor, autocommit=True)
    with conn.cursor() as c:
        c.execute('set session transaction read only')
    return conn


def run(cfg, dry):
    t0 = time.time()
    st = load_state(cfg['STATE_DIR'])
    conn = connect(cfg)
    try:
        d = ventura_export.export(conn, 'VEN')
    finally:
        conn.close()
    t_export = time.time() - t0
    fms = SignedFMS(cfg) if cfg.get('SYNC_CLIENT_ID') else FMS(cfg)
    org = fms.hello()
    org_id, next_no = org['id'], org['next_no']

    # ---- records
    sent, gone = 0, 0
    for coll, rows in d['collections'].items():
        old = st['h'].get(coll, {})
        new = {r['id']: fp(r) for r in rows}
        changed = [r for r in rows if old.get(r['id']) != new[r['id']]]
        removed = [i for i in old if i not in new]
        if dry:
            if changed or removed:
                print('%-14s %5d to send, %4d to mark deleted' % (coll, len(changed), len(removed)))
            sent += len(changed); gone += len(removed)
            continue
        if changed:
            fms.upsert('records', [{'org_id': org_id, 'coll': coll, 'id': r['id'], 'data': r, 'deleted': False} for r in changed])
            sent += len(changed)
        for i in range(0, len(removed), 100):
            part = removed[i:i + 100]
            fms.mark_deleted(coll, part)
            gone += len(part)
        st['h'][coll] = new
        save_state(cfg['STATE_DIR'], st)

    # ---- company settings, assistant switch, next booking number
    for key, val in (('settings', d['settings']), ('assistant', d['assistant'])):
        h = fp(val)
        if st['h'].get('blob:' + key) != h:
            if dry:
                print('blob %s changed' % key)
            else:
                fms.upsert('blobs', [{'org_id': org_id, 'key': key, 'data': {'v': val}}])
                st['h']['blob:' + key] = h
    if d['nextNo'] > (next_no or 0) and not dry:
        fms.next_no(d['nextNo'])

    # ---- import map (only new pairs)
    have = set(tuple(x) for x in st.get('src', []))
    fresh = [s for s in d['sources'] if tuple(s) not in have]
    if fresh and not dry:
        fms.upsert('import_map', [{'org_id': org_id, 'source': 'ventura', 'source_table': t, 'source_id': s, 'coll': c, 'id': f}
                                  for c, f, t, s in fresh])
        st['src'] = [list(x) for x in have | set(tuple(s) for s in fresh)]
    if not dry:
        save_state(cfg['STATE_DIR'], st)

    # ---- files
    budget = cfg['FILE_BUDGET_MB'] * 1024 * 1024
    up, up_bytes, missing = 0, 0, 0
    todo = [f for f in d['files'] if f['path'] not in st['files']]
    for f in todo:
        # Older uploads (inspection photos, ID documents) may sit in the public folder even when Ventura now files
        # them as private, and the other way round: look in both, the expected one first.
        rel = f['src'].split('/', 1)[1]
        roots = [cfg['PRIVATE_MEDIA_ROOT'], cfg['MEDIA_ROOT']] if f['private'] else [cfg['MEDIA_ROOT'], cfg['PRIVATE_MEDIA_ROOT']]
        local = next((os.path.join(r, rel) for r in roots if os.path.isfile(os.path.join(r, rel))), None)
        if not local:
            missing += 1
            st['missing'][f['path']] = int(time.time())
            continue
        size, mtime = os.path.getsize(local), int(os.path.getmtime(local))
        if up_bytes + size > budget and up:
            break
        if dry:
            up += 1; up_bytes += size
            continue
        with open(local, 'rb') as fh:
            body = fh.read()
        ctype = mimetypes.guess_type(local)[0] or 'application/octet-stream'
        fms.upload(f['path'], body, ctype)
        st['files'][f['path']] = mtime
        st['missing'].pop(f['path'], None)
        up += 1; up_bytes += size
        if up % 50 == 0:
            save_state(cfg['STATE_DIR'], st)
    if not dry:
        save_state(cfg['STATE_DIR'], st)
        with open(os.path.join(cfg['STATE_DIR'], 'last-ok'), 'w') as fh:
            fh.write(time.strftime('%Y-%m-%d %H:%M:%S %z') + '\n')
    left = len(todo) - up - missing
    print('%s %s: export %.1fs, %d records sent, %d marked deleted, %d files (%.1f MB) uploaded, %d files waiting, %d missing on disk, %.1fs total'
          % (time.strftime('%Y-%m-%d %H:%M:%S'), 'DRY RUN' if dry else 'SYNC OK', t_export, sent, gone, up, up_bytes / 1048576, max(left, 0),
             missing, time.time() - t0))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', default='/etc/ventura-sync/env')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    cfg = read_config(a.config)
    os.makedirs(cfg['STATE_DIR'], exist_ok=True)
    lock = open(os.path.join(cfg['STATE_DIR'], 'lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print('another sync is still running; skipped')
        return
    try:
        os.nice(19)
    except OSError:
        pass
    try:
        run(cfg, a.dry_run)
    except Exception as e:  # one clear line for the log; the next run tries again
        print('%s SYNC FAILED: %s' % (time.strftime('%Y-%m-%d %H:%M:%S'), str(e)[:400]))
        sys.exit(1)


if __name__ == '__main__':
    main()
