// Builds what the /music/ page shows from the private log: music.json,
// with the calendar, top songs and artists over a few ranges, totals, and
// every play since midnight yesterday (the page's log shows today from
// 12 am; yesterday's are there so it still has a last play just after
// midnight), and days/YYYY-MM-DD.json, each counted day's plays in full.
// Run after log.mjs by .github/workflows/listening.yml.
//
//   node music.mjs <logdir> <outdir>
//
// <outdir> is the listening-data branch; artists.json there caches artist
// photos between runs, playlists.json playlist names and covers, and
// details.json genres, popularity and release dates (see details.mjs).

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { details } from './details.mjs';

const [logDir, outDir] = process.argv.slice(2);
if (!logDir || !outDir) {
  console.error('usage: node music.mjs <logdir> <outdir>');
  process.exit(1);
}

const TZ = 'America/New_York';
const TOP = 10;
const RECENT = 1000; // a ceiling on the plays since midnight yesterday

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const localDay = (date) => dayFormat.format(new Date(date));
const shiftDay = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

// Every play in the log, oldest first. Local files have no id and can't be
// linked to or pictured, so they count towards totals but not rankings.
const playsDir = join(logDir, 'plays');
const files = (await readdir(playsDir).catch(() => [])).filter((f) => f.endsWith('.jsonl')).sort();
const plays = [];
for (const f of files) {
  for (const line of (await readFile(join(playsDir, f), 'utf8')).split('\n')) {
    if (line.trim()) plays.push(JSON.parse(line));
  }
}
plays.sort((a, b) => Date.parse(a.played_at) - Date.parse(b.played_at));
for (const p of plays) p.day = localDay(p.played_at);

// How long each play was actually heard. Spotify stamps a play when it
// stops, so it lasted no longer than the time since the play before it
// stopped: a song skipped part way counts for what was heard of it, not
// its whole length. After a break, it counts in full.
plays.forEach((p, i) => {
  const since = i ? Date.parse(p.played_at) - Date.parse(plays[i - 1].played_at) : Infinity;
  p.heard_ms = Math.min(p.duration_ms || 0, since);
});

// Counting starts on the first full day of tracking. The log began part
// way through 28 September; those plays stay in the log but aren't counted
// anywhere on the page, so every number starts from the same day.
const START = '2026-09-29';
const counted = plays.findIndex((p) => p.day >= START);
plays.splice(0, counted === -1 ? plays.length : counted);

const trackUrl = (id) => id && 'https://open.spotify.com/track/' + id;
const artistUrl = (id) => id && 'https://open.spotify.com/artist/' + id;
const minutes = (list) => Math.round(list.reduce((n, p) => n + p.heard_ms, 0) / 60000);

// Most played first; a tie goes to whichever was played more recently.
function top(list, keyOf, n = TOP) {
  const tally = new Map();
  for (const p of list) {
    const key = keyOf(p);
    if (!key) continue;
    const t = tally.get(key) || { plays: 0, last: 0, play: p };
    t.plays += 1;
    t.last = Date.parse(p.played_at);
    t.play = p;
    tally.set(key, t);
  }
  return [...tally.values()].sort((a, b) => b.plays - a.plays || b.last - a.last).slice(0, n);
}

const track = ({ play: p, plays: count }) => ({
  name: p.name,
  artists: p.artists.map((a) => a.name).join(', '),
  url: trackUrl(p.id),
  image: p.image,
  plays: count,
});

// Artist photos: cached in artists.json, fetched from Spotify's public
// oEmbed endpoint (the Web API refuses apps in development mode). Without
// one, the artist's most recent cover this range stands in.
const photosPath = join(outDir, 'artists.json');
const photos = await readJSON(photosPath, {});
const tried = new Set();
async function photo(id) {
  if (photos[id]) return photos[id];
  // One try per artist per run: week, month and all time share artists.
  if (tried.has(id)) return null;
  tried.add(id);
  try {
    const res = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(artistUrl(id)),
      { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const url = (await res.json()).thumbnail_url;
      if (url) return (photos[id] = url);
    }
  } catch {}
  return null;
}
async function artists(list, n = TOP) {
  const out = [];
  for (const t of top(list, (p) => p.artists[0]?.id, n)) {
    const lead = t.play.artists[0];
    out.push({ name: lead.name, url: artistUrl(lead.id), image: (await photo(lead.id)) || t.play.image, plays: t.plays });
  }
  return out;
}

