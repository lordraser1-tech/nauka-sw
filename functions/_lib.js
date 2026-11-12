// Wspólne funkcje: podpisywanie ciasteczka, odczyt kodów z KV, odpowiedzi JSON.
// Wymagane ustawienia projektu w Cloudflare Pages:
//   KODY        – powiązanie (binding) z przestrzenią KV
//   SEKRET      – długi losowy tekst do podpisywania ciasteczek (zmiana = wszyscy muszą zalogować się ponownie)
//   ADMIN_HASLO – hasło do panelu /admin

export const COOKIE = 'nsw_dostep';
export const FRESH_MS = 3 * 60 * 1000;          // tyle ufamy świeżemu logowaniu, zanim KV się zsynchronizuje
const MAX_AGE = 400 * 24 * 3600;                 // ciasteczko ważne ok. 400 dni
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez 0/O i 1/I

const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export function normCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function newCode(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
}

export async function makeCookie(env, code, device) {
  const payload = b64u(enc.encode(JSON.stringify({ c: code, d: device, t: Date.now() })));
  const sig = await hmac(env.SEKRET, payload);
  return `${COOKIE}=${payload}.${sig}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function readSession(request, env) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m || !env.SEKRET) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || sig !== await hmac(env.SEKRET, payload)) return null;
  try { return JSON.parse(fromB64u(payload)); } catch { return null; }
}

export const key = code => 'kod:' + code;

export async function getCode(env, code, fast) {
  return env.KODY.get(key(code), fast ? { type: 'json', cacheTtl: 60 } : { type: 'json' });
}

export async function putCode(env, code, rec) {
  // metadane = skrót do listy w panelu (jedno zapytanie zamiast wielu)
  const meta = { name: String(rec.name || '').slice(0, 80), max: rec.max, n: rec.devices.length, blocked: !!rec.blocked, created: rec.created };
  await env.KODY.put(key(code), JSON.stringify(rec), { metadata: meta });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function deviceLabel(ua) {
  ua = ua || '';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'inne';
  const br = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

// Porównanie hasła odporne na pomiar czasu.
export async function adminOk(request, env) {
  const given = request.headers.get('X-Admin') || '';
  if (!env.ADMIN_HASLO || !given) return false;
  const [a, b] = await Promise.all([given, env.ADMIN_HASLO].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
