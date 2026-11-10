// Bramka: bez ważnego kodu zamiast aplikacji pokazuje się ekran logowania.
import { readSession, getCode, FRESH_MS } from './_lib.js';

const OPEN = [/^\/api\//, /^\/admin(\.html)?\/?$/, /^\/ikony\//, /^\/manifest\.json$/];

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const path = new URL(request.url).pathname;
  if (OPEN.some(r => r.test(path))) return next();
  if (!env.KODY || !env.SEKRET) return new Response('Brak konfiguracji: ustaw KODY (KV) i SEKRET w ustawieniach projektu.', { status: 500 });

  const s = await readSession(request, env);
  if (s) {
    const fresh = Date.now() - s.t < FRESH_MS;
    const rec = await getCode(env, s.c, true);
    const ok = rec ? !rec.blocked && (fresh || rec.devices.some(d => d.id === s.d)) : fresh;
    if (ok) {
      const res = await next();
      if (path === '/' || path.endsWith('.html')) {
        const r = new Response(res.body, res);
        r.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return r;
      }
      return res;
    }
  }
  return loginPage(s ? 'Dostęp z tego urządzenia wygasł albo kod został zablokowany. Wpisz kod jeszcze raz albo skontaktuj się z twórcą.' : '');
}

function loginPage(msg) {
  const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Nauka SW – wejście</title>
<link rel="icon" href="/ikony/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/ikony/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<style>
 :root{color-scheme:light dark}
 body{margin:0;font:17px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#eef2f7;color:#16202c;min-height:100vh;display:grid;place-items:center}
 @media (prefers-color-scheme:dark){body{background:#0f1722;color:#e6edf5}.card{background:#18222f!important}input{background:#0f1722;color:#e6edf5}}
 .card{background:#fff;border-radius:16px;padding:24px;margin:16px;max-width:380px;box-shadow:0 6px 24px rgba(0,0,0,.12)}
 h1{margin:6px 0 4px;font-size:24px;text-align:center} .ico{font-size:44px;text-align:center}
 p{margin:8px 0} .muted{opacity:.7;font-size:14px}
 input{width:100%;box-sizing:border-box;font:600 24px/1 ui-monospace,monospace;letter-spacing:.15em;text-transform:uppercase;text-align:center;padding:14px;border:2px solid #9fb0c4;border-radius:12px;margin:12px 0}
 button{width:100%;font:700 18px system-ui;padding:14px;border:0;border-radius:12px;background:#1f4f8a;color:#fff;cursor:pointer}
 button:disabled{opacity:.6} .err{color:#c0392b;font-weight:600;min-height:1.4em}
</style></head><body>
<form class="card" id="f">
 <div class="ico">🔐</div>
 <h1>Nauka SW</h1>
 <p style="text-align:center">Wpisz kod dostępu, który dostałeś od twórcy aplikacji.</p>
 <input id="k" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="KOD" required>
 <div class="err" id="e">${msg.replace(/</g, '&lt;')}</div>
 <button id="b">Wejdź</button>
 <p class="muted">Kod zapisuje się na tym urządzeniu – wpisujesz go tylko raz. Na iPhonie: najpierw dodaj stronę do ekranu początkowego, a kod wpisz już w tej ikonie.</p>
 <p class="muted">Aplikacja nieoficjalna – nie jest materiałem Służby Więziennej.</p>
</form>
<script>
document.getElementById('f').addEventListener('submit', async ev => {
  ev.preventDefault();
  const b = document.getElementById('b'), e = document.getElementById('e');
  b.disabled = true; e.textContent = '';
  try {
    const r = await fetch('/api/wejscie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod: document.getElementById('k').value }) });
    const d = await r.json();
    if (d.ok) { location.replace('/'); return; }
    e.textContent = d.blad || 'Nie udało się.';
  } catch { e.textContent = 'Brak połączenia z internetem.'; }
  b.disabled = false;
});
</script></body></html>`;
  return new Response(html, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
