// POST /api/push/zapis – włączenie powiadomień lub aktualizacja (godzina, ostatni dzień nauki, seria, data egzaminu).
import { readSession, json } from '../../_lib.js';
import { savePush } from '../../_push.js';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export async function onRequestPost({ request, env }) {
  const s = await readSession(request, env);
  if (!s) return json({ ok: false }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  const key = 'push:' + s.d;
  const rec = (await env.KODY.get(key, { type: 'json' })) || {};
  if (b.sub) {
    if (!b.sub.endpoint || !/^https:\/\//.test(b.sub.endpoint)) return json({ ok: false, blad: 'Zła subskrypcja' }, 400);
    rec.sub = { endpoint: String(b.sub.endpoint).slice(0, 800) };
  }
  if (!rec.sub) return json({ ok: false, blad: 'Brak subskrypcji' }, 400);
  const hr = parseInt(b.hour, 10);
  if (hr >= 0 && hr <= 23) rec.hour = hr;
  const tz = parseInt(b.tz, 10);
  if (tz >= -720 && tz <= 840) rec.tz = tz;
  if (DAY.test(b.last || '')) rec.last = b.last;
  if (DAY.test(b.exam || '')) rec.exam = b.exam;
  rec.seria = Math.max(0, Math.min(9999, parseInt(b.seria, 10) || 0));
  rec.ostro = b.ostro !== false;
  rec.origin = new URL(request.url).origin;
  await savePush(env, key, rec);
  return json({ ok: true });
}
