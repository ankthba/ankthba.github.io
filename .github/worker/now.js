// A Cloudflare Worker that tells the site what's playing on Spotify right
// now, and the last few plays, without the site ever holding a Spotify
// key. It keeps the refresh token as a Worker secret and returns only
// what the page shows: no device, no account, no token.
//
// Spotify is asked by one thing only: a single Durable Object, the same
// instance however many copies of the Worker are running around the
// world. It is the account's one gate, and it holds three limits:
//
//   - what's playing is asked for at most every 15 seconds, and the
//     recent plays at most every 5 minutes, and only while someone is
//     looking (no visitors, no calls);
//   - no more than DAILY_BUDGET calls in a UTC day, counted in storage so
//     a restart doesn't reset it;
//   - after a 429, nothing at all until Spotify's Retry-After has passed,
//     also kept in storage.
//
// Whenever it can't ask, it hands out the last good answer instead (with
// "playing" switched off once that answer is more than two minutes old),
// or, if it has none, a 503 with Retry-After. Each Worker copy also keeps
// the Object's answer for five seconds, so polling pages cost it little.
//
// (An earlier version cached with the Cache API, which does nothing on a
// workers.dev address; every page's poll went to Spotify, and the account
// was rate-limited for most of a day.)
//
// It also makes sure every play is kept. Spotify only ever reports the
// last fifty, and GitHub's schedule for the listening Action is best
// effort (in practice it ran every four to six hours), long enough for
// plays to fall out of those fifty unrecorded. So every fifteen minutes
// (the cron in wrangler.toml) the Worker itself asks Spotify for the
// last fifty and keeps every play in the Object's storage for KEEP_DAYS,
// then starts a run of the Action, which reads them back from /plays
// (with LOG_KEY) along with Spotify's own fifty. However late or often
// GitHub fails, nothing is lost as long as a run comes within KEEP_DAYS.
// The sweep also stands in for the recent-plays call, so it costs
// Spotify one call every fifteen minutes, inside the daily budget.
//
// Deploy from this folder with `npx wrangler deploy`. Secrets:
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
//     set by .github/listening/auth.mjs;
//   GITHUB_TOKEN  a fine-grained token for this repository with Actions
//     read and write and nothing else;
//   LOG_KEY       any long random string, the same as the repository's
//     LISTENING_BUFFER_KEY secret, so only the Action can read /plays.

const ORIGINS = ['https://aniketh.net', 'https://www.aniketh.net', 'http://localhost:4599'];

const NOW_EVERY = 15;        // seconds between "what's playing" calls
const RECENT_EVERY = 300;    // seconds between "recent plays" calls
const DAILY_BUDGET = 2000;   // Spotify Web API calls a UTC day, at most
const BACKOFF = 300;         // seconds to wait after a 429 with no Retry-After
const STALE = 120;           // seconds after which "playing" isn't believed
const EDGE = 5;              // seconds each Worker copy reuses an answer

const KEEP_DAYS = 30;        // days every play is kept for the Action

const WORKFLOW = 'https://api.github.com/repos/ankthba/ankthba.github.io/actions/workflows/listening.yml/dispatches';

class SpotifyError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
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

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------------
   The gate: one instance, everywhere.
   --------------------------------------------------------------------- */

