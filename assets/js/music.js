/* The music page, drawn from music.json, which the Action in
   .github/workflows/listening.yml writes every fifteen minutes from the
   private log of plays. Links must go to Spotify and pictures must be
   https, whatever the file says. */

'use strict';

(function () {
  var page = document.querySelector('[data-music]');
  if (!page || !window.fetch) return;

  var src = page.getAttribute('data-src');
  /* A local preview can point it at a sample: ?music=/path.json */
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var override = new URLSearchParams(location.search).get('music');
  if (local && override && override.charAt(0) === '/') src = override;
  /* Each day's log sits beside music.json, in days/. */
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
  var plural = function (n, one, many) { return n.toLocaleString('en-US') + ' ' + (n === 1 ? one : many); };

  var dayOf = function (date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };

  function ago(iso) {
    var mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return plural(mins, 'minute', 'minutes') + ' ago';
    var hours = Math.round(mins / 60);
    if (hours < 24) return plural(hours, 'hour', 'hours') + ' ago';
    return plural(Math.round(hours / 24), 'day', 'days') + ' ago';
  }



  /* A ranked list, in the same rows as the home page. */
  function fill(list, items, opts) {
    list.textContent = '';
    items.forEach(function (item, i) {
      var li = el('li');
      var href = spotify(item.url);
      var row = el(href ? 'a' : 'div', 'play');
      if (href) { row.href = href; row.target = '_blank'; row.rel = 'noopener'; }
      row.appendChild(el('span', 'play__n mono', opts.numbered === false ? '' : (i < 9 ? '0' : '') + (i + 1)));
      var art = el('img', 'play__art');
      art.alt = '';
      art.loading = 'lazy';
      if (https(item.image)) art.src = item.image;
      row.appendChild(art);
      var text = el('span', 'play__text');
      text.appendChild(el('span', 'play__name', item.name));
      if (item.artists) text.appendChild(el('span', 'play__by', item.artists));
      row.appendChild(text);
      row.appendChild(el('span', 'play__count mono', opts.count(item)));
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function render(data) {
    if (!data || !data.recent || !data.recent.length) return;
    $('[data-music-empty]').hidden = true;
    $('[data-music-body]').hidden = false;

    /* The live answer comes first; only if it hasn't arrived after a few
       seconds is the last play the Action saw shown instead, since that
       can be a quarter of an hour old. */
    setTimeout(function () { if (!answered) showNow(null, data.recent[0]); }, 3000);

    /* Most listened to right now: the last seven days. */
    var count = function (item) { return plural(item.plays, 'play', 'plays'); };
    fill($('[data-top-tracks]'), data.ranges.week.tracks, { count: count });
    fill($('[data-top-artists]'), data.ranges.week.artists, { count: count });

    calendar(data);

    logged = data.recent;
    log(logged);
    live();
  }

  /* The listening calendar: a month at a time, any month, each day
     since tracking began shown by the cover of its top album (the most
     plays across its songs, so one song played over and over can still
     carry its album), the cover of its top song, or the picture of its
     top artist, whichever is chosen above the grid, and the day picked
     out below it in full. The days come from music.json's calendar,
     written each time the Action runs. */
  var noonOf = function (day) { return new Date(day + 'T12:00:00Z'); };
  var fmtDay = function (day, opts) {
    return noonOf(day).toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, opts));
  };
  var duration = function (mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return plural(m, 'minute', 'minutes');
    return plural(h, 'hour', 'hours') + (m ? ' ' + plural(m, 'minute', 'minutes') : '');
  };
  var clock = function (iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  };
  var hourName = function (h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  /* A day's top songs: a list now, a single song in older files. */
  var topsOf = function (info) { return Array.isArray(info.top) ? info.top : info.top ? [info.top] : []; };
  /* A day's picture, by what is chosen: its top album's cover (or its
     top song's, in older files with no album), its top song's cover,
     or its top artist's picture. */
  var BY = {
    album: { of: function (info) { return info.topAlbum || topsOf(info)[0]; },
             says: function (info) { return info.topAlbum ? 'top album' : 'top song'; } },
    song: { of: function (info) { return topsOf(info)[0]; },
            says: function () { return 'top song'; } },
    artist: { of: function (info) { return (info.topArtists || [])[0]; },
              says: function () { return 'top artist'; } }
  };
  var playCount = function (item) { return plural(item.plays, 'play', 'plays'); };

  function calendar(data) {
    var box = $('[data-cal]');
    var days = data.calendar || {};
    var since = data.since;
    if (!box || !since) return;
    var today = dayOf(new Date());

    var began = 'Tracking began on ' +
      fmtDay(since, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
      '. Nothing before then is counted.';

    /* Above the grid, the month on show: so far for this one, in full
       for one that's over, with the note on when tracking began on its
       first month and before. */
    function summary() {
      var name = fmtDay(month + '-01', { month: 'long' });
      var current = month === today.slice(0, 7);
      var m = (data.months || {})[month];
      var line;
      if (month > today.slice(0, 7)) line = name + ' hasn\u2019t happened yet.';
      else if (month < since.slice(0, 7)) line = 'Nothing counted in ' + name + '.';
      else if (!m) line = current ? 'Nothing yet this month.' : 'Nothing played in ' + name + '.';
      else {
        line = (current ? name + ' so far: ' : 'In ' + name + ': ') +
          plural(m.plays, 'play', 'plays') + ' and ' + duration(m.minutes) + ' of listening, across ' +
          plural(m.tracks, 'song', 'songs') + ' and ' + plural(m.artists, 'artist', 'artists') + '.';
      }
      var note = $('[data-cal-since]');
      note.textContent = began;
      note.hidden = month > since.slice(0, 7);
      $('[data-cal-totals]').textContent = line;
    }

    /* Always today, in this month, even before its first play. */
    var picked = today;
    var month = today.slice(0, 7);

    /* Album, song or artist: the last choice made in this browser, if
       it can remember one. */
    var by = 'album';
    try { if (BY[localStorage.getItem('cal-by')]) by = localStorage.getItem('cal-by'); } catch (e) {}
    var options = box.querySelectorAll('[data-cal-by]');
    function choose(next) {
      by = next;
      Array.prototype.forEach.call(options, function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-cal-by') === by));
      });
    }
    Array.prototype.forEach.call(options, function (b) {
      b.addEventListener('click', function () {
        choose(b.getAttribute('data-cal-by'));
        try { localStorage.setItem('cal-by', by); } catch (e) {}
        draw();
      });
    });
    choose(by);

    function shift(ym, n) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }

    function draw() {
      $('[data-cal-month]').textContent = fmtDay(month + '-01', { month: 'long', year: 'numeric' });
      summary();
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
      for (var d = 1; d <= length; d++) {
        var day = month + '-' + pad(d);
        var info = days[day];
        var label = fmtDay(day, { month: 'long', day: 'numeric' });
        var cell = el('button', 'cal__cell');
        cell.type = 'button';
        if (day < since || day > today) {
          cell.disabled = true;
          cell.classList.add('cal__cell--off');
          cell.setAttribute('aria-label', label + (day < since ? ', before tracking began' : ''));
        } else {
          var cover = info && BY[by].of(info);
          if (cover && https(cover.image)) {
            var img = el('img', 'cal__art');
            img.alt = '';
            img.loading = 'lazy';
            img.src = cover.image;
            cell.appendChild(img);
            cell.classList.add('cal__cell--art');
          }
          cell.setAttribute('aria-label', label + ': ' + (info
            ? plural(info.plays, 'play', 'plays') + ', ' + duration(info.minutes) + (cover ? ', ' + BY[by].says(info) + ' ' + cover.name : '')
            : 'nothing played'));
          if (day === today) cell.classList.add('cal__cell--today');
          cell.setAttribute('aria-pressed', day === picked ? 'true' : 'false');
          /* Picking a day while the month is on show turns to the day. */
          cell.addEventListener('click', (function (day) {
            return function () {
              picked = day;
              if (span === 'month') {
                spanTo('day');
                try { localStorage.setItem('cal-span', span); } catch (e) {}
              }
              draw();
            };
          })(day));
        }
        cell.appendChild(el('span', 'cal__n', String(d)));
        grid.appendChild(cell);
      }
      render();
    }

    /* Below the grid: the stats for the day picked, its week (its row of
       the grid, Sunday to Saturday) or the month on show, the last of
       these chosen in this browser. A line sums it up; the rest sits in
       sections that open one at a time, so it can be read a part at a
       time. Anything an older file doesn't have is left out. */
    var SPANS = { day: 1, week: 1, month: 1 };
    var span = 'day';
    try { if (SPANS[localStorage.getItem('cal-span')]) span = localStorage.getItem('cal-span'); } catch (e) {}
    var spans = box.querySelectorAll('[data-cal-span]');
    function spanTo(next) {
      span = next;
      Array.prototype.forEach.call(spans, function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-cal-span') === span));
      });
    }
    Array.prototype.forEach.call(spans, function (b) {
      b.addEventListener('click', function () {
        spanTo(b.getAttribute('data-cal-span'));
        try { localStorage.setItem('cal-span', span); } catch (e) {}
        render();
      });
    });
    spanTo(span);

    var num = function (n) { return n == null ? null : n.toLocaleString('en-US'); };
    var pct = function (n, of) { return n == null || !of ? null : Math.round(100 * n / of) + '%'; };
    var nth = function (n) {
      var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    var addDays = function (day, n) {
      var d = noonOf(day);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    /* A run of numbers under a label, three across. */
    function stats(panel, title, pairs) {
      var list = el('dl', 'cal__stats');
      pairs.forEach(function (pair) {
        if (pair[1] == null) return;
        var row = el('div');
        row.appendChild(el('dt', null, pair[0]));
        row.appendChild(el('dd', null, pair[1]));
        list.appendChild(row);
      });
      if (!list.children.length) return;
      if (title) panel.appendChild(el('p', 'music__label', title));
      panel.appendChild(list);
    }

    /* Shares as bars: a name, a bar, a percentage. */
    function shares(panel, title, rows, of) {
      if (!rows.length || !of) return;
      panel.appendChild(el('p', 'music__label', title));
      var list = el('ol', 'cal__shares');
      var most = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1;
      rows.forEach(function (r) {
        var li = el('li');
        li.appendChild(el('span', 'cal__share-name', r[0]));
        var track = el('span', 'cal__share-bar');
        track.setAttribute('aria-hidden', 'true');
        var bar = el('i');
        bar.style.width = (100 * r[1] / most) + '%';
        track.appendChild(bar);
        li.appendChild(track);
        li.appendChild(el('span', 'cal__share-n mono', pct(r[1], of)));
        list.appendChild(li);
      });
      panel.appendChild(list);
    }

    /* A ranked list, or a single song, artist, album or playlist. */
    function ranked(panel, title, items, count, artist) {
      if (!items || !items.length) return;
      panel.appendChild(el('p', 'music__label', title));
      var list = el('ol', artist ? 'plays plays--artists' : 'plays');
      fill(list, items, { numbered: items.length > 1, count: count });
      panel.appendChild(list);
    }

    /* A section: a row that opens and closes what's under it, left out
       if there's nothing in it. One opened stays open from one day, week
       or month to the next, so the same part can be read across them.
       A lazy one is built the first time it is opened instead. */
    var opened = {};
    function section(panel, name, build, lazy) {
      var body = el('div', 'cal__section-body');
      if (!lazy) build(body);
      if (!lazy && !body.children.length) return;
      var id = 'cal-section-' + name.toLowerCase().replace(/[^a-z]+/g, '-');
      body.id = id;
      var head = el('button', 'cal__section');
      head.type = 'button';
      head.setAttribute('aria-controls', id);
      head.appendChild(el('span', 'cal__section-name', name));
      var act = el('span', 'cal__section-act');
      head.appendChild(act);
      var filled = !lazy;
      var set = function (open) {
        opened[name] = open;
        body.hidden = !open;
        head.setAttribute('aria-expanded', String(open));
        act.textContent = open ? 'Hide' : 'Show';
        if (open && !filled) {
          filled = true;
          /* A lazy one that fails can be tried again by reopening it. */
          var done = build(body);
          if (done && done.catch) done.catch(function () { filled = false; });
        }
      };
      head.addEventListener('click', function () { set(body.hidden); });
      panel.appendChild(head);
      panel.appendChild(body);
      set(Boolean(opened[name]));
    }

    /* The day, week or month on show, its heading and what it covers. */
    function current() {
      if (span === 'day') {
        return {
          info: days[picked],
          title: (picked === today ? 'Today, ' : '') + fmtDay(picked, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          from: picked, to: picked, live: picked === today
        };
      }
      if (span === 'week') {
        var sunday = addDays(picked, -noonOf(picked).getUTCDay());
        var saturday = addDays(sunday, 6);
        var sameMonth = sunday.slice(0, 7) === saturday.slice(0, 7);
        return {
          info: (data.weeks || {})[sunday],
          title: (today >= sunday && today <= saturday ? 'This week, ' : '') +
            fmtDay(sunday, { month: 'long', day: 'numeric' }) + ' to ' +
            fmtDay(saturday, sameMonth ? { day: 'numeric' } : { month: 'long', day: 'numeric' }) + ', ' + saturday.slice(0, 4),
          from: sunday, to: saturday, live: today >= sunday && today <= saturday
        };
      }
      var last = addDays(shift(month, 1) + '-01', -1);
      return {
        info: (data.months || {})[month],
        title: (month === today.slice(0, 7) ? 'This month, ' : '') + fmtDay(month + '-01', { month: 'long', year: 'numeric' }),
        from: month + '-01', to: last, live: month === today.slice(0, 7)
      };
    }

    function render() {
      var panel = $('[data-cal-day]');
      var on = current();
      var info = on.info;
      panel.textContent = '';
      panel.appendChild(el('h3', 'cal__date', on.title));
      if (!info) {
        panel.appendChild(el('p', 'cal__none', on.live ? 'Nothing yet.' : 'Nothing played.'));
        return;
      }
      /* The days it has had so far, since tracking began. */
      var first = on.from < since ? since : on.from;
      var end = on.to > today ? today : on.to;
      var counted = Math.round((Date.parse(end) - Date.parse(first)) / 864e5) + 1;

      panel.appendChild(el('p', 'cal__summary', plural(info.plays, 'play', 'plays') + ' and ' +
        duration(info.minutes) + ' of listening, across ' + plural(info.tracks, 'song', 'songs') +
        ' and ' + plural(info.artists, 'artist', 'artists') + '.'));
      var list = el('div', 'cal__sections');
      panel.appendChild(list);

      section(list, 'Top songs and artists', function (body) {
        ranked(body, topsOf(info).length > 1 ? 'Top songs' : 'Top song', topsOf(info), playCount);
        ranked(body, info.topArtists && info.topArtists.length > 1 ? 'Top artists' : 'Top artist', info.topArtists, playCount, true);
        ranked(body, 'Top album', info.topAlbum && [info.topAlbum], playCount);
        ranked(body, 'Top playlist', info.topPlaylist && [info.topPlaylist], playCount);
      });

      section(list, 'Numbers', function (body) {
        if (span === 'day') {
          stats(body, null, [
            ['Plays', num(info.plays)],
            ['Listened', duration(info.minutes)],
            ['Share of the day', pct(info.minutes, 1440)],
            ['Songs', num(info.tracks)],
            ['Artists', num(info.artists)],
            ['Albums', num(info.albums)]]);

          /* Against the other days: its place by time listened, the
             time against the average of every whole day since tracking
             began (quiet ones included), and how many days running had
             music. Today isn't over, so it isn't ranked or held to a
             whole day. */
          var listed = Object.keys(days);
          var rank = 1 + listed.filter(function (d) { return days[d].minutes > info.minutes; }).length;
          var whole = (Date.parse(today) - Date.parse(since)) / 864e5;
          var past = listed.filter(function (d) { return d < today; })
            .reduce(function (n, d) { return n + days[d].minutes; }, 0);
          var average = whole > 0 ? past / whole : 0;
          var against = average ? Math.round(100 * (info.minutes - average) / average) : null;
          var run = 0;
          for (var d = picked; days[d]; d = addDays(d, -1)) run++;
          stats(body, 'Against other days', [
            ['Rank by time', on.live ? null : nth(rank) + ' of ' + listed.length],
            ['Against average', on.live || against == null ? null : (against > 0 ? '+' : against < 0 ? '−' : '') + Math.abs(against) + '%'],
            ['Days in a row', num(run)]]);
        } else {
          var busiest = info.busiest;
          stats(body, null, [
            ['Plays', num(info.plays)],
            ['Listened', duration(info.minutes)],
            ['Days with music', info.days != null ? info.days + ' of ' + counted : null],
            ['Daily average', duration(Math.round(info.minutes / counted))],
            ['Busiest day', busiest ? fmtDay(busiest.day, { month: 'long', day: 'numeric' }) : null],
            ['Longest streak', info.streak ? plural(info.streak, 'day', 'days') : null],
            ['Songs', num(info.tracks)],
            ['Artists', num(info.artists)],
            ['Albums', num(info.albums)]]);
        }
        stats(body, 'Discovery', [
          ['New songs', num(info.newTracks)],
          ['New artists', num(info.newArtists)],
          ['New albums', num(info.newAlbums)],
          ['Replays', num(info.plays - info.tracks)]]);
      });

      section(list, 'Timing', function (body) {
        var hours = info.hours || null;
        var busiest = hours ? hours.indexOf(Math.max.apply(null, hours)) : -1;
        var session = info.longestSession;
        stats(body, null, [
          ['First play', info.first ? clock(info.first) : null],
          ['Last play', info.last ? clock(info.last) : null],
          ['Busiest hour', busiest >= 0 ? hourName(busiest) + ' to ' + hourName((busiest + 1) % 24) : null],
          ['Sessions', num(info.sessions)],
          ['Longest session', session ? duration(session.minutes) : null],
          ['Longest break', info.longestBreak != null ? duration(info.longestBreak) : null]]);

        /* Plays in each hour of the day, as a row of bars. */
        if (hours) {
          body.appendChild(el('p', 'music__label', 'By the hour'));
          var most = Math.max.apply(null, hours) || 1;
          var chart = el('div', 'cal__hours');
          chart.setAttribute('role', 'img');
          chart.setAttribute('aria-label', 'Plays by hour. Busiest: ' + hourName(busiest) + ', ' + plural(hours[busiest], 'play', 'plays') + '.');
          hours.forEach(function (n, h) {
            var bar = el('span', 'cal__bar');
            bar.style.height = (n ? Math.max(4, 100 * n / most) : 0) + '%';
            bar.title = hourName(h) + ': ' + plural(n, 'play', 'plays');
            chart.appendChild(bar);
          });
          body.appendChild(chart);
          var axis = el('div', 'cal__axis');
          axis.setAttribute('aria-hidden', 'true');
          ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'].forEach(function (label) { axis.appendChild(el('span', null, label)); });
          body.appendChild(axis);

          /* Morning 5 to noon, afternoon to 5, evening to 9, night to 5. */
          var between = function (a, b) {
            var n = 0;
            for (var h = a; h !== b; h = (h + 1) % 24) n += hours[h];
            return n;
          };
          stats(body, 'Time of day', [
            ['Morning', pct(between(5, 12), info.plays)],
            ['Afternoon', pct(between(12, 17), info.plays)],
            ['Evening', pct(between(17, 21), info.plays)],
            ['Night', pct(between(21, 5), info.plays)]]);
        }
        if (info.weekdays) {
          shares(body, 'By day of the week', info.weekdays.map(function (n, i) { return [WEEKDAYS[i], n]; }), info.plays);
        }
      });

      /* The music itself, from MusicBrainz and Deezer: each share is of
         the plays they knew about. */
      section(list, 'The music', function (body) {
        var reach = info.reach, explicit = info.explicit, released = info.released, genres = info.genres;
        stats(body, null, [
          ['Popularity', info.popularity != null ? info.popularity + ' / 100' : null],
          ['Mainstream', reach ? pct(reach.mainstream, reach.known) : null],
          ['In between', reach ? pct(reach.middle, reach.known) : null],
          ['Niche', reach ? pct(reach.niche, reach.known) : null],
          ['Artist variety', info.variety != null ? info.variety + ' / 100' : null],
          ['Genres', genres ? num(genres.count) : null],
          ['Explicit', explicit ? pct(explicit.plays, explicit.known) : null],
          ['Average year', released ? String(released.average) : null],
          ['Fresh releases', released ? num(released.fresh) : null]]);
        if (genres) {
          shares(body, 'Top genres', genres.top.map(function (g) { return [g.name, g.plays]; }), genres.known);
        }
        if (released && released.decades) {
          shares(body, 'By decade', Object.keys(released.decades).sort().reverse().map(function (k) {
            return [k, released.decades[k]];
          }), released.known);
        }
        if (body.children.length) {
          body.appendChild(el('p', 'cal__note',
            'Genres are from MusicBrainz. Popularity, fans, release years and explicit lyrics are from Deezer. ' +
            'Mainstream means over a million fans there, and niche fewer than 10,000. ' +
            'Artist variety is 100 when every play is by someone different. ' +
            'Fresh releases had been out less than a month when they were played.'));
        }
      });

      section(list, 'Habits', function (body) {
        stats(body, null, [
          ['Played through', info.cutShort != null ? pct(info.plays - info.cutShort, info.plays) : null],
          ['Cut short', num(info.cutShort)],
          ['Average length', info.averageMs ? mmss(info.averageMs) : null],
          ['With features', info.features != null ? pct(info.features, info.plays) : null],
          ['Top artist share', info.topArtists && info.topArtists[0] ? pct(info.topArtists[0].plays, info.plays) : null]]);
        var from = info.from;
        if (from) {
          stats(body, 'Played from', [
            ['Playlists', from.playlist ? pct(from.playlist, info.plays) : null],
            ['Albums', from.album ? pct(from.album, info.plays) : null],
            ['Artist pages', from.artist ? pct(from.artist, info.plays) : null],
            ['Liked Songs', from.liked ? pct(from.liked, info.plays) : null],
            ['Elsewhere', from.other ? pct(from.other, info.plays) : null]]);
        }
      });

      section(list, 'Standouts', function (body) {
        var fans = function (item) { return plural(item.fans, 'Deezer fan', 'Deezer fans'); };
        ranked(body, 'On repeat', info.onRepeat && [info.onRepeat], function (item) { return item.times + ' in a row'; });
        ranked(body, 'Longest song', info.longest && [info.longest], function (item) { return mmss(item.duration_ms); });
        ranked(body, 'Deepest cut', info.deepCut && [info.deepCut], function (item) { return item.popularity + ' / 100'; });
        ranked(body, 'Oldest song', info.released && info.released.oldest && [info.released.oldest], function (item) { return String(item.year); });
        ranked(body, 'Most niche artist', info.nichest && [info.nichest], fans, true);
        ranked(body, 'Most followed artist', info.biggest && [info.biggest], fans, true);
      });

      /* The day's whole log, 12 AM to 11:59 PM, fetched only when asked
         for, from the file the Action writes for each day. */
      if (span === 'day') {
        var day = picked;
        section(list, 'Listening log', function (body) {
          body.appendChild(el('p', 'cal__none', 'Loading…'));
          return fetch(base + 'days/' + day + '.json', { cache: 'no-cache' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (plays) {
              body.textContent = '';
              body.appendChild(el('p', 'music__label', fmtDay(day, { month: 'long', day: 'numeric' }) +
                ', 12 AM to 11:59 PM · ' + plural(plays.length, 'play', 'plays')));
              var log = el('ol', 'plays plays--log');
              plays.forEach(function (item) { log.appendChild(logRow(item)); });
              body.appendChild(log);
            })
            .catch(function (err) {
              body.textContent = '';
              body.appendChild(el('p', 'cal__none', 'That day’s log couldn’t be loaded. Close and open it again to retry.'));
              throw err;
            });
        }, true);
      }

      if (on.live) panel.appendChild(el('p', 'cal__note', 'These numbers catch up each time the log is updated.'));
    }

    /* Left open past midnight, the calendar moves on to the new day:
       to its month and onto it, unless another day has been picked. */
    setInterval(function () {
      var now = dayOf(new Date());
      if (now === today) return;
      if (picked === today) { picked = now; month = now.slice(0, 7); }
      today = now;
      draw();
    }, 60000);

    $('[data-cal-prev]').addEventListener('click', function () { month = shift(month, -1); draw(); });
    $('[data-cal-next]').addEventListener('click', function () { month = shift(month, 1); draw(); });
    draw();
    box.hidden = false;
  }

  /* What's playing, from the Worker at data-live (.github/worker/now.js),
     which asks Spotify at most every fifteen seconds. The page asks as
     often while it is in view; between answers the progress bar runs on
     its own clock, and a scrub or a skip shows at the next answer. */
  var LIVE = page.getAttribute('data-live');
  var logged = [];
  var tick = null;

  function mmss(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function showNow(live, fallback) {
    /* Playing, paused part-way through, or failing both, the last play. */
    var track = live && live.track ? live.track : null;
    var playing = Boolean(track && live.playing);
    var item = track || fallback;
    if (!item) return;
    $('[data-now-when]').textContent = playing ? 'Playing now' : track ? 'Paused' : 'Last played \u00b7 ' + ago(item.played_at);
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
    var start = Date.now() - live.progress_ms;
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
     starts. When Spotify's own record of that play arrives it takes the
     page's place, rather than appearing twice. */
  var answered = false; // whether the Worker has replied yet
  var heard = [];       // plays the page saw finish, newest first
  var watching = null;  // { track, longest } for the song playing now

  function merged(recent) {
    var seen = {};
    logged = (recent || []).concat(logged).filter(function (p) {
      if (seen[p.played_at]) return false;
      seen[p.played_at] = true;
      return true;
    });
    heard = heard.filter(function (h) {
      return !logged.some(function (p) {
        return p.url === h.url && Math.abs(Date.parse(p.played_at) - Date.parse(h.played_at)) < 10 * 60000;
      });
    });
    return heard.concat(logged)
      .sort(function (a, b) { return Date.parse(b.played_at) - Date.parse(a.played_at); });
  }

  function follow(now) {
    var track = now.track;
    if (watching && (!track || track.url !== watching.track.url)) {
      if (watching.longest >= 30000) {
        heard.unshift(Object.assign({}, watching.track, { played_at: new Date().toISOString() }));
      }
      watching = null;
    }
    if (track) {
      if (!watching) watching = { track: track, longest: 0 };
      watching.longest = Math.max(watching.longest, now.progress_ms || 0);
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
      'Spotify needs a breather. Aniketh\u2019s almost certainly still jamming.';
    $('[data-notice-at]').textContent = time(resumes) + ' ' + day;

    /* The time left, to the second. */
    var count = $('[data-notice-count]');
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    var draw = function () {
      var s = Math.max(0, Math.round((resumes - Date.now()) / 1000));
      count.textContent = two(Math.floor(s / 3600)) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60);
      if (!s) clearInterval(countdown);
    };
    draw();
    countdown = setInterval(draw, 1000);
    box.hidden = false;
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
          var plays = merged(now.recent);
          log(plays, now.playing ? now.track : null);
          showNow(now, plays[0]);
        })
        .catch(function () {});
    };
    ask();
    /* The Worker only asks Spotify every fifteen seconds; asking it any
       more often than that would only fetch the same answer. */
    setInterval(ask, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
  }

  /* The listening log: every play since 12 am today in Charlottesville,
     newest first, with its time. Before the first song of the day, a
     line saying so. */
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
    box.appendChild(list);
    plays.forEach(function (item) { list.appendChild(logRow(item)); });
  }

  /* One play in a log: its time, its cover, the song and who by. */
  function logRow(item) {
    var li = el('li');
    var href = spotify(item.url);
    var row = el(href ? 'a' : 'div', item.now ? 'play play--now' : 'play');
    if (href) { row.href = href; row.target = '_blank'; row.rel = 'noopener'; }
    var time = el('time', 'play__n mono', item.now ? 'Now'
      : new Date(item.played_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }));
    time.dateTime = item.played_at;
    row.appendChild(time);
    var art = el('img', 'play__art');
    art.alt = '';
    art.loading = 'lazy';
    if (https(item.image)) art.src = item.image;
    row.appendChild(art);
    var text = el('span', 'play__text');
    text.appendChild(el('span', 'play__name', item.name));
    if (item.artists) text.appendChild(el('span', 'play__by', item.artists));
    row.appendChild(text);
    li.appendChild(row);
    return li;
  }

  fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(render)
    .catch(function () {});
})();
