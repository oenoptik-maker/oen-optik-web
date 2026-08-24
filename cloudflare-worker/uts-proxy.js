// UTS CORS Proxy - Cloudflare Worker
// Ücretsiz: 100k istek/gün
// Kullanım: https://your-worker.your-sub.workers.dev/UTS/uh/rest/...

const UTS_BASE = 'https://utsuygulama.saglik.gov.tr';

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // URL'den path'i al
    const url = new URL(request.url);
    const path = url.pathname; // /UTS/uh/rest/bildirim/alma/bekleyenler/sorgula
    const targetUrl = `${UTS_BASE}${path}`;

    // Token'ı header'dan al
    const utsToken = request.headers.get('utsToken') || '';

    try {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'utsToken': utsToken,
          'Content-Type': 'application/json'
        },
        body: request.method !== 'GET' ? await request.text() : undefined
      });

      const text = await resp.text();
      return new Response(text, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
