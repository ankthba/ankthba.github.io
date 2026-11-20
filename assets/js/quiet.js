/* quiet.js, after the page (the site's look since 2026-11): the profiles as words (an
   "Elsewhere" list on the home page, a line in the footer elsewhere),
   and the home page's section names. */
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
  if (!home) {
    var foot = document.querySelector('.colophon__inner');
    if (foot) foot.appendChild(words());
    return;
  }
  // now playing: mark the row while a song is actually playing
  var live = home.querySelector('[data-listening]');
  if (live) {
    var head = live.querySelector('[data-listening-heading]');
    // the waveform that shows while a song is playing (quiet.css .qu-wave)
    if (head && !live.querySelector('.qu-wave')) {
      var wave = document.createElement('span');
      wave.className = 'qu-wave';
      wave.setAttribute('aria-hidden', 'true');
      // seven round-capped lines in an svg, placed by percentages so the
      // drawing follows the font size (quiet.css sizes the svg)
      var lines = '';
      for (var li = 0; li < 7; li++) {
        var lx = ((2 * li + 0.5) / 13 * 100).toFixed(3) + '%';
        lines += '<line x1="' + lx + '" x2="' + lx + '" y1="50%" y2="50%"/>';
      }
      wave.innerHTML = '<svg focusable="false">' + lines + '</svg>';
      head.parentNode.insertBefore(wave, head.nextSibling);
    }
    // the bars move as if to music. The page can't hear the song, so it
    // keeps a beat of its own: a tempo taken from the song's name (so each
    // song has its own, and keeps it), counted in sixteenths, with hits
    // most likely and hardest on the beat, lighter off it, and now and
    // then a quick one in between. Each hit throws the bars up by a
    // different amount around a peak that wanders about the middle; they
    // rise fast and fall back slower, as a level meter does, onto a low
    // restless floor. Every few bars the whole thing gets louder or
    // quieter. Each bar is an svg line with round caps, so its ends move
    // by fractions of a pixel (a line of no length is a dot).
    var bars = live.querySelectorAll('.qu-wave line');
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var REST = [0.2, 0.5, 0.82, 1, 0.8, 0.48, 0.2];
    var named = live.querySelector('[data-listening-name]');
    var raf = 0, last = 0, step = 0, nextStep = 0, sixteenth = 0.125, loud = 0.9, song = null;
    var hit = [], lvl = [];
    // v is 0..1 of the full height; the caps add the bar's width to it
    var draw = function (bar, v) {
      var half = Math.max(0, Math.min(1, v)) * 44;
      bar.setAttribute('y1', (50 - half).toFixed(2) + '%');
      bar.setAttribute('y2', (50 + half + 0.01).toFixed(2) + '%');
    };
    for (var bi = 0; bi < bars.length; bi++) { hit.push(0); lvl.push(REST[bi] * 0.8); draw(bars[bi], lvl[bi]); }
    var tempo = function () {
      var name = named ? named.textContent : '';
      if (name === song) return;
      song = name;
      var h = 7;
      for (var c = 0; c < name.length; c++) h = (h * 31 + name.charCodeAt(c)) % 9973;
      sixteenth = 60 / (88 + h % 50) / 4;   // 88 to 137 beats a minute
    };
    var strike = function () {
      var pos = step % 16;
      if (pos === 0) tempo();
      // every two bars, a new loudness; now and then a quiet stretch
      if (step % 32 === 0) loud = Math.random() < 0.15 ? 0.5 + Math.random() * 0.15 : 0.82 + Math.random() * 0.18;
      var chance = pos % 4 === 0 ? 0.96 : pos % 2 === 0 ? 0.6 : 0.2;
      var force = pos === 0 ? 1.3 : pos % 8 === 0 ? 1.2 : pos % 4 === 0 ? 1.08 : pos % 2 === 0 ? 0.8 : 0.6;
      step++;
      if (Math.random() > chance) return;
      force *= loud * (0.95 + 0.2 * Math.random());
      var peak = 3 + (Math.random() - 0.5) * 2.6;
      for (var i = 0; i < bars.length; i++) {
        var d = (i - peak) / 2.2;
        var h = force * (0.14 + 0.86 * Math.exp(-d * d)) * (0.78 + 0.22 * Math.random());
        if (h > 1) h = 1;
        if (h > hit[i]) hit[i] = h;
      }
    };
    var frame = function (now) {
      raf = requestAnimationFrame(frame);
      var t = now / 1000, dt = Math.min(0.1, t - last || 0.016);
      last = t;
      if (t - nextStep > 0.5) nextStep = t;   // back from a hidden tab
      while (t >= nextStep) { strike(); nextStep += sixteenth; }
      var fall = Math.exp(-dt / 0.26);
      for (var i = 0; i < bars.length; i++) {
        hit[i] *= fall;
        var floor = REST[i] * loud * (0.3 + 0.07 * Math.sin(t * 3.1 + i * 1.9) + 0.04 * Math.sin(t * 4.7 - i * 2.7));
        var goal = Math.max(hit[i], floor);
        lvl[i] += (goal - lvl[i]) * (1 - Math.exp(-dt / (goal > lvl[i] ? 0.02 : 0.07)));
        // a little over, since a rising bar never quite catches a falling hit
        draw(bars[i], lvl[i] * 1.18);
      }
    };
    var mark = function () {
      var on = !!head && /now/i.test(head.textContent);
      live.classList.toggle('qu-live', on);
      if (on && !raf && !still && bars.length) raf = requestAnimationFrame(frame);
      else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    mark();
    if (head) new MutationObserver(mark).observe(head, { childList: true, characterData: true, subtree: true });

    // the waveform takes the album's colours, as the real one does: up to
    // three of the colours that cover most of it, muted ones included, in
    // the order they sit across the cover, run as one gradient over the
    // bars. Their lightness is held to what shows on the page: pale on the
    // dark theme (as on the Island's black), deeper on the light one.
    var root = document.documentElement;
    var dark = function () {
      var t = root.getAttribute('data-theme');
      return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    };
    var art = live.querySelector('[data-listening-art]');
    var hsl = function (R, G, B) {
      var M = Math.max(R, G, B), m = Math.min(R, G, B), L = (M + m) / 2, S = 0, Hh = 0;
      if (M !== m) {
        S = L > 0.5 ? (M - m) / (2 - M - m) : (M - m) / (M + m);
        Hh = M === R ? (G - B) / (M - m) + (G < B ? 6 : 0) : M === G ? (B - R) / (M - m) + 2 : (R - G) / (M - m) + 4;
        Hh *= 60;
      }
      var lo = dark() ? 0.62 : 0.4, hi = dark() ? 0.8 : 0.6;
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
          for (var q = 0; q < 3; q++) live.style.setProperty('--qu-c' + (q + 1), css(cols[q]));
        } catch (e) {}
      };
      im.src = src;
    };
    if (art) {
      tint();
      new MutationObserver(tint).observe(art, { attributes: true, attributeFilter: ['src'] });
      new MutationObserver(tint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
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
