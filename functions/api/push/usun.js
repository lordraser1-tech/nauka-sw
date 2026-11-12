import { readSession, json } from '../../_lib.js';
export async function onRequestPost({ request, env }) {
  const s = await readSession(request, env);
  if (!s) return json({ ok: false }, 401);
  await env.KODY.delete('push:' + s.d);
  return json({ ok: true });
}
