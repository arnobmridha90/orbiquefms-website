"""Turn ventura_export.py's JSON into SQL that loads one company into the FMS database.

    python fms_load.py out/ventura-fms.json --slug ventura --name "Ventura" --out out/sql
    psql "$DB" -f out/sql/01.sql ...         (or apply each file through the Supabase SQL tools, in name order)

Every statement is an upsert keyed on (company, collection, id), so running it again updates rows instead of making
copies. Records whose Ventura id is already in import_map keep their FMS id. The company row is created if missing
(found by slug). Files are not uploaded here: see upload_files.py.
Each output file stays under about 900 KB (the Supabase SQL tool's limit is about 1 MB).
"""
import argparse
import json
import os


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def jq(obj):
    return q(json.dumps(obj, ensure_ascii=False, separators=(',', ':'))) + '::jsonb'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('json')
    ap.add_argument('--slug', required=True)
    ap.add_argument('--name')
    ap.add_argument('--out', required=True)
    ap.add_argument('--max', type=int, default=900_000)
    ap.add_argument('--mirror', help='name of the system the company keeps working in (e.g. "Ventura’s own app"): the company '
                    'is view-only in FMS (status paused) and ventura_sync.py keeps it up to date')
    a = ap.parse_args()
    d = json.load(open(a.json))
    os.makedirs(a.out, exist_ok=True)
    for f in os.listdir(a.out):
        if f.endswith('.sql'):
            os.remove(os.path.join(a.out, f))
    org = "(select id from public.orgs where slug = %s)" % q(a.slug)
    ident = dict(d['identity'], name=a.name or d['identity']['name'])
    if a.mirror:
        ident['mirror'] = {'from': a.mirror, 'every': '5 minutes'}
    status = 'paused' if a.mirror else 'active'
    head = [
        "insert into public.orgs (slug, name, identity, next_no, status) values (%s, %s, %s, %d, %s) "
        "on conflict (slug) do update set identity = excluded.identity, status = excluded.status, next_no = greatest(public.orgs.next_no, excluded.next_no);"
        % (q(a.slug), q(ident['name']), jq(ident), d['nextNo'], q(status)),
        "insert into public.blobs (org_id, key, data) values (%s, 'settings', %s) on conflict (org_id, key) do update set data = excluded.data;"
        % (org, jq({'v': d['settings']})),
        "insert into public.blobs (org_id, key, data) values (%s, 'assistant', %s) on conflict (org_id, key) do update set data = excluded.data;"
        % (org, jq({'v': d['assistant']})),
    ]
    stmts = list(head)
    for coll, rows in d['collections'].items():
        batch, size = [], 0
        for r in rows:
            v = "(%s, %s, %s, %s)" % (org, q(coll), q(r['id']), jq(r))
            if batch and size + len(v) > 200_000:
                stmts.append(_ins(batch)); batch, size = [], 0
            batch.append(v); size += len(v)
        if batch:
            stmts.append(_ins(batch))
    src = d['sources']
    for i in range(0, len(src), 2000):
        vals = ','.join("(%s, 'ventura', %s, %s, %s, %s)" % (org, q(t), q(s), q(c), q(f)) for c, f, t, s in src[i:i + 2000])
        stmts.append("insert into public.import_map (org_id, source, source_table, source_id, coll, id) values %s "
                     "on conflict (org_id, source, source_table, source_id) do update set coll = excluded.coll, id = excluded.id, imported_at = now();" % vals)
    files, cur, n = [], [], 0
    for s in stmts:
        if cur and n + len(s) > a.max:
            files.append(cur); cur, n = [], 0
        cur.append(s); n += len(s)
    if cur:
        files.append(cur)
    for i, f in enumerate(files, 1):
        with open(os.path.join(a.out, '%02d.sql' % i), 'w') as fh:
            fh.write('\n'.join(f) + '\n')
    print('%d statements in %d files' % (len(stmts), len(files)))


def _ins(vals):
    return ("insert into public.records (org_id, coll, id, data) values %s "
            "on conflict (org_id, coll, id) do update set data = excluded.data, deleted = false;" % ','.join(vals))


if __name__ == '__main__':
    main()
