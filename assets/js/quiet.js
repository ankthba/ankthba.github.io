/* quiet.js, after the page (the site's look since 2026-11): the profiles as words (an
   "Elsewhere" list on the home page, a line in the footer elsewhere),
   the home page's section names, and the waveform beside a song that is
   playing (home page and music page). */
(function () {
  var home = document.querySelector('.sheet--home');
  var social = document.querySelector('.masthead .social') || document.querySelector('.colophon .social');
  function words() {
    var p = document.createElement('p');
    p.className = 'qu-elsewhere';
    if (!social) return p;
    social.querySelectorAll('a').forEach(function (a) {
      var w = document.createElement('a');
      w.href = a.href;
      w.target = '_blank';
      w.rel = 'noopener';
      w.textContent = a.getAttribute('aria-label') || a.title;
      p.appendChild(w);
    });
    return p;
  }

  /* The waveform beside a song that is playing, after the now-playing
     one in the Mac's notch and the iPhone's Dynamic Island (quiet.css
     .qu-wave): five round-ended bars in the album's colours.

     The motion is copied from a recording of the real one, measured
     frame by frame: five times a second every bar is given a new height
     at once, each its own, anywhere from a dot to the full height, and
     glides straight to it in the fifth of a second before the next. The
     bars have nothing to do with their neighbours. The real one takes its
     heights from the sound; the page can't hear the song, so these are
     drawn at random, staying put about a time in four as the real one
     does on a held note.

       host   takes the colours (--qu-c1..3)
       wave   the empty .qu-wave span
       art    the cover, an <img>, whose colours it takes
       on     says whether a song is playing now
       watch  [node, MutationObserver options] that change when it does */
  function waveform(o) {
    var host = o.host, wave = o.wave, art = o.art;
    var N = 5, TICK = 0.2, REST = [0.4, 0.8, 0.55, 0.95, 0.3];
    var lines = '';
    for (var k = 0; k < N; k++) {
      var x = ((2 * k + 0.5) / (2 * N - 1) * 100).toFixed(3) + '%';
      lines += '<line x1="' + x + '" x2="' + x + '" y1="50%" y2="50%"/>';
    }
    wave.innerHTML = '<svg focusable="false">' + lines + '</svg>';
    var bars = wave.querySelectorAll('line');
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // v is 0..1: a dot to the full height (the round caps add the width)
    var draw = function (bar, v) {
      var half = Math.max(0, Math.min(1, v)) * 44;
      bar.setAttribute('y1', (50 - half).toFixed(2) + '%');
      bar.setAttribute('y2', (50 + half + 0.01).toFixed(2) + '%');
    };
    var from = [], to = [], raf = 0, tick = 0;
    for (var b = 0; b < N; b++) { from.push(REST[b]); to.push(REST[b]); draw(bars[b], REST[b]); }
    var next = function () {
      for (var i = 0; i < N; i++) {
        from[i] = to[i];
        to[i] = Math.random() < 0.25
          ? Math.max(0, Math.min(1, to[i] + (Math.random() - 0.5) * 0.12))
          : Math.pow(Math.random(), 1.15);
      }
    };
    var frame = function (now) {
      raf = requestAnimationFrame(frame);
      var t = now / 1000;
      if (t - tick > 1) { tick = t; next(); }   // first frame, or back from a hidden tab
      while (t - tick >= TICK) { tick += TICK; next(); }
      var u = (t - tick) / TICK;
      for (var i = 0; i < N; i++) draw(bars[i], from[i] + (to[i] - from[i]) * u);
    };
    var mark = function () {
      var on = !!o.on();
      if (o.mark) o.mark(on);
      if (on && !raf && !still) raf = requestAnimationFrame(frame);
      else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    mark();
    if (o.watch) new MutationObserver(mark).observe(o.watch[0], o.watch[1]);

    // the album's colours, as the real one takes them: up to three of the
    // colours that cover most of the cover, muted ones included, in the
    // order they sit across it, run as a gradient over the bars. Their
    // lightness is held to what shows on the off-white page.
    var root = document.documentElement;
    var hsl = function (R, G, B) {
      var M = Math.max(R, G, B), m = Math.min(R, G, B), L = (M + m) / 2, S = 0, Hh = 0;
      if (M !== m) {
        S = L > 0.5 ? (M - m) / (2 - M - m) : (M - m) / (M + m);
        Hh = M === R ? (G - B) / (M - m) + (G < B ? 6 : 0) : M === G ? (B - R) / (M - m) + 2 : (R - G) / (M - m) + 4;
        Hh *= 60;
      }
      var lo = 0.4, hi = 0.6;
      return [Hh, S, Math.min(hi, Math.max(lo, L))];
    };
    var css = function (c) {
      return 'hsl(' + ((c[0] % 360 + 360) % 360).toFixed(0) + ' ' + (c[1] * 100).toFixed(0) + '% ' + (c[2] * 100).toFixed(0) + '%)';
    };
    var tint = function () {
      var src = art && art.getAttribute('src');
      if (!src) return;
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var n = 24, cv = document.createElement('canvas');
          cv.width = cv.height = n;
          var cx = cv.getContext('2d');
          cx.drawImage(im, 0, 0, n, n);
          var d = cx.getImageData(0, 0, n, n).data, bins = {};
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
            if (mx < 0.12 || mx > 0.98 && s < 0.08) continue;
            var h = 0;
            if (mx !== mn) {
              h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
              h = (h * 60 + 360) % 360;
            }
            var grey = s < 0.15, k = grey ? 'grey' : String(Math.round(h / 15) % 24), w = 0.3 + s;
            var o = bins[k] || (bins[k] = { k: grey ? -1 : +k, w: 0, r: 0, g: 0, b: 0, x: 0 });
            o.w += w; o.r += r * w; o.g += g * w; o.b += b * w; o.x += ((i / 4) % n) * w;
          }
          var all = [];
          for (var key in bins) all.push(bins[key]);
          if (!all.length) return;
          all.sort(function (p, q) { return q.w - p.w; });
          // the heaviest, then others that are clearly a different hue and
          // not a trace
          var picks = [all[0]];
          for (var j = 1; j < all.length && picks.length < 3; j++) {
            var c = all[j];
            if (c.w < all[0].w * 0.12) continue;
            var far = picks.every(function (p) {
              if (p.k < 0 || c.k < 0) return true;
              var dk = Math.abs(p.k - c.k);
              return Math.min(dk, 24 - dk) >= 2;
            });
            if (far) picks.push(c);
          }
          picks.sort(function (p, q) { return p.x / p.w - q.x / q.w; });
          var cols = picks.map(function (p) { return hsl(p.r / p.w, p.g / p.w, p.b / p.w); });
          if (cols.length === 1) {
            // one-colour cover: the same hue, leaning a little either way
            var one = cols[0];
            cols = [[one[0] - 14, one[1], one[2] - 0.04], one, [one[0] + 14, one[1], one[2] + 0.05]];
          } else if (cols.length === 2) {
            cols = [cols[0], cols[1], cols[0]];
          }
          for (var q = 0; q < 3; q++) host.style.setProperty('--qu-c' + (q + 1), css(cols[q]));
        } catch (e) {}
      };
      im.src = src;
    };
    if (art) {
      tint();
      new MutationObserver(tint).observe(art, { attributes: true, attributeFilter: ['src'] });
    }
  }

  // the music page: beside "Playing now" (music.js sets .is-live)
  var now = document.querySelector('.now[data-now]');
  var nowWave = now && now.querySelector('.qu-wave');
  if (nowWave) {
    waveform({
      host: now, wave: nowWave, art: now.querySelector('[data-now-img]'),
      on: function () { return now.classList.contains('is-live'); },
      watch: [now, { attributes: true, attributeFilter: ['class'] }]
    });
  }

  if (!home) {
    var foot = document.querySelector('.colophon__inner');
    if (foot) foot.appendChild(words());
    return;
  }
  // the home page: the listening row, marked while a song is playing
  var live = home.querySelector('[data-listening]');
  var head = live && live.querySelector('[data-listening-heading]');
  if (head && !live.querySelector('.qu-wave')) {
    var wave = document.createElement('span');
    wave.className = 'qu-wave';
    wave.setAttribute('aria-hidden', 'true');
    head.parentNode.insertBefore(wave, head.nextSibling);
    waveform({
      host: live, wave: wave, art: live.querySelector('[data-listening-art]'),
      on: function () { return /now/i.test(head.textContent); },
      mark: function (on) { live.classList.toggle('qu-live', on); },
      watch: [head, { childList: true, characterData: true, subtree: true }]
    });
  }

  var main = home.querySelector('.page--home');
  if (!main) return;
  function heading(text, cls) {
    var h = document.createElement('h2');
    h.className = 'qu-h ' + cls;
    h.textContent = text;
    main.appendChild(h);
    return h;
  }
  heading('Pages', 'qu-h--pages');
  heading('Elsewhere', 'qu-h--else');
  var w = words();
  w.classList.add('qu-elsewhere--home');
  main.appendChild(w);
})();
