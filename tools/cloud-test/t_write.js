const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block', timezoneId: 'Asia/Kuala_Lumpur' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('fake.session', JSON.stringify({ user: { email: 'o@t' } })));
  await p.goto('http://localhost:8811/s/test.html#home'); await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/scratch-cloud/home2.png' });
  // 1. edit a booking -> one upsert row
  let r = await p.evaluate(async () => { FAKE.writes = []; S.bookings[0].note = 'Test note'; save(); await new Promise(r => setTimeout(r, 800)); return FAKE.writes.map(w => w.table + ':' + w.rows.map(x => x.coll + '/' + x.id + (x.deleted ? '(del)' : '')).join(',')); });
  console.log('edit ->', r);
  // 2. a photo taken in the app is uploaded and replaced by file:
  r = await p.evaluate(async () => { FAKE.writes = []; FAKE.uploads = []; const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); for (let i = 0; i < 300; i += 3) { g.fillStyle = 'rgb(' + i % 255 + ',' + (i * 7) % 255 + ',90)'; g.fillRect(i, 0, 3, 200); } const u = c.toDataURL('image/jpeg', .9);
    S.cars[0].gallery.push(u); save(); await new Promise(r => setTimeout(r, 1200)); return { uploads: FAKE.uploads, stored: S.cars[0].gallery.slice(-1)[0].slice(0, 60), rows: FAKE.writes.length }; });
  console.log('photo ->', JSON.stringify(r));
  // 3. a deleted record is marked deleted; audit trimming never deletes
  r = await p.evaluate(async () => { FAKE.writes = []; S.notes.pop(); S.audit.length = 10; save(); await new Promise(r => setTimeout(r, 800)); return FAKE.writes.map(w => w.rows.map(x => x.coll + '/' + x.id + (x.deleted ? '(del)' : '')).join(',')); });
  console.log('delete ->', r);
  // 4. two phones gave out the same booking number -> renumbered from the database
  r = await p.evaluate(async () => { FAKE.writes = []; FAKE.failNo = true; const b = JSON.parse(JSON.stringify(S.bookings[5])); b.id = 'bNEW'; b.no = 8; b.code = bookingCode(8); S.bookings.unshift(b); save(); await new Promise(r => setTimeout(r, 1200)); return { code: S.bookings[0].code, toast: document.querySelector('.snack, .toast, #toasts') && document.body.innerText.match(/was just taken[^\n]*/)?.[0] }; });
  console.log('clash ->', JSON.stringify(r));
  console.log('errors', errs);
  await b.close();
})();
