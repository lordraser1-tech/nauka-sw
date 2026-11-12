// Panel: zgłoszenia błędów. GET – lista; POST { akcja: 'zalatwione'|'otworz'|'usun', klucz }.
import { adminOk, json } from '../../_lib.js';

export async function onRequest({ request, env }) {
  if (!(await adminOk(request, env))) return json({ blad: 'Złe hasło.' }, 401);
  if (request.method === 'GET') {
    const out = [];
    let cursor;
    do {
      const r = await env.KODY.list({ prefix: 'zgl:', cursor });
      for (const k of r.keys) {
        const v = await env.KODY.get(k.name, { type: 'json' });
        if (v) out.push({ klucz: k.name, ...v });
      }
      cursor = r.list_complete ? null : r.cursor;
    } while (cursor && out.length < 500);
    return json({ zgloszenia: out });
  }
  let b = {};
  try { b = await request.json(); } catch {}
  const k = String(b.klucz || '');
  if (!k.startsWith('zgl:')) return json({ blad: 'Zły klucz.' }, 400);
  if (b.akcja === 'usun') { await env.KODY.delete(k); return json({ ok: true }); }
  const v = await env.KODY.get(k, { type: 'json' });
  if (!v) return json({ blad: 'Nie ma takiego zgłoszenia.' }, 404);
  v.done = b.akcja === 'zalatwione';
  await env.KODY.put(k, JSON.stringify(v), { metadata: { ts: v.ts, id: v.id, done: v.done } });
  return json({ ok: true });
}
