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

  /* Dates arrive as YYYY-MM-DD in America/New_York; noon UTC keeps them
     on the right day whatever the reader's own zone. */
  var noon = function (day) { return new Date(day + 'T12:00:00Z'); };
  var dayName = function (day, opts) {
    return noon(day).toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, opts));
  };
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

    /* Until the live answer comes back, the last play the Action saw. */
    showNow(null, data.recent[0]);

    /* Most listened to right now: the last seven days. */
    var count = function (item) { return plural(item.plays, 'play', 'plays'); };
    fill($('[data-top-tracks]'), data.ranges.week.tracks, { count: count });
    fill($('[data-top-artists]'), data.ranges.week.artists, { count: count });

    logged = data.recent;
    log(logged);
    live();
  }

  /* What's playing, from the Worker at data-live (.github/worker/now.js),
     which asks Spotify at most every ten seconds. The page asks every
     fifteen while it is in view; between answers the progress bar runs
     on its own clock. */
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
    var img = $('[data-now-img]');
    if (https(item.image) && img.getAttribute('src') !== item.image) img.src = item.image;
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

  function live() {
    if (!LIVE) return;
    var ask = function () {
      if (document.hidden) return;
      fetch(LIVE, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (now) {
          /* New plays go on top of the log, once each. */
          var seen = {};
          logged = (now.recent || []).concat(logged).filter(function (p) {
            if (seen[p.played_at]) return false;
            seen[p.played_at] = true;
            return true;
          }).sort(function (a, b) { return Date.parse(b.played_at) - Date.parse(a.played_at); }).slice(0, 50);
          log(logged);
          showNow(now, logged[0]);
        })
        .catch(function () {});
    };
    ask();
    setInterval(ask, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
  }

  /* The listening log: every recent play with its time, under a heading
     for each day. */
  function log(plays) {
    var box = $('[data-log]');
    box.textContent = '';
    var today = dayOf(new Date());
    var yesterday = dayOf(new Date(Date.now() - 864e5));
    var list = null;
    var current = null;
    plays.forEach(function (item) {
      var day = dayOf(new Date(item.played_at));
      if (day !== current) {
        current = day;
        var label = day === today ? 'Today' : day === yesterday ? 'Yesterday'
          : dayName(day, { weekday: 'long', month: 'long', day: 'numeric' });
        box.appendChild(el('h3', 'log__day', label));
        list = el('ol', 'plays plays--log');
        box.appendChild(list);
      }
      var li = el('li');
      var href = spotify(item.url);
      var row = el(href ? 'a' : 'div', 'play');
      if (href) { row.href = href; row.target = '_blank'; row.rel = 'noopener'; }
      var time = el('time', 'play__n mono', new Date(item.played_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
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