// Playlist names and covers, the same way: Spotify's oEmbed answers for
// public playlists only, so a private one stays nameless and unshown.
const playlistsPath = join(outDir, 'playlists.json');
const playlists = await readJSON(playlistsPath, {});
async function playlist(id) {
  if (playlists[id]) return playlists[id];
  if (tried.has(id)) return null;
  tried.add(id);
  try {
    const res = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/playlist/' + id),
      { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const { title, thumbnail_url } = await res.json();
      if (title) return (playlists[id] = { name: title, image: thumbnail_url || null });
    }
  } catch {}
  return null;
}

async function range(from, to) {
  const list = plays.filter((p) => p.day >= from && p.day <= to);
  return {
    from,
    to,
    plays: list.length,
    minutes: minutes(list),
    tracks: top(list, (p) => p.id).map(track),
    artists: await artists(list),
  };
}

const today = localDay(new Date());
const since = plays.length ? plays[0].day : today;
const known = await details(join(outDir, 'details.json'), plays);
const songOf = (p) => (known.tracks[p.id]?.found ? known.tracks[p.id] : null);
const artistOf = (p) => known.artists[p.artists[0]?.id] || null;

// How mainstream an artist is, by their fans on Deezer.
const MAINSTREAM = 1000000;
const NICHE = 10000;

// What the music itself was, from details.json: genres, how popular and
// how widely followed, how old, how explicit, and how spread across
// artists. Every share is of the plays whose details are known.
async function sound(list) {
  const out = {};

  // Each play counts once, split evenly across its artist's genres.
  const genres = new Map();
  let genreKnown = 0;
  for (const p of list) {
    const g = artistOf(p)?.genres || [];
    if (!g.length) continue;
    genreKnown += 1;
    for (const name of g) genres.set(name, (genres.get(name) || 0) + 1 / g.length);
  }
  if (genreKnown) {
    out.genres = {
      known: genreKnown,
      count: genres.size,
      top: [...genres].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, n]) => ({ name, plays: Math.round(n * 10) / 10 })),
    };
  }

  // Mainstream, in between or niche, and the day's least and most
  // followed artists.
  const fanned = list.filter((p) => artistOf(p)?.fans != null);
  if (fanned.length) {
    const reach = { known: fanned.length, mainstream: 0, middle: 0, niche: 0 };
    for (const p of fanned) {
      const fans = artistOf(p).fans;
      reach[fans >= MAINSTREAM ? 'mainstream' : fans < NICHE ? 'niche' : 'middle'] += 1;
    }
    out.reach = reach;
    const byFans = [...new Map(fanned.map((p) => [p.artists[0].id, p])).values()]
      .sort((a, b) => artistOf(a).fans - artistOf(b).fans);
    const who = async (p) => ({
      name: p.artists[0].name,
      url: artistUrl(p.artists[0].id),
      image: (await photo(p.artists[0].id)) || p.image,
      fans: artistOf(p).fans,
    });
    out.nichest = await who(byFans[0]);
    if (byFans.length > 1) out.biggest = await who(byFans.at(-1));
  }

  // Songs: popularity (Deezer's rank, out of a million, as a score out
  // of a hundred), explicit lyrics, release dates, and how many were
  // out less than a month before the day they were played.
  const songs = list.filter(songOf);
  if (songs.length) {
    const ranked = songs.filter((p) => songOf(p).rank != null);
    if (ranked.length) {
      out.popularity = Math.round(ranked.reduce((n, p) => n + songOf(p).rank, 0) / ranked.length / 10000);
      const deep = ranked.reduce((a, b) => (songOf(b).rank < songOf(a).rank ? b : a));
      out.deepCut = { ...track({ play: deep, plays: 1 }), popularity: Math.round(songOf(deep).rank / 10000) };
    }
    out.explicit = { known: songs.length, plays: songs.filter((p) => songOf(p).explicit).length };
    const dated = songs.filter((p) => songOf(p).released);
    if (dated.length) {
      const year = (p) => Number(songOf(p).released.slice(0, 4));
      const decades = {};
      for (const p of dated) {
        const d = Math.floor(year(p) / 10) * 10 + 's';
        decades[d] = (decades[d] || 0) + 1;
      }
      const oldest = dated.reduce((a, b) => (songOf(b).released < songOf(a).released ? b : a));
      out.released = {
        known: dated.length,
        average: Math.round(dated.reduce((n, p) => n + year(p), 0) / dated.length),
        decades,
        fresh: dated.filter((p) => songOf(p).released >= shiftDay(p.day, -30)).length,
        oldest: { ...track({ play: oldest, plays: 1 }), year: year(oldest) },
      };
    }
  }

  // How spread the plays were across artists: 100 if every play was by
  // someone different, 0 if all were by one artist.
  const counts = new Map();
  for (const p of list) if (p.artists[0]?.id) counts.set(p.artists[0].id, (counts.get(p.artists[0].id) || 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total > 1) {
    const h = -[...counts.values()].reduce((n, c) => n + (c / total) * Math.log(c / total), 0);
    out.variety = Math.round((100 * h) / Math.log(total));
  }
  return out;
}
const weekFrom = shiftDay(today, -6);
const monthFrom = today.slice(0, 8) + '01';

