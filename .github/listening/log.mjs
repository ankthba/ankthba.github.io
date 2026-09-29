// Appends every play Spotify reports that the private log doesn't have
// yet. Run after update.mjs by .github/workflows/listening.yml.
//
//   node log.mjs <logdir> <recent.json>
//
// <logdir> is a checkout of the private listening-log repository. Plays
// go one per line into plays/YYYY-MM.jsonl, by the month they were played
// in (America/New_York), oldest first; cursor.json holds the time of the
// newest play logged.

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [logDir, recentPath] = process.argv.slice(2);
if (!logDir || !recentPath) {
  console.error('usage: node log.mjs <logdir> <recent.json>');
  process.exit(1);
}

const monthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
});
const localMonth = (date) => monthFormat.format(new Date(date)).slice(0, 7);

const cursorPath = join(logDir, 'cursor.json');
let cursor = { last: null };
try { cursor = JSON.parse(await readFile(cursorPath, 'utf8')); } catch {}

const recent = JSON.parse(await readFile(recentPath, 'utf8'));
const last = cursor.last ? Date.parse(cursor.last) : 0;
const fresh = recent
  .filter((item) => Date.parse(item.played_at) > last)
  .sort((a, b) => Date.parse(a.played_at) - Date.parse(b.played_at));

await mkdir(join(logDir, 'plays'), { recursive: true });
for (const { track, played_at, context } of fresh) {
  const images = [...(track?.album?.images || [])].sort((a, b) => (a.width || 0) - (b.width || 0));
  const line = {
    played_at,
    id: track?.id || null,
    name: track?.name || null,
    artists: (track?.artists || []).map((a) => ({ id: a.id || null, name: a.name })),
    album: track?.album ? { id: track.album.id || null, name: track.album.name } : null,
    image: (images.find((i) => (i.width || 0) >= 300) || images.at(-1) || {}).url || null,
    duration_ms: track?.duration_ms ?? null,
    context: context ? { type: context.type, uri: context.uri } : null,
  };
  await appendFile(join(logDir, 'plays', localMonth(played_at) + '.jsonl'), JSON.stringify(line) + '\n');
  cursor.last = played_at;
}

await writeFile(cursorPath, JSON.stringify(cursor, null, 2) + '\n');
console.log(`${fresh.length} plays logged.`);
