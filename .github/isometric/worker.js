// A Cloudflare Worker that lets aniketh.net/isometric stream Google's
// photorealistic 3D tiles through Cesium ion without the page ever holding
// the ion token. The token is a Worker secret; the page only knows this
// Worker's address (isometric/key.js).
//
// CesiumJS starts a tileset from ion by asking
//   GET <ion server>/v1/assets/<id>/endpoint?access_token=<token>
// The page sets this Worker as its ion server, so that one request comes
// here. The Worker drops whatever token the page sent, asks ion with the
// real one, and passes ion's answer back. For Google's tiles that answer
// is just a tile URL carrying ion's own Google key, the same thing ion
// gives every browser that uses it; the page then fetches tiles from
// Google directly, not through here.
//
// It answers only for the Google tiles asset, and only to pages on
// aniketh.net (or localhost, for testing), and it keeps nothing: every
// visit is one ion request, as it would be with the token in the page.
//
// Deploy from this folder (wrangler signs in through the browser the
// first time), then give it the token:
//   npx wrangler@4 deploy
//   npx wrangler@4 secret put CESIUM_ION_TOKEN

const ION = 'https://api.cesium.com';
const ASSETS = new Set(['2275207']); // Google Photorealistic 3D Tiles
const ORIGINS = [
  /^https:\/\/(www\.)?aniketh\.net$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ORIGINS.some((re) => re.test(origin));
    const cors = { Vary: 'Origin', 'Cache-Control': 'no-store' };
    if (allowed) cors['Access-Control-Allow-Origin'] = origin;

    if (request.method === 'OPTIONS') {
      if (!allowed) return new Response(null, { status: 403, headers: cors });
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          // CesiumJS sends X-Cesium-Client and X-Cesium-Client-Version
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (request.method !== 'GET') return say(405, 'GET only', cors);
    if (!allowed) return say(403, 'This Worker only serves aniketh.net', cors);

    const m = new URL(request.url).pathname.match(/^\/v1\/assets\/(\d+)\/endpoint\/?$/);
    if (!m || !ASSETS.has(m[1])) return say(404, 'Not found', cors);
    if (!env.CESIUM_ION_TOKEN) return say(503, 'The ion token is not set', cors);

    const url = `${ION}/v1/assets/${m[1]}/endpoint?access_token=${encodeURIComponent(env.CESIUM_ION_TOKEN)}`;
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      return say(502, 'Cesium ion did not answer', cors);
    }
    if (!res.ok) return say(res.status === 401 ? 502 : res.status, `Cesium ion said ${res.status}`, cors);
    return new Response(res.body, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};

function say(status, message, headers) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
