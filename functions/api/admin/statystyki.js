// Panel: zbiorcze, anonimowe statystyki pytań ze wszystkich urządzeń.
import { adminOk, json } from '../../_lib.js';

export async function onRequest({ request, env }) {
  if (!(await adminOk(request, env))) return json({ blad: 'Złe hasło.' }, 401);
  const now = Date.now(), DAY = 86400000;
  const agg = {};
  let devices = 0, active7 = 0, active1 = 0, answers = 0, bad = 0, cursor;
  do {
    const r = await env.KODY.list({ prefix: 'st:', cursor });
    for (const k of r.keys) {
      const v = await env.KODY.get(k.name, { type: 'json' });
      if (!v) continue;
      devices++;
      if (now - v.t < 7 * DAY) active7++;
      if (now - v.t < DAY) active1++;
      for (const [id, [n, b]] of Object.entries(v.h || {})) {
        const a = agg[id] || (agg[id] = { n: 0, bad: 0, u: 0 });
        a.n += n; a.bad += b; a.u++;
        answers += n; bad += b;
      }
    }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);

  // Treść pytań z pliku aplikacji (z pominięciem bramki).
  let items = {}, decks = {};
  try {
    const res = env.ASSETS ? await env.ASSETS.fetch(new Request(new URL('/pytania_sw.json', request.url))) : null;
    if (res && res.ok) {
      const data = await res.json();
      for (const d of data.decks) decks[d.id] = d.name;
      for (const it of data.items) items[it.id] = it;
    }
  } catch {}
  const label = it => it ? (it.question || it.front || (it.title ? (it.type === 'case' ? 'Kazus: ' : 'Pary: ') + it.title : '') || String(it.text || '').replace(/\[\[[^\]]*\]\]/g, '___')).slice(0, 220) : '';
  const correct = it => !it ? '' : it.type === 'mcq' ? it.options[it.answer] : it.type === 'flashcard' ? String(it.back).slice(0, 200) : '';

  const rows = Object.entries(agg).map(([id, a]) => ({ id, ...a, p: a.bad / a.n }));
  const hardest = rows.filter(r => r.n >= 5 && r.u >= 2).sort((x, y) => y.p - x.p || y.n - x.n).slice(0, 40)
    .map(r => ({ ...r, tresc: label(items[r.id]), poprawna: correct(items[r.id]), talia: decks[items[r.id]?.deck] || '', typ: items[r.id]?.type || '' }));
  const byDeck = {};
  for (const r of rows) {
    const dk = items[r.id]?.deck || '?';
    const x = byDeck[dk] || (byDeck[dk] = { talia: decks[dk] || dk, n: 0, bad: 0 });
    x.n += r.n; x.bad += r.bad;
  }
  return json({ urzadzenia: devices, aktywne7: active7, aktywne1: active1, odpowiedzi: answers, bledne: bad,
    najtrudniejsze: hardest, talie: Object.values(byDeck).sort((a, b) => b.bad / b.n - a.bad / a.n) });
}
