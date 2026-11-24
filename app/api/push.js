// Sends one demo notification to the phone that asked for it, after a short delay,
// so it arrives with the app closed or the phone locked. Demo only: no data is stored.
const webpush = require('web-push');

const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(push\.services\.mozilla\.com|fcm\.googleapis\.com|android\.googleapis\.com|notify\.windows\.com|push\.apple\.com|web\.push\.apple\.com)\//i;
const clip = (s, n) => String(s || '').slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) { res.status(503).json({ error: 'push not set up' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const sub = body && body.subscription;
  if (!sub || !sub.endpoint || !ALLOWED.test(sub.endpoint) || !sub.keys) { res.status(400).json({ error: 'bad subscription' }); return; }
  const delay = Math.max(0, Math.min(15, Number(body.delay) || 0));
  const payload = JSON.stringify({ title: clip(body.title, 80), body: clip(body.body, 200), url: clip(body.url, 200), tag: clip(body.tag, 60), icon: clip(body.icon, 80) });
  webpush.setVapidDetails('mailto:noreply@orbiquefms.com', pub, priv);
  await new Promise((r) => setTimeout(r, delay * 1000));
  try {
    await webpush.sendNotification(sub, payload, { TTL: 300, urgency: 'high' });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'push failed', status: e.statusCode || null });
  }
};
