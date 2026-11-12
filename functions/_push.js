// Powiadomienia od Chorążego Bielika (Web Push z kluczami VAPID, bez treści w samym pushu –
// telefon po otrzymaniu sygnału pobiera tekst z /api/push/wiadomosc).
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(enc.encode(s));

// Klucze VAPID tworzone automatycznie przy pierwszym użyciu i trzymane w KV (nigdy w repozytorium).
export async function getVapid(env) {
  let v = await env.KODY.get('cfg:vapid', { type: 'json' });
  if (v) return v;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  v = { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.KODY.put('cfg:vapid', JSON.stringify(v));
  return v;
}

async function vapidAuth(endpoint, vapid, sub) {
  const header = b64uStr(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64uStr(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub }));
  const key = await crypto.subtle.importKey('jwk', vapid.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${vapid.pub}`;
}

export async function sendPush(env, rec, vapid) {
  const res = await fetch(rec.sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(rec.sub.endpoint, vapid, rec.origin || 'mailto:nauka-sw@users.noreply.github.com'), TTL: '43200', Urgency: 'normal', 'Content-Length': '0' },
  });
  return res.status;
}

const T = {
  dzis: [
    { t: 'Kursancie, dziś jeszcze zero. 10 minut i seria uratowana.' },
    { t: 'Melduję: aplikacja tęskni. Ja nie. Ale seria tak.', o: 'Melduję: aplikacja tęskni. Ja mam cię w dupie. Ale seria tak.' },
    { t: 'Seria {seria} dni. Do północy zostało niewiele. Rusz 4 litery.', seria: true }],
  p1: [{ t: 'Wczoraj nic. Dziś też nic? Nie rób mi tego.' }],
  p2: [{ t: 'DWA DNI. Mam twój numer. Dosłownie.' }],
  p3: [{ t: 'Trzy dni ciszy. Zgłaszam zaginięcie kursanta.' }],
  p5: [{ t: '{przerwa} dni bez nauki. Ponad 10 to w służbie porzucenie. Sprawdź w pragmatyce.' }],
  p7: [{ t: 'Tydzień. Nie piszę więcej. …Dobra, piszę. Wracaj.' }],
  e7: [{ t: 'Tydzień do egzaminu. Egzamin próbny – dziś.' }],
  e3: [{ t: '3 dni. Trudne, kazusy, egzamin próbny. W tej kolejności.' }],
  e1: [{ t: 'Jutro egzamin. Krótka powtórka i spać. To rozkaz.' }],
  e0: [{ t: 'Dziś egzamin. Powodzenia, kursancie! Dziób do góry.' }],
};

const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

// Zwraca klucz tekstu do wysłania teraz albo null.
export function pushPlan(rec, nowMs) {
  const local = new Date(nowMs + (rec.tz || 60) * 60000);
  const day = local.toISOString().slice(0, 10), hour = local.getUTCHours();
  if (rec.sentDay === day) return null;
  const dte = rec.exam ? dayDiff(day, rec.exam) : null;
  if (dte === 0) return hour === 7 ? { key: 'e0', day } : null;
  if (hour !== (rec.hour ?? 19)) return null;
  if (dte === 7 || dte === 3 || dte === 1) return { key: 'e' + dte, day };
  if (rec.last === day) return null; // dziś już była nauka
  if (!rec.last) return { key: 'dzis', day };
  const d = dayDiff(rec.last, day);
  if (d <= 1) return { key: 'dzis', day };
  if (d === 2) return { key: 'p1', day };
  if (d === 3) return { key: 'p2', day };
  if (d === 4) return { key: 'p3', day };
  if (d <= 7) return { key: 'p5', day, przerwa: d - 1 };
  return (d - 8) % 3 === 0 ? { key: 'p7', day } : null;
}

export function pushText(key, rec, vars) {
  let list = T[key] || T.dzis;
  if (key === 'dzis' && !(rec.seria >= 2)) list = list.filter(x => !x.seria);
  const pick = list[Math.floor(Math.random() * list.length)];
  let t = (rec.ostro !== false && pick.o) || pick.t;
  for (const [k, v] of Object.entries({ seria: rec.seria || 0, ...(vars || {}) })) t = t.split('{' + k + '}').join(String(v));
  return t;
}

// Co godzinę (Cron Trigger): kto ma dostać przypomnienie.
export async function runPushCron(env, nowMs) {
  if (!env.KODY) return { sent: 0 };
  const now = nowMs || Date.now();
  let vapid = null, sent = 0, removed = 0, cursor;
  do {
    const r = await env.KODY.list({ prefix: 'push:', cursor });
    for (const k of r.keys) {
      const m = k.metadata || {};
      if (!pushPlan({ ...m, sentDay: m.sentDay }, now)) continue; // szybkie odrzucenie na metadanych
      const rec = await env.KODY.get(k.name, { type: 'json' });
      if (!rec || !rec.sub) continue;
      const plan = pushPlan(rec, now);
      if (!plan) continue;
      vapid = vapid || await getVapid(env);
      rec.msg = { title: 'Chorąży Bielik', body: pushText(plan.key, rec, { przerwa: plan.przerwa }) };
      rec.sentDay = plan.day;
      let status = 0;
      try { status = await sendPush(env, rec, vapid); } catch (e) { status = 0; }
      if (status === 404 || status === 410) { await env.KODY.delete(k.name); removed++; continue; }
      await savePush(env, k.name, rec);
      if (status >= 200 && status < 300) sent++;
    }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return { sent, removed };
}

export async function savePush(env, key, rec) {
  await env.KODY.put(key, JSON.stringify(rec), { metadata: { hour: rec.hour, tz: rec.tz, last: rec.last, exam: rec.exam, sentDay: rec.sentDay || null } });
}
