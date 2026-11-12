// GET – tekst ostatniego powiadomienia dla tego urządzenia (pobiera service worker po otrzymaniu pusha).
import { readSession, json } from '../../_lib.js';
export async function onRequestGet({ request, env }) {
  const s = await readSession(request, env);
  const rec = s && await env.KODY.get('push:' + s.d, { type: 'json' });
  return json(rec && rec.msg ? rec.msg : { title: 'Chorąży Bielik', body: 'Kursancie, czas na naukę!' });
}
