// A Cloudflare Worker that tells the site what's playing on Spotify right
// now, and the last few plays, without the site ever holding a Spotify
// key. It keeps the refresh token as a Worker secret, asks Spotify at
// most once every five seconds however many people are looking, and
// returns only what the page shows: no device, no account, no token.
//
// Deploy from this folder with `npx wrangler deploy`. Secrets
// (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN) are
// set by .github/listening/auth.mjs.

const ORIGINS = ['https://aniketh.net', 'https://www.aniketh.net', 'http://localhost:4599'];
const FRESH = 5; // seconds a response is reused for

let token = null; // { value, expires }, kept while this isolate lives

async function accessToken(env) {
  if (token && token.expires > Date.now() + 30000) return token.value;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(env.SPOTIFY_CLIENT_ID + ':' + env.SPOTIFY_CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error('token ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const json = await res.json();
  token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return token.value;
}

async function spotify(path, env) {
  const res = await fetch('https://api.spotify.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + (await accessToken(env)) },
  });
  if (res.status === 204) return null; // nothing playing
  if (!res.ok) throw new Error(path + ' ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

// The smallest image at least 300px wide, or the largest there is.
function image(images = []) {
  const bySize = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (bySize.find((i) => (i.width || 0) >= 300) || bySize.at(-1) || {}).url || null;
}

// The largest image there is (640px for album art), for the big cover.
function largest(images = []) {
  return ([...images].sort((a, b) => (b.width || 0) - (a.width || 0))[0] || {}).url || null;
}

const song = (t) => ({
  name: t.name,
  artists: t.artists.map((a) => a.name).join(', '),
  url: t.external_urls?.spotify || null,
  image: image(t.album?.images),
  cover: largest(t.album?.images),
  duration_ms: t.duration_ms,
});

async function build(env) {
  const [now, recent] = await Promise.all([
    spotify('/me/player/currently-playing', env),
    spotify('/me/player/recently-played?limit=10', env),
  ]);
  // Only songs are shown; a podcast or an ad counts as nothing playing.
  const track = now && now.currently_playing_type === 'track' && now.item ? now.item : null;
  // Spotify keeps reporting the last song as playing, parked at its very
  // end, when the device that is really playing (a private session, some
  // speakers) isn't telling it anything. A song at its last second, or a
  // report more than a song's length old, is not believed.
  const stale = track && (
    now.progress_ms >= track.duration_ms - 1500 ||
    (now.timestamp && Date.now() - now.timestamp > track.duration_ms + 60000)
  );
  return {
    at: new Date().toISOString(),
    playing: Boolean(track && now.is_playing && !stale),
    stale: Boolean(stale),
    progress_ms: track && !stale ? now.progress_ms : null,
    track: track && !stale ? song(track) : null,
    recent: (recent?.items || []).map((i) => ({ ...song(i.track), played_at: i.played_at })),
  };
}

function headers(origin) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${FRESH}`,
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    // One answer every five seconds, shared by everyone asking.
    const cache = caches.default;
    const key = new Request(new URL('/now', request.url).toString());
    let body = await cache.match(key).then((r) => r && r.text());
    if (!body) {
      try {
        body = JSON.stringify(await build(env));
      } catch (err) {
        console.error('now-playing failed:', err.message);
        return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: headers(origin) });
      }
      ctx.waitUntil(cache.put(key, new Response(body, { headers: { 'Cache-Control': `public, max-age=${FRESH}` } })));
    }
    return new Response(body, { headers: headers(origin) });
  },
};
