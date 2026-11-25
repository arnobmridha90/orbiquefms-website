/* in-memory stand-in for supabase-js, for testing js/cloud.js without a server */
window.FAKE = { writes: [], uploads: [], role: 'owner', staffId: 'u1', failNo: false };
window.supabase = { createClient: function () {
  var session = JSON.parse(localStorage.getItem('fake.session') || 'null');
  function q(table) {
    var st = { table: table, filters: [] }, api = {
      select: function () { return api; }, eq: function (k, v) { st.filters.push([k, v]); return api; },
      range: function (a, b) { var src = table === 'records' ? FIX.rows : FIX.blobs; return Promise.resolve({ data: src.slice(a, b + 1), error: null }); },
      single: function () { return Promise.resolve({ data: { next_no: FIX.next, identity: FIX.identity, name: FIX.identity.name }, error: null }); },
      upsert: function (rows) { rows = [].concat(rows); FAKE.writes.push({ table: table, rows: JSON.parse(JSON.stringify(rows)) });
        if (table === 'records' && FAKE.role === 'readonly') return Promise.resolve({ error: { code: '42501', message: 'new row violates row-level security policy' } });
        if (table === 'records' && FAKE.failNo && rows.some(function (r) { return r.coll === 'bookings' && FIX.rows.some(function (x) { return x.coll === 'bookings' && x.id !== r.id && x.data.no === r.data.no; }); })) { return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } }); }
        return Promise.resolve({ error: null }); }
    };
    return api;
  }
  return {
    auth: {
      getSession: function () { return Promise.resolve({ data: { session: session } }); },
      onAuthStateChange: function () {},
      signInWithPassword: function (c) { if (c.password !== 'right-password') return Promise.resolve({ error: { message: 'Invalid login credentials' } }); session = { user: { email: c.email } }; localStorage.setItem('fake.session', JSON.stringify(session)); return Promise.resolve({ data: {}, error: null }); },
      signOut: function () { localStorage.removeItem('fake.session'); return Promise.resolve({}); },
      resetPasswordForEmail: function () { return Promise.resolve({}); }, updateUser: function () { return Promise.resolve({}); }
    },
    rpc: function (fn) {
      if (fn === 'my_context') return Promise.resolve({ data: { email: 'owner@test', workspaces: [{ id: 'org-1', slug: 'ventura-rehearsal', name: 'Ventura (rehearsal)', role: FAKE.role, staffId: FAKE.staffId, memberStatus: 'active', identity: FIX.identity }] }, error: null });
      if (fn === 'take_booking_no') return Promise.resolve({ data: 5000, error: null });
    },
    from: q,
    storage: { from: function () { return {
      upload: function (p, b) { FAKE.uploads.push(p); return Promise.resolve({ error: null }); },
      createSignedUrls: function (ps) { return Promise.resolve({ data: ps.map(function (p) { return { signedUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#9ab"/></svg>') }; }) }); }
    }; } },
    channel: function () { var c = { on: function () { return c; }, subscribe: function () { return c; } }; return c; }
  };
} };