export class NowPlaying {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.loaded = false;
    this.data = null;        // the last good answer
    this.dataAt = 0;
    this.recent = null;
    this.recentAt = 0;
    this.quietUntil = 0;
    this.pausedFor = null;   // 'rate-limit' or 'budget' while quiet for one
    this.budget = { day: today(), used: 0 };
    this.token = null;       // { value, expires }
    this.pending = null;
  }

  async load() {
    if (this.loaded) return;
    const saved = await this.state.storage.get(['data', 'quietUntil', 'pausedFor', 'budget']);
    if (saved.get('data')) ({ data: this.data, at: this.dataAt } = saved.get('data'));
    this.quietUntil = saved.get('quietUntil') || 0;
    this.pausedFor = saved.get('pausedFor') || null;
    this.budget = saved.get('budget') || this.budget;
    this.loaded = true;
  }

  // One more call to Spotify, if the day's budget allows it.
  async spend() {
    if (this.budget.day !== today()) this.budget = { day: today(), used: 0 };
    if (this.budget.used >= DAILY_BUDGET) {
      throw new SpotifyError('daily budget spent', 'budget', 0);
    }
    this.budget.used += 1;
    await this.state.storage.put('budget', this.budget);
  }

  async accessToken() {
    if (this.token && this.token.expires > Date.now() + 30000) return this.token.value;
    const env = this.env;
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(env.SPOTIFY_CLIENT_ID + ':' + env.SPOTIFY_CLIENT_SECRET),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
    });
    if (!res.ok) {
      throw new SpotifyError('token ' + res.status + ' ' + (await res.text()).slice(0, 200),
        res.status, Number(res.headers.get('Retry-After')) || 0);
    }
    const json = await res.json();
    this.token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return this.token.value;
  }

  async spotify(path) {
    const token = await this.accessToken();
    await this.spend();
    const res = await fetch('https://api.spotify.com/v1' + path, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (res.status === 204) return null; // nothing playing
    if (!res.ok) {
      throw new SpotifyError(path + ' ' + res.status + ' ' + (await res.text()).slice(0, 200),
        res.status, Number(res.headers.get('Retry-After')) || 0);
    }
    return res.json();
  }

  async build() {
    const recentDue = Date.now() - this.recentAt >= RECENT_EVERY * 1000;
    const [now, recent] = await Promise.all([
      this.spotify('/me/player/currently-playing'),
      recentDue ? this.spotify('/me/player/recently-played?limit=10') : this.recent,
    ]);
    if (recentDue) { this.recent = recent; this.recentAt = Date.now(); }

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

  // The last good answer, with "playing" withdrawn once it's too old to
  // be believed. While Spotify can't be asked, it says so, and until
  // when, so the music page can put up a notice.
  answer() {
    if (!this.data) return null;
    const paused = this.pause();
    const data = Date.now() - this.dataAt < STALE * 1000
      ? this.data
      : { ...this.data, playing: false, stale: true, progress_ms: null, track: null };
    return paused ? { ...data, ...paused, checked: new Date(this.dataAt).toISOString() } : data;
  }

  // Only a real stop (a 429, or the day's budget) counts as paused; the
  // few seconds' wait after any other hiccup doesn't.
  pause() {
    if (Date.now() >= this.quietUntil) return null;
    // A wait stored without a reason (from before reasons were kept) is
    // a rate limit if it's longer than any hiccup would be.
    const reason = this.pausedFor || (this.quietUntil - Date.now() > 60000 ? 'rate-limit' : null);
    return reason ? { paused: reason, resumes: new Date(this.quietUntil).toISOString() } : null;
  }

  async fetch(request) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname === '/sweep') return this.sweep();
    if (pathname === '/plays') return this.plays(searchParams.get('after'));
    return this.now();
  }

  // What a 429 or a spent budget means: say nothing to Spotify until it
  // has passed. Any other failure waits only NOW_EVERY.
  async quieten(err) {
    let wait = NOW_EVERY;
    this.pausedFor = null;
    if (err.status === 429) {
      wait = err.retryAfter || BACKOFF;
      this.pausedFor = 'rate-limit';
    } else if (err.status === 'budget') {
      const midnight = new Date(); midnight.setUTCHours(24, 0, 0, 0);
      wait = Math.ceil((midnight - Date.now()) / 1000);
      this.pausedFor = 'budget';
    }
    this.quietUntil = Date.now() + wait * 1000;
    await this.state.storage.put({ quietUntil: this.quietUntil, pausedFor: this.pausedFor });
  }

  // Every fifteen minutes, from the cron: the last fifty plays, each kept
  // under its time ("play:" + played_at, so they list in order) in the
  // shape Spotify gives them, trimmed to what the Action reads.
  async sweep() {
    await this.load();
    if (Date.now() < this.quietUntil) return Response.json({ skipped: 'quiet' });
    let recent;
    try {
      recent = await this.spotify('/me/player/recently-played?limit=50');
    } catch (err) {
      console.error('sweep:', err.message);
      await this.quieten(err);
      return Response.json({ error: err.message }, { status: 502 });
    }
    const items = recent?.items || [];
    const plays = {};
    for (const { track, played_at, context } of items) {
      plays['play:' + played_at] = {
        played_at,
        context: context ? { type: context.type, uri: context.uri } : null,
        track: track && {
          id: track.id || null,
          name: track.name,
          duration_ms: track.duration_ms,
          external_urls: { spotify: track.external_urls?.spotify || null },
          artists: (track.artists || []).map((a) => ({
            id: a.id || null, name: a.name, external_urls: { spotify: a.external_urls?.spotify || null },
          })),
          album: track.album && { id: track.album.id || null, name: track.album.name, images: track.album.images || [] },
        },
      };
    }
    // put() takes at most 128 keys at once; fifty is well inside.
    if (items.length) await this.state.storage.put(plays);
    // These double as the page's recent plays, saving it a call.
    this.recent = { items: items.slice(0, 10) };
    this.recentAt = Date.now();

    // Forget what's older than KEEP_DAYS.
    const cutoff = 'play:' + new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
    const old = await this.state.storage.list({ prefix: 'play:', end: cutoff, limit: 128 });
    if (old.size) await this.state.storage.delete([...old.keys()]);
    return Response.json({ swept: items.length });
  }

  // Every play kept after a time, oldest first, for the Action.
  async plays(after) {
    const start = 'play:' + (after || '');
    const out = [];
    let cursor = start;
    for (;;) {
      const page = await this.state.storage.list({ prefix: 'play:', start: cursor, limit: 500 });
      for (const [key, play] of page) if (key > start) out.push(play);
      if (page.size < 500) break;
      cursor = [...page.keys()].at(-1) + '\0';
    }
    return Response.json(out);
  }

  async now() {
    await this.load();
    const fresh = this.data && Date.now() - this.dataAt < NOW_EVERY * 1000;
    const quiet = Date.now() < this.quietUntil;

    if (!fresh && !quiet) {
      try {
        if (!this.pending) {
          this.pending = this.build().then(async (data) => {
            this.data = data;
            this.dataAt = Date.now();
            await this.state.storage.put('data', { data, at: this.dataAt });
          }).finally(() => { this.pending = null; });
        }
        await this.pending;
      } catch (err) {
        console.error('now-playing:', err.message);
        await this.quieten(err);
      }
    }

    const body = this.answer();
    if (body) return Response.json(body);
    const retry = Math.max(1, Math.ceil((this.quietUntil - Date.now()) / 1000));
    return Response.json({ error: 'unavailable', ...(this.pause() || {}) },
      { status: 503, headers: { 'Retry-After': String(retry) } });
  }
}

