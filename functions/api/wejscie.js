// POST /api/wejscie { kod } → przypisuje urządzenie do kodu i ustawia ciasteczko.
import { normCode, getCode, putCode, makeCookie, readSession, json, deviceLabel } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.KODY || !env.SEKRET) return json({ ok: false, blad: 'Aplikacja nie jest jeszcze skonfigurowana.' }, 500);
  let body = {};
  try { body = await request.json(); } catch {}
  const code = normCode(body.kod);
  await new Promise(r => setTimeout(r, 400)); // spowalnia zgadywanie
  if (code.length < 6) return json({ ok: false, blad: 'Kod ma co najmniej 6 znaków.' }, 400);
  const rec = await getCode(env, code);
  if (!rec) return json({ ok: false, blad: 'Nie ma takiego kodu. Sprawdź, czy dobrze go przepisałeś.' }, 403);
  if (rec.blocked) return json({ ok: false, blad: 'Ten kod jest zablokowany.' }, 403);

  // To samo urządzenie loguje się ponownie tym samym kodem – nie zajmuje nowego miejsca.
  const s = await readSession(request, env);
  if (s && s.c === code && rec.devices.some(d => d.id === s.d)) {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': await makeCookie(env, code, s.d) } });
  }
  if (rec.max > 0 && rec.devices.length >= rec.max) {
    return json({ ok: false, blad: `Ten kod jest już użyty na ${rec.devices.length} ${rec.devices.length === 1 ? 'urządzeniu' : 'urządzeniach'} (limit ${rec.max}). Poproś twórcę o zwolnienie miejsca.` }, 403);
  }
  const id = crypto.randomUUID();
  rec.devices.push({ id, ts: Date.now(), ua: deviceLabel(request.headers.get('User-Agent')) });
  await putCode(env, code, rec);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': await makeCookie(env, code, id) } });
}