// The calendar and the months: for every day with plays, and every
// month, how many and for how long, how many different songs, artists
// and albums, how many of each were new (not heard before it began),
// the plays in each hour, how it split into sessions, how many songs
// were cut short, what they were played from, its top songs, artists,
// album and playlist, the song played most times in a row, the longest
// song, and what the music itself was (sound(), above).
const hourFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' });
// A session ends after this long without music.
const BREAK = 20 * 60000;
// A play heard for less than this much of its length was cut short.
// Crossfading trims a few seconds off the end of a song played through.
const THROUGH = 0.8;

// seen holds the songs, artists and albums heard before the period, and
// is brought up to date with this one's once it has been counted.
async function period(list, seen, { songs, artists: artistCount }) {
  const ids = new Set(list.map((p) => p.id).filter(Boolean));
  const artistIds = new Set(list.map((p) => p.artists[0]?.id).filter(Boolean));
  const albumIds = new Set(list.map((p) => p.album?.id).filter(Boolean));
  const hours = Array(24).fill(0);
  for (const p of list) hours[Number(hourFormat.format(new Date(p.played_at))) % 24] += 1;
  const [album] = top(list, (p) => p.album?.id, 1);

  // Sessions: a play starts when it was stamped less what was heard of
  // it, and a gap of BREAK or more between one play ending and the next
  // starting begins a new session.
  const sessions = [];
  for (const p of list) {
    const end = Date.parse(p.played_at);
    const start = end - p.heard_ms;
    const last = sessions.at(-1);
    if (last && start - last.end < BREAK) last.end = end;
    else sessions.push({ start, end });
  }
  const longest = sessions.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  let gap = 0;
  for (let i = 1; i < sessions.length; i++) gap = Math.max(gap, sessions[i].start - sessions[i - 1].end);

  // The same song played most times running.
  let run = { n: 0 };
  for (let i = 0, n = 0; i < list.length; i++) {
    n = i && list[i].id && list[i].id === list[i - 1].id ? n + 1 : 1;
    if (n > run.n) run = { n, play: list[i] };
  }

  // What each play was started from.
  const from = { playlist: 0, album: 0, artist: 0, liked: 0, other: 0 };
  for (const p of list) {
    const type = p.context?.type;
    if (type === 'collection' || /:collection$/.test(p.context?.uri || '')) from.liked += 1;
    else if (type in from) from[type] += 1;
    else from.other += 1;
  }
  const [list1] = top(list, (p) => p.context?.type === 'playlist' && p.context.uri.split(':').pop(), 1);
  const listId = list1 && list1.play.context.uri.split(':').pop();
  const listInfo = listId && (await playlist(listId));

  const timed = list.filter((p) => p.duration_ms);
  const long = timed.reduce((a, b) => (b.duration_ms > a.duration_ms ? b : a), timed[0]);

  const out = {
    plays: list.length,
    minutes: minutes(list),
    tracks: ids.size,
    artists: artistIds.size,
    albums: albumIds.size,
    newTracks: [...ids].filter((id) => !seen.tracks.has(id)).length,
    newArtists: [...artistIds].filter((id) => !seen.artists.has(id)).length,
    newAlbums: [...albumIds].filter((id) => !seen.albums.has(id)).length,
    hours,
    sessions: sessions.length,
    longestSession: {
      minutes: Math.round((longest.end - longest.start) / 60000),
      from: new Date(longest.start).toISOString(),
      to: new Date(longest.end).toISOString(),
    },
    longestBreak: sessions.length > 1 ? Math.round(gap / 60000) : null,
    cutShort: timed.filter((p) => p.heard_ms < p.duration_ms * THROUGH).length,
    averageMs: timed.length ? Math.round(timed.reduce((n, p) => n + p.duration_ms, 0) / timed.length) : null,
    features: list.filter((p) => p.artists.length > 1).length,
    from,
    top: top(list, (p) => p.id, songs).map(track),
    topArtists: await artists(list, artistCount),
    topAlbum: album ? {
      name: album.play.album.name,
      artists: album.play.artists.map((a) => a.name).join(', '),
      image: album.play.image,
      plays: album.plays,
    } : null,
    topPlaylist: listInfo ? {
      name: listInfo.name,
      url: 'https://open.spotify.com/playlist/' + listId,
      image: listInfo.image,
      plays: list1.plays,
    } : null,
    onRepeat: run.n > 1 ? { ...track({ play: run.play, plays: run.n }), times: run.n } : null,
    longest: long ? { ...track({ play: long, plays: 1 }), duration_ms: long.duration_ms } : null,
    ...(await sound(list)),
  };
  for (const id of ids) seen.tracks.add(id);
  for (const id of artistIds) seen.artists.add(id);
  for (const id of albumIds) seen.albums.add(id);
  return out;
}
const fresh = () => ({ tracks: new Set(), artists: new Set(), albums: new Set() });

