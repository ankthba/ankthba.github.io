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
      wave.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
      head.parentNode.insertBefore(wave, head.nextSibling);
    }
    // the bars move like the ones in the Dynamic Island: tallest in the
    // middle and down to dots at the ends, each riding a few slow waves
    // that never line up, offset from its neighbours so the movement
    // travels along the row, the whole lot swelling and easing together.
    // Nothing jumps: the height is a smooth function of time, and it is
    // drawn by clipping a full-height bar (quiet.css, --v), which moves by
    // fractions of a pixel and keeps the round ends round.
    var bars = live.querySelectorAll('.qu-wave i');
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ENV = [0.2, 0.52, 0.86, 1, 0.84, 0.5, 0.2], TAU = Math.PI * 2;
    var raf = 0;
    var frame = function (now) {
      raf = requestAnimationFrame(frame);
      var t = now / 1000;
      // slow shared energy, about 0.75..1
      var energy = 0.87 + 0.09 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 0.47 + 1.3);
      for (var i = 0; i < bars.length; i++) {
        var n = 0.5 +
          0.27 * Math.sin(TAU * 0.83 * t - i * 0.95) +
          0.15 * Math.sin(TAU * 1.37 * t + i * 1.7 + 1.1) +
          0.08 * Math.sin(TAU * 2.11 * t - i * 2.6 + 2.3);
        var v = ENV[i] * energy * (0.3 + 0.7 * n);
        bars[i].style.setProperty('--v', Math.max(0.12, Math.min(1, v)).toFixed(4));
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
