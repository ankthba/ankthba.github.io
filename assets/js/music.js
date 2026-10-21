/* The music page, drawn from music.json, which the Action in
   .github/workflows/listening.yml writes every fifteen minutes from the
   private log of plays, and kept live by the Worker at data-live.

   Four parts, top to bottom: the song playing now; a calendar of every
   day, each by its top album's cover, with the day picked summed up and
   its whole log of every song a click away; the most listened to this
   week or this month; and today's log. Links must go to Spotify and
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
  var spotify = function (url) { return /^https:\/\/open\.spotify\.com\//.test(url || '') ? url : null; };
  var https = function (url) { return /^https:\/\//.test(url || '') || (local && /^\//.test(url || '')) ? url : null; };
  var $ = function (sel) { return page.querySelector(sel); };
  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
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
  /* A day's top songs: a list now, a single song in older files. */
  var topsOf = function (info) { return Array.isArray(info.top) ? info.top : info.top ? [info.top] : []; };

  /* ---------- Rows ----------
     One hairline row for a song or an artist: what leads it (a rank or
     a time), the cover, the name and who by, and what closes it (a count,
     or for a standout what it stands out for). */
  function row(item, lead, tail) {
    var li = el('li');
    var href = spotify(item.url);
    var r = el(href ? 'a' : 'div', 'play');
    if (href) { r.href = href; r.target = '_blank'; r.rel = 'noopener'; }
    if (lead != null) r.appendChild(lead);
    var art = el('img', 'play__art');
    art.alt = '';
    art.loading = 'lazy';
    if (https(item.image)) art.src = item.image;
    r.appendChild(art);
    var text = el('span', 'play__text');
    text.appendChild(el('span', 'play__name', item.name));
    if (item.artists) text.appendChild(el('span', 'play__by', item.artists));
    r.appendChild(text);
    if (tail) r.appendChild(tail);
    li.appendChild(r);
    return li;
  }
  var rank = function (i) { return el('span', 'play__n', pad(i + 1)); };

  /* A play in a log, led by its time (or Now, for the song playing). */
  function logRow(item) {
    var time = el('time', 'play__n', item.now ? 'Now'
      : new Date(item.played_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }));
    time.dateTime = item.played_at;
    var li = row(item, time);
    if (item.now) li.firstChild.classList.add('play--now');
    return li;
  }
  var count = function (item) { return el('span', 'play__count', plural(item.plays, 'play', 'plays')); };

  function ranked(list, items, max) {
    list.textContent = '';
    (items || []).slice(0, max).forEach(function (item, i) {
      list.appendChild(row(item, rank(i), count(item)));
    });
  }

  /* ---------- Most listened to ----------
     This week or this month: four figures, the top ten songs, the top
     five artists, and the standouts. (No all time: tracking only began
     on September 29, 2026.) */
  var data = null;
  var range = 'week'; // the range shown, kept when the file is read again

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

  function figures(r) {
    var box = $('[data-figures]');
    box.textContent = '';
    var hours = Math.round(r.minutes / 60);
    /* Each against the same stretch before it, when there was one. */
    var b = r.before;
    var then = range === 'week' ? 'the week before' : 'this time last month';
    var versus = function (now, was) {
      if (!b || now == null || !was) return null;
      var d = Math.round((100 * (now - was)) / was);
      return d > 0 ? d + '% more than ' + then : d < 0 ? -d + '% fewer than ' + then : 'The same as ' + then;
    };
    [
      [num(r.plays), r.plays === 1 ? 'play' : 'plays', versus(r.plays, b && b.plays)],
      r.minutes < 60 ? [num(r.minutes), r.minutes === 1 ? 'minute' : 'minutes', versus(r.minutes, b && b.minutes)]
        : [num(hours), hours === 1 ? 'hour' : 'hours', versus(r.minutes, b && b.minutes)],
      r.tracks != null ? [num(r.tracks), r.tracks === 1 ? 'song' : 'songs', versus(r.tracks, b && b.tracks)] : null,
      r.artists != null ? [num(r.artists), r.artists === 1 ? 'artist' : 'artists', versus(r.artists, b && b.artists)] : null
    ].filter(Boolean).forEach(function (f) {
      var item = el('div', 'figures__item');
      item.appendChild(el('dt', 'figures__t', f[1]));
      item.appendChild(el('dd', 'figures__v', f[0]));
      if (f[2]) item.appendChild(el('dd', 'figures__d', f[2].charAt(0).toUpperCase() + f[2].slice(1) + '.'));
      box.appendChild(item);
    });
  }

  /* The top songs played most more than the time before: from how
     many plays, or new to the top listened if they weren't in it then. */
  function rising(items) {
    var list = $('[data-rising]');
    list.textContent = '';
    items.forEach(function (item) {
      var tail = el('span', 'play__fact');
      var risen = 'wasTop' in item ? item.wasTop : item.before > 0;
      tail.appendChild(el('span', 'play__what', risen ? 'from ' + num(item.before) : 'new to the top listened'));
      tail.appendChild(el('span', 'play__count', plural(item.plays, 'play', 'plays')));
      list.appendChild(row(item, null, tail));
    });
    $('[data-rising-label]').hidden = list.hidden = !items.length;
  }

  function standouts(stats) {
    var list = $('[data-standouts]');
    list.textContent = '';
    var fact = function (what, value) {
      var f = el('span', 'play__fact');
      f.appendChild(el('span', 'play__what', what));
      f.appendChild(el('span', 'play__count', value));
      return f;
    };
    var oldest = stats && stats.released && stats.released.oldest;
    var playlist = stats && stats.topPlaylist;
    var fans = function (n) {
      return (n >= 1e6 ? (Math.round(n / 1e5) / 10) + ' million' : num(n)) + (n === 1 ? ' fan' : ' fans');
    };
    [
      stats && stats.topAlbum && [stats.topAlbum, 'Top album', plural(stats.topAlbum.plays, 'play', 'plays')],
      playlist && [playlist, 'Top playlist', plural(playlist.plays, 'play', 'plays')],
      stats && stats.onRepeat && [stats.onRepeat, 'On repeat', stats.onRepeat.times + ' in a row'],
      stats && stats.longest && [stats.longest, 'Longest song', mmss(stats.longest.duration_ms)],
      stats && stats.deepCut && [stats.deepCut, 'Deepest cut', stats.deepCut.popularity + ' / 100'],
      oldest && [oldest, 'Oldest song', String(oldest.year)],
      stats && stats.released && stats.released.newest && [stats.released.newest, 'Newest song',
        'out ' + fmtDay(stats.released.newest.released, { month: 'long', day: 'numeric', year: 'numeric' })],
      stats && stats.binge && [stats.binge, 'Most in a row', stats.binge.times + ' songs', true],
      stats && stats.biggest && [stats.biggest, 'Most followed artist', fans(stats.biggest.fans), true],
      stats && stats.nichest && [stats.nichest, 'Least known artist', fans(stats.nichest.fans), true]
    ].filter(Boolean).forEach(function (s) {
      var li = row(s[0], null, fact(s[1], s[2]));
      if (s[3]) li.firstChild.classList.add('play--artist');
      list.appendChild(li);
    });
    $('[data-standouts-label]').hidden = list.hidden = !list.children.length;
  }

  /* ---------- Listening habits ----------
     The same week or month: its plays by the hour and by the day of the
     week, a few figures for how the listening went, and what sort of
     music it was (genres, when it came out, how well known its artists
     are). Every share is of the plays whose details are known. */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var hourName = function (h) {
    return h === 0 ? 'midnight' : h === 12 ? 'noon' : (h % 12) + (h < 12 ? ' am' : ' pm');
  };
  var pct = function (n, of) {
    var p = of ? (100 * n) / of : 0;
    return p > 0 && p < 1 ? 'under 1%' : Math.round(p) + '%';
  };

  /* A column for each hour or day, as tall as its share of the busiest,
     the busiest of them in ink and the rest quieter. The note under the
     columns sums them up, and says what a column is while it is under
     the pointer. */
  function columns(box, note, counts, o) {
    box.textContent = '';
    var max = Math.max.apply(null, counts) || 1;
    var plot = el('div', 'cols__plot');
    var axis = el('div', 'cols__axis');
    plot.setAttribute('role', 'img');
    plot.setAttribute('aria-label', o.sum);
    axis.setAttribute('aria-hidden', 'true');
    counts.forEach(function (n, i) {
      var col = el('span', 'cols__col');
      if (o.lit(i)) col.classList.add('cols__col--lit');
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

  /* Rows of a name, its share, and a bar for it out of the whole. */
  function shares(list, rows) {
    list.textContent = '';
    rows.forEach(function (r) {
      var li = el('li', 'share');
      li.appendChild(el('span', 'share__name', r[0]));
      li.appendChild(el('span', 'share__v', r[1]));
      var bar = el('span', 'share__bar');
      var fill = el('i');
      fill.style.setProperty('--v', String(Math.min(1, r[2])));
      bar.appendChild(fill);
      li.appendChild(bar);
      list.appendChild(li);
    });
    list.closest('.habit').hidden = !rows.length;
  }

  function habits(r) {
    var s = r.stats;
    var box = $('[data-habits]');
    box.hidden = !s || !s.hours;
    if (box.hidden) return;
    var month = range === 'month';

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

    var span = dayList.length;
    var group = function (key) {
      var box = $('[data-facts="' + key + '"]');
      box.textContent = '';
      return function (value, term, more) {
        if (value == null) return;
        var item = el('div', 'fact');
        item.appendChild(el('dt', 'fact__t', term));
        item.appendChild(el('dd', 'fact__v', value));
        if (more) item.appendChild(el('dd', 'fact__more', more));
        box.appendChild(item);
      };
    };
    var clockAt = function (m) {
      m = ((m % 1440) + 1440) % 1440;
      var h = Math.floor(m / 60), mm = m % 60;
      if (!mm && h % 12 === 0) return h ? 'noon' : 'midnight';
      return (h % 12 || 12) + ':' + pad(mm) + (h < 12 ? ' am' : ' pm');
    };
    var late = s.hours.slice(0, 5).reduce(function (a, b) { return a + b; }, 0);

    var rhythm = group('rhythm');
    rhythm(num(s.sessions), s.sessions === 1 ? 'listening session' : 'listening sessions',
      s.sessions > 1 && s.longestSession ? 'The longest, ' + duration(s.longestSession.minutes) + '.' : '');
    rhythm(s.days + ' of ' + span, 'days with music',
      s.streak > 1 && s.streak < s.days ? s.streak + ' in a row at most.' : '');
    if (s.clock && s.clock.start != null) {
      rhythm(clockAt(s.clock.start), 'the music usually starts', 'On a day with music.');
      rhythm(clockAt(s.clock.end), 'and usually stops', s.clock.end > 1440 ? 'Past midnight, that is.' : '');
    }
    rhythm(duration(Math.round(r.minutes / Math.max(1, s.days))).replace(/ (hours?|minutes?)/g, function (w) {
      return w === ' hour' || w === ' hours' ? ' h' : ' min';
    }), 'a day of music', 'On the days with any.');
    rhythm(pct(late, s.plays), 'after midnight', 'Plays from 12 to 5 am.');

    var how = group('habits');
    how(num(s.newTracks), 'songs heard for the first time', 'And ' + plural(s.newArtists, 'artist', 'artists') + '.');
    how(pct(s.plays - s.tracks, s.plays), 'replays', 'Plays of a song already heard ' + (month ? 'this month' : 'this week') + '.');
    if (s.once != null) how(num(s.once), s.once === 1 ? 'song played just once' : 'songs played just once', 'Of ' + plural(s.tracks, 'song', 'songs') + '.');
    how(pct(s.cutShort, s.plays), 'skipped part way', num(s.cutShort) + ' of ' + plural(s.plays, 'play', 'plays') + '.');
    if (s.topArtists && s.topArtists.length) {
      var five = s.topArtists.slice(0, 5).reduce(function (a, x) { return a + x.plays; }, 0);
      how(pct(five, s.plays), 'from the top five artists', 'Of ' + plural(s.artists, 'artist', 'artists') + ' in all.');
    }
    how(num(s.albums), s.albums === 1 ? 'album' : 'albums', s.newAlbums ? num(s.newAlbums) + ' heard for the first time.' : '');

    var music = group('music');
    if (s.averageMs) music(mmss(s.averageMs), 'average song length');
    if (s.released && s.released.age != null) music(s.released.age + (s.released.age === 1 ? ' year' : ' years'), 'average age of a song', 'When it was played.');
    if (s.features != null) music(pct(s.features, s.plays), 'with a featured artist');
    if (s.explicit) music(pct(s.explicit.plays, s.explicit.known), 'explicit');
    if (s.variety != null) music(String(s.variety), 'variety, out of 100', 'How spread the plays are across artists.');
    if (s.popularity != null) music(String(s.popularity), 'popularity, out of 100', 'On average, by Deezer’s chart rank.');

    var g = s.genres;
    shares($('[data-genres]'), g ? g.top.map(function (x) {
      return [x.name, pct(x.plays, g.known), x.plays / g.known];
    }) : []);

    var rel = s.released;
    shares($('[data-decades]'), rel ? Object.keys(rel.decades).sort().reverse().map(function (d) {
      return ['The ' + d, pct(rel.decades[d], rel.known), rel.decades[d] / rel.known];
    }) : []);
    $('[data-decades-note]').textContent = rel ? 'Out in ' + rel.average + ' on average' +
      (rel.fresh ? ', and ' + pct(rel.fresh, rel.known) + ' less than a month old when played.' : '.') : '';

    var reach = s.reach;
    shares($('[data-reach]'), reach ? [
      ['Mainstream', reach.mainstream], ['In between', reach.middle], ['Niche', reach.niche]
    ].map(function (x) { return [x[0], pct(x[1], reach.known), x[1] / reach.known]; }) : []);

    var c = s.countries;
    shares($('[data-countries]'), c ? c.top.map(function (x) {
      return [region(x.code), pct(x.plays, c.known), x.plays / c.known];
    }) : []);
    $('[data-countries-note]').textContent = c && c.count > c.top.length
      ? plural(c.count, 'country', 'countries') + ' in all.' : '';

    var k = s.kinds;
    shares($('[data-kinds]'), k ? [
      ['Solo artists', k.person], ['Bands and groups', k.group], ['Others', k.other]
    ].filter(function (x) { return x[1]; }).map(function (x) { return [x[0], pct(x[1], k.known), x[1] / k.known]; }) : []);

    var f = s.from;
    shares($('[data-from]'), f ? [
      ['Playlists', f.playlist], ['Albums', f.album], ['Artists’ pages', f.artist], ['Liked songs', f.liked], ['Anywhere else', f.other]
    ].filter(function (x) { return x[1]; }).map(function (x) { return [x[0], pct(x[1], s.plays), x[1] / s.plays]; }) : []);
  }

  /* A country's name from its code, in English. */
  var regions = window.Intl && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  var region = function (code) {
    try { return (regions && regions.of(code)) || code; } catch (e) { return code; }
  };

  /* A row for each day and a cell for each hour, as dark as its share of
     the busiest hour; the note says what a cell is under the pointer. */
  function heat(box, note, rows) {
    box.textContent = '';
    var max = 0;
    rows.forEach(function (r) { r.hours.forEach(function (n) { max = Math.max(max, n); }); });
    var sum = 'Darker is more plays; the darkest hour had ' + plural(max, 'play', 'plays') + '.';
    var grid = el('div', 'heat__grid');
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', 'Plays by hour on each day. ' + sum);
    rows.forEach(function (r) {
      grid.appendChild(el('span', 'heat__day', r.label));
      r.hours.forEach(function (n, h) {
        var cell = el('span', 'heat__cell' + (n ? '' : ' heat__cell--none'));
        cell.style.setProperty('--v', String(max ? 0.12 + 0.88 * (n / max) : 0));
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

  function showRange(which) {
    var r = rangeOf(which);
    if (!r) return;
    range = which;
    Array.prototype.forEach.call(page.querySelectorAll('[data-range]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-range') === which));
    });
    figures(r);
    ranked($('[data-top-tracks]'), r.topTracks, 10);
    ranked($('[data-top-artists]'), r.topArtists, 5);
    standouts(r.stats);
    rising(r.rising);
    habits(r);
  }

  /* ---------- Listening calendar ----------
     A month at a time, any month since tracking began, each day by the
     cover of its top album (its top song's, in older files with none).
     The day picked is summed up under the grid: its plays and time, its
     top songs, and its whole listening log, every song from 12 AM to
     11:59 PM, kept closed until it is asked for. Today's is kept live,
     with the same plays as today's log at the foot of the page. */
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
    var top = Object.keys(tally).map(function (k) { return tally[k]; })
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
    var sign = null; // today's plays as the note last showed them

    function shift(ym, n) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }

    function draw() {
      today = dayOf(new Date());
      /* the month's name, and its year apart, to be set quieter */
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
      dayNote();
    }

    function cell(day) {
      var info = days()[day];
      var label = fmtDay(day, { month: 'long', day: 'numeric' });
      var c = el('button', 'cal__cell');
      c.type = 'button';
      c.appendChild(el('span', 'cal__n', String(+day.slice(8))));
      if (day < data.since || day > today) {
        c.disabled = true;
        c.classList.add('cal__cell--off');
        c.setAttribute('aria-label', label + (day < data.since ? ', before tracking began' : ''));
        return c;
      }
      var cover = info && (info.topAlbum || topsOf(info)[0]);
      if (cover && https(cover.image)) {
        var img = el('img', 'cal__art');
        img.alt = '';
        img.loading = 'lazy';
        img.src = cover.image;
        c.insertBefore(img, c.firstChild);
        c.classList.add('cal__cell--art');
      }
      c.setAttribute('aria-label', label + ': ' + (info
        ? plural(info.plays, 'play', 'plays') + ', ' + duration(info.minutes) + (cover ? ', top album ' + cover.name : '')
        : 'nothing played'));
      if (day === today) c.classList.add('cal__cell--today');
      c.setAttribute('aria-pressed', String(day === picked));
      c.addEventListener('click', function () { picked = day; draw(); });
      return c;
    }

    function dayNote() {
      var note = $('[data-cal-day]');
      note.textContent = '';
      var info = days()[picked];
      if (picked === today) {
        var plays = todaysPlays();
        info = liveDay(info, plays);
        sign = signOf(plays);
      }
      note.appendChild(el('h3', 'cal__date', (picked === today ? 'Today, ' : '') +
        fmtDay(picked, { weekday: 'long', month: 'long', day: 'numeric' })));
      if (!info || !info.plays) {
        note.appendChild(el('p', 'cal__line', picked === today ? 'Nothing yet today.' : 'Nothing played.'));
        return;
      }
      /* and, from the file, how the day went: its sessions, what was
         new, and what it mostly was */
      var more = [];
      if (info.sessions) {
        more.push(plural(info.sessions, 'session', 'sessions') + (info.sessions > 1 && info.longestSession
          ? ', the longest ' + duration(info.longestSession.minutes) : ''));
      }
      if (info.newTracks) more.push(plural(info.newTracks, 'song', 'songs') + ' heard for the first time');
      if (info.genres && info.genres.top && info.genres.top.length) more.push('mostly ' + info.genres.top[0].name);
      more = more.join('; ');
      note.appendChild(el('p', 'cal__line', plural(info.plays, 'play', 'plays') + ' and ' +
        duration(info.minutes) + ' of listening, across ' + plural(info.tracks, 'song', 'songs') +
        ' and ' + plural(info.artists, 'artist', 'artists') + '.' +
        (more ? ' ' + more.charAt(0).toUpperCase() + more.slice(1) + '.' : '')));
      var tops = topsOf(info);
      if (tops.length) {
        var list = el('ol', 'plays');
        tops.slice(0, 5).forEach(function (item, i) { list.appendChild(row(item, rank(i), count(item))); });
        note.appendChild(list);
      }
      dayLog(note, picked);
    }

    /* The day's whole log, from the file the Action writes for each day,
       fetched only when it is opened, and once. Today's file runs to the
       Action's last run, and the plays since are added from the page's
       own. Once opened it stays open from day to day, until it is closed. */
    var logOpen = false;
    function dayLog(note, day) {
      var toggle = el('button', 'daylog__toggle');
      toggle.type = 'button';
      toggle.appendChild(el('span', 'daylog__name', 'Every song played that day'));
      toggle.appendChild(el('span', 'daylog__sign'));
      var body = el('div', 'daylog__body');
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
        body.appendChild(el('p', 'cal__line', 'Loading…'));
        fetch(base + 'days/' + day + '.json', { cache: 'no-cache' })
          /* Today has no file until the Action has logged a play from it. */
          .then(function (r) { return r.ok ? r.json() : r.status === 404 && day === today ? [] : Promise.reject(r.status); })
          .then(function (plays) { fill(dayFiles[day] = plays); })
          .catch(function () {
            body.textContent = '';
            body.appendChild(el('p', 'cal__line', 'That day’s log couldn’t be loaded. Close and open it again to retry.'));
          });
      }
      function fill(plays) {
        loaded = true;
        if (day === today) {
          var last = plays.length ? Date.parse(plays[plays.length - 1].played_at) : 0;
          plays = plays.concat(todaysPlays().filter(function (p) { return Date.parse(p.played_at) > last; }));
        }
        body.textContent = '';
        body.appendChild(el('p', 'daylog__span', '12 AM to 11:59 PM · ' + plural(plays.length, 'play', 'plays')));
        var list = el('ol', 'plays plays--log');
        plays.forEach(function (item) { list.appendChild(logRow(item)); });
        body.appendChild(list);
      }
      toggle.addEventListener('click', function () { set(toggle.getAttribute('aria-expanded') !== 'true'); });
      note.appendChild(toggle);
      note.appendChild(body);
      set(logOpen);
    }

    $('[data-cal-prev]').addEventListener('click', function () { month = shift(month, -1); draw(); });
    $('[data-cal-next]').addEventListener('click', function () { month = shift(month, 1); draw(); });
    box.hidden = false;
    draw();

    cal = {
      draw: draw,
      /* At each live answer, today's note again, if today is the day
         picked and its plays have changed. The note is read out as it
         changes, so it isn't redrawn for nothing. */
      live: function () {
        if (picked === today && signOf(todaysPlays()) !== sign) dayNote();
      }
    };
  }

  /* ---------- Today's listening log ----------
     Every play since 12 am today in Charlottesville, newest first, with
     its time; the song playing now heads it. The first ten, and the rest
     a click away. Redrawn at every live answer, keeping that choice. */
  var logged = [];
  var openLog = false;

  function log(plays, playing) {
    var box = $('[data-log]');
    box.textContent = '';
    var today = dayOf(new Date());
    plays = plays.filter(function (item) { return dayOf(new Date(item.played_at)) === today; });
    if (playing) plays = [Object.assign({ now: true, played_at: new Date().toISOString() }, playing)].concat(plays);
    if (!plays.length) {
      box.appendChild(el('p', 'log__empty', 'Nothing yet today.'));
      return;
    }
    var list = el('ol', 'plays plays--log');
    var shown = openLog ? plays : plays.slice(0, 10);
    shown.forEach(function (item) { list.appendChild(logRow(item)); });
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
     it is in view; between answers the progress bar runs on its own
     clock, and a scrub or a skip shows at the next answer. */
  var LIVE = page.getAttribute('data-live');
  var tick = null;
  var current = null; // the song playing now, for the log

  function showNow(live, fallback) {
    /* Playing, paused part-way through, or failing both, the last play. */
    var track = live && live.track ? live.track : null;
    var playing = Boolean(track && live.playing);
    var item = track || fallback;
    if (!item) return;
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
    $('[data-now]').classList.toggle('now--live', playing);

    var bar = $('[data-now-bar]');
    var time = $('[data-now-time]');
    clearInterval(tick);
    bar.hidden = time.hidden = !track;
    if (!track) return;
    /* The progress is as of when the Worker asked Spotify, which can be
       a while before this answer reached the page. */
    var start = (Date.parse(live.at) || Date.now()) - live.progress_ms;
    var draw = function () {
      var at = playing ? Math.min(Date.now() - start, track.duration_ms) : live.progress_ms;
      $('[data-now-fill]').style.transform = 'scaleX(' + (at / track.duration_ms) + ')';
      time.textContent = mmss(at) + ' / ' + mmss(track.duration_ms);
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
    showRange('week');
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
