const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('fake.session', JSON.stringify({ user: { email: 'o@t' } })); window.__mirror = 1; });
  await p.route('**/s/fixture.js', async r => { const res = await r.fetch(); const t = await res.text(); r.fulfill({ response: res, body: t + ';FIX.identity.mirror={from:"Ventura’s own app",every:"5 minutes"};' }); });
  await p.goto('http://localhost:8811/s/test.html#home'); await p.waitForTimeout(2500);
  const toast1 = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const r = await p.evaluate(async () => { FAKE.writes = []; const before = S.bookings[0].note; S.bookings[0].note = 'Changed in FMS'; S.notes.pop(); save(); await new Promise(r => setTimeout(r, 900));
    return { writes: FAKE.writes.length, note: S.bookings[0].note === before, notes: S.notes.length, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }; });
  console.log('open toast:', toast1); console.log(JSON.stringify(r)); console.log('errors', errs);
  await b.close();
})();