/* ---------------------------------------------------------------------
   The Worker: CORS, and a few seconds' memory in front of the gate.
   --------------------------------------------------------------------- */

let edge = null; // { status, body, retry, at }, per copy of the Worker

// Two strings compared in constant time, for the key.
async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(x, y);
}

function headers(origin, extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
    ...extra,
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    // Every play kept, for the listening Action only.
    const url = new URL(request.url);
    if (url.pathname === '/plays') {
      if (!env.LOG_KEY || !(await same(request.headers.get('Authorization') || '', 'Bearer ' + env.LOG_KEY))) {
        return new Response('Not found', { status: 404 });
      }
      const gate = env.NOW.get(env.NOW.idFromName('spotify'));
      const res = await gate.fetch('https://gate/plays?after=' + encodeURIComponent(url.searchParams.get('after') || ''));
      return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }

    if (!edge || Date.now() - edge.at > EDGE * 1000) {
      const gate = env.NOW.get(env.NOW.idFromName('spotify'));
      const res = await gate.fetch('https://gate/now');
      edge = {
        status: res.status,
        body: await res.text(),
        retry: res.headers.get('Retry-After'),
        at: Date.now(),
      };
    }
    const extra = edge.retry ? { 'Retry-After': edge.retry } : {};
    return new Response(edge.body, { status: edge.status, headers: headers(origin, extra) });
  },

  // Keep the last fifty plays, then start the listening Action. A failure
  // is only logged: the next tick is fifteen minutes away, and GitHub's
  // own schedule is still there.
  async scheduled(event, env) {
    const gate = env.NOW.get(env.NOW.idFromName('spotify'));
    const swept = await gate.fetch('https://gate/sweep');
    if (!swept.ok) console.error('sweep: ' + (await swept.text()).slice(0, 200));

    if (!env.GITHUB_TOKEN) {
      console.error('listening: GITHUB_TOKEN is not set');
      return;
    }
    const res = await fetch(WORKFLOW, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.GITHUB_TOKEN,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'aniketh-now',
      },
      body: JSON.stringify({ ref: 'main' }),
    });
    if (!res.ok) console.error('listening: dispatch ' + res.status + ' ' + (await res.text()).slice(0, 200));
  },
};
