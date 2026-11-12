// Panel twórcy. Każde zapytanie wymaga nagłówka X-Admin = ADMIN_HASLO.
//   GET  /api/admin/kody                         – lista kodów
//   POST /api/admin/kody { akcja, ... }          – nowe kody, reset, blokada, usunięcie
import { adminOk, json, newCode, normCode, getCode, putCode, key } from '../../_lib.js';

export async function onRequest({ request, env }) {
  if (!env.KODY) return json({ blad: 'Brak powiązania KODY (KV).' }, 500);
  if (!(await adminOk(request, env))) return json({ blad: 'Złe hasło.' }, 401);
  if (request.method === 'GET') {
    const one = normCode(new URL(request.url).searchParams.get('kod'));
    if (!one) return list(env);
    const rec = await getCode(env, one);
    return rec ? json({ kod: { code: one, ...rec } }) : json({ blad: 'Nie ma takiego kodu.' }, 404);
  }
  if (request.method !== 'POST') return json({ blad: 'Metoda niedozwolona.' }, 405);
  let b = {};
  try { b = await request.json(); } catch {}
  const max = Math.max(0, Math.min(1000, parseInt(b.max, 10) || 0));

  if (b.akcja === 'nowe') {
    // b.nazwy: ["Jan K.", "Anna N.", ...] – po jednym kodzie na osobę; b.kod – własny kod (opcjonalnie, dla jednej pozycji)
    const names = (Array.isArray(b.nazwy) ? b.nazwy : [b.nazwa]).map(s => String(s || '').trim()).filter(Boolean).slice(0, 300);
    if (!names.length) return json({ blad: 'Podaj przynajmniej jedną nazwę.' }, 400);
    const own = normCode(b.kod);
    if (own && (own.length < 6 || names.length > 1)) return json({ blad: 'Własny kod: co najmniej 6 znaków i tylko dla jednej pozycji.' }, 400);
    if (own && await env.KODY.get(key(own))) return json({ blad: 'Taki kod już istnieje.' }, 409);
    const out = [];
    for (const name of names) {
      let code = own;
      while (!code || await env.KODY.get(key(code))) code = newCode();
      await putCode(env, code, { name, max, devices: [], blocked: false, created: Date.now() });
      out.push({ name, code, max });
    }
    return json({ ok: true, nowe: out });
  }

  const code = normCode(b.kod);
  const rec = code && await getCode(env, code);
  if (!rec) return json({ blad: 'Nie ma takiego kodu.' }, 404);
  if (b.akcja === 'reset') rec.devices = b.urzadzenie ? rec.devices.filter(d => d.id !== b.urzadzenie) : [];
  else if (b.akcja === 'blokuj') rec.blocked = !!b.blokada;
  else if (b.akcja === 'limit') rec.max = max;
  else if (b.akcja === 'usun') { await env.KODY.delete(key(code)); return json({ ok: true }); }
  else return json({ blad: 'Nieznana akcja.' }, 400);
  await putCode(env, code, rec);
  return json({ ok: true, kod: { code, ...rec } });
}

async function list(env) {
  const out = [];
  let cursor;
  do {
    const r = await env.KODY.list({ prefix: 'kod:', cursor });
    for (const k of r.keys) out.push({ code: k.name.slice(4), ...(k.metadata || {}) });
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  out.sort((a, b) => (b.created || 0) - (a.created || 0));
  return json({ kody: out });
}
