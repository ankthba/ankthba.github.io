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
  var touch = matchMedia('(hover: none)').matches;
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

    /* Last played. Spotify reports a play once it has run for thirty
       seconds, so within a few minutes it is probably still going. */
    var last = data.recent[0];
    var fresh = Date.now() - Date.parse(last.played_at) < 8 * 60000;
    $('[data-now-when]').textContent = (fresh ? 'Playing now' : 'Last played') + ' · ' + ago(last.played_at);
    $('[data-now-name]').textContent = last.name;
    $('[data-now-by]').textContent = last.artists;
    var link = $('[data-now-link]');
    if (spotify(last.url)) link.href = last.url; else link.removeAttribute('href');
    if (https(last.image)) $('[data-now-img]').src = last.image;
    $('[data-now]').classList.toggle('now--live', fresh);

    /* Most played, over a range chosen with the switch. */
    var tabs = page.querySelectorAll('[data-range]');
    function show(key) {
      var r = data.ranges[key];
      tabs.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-range') === key ? 'true' : 'false'); });
      var span = dayName(r.from, { month: 'short', day: 'numeric' }) +
        (r.from === r.to ? '' : ' – ' + dayName(r.to, { month: 'short', day: 'numeric' }));
      $('[data-range-note]').textContent = span;
      var count = function (item) { return plural(item.plays, 'play', 'plays'); };
      fill($('[data-top-tracks]'), r.tracks, { count: count });
      fill($('[data-top-artists]'), r.artists, { count: count });
    }
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-range')); });
    });
    show('week');

    calendar(data);

    log(data.recent);
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

  /* Song of the day: a month at a time, Monday first, each day showing
     the cover of its most played song. */
  function calendar(data) {
    var grid = $('[data-cal]');
    var caption = $('[data-cal-caption]');
    var first = data.since.slice(0, 7);
    var lastMonth = data.today.slice(0, 7);
    var month = lastMonth;

    function step(ym, n) {
      var y = +ym.slice(0, 4);
      var m = +ym.slice(5, 7) - 1 + n;
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }

    function describe(day) {
      var c = data.calendar[day];
      var date = dayName(day, { weekday: 'long', month: 'long', day: 'numeric' });
      if (day < data.since) return date + ': before counting began.';
      if (day > data.today) return date + ': still to come.';
      if (!c || !c.top) return date + ': nothing played.';
      return date + ': ' + c.top.name + ' by ' + c.top.artists + '.';
    }

    function draw() {
      grid.textContent = '';
      $('[data-cal-month]').textContent = dayName(month + '-01', { month: 'long', year: 'numeric' });
      $('[data-cal-prev]').disabled = month <= first;
      $('[data-cal-next]').disabled = month >= lastMonth;

      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d) {
        grid.appendChild(el('span', 'cal__dow mono', d));
      });
      var start = noon(month + '-01');
      var lead = (start.getUTCDay() + 6) % 7;
      for (var i = 0; i < lead; i++) grid.appendChild(el('span', 'cal__pad'));
      var days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();

      for (var d = 1; d <= days; d++) {
        var day = month + '-' + (d < 10 ? '0' : '') + d;
        var c = data.calendar[day];
        var top = c && c.top;
        var href = top && spotify(top.url);
        var cell = el(href ? 'a' : 'span', 'cal__day');
        if (href) { cell.href = href; cell.target = '_blank'; cell.rel = 'noopener'; }
        if (day > data.today) cell.classList.add('cal__day--future');
        if (day < data.since) cell.classList.add('cal__day--before');
        if (day === data.today) cell.classList.add('cal__day--today');
        if (top && https(top.image)) {
          var img = el('img');
          img.alt = '';
          img.loading = 'lazy';
          img.src = top.image;
          cell.appendChild(img);
          cell.classList.add('cal__day--played');
        }
        cell.appendChild(el('span', 'cal__num mono', String(d)));
        cell.setAttribute('aria-label', describe(day));
        (function (day, cell) {
          var say = function () {
            caption.textContent = describe(day);
            grid.querySelectorAll('.cal__day--picked').forEach(function (c) { c.classList.remove('cal__day--picked'); });
            cell.classList.add('cal__day--picked');
          };
          cell.addEventListener('mouseenter', say);
          cell.addEventListener('focus', say);
          /* On a touch screen the first tap says what the day was and the
             second opens the song, rather than leaving for Spotify blind. */
          cell.addEventListener('click', function (e) {
            if (touch && !cell.classList.contains('cal__day--picked')) { e.preventDefault(); say(); }
          });
        })(day, cell);
        grid.appendChild(cell);
      }
      var latest = Object.keys(data.calendar).filter(function (k) { return k.slice(0, 7) === month; }).sort().pop();
      caption.textContent = latest ? describe(latest) : 'Nothing counted this month.';
    }

    $('[data-cal-prev]').addEventListener('click', function () { if (month > first) { month = step(month, -1); draw(); } });
    $('[data-cal-next]').addEventListener('click', function () { if (month < lastMonth) { month = step(month, 1); draw(); } });
    draw();
  }

  fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(render)
    .catch(function () {});
})();
