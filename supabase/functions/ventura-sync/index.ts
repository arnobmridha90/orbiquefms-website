// ventura-sync: the only door the Ventura server uses to write into FMS.
// The server holds an Ed25519 private key; FMS stores only its public key (table sync_clients). Every request is signed
// over: time, client id, operation, arguments and the SHA-256 of the body. A request is accepted only if the signature
// checks out, the time is within 5 minutes, and it touches nothing but that client's own company.
// No secret key ever leaves this function (it uses the project's built-in service role).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const TABLES: Record<string, string> = { records: 'org_id,coll,id', blobs: 'org_id,key', import_map: 'org_id,source,source_table,source_id' };

function out(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return out(405, { error: 'POST only' });
    const clientId = req.headers.get('x-sync-client') || '';
    const op = req.headers.get('x-sync-op') || '';
    const argsTxt = req.headers.get('x-sync-args') || '{}';
    const t = req.headers.get('x-sync-time') || '';
    const sig = req.headers.get('x-sync-sig') || '';
    if (!/^[0-9a-f-]{36}$/.test(clientId) || !/^\d{9,11}$/.test(t) || !sig) return out(401, { error: 'unsigned' });
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return out(401, { error: 'clock more than 5 minutes off' });
    const { data: cl } = await db.from('sync_clients').select('id,org_id,public_key,active').eq('id', clientId).maybeSingle();
    if (!cl || !cl.active) return out(401, { error: 'unknown client' });
    const body = new Uint8Array(await req.arrayBuffer());
    const msg = [t, clientId, op, argsTxt, hex(await crypto.subtle.digest('SHA-256', body))].join('\n');
    const key = await crypto.subtle.importKey('raw', b64(cl.public_key), { name: 'Ed25519' }, false, ['verify']);
    if (!(await crypto.subtle.verify({ name: 'Ed25519' }, key, b64(sig), enc.encode(msg)))) return out(401, { error: 'bad signature' });
    await db.from('sync_clients').update({ last_seen: new Date().toISOString() }).eq('id', clientId);
    const org = cl.org_id as string;
    const args = JSON.parse(argsTxt);

    if (op === 'hello') {
      const { data, error } = await db.from('orgs').select('id,slug,next_no').eq('id', org).single();
      return error ? out(500, { error: error.message }) : out(200, data);
    }
    if (op === 'upsert') {
      const conflict = TABLES[args.table];
      if (!conflict) return out(400, { error: 'table not allowed' });
      const rows = JSON.parse(new TextDecoder().decode(body));
      if (!Array.isArray(rows) || rows.length > 1000) return out(400, { error: 'rows must be a list of at most 1000' });
      for (const r of rows) r.org_id = org;                 // always this client's own company
      if (args.table === 'import_map') for (const r of rows) r.source = 'ventura';
      const { error } = await db.from(args.table).upsert(rows, { onConflict: conflict });
      return error ? out(500, { error: error.message }) : out(200, { ok: rows.length });
    }
    if (op === 'mark_deleted') {
      const ids = JSON.parse(new TextDecoder().decode(body));
      if (typeof args.coll !== 'string' || !Array.isArray(ids) || ids.length > 1000) return out(400, { error: 'bad request' });
      const { error } = await db.from('records').update({ deleted: true }).eq('org_id', org).eq('coll', args.coll).in('id', ids);
      return error ? out(500, { error: error.message }) : out(200, { ok: ids.length });
    }
    if (op === 'next_no') {
      const n = Number(args.n);
      if (!Number.isInteger(n) || n < 1) return out(400, { error: 'bad number' });
      const { error } = await db.from('orgs').update({ next_no: n }).eq('id', org).lt('next_no', n);
      return error ? out(500, { error: error.message }) : out(200, { ok: 1 });
    }
    if (op === 'upload') {
      const p = String(args.path || '');
      if (!p || p.startsWith('/') || p.split('/').some((s) => s === '..' || s === '') || p.length > 400) return out(400, { error: 'bad path' });
      if (body.length > 50 * 1024 * 1024) return out(413, { error: 'file too large' });
      const { error } = await db.storage.from('company-files').upload(org + '/' + p, body, {
        upsert: true, contentType: req.headers.get('content-type') || 'application/octet-stream',
      });
      return error ? out(500, { error: error.message }) : out(200, { ok: 1 });
    }
    return out(400, { error: 'unknown operation' });
  } catch (e) {
    return out(500, { error: String((e as Error)?.message || e).slice(0, 300) });
  }
});
