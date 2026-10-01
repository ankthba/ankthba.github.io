// Builds music.json, everything the /music/ page shows, from the private
// log. Only summaries leave the log: the day's top song for the calendar,
// top songs and artists over a few ranges, totals, and every play since
// midnight yesterday (the page's log shows today from 12 am; yesterday's
// are there so the page still has a last play just after midnight).
// Run after log.mjs by .github/workflows/listening.yml.
//
//   node music.mjs <logdir> <outdir>
//
// <outdir> is the listening-data branch; artists.json there caches artist
// photos between runs.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

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

const trackUrl = (id) => id && 'https://open.spotify.com/track/' + id;
const artistUrl = (id) => id && 'https://open.spotify.com/artist/' + id;
const minutes = (list) => Math.round(list.reduce((n, p) => n + (p.duration_ms || 0), 0) / 60000);

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
async function artists(list) {
  const out = [];
  for (const t of top(list, (p) => p.artists[0]?.id)) {
    const lead = t.play.artists[0];
    out.push({ name: lead.name, url: artistUrl(lead.id), image: (await photo(lead.id)) || t.play.image, plays: t.plays });
  }
  return out;
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
const weekFrom = shiftDay(today, -6);
const monthFrom = today.slice(0, 8) + '01';

// The calendar: for every day with plays, how many, and its top song.
const calendar = {};
const byDay = new Map();
for (const p of plays) (byDay.get(p.day) || byDay.set(p.day, []).get(p.day)).push(p);
for (const [day, list] of byDay) {
  const [best] = top(list, (p) => p.id, 1);
  calendar[day] = { plays: list.length, minutes: minutes(list), top: best ? track(best) : null };
}

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
};

await writeFile(photosPath, JSON.stringify(photos, null, 1) + '\n');
await writeFile(join(outDir, 'music.json'), JSON.stringify(music) + '\n');
console.log(`music.json: ${plays.length} plays over ${byDay.size} days since ${since}.`);
