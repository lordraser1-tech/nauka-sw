// POST /api/zgloszenie – zgłoszenie błędu w pytaniu (tylko z ważnym kodem dostępu).
import { readSession, getCode, json } from '../_lib.js';

const cut = (s, n) => String(s || '').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  if (!env.KODY) return json({ ok: false }, 500);
  const s = await readSession(request, env);
  if (!s) return json({ ok: false, blad: 'Brak dostępu.' }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  const opis = cut(b.opis, 1000);
  if (!b.id || (!opis && !b.kat)) return json({ ok: false, blad: 'Opisz krótko błąd.' }, 400);
  const rec = await getCode(env, s.c, true);
  const ts = Date.now();
  const key = `zgl:${(9e15 - ts).toString(36)}-${crypto.randomUUID().slice(0, 6)}`; // najnowsze pierwsze na liście
  const val = { ts, id: cut(b.id, 40), kat: cut(b.kat, 40), opis, tresc: cut(b.tresc, 600), wer: cut(b.wer, 10), kto: rec ? rec.name : '?', done: false };
  await env.KODY.put(key, JSON.stringify(val), { metadata: { ts, id: val.id, done: false } });
  return json({ ok: true });
}
