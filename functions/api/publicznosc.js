// GET /api/publicznosc – zbiorcze, anonimowe wyniki kursantów dla pytań (koło „Pytanie do publiczności”
// w Milionerach i poziom trudności pytań). Zwraca tylko liczby: { id: [odpowiedzi, błędne] }.
// Wynik jest liczony z kluczy st:* najwyżej raz na 6 godzin i trzymany w KV jako cfg:pub.
import { readSession, json } from '../_lib.js';

const TTL = 6 * 3600000;

export async function onRequestGet({ request, env }) {
  if (!env.KODY) return json({ t: 0, d: {} });
  if (!(await readSession(request, env))) return json({ ok: false }, 401);
  const cached = await env.KODY.get('cfg:pub', { type: 'json' });
  if (cached && Date.now() - cached.t < TTL) return json(cached);
  const agg = {};
  let cursor;
  do {
    const r = await env.KODY.list({ prefix: 'st:', cursor });
    for (const k of r.keys) {
      const v = await env.KODY.get(k.name, { type: 'json' });
      if (!v || !v.h) continue;
      for (const [id, [n, b]] of Object.entries(v.h)) {
        const a = agg[id] || (agg[id] = [0, 0, 0]);
        a[0] += n; a[1] += b; a[2]++;
      }
    }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  const d = {};
  for (const [id, [n, b, u]] of Object.entries(agg)) if (n >= 3) d[id] = [n, b, u];
  const out = { t: Date.now(), d };
  await env.KODY.put('cfg:pub', JSON.stringify(out));
  return json(out);
}
