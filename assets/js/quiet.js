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
      wave.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
      head.parentNode.insertBefore(wave, head.nextSibling);
    }
    var mark = function () { live.classList.toggle('qu-live', !!head && /now/i.test(head.textContent)); };
    mark();
    if (head) new MutationObserver(mark).observe(head, { childList: true, characterData: true, subtree: true });

    // the waveform takes the album's colour: the cover's most vivid hue,
    // kept dark enough to show on the paper
    var art = live.querySelector('[data-listening-art]');
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
          var d = cx.getImageData(0, 0, n, n).data, bins = {}, best = null;
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
            if (mx < 0.12 || mx > 0.98 && s < 0.08) continue;
            var h = 0;
            if (mx !== mn) {
              h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
              h = (h * 60 + 360) % 360;
            }
            var k = s < 0.15 ? 'grey' : String(Math.round(h / 15)), w = 0.05 + s * s;
            var o = bins[k] || (bins[k] = { w: 0, r: 0, g: 0, b: 0 });
            o.w += w; o.r += r * w; o.g += g * w; o.b += b * w;
          }
          for (var key in bins) if (!best || bins[key].w > best.w) best = bins[key];
          if (!best) return;
          var R = best.r / best.w, G = best.g / best.w, B = best.b / best.w;
          // to HSL, lightness held between 0.32 and 0.56
          var M = Math.max(R, G, B), m = Math.min(R, G, B), L = (M + m) / 2, S = 0, H = 0;
          if (M !== m) {
            S = L > 0.5 ? (M - m) / (2 - M - m) : (M - m) / (M + m);
            H = M === R ? (G - B) / (M - m) + (G < B ? 6 : 0) : M === G ? (B - R) / (M - m) + 2 : (R - G) / (M - m) + 4;
            H *= 60;
          }
          L = Math.min(0.56, Math.max(0.32, L));
          live.style.setProperty('--qu-live', 'hsl(' + H.toFixed(0) + ' ' + (S * 100).toFixed(0) + '% ' + (L * 100).toFixed(0) + '%)');
        } catch (e) {}
      };
      im.src = src;
    };
    if (art) {
      tint();
      new MutationObserver(tint).observe(art, { attributes: true, attributeFilter: ['src'] });
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