const calendar = {};
const byDay = new Map();
for (const p of plays) (byDay.get(p.day) || byDay.set(p.day, []).get(p.day)).push(p);
const daySeen = fresh();
for (const [day, list] of byDay) {
  calendar[day] = {
    ...(await period(list, daySeen, { songs: 5, artists: 3 })),
    first: list[0].played_at,
    last: list.at(-1).played_at,
  };
}

// A week (Sunday to Saturday, a row of the calendar) or a month adds
// how many days had music, its busiest day, its longest run of days in
// a row with music, and its plays by day of the week.
async function stretch(list, seen, artistCount) {
  const days = [...new Set(list.map((p) => p.day))];
  const busiest = days.reduce((a, b) => (calendar[b].minutes > calendar[a].minutes ? b : a));
  let streak = 0;
  for (let i = 0, n = 0; i < days.length; i++) {
    n = i && shiftDay(days[i - 1], 1) === days[i] ? n + 1 : 1;
    streak = Math.max(streak, n);
  }
  const weekdays = Array(7).fill(0);
  for (const p of list) weekdays[new Date(p.day + 'T12:00:00Z').getUTCDay()] += 1;
  return {
    ...(await period(list, seen, { songs: 5, artists: artistCount })),
    days: days.length,
    busiest: { day: busiest, minutes: calendar[busiest].minutes },
    streak,
    weekdays,
  };
}
const group = (keyOf) => {
  const out = new Map();
  for (const p of plays) {
    const k = keyOf(p.day);
    (out.get(k) || out.set(k, []).get(k)).push(p);
  }
  return out;
};

// Weeks, by the Sunday they start on.
const weeks = {};
const weekSeen = fresh();
const sundayOf = (day) => shiftDay(day, -new Date(day + 'T12:00:00Z').getUTCDay());
for (const [week, list] of group(sundayOf)) weeks[week] = await stretch(list, weekSeen, 5);

const months = {};
const monthSeen = fresh();
for (const [month, list] of group((day) => day.slice(0, 7))) months[month] = await stretch(list, monthSeen, 5);

const music = {
  since,
  today,
  timeZone: TZ,
  totals: {
    plays: plays.length,
    minutes: minutes(plays),
    tracks: new Set(plays.map((p) => p.id).filter(Boolean)).size,
    artists: new Set(plays.map((p) => p.artists[0]?.id).filter(Boolean)).size,
    days: byDay.size,
  },
  recent: plays.filter((p) => p.day >= shiftDay(today, -1)).slice(-RECENT).reverse().map((p) => ({
    name: p.name,
    artists: p.artists.map((a) => a.name).join(', '),
    url: trackUrl(p.id),
    image: p.image,
    played_at: p.played_at,
  })),
  ranges: {
    week: await range(since > weekFrom ? since : weekFrom, today),
    month: await range(since > monthFrom ? since : monthFrom, today),
    all: await range(since, today),
  },
  calendar,
  weeks,
  months,
};

await writeFile(photosPath, JSON.stringify(photos, null, 1) + '\n');
await writeFile(playlistsPath, JSON.stringify(playlists, null, 1) + '\n');
await writeFile(join(outDir, 'music.json'), JSON.stringify(music) + '\n');

// Each day's full log, 12 am to 11:59 pm in order, one file a day in
// days/, fetched by the page only when that day's log is opened.
await mkdir(join(outDir, 'days'), { recursive: true });
for (const [day, list] of byDay) {
  const log = list.map((p) => ({
    name: p.name,
    artists: p.artists.map((a) => a.name).join(', '),
    url: trackUrl(p.id),
    image: p.image,
    played_at: p.played_at,
  }));
  await writeFile(join(outDir, 'days', day + '.json'), JSON.stringify(log) + '\n');
}
console.log(`music.json: ${plays.length} plays over ${byDay.size} days since ${since}.`);
