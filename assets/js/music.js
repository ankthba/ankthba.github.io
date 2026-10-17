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

  function rangeOf(which) {
    var r = data.ranges && data.ranges[which];
    if (!r) return null;
    var stats = which === 'week' ? (data.weeks || {})[r.from] : (data.months || {})[r.from.slice(0, 7)];
    return {
      plays: r.plays,
      minutes: r.minutes,
      tracks: stats ? stats.tracks : null,
      artists: stats ? stats.artists : null,
      topTracks: r.tracks,
      topArtists: r.artists,
      stats: stats
    };
  }

  function figures(r) {
    var box = $('[data-figures]');
    box.textContent = '';
    var hours = Math.round(r.minutes / 60);
    [
      [num(r.plays), r.plays === 1 ? 'play' : 'plays'],
      r.minutes < 60 ? [num(r.minutes), r.minutes === 1 ? 'minute' : 'minutes'] : [num(hours), hours === 1 ? 'hour' : 'hours'],
      r.tracks != null ? [num(r.tracks), r.tracks === 1 ? 'song' : 'songs'] : null,
      r.artists != null ? [num(r.artists), r.artists === 1 ? 'artist' : 'artists'] : null
    ].filter(Boolean).forEach(function (f) {
      var item = el('div', 'figures__item');
      item.appendChild(el('dt', 'figures__t', f[1]));
      item.appendChild(el('dd', 'figures__v', f[0]));
      box.appendChild(item);
    });
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
    [
      stats && stats.onRepeat && [stats.onRepeat, 'On repeat', stats.onRepeat.times + ' in a row'],
      stats && stats.longest && [stats.longest, 'Longest song', mmss(stats.longest.duration_ms)],
      stats && stats.deepCut && [stats.deepCut, 'Deepest cut', stats.deepCut.popularity + ' / 100'],
      oldest && [oldest, 'Oldest song', String(oldest.year)]
    ].filter(Boolean).forEach(function (s) {
      list.appendChild(row(s[0], null, fact(s[1], s[2])));
    });
    $('[data-standouts-label]').hidden = list.hidden = !list.children.length;
  }

  function showRange(which) {
    var r = rangeOf(which);
    if (!r) return;
    Array.prototype.forEach.call(page.querySelectorAll('[data-range]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-range') === which));
    });
    figures(r);
    ranked($('[data-top-tracks]'), r.topTracks, 10);
    ranked($('[data-top-artists]'), r.topArtists, 5);
    standouts(r.stats);
  }

  /* ---------- Listening calendar ----------
     A month at a time, any month since tracking began, each day by the
     cover of its top album (its top song's, in older files with none).
     The day picked is summed up under the grid: its plays and time, its
     top songs, and its whole listening log, every song from 12 AM to
     11:59 PM, kept closed until it is asked for. */
  function calendar() {
    var box = $('[data-cal]');
    var days = data.calendar || {};
    var since = data.since;
    if (!box || !since) return;
    var today = dayOf(new Date());
    var played = Object.keys(days).filter(function (d) { return days[d] && days[d].plays; }).sort();
    var picked = days[today] ? today : played[played.length - 1] || today;
    var month = picked.slice(0, 7);

    function shift(ym, n) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }

    function draw() {
      $('[data-cal-month]').textContent = fmtDay(month + '-01', { month: 'long', year: 'numeric' });
      $('[data-cal-prev]').disabled = month <= since.slice(0, 7);
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
      var info = days[day];
      var label = fmtDay(day, { month: 'long', day: 'numeric' });
      var c = el('button', 'cal__cell');
      c.type = 'button';
      c.appendChild(el('span', 'cal__n', String(+day.slice(8))));
      if (day < since || day > today) {
        c.disabled = true;
        c.classList.add('cal__cell--off');
        c.setAttribute('aria-label', label + (day < since ? ', before tracking began' : ''));
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
      var info = days[picked];
      note.appendChild(el('h3', 'cal__date', (picked === today ? 'Today, ' : '') +
        fmtDay(picked, { weekday: 'long', month: 'long', day: 'numeric' })));
      if (!info || !info.plays) {
        note.appendChild(el('p', 'cal__line', picked === today ? 'Nothing yet today.' : 'Nothing played.'));
        return;
      }
      note.appendChild(el('p', 'cal__line', plural(info.plays, 'play', 'plays') + ' and ' +
        duration(info.minutes) + ' of listening, across ' + plural(info.tracks, 'song', 'songs') +
        ' and ' + plural(info.artists, 'artist', 'artists') + '.'));
      var tops = topsOf(info);
      if (tops.length) {
        var list = el('ol', 'plays');
        tops.slice(0, 5).forEach(function (item, i) { list.appendChild(row(item, rank(i), count(item))); });
        note.appendChild(list);
      }
      dayLog(note, picked);
    }

    /* The day's whole log, from the file the Action writes for each day,
       fetched only when it is opened. Once opened it stays open from day
       to day, until it is closed. */
    var logOpen = false;
    function dayLog(note, day) {
      var toggle = el('button', 'daylog__toggle');
      toggle.type = 'button';
      toggle.appendChild(el('span', 'daylog__name', 'Listening log'));
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
        body.textContent = '';
        body.appendChild(el('p', 'cal__line', 'Loading\u2026'));
        fetch(base + 'days/' + day + '.json', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
          .then(function (plays) {
            loaded = true;
            body.textContent = '';
            body.appendChild(el('p', 'daylog__span', '12 AM to 11:59 PM \u00b7 ' + plural(plays.length, 'play', 'plays')));
            var list = el('ol', 'plays plays--log');
            plays.forEach(function (item) { list.appendChild(logRow(item)); });
            body.appendChild(list);
          })
          .catch(function () {
            body.textContent = '';
            body.appendChild(el('p', 'cal__line', 'That day\u2019s log couldn\u2019t be loaded. Close and open it again to retry.'));
          });
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
        })
        .catch(function () {});
    };
    ask();
    /* The Worker only asks Spotify every fifteen seconds; asking it any
       more often than that would only fetch the same answer. */
    setInterval(ask, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
  }

  /* ---------- Start ---------- */

  function render(file) {
    if (!file || !file.recent || !file.recent.length) return;
    data = file;
    $('[data-music-empty]').hidden = true;
    $('[data-music-body]').hidden = false;

    /* The live answer comes first; only if it hasn't arrived after a few
       seconds is the last play the Action saw shown instead, since that
       can be a quarter of an hour old. */
    setTimeout(function () { if (!answered) showNow(null, data.recent[0]); }, 3000);

    Array.prototype.forEach.call(page.querySelectorAll('[data-range]'), function (b) {
      b.addEventListener('click', function () { showRange(b.getAttribute('data-range')); });
    });
    showRange('week');
    calendar();

    logged = data.recent;
    log(logged);
    live();
  }

  fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(render)
    .catch(function () {});
})();
