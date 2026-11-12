// Wejście dla Cloudflare Workers (wdrożenie „npx wrangler deploy”).
// Ta sama logika co w functions/ (Cloudflare Pages) – tu tylko kierowanie zapytań.
import { onRequest as gate } from './functions/_middleware.js';
import { onRequestPost as wejscie } from './functions/api/wejscie.js';
import { onRequest as admin } from './functions/api/admin/kody.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/wejscie') {
      return request.method === 'POST' ? wejscie({ request, env }) : new Response('Metoda niedozwolona', { status: 405 });
    }
    if (path === '/api/admin/kody') return admin({ request, env });
    if (path.startsWith('/api/')) return new Response('Nie znaleziono', { status: 404 });
    return gate({ request, env, next: () => env.ASSETS.fetch(request) });
  },
};
