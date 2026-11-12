// Wejście dla Cloudflare Workers (wdrożenie „npx wrangler deploy”).
// Ta sama logika co w functions/ (Cloudflare Pages) – tu tylko kierowanie zapytań.
import { onRequest as gate } from './functions/_middleware.js';
import { onRequestPost as wejscie } from './functions/api/wejscie.js';
import { onRequest as admin } from './functions/api/admin/kody.js';
import { onRequestPost as zgloszenie } from './functions/api/zgloszenie.js';
import { onRequestPost as statystyki } from './functions/api/statystyki.js';
import { onRequest as adminZgl } from './functions/api/admin/zgloszenia.js';
import { onRequest as adminStat } from './functions/api/admin/statystyki.js';

const POST_ONLY = { '/api/wejscie': wejscie, '/api/zgloszenie': zgloszenie, '/api/statystyki': statystyki };
const ADMIN = { '/api/admin/kody': admin, '/api/admin/zgloszenia': adminZgl, '/api/admin/statystyki': adminStat };

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (POST_ONLY[path]) {
      return request.method === 'POST' ? POST_ONLY[path]({ request, env }) : new Response('Metoda niedozwolona', { status: 405 });
    }
    if (ADMIN[path]) return ADMIN[path]({ request, env });
    if (path.startsWith('/api/')) return new Response('Nie znaleziono', { status: 404 });
    return gate({ request, env, next: () => env.ASSETS.fetch(request) });
  },
};
