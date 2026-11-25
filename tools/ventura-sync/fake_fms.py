import json, http.server, sys, urllib.parse
DB={'records':{}, 'blobs':{}, 'files':{}, 'map':0, 'patch_del':0, 'orgs':{'next_no':1}}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def _send(self,code,obj=None):
        b=json.dumps(obj).encode() if obj is not None else b''
        self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def body(self):
        n=int(self.headers.get('Content-Length') or 0); return self.rfile.read(n)
    def do_GET(self):
        if self.path.startswith('/rest/v1/orgs'): return self._send(200,[{'id':'00000000-0000-0000-0000-000000000001','next_no':DB['orgs']['next_no']}])
        if self.path=='/dump': return self._send(200,{'records':len(DB['records']),'deleted':sum(1 for r in DB['records'].values() if r['deleted']),'blobs':list(DB['blobs']),'files':len(DB['files']),'map':DB['map'],'next_no':DB['orgs']['next_no'],
            'money':sum(i['amt'] for k,r in DB['records'].items() if k[0]=='bookings' and not r['deleted'] for p in r['data']['payments'] if not p['voided'] for i in p['items'])})
        self._send(404,{})
    def do_POST(self):
        assert self.headers['apikey']=='svc'
        b=self.body()
        if self.path.startswith('/rest/v1/records'):
            for r in json.loads(b): DB['records'][(r['coll'],r['id'])]=r
        elif self.path.startswith('/rest/v1/blobs'):
            for r in json.loads(b): DB['blobs'][r['key']]=r
        elif self.path.startswith('/rest/v1/import_map'): DB['map']+=len(json.loads(b))
        elif self.path.startswith('/storage/'): DB['files'][self.path]=len(b)
        self._send(201)
    def do_PATCH(self):
        b=json.loads(self.body()); q=urllib.parse.unquote(self.path)
        if q.startswith('/rest/v1/orgs'): DB['orgs'].update(b)
        else:
            coll=q.split('coll=eq.')[1].split('&')[0]; ids=q.split('id=in.(')[1].rstrip(')').replace('"','').split(',')
            for i in ids: DB['records'][(coll,i)]['deleted']=True
        self._send(204)
http.server.ThreadingHTTPServer(('127.0.0.1',8799),H).serve_forever()
