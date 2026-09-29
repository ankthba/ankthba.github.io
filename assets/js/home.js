/* The home page: the headline, the index of work, the photographs. */

'use strict';

(function () {
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Headline: wrap each word so it can rise out of its own line. */
  var title = document.querySelector('.hero__title');
  var n = 0;
  (function split(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          var inner = document.createElement('span');
          w.className = 'w';
          inner.textContent = p;
          inner.style.setProperty('--d', (0.15 + n++ * 0.028).toFixed(3) + 's');
          w.appendChild(inner);
          frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      } else if (child.classList && child.classList.contains('inl')) {
        child.style.setProperty('--d', (0.35 + n++ * 0.028).toFixed(3) + 's');
      } else if (child.nodeType === 1) {
        split(child);
      }
    });
  })(title);

  var started = false;
  function go() {
    if (started) return;
    started = true;
    /* Read layout first so the hidden starting state is committed and
       the change below transitions, rather than waiting on a frame a
       background tab may never draw. */
    void title.offsetWidth;
    root.classList.add('ready');
    setTimeout(function () { root.classList.add('settled'); }, 2600);
  }
  if (document.fonts) document.fonts.ready.then(go);
  setTimeout(go, 900);

  /* After "music" in the headline, the cover of whatever is playing on
     Spotify now, or was last, from the Worker the music page uses. */
  var liveLink = document.querySelector('[data-live-link]');
  if (liveLink && window.fetch) {
    var cover = liveLink.querySelector('[data-live-cover] img');
    var paint = function () {
      fetch('https://aniketh-now.ankthba.workers.dev/', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (now) {
          /* The Worker picks a picture that is safe to show here: the
             cover, or for an explicit song the artist's photo, or none. */
          var item = now.headline;
          var slot = cover.parentNode;
          if (!item) return;
          liveLink.title = (now.playing ? 'Listening to ' : 'Last listened to ') + item.name + ' by ' + item.artists;
          if (!/^https:\/\//.test(item.image || '')) { slot.hidden = true; return; }
          slot.hidden = false;
          if (cover.getAttribute('src') !== item.image) cover.src = item.image;
          cover.classList.add('on');
        })
        .catch(function () {});
    };
    paint();
    setInterval(function () { if (!document.hidden) paint(); }, 30000);
  }

  /* The photographs in the headline turn over, one at a time. */
  if (!still) {
    var cycles = document.querySelectorAll('[data-cycle]');
    var turn = 0;
    setInterval(function () {
      var imgs = cycles[turn++ % cycles.length].querySelectorAll('img');
      var i = Array.prototype.findIndex.call(imgs, function (im) { return im.classList.contains('on'); });
      imgs[i].classList.remove('on');
      imgs[(i + 1) % imgs.length].classList.add('on');
    }, 1400);
  }

  /* A picture trails the cursor through the index, lagging a little
     and leaning into the direction it is being pulled. */
  var box = document.querySelector('[data-peek-box]');
  var index = document.querySelector('[data-index]');
  if (hover && box && index) {
    var pic = box.querySelector('img');
    var mx = 0, my = 0, x = 0, y = 0, running = false;
    var frame = function () {
      var dx = mx - x;
      x += dx * 0.14;
      y += (my - y) * 0.14;
      var tilt = Math.max(-9, Math.min(9, dx * 0.06));
      /* Right of the cursor, so it never covers the name being read,
         unless that would push it off the page. */
      var left = x + 40 + box.offsetWidth > innerWidth ? x - 40 - box.offsetWidth : x + 40;
      box.style.transform = 'translate3d(' + left + 'px,' + (y - box.offsetHeight / 2) + 'px,0) rotate(' + tilt + 'deg)';
      if (running) requestAnimationFrame(frame);
    };
    addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
    index.querySelectorAll('.row').forEach(function (row) {
      row.addEventListener('mouseenter', function (e) {
        var src = row.getAttribute('data-peek');
        if (!src) { box.classList.remove('on'); return; }
        pic.src = src;
        pic.classList.toggle('contain', row.hasAttribute('data-contain'));
        if (!box.classList.contains('on')) { x = mx = e.clientX; y = my = e.clientY; }
        box.classList.add('on');
        if (!running) { running = true; frame(); }
      });
      row.addEventListener('mouseleave', function () { box.classList.remove('on'); });
    });
    index.addEventListener('mouseleave', function () {
      setTimeout(function () { if (!box.classList.contains('on')) running = false; }, 600);
    });
  }

  /* This week's listening, written every fifteen minutes by the Action in
     .github/workflows/listening.yml. The section stays hidden unless
     there is something to show. Links must go to Spotify and pictures
     must be https, whatever the file says. */
  var listening = document.querySelector('[data-listening]');
  if (listening && window.fetch) {
    var src = listening.getAttribute('data-src');
    /* A local preview can point it at a sample: ?listening=/path.json */
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    var override = new URLSearchParams(location.search).get('listening');
    if (local && override && override.charAt(0) === '/') src = override;

    var spotify = function (url) { return /^https:\/\/open\.spotify\.com\//.test(url || '') ? url : null; };
    var https = function (url) { return /^https:\/\//.test(url || '') || (local && /^\//.test(url || '')) ? url : null; };
    var el = function (tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    var fill = function (list, items, by) {
      items.forEach(function (item, i) {
        var li = el('li');
        var href = spotify(item.url);
        var row = el(href ? 'a' : 'div', 'play');
        if (href) { row.href = href; row.target = '_blank'; row.rel = 'noopener'; }
        row.appendChild(el('span', 'play__n mono', (i < 9 ? '0' : '') + (i + 1)));
        var art = el('img', 'play__art');
        art.alt = '';
        art.loading = 'lazy';
        if (https(item.image)) art.src = item.image;
        row.appendChild(art);
        var text = el('span', 'play__text');
        text.appendChild(el('span', 'play__name', item.name));
        if (by && item.artists) text.appendChild(el('span', 'play__by', item.artists));
        row.appendChild(text);
        row.appendChild(el('span', 'play__count mono', item.plays + (item.plays === 1 ? ' play' : ' plays')));
        li.appendChild(row);
        list.appendChild(li);
      });
    };
    var range = function (from, to) {
      var f = new Date(from + 'T12:00:00Z');
      var t = new Date(to + 'T12:00:00Z');
      var md = { month: 'short', day: 'numeric', timeZone: 'UTC' };
      var start = f.toLocaleDateString('en-US', md);
      var end = f.getUTCMonth() === t.getUTCMonth()
        ? t.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
        : t.toLocaleDateString('en-US', md);
      return start + ' \u2013 ' + end;
    };
    fetch(src, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (!data || !data.tracks || !data.tracks.length) return;
        fill(listening.querySelector('[data-listening-tracks]'), data.tracks.slice(0, 5), true);
        fill(listening.querySelector('[data-listening-artists]'), (data.artists || []).slice(0, 5), false);
        /* Until a full seven days have been counted it is "right now",
           since when; after that, "this week" and its dates. */
        var span = (Date.parse(data.to) - Date.parse(data.from)) / 864e5 + 1;
        var week = span >= 7;
        var since = new Date(data.from + 'T12:00:00Z')
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        listening.querySelector('[data-listening-title]').textContent =
          week ? 'On repeat this week' : 'On repeat right now';
        listening.querySelector('[data-listening-range]').textContent =
          (week ? range(data.from, data.to) : 'Since ' + since) + ', from Spotify';
        listening.hidden = false;
      })
      .catch(function () {});
  }

  /* Photographs: pin the strip and turn vertical scroll into sideways
     travel. Below 900px, or with reduced motion, it is a swipe strip. */
  var gallery = document.querySelector('[data-gallery]');
  if (!gallery) return;
  var track = gallery.querySelector('[data-track]');
  var bar = gallery.querySelector('[data-bar]');
  var count = gallery.querySelector('[data-count]');
  var shots = track.querySelectorAll('figure.shot');
  var travel = 0;
  function pinned() { return !still && innerWidth > 900 && innerHeight > 520; }
  function scroll() {
    if (!pinned()) return;
    var p = Math.min(1, Math.max(0, -gallery.getBoundingClientRect().top / (travel || 1)));
    track.style.transform = 'translate3d(' + (-p * travel) + 'px,0,0)';
    bar.style.transform = 'scaleX(' + p + ')';
    var k = Math.min(shots.length, Math.floor(p * shots.length) + 1);
    count.textContent = (k < 10 ? '0' : '') + k + ' / ' + shots.length;
  }
  function measure() {
    if (!pinned()) {
      gallery.classList.add('static');
      gallery.style.height = '';
      track.style.transform = '';
      return;
    }
    gallery.classList.remove('static');
    travel = Math.max(0, track.scrollWidth - innerWidth);
    gallery.style.height = (innerHeight + travel) + 'px';
    scroll();
  }
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', measure);
  track.querySelectorAll('img').forEach(function (img) { img.addEventListener('load', measure); });
  measure();
})();
