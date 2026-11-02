/* The music page, drawn from music.json, which the Action in
   .github/workflows/listening.yml writes every fifteen minutes from the
   private log of plays, and kept live by the Worker at data-live.

   Top to bottom: the song playing now, its cover large; the last 30 or
   the last 7 days (the figures, the top songs, albums and artists as
   market maps, the standouts, what's rising, when the listening happens
   as a curve across the day and by day, and what the music is, in
   stacked bars); the calendar, a month of covers with the day picked
   beside it; and today, as a timeline. Links must go to Spotify and
   pictures must be https, whatever the file says. */

'use strict';

(function () {
  var page = document.querySelector('[data-music]');
  if (!page || !window.fetch) return;

  var src = page.getAttribute('data-src');
  /* A local preview can point it at a sample: ?music=/path.json */
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var override = new URLSearchParams(location.search).get('music');
  if (local && override && override.charAt(0) === '/') src = override;
  /* Each day's whole log sits beside music.json, in days/. */
  var base = src.replace(/[^/]*$/, '');

  var TZ = 'America/New_York';
  var NS = 'http://www.w3.org/2000/svg';
  var spotify = function (url) { return /^https:\/\/open\.spotify\.com\//.test(url || '') ? url : null; };
  var https = function (url) { return /^https:\/\//.test(url || '') || (local && /^\//.test(url || '')) ? url : null; };
  var $ = function (sel) { return page.querySelector(sel); };
  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  var svg = function (tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  };

  /* ---------- Words and numbers ---------- */

  var num = function (n) { return n.toLocaleString('en-US'); };
  var plural = function (n, one, many) { return num(n) + ' ' + (n === 1 ? one : many); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var dayOf = function (date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };
  var noonOf = function (day) { return new Date(day + 'T12:00:00Z'); };
  var shiftDay = function (day, n) {
    var d = noonOf(day);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  var fmtDay = function (day, opts) {
    return noonOf(day).toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, opts));
  };
  var duration = function (mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return plural(m, 'minute', 'minutes');
    return plural(h, 'hour', 'hours') + (m ? ' ' + plural(m, 'minute', 'minutes') : '');
  };
  // the same, short: 2 h 15 min
  var short = function (mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m || !h ? m + ' min' : '');
  };
  var mmss = function (ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + pad(s % 60);
  };
  function ago(iso) {
    var mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return plural(mins, 'minute', 'minutes') + ' ago';
    var hours = Math.round(mins / 60);
    if (hours < 24) return plural(hours, 'hour', 'hours') + ' ago';
    return plural(Math.round(hours / 24), 'day', 'days') + ' ago';
  }
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var hourName = function (h) {
    return h === 0 ? 'midnight' : h === 12 ? 'noon' : (h % 12) + (h < 12 ? ' am' : ' pm');
  };
  var pct = function (n, of) {
    var p = of ? (100 * n) / of : 0;
    return p > 0 && p < 1 ? 'under 1%' : Math.round(p) + '%';
  };

  /* A day's top songs: a list now, a single song in older files. */
  var topsOf = function (info) { return Array.isArray(info.top) ? info.top : info.top ? [info.top] : []; };

  /* ---------- Pieces ----------
     A cover, a link to Spotify (or nothing, if the file has none), and
     a row: what leads it (a rank or a time), the cover, the name and who
     by, and what closes it. */
  function cover(item, cls) {
    var img = el('img', cls);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (https(item.image)) img.src = item.image;
    return img;
  }

  function link(item, cls) {
    var href = spotify(item.url);
    var a = el(href ? 'a' : 'div', cls);
    if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  function track(item, lead, tail) {
    var li = el('li');
    var r = link(item, 'track' + (lead ? '' : ' track--bare'));
    if (lead) r.appendChild(lead);
    r.appendChild(cover(item, 'track__art'));
    var text = el('span', 'track__text');
    text.appendChild(el('span', 'track__name', item.name));
    if (item.artists) text.appendChild(el('span', 'track__by', item.artists));
    r.appendChild(text);
    if (tail) r.appendChild(tail);
    li.appendChild(r);
    return li;
  }
  var rank = function (i) { return el('span', 'track__n', pad(i + 1)); };
  var count = function (item) { return el('span', 'track__count', plural(item.plays, 'play', 'plays')); };

  /* A stop on a timeline: its time (or Now), a dot on the line, the song. */
  function stop(item) {
    var li = el('li', 'stop' + (item.now ? ' stop--now' : ''));
    var time = el('time', 'stop__time', item.now ? 'Now'
      : new Date(item.played_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }));
    time.dateTime = item.played_at;
    li.appendChild(time);
    li.appendChild(el('span', 'stop__dot'));
    var song = link(item, 'stop__song');
    song.appendChild(cover(item, 'stop__art'));
    var text = el('span', 'stop__text');
    text.appendChild(el('span', 'stop__name', item.name));
    if (item.artists) text.appendChild(el('span', 'stop__by', item.artists));
    song.appendChild(text);
    li.appendChild(song);
    return li;
  }

  /* ---------- The last 7 days, or the last 30 ---------- */
  var data = null;
  var range = 'month'; // the range shown, the past 30 days to begin with, kept when the file is read again

  function rangeOf(which) {
    var r = data.ranges && data.ranges[which];
    if (!r) return null;
    /* Its own stats, or, in older files, the calendar week or month that
       happens to start the same day. */
    var stats = r.stats || (which === 'week' ? (data.weeks || {})[r.from] : (data.months || {})[r.from.slice(0, 7)]);
    return {
      from: r.from,
      to: r.to,
      plays: r.plays,
      minutes: r.minutes,
      tracks: stats ? stats.tracks : null,
      artists: stats ? stats.artists : null,
      topTracks: r.tracks,
      topArtists: r.artists,
      before: r.before || null,
      rising: r.rising || [],
      stats: stats
    };
  }

  /* Four figures, each with how it went against the same stretch
     before it, as a signed share. */
  function figures(r) {
    var box = $('[data-figures]');
    box.textContent = '';
    var hours = Math.round(r.minutes / 60);
    var b = r.before;
    var then = range === 'week' ? 'the 7 days before' : 'the 30 days before';
    [
      [num(r.plays), r.plays === 1 ? 'play' : 'plays', r.plays, b && b.plays],
      r.minutes < 60 ? [num(r.minutes), r.minutes === 1 ? 'minute' : 'minutes', r.minutes, b && b.minutes]
        : [num(hours), hours === 1 ? 'hour' : 'hours', r.minutes, b && b.minutes],
      r.tracks != null ? [num(r.tracks), r.tracks === 1 ? 'song' : 'songs', r.tracks, b && b.tracks] : null,
      r.artists != null ? [num(r.artists), r.artists === 1 ? 'artist' : 'artists', r.artists, b && b.artists] : null
    ].filter(Boolean).forEach(function (f) {
      var item = el('div', 'figure');
      item.appendChild(el('dd', 'figure__v', f[0]));
      item.appendChild(el('dt', 'figure__t', f[1]));
      if (b && f[3]) {
        var d = Math.round((100 * (f[2] - f[3])) / f[3]);
        var mark = el('dd', 'figure__d ' + (d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-same'),
          d > 0 ? '+' + d + '%' : d < 0 ? '−' + (-d) + '%' : 'same');
        mark.title = d > 0 ? d + '% more than ' + then : d < 0 ? -d + '% fewer than ' + then : 'The same as ' + then;
        item.appendChild(mark);
      }
      box.appendChild(item);
    });
    $('[data-figures-note]').textContent = b ? 'Against ' + then + '.' : '';
    $('[data-range-dates]').textContent = fmtDay(r.from, { month: 'short', day: 'numeric' }) +
      ' – ' + fmtDay(r.to, { month: 'short', day: 'numeric' });
  }

  /* ---------- Market maps ----------
     The top songs, and the top artists, as square covers packed edge to
     edge like a map of a stock market. The sizes go by rank, in tiers
     that each fill whole rows of the sixteen-cell grid: the first eight
     cells square, the next four, four cells square, the next sixteen,
     two, and the rest one; each tier is as much of the map as the one
     before it, and a tier that can't fill its rows is cut back to the
     rows it can, so there is never a hole. Nothing is written on the
     covers: pointing at one names it in a label beside it, and in full
     under the map. One with no picture at all is set in type instead:
     its name, or on the smallest squares its initials. */
  var TIERS = [[8, 1], [4, 4], [2, 16], [1, 64]];

  function tiers(items) {
    var out = [], at = 0;
    TIERS.forEach(function (t) {
      if (at >= items.length) return;
      var size = t[0], take = Math.min(t[1], items.length - at);
      var band = 16 / size; // covers of this size to a band of rows
      if (take < t[1]) take = Math.floor(take / band) * band;
      for (var i = 0; i < take; i++) out.push([items[at + i], size]);
      at += t[1];
      if (take < t[1]) at = items.length; // a cut tier is the last
    });
    return out;
  }

  var initials = function (name) {
    var words = name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || name).slice(0, 2)).toUpperCase();
  };

  function market(box, note, items, what, of) {
    var block = box.closest('.block');
    var placed = tiers((items || []).filter(function (x) { return x.plays > 0; }));
    block.hidden = !placed.length;
    if (!placed.length) return;
    items = placed.map(function (p) { return p[0]; });
    var total = items.reduce(function (a, x) { return a + x.plays; }, 0);
    var sum = (of && of > items.length ? 'The top ' + items.length + ' of ' + num(of) + ' ' + what
      : of ? 'All ' + items.length + ' ' + what : 'The top ' + items.length + ' ' + what) +
      ', ' + plural(total, 'play', 'plays') + ' between them.';
    box.textContent = '';
    var tip = el('span', 'tm__tip');
    tip.setAttribute('aria-hidden', 'true');

    placed.forEach(function (p, i) {
      var item = p[0], k = p[1];
      var tile = link(item, 'tm__tile k' + k);
      if (https(item.image)) {
        tile.appendChild(cover(item, 'tm__art'));
      } else {
        tile.classList.add('is-type');
        tile.appendChild(el('span', 'tm__type', k === 1 ? initials(item.name) : item.name));
      }
      var said = pad(i + 1) + '. ' + item.name + (item.artists ? ', ' + item.artists : '') + ': ' +
        plural(item.plays, 'play', 'plays') + ', ' + pct(item.plays, total) + ' of these.';
      tile.setAttribute('aria-label', said);
      var show = function () {
        note.textContent = said;
        tip.textContent = '';
        tip.appendChild(el('span', 'tm__tip-name', item.name));
        tip.appendChild(el('span', 'tm__tip-by', (item.artists ? item.artists + ' · ' : '') + plural(item.plays, 'play', 'plays')));
        tip.classList.add('is-on');
        var x = Math.min(tile.offsetLeft, box.clientWidth - tip.offsetWidth);
        var y = tile.offsetTop - tip.offsetHeight - 6;
        if (y < 0) y = tile.offsetTop + tile.offsetHeight + 6;
        tip.style.transform = 'translate(' + Math.max(0, x) + 'px, ' + y + 'px)';
      };
      var hide = function () {
        note.textContent = sum;
        tip.classList.remove('is-on');
      };
      tile.addEventListener('mouseenter', show);
      tile.addEventListener('focus', show);
      tile.addEventListener('mouseleave', hide);
      tile.addEventListener('blur', hide);
      box.appendChild(tile);
    });
    box.appendChild(tip);
    note.textContent = sum;
  }

  function topTracks(items, of) {
    market($('[data-top-tracks]'), $('[data-top-tracks-note]'), items, 'songs', of);
  }

  function topAlbums(items, of) {
    market($('[data-top-albums]'), $('[data-top-albums-note]'), items, 'albums', of);
  }

  function topArtists(items, of) {
    market($('[data-top-artists]'), $('[data-top-artists-note]'), items, 'artists', of);
  }

  /* The file lists only the top ten songs and artists of a range, so for
     the maps every play of it is read from each day's log (the files the
     calendar opens; today's is the file's so far and the page's own
     since) and counted again, every song and artist heard, as many as
     the map's tiers have room for. An artist past the file's top ten has no picture of their
     own, so their most played cover stands in. */
  var everyPlay = {};

  function playsOf(r) {
    var key = r.from + '/' + r.to;
    var today = dayOf(new Date());
    if (everyPlay[key] && r.to !== today) return everyPlay[key];
    var days = [];
    for (var d = r.from; d <= r.to; d = shiftDay(d, 1)) days.push(d);
    everyPlay[key] = Promise.all(days.map(function (day) {
      if (dayFiles[day]) return Promise.resolve(dayFiles[day]);
      return fetch(base + 'days/' + day + '.json', { cache: 'no-cache' })
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (list) { return (dayFiles[day] = list); })
        .catch(function () { return []; });
    })).then(function (lists) {
      var all = [].concat.apply([], lists);
      if (r.to === today) {
        var file = dayFiles[today] || [];
        var last = file.length ? Date.parse(file[file.length - 1].played_at) : 0;
        all = all.concat(todaysPlays().filter(function (p) { return Date.parse(p.played_at) > last; }));
      }
      return all;
    });
    return everyPlay[key];
  }

  /* Every artist the file pictures anywhere (the top artists of each
     range, day, week and month, the most and least followed), by name,
     known as artists by their Spotify address; and artists.json, the
     Action's own cache of photos by artist, for plays that carry the
     artist's id. */
  var photosById = null;

  function photos() {
    if (photosById) return photosById;
    photosById = fetch(base + 'artists.json', { cache: 'no-cache' })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .catch(function () { return {}; });
    return photosById;
  }

  /* Album names and artist photos, taken from the full play log by hand
     (assets/data/music-names.json), for the plays whose day logs don't
     carry them yet; the Action's own data takes over as it fills in. */
  var namesFile = null;

  function names() {
    if (namesFile) return namesFile;
    namesFile = fetch('/assets/data/music-names.json')
      .then(function (res) { return res.ok ? res.json() : {}; })
      .catch(function () { return {}; });
    return namesFile;
  }

  function pictured() {
    var found = {};
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o.name && https(o.image) && /^https:\/\/open\.spotify\.com\/artist\//.test(o.url || '') && !found[o.name]) {
        found[o.name] = { image: o.image, url: o.url };
      }
      Object.keys(o).forEach(function (k) { if (k !== 'recent') walk(o[k]); });
    })(data);
    return found;
  }

  /* Every album the file names anywhere (each day's, week's, month's
     and range's top album), by its cover, which is the album's own. */
  function albumNames() {
    var found = {};
    (function walk(o, key) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(function (x) { walk(x, key); }); return; }
      if (key === 'topAlbum' && o.name && o.image && !found[o.image]) found[o.image] = o;
      Object.keys(o).forEach(function (k) { if (k !== 'recent') walk(o[k], k); });
    })(data, '');
    return found;
  }

  function tally(plays, r, byId, extra) {
    var songs = {}, artists = {}, albums = {}, pictures = pictured(), named = albumNames();
    var more = extra || {};
    Object.keys(more.artists || {}).forEach(function (n) {
      if (!pictures[n] && https(more.artists[n].image)) pictures[n] = more.artists[n];
    });
    (r.topArtists || []).forEach(function (a) { pictures[a.name] = a; });
    plays.forEach(function (p) {
      var at = Date.parse(p.played_at) || 0;
      var k = p.url || p.name + '\u0000' + p.artists;
      var song = songs[k] || (songs[k] = { name: p.name, artists: p.artists, url: p.url, image: p.image, plays: 0, last: 0 });
      song.plays++;
      song.last = Math.max(song.last, at);
      /* an album is its cover; its name from the play (once the logs
         carry it) or from the file */
      var key = p.image || p.album;
      if (key) {
        var known = named[p.image];
        var by = (p.artists || '').split(', ')[0];
        var album = albums[key] || (albums[key] = {
          name: p.album || (known && known.name) || (more.albums && more.albums[p.image]) || null,
          artists: known && known.artists ? known.artists : by,
          url: known && spotify(known.url) ? known.url : null,
          image: p.image, plays: 0, last: 0, by: by, heard: {}
        });
        album.plays++;
        album.last = Math.max(album.last, at);
        album.heard[p.name] = (album.heard[p.name] || 0) + 1;
      }
      var who = (p.artists || '').split(', ')[0];
      if (!who) return;
      var pic = pictures[who];
      var photo = p.artist && byId && https(byId[p.artist]) ? byId[p.artist] : null;
      var artist = artists[who] || (artists[who] = {
        name: who, plays: 0, last: 0,
        url: pic ? pic.url : p.artist ? 'https://open.spotify.com/artist/' + p.artist : null,
        image: pic ? pic.image : photo, covers: {}
      });
      if (!artist.image && photo) artist.image = photo;
      artist.plays++;
      artist.last = Math.max(artist.last, at);
      if (p.image) artist.covers[p.image] = (artist.covers[p.image] || 0) + 1;
    });
    var order = function (a, b) { return b.plays - a.plays || b.last - a.last; };
    var list = function (o) { return Object.keys(o).map(function (k) { return o[k]; }).sort(order); };
    var all = { songs: list(songs), albums: list(albums), artists: list(artists) };
    /* an album the logs don't name yet (they will once the Action writes
       album names into them): its artist, and the song played most from it */
    all.albums.forEach(function (a) {
      if (a.name) return;
      var song = Object.keys(a.heard).sort(function (x, y) { return a.heard[y] - a.heard[x]; })[0];
      a.name = a.by;
      a.artists = song ? 'the album with ' + song : 'an album';
    });
    /* an artist whose photo the Action hasn't fetched yet: their most
       played cover stands in */
    all.artists.forEach(function (a) {
      if (!a.image) a.image = Object.keys(a.covers).sort(function (x, y) { return a.covers[y] - a.covers[x]; })[0] || null;
    });
    return all;
  }

  function maps(r, which) {
    Promise.all([playsOf(r), photos(), names()]).then(function (got) {
      var plays = got[0];
      if (range !== which || !plays.length) return;
      var all = tally(plays, r, got[1], got[2]);
      if (all.songs.length > (r.topTracks || []).length) topTracks(all.songs, all.songs.length);
      topAlbums(all.albums, all.albums.length);
      if (all.artists.length > (r.topArtists || []).length) topArtists(all.artists, all.artists.length);
    });
  }

  /* The top songs played more than the time before: from how many
     plays, or new to the top listened if they weren't in it then. */
  function rising(items) {
    var list = $('[data-rising]');
    list.textContent = '';
    items.forEach(function (item) {
      var risen = 'wasTop' in item ? item.wasTop : item.before > 0;
      var tail = el('span', 'track__count', (risen ? 'from ' + num(item.before) + ' to ' : 'new, ') + plural(item.plays, 'play', 'plays'));
      list.appendChild(track(item, null, tail));
    });
    $('[data-rising-block]').hidden = !items.length;
  }

  /* Standouts, in rows: what each stands out for, the song, album,
     playlist or artist itself, and its figure. */
  function standouts(stats) {
    var list = $('[data-standouts]');
    list.textContent = '';
    var oldest = stats && stats.released && stats.released.oldest;
    var playlist = stats && stats.topPlaylist;
    var fans = function (n) {
      return (n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : num(n)) + (n === 1 ? ' fan' : ' fans');
    };
    [
      stats && stats.topAlbum && [stats.topAlbum, 'Top album', plural(stats.topAlbum.plays, 'play', 'plays')],
      playlist && [playlist, 'Top playlist', plural(playlist.plays, 'play', 'plays')],
      stats && stats.onRepeat && [stats.onRepeat, 'On repeat', stats.onRepeat.times + ' in a row'],
      stats && stats.binge && [stats.binge, 'Most in a row', stats.binge.times + ' songs', true],
      stats && stats.longest && [stats.longest, 'Longest song', mmss(stats.longest.duration_ms)],
      stats && stats.deepCut && [stats.deepCut, 'Deepest cut', stats.deepCut.popularity + '/100'],
      oldest && [oldest, 'Oldest song', String(oldest.year)],
      stats && stats.released && stats.released.newest && [stats.released.newest, 'Newest song',
        fmtDay(stats.released.newest.released, { month: 'short', day: 'numeric' })],
      stats && stats.biggest && [stats.biggest, 'Most followed artist', fans(stats.biggest.fans), true],
      stats && stats.nichest && [stats.nichest, 'Least known artist', fans(stats.nichest.fans), true]
    ].filter(Boolean).forEach(function (st) {
      var li = el('li');
      var r = link(st[0], 'stand' + (st[3] ? ' stand--artist' : ''));
      r.appendChild(el('span', 'stand__label', st[1]));
      r.appendChild(cover(st[0], 'stand__art'));
      var text = el('span', 'stand__text');
      text.appendChild(el('span', 'stand__name', st[0].name));
      if (st[0].artists) text.appendChild(el('span', 'stand__by', st[0].artists));
      r.appendChild(text);
      r.appendChild(el('span', 'stand__value', st[2]));
      li.appendChild(r);
      list.appendChild(li);
    });
    $('[data-standouts-block]').hidden = !list.children.length;
  }

  /* ---------- When ----------
     The hours, the days, and each day of the range as columns, the
     busiest in ink; and hour by day as a grid. Pointing at any of them says
     what it is in the note under it, which otherwise sums it up. */
  function columns(box, note, counts, o) {
    box.textContent = '';
    var max = Math.max.apply(null, counts) || 1;
    var plot = el('div', 'cols__plot');
    var axis = el('div', 'cols__axis');
    plot.setAttribute('role', 'img');
    plot.setAttribute('aria-label', o.sum);
    axis.setAttribute('aria-hidden', 'true');
    counts.forEach(function (n, i) {
      var col = el('span', 'cols__col' + (o.lit(i) ? ' is-lit' : ''));
      col.style.setProperty('--v', String(n / max));
      col.addEventListener('mouseenter', function () {
        note.textContent = o.name(i) + ', ' + (o.say ? o.say(n) : plural(n, 'play', 'plays'));
      });
      col.addEventListener('mouseleave', function () { note.textContent = o.sum; });
      plot.appendChild(col);
      axis.appendChild(el('span', 'cols__tick', o.tick(i)));
    });
    box.appendChild(plot);
    box.appendChild(axis);
    note.textContent = o.sum;
  }

  function heat(box, note, rows) {
    box.textContent = '';
    var max = 0;
    rows.forEach(function (r) { r.hours.forEach(function (n) { max = Math.max(max, n); }); });
    var sum = 'Darker is more plays; the busiest hour had ' + plural(max, 'play', 'plays') + '.';
    var grid = el('div', 'heat__grid');
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', 'Plays by hour on each day. ' + sum);
    rows.forEach(function (r) {
      grid.appendChild(el('span', 'heat__day', r.label));
      r.hours.forEach(function (n, h) {
        var cell = el('span', 'heat__cell' + (n ? '' : ' is-none'));
        cell.style.setProperty('--v', String(max ? 0.15 + 0.85 * (n / max) : 0));
        cell.addEventListener('mouseenter', function () {
          note.textContent = r.name + ', from ' + hourName(h) + ' to ' + hourName((h + 1) % 24) + ', ' + plural(n, 'play', 'plays');
        });
        cell.addEventListener('mouseleave', function () { note.textContent = sum; });
        grid.appendChild(cell);
      });
    });
    var axis = el('div', 'heat__axis');
    axis.setAttribute('aria-hidden', 'true');
    axis.appendChild(el('span'));
    for (var h = 0; h < 24; h++) axis.appendChild(el('span', 'cols__tick', h % 6 ? '' : h ? hourName(h) : '12 am'));
    box.appendChild(grid);
    box.appendChild(axis);
    note.textContent = sum;
    box.closest('.habit').hidden = !rows.length;
  }

  /* ---------- What ----------
     Each breakdown as one bar cut into its parts, darkest first, with a
     legend; pointing at a part in either names it in both. Where the
     parts can overlap (a song can have more than one genre) and so add
     up to more than the whole, each gets a bar of its own instead. */
  function composition(box, rows) {
    box.textContent = '';
    box.closest('.habit').hidden = !rows.length;
    if (!rows.length) return;
    var total = rows.reduce(function (a, r) { return a + r[2]; }, 0);
    var stacked = total <= 1.001;
    var legend = el('ol', 'comp__legend' + (stacked ? '' : ' comp__legend--bars'));
    var bar = stacked ? el('div', 'comp__bar') : null;
    var segs = [];
    rows.forEach(function (r, i) {
      var shade = String(Math.min(i, 6));
      var li = el('li', 'comp__item');
      li.style.setProperty('--i', shade);
      li.appendChild(el('i', 'comp__sw'));
      li.appendChild(el('span', 'comp__name', r[0]));
      li.appendChild(el('span', 'comp__v', r[1]));
      if (stacked) {
        var seg = el('i', 'comp__seg');
        seg.style.setProperty('--i', shade);
        seg.style.setProperty('--w', String(Math.max(0, r[2])));
        seg.title = r[0] + ', ' + r[1];
        bar.appendChild(seg);
        segs.push(seg);
        var on = function () { box.classList.add('is-pointing'); seg.classList.add('is-on'); li.classList.add('is-on'); };
        var off = function () { box.classList.remove('is-pointing'); seg.classList.remove('is-on'); li.classList.remove('is-on'); };
        [seg, li].forEach(function (x) { x.addEventListener('mouseenter', on); x.addEventListener('mouseleave', off); });
      } else {
        var own = el('span', 'comp__own');
        var fill = el('i');
        fill.style.setProperty('--w', String(Math.min(1, r[2])));
        own.appendChild(fill);
        li.appendChild(own);
      }
      legend.appendChild(li);
    });
    if (stacked) {
      if (total < 0.995) {
        var rest = el('i', 'comp__seg comp__seg--rest');
        rest.style.setProperty('--w', String(1 - total));
        bar.appendChild(rest);
      }
      box.appendChild(bar);
    }
    box.appendChild(legend);
  }

  /* ---------- How ----------
     The figures for how the listening went, each with a line under it. */
  function factsOf(key) {
    var box = $('[data-facts="' + key + '"]');
    box.textContent = '';
    return function (value, term, more) {
      if (value == null) return;
      var item = el('div', 'fact');
      item.appendChild(el('dd', 'fact__v', value));
      item.appendChild(el('dt', 'fact__t', term));
      if (more) item.appendChild(el('dd', 'fact__more', more));
      box.appendChild(item);
    };
  }

  function habits(r, onlyWhen) {
    var s = r.stats;
    var box = $('[data-habits]');
    box.hidden = !s || !s.hours;
    if (box.hidden) return;
    var month = range === 'month';
    /* what and how need the details of every song, which only the file
       has; a range worked out on the page draws when alone */
    $('[data-what-block]').hidden = $('[data-how-block]').hidden = Boolean(onlyWhen);

    /* the busiest three hours running, round midnight too */
    var best = 0, most = -1;
    for (var h = 0; h < 24; h++) {
      var three = s.hours[h] + s.hours[(h + 1) % 24] + s.hours[(h + 2) % 24];
      if (three > most) { most = three; best = h; }
    }
    columns($('[data-hours]'), $('[data-hours-note]'), s.hours, {
      lit: function (i) { return (i - best + 24) % 24 < 3; },
      name: function (i) { return 'From ' + hourName(i) + ' to ' + hourName((i + 1) % 24); },
      tick: function (i) { return i % 6 ? '' : i ? hourName(i) : '12 am'; },
      sum: 'Most of all from ' + hourName(best) + ' to ' + hourName((best + 3) % 24) + ', ' +
        num(most) + ' of ' + plural(s.plays, 'play', 'plays') + '.'
    });

    var top = s.weekdays.indexOf(Math.max.apply(null, s.weekdays));
    columns($('[data-days]'), $('[data-days-note]'), s.weekdays, {
      lit: function (i) { return i === top; },
      name: function (i) { return DAYS[i] + (month ? 's' : ''); },
      tick: function (i) { return DAYS[i].slice(0, 3); },
      sum: (month ? 'Most on ' + DAYS[top] + 's. ' : '') + 'The busiest day was ' +
        fmtDay(s.busiest.day, { weekday: 'long', month: 'long', day: 'numeric' }) + ', with ' +
        duration(s.busiest.minutes) + '.'
    });

    /* Hour by day: the week's days in order, or a month's by the day of
       the week, each hour a cell as dark as its plays. */
    var order = [0, 1, 2, 3, 4, 5, 6];
    if (!month) {
      var first = noonOf(r.from).getUTCDay();
      order = order.map(function (i) { return (first + i) % 7; });
    }
    heat($('[data-heat]'), $('[data-heat-note]'), order.map(function (wd, i) {
      return {
        label: month ? DAYS[wd].slice(0, 3) : DAYS[wd].slice(0, 3) + ' ' + (+shiftDay(r.from, i).slice(8)),
        name: month ? DAYS[wd] + 's' : fmtDay(shiftDay(r.from, i), { weekday: 'long', month: 'long', day: 'numeric' }),
        hours: s.grid ? s.grid[wd] : null
      };
    }).filter(function (x) { return x.hours; }));

    /* Day by day: the minutes of each day of the range. */
    var cal = data.calendar || {};
    var dayList = [];
    for (var d = r.from; d <= r.to; d = shiftDay(d, 1)) dayList.push(d);
    columns($('[data-perday]'), $('[data-perday-note]'), dayList.map(function (d) { return cal[d] ? cal[d].minutes : 0; }), {
      lit: function (i) { return dayList[i] === s.busiest.day; },
      name: function (i) { return fmtDay(dayList[i], { weekday: 'long', month: 'long', day: 'numeric' }); },
      say: function (n) { return n ? duration(n) : 'nothing played'; },
      tick: function (i) {
        var n = +dayList[i].slice(8);
        return !month || n === 1 || n % 7 === 1 ? String(n) : '';
      },
      sum: duration(Math.round(r.minutes / dayList.length)) + ' a day on average.'
    });

    if (onlyWhen) return;

    var span = dayList.length;
    var clockAt = function (m) {
      m = ((m % 1440) + 1440) % 1440;
      var hh = Math.floor(m / 60), mm = m % 60;
      if (!mm && hh % 12 === 0) return hh ? 'noon' : 'midnight';
      return (hh % 12 || 12) + ':' + pad(mm) + (hh < 12 ? ' am' : ' pm');
    };
    var late = s.hours.slice(0, 5).reduce(function (a, b) { return a + b; }, 0);

    var rhythm = factsOf('rhythm');
    rhythm(num(s.sessions), s.sessions === 1 ? 'listening session' : 'listening sessions',
      s.sessions > 1 && s.longestSession ? 'The longest, ' + duration(s.longestSession.minutes) + '.' : '');
    rhythm(s.days + ' of ' + span, 'days with music',
      s.streak > 1 && s.streak < s.days ? s.streak + ' in a row at most.' : '');
    if (s.clock && s.clock.start != null) {
      rhythm(clockAt(s.clock.start), 'the music usually starts', 'On a day with music.');
      rhythm(clockAt(s.clock.end), 'and usually stops', s.clock.end > 1440 ? 'Past midnight, that is.' : '');
    }
    rhythm(short(Math.round(r.minutes / Math.max(1, s.days))), 'a day of music', 'On the days with any.');
    rhythm(pct(late, s.plays), 'after midnight', 'Plays from 12 to 5 am.');

    var how = factsOf('habits');
    how(num(s.newTracks), 'songs heard for the first time', 'And ' + plural(s.newArtists, 'artist', 'artists') + '.');
    how(pct(s.plays - s.tracks, s.plays), 'replays', 'Plays of a song already heard in these ' + (month ? '30' : '7') + ' days.');
    if (s.once != null) how(num(s.once), s.once === 1 ? 'song played just once' : 'songs played just once', 'Of ' + plural(s.tracks, 'song', 'songs') + '.');
    how(pct(s.cutShort, s.plays), 'skipped part way', num(s.cutShort) + ' of ' + plural(s.plays, 'play', 'plays') + '.');
    if (s.topArtists && s.topArtists.length) {
      var five = s.topArtists.slice(0, 5).reduce(function (a, x) { return a + x.plays; }, 0);
      how(pct(five, s.plays), 'from the top five artists', 'Of ' + plural(s.artists, 'artist', 'artists') + ' in all.');
    }
    how(num(s.albums), s.albums === 1 ? 'album' : 'albums', s.newAlbums ? num(s.newAlbums) + ' heard for the first time.' : '');

    var music = factsOf('music');
    if (s.averageMs) music(mmss(s.averageMs), 'average song length');
    if (s.released && s.released.age != null) music(s.released.age + (s.released.age === 1 ? ' year' : ' years'), 'average age of a song', 'When it was played.');
    if (s.features != null) music(pct(s.features, s.plays), 'with a featured artist');
    if (s.explicit) music(pct(s.explicit.plays, s.explicit.known), 'explicit');
    if (s.variety != null) music(String(s.variety), 'variety, out of 100', 'How spread the plays are across artists.');
    if (s.popularity != null) music(String(s.popularity), 'popularity, out of 100', 'On average, by Deezer’s chart rank.');

    var g = s.genres;
    composition($('[data-genres]'), g ? g.top.map(function (x) {
      return [x.name, pct(x.plays, g.known), x.plays / g.known];
    }) : []);

    var rel = s.released;
    composition($('[data-decades]'), rel ? Object.keys(rel.decades).sort().reverse().map(function (dd) {
      return ['The ' + dd, pct(rel.decades[dd], rel.known), rel.decades[dd] / rel.known];
    }) : []);
    $('[data-decades-note]').textContent = rel ? 'Out in ' + rel.average + ' on average' +
      (rel.fresh ? ', and ' + pct(rel.fresh, rel.known) + ' less than a month old when played.' : '.') : '';

    var reach = s.reach;
    composition($('[data-reach]'), reach ? [
      ['Mainstream', reach.mainstream], ['In between', reach.middle], ['Niche', reach.niche]
    ].map(function (x) { return [x[0], pct(x[1], reach.known), x[1] / reach.known]; }) : []);

    var c = s.countries;
    composition($('[data-countries]'), c ? c.top.map(function (x) {
      return [region(x.code), pct(x.plays, c.known), x.plays / c.known];
    }) : []);
    $('[data-countries-note]').textContent = c && c.count > c.top.length
      ? plural(c.count, 'country', 'countries') + ' in all.' : '';

    var k = s.kinds;
    composition($('[data-kinds]'), k ? [
      ['Solo artists', k.person], ['Bands and groups', k.group], ['Others', k.other]
    ].filter(function (x) { return x[1]; }).map(function (x) { return [x[0], pct(x[1], k.known), x[1] / k.known]; }) : []);

    var f = s.from;
    composition($('[data-from]'), f ? [
      ['Playlists', f.playlist], ['Albums', f.album], ['Artists’ pages', f.artist], ['Liked songs', f.liked], ['Anywhere else', f.other]
    ].filter(function (x) { return x[1]; }).map(function (x) { return [x[0], pct(x[1], s.plays), x[1] / s.plays]; }) : []);
  }

  /* A country's name from its code, in English. */
  var regions = window.Intl && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  var region = function (code) {
    try { return (regions && regions.of(code)) || code; } catch (e) { return code; }
  };

  /* The last 30 days. The Action now writes them, but a file from before
     it did holds the month so far, which on the 1st is a day. Then the
     page works the 30 days out itself, from the calendar (plays, time)
     and every play in the day logs (songs, artists, the maps, and when):
     all of it but what and how, which wait for the file. */
  var hourOf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
  var WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function lastThirty() {
    var today = dayOf(new Date());
    var from = shiftDay(today, -29);
    if (data.since && from < data.since) from = data.since;
    var cal = data.calendar || {};
    var r = { from: from, to: today, plays: 0, minutes: 0, tracks: null, artists: null,
      topTracks: [], topArtists: [], before: null, rising: [], stats: null };
    var busiest = { day: from, minutes: -1 };
    for (var d = from; d <= today; d = shiftDay(d, 1)) {
      if (!cal[d]) continue;
      r.plays += cal[d].plays || 0;
      r.minutes += cal[d].minutes || 0;
      if ((cal[d].minutes || 0) > busiest.minutes) busiest = { day: d, minutes: cal[d].minutes || 0 };
    }
    r.busiest = busiest;
    return r;
  }

  function showThirty() {
    var r = lastThirty();
    figures(r);
    topAlbums([]);
    standouts(null);
    rising([]);
    $('[data-habits]').hidden = true;
    Promise.all([playsOf(r), photos(), names()]).then(function (got) {
      var plays = got[0];
      if (range !== 'month') return;
      var all = tally(plays, r, got[1], got[2]);
      r.tracks = all.songs.length;
      r.artists = all.artists.length;
      figures(r);
      topTracks(all.songs, all.songs.length);
      topAlbums(all.albums, all.albums.length);
      topArtists(all.artists, all.artists.length);
      var hours = [], weekdays = [0, 0, 0, 0, 0, 0, 0], grid = [];
      for (var i = 0; i < 24; i++) hours.push(0);
      for (var w = 0; w < 7; w++) grid.push(hours.slice());
      plays.forEach(function (p) {
        var parts = {};
        hourOf.formatToParts(new Date(p.played_at)).forEach(function (x) { parts[x.type] = x.value; });
        var h = +parts.hour % 24, wd = WD[parts.weekday];
        if (isNaN(h) || wd == null) return;
        hours[h]++;
        weekdays[wd]++;
        grid[wd][h]++;
      });
      r.stats = { hours: hours, weekdays: weekdays, grid: grid, busiest: r.busiest, plays: plays.length };
      habits(r, true);
    });
  }

  function showRange(which) {
    var r = rangeOf(which);
    if (!r) return;
    range = which;
    Array.prototype.forEach.call(page.querySelectorAll('[data-range]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-range') === which));
    });
    if (which === 'month' && r.from > shiftDay(dayOf(new Date()), -29) && r.from > (data.since || '')) {
      showThirty();
      return;
    }
    figures(r);
    topTracks(r.topTracks);
    topAlbums([]);
    topArtists(r.topArtists);
    maps(r, which);
    standouts(r.stats);
    rising(r.rising);
    habits(r);
  }

  /* ---------- The calendar ----------
     A month at a time, any month since tracking began, each day by the
     cover of its top album (its top song's, in older files with none).
     Beside it, the day picked: its figures, how it went, its top songs,
     and its whole log, every song from 12 AM to 11:59 PM, kept closed
     until it is asked for. Today's is kept live, with the same plays as
     today's timeline at the foot of the page. */
  var cal = null;    // the calendar's redraws, once it is up
  var dayFiles = {}; // each day's whole log, once fetched

  /* Today's plays as the page knows them, oldest first: the file's, and
     any the live answers have brought since, less the song playing now. */
  function todaysPlays() {
    var today = dayOf(new Date());
    return merged([]).filter(function (p) { return dayOf(new Date(p.played_at)) === today; }).reverse();
  }

  /* The file sums today up to its last play, and any the page has had
     since are added, counted as the Action counts them (music.mjs): a
     play lasted no longer than the time since the one before it, and a
     song or an artist (the first one named) is new if it wasn't heard
     earlier in the day. The top songs are counted again from all of
     today's plays, a tie going to the one played last. */
  function liveDay(info, plays) {
    if (info && !info.last) return info;
    var last = info ? Date.parse(info.last) : 0;
    var earlier = plays.filter(function (p) { return Date.parse(p.played_at) <= last; });
    var extras = plays.filter(function (p) { return Date.parse(p.played_at) > last; });
    if (!extras.length) return info;

    var firstHeard = function (keyOf) {
      var had = {};
      earlier.forEach(function (p) { if (keyOf(p)) had[keyOf(p)] = true; });
      return function (p) {
        var key = keyOf(p);
        if (!key || had[key]) return false;
        return (had[key] = true);
      };
    };
    var song = function (p) { return p.url; };
    var artist = function (p) { return p.url ? (p.artists || '').split(', ')[0] : null; };

    var ms = 0;
    extras.forEach(function (p) {
      var i = plays.indexOf(p);
      var since = i ? Date.parse(p.played_at) - Date.parse(plays[i - 1].played_at) : Infinity;
      ms += Math.min(p.duration_ms || 0, since);
    });

    var tally = {};
    plays.forEach(function (p) {
      if (!p.url) return;
      var t = tally[p.url] || (tally[p.url] = { plays: 0 });
      t.plays += 1;
      t.play = p;
      t.last = Date.parse(p.played_at);
    });
    var top = Object.keys(tally).map(function (key) { return tally[key]; })
      .sort(function (a, b) { return b.plays - a.plays || b.last - a.last; })
      .slice(0, 5)
      .map(function (t) {
        return { name: t.play.name, artists: t.play.artists, url: t.play.url, image: t.play.image, plays: t.plays };
      });

    var from = info || { plays: 0, minutes: 0, tracks: 0, artists: 0 };
    return Object.assign({}, from, {
      plays: from.plays + extras.length,
      minutes: Math.round(from.minutes + ms / 60000),
      tracks: from.tracks + extras.filter(firstHeard(song)).length,
      artists: from.artists + extras.filter(firstHeard(artist)).length,
      top: top
    });
  }

  /* Enough of a list of plays to tell when it has changed. */
  var signOf = function (plays) { return plays.length + ' ' + (plays.length ? plays[plays.length - 1].played_at : ''); };

  function calendar() {
    var box = $('[data-cal]');
    if (!box || !data.since) return;
    /* Read from data at each draw, since the file is read again. */
    var days = function () { return data.calendar || {}; };
    var today = dayOf(new Date());
    var played = Object.keys(days()).filter(function (d) { return days()[d] && days()[d].plays; }).sort();
    var picked = days()[today] ? today : played[played.length - 1] || today;
    var month = picked.slice(0, 7);
    var sign = null; // today's plays as the panel last showed them

    function shift(ym, n) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }

    function draw() {
      today = dayOf(new Date());
      var head = $('[data-cal-month]');
      head.textContent = fmtDay(month + '-01', { month: 'long' });
      head.appendChild(el('span', 'cal__yr', ' ' + month.slice(0, 4)));
      $('[data-cal-prev]').disabled = month <= data.since.slice(0, 7);
      $('[data-cal-next]').disabled = month >= today.slice(0, 7);

      var grid = $('[data-cal-grid]');
      grid.textContent = '';
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) {
        var h = el('span', 'cal__wd', d);
        h.setAttribute('aria-hidden', 'true');
        grid.appendChild(h);
      });
      var start = noonOf(month + '-01');
      for (var i = 0; i < start.getUTCDay(); i++) grid.appendChild(el('span', 'cal__blank'));
      var length = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
      for (var d = 1; d <= length; d++) grid.appendChild(cell(month + '-' + pad(d)));
      panel();
    }

    function cell(day) {
      var info = days()[day];
      var label = fmtDay(day, { month: 'long', day: 'numeric' });
      var c = el('button', 'cal__cell');
      c.type = 'button';
      c.appendChild(el('span', 'cal__n', String(+day.slice(8))));
      if (day < data.since || day > today) {
        c.disabled = true;
        c.classList.add('is-off');
        c.setAttribute('aria-label', label + (day < data.since ? ', before tracking began' : ''));
        return c;
      }
      var top = info && (info.topAlbum || topsOf(info)[0]);
      if (top && https(top.image)) {
        var img = el('img', 'cal__art');
        img.alt = '';
        img.loading = 'lazy';
        img.src = top.image;
        c.insertBefore(img, c.firstChild);
        c.classList.add('has-art');
      }
      c.setAttribute('aria-label', label + ': ' + (info
        ? plural(info.plays, 'play', 'plays') + ', ' + duration(info.minutes) + (top ? ', top album ' + top.name : '')
        : 'nothing played'));
      if (day === today) c.classList.add('is-today');
      c.setAttribute('aria-pressed', String(day === picked));
      c.addEventListener('click', function () { picked = day; draw(); });
      return c;
    }

    function panel() {
      var box = $('[data-cal-day]');
      box.textContent = '';
      var info = days()[picked];
      if (picked === today) {
        var plays = todaysPlays();
        info = liveDay(info, plays);
        sign = signOf(plays);
      }
      box.appendChild(el('p', 'day__when', picked === today ? 'Today' : fmtDay(picked, { weekday: 'long' })));
      box.appendChild(el('h3', 'day__date', fmtDay(picked, { month: 'long', day: 'numeric' })));
      if (!info || !info.plays) {
        box.appendChild(el('p', 'day__line', picked === today ? 'Nothing yet today.' : 'Nothing played.'));
        return;
      }
      var stats = el('dl', 'day__stats');
      [[num(info.plays), info.plays === 1 ? 'play' : 'plays'], [short(info.minutes), 'listening'],
        [num(info.tracks), info.tracks === 1 ? 'song' : 'songs'], [num(info.artists), info.artists === 1 ? 'artist' : 'artists']]
        .forEach(function (f) {
          var s = el('div', 'day__stat');
          s.appendChild(el('dd', 'day__v', f[0]));
          s.appendChild(el('dt', 'day__t', f[1]));
          stats.appendChild(s);
        });
      box.appendChild(stats);
      /* and, from the file, how the day went: its sessions, what was
         new, and what it mostly was */
      var more = [];
      if (info.sessions) {
        more.push(plural(info.sessions, 'session', 'sessions') + (info.sessions > 1 && info.longestSession
          ? ', the longest ' + duration(info.longestSession.minutes) : ''));
      }
      if (info.newTracks) more.push(plural(info.newTracks, 'song', 'songs') + ' heard for the first time');
      if (info.genres && info.genres.top && info.genres.top.length) more.push('mostly ' + info.genres.top[0].name);
      if (more.length) {
        more = more.join('; ');
        box.appendChild(el('p', 'day__line', more.charAt(0).toUpperCase() + more.slice(1) + '.'));
      }
      var tops = topsOf(info);
      if (tops.length) {
        var list = el('ol', 'tracks');
        tops.slice(0, 5).forEach(function (item, i) { list.appendChild(track(item, rank(i), count(item))); });
        box.appendChild(list);
      }
      dayLog(box, picked);
    }

    /* The day's whole log, from the file the Action writes for each day,
       fetched only when it is opened, and once. Today's file runs to the
       Action's last run, and the plays since are added from the page's
       own. Once opened it stays open from day to day, until it is closed. */
    var logOpen = false;
    function dayLog(box, day) {
      var toggle = el('button', 'day__toggle');
      toggle.type = 'button';
      toggle.appendChild(el('span', 'day__toggle-name', 'Every song played that day'));
      toggle.appendChild(el('span', 'day__sign'));
      var body = el('div', 'day__log');
      var loaded = false;
      function set(open) {
        logOpen = open;
        toggle.setAttribute('aria-expanded', String(open));
        body.hidden = !open;
        if (open && !loaded) load();
      }
      function load() {
        if (dayFiles[day]) return fill(dayFiles[day]);
        body.textContent = '';
        body.appendChild(el('p', 'day__line', 'Loading…'));
        fetch(base + 'days/' + day + '.json', { cache: 'no-cache' })
          /* Today has no file until the Action has logged a play from it. */
          .then(function (r) { return r.ok ? r.json() : r.status === 404 && day === today ? [] : Promise.reject(r.status); })
          .then(function (plays) { fill(dayFiles[day] = plays); })
          .catch(function () {
            body.textContent = '';
            body.appendChild(el('p', 'day__line', 'That day’s log couldn’t be loaded. Close and open it again to retry.'));
          });
      }
      function fill(plays) {
        loaded = true;
        if (day === today) {
          var last = plays.length ? Date.parse(plays[plays.length - 1].played_at) : 0;
          plays = plays.concat(todaysPlays().filter(function (p) { return Date.parse(p.played_at) > last; }));
        }
        body.textContent = '';
        body.appendChild(el('p', 'day__span', '12 AM to 11:59 PM · ' + plural(plays.length, 'play', 'plays')));
        var list = el('ol', 'timeline timeline--day');
        plays.forEach(function (item) { list.appendChild(stop(item)); });
        body.appendChild(list);
      }
      toggle.addEventListener('click', function () { set(toggle.getAttribute('aria-expanded') !== 'true'); });
      box.appendChild(toggle);
      box.appendChild(body);
      set(logOpen);
    }

    $('[data-cal-prev]').addEventListener('click', function () { month = shift(month, -1); draw(); });
    $('[data-cal-next]').addEventListener('click', function () { month = shift(month, 1); draw(); });
    box.hidden = false;
    draw();

    cal = {
      draw: draw,
      /* At each live answer, today's panel again, if today is the day
         picked and its plays have changed. */
      live: function () {
        if (picked === today && signOf(todaysPlays()) !== sign) panel();
      }
    };
  }

  /* ---------- Today ----------
     Every play since 12 am today in Charlottesville, newest first, on a
     timeline; the song playing now heads it. The first ten, and the rest
     a click away. Redrawn at every live answer, keeping that choice. */
  var logged = [];
  var openLog = false;

  function log(plays, playing) {
    var box = $('[data-log]');
    box.textContent = '';
    var today = dayOf(new Date());
    plays = plays.filter(function (item) { return dayOf(new Date(item.played_at)) === today; });
    if (playing) plays = [Object.assign({ now: true, played_at: new Date().toISOString() }, playing)].concat(plays);
    $('[data-log-count]').textContent = plays.length ? plural(plays.length - (playing ? 1 : 0), 'play', 'plays') + ' so far' : '';
    if (!plays.length) {
      box.appendChild(el('p', 'log__empty', 'Nothing yet today.'));
      return;
    }
    var list = el('ol', 'timeline');
    var shown = openLog ? plays : plays.slice(0, 10);
    shown.forEach(function (item) { list.appendChild(stop(item)); });
    box.appendChild(list);
    if (plays.length > 10) {
      var more = el('button', 'log__more', openLog ? 'Show fewer' : 'Show all ' + num(plays.length));
      more.type = 'button';
      more.setAttribute('aria-expanded', String(openLog));
      more.addEventListener('click', function () {
        openLog = !openLog;
        log(merged([]), current);
        if (!openLog) box.scrollIntoView({ block: 'nearest' });
      });
      box.appendChild(more);
    }
  }

  /* ---------- Now playing ----------
     From the Worker at data-live (.github/worker/now.js), which asks
     Spotify at most every fifteen seconds. The page asks as often while
     it is in view; between answers the progress runs on its own clock,
     and a scrub or a skip shows at the next answer. */
  var LIVE = page.getAttribute('data-live');
  var tick = null;
  var current = null; // the song playing now, for the log

  function showNow(live, fallback) {
    /* Playing, paused part-way through, or failing both, the last play. */
    var track = live && live.track ? live.track : null;
    var playing = Boolean(track && live.playing);
    var item = track || fallback;
    if (!item) return;
    var now = $('[data-now]');
    $('[data-now-when]').textContent = playing ? 'Playing now' : track ? 'Paused' : 'Last played · ' + ago(item.played_at);
    $('[data-now-name]').textContent = item.name;
    $('[data-now-by]').textContent = item.artists;
    var link = $('[data-now-link]');
    if (spotify(item.url)) link.href = item.url; else link.removeAttribute('href');
    /* The cover at its largest (640px), since it is shown big; a play
       from the Action's file has only the 300px one, and Spotify's
       address for the larger differs by a size code. No cover at all: a
       plain square, never the previous song's. */
    var img = $('[data-now-img]');
    var big = item.cover || (item.image || '').replace('/ab67616d00001e02', '/ab67616d0000b273');
    if (https(big)) {
      if (img.getAttribute('src') !== big) {
        img.onerror = function () { if (item.image && img.getAttribute('src') !== item.image) img.src = item.image; };
        img.src = big;
      }
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
    now.classList.toggle('is-live', playing);

    var progress = $('[data-now-progress]');
    clearInterval(tick);
    progress.hidden = !track;
    if (!track) return;
    /* The progress is as of when the Worker asked Spotify, which can be
       a while before this answer reached the page. */
    var start = (Date.parse(live.at) || Date.now()) - live.progress_ms;
    $('[data-now-len]').textContent = mmss(track.duration_ms);
    var draw = function () {
      var at = playing ? Math.min(Date.now() - start, track.duration_ms) : live.progress_ms;
      $('[data-now-fill]').style.transform = 'scaleX(' + (at / track.duration_ms) + ')';
      $('[data-now-at]').textContent = mmss(at);
    };
    draw();
    if (playing) tick = setInterval(draw, 500);
  }

  /* Spotify only lists a song as played once it has finished, and then
     a few minutes late. So the page keeps its own note of what it has
     seen: the song playing now heads the log, and a song it watched play
     for thirty seconds or more joins the log the moment the next one
     starts, or the moment it starts again, on repeat. When Spotify's own
     record of that play arrives it takes the page's place, rather than
     appearing twice. */
  var answered = false; // whether the Worker has replied yet
  var heard = [];       // plays the page saw finish, newest first
  var watching = null;  // { track, longest, progress, at, playing } for the song playing now

  function merged(recent) {
    var seen = {};
    logged = (recent || []).concat(logged).filter(function (p) {
      if (seen[p.played_at]) return false;
      seen[p.played_at] = true;
      return true;
    });
    /* Each of Spotify's plays stands in for one the page heard at most:
       the same song, within ten minutes, the closest pairs first. So on
       repeat, Spotify's record of one play doesn't take the place of the
       next, which it hasn't listed yet. */
    var pairs = [];
    heard.forEach(function (h, i) {
      logged.forEach(function (p, j) {
        var gap = Math.abs(Date.parse(p.played_at) - Date.parse(h.played_at));
        if (p.url === h.url && gap < 10 * 60000) pairs.push([gap, i, j]);
      });
    });
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    var replaced = {}, used = {};
    pairs.forEach(function (pair) {
      if (replaced[pair[1]] || used[pair[2]]) return;
      replaced[pair[1]] = used[pair[2]] = true;
    });
    return heard.filter(function (h, i) { return !replaced[i]; }).concat(logged)
      .sort(function (a, b) { return Date.parse(b.played_at) - Date.parse(a.played_at); });
  }

  function follow(now) {
    var track = now.track;
    /* When the Worker asked Spotify, which is when the progress is from. */
    var at = Date.parse(now.at) || Date.now();
    var progress = now.progress_ms || 0;
    if (watching) {
      var other = !track || track.url !== watching.track.url;
      /* The same song from the top again, with time enough since it was
         last seen for it to have reached its end, is on repeat: another
         play. A jump back part way through isn't one. */
      var again = !other && progress < watching.progress &&
        watching.progress + (watching.playing ? at - watching.at : 0) >= track.duration_ms - 5000;
      if (other || again) {
        if (watching.longest >= 30000) {
          /* It ended as the song playing now began. */
          var ended = track ? at - progress : Date.now();
          heard.unshift(Object.assign({}, watching.track, { played_at: new Date(ended).toISOString() }));
        }
        watching = null;
      }
    }
    if (track) {
      if (!watching) watching = { track: track, longest: 0 };
      watching.longest = Math.max(watching.longest, progress);
      watching.progress = progress;
      watching.at = at;
      watching.playing = Boolean(now.playing);
    }
  }

  /* While Spotify has told the Worker to stop asking (too many requests,
     or the day's own allowance spent), it says so, and until when; the
     page says so too, above what it last heard. */
  var countdown = null;
  function notice(state) {
    var box = $('[data-notice]');
    clearInterval(countdown);
    if (!state || !state.paused || !state.resumes) { box.hidden = true; return; }
    var resumes = new Date(state.resumes);
    var time = function (d) { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
    var day = dayOf(resumes) === dayOf(new Date()) ? 'today'
      : dayOf(resumes) === dayOf(new Date(Date.now() + 864e5)) ? 'tomorrow'
      : resumes.toLocaleDateString('en-US', { weekday: 'long' });
    $('[data-notice-text]').textContent =
      'Spotify needs a breather. Aniketh’s almost certainly still jamming.';
    $('[data-notice-at]').textContent = time(resumes) + ' ' + day;

    /* The time left, to the second. */
    var left = $('[data-notice-count]');
    var draw = function () {
      var s = Math.max(0, Math.round((resumes - Date.now()) / 1000));
      left.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
      if (!s) clearInterval(countdown);
    };
    draw();
    countdown = setInterval(draw, 1000);
    box.hidden = false;
  }

  /* The file is as of the Action's last run, which can be most of an
     hour old when no one has been looking, and the live answers carry
     only the last ten plays. The Worker keeps every play itself, so the
     ones after the file's last are asked for once, from its storage
     (no call to Spotify), and the log has no hole. */
  function catchUp() {
    var after = data.recent[0].played_at;
    fetch(LIVE.replace(/\/?$/, '/since') + '?after=' + encodeURIComponent(after), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (plays) {
        if (!Array.isArray(plays) || !plays.length) return;
        log(merged(plays), current);
        if (cal) cal.live();
      })
      .catch(function () {});
  }

  function live() {
    if (!LIVE) return;
    var ask = function () {
      if (document.hidden) return;
      fetch(LIVE, { cache: 'no-store' })
        /* A 503 still carries a body saying why, and until when. */
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            notice(body);
            return r.ok ? body : Promise.reject(r.status);
          });
        })
        .then(function (now) {
          answered = true;
          follow(now);
          current = now.playing ? now.track : null;
          var plays = merged(now.recent);
          log(plays, current);
          showNow(now, plays[0]);
          if (cal) cal.live();
        })
        .catch(function () {});
    };
    ask();
    catchUp();
    /* The Worker only asks Spotify every fifteen seconds; asking it any
       more often than that would only fetch the same answer. */
    setInterval(ask, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
  }

  /* ---------- Start ---------- */

  /* The Action writes music.json every fifteen minutes. A page left open
     reads it again every five while it is in view, so the figures, the
     calendar and the log catch up without a reload. A file no newer than
     the one shown changes nothing. */
  var REREAD = 5 * 60000;
  var readAt = 0;

  function reread() {
    if (document.hidden || Date.now() - readAt < REREAD) return;
    readAt = Date.now();
    fetch(src, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (file) {
        if (!file || !file.recent || !file.recent.length) return;
        if (file.recent[0].played_at === data.recent[0].played_at && file.today === data.today) return;
        data = file;
        log(merged(file.recent), current);
        showRange(range);
        if (cal) cal.draw();
      })
      .catch(function () {});
  }

  function render(file) {
    if (!file || !file.recent || !file.recent.length) return;
    data = file;
    $('[data-music-empty]').hidden = true;
    $('[data-music-body]').hidden = false;

    /* The live answer comes first; only if it hasn't arrived after a few
       seconds is the last play the Action saw shown instead, since that
       can be a quarter of an hour old. */
    setTimeout(function () { if (!answered) showNow(null, merged([])[0]); }, 3000);

    Array.prototype.forEach.call(page.querySelectorAll('[data-range]'), function (b) {
      b.addEventListener('click', function () { showRange(b.getAttribute('data-range')); });
    });
    /* Before the calendar, whose today is drawn from the same plays. */
    logged = data.recent;
    showRange('month');
    calendar();

    log(logged);
    live();

    readAt = Date.now();
    setInterval(reread, 60000);
    document.addEventListener('visibilitychange', reread);
  }

  fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(render)
    .catch(function () {});
})();
