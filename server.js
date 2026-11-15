import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, BOOTH_KEY } = process.env;
// Event codes -> event names. Set EVENTS_JSON in your host's env vars, e.g. {"NEON24":"Neon Warehouse"}
const EVENTS = JSON.parse(process.env.EVENTS_JSON || '{"NEON24":"Neon Warehouse","SUNRISE":"Sunrise Fields"}');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Simple brute-force limit: 20 attempts per IP per 10 minutes
const tries = new Map();
setInterval(() => tries.clear(), 10 * 60 * 1000);

app.post('/token', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  tries.set(ip, (tries.get(ip) || 0) + 1);
  if (tries.get(ip) > 20) return res.status(429).json({ error: 'slow down' });

  const code = String(req.body.code || '').toUpperCase().replace(/[\s-]+/g, '');
  const event = EVENTS[code];
  if (!event) return res.status(401).json({ error: 'bad code' });

  const isBooth = BOOTH_KEY && req.body.boothKey === BOOTH_KEY;
  let identity = String(req.body.identity || '').toLowerCase();
  if (isBooth) identity = 'soundboard';
  else if (!/^[a-z0-9]{4,12}$/.test(identity)) return res.status(400).json({ error: 'bad identity' });

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, ttl: '8h' });
  at.addGrant({
    room: `event-${code}`,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishSources: ['microphone'],
  });
  res.json({ token: await at.toJwt(), url: LIVEKIT_URL, event });
});

app.listen(process.env.PORT || 3000, () => console.log('RaveCall running'));
