import { getVapid } from '../../_push.js';
import { json } from '../../_lib.js';
export async function onRequestGet({ env }) {
  if (!env.KODY) return json({ blad: 'Brak KV' }, 500);
  return json({ k: (await getVapid(env)).pub });
}
