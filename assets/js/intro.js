/* The home page's opening.

   The screen is empty but for the name, large in the middle, coming
   up as a jumble of letters cut out of the page's painting: each
   letter is a window onto the same picture, so across the whole name
   you see one painting through the type. The letters keep changing
   until, one by one, they settle into the name, and as each settles
   the painting in it gives way to ink. Then the name goes to its place
   at the head of the page while the painting and the rest come in
   round it. It moves the name itself, not a copy, so it always lands
   exactly where the page has set it.

   The script in the page's head decides before the first paint whether
   to play it (once a visit, when the site is entered here rather than
   from another of its pages, and when motion is allowed; ?intro plays
   it again) and holds the page back with .intro. Any key, click, touch
   or scroll hurries it along. */

'use strict';

(function () {
  var root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  var name = document.querySelector('.masthead__name');
  var art = document.querySelector('.split__img');
  var TEXT = name ? name.textContent : '';
  // the jumble: letters of the same case as the one they stand for, none
  // that drop below the line, so the name keeps its outline
  var LOWER = 'abcdefhiklmnorstuvwxz';
  var UPPER = 'ABCDEFGHIKLMNOPRSTUVWXYZ';
  var EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';     // in and out, for the move
  var OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';       // a long settle, for arrivals
  var ZOOM = 1.6;                     // how much of the painting each letter shows

  // when things happen, in ms from the start
  var TYPE = 150, TYPE_EACH = 40;     // each letter comes up
  var SET = 1050, SET_EACH = 55;      // and each settles into its own
  var INK = 900;                      // the painting in it gives way to ink
  var MOVE = 2600, MOVE_FOR = 1150;   // then the name goes to its place
  var REVEAL = 2800;                  // the painting dissolves in as it goes
  var REST = 3300;                    // and the rest comes in round it

  var HURRY = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
  var anims = [];
  var slots = null;
  var speed = 1;

  function hurry() {
    speed = 5;
    anims.forEach(function (a) {
      if (a.updatePlaybackRate) a.updatePlaybackRate(5);
      else a.playbackRate = 5;
    });
  }

  // the name back as plain text, exactly as the page set it
  function settle() {
    if (!slots) return;
    slots = null;
    name.textContent = TEXT;
    name.removeAttribute('aria-hidden');
  }

  function finish() {
    settle();
    root.classList.remove('intro', 'intro-play');
    root.classList.add('intro-done');
    name.style.transformOrigin = '';
    HURRY.forEach(function (t) { window.removeEventListener(t, hurry, true); });
  }

  if (!name || !name.animate || !TEXT) { finish(); return; }

  /* Where in the painting (as fractions of its width and height) a
     window this big holds the richest paint: dark enough to read on
     the page, and saturated. A coarse look at a small copy. */
  function richest(fw, fh) {
    var fallback = [(1 - fw) / 2, (1 - fh) / 2];
    if (!art || !art.complete || !art.naturalWidth) return fallback;
    try {
      var w = 48, h = Math.max(8, Math.round(48 * art.naturalHeight / art.naturalWidth));
      var cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      var g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(art, 0, 0, w, h);
      var d = g.getImageData(0, 0, w, h).data;
      var score = new Float32Array(w * h);
      for (var i = 0; i < w * h; i++) {
        var r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
        var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        var light = 0.3 * r + 0.59 * gg + 0.11 * b;
        score[i] = (1 - light) * 0.8 + (mx - mn) * 0.7;
      }
      var best = -1, at = fallback;
      for (var fy = 0; fy <= 1 - fh + 1e-6; fy += Math.max(0.02, (1 - fh) / 12)) {
        for (var fx = 0; fx <= 1 - fw + 1e-6; fx += Math.max(0.02, (1 - fw) / 8)) {
          var x0 = Math.floor(fx * w), x1 = Math.ceil((fx + fw) * w);
          var y0 = Math.floor(fy * h), y1 = Math.ceil((fy + fh) * h);
          var sum = 0, n = 0;
          for (var y = y0; y < y1; y++) {
            for (var x = x0; x < x1; x++) { sum += score[y * w + x]; n++; }
          }
          if (n && sum / n > best) { best = sum / n; at = [fx, fy]; }
        }
      }
      return at;
    } catch (e) {
      return fallback;
    }
  }

  /* Each letter in a box exactly as wide as its own advance (the step
     to the next letter on the same line, kerning and all), so the
     jumble never moves the name and handing back the plain text moves
     nothing either. Each word's letters are held together, so the name
     only breaks between words, where it does as plain text. Each
     letter shows the part of the painting behind where it sits. */
  function jumble() {
    var node = name.firstChild;
    var range = document.createRange();
    var box = name.getBoundingClientRect();
    var rects = TEXT.split('').map(function (ch, i) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      return range.getBoundingClientRect();
    });
    var widths = rects.map(function (r, i) {
      var next = rects[i + 1];
      return next && Math.abs(next.top - r.top) < 1 && TEXT[i + 1] !== ' ' ? next.left - r.left : r.width;
    });

    var src = art ? (art.currentSrc || art.src) : '';
    var iw = art && art.naturalWidth || 4, ih = art && art.naturalHeight || 3;
    var scale = Math.max(box.width / iw, box.height / ih) * ZOOM;
    var pw = iw * scale, ph = ih * scale;
    var spot = richest(box.width / pw, box.height / ph);
    var ox = -spot[0] * pw, oy = -spot[1] * ph;

    var cs = getComputedStyle(name);
    var c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var measure = function (set) { return set.split('').map(function (g) { return [g, c.measureText(g).width]; }); };
    var lower = measure(LOWER), upper = measure(UPPER);

    name.setAttribute('aria-hidden', 'true');
    name.textContent = '';
    slots = [];
    var word = null;
    TEXT.split('').forEach(function (ch, i) {
      if (ch === ' ') {
        name.appendChild(document.createTextNode(' '));
        word = null;
        return;
      }
      if (!word) {
        word = document.createElement('span');
        word.className = 'intro__word';
        name.appendChild(word);
      }
      var w = widths[i];
      var el = document.createElement('span');
      el.className = 'intro__ch';
      el.style.width = w + 'px';
      if (src) {
        el.style.backgroundImage = 'url("' + src + '")';
        el.style.backgroundSize = pw + 'px ' + ph + 'px';
      }
      word.appendChild(el);
      var near = (ch === ch.toLowerCase() ? lower : upper).slice()
        .sort(function (x, y) { return Math.abs(x[1] - w) - Math.abs(y[1] - w); })
        .slice(0, 8).map(function (g) { return g[0]; }).join('');
      slots.push({ el: el, ch: ch, near: near, on: TYPE + i * TYPE_EACH, set: SET + i * SET_EACH, next: 0, done: false });
    });

    // each letter's painting placed from where its box really is, room
    // round the glyph included, so the picture runs on unbroken
    if (src) {
      slots.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        s.el.style.backgroundPosition = (ox - (r.left - box.left)) + 'px ' + (oy - (r.top - box.top)) + 'px';
      });
    }
  }

  function scramble(clock) {
    if (!slots) return;
    var t = clock.currentTime;
    var now = performance.now();
    var left = 0;
    slots.forEach(function (s) {
      if (s.done) return;
      if (t >= s.set) {
        s.done = true;
        s.el.textContent = s.ch;
        s.el.classList.add('is-on', 'is-set');
        return;
      }
      left++;
      if (t < s.on || now < s.next) return;
      s.el.textContent = s.near.charAt(Math.floor(Math.random() * s.near.length));
      s.el.classList.add('is-on');
      s.next = now + 95 + Math.random() * 70;
    });
    if (left) requestAnimationFrame(function () { scramble(clock); });
    // let the last letter's ink come in before the spans go
    else setTimeout(settle, INK / speed + 50);
  }

  function play() {
    // too late to begin, the page having come in on its own, or opened
    // in a tab behind, where no one would see it
    if (performance.now() > 4000 || document.hidden) { finish(); return; }
    try {
      window.scrollTo(0, 0);
      jumble();

      // as large as fits in the middle of the screen, then to its place.
      // Centred on the letters themselves, not the heading's box, which
      // runs on past the end of the shorter line.
      var box = name.getBoundingClientRect();
      var range = document.createRange();
      range.selectNodeContents(name);
      var ink = range.getBoundingClientRect();
      var cx = ink.left + ink.width / 2, cy = ink.top + ink.height / 2;
      var k = Math.min(2.4, (window.innerWidth * 0.84) / ink.width, (window.innerHeight * 0.62) / ink.height);
      var dx = window.innerWidth / 2 - cx;
      var dy = window.innerHeight / 2 - cy;
      var away = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')';
      name.style.transformOrigin = (cx - box.left) + 'px ' + (cy - box.top) + 'px';

      // the name's clock is the one the jumble keeps to
      var end = MOVE + MOVE_FOR;
      var move = name.animate([
        { transform: away },
        { transform: away, offset: MOVE / end, easing: EASE },
        { transform: 'none' }
      ], { duration: end, fill: 'backwards' });
      anims.push(move);

      // as the name sets off, the painting dissolves in, sharp from the
      // first frame, settling from a touch large to its own size; then
      // the rest of the page rises in round it
      if (art) {
        anims.push(art.parentNode.animate([{ opacity: 0 }, { opacity: 1 }],
          { duration: 1800, delay: REVEAL, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'backwards' }));
        anims.push(art.animate([{ transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
          { duration: 3000, delay: REVEAL, easing: OUT, fill: 'backwards' }));
      }
      var page = Array.prototype.slice.call(document.querySelectorAll('.page > *'));
      page.concat([document.querySelector('.colophon')]).forEach(function (el, j) {
        if (!el) return;
        anims.push(el.animate([
          { opacity: 0, transform: 'translateY(0.9rem)' },
          { opacity: 1, transform: 'none' }
        ], { duration: 1100, delay: REST + j * 80, easing: OUT, fill: 'backwards' }));
      });

      root.classList.add('intro-play');
      root.classList.remove('intro');
      scramble(move);
      HURRY.forEach(function (t) { window.addEventListener(t, hurry, { capture: true, passive: true }); });
      Promise.all(anims.map(function (a) { return a.finished; })).then(finish, finish);
    } catch (e) {
      anims.forEach(function (a) { a.cancel(); });
      finish();
    }
  }

  // once the face is in (so the letters are measured where they will
  // stay) and the painting is (so the letters have something to show)
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var picture = !art || art.complete ? Promise.resolve() : new Promise(function (r) {
    art.addEventListener('load', r, { once: true });
    art.addEventListener('error', r, { once: true });
  });
  Promise.race([Promise.all([fonts, picture]), new Promise(function (r) { setTimeout(r, 1800); })])
    .then(function () { requestAnimationFrame(play); });
})();
