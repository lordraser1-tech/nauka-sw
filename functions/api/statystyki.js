// POST /api/statystyki – anonimowe liczniki odpowiedzi z jednego urządzenia (bez imienia i kodu).
// Klucz = losowy identyfikator wygenerowany w telefonie; wysyłka najwyżej co kilka godzin.
import { readSession, json } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.KODY) return json({ ok: false }, 500);
  if (!(await readSession(request, env))) return json({ ok: false }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  const sid = String(b.sid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
  if (sid.length < 12 || typeof b.h !== 'object' || !b.h) return json({ ok: false }, 400);
  const h = {};
  let n = 0;
  for (const [id, v] of Object.entries(b.h)) {
    if (n++ > 3000) break;
    if (!Array.isArray(v)) continue;
    const a = Math.max(0, Math.min(9999, v[0] | 0)), bad = Math.max(0, Math.min(a, v[1] | 0));
    if (a) h[String(id).slice(0, 40)] = [a, bad];
  }
  await env.KODY.put('st:' + sid, JSON.stringify({ t: Date.now(), h }), { metadata: { t: Date.now() } });
  return json({ ok: true });
}
