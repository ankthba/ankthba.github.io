/* The home page: the headline, the work, the photographs. */

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

  /* On a phone, or a tablet held upright, the headline's clauses stack
     (see style.css) and fill the first screen: the type is as large as
     it can be up to a comfortable size, and whatever height is left is
     shared out between the clauses. Measured once the fonts are in, and
     again only if the width changes, not when the browser's address bar
     slides away. */
  var stacked = matchMedia('(max-width: 700px), (max-width: 1023px) and (orientation: portrait)');
  var fitWidth = 0;
  function fit() {
    if (!stacked.matches) {
      title.style.fontSize = '';
      title.style.removeProperty('--cl-gap');
      fitWidth = 0;
      return;
    }
    if (innerWidth === fitWidth) return;
    fitWidth = innerWidth;
    var room = innerHeight - (title.getBoundingClientRect().top + scrollY) - 28;
    var clauses = title.querySelectorAll('.cl').length;
    var lo = 24, hi = Math.min(96, innerWidth * 0.1);
    title.style.setProperty('--cl-gap', '0px');
    while (hi - lo > 0.5) {
      var mid = (lo + hi) / 2;
      title.style.fontSize = mid + 'px';
      if (title.offsetHeight <= room) lo = mid; else hi = mid;
    }
    title.style.fontSize = lo + 'px';
    var spare = room - title.offsetHeight;
    title.style.setProperty('--cl-gap', Math.max(0, Math.min(spare / (clauses - 1), lo * 0.8)) + 'px');
  }
  addEventListener('resize', fit);

  /* The photographs in the headline open wider on hover, but only as far
     as their line has room for: one that ran past the edge would jump to
     the next line, lose the pointer, close, jump back, and flicker. */
  if (hover) {
    title.querySelectorAll('.inl').forEach(function (inl) {
      inl.addEventListener('mouseenter', function () {
        var em = parseFloat(getComputedStyle(inl).fontSize);
        var box = inl.getBoundingClientRect();
        var edge = title.getBoundingClientRect().right - parseFloat(getComputedStyle(title).paddingRight);
        var grow = Math.min(1.2 * em, edge - box.right - 0.35 * em);
        if (grow > 0.2 * em) {
          inl.style.width = (box.width + grow) + 'px';
        } else {
          /* No room left on the line: it grows where it stands instead,
             into the margin, without moving anything around it. */
          var scale = Math.min(1.4, 1 + (document.documentElement.clientWidth - 10 - box.right) / box.width);
          inl.style.transform = 'scale(' + Math.max(1, scale) + ')';
        }
        inl.classList.add('open');
      });
      inl.addEventListener('mouseleave', function () {
        inl.style.width = '';
        inl.style.transform = '';
        inl.classList.remove('open');
      });
    });
  }

  var started = false;
  function go() {
    if (started) return;
    started = true;
    fit();
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
     Spotify now, or was last, from the Worker the music page uses. The
     frame stays out of the sentence until there is a picture to put in
     it: if the Worker can't say, the cover of the song most on repeat
     this week stands in (set below, once that file is in). */
  var liveLink = document.querySelector('[data-live-link]');
  var standIn = null;
  var showCover = null;
  if (liveLink && window.fetch) {
    var cover = liveLink.querySelector('[data-live-cover] img');
    var slot = cover.parentNode;
    var live = false;
    slot.hidden = true;
    cover.addEventListener('load', function () {
      slot.hidden = false;
      cover.classList.add('on');
    });
    cover.addEventListener('error', function () { slot.hidden = true; });
    showCover = function (src, title) {
      if (!/^https:\/\//.test(src || '')) return;
      if (title) liveLink.title = title;
      if (cover.getAttribute('src') !== src) cover.src = src;
    };
    var paint = function () {
      fetch('https://aniketh-now.ankthba.workers.dev/', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (now) {
          var item = now.playing && now.track ? now.track : (now.recent || [])[0];
          if (!item) return Promise.reject();
          live = true;
          showCover(item.cover || item.image,
            (now.playing ? 'Listening to ' : 'Last listened to ') + item.name + ' by ' + item.artists);
        })
        .catch(function () {
          if (!live && standIn) showCover(standIn.image, 'On repeat: ' + standIn.name + ' by ' + standIn.artists);
        });
    };
    paint();
    setInterval(function () { if (!document.hidden) paint(); }, 60000);
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
        /* The headline's stand-in cover, if the live one hasn't come. */
        standIn = data.tracks[0];
        if (showCover && !liveLink.querySelector('[data-live-cover] img').getAttribute('src')) {
          showCover(standIn.image, 'On repeat: ' + standIn.name + ' by ' + standIn.artists);
        }
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

  /* The headline's own details: the clock beside it, the name
     fitted to the page, its letters lifting towards the pointer. In a
     scope of their own, so their names can't meet the rest of this
     file's; the gallery code below returns early, so they come first. */
  (function () {
    /* The clock beside the headline, to the second. */
    var clock = document.querySelector('[data-hb-clock]');
    if (clock) {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZoneName: 'short'
      });
      var tick = function () { clock.textContent = fmt.format(new Date()); };
      tick();
      setInterval(tick, 1000);
    }

    /* The name runs the full width of the page: its size is measured
       against the headline once the fonts are in, and on every resize. */
    var nameEl = document.querySelector('[data-name]');
    var wide = matchMedia('(min-width: 701px)');
    var stackedQ = matchMedia('(max-width: 700px), (max-width: 1023px) and (orientation: portrait)');
    var fitName = function () {
      if (!nameEl) return;
      nameEl.style.fontSize = '';
      if (!wide.matches || stackedQ.matches) return;
      var title = nameEl.parentElement;
      var cs = getComputedStyle(title);
      var room = title.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var base = parseFloat(getComputedStyle(nameEl).fontSize);
      /* Measured at its own width, not the width of its column. */
      nameEl.style.width = 'max-content';
      nameEl.style.fontSize = '100px';
      var w = nameEl.getBoundingClientRect().width;
      nameEl.style.width = '';
      nameEl.style.fontSize = Math.min(base * 1.8, 100 * room / w * 0.99) + 'px';
    };
    if (document.fonts) document.fonts.ready.then(fitName);
    setTimeout(fitName, 950);
    addEventListener('resize', fitName);

    /* The name: each letter in a span of its own, lifting towards the
       pointer as it passes over the headline. */
    var name = document.querySelector('[data-name]');
    if (name && hover && !still) {
      var chars = [];
      name.querySelectorAll('.w > span').forEach(function (word) {
        var text = word.textContent;
        word.textContent = '';
        Array.prototype.forEach.call(text, function (c) {
          var ch = document.createElement('span');
          ch.className = 'ch';
          ch.textContent = c;
          word.appendChild(ch);
          chars.push(ch);
        });
      });
      var hero = document.querySelector('.hero');
      var raf = 0, mx = -1e4, my = -1e4;
      var draw = function () {
        raf = 0;
        chars.forEach(function (ch) {
          var r = ch.getBoundingClientRect();
          var dx = mx - (r.left + r.width / 2);
          var dy = my - (r.top + r.height / 2);
          var d = Math.sqrt(dx * dx + dy * dy);
          var pull = Math.max(0, 1 - d / 320);
          ch.style.transform = pull
            ? 'translateY(' + (-pull * 0.09).toFixed(3) + 'em) rotate(' + (dx > 0 ? -1 : 1) * pull * 3 + 'deg)'
            : '';
        });
      };
      hero.addEventListener('mousemove', function (e) {
        mx = e.clientX; my = e.clientY;
        if (!raf) raf = requestAnimationFrame(draw);
      });
      hero.addEventListener('mouseleave', function () {
        mx = my = -1e4;
        if (!raf) raf = requestAnimationFrame(draw);
      });
    }
  })();

  /* Photographs: pin the strip and turn vertical scroll into sideways
     travel. Below 900px, or with reduced motion, it is a swipe strip. */
  var gallery = document.querySelector('[data-gallery]');
  if (!gallery) return;
  var track = gallery.querySelector('[data-track]');
  var bar = gallery.querySelector('[data-bar]');
  var count = gallery.querySelector('[data-count]');
  var hint = gallery.querySelector('[data-hint]');
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
    /* Nothing left to scroll to, so no more asking. */
    hint.classList.toggle('done', p > 0.97);
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
