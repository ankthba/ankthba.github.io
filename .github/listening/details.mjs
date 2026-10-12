// What Spotify won't say about the music itself. Its Web API refuses
// this app (in development mode) an artist's genres or popularity, so:
//
//   Genres come from MusicBrainz, found by the artist's Spotify link, so
//   an artist is never mistaken for another with the same name. They are
//   the genres MusicBrainz's editors have voted for, up to three.
//
//   Each song's popularity, release date and explicit flag, and its
//   artist's fan count, come from Deezer, by searching for the song and
//   taking only a result by the same artist with the same title.
//
// Both are kept in details.json on the listening-data branch, so each
// song and artist is looked up once and checked again every so often.
// A run spends at most LOOKUP_SECONDS looking things up (two minutes by
// default); whatever it doesn't get to waits for the next run.

import { readFile, writeFile } from 'node:fs/promises';

const AGENT = 'aniketh.net-music/1.0 ( https://aniketh.net/music/ )';
const FRESH = 60;   // days before something found is looked up again
const RETRY = 14;   // days before something not found is tried again

const today = new Date().toISOString().slice(0, 10);
const daysSince = (day) => (Date.parse(today) - Date.parse(day)) / 864e5;
const due = (entry) => !entry || daysSince(entry.checked) >= (entry.found ? FRESH : RETRY);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Titles and names, compared without case, accents, punctuation, or
// anything in brackets or after a dash ("(feat. ...)", "- Remastered").
// Letters in any script count, so a Japanese title isn't left empty.
const plain = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/[([].*?[)\]]/g, ' ').replace(/\s-\s.*$/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// MusicBrainz asks for one request a second, and a name for the caller.
// When it's busy it answers 503: wait longer each time, and give up for
// this run after the third.
let mbLast = 0;
async function mb(path) {
  for (let wait = 1100, tries = 0; ; wait *= 3, tries++) {
    await pause(Math.max(0, mbLast + wait - Date.now()));
    mbLast = Date.now();
    const res = await fetch('https://musicbrainz.org/ws/2/' + path + '&fmt=json',
      { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(10000) });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if (res.status !== 503 || tries === 3) throw new Error('MusicBrainz ' + res.status);
  }
}

// Deezer allows fifty requests every five seconds; this stays well under.
// A spent allowance comes back as an error in an ordinary answer.
let dzLast = 0;
async function dz(path) {
  await pause(Math.max(0, dzLast + 150 - Date.now()));
  dzLast = Date.now();
  const res = await fetch('https://api.deezer.com/' + path, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Deezer ' + res.status);
  const body = await res.json();
  if (body.error) throw new Error('Deezer ' + (body.error.message || body.error.code));
  return body;
}

async function genresOf(spotifyId) {
  const link = await mb('url?resource=' + encodeURIComponent('https://open.spotify.com/artist/' + spotifyId) + '&inc=artist-rels');
  const mbid = link?.relations?.find((r) => r['target-type'] === 'artist')?.artist?.id;
  if (!mbid) return null;
  const artist = await mb('artist/' + mbid + '?inc=genres');
  const genres = (artist?.genres || [])
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((g) => g.name);
  return { mbid, genres };
}

async function songOf(play) {
  const artist = play.artists[0]?.name;
  const want = plain(play.name);
  if (!want || !plain(artist)) return null;
  const match = (r) => plain(r.artist?.name) === plain(artist) &&
    (plain(r.title) === want || plain(r.title_short) === want);
  for (const q of [`artist:"${artist}" track:"${play.name.replace(/"/g, '')}"`, artist + ' ' + plain(play.name)]) {
    const found = (await dz('search?limit=10&q=' + encodeURIComponent(q))).data || [];
    const hit = found.find(match);
    if (!hit) continue;
    const full = await dz('track/' + hit.id);
    return {
      deezer: hit.id,
      artist: hit.artist.id,
      rank: hit.rank ?? null,
      explicit: Boolean(hit.explicit_lyrics),
      released: /^\d{4}-\d\d-\d\d$/.test(full.release_date) && full.release_date !== '0000-00-00' ? full.release_date : null,
    };
  }
  return null;
}

export async function details(path, plays) {
  let cache;
  try { cache = JSON.parse(await readFile(path, 'utf8')); } catch { cache = {}; }
  cache.artists ||= {};
  cache.tracks ||= {};
  const deadline = Date.now() + 1000 * Number(process.env.LOOKUP_SECONDS || 120);

  // The most played first, so what shows most is filled in soonest.
  const most = (keyOf) => {
    const n = new Map();
    for (const p of plays) { const k = keyOf(p); if (k) n.set(k, (n.get(k) || 0) + 1); }
    return [...n.keys()].sort((a, b) => n.get(b) - n.get(a));
  };
  const lastPlay = new Map();
  for (const p of plays) if (p.id) lastPlay.set(p.id, p);

  // Genres and Deezer run side by side, each at its own pace, so the
  // slower MusicBrainz doesn't hold Deezer back; either stops for this
  // run if its source fails.
  const genresDue = (e) => !e?.genresChecked || daysSince(e.genresChecked) >= (e.mbid ? FRESH : RETRY);
  const artistIds = most((p) => p.artists[0]?.id).filter((id) => genresDue(cache.artists[id]));
  const trackIds = most((p) => p.id).filter((id) => due(cache.tracks[id]));
  const looked = { artists: 0, tracks: 0 };

  async function genres() {
    for (const id of artistIds) {
      if (Date.now() >= deadline) return;
      try {
        const g = await genresOf(id);
        const entry = (cache.artists[id] ||= {});
        entry.genresChecked = today;
        entry.mbid = g?.mbid || null;
        entry.genres = g?.genres || [];
        looked.artists += 1;
      } catch (err) { console.warn('Genres:', err.message); return; }
    }
  }

  async function songs() {
    for (const id of trackIds) {
      if (Date.now() >= deadline) return;
      const play = lastPlay.get(id);
      try {
        const song = await songOf(play);
        cache.tracks[id] = { checked: today, found: Boolean(song), ...song };
        // The artist's fans, from the same Deezer artist the song is by.
        const lead = play.artists[0]?.id;
        const entry = lead && (cache.artists[lead] ||= {});
        if (song && entry && (!entry.fansChecked || daysSince(entry.fansChecked) >= FRESH)) {
          entry.fans = (await dz('artist/' + song.artist)).nb_fan ?? null;
          entry.fansChecked = today;
        }
        looked.tracks += 1;
      } catch (err) { console.warn('Deezer:', err.message); return; }
    }
  }

  await Promise.all([genres(), songs()]);
  console.log(`details.json: looked up ${looked.artists} artists and ${looked.tracks} songs; ` +
    `${artistIds.length - looked.artists} artists and ${trackIds.length - looked.tracks} songs wait for later.`);
  await writeFile(path, JSON.stringify(cache) + '\n');
  return cache;
}
