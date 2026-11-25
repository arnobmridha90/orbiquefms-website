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
import fcntl
import hashlib
import json
import mimetypes
import os
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

BATCH = 300


def read_config(path):
    cfg = {}
    for line in open(path):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ('MYSQL_DEFAULTS', 'MYSQL_DB', 'FMS_URL', 'FMS_SERVICE_KEY', 'FMS_SLUG', 'STATE_DIR'):
        if not cfg.get(k):
            sys.exit('config: %s is missing' % k)
    cfg.setdefault('MEDIA_ROOT', '/var/www/ventura-api/media')
    cfg.setdefault('PRIVATE_MEDIA_ROOT', '/var/www/ventura-api/media_private')
    cfg['FILE_BUDGET_MB'] = int(cfg.get('FILE_BUDGET_MB') or 300)
    return cfg


def fp(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':'), default=str).encode()).hexdigest()[:24]


class FMS:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key

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
        for attempt in range(4):
            req = urllib.request.Request(self.url + path, data=data, method=method, headers=h)
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    txt = r.read()
                    return json.loads(txt) if txt and r.headers.get('Content-Type', '').startswith('application/json') else None
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode('utf-8', 'replace')
                if e.code < 500 or attempt == 3:
                    raise RuntimeError('FMS said %s on %s %s: %s' % (e.code, method, path.split('?')[0], msg))
            except urllib.error.URLError as e:
                if attempt == 3:
                    raise RuntimeError('cannot reach FMS: %s' % e.reason)
            time.sleep(2 ** attempt)

    def upsert(self, table, rows, conflict):
        for i in range(0, len(rows), BATCH):
            self.call('POST', '/rest/v1/%s?on_conflict=%s' % (table, conflict), rows[i:i + BATCH],
                      {'Prefer': 'resolution=merge-duplicates,return=minimal'})


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
    fms = FMS(cfg['FMS_URL'], cfg['FMS_SERVICE_KEY'])
    org = fms.call('GET', '/rest/v1/orgs?slug=eq.%s&select=id,next_no' % urllib.parse.quote(cfg['FMS_SLUG']))
    if not org:
        sys.exit('FMS has no company "%s" yet: run the first import before the sync.' % cfg['FMS_SLUG'])
    org_id, next_no = org[0]['id'], org[0]['next_no']

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
            fms.upsert('records', [{'org_id': org_id, 'coll': coll, 'id': r['id'], 'data': r, 'deleted': False} for r in changed],
                       'org_id,coll,id')
            sent += len(changed)
        for i in range(0, len(removed), 100):
            part = removed[i:i + 100]
            ids = ','.join('"%s"' % x.replace('"', '') for x in part)
            fms.call('PATCH', '/rest/v1/records?org_id=eq.%s&coll=eq.%s&id=in.(%s)' % (org_id, urllib.parse.quote(coll), urllib.parse.quote(ids)),
                     {'deleted': True}, {'Prefer': 'return=minimal'})
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
                fms.upsert('blobs', [{'org_id': org_id, 'key': key, 'data': {'v': val}}], 'org_id,key')
                st['h']['blob:' + key] = h
    if d['nextNo'] > (next_no or 0) and not dry:
        fms.call('PATCH', '/rest/v1/orgs?id=eq.%s' % org_id, {'next_no': d['nextNo']}, {'Prefer': 'return=minimal'})

    # ---- import map (only new pairs)
    have = set(tuple(x) for x in st.get('src', []))
    fresh = [s for s in d['sources'] if tuple(s) not in have]
    if fresh and not dry:
        fms.upsert('import_map', [{'org_id': org_id, 'source': 'ventura', 'source_table': t, 'source_id': s, 'coll': c, 'id': f}
                                  for c, f, t, s in fresh], 'org_id,source,source_table,source_id')
        st['src'] = [list(x) for x in have | set(tuple(s) for s in fresh)]
    if not dry:
        save_state(cfg['STATE_DIR'], st)

    # ---- files
    budget = cfg['FILE_BUDGET_MB'] * 1024 * 1024
    up, up_bytes, missing = 0, 0, 0
    todo = [f for f in d['files'] if f['path'] not in st['files']]
    for f in todo:
        root = cfg['PRIVATE_MEDIA_ROOT'] if f['private'] else cfg['MEDIA_ROOT']
        local = os.path.join(root, f['src'].split('/', 1)[1])
        try:
            size, mtime = os.path.getsize(local), int(os.path.getmtime(local))
        except OSError:
            missing += 1
            st['missing'][f['path']] = int(time.time())
            continue
        if up_bytes + size > budget and up:
            break
        if dry:
            up += 1; up_bytes += size
            continue
        with open(local, 'rb') as fh:
            body = fh.read()
        ctype = mimetypes.guess_type(local)[0] or 'application/octet-stream'
        obj = '/storage/v1/object/company-files/%s/%s' % (org_id, urllib.parse.quote(f['path']))
        fms.call('POST', obj, raw=body, ctype=ctype, headers={'x-upsert': 'true'})
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
