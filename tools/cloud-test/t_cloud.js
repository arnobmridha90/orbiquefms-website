const { chromium, devices } = require('playwright');
const ROUTES = ['home','bookings','bookings/all','booking/b1378','booking/b8','new','chat','more','customers','customer/cu1','cars','car/car1','availability','calendar','schedule','tasks','task/t1','maintenance','summons','tracking','expenses','mymoney','deposits','deposit/b13','cash','invoices','instalments','reports','team','person/u1','settings','activity','leads','money','notifs','inbox'];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8811/s/test.html'); await p.waitForTimeout(800);
  await p.fill('#clEmail', 'owner@test'); await p.fill('#clPass', 'wrong'); await p.click('#clGo'); await p.waitForTimeout(300);
  console.log('wrong pw banner:', await p.textContent('.banner'));
  await p.fill('#clPass', 'right-password'); await p.click('#clGo'); await p.waitForTimeout(2500);
  console.log('after sign in hash', await p.evaluate(() => location.hash), 'title', await p.title());
  await p.screenshot({ path: '/home/claude/scratch-cloud/home.png' });
  const out = [];
  for (const r of ROUTES) {
    const before = errs.length;
    await p.evaluate(h => { location.hash = '#' + h; }, r); await p.waitForTimeout(450);
    const txt = (await p.textContent('#app')).replace(/\s+/g, ' ').slice(0, 110);
    out.push(r + (errs.length > before ? '  ERR ' + errs.slice(before).join(' | ') : '') + '  :: ' + txt);
    if (['bookings','booking/b8','customers','cars','reports','expenses'].includes(r)) await p.screenshot({ path: '/home/claude/scratch-cloud/' + r.replace('/', '-') + '.png' });
  }
  console.log(out.join('\n'));
  const w = await p.evaluate(() => FAKE.writes.length); console.log('writes so far', w);
  await b.close();
})();
