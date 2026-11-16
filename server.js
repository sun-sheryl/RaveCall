import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, BOOTH_KEY } = process.env;

let EVENTS;
try {
  EVENTS = JSON.parse(process.env.EVENTS_JSON || '{"NEON24":"Neon Warehouse","SUNRISE":"Sunrise Fields"}');
} catch (e) {
  console.error('EVENTS_JSON is not valid JSON:', e.message);
  EVENTS = {};
}
const missing = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].filter(k => !process.env[k]);
if (missing.length) console.error('Missing environment variables:', missing.join(', '));

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Open /health in a browser to see what the server has (yes/no only, never the secrets)
app.get('/health', (req, res) => {
  res.json({
    LIVEKIT_URL: !!LIVEKIT_URL,
    LIVEKIT_URL_starts_with_wss: !!LIVEKIT_URL && LIVEKIT_URL.startsWith('wss://'),
    LIVEKIT_API_KEY: !!LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: !!LIVEKIT_API_SECRET,
    BOOTH_KEY: !!BOOTH_KEY,
    event_codes_loaded: Object.keys(EVENTS).length,
  });
});

// Limit wrong event-code guesses: 50 per IP per 10 minutes (venues share one IP, so this is generous)
const wrong = new Map();
setInterval(() => wrong.clear(), 10 * 60 * 1000);

const ID = /^[a-z0-9]{4,12}$/;

app.post('/token', async (req, res) => {
  try {
    const b = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.ip;

    const isBooth = !!BOOTH_KEY && b.boothKey === BOOTH_KEY;
    let identity = String(b.identity || '').toLowerCase();
    if (isBooth) identity = 'soundboard';
    else if (!ID.test(identity) || identity.startsWith('soundboard')) return res.status(400).json({ error: 'bad identity' });

    let grant, label;

    if (b.mode === 'voice') {
      // Friend voice chat: each person has a private room named after their voice code.
      // No event code needed. Only the owner can speak in it; everyone else just listens.
      const target = String(b.target || '').toLowerCase();
      if (!ID.test(target) || target.startsWith('soundboard')) return res.status(400).json({ error: 'bad target' });
      const owner = b.owner === true;
      if (owner && identity !== target) return res.status(403).json({ error: 'not your room' });
      if (!owner && identity === target) return res.status(400).json({ error: 'bad listener' });
      label = 'Voice chat';
      grant = { room: `voice-${target}`, roomJoin: true, canSubscribe: true, canPublish: owner };
    } else {
      if ((wrong.get(ip) || 0) > 50) return res.status(429).json({ error: 'slow down' });
      const code = String(b.code || '').toUpperCase().replace(/[\s-]+/g, '');
      const event = EVENTS[code];
      if (!event) { wrong.set(ip, (wrong.get(ip) || 0) + 1); return res.status(401).json({ error: 'bad code' }); }
      label = event;
      // Event rooms are listen-only for guests. Only the booth can publish.
      grant = { room: `event-${code}`, roomJoin: true, canSubscribe: true, canPublish: isBooth };
    }

    const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: name || undefined, ttl: '8h' });
    at.addGrant(grant);
    res.json({ token: await at.toJwt(), url: LIVEKIT_URL, event: label });
  } catch (e) {
    console.error('Token error:', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('RaveCall running'));
