// Run every fifteen minutes by .github/workflows/listening.yml.
//
// Spotify will only say what was played recently (the last fifty tracks),
// never what was played most this week, so this keeps its own count. Each
// run folds any plays newer than the last one it saw into per-day tallies,
// drops days older than a week, and writes this week's top five tracks
// and artists for the home page to read.
//
//   node update.mjs <dir>
//
// <dir> holds state.json (the tallies) and receives listening.json (the
// top fives). Both live on the listening-data branch, not on main.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2] || '.';
const TZ = 'America/New_York';
const WEEK = 7;
const TOP = 5;

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error('SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN must all be set.');
  process.exit(1);
}

async function accessToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(path, token) {
  const res = await fetch('https://api.spotify.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    // Rate limited: ask nothing more this run. The plays wait in Spotify's
    // last fifty for the next one.
    console.warn(`${path}: rate limited, retry after ${res.headers.get('Retry-After') || '?'}s. Skipping this run.`);
    if (process.env.RECENT_OUT) await writeFile(process.env.RECENT_OUT, '[]');
    process.exit(0);
  }
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// The calendar day a play belongs to, where I am: YYYY-MM-DD.
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const localDay = (date) => dayFormat.format(new Date(date));

// Today and the six days before it.
function week(now = new Date()) {
  const [y, m, d] = localDay(now).split('-').map(Number);
  const days = [];
  for (let i = WEEK - 1; i >= 0; i--) {
    days.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return days;
}

// The smallest image at least 300px wide, or the largest there is.
function image(images = []) {
  const bySize = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (bySize.find((i) => (i.width || 0) >= 300) || bySize.at(-1) || {}).url || null;
}

// Most played first; a tie goes to whichever was played more recently.
function rank(counts, meta) {
  return Object.entries(counts)
    .filter(([id]) => meta[id])
    .sort(([a, x], [b, y]) => y - x || Date.parse(meta[b].lp) - Date.parse(meta[a].lp));
}

const statePath = join(dir, 'state.json');
const state = await readJSON(statePath, { v: 1, last: null, since: null, days: {}, tracks: {}, artists: {} });
// The day counting began. Spotify only ever reports the last fifty plays,
// so nothing before that can be known, and until a full week has been
// counted the range shown starts here rather than claiming the whole week.
state.since ??= Object.keys(state.days).sort()[0] || null;
const token = await accessToken();

// Fold in anything newer than the last play already counted. Local files
// have no id and can't be linked to, so they aren't counted.
const recent = await api('/me/player/recently-played?limit=50', token);
const last = state.last ? Date.parse(state.last) : 0;
const fresh = recent.items
  .filter((item) => Date.parse(item.played_at) > last)
  .sort((a, b) => Date.parse(a.played_at) - Date.parse(b.played_at));

for (const { track, played_at } of fresh) {
  state.last = played_at;
  state.since ??= localDay(played_at);
  if (!track || !track.id) continue;
  const day = (state.days[localDay(played_at)] ??= { t: {}, a: {} });
  day.t[track.id] = (day.t[track.id] || 0) + 1;
  state.tracks[track.id] = {
    n: track.name,
    ar: track.artists.map((a) => a.name).join(', '),
    u: track.external_urls?.spotify || null,
    i: image(track.album?.images),
    lp: played_at,
  };
  // An artist is counted once per play, for the artist the track is
  // theirs, not for everyone featured on it.
  const lead = track.artists[0];
  if (lead?.id) {
    day.a[lead.id] = (day.a[lead.id] || 0) + 1;
    state.artists[lead.id] = {
      ...state.artists[lead.id],
      n: lead.name,
      u: lead.external_urls?.spotify || null,
      lp: played_at,
    };
  }
}

// Keep a week, and only what that week refers to.
const days = week();
for (const d of Object.keys(state.days)) if (!days.includes(d)) delete state.days[d];
const tracks = {};
const artists = {};
for (const d of Object.values(state.days)) {
  for (const [id, n] of Object.entries(d.t)) tracks[id] = (tracks[id] || 0) + n;
  for (const [id, n] of Object.entries(d.a)) artists[id] = (artists[id] || 0) + n;
}
for (const id of Object.keys(state.tracks)) if (!tracks[id]) delete state.tracks[id];
for (const id of Object.keys(state.artists)) if (!artists[id]) delete state.artists[id];

const rankedTracks = rank(tracks, state.tracks);
const topTracks = rankedTracks.slice(0, TOP);
const topArtists = rank(artists, state.artists).slice(0, TOP);

// Artists come back from recently-played without pictures. For the ones
// in the top five that don't have one yet, ask Spotify's public oEmbed
// endpoint, which gives the same picture Spotify shows on the artist's
// page. (The Web API's /artists refuses apps in development mode with a
// 403, so asking it only spent calls.) If that fails, their most played
// cover this week stands in, and it is tried again next run.
async function artistPicture(id) {
  try {
    const res = await fetch('https://open.spotify.com/oembed?url=' +
      encodeURIComponent('https://open.spotify.com/artist/' + id), { signal: AbortSignal.timeout(5000) });
    if (res.ok) return (await res.json()).thumbnail_url || null;
  } catch {}
  return null;
}
for (const [id] of topArtists) {
  if (state.artists[id].i) continue;
  const url = await artistPicture(id);
  if (url) state.artists[id].i = url;
  else console.warn('No picture for artist', state.artists[id].n);
}
const coverFor = (artistId) => {
  const name = state.artists[artistId].n;
  const hit = rankedTracks
    .map(([id]) => state.tracks[id])
    .find((t) => t.ar.split(', ')[0] === name);
  return hit ? hit.i : null;
};

const listening = {
  from: state.since && state.since > days[0] ? state.since : days[0],
  to: days[days.length - 1],
  timeZone: TZ,
  plays: Object.values(tracks).reduce((a, b) => a + b, 0),
  tracks: topTracks.map(([id, plays]) => {
    const t = state.tracks[id];
    return { name: t.n, artists: t.ar, url: t.u, image: t.i, plays };
  }),
  artists: topArtists.map(([id, plays]) => {
    const a = state.artists[id];
    return { name: a.n, url: a.u, image: a.i || coverFor(id), plays };
  }),
};

// The raw plays, for the private log (log.mjs) to take what it hasn't got.
if (process.env.RECENT_OUT) await writeFile(process.env.RECENT_OUT, JSON.stringify(recent.items));

await writeFile(statePath, JSON.stringify(state) + '\n');
await writeFile(join(dir, 'listening.json'), JSON.stringify(listening, null, 2) + '\n');
console.log(`${fresh.length} new plays; ${listening.plays} this week (${listening.from} to ${listening.to}).`);
