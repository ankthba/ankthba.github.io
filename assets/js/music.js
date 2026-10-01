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
     since tracking began shown by the cover of its top song, and the
     day picked out below it in full. The days come from music.json's
     calendar, written each time the Action runs. */
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
  var playCount = function (item) { return plural(item.plays, 'play', 'plays'); };

  function calendar(data) {
    var box = $('[data-cal]');
    var days = data.calendar || {};
    var since = data.since;
    if (!box || !since) return;
    var today = dayOf(new Date());

    $('[data-cal-since]').textContent = 'Tracking began on ' +
      fmtDay(since, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
      '. Nothing before then is counted.';
    var t = data.totals;
    if (t) {
      $('[data-cal-totals]').textContent = 'Since then: ' + plural(t.plays, 'play', 'plays') + ' and ' +
        duration(t.minutes) + ' of listening, across ' + plural(t.tracks, 'song', 'songs') + ' and ' +
        plural(t.artists, 'artist', 'artists') + '.';
    }

    /* Today if it has plays yet, otherwise the latest day that does,
       in its own month. */
    var picked = days[today] ? today : Object.keys(days).sort().pop() || today;
    var month = picked.slice(0, 7);

    function shift(ym, n) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }

    function draw() {
      $('[data-cal-month]').textContent = fmtDay(month + '-01', { month: 'long', year: 'numeric' });
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
          var cover = info && topsOf(info)[0];
          if (cover && https(cover.image)) {
            var img = el('img', 'cal__art');
            img.alt = '';
            img.loading = 'lazy';
            img.src = cover.image;
            cell.appendChild(img);
            cell.classList.add('cal__cell--art');
          }
          cell.setAttribute('aria-label', label + ': ' + (info
            ? plural(info.plays, 'play', 'plays') + ', ' + duration(info.minutes) + (cover ? ', top song ' + cover.name : '')
            : 'nothing played'));
          if (day === today) cell.classList.add('cal__cell--today');
          cell.setAttribute('aria-pressed', day === picked ? 'true' : 'false');
          cell.addEventListener('click', (function (day) {
            return function () { picked = day; draw(); };
          })(day));
        }
        cell.appendChild(el('span', 'cal__n', String(d)));
        grid.appendChild(cell);
      }
      show(picked);
    }

    /* The day picked: its numbers, its hours, then its top songs,
       artists and album. */
    function show(day) {
      var panel = $('[data-cal-day]');
      var info = days[day];
      panel.textContent = '';
      panel.appendChild(el('h3', 'cal__date', (day === today ? 'Today, ' : '') +
        fmtDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })));
      if (!info) {
        panel.appendChild(el('p', 'cal__none', day === today ? 'Nothing yet today.' : 'Nothing played.'));
        return;
      }

      var hours = info.hours || null;
      var busiest = hours ? hours.indexOf(Math.max.apply(null, hours)) : -1;
      var num = function (n) { return n == null ? null : n.toLocaleString('en-US'); };
      var stats = el('dl', 'cal__stats');
      [['Plays', num(info.plays)],
       ['Listened', duration(info.minutes)],
       ['Songs', num(info.tracks)],
       ['New songs', num(info.newTracks)],
       ['Artists', num(info.artists)],
       ['Albums', num(info.albums)],
       ['First play', info.first ? clock(info.first) : null],
       ['Last play', info.last ? clock(info.last) : null],
       ['Busiest hour', busiest >= 0 ? hourName(busiest) + ' to ' + hourName((busiest + 1) % 24) : null]]
        .forEach(function (pair) {
          if (pair[1] == null) return;
          var row = el('div');
          row.appendChild(el('dt', null, pair[0]));
          row.appendChild(el('dd', null, pair[1]));
          stats.appendChild(row);
        });
      panel.appendChild(stats);

      /* Plays in each hour of the day, as a row of bars. */
      if (hours) {
        panel.appendChild(el('p', 'music__label', 'By the hour'));
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
        panel.appendChild(chart);
        var axis = el('div', 'cal__axis');
        axis.setAttribute('aria-hidden', 'true');
        ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'].forEach(function (label) { axis.appendChild(el('span', null, label)); });
        panel.appendChild(axis);
      }

      var tops = topsOf(info);
      if (tops.length) {
        panel.appendChild(el('p', 'music__label', tops.length > 1 ? 'Top songs' : 'Top song'));
        var songs = el('ol', 'plays');
        fill(songs, tops, { count: playCount });
        panel.appendChild(songs);
      }
      if (info.topArtists && info.topArtists.length) {
        panel.appendChild(el('p', 'music__label', info.topArtists.length > 1 ? 'Top artists' : 'Top artist'));
        var artists = el('ol', 'plays plays--artists');
        fill(artists, info.topArtists, { count: playCount });
        panel.appendChild(artists);
      }
      if (info.topAlbum) {
        panel.appendChild(el('p', 'music__label', 'Top album'));
        var album = el('ol', 'plays');
        fill(album, [info.topAlbum], { numbered: false, count: playCount });
        panel.appendChild(album);
      }
      if (day === today) panel.appendChild(el('p', 'cal__note', 'Today’s numbers catch up each time the log is updated.'));
    }

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
    plays.forEach(function (item) {
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
      list.appendChild(li);
    });
  }

  fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(render)
    .catch(function () {});
})();
