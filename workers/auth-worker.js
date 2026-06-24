// Cloudflare Worker (Module) - simple auth endpoint using env.FILES_PASSWORD
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/auth' && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid-json' }), { status: 400, headers: CORS });
      }
      const pw = (body.password || '').toString();
      // Access environment variable bound to the worker via env
      const envPw = env.FILES_PASSWORD;
      if (envPw && pw === envPw) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
      }
      return new Response(JSON.stringify({ ok: false }), { status: 401, headers: CORS });
    }

    return new Response('Not Found', { status: 404 });
  }
};
