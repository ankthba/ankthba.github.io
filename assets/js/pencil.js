/* =========================================================
   pencil.js (home page)

   Sets the home page inside its picture, plays the opening (the name
   large in the middle, then rising into its place as the picture and
   the page slide up), and lets butterflies loose. The picture and the
   butterflies are set in type: every mark is a character, worked out
   afresh a dozen times a second. The art is in /assets/img/pencil/:

   - home-ascii.webp: the drawing of the foothills, small. It is never
     shown; it is read, a character's worth at a time, for how much
     pencil is there (its alpha) and in what colour. The hills, the oaks
     and the ridge are set from it; the wind in the grass, the clouds
     and the aeroplane are made up as they go.
   - butterfly-<kind>.webp: a butterfly seen from above, wings flat,
     body down the middle, on a clear ground. Each is turned, its two
     wings folded, and read into characters the same way, every frame.

   The butterflies fly anywhere, over the words too, but settle only
   on open paper, never on a line of text. In the air they
   hold their place in the window; landed, they sit on the paper and
   scroll with it. Come near one and it lifts off and away. For anyone
   who has asked for less motion the picture is set once and holds
   still, and the butterflies rest, wings open, and stay put.
   ========================================================= */

(function () {
  'use strict';

  var root = document.documentElement;
  var ART = '/assets/img/pencil/';
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  function load(src) {
    return new Promise(function (done) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        // decoded before it's shown, so its arrival never stutters
        (img.decode ? img.decode() : Promise.resolve()).then(function () { done(img); }, function () { done(img); });
      };
      img.onerror = function () { done(null); };
      img.src = src;
    });
  }

  /* ---------- The scene the page is set in ----------
     The home page's first screen is the picture: the name sits in its
     sky and the meadow runs off the edges and thins out into the paper,
     where the rest of the page carries on. */

  var MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';

  // a fixed scatter: the same number for the same cell, every time
  function hash(x, y) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // smooth noise between those numbers, and a few layers of it
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    return noise(x, y) * 0.55 + noise(x * 2.1 + 9.2, y * 2.1 + 3.7) * 0.3 + noise(x * 4.3 + 1.7, y * 4.3 + 8.1) * 0.15;
  }
  function ramp(t, a, b) {
    t = (t - a) / (b - a);
    return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  }

  var SKY = 1, RIDGE = 2, TREE = 3, GRASS = 4, MADE = 5;
  var DISH = ['\\_____/', ' `-.-\' ', ' /_|_\\ '];
  var SKY_INK = '#2f6fe0', CLOUD_INK = '#d98a4e', PLANE_INK = '#4a463f';
  var FAR = ' .:-=+*#';              // the ridge, light to heavy
  var LEAF = ' .:;oO8&@';            // the oaks
  var AIR = '-~-=~-';                // strokes of sky
  var FPS = 12;

  var scene = null, headBox = null, paint = null;
  var home = document.querySelector('.sheet--home');
  var art = root.getAttribute('data-scene') || ART + 'home-ascii.webp';
  var sceneReady = home ? load(art).then(function (drawing) {
    // no drawing after all: the page closes up to a plain one
    if (!drawing) { root.classList.remove('has-scene'); return null; }
    scene = document.createElement('div');
    scene.className = 'pencil-scene';
    scene.setAttribute('aria-hidden', 'true');
    var canvas = document.createElement('canvas');
    scene.appendChild(canvas);
    document.body.insertBefore(scene, document.body.firstChild);
    root.classList.add('has-scene');
    var ctx = canvas.getContext('2d');
    var reader = document.createElement('canvas');
    var rctx = reader.getContext('2d', { willReadFrequently: true });

    var cols = 0, rows = 0, cw = 0, ch = 0, fs = 0, W = 0, H = 0;
    var kind, ink, tint, grain, show, was;   // a cell each
    var head = null;                          // the words in the sky, in the scene's own px
    var mouse = { x: -9999, y: -9999 };
    var plane = { x: 0, y: 0, wait: 6 };

    // The grid, and the drawing read into it. The drawing is a vignette,
    // blown up so its faded sides and foot fall outside the window, and
    // placed so the Dish on the right-hand hill (its top 46% down the
    // drawing, its right side 84% across) is in view on every screen:
    // as wide as the window or one and a half times its height, but never
    // so wide that the sky is cropped down past the Dish; centred, unless
    // that puts the Dish past 88% of the window (phones), then moved left
    // just enough; and hung 7% low, so the meadow runs at full strength
    // to the scene's foot.
    function lay() {
      W = scene.clientWidth; H = scene.clientHeight;
      if (!W || !H) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      fs = W < 700 ? 10 : W < 1800 ? 12 : 14;
      ctx.font = '500 ' + fs + 'px ' + MONO;
      cw = ctx.measureText('MMMMMMMMMM').width / 10;
      ch = Math.round(fs * 1.3);
      cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '500 ' + fs + 'px ' + MONO;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      var edge = Math.min(Math.max(72, window.innerHeight * 0.14), 160);
      var w = Math.min(Math.max(W, window.innerHeight * 1.5), (H - edge - 24) * 1.5 / 0.46);
      var h = w / 1.5;
      var left = Math.min((W - w) / 2, Math.max(W - w, 0.88 * W - 0.84 * w));
      var top = H - h * 0.93;

      reader.width = cols; reader.height = rows;
      rctx.clearRect(0, 0, cols, rows);
      rctx.imageSmoothingQuality = 'high';
      rctx.drawImage(drawing, left / cw, top / ch, w / cw, h / ch);
      var px = rctx.getImageData(0, 0, cols, rows).data;

      var n = cols * rows, x, y, i, p;
      kind = new Uint8Array(n); ink = new Float32Array(n); grain = new Float32Array(n);
      show = new Float32Array(n); tint = new Array(n); was = new Array(n);

      // where the sky stops: down each column, the first of the dark blue ridge
      var skyline = [], r0 = Math.floor((top + h * 0.3) / ch), r1 = Math.ceil((top + h * 0.56) / ch);
      for (x = 0; x < cols; x++) {
        var at = -1;
        for (y = Math.max(0, r0); y < Math.min(rows, r1); y++) {
          p = (y * cols + x) * 4;
          if (px[p + 3] > 34 && px[p + 2] < 190 && px[p + 2] > px[p] && at < 0) { at = y; break; }
          if (px[p + 3] > 34 && px[p] > px[p + 2] + 30 && at < 0) { at = y; break; }   // or a hill, where there's no ridge
        }
        skyline.push(at < 0 ? Math.round((top + h * 0.42) / ch) : at);
      }
      // evened out, so one stray cloud doesn't notch it
      var even = skyline.map(function (v, k) {
        var near = skyline.slice(Math.max(0, k - 3), k + 4).sort(function (a, b) { return a - b; });
        return near[near.length >> 1];
      });

      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        i = y * cols + x; p = i * 4;
        var r = px[p], g = px[p + 1], b = px[p + 2], a = px[p + 3] / 255;
        var u = (x * cw + cw / 2 - left) / w, v = (y * ch + ch / 2 - top) / h;
        grain[i] = hash(x, y);
        // the scene's own top and foot: thinned out, a character here and there
        var yy = y * ch + ch / 2;
        show[i] = Math.min(ramp(yy, edge * 0.1, edge), ramp(H - yy, 0, edge * 0.8));
        if (y < even[x]) {
          // sky: the drawing's own ragged edge, drawn again, since the clouds move
          kind[i] = SKY;
          var side = Math.min(ramp(u, 0.02, 0.11), ramp(1 - u, 0.02, 0.11), ramp(v, 0.04, 0.15));
          ink[i] = u < 0 || u > 1 || v < 0 ? 0 : side;
          tint[i] = SKY_INK;
        } else if (a < 0.03) {
          kind[i] = 0;
        } else {
          var lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
          kind[i] = b > r + 20 ? RIDGE : lum < 0.3 ? TREE : GRASS;
          ink[i] = Math.min(1, a / 0.5);
          // a little deeper than drawn: a character is thinner than a pencil stroke
          // (the oaks are near black in the drawing's own pencil: lifted to a leaf green)
          var k = kind[i] === GRASS ? 0.9 : kind[i] === RIDGE ? 1 : Math.min(2.4, 0.27 / Math.max(lum, 0.05));
          if (kind[i] === TREE) g *= 1.12;
          // the shaded sides of the hills, set a little thicker
          if (kind[i] === GRASS) ink[i] *= 1 + (0.47 - lum) * 2.2;
          tint[i] = 'rgb(' + Math.round(r * k > 255 ? 255 : r * k) + ',' + Math.round(g * k > 255 ? 255 : g * k) + ',' + Math.round(b * k > 255 ? 255 : b * k) + ')';
        }
      }
      // The Dish on its hill is paper-white in the drawing, too pale to
      // read into type, so it is set by hand where the drawing has it.
      var dx = Math.round((left + w * 0.815) / cw) - 3, dy = Math.round((top + h * 0.528) / ch) - 2;
      DISH.forEach(function (line, j) {
        for (var c = 0; c < line.length; c++) {
          x = dx + c; y = dy + j;
          if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
          i = y * cols + x;
          kind[i] = line[c] === ' ' ? 0 : MADE;
          ink[i] = line.charCodeAt(c);
          tint[i] = PLANE_INK;
        }
      });
      for (i = 0; i < n; i++) was[i] = '';
      ctx.clearRect(0, 0, W, H);
    }

    // one cell for this moment: a character and its colour
    var out = { c: ' ', ink: '' };
    function cell(x, y, i, t) {
      out.c = ' '; out.ink = tint[i];
      var k = kind[i];
      if (!k) return;
      var s = show[i], q = grain[i], amt = ink[i];
      // paper shows through behind the words in the sky
      if (head) {
        var hx = (x * cw - head.x) / head.rx, hy = (y * ch - head.y) / head.ry, hd = hx * hx + hy * hy;
        if (hd < 1) s *= 0.06 + 0.94 * hd * hd * hd;
      }
      if (s < 1 && q > s * 1.05) return;
      if (k === MADE) { out.c = String.fromCharCode(amt); return; }

      if (k === SKY) {
        if (amt <= 0 || q > amt * 1.1) return;
        // clouds: gaps in the blue, drifting east, warm along their undersides
        var cx = x * cw / (fs * 15) - t * 0.012, cy = y * ch / (fs * 5.2);
        var c = fbm(cx, cy);
        var under = fbm(cx + 0.02, cy - 0.22);
        if (c > 0.6) {
          if (under < 0.585 && hash(x + 91, y) < 0.5) { out.c = hash(x, y + 57) < 0.5 ? '~' : '-'; out.ink = CLOUD_INK; }
          else if (hash(x + 17, y + 3) < 0.07) { out.c = '.'; out.ink = CLOUD_INK; }
          return;
        }
        if (c > 0.56) { if (q < 0.4) out.c = '.'; return; }
        // the blue itself: short strokes, most cells left as paper
        var d = hash(x + 7, y + 13);
        if (d > 0.74) return;
        var flick = noise(x * 0.31 + t * 0.07, y * 0.9 + 4);
        out.c = d > 0.62 ? '.' : AIR[Math.floor((d * 2 + flick) * 3) % AIR.length];
        return;
      }

      if (k === RIDGE) {
        out.c = FAR[Math.min(FAR.length - 1, Math.round(amt * 5.4 + (q - 0.5) * 2.2))] || ' ';
        return;
      }

      // the wind: gusts crossing the hills from the west, and a ripple round the cursor
      var gust = Math.sin(x * cw * 0.011 - t * 1.25 + Math.sin(y * ch * 0.021 + t * 0.4) * 1.6) +
                 (noise(x * cw * 0.02 - t * 0.5, y * ch * 0.04) - 0.5) * 1.6;
      var mx = x * cw - mouse.x, my = y * ch - mouse.y, md = mx * mx + my * my;
      if (md < 14400) gust += (mx > 0 ? 1.6 : -1.6) * (1 - md / 14400);

      if (k === TREE) {
        var leaf = amt * 7.2 + (q - 0.5) * 2.4 + (gust > 0.7 && q > 0.6 ? 1 : 0);
        out.c = LEAF[Math.max(1, Math.min(LEAF.length - 1, Math.round(leaf)))];
        return;
      }

      // grass: blades leaning with the gust, thinner where the pencil was lighter
      var thick = amt * 1.45 + (gust > 0.9 ? 0.1 : 0);
      if (q > thick) { if (q > 0.93) out.c = '.'; return; }
      var lean = gust + (q - 0.4) * 1.1;
      var kindOf = hash(x + 31, y + 77);
      if (kindOf < 0.26) out.c = lean > 0.75 ? '\'' : lean < -0.75 ? '`' : ',';
      else if (kindOf < 0.4) out.c = lean > 0.4 ? ';' : ':';
      else out.c = lean > 0.75 ? '/' : lean < -0.75 ? '\\' : kindOf > 0.9 ? '!' : '|';
    }

    // the aeroplane, now and then, climbing east with its trail behind it
    function fly(dt) {
      if (plane.wait > 0) {
        plane.wait -= dt;
        if (plane.wait <= 0) { plane.x = -4; plane.y = rows * (0.2 + Math.random() * 0.14); }
        return;
      }
      plane.x += dt * 2.6;
      plane.y -= dt * 0.22;
      if (plane.x > cols + 30) plane.wait = 25 + Math.random() * 35;
    }
    function planeAt(x, y) {
      if (plane.wait > 0) return '';
      var px = Math.floor(plane.x), back = px - x;
      if (back < 0 || back > 26) return '';
      // the trail sinks a row every so often behind it
      if (y !== Math.round(plane.y + back * 0.085)) return '';
      if (back === 0) return '>';
      if (back === 1) return '=';
      if (back === 2) return '-';
      if (back < 5) return '';
      return back < 12 ? '-' : back < 19 ? (back % 2 ? '-' : '') : (back % 3 ? '' : '.');
    }

    var then = 0;
    paint = function (t) {
      if (!cols) return;
      var dt = then ? Math.min(0.2, t - then) : 0;
      then = t;
      fly(dt);
      var x, y, i, c, key, tone;
      var last = '';
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        i = y * cols + x;
        cell(x, y, i, t);
        c = out.c; tone = out.ink;
        if (kind[i] === SKY) {
          var pl = planeAt(x, y);
          if (pl && show[i] > 0.5) { c = pl; tone = PLANE_INK; }
        }
        key = c === ' ' ? '' : c + tone;
        if (key === was[i]) continue;
        was[i] = key;
        ctx.clearRect(x * cw - 0.5, y * ch, cw + 1, ch);
        if (c === ' ') continue;
        if (tone !== last) { ctx.fillStyle = tone; last = tone; }
        ctx.fillText(c, x * cw + cw / 2, y * ch + ch / 2);
      }
    };

    // the paper behind the words is sized to the head as it will rest
    headBox = function () {
      var bits = document.querySelectorAll('.masthead--home .masthead__name, .masthead--home .masthead__role, .masthead--home .social');
      if (!bits.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      var rg = document.createRange();
      Array.prototype.forEach.call(bits, function (el) {
        // while the opening holds them a window's height down, count them where they'll rest
        var held = root.classList.contains('pencil-intro') && !el.matches('.masthead__name') ? window.innerHeight : 0;
        var take = function (r) {
          if (!r.width) return;
          x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right);
          y0 = Math.min(y0, r.top - held); y1 = Math.max(y1, r.bottom - held);
        };
        // the words themselves, not the boxes they sit in
        var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), node;
        while ((node = walk.nextNode())) {
          rg.selectNodeContents(node);
          Array.prototype.forEach.call(rg.getClientRects(), take);
        }
        Array.prototype.forEach.call(el.querySelectorAll('a'), function (link) { take(link.getBoundingClientRect()); });
      });
      if (x1 < x0) return;
      y0 += window.scrollY; y1 += window.scrollY;
      head = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: (x1 - x0) * 0.66 + 50, ry: (y1 - y0) * 0.78 + 36 };
      if (!running) once();
    };

    // a dozen settings a second while it's in view; set once and left for less motion
    var running = false, due = 0;
    function once() { paint(performance.now() / 1000); }
    function tick(now) {
      if (!running) return;
      if (now >= due) { due = now + 1000 / FPS; paint(now / 1000); }
      requestAnimationFrame(tick);
    }
    function go() {
      var seen = !document.hidden && window.scrollY < H;
      if (seen && !running && !still.matches) { running = true; then = 0; requestAnimationFrame(tick); }
      else if (!seen) running = false;
    }
    lay();
    if (!root.classList.contains('pencil-intro')) {
      headBox();
      if (document.fonts) document.fonts.ready.then(headBox);
    }
    once();
    go();
    window.addEventListener('scroll', go, { passive: true });
    document.addEventListener('visibilitychange', go);
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX; mouse.y = e.clientY + window.scrollY;
    }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.x = mouse.y = -9999; });
    var relay = 0, laidW = W, laidH = H;
    window.addEventListener('resize', function () {
      clearTimeout(relay);
      relay = setTimeout(function () {
        // a phone's address bar sliding away changes nothing here
        if (scene.clientWidth === laidW && scene.clientHeight === laidH) return;
        lay(); laidW = W; laidH = H;
        headBox();
        once();
      }, 150);
    });
    return scene;
  }) : Promise.resolve(null);

  /* ---------- There's more below ---------- */

  sceneReady.then(function (sc) {
    var below = document.querySelector('.page--home');
    if (!sc || !below) return;
    var cue = document.createElement('button');
    cue.type = 'button';
    cue.className = 'pencil-cue';
    cue.setAttribute('aria-label', 'Scroll to the rest of the page');
    // the chevron, two strokes of type like the rest
    cue.innerHTML = '<span class="pencil-cue__drawn" aria-hidden="true">\\/</span>';
    cue.addEventListener('click', function () {
      below.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'start' });
    });
    document.body.appendChild(cue);
    var seen = function () { root.classList.toggle('pencil-scrolled', window.scrollY > 60); };
    window.addEventListener('scroll', seen, { passive: true });
    seen();
  });

  /* ---------- The opening ----------
     The name alone, large in the middle of the empty page. Then it rises
     and shrinks into its place while the picture and the rest of the
     page slide up from the foot of the window, all on the one curve.
     Any key, click, touch or scroll skips to the end. */

  if (root.classList.contains('pencil-intro')) {
    var nameEl = document.querySelector('.masthead--home .masthead__name');
    var EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
    var HOLD = 1100, MOVE = 1150;
    var anims = [];
    var ended = false;
    var end = function () {
      if (ended) return;
      ended = true;
      anims.forEach(function (a) { try { a.finish(); } catch (e) {} });
      root.classList.add('pi-done');
      root.classList.remove('pencil-intro', 'pi-name', 'pi-rise');
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      setTimeout(function () { root.classList.remove('pi-done'); }, 400);
    };
    ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (t) {
      window.addEventListener(t, end, { once: true, capture: true, passive: true });
    });
    if (!nameEl || !nameEl.animate) end();
    else Promise.all([document.fonts ? document.fonts.ready : null, sceneReady]).then(function () {
      if (ended) return;
      if (headBox) headBox();
      // where the name will be, and where it starts: centred, large
      var r = nameEl.getBoundingClientRect();
      var vw = root.clientWidth, vh = window.innerHeight;
      var S = Math.min(2.4, (vw * 0.84) / r.width);
      var dx = (vw - r.width * S) / 2 - r.left;
      var dy = (vh - r.height * S) / 2 - r.top;
      var from = 'translate(' + dx + 'px,' + dy + 'px) scale(' + S + ')';
      nameEl.style.transformOrigin = '0 0';
      nameEl.style.transform = from;
      root.classList.add('pi-name');
      anims.push(nameEl.animate([{ opacity: 0, transform: from + ' translateY(0.15em)' }, { opacity: 1, transform: from }],
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }));
      setTimeout(function () {
        if (ended) return;
        nameEl.style.transform = '';
        anims.push(nameEl.animate([{ transform: from }, { transform: 'none' }], { duration: MOVE, easing: EASE, fill: 'both' }));
        var rise = [{ transform: 'translateY(' + vh + 'px)' }, { transform: 'none' }];
        document.querySelectorAll('.pencil-scene, .masthead--home .masthead__role, .masthead--home .social, .page--home, .sheet--home .colophon')
          .forEach(function (el) {
            anims.push(el.animate(rise, { duration: MOVE, easing: EASE, fill: 'both' }));
          });
        root.classList.add('pi-rise');
        setTimeout(end, MOVE + 30);
      }, HOLD);
    });
    setTimeout(end, 6000);   // never held back longer than this
  }

  /* ---------- Butterflies ---------- */

  var page = document.querySelector('.sheet--home .sheet__page');
  if (!page || !window.requestAnimationFrame) return;

  var KINDS = ['tiger', 'blue', 'orange', 'white'];

  Promise.all([sceneReady].concat(KINDS.map(function (k) {
    return load(ART + 'butterfly-' + k + '.webp');
  }))).then(function (got) {
    var sprites = got.slice(1).filter(Boolean);
    if (sprites.length) fly(sprites);
  });

  function fly(sprites) {
    var GAP = 26;               // kept clear round the words, px
    var EDGE = 16;              // and at the window's edge
    var SPEED = [55, 95];       // a calm flight, px/s
    var BEAT = [4.6, 6.2];      // wingbeats a second
    var UP = 82, DOWN = -26;    // wings raised over the back, and swept down, degrees
    var REST = [3, 9];          // seconds on the paper
    var AIR = [5, 14];          // seconds in the air between landings
    var ROAM = 380;             // how far it goes for its next spot, about
    var SHY = 120;              // how near the cursor may come, px
    var TURN = 5;               // how quickly a butterfly turns, rad/s
    // each is set in its own small grid of type
    var FS = 11, FONT = '700 ' + FS + 'px ' + MONO, CH = 11;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var CW = (function () {
      var c = document.createElement('canvas').getContext('2d');
      c.font = FONT;
      return c.measureText('MMMMMMMMMM').width / 10;
    })();
    var SHADE = [14, 22];       // the farthest its shadow falls, px
    var WING = ' .:-=+*%#@';    // light to heavy
    var SHADOW = 'rgba(96, 126, 176, 0.5)', PAPER = '#f4f3ee';
    var WORDS = '.masthead--home .masthead__name, .masthead--home .masthead__role, .masthead--home .social, ' +
                '.page--home .about__text p, .page--home .index, .colophon__inner';

    var vw = 0, vh = 0, blocks = [];
    var flock = [];
    var mouse = { x: -9999, y: -9999 };
    var deal = 0;

    function rand(a, b) { return a + Math.random() * (b - a); }

    // the words, as boxes in the window, each with a margin round it
    function measure() {
      vw = root.clientWidth;
      vh = window.innerHeight;
      blocks = [];
      Array.prototype.forEach.call(document.querySelectorAll(WORDS), function (el) {
        var r = el.getBoundingClientRect();
        if (!r.width || r.bottom < -GAP || r.top > vh + GAP) return;
        // a line of words is only as wide as its text
        var x1 = r.right;
        if (el.matches('.masthead__name, .masthead__role, .about__text p')) {
          var rg = document.createRange();
          rg.selectNodeContents(el);
          var rs = rg.getClientRects();
          x1 = r.left;
          for (var i = 0; i < rs.length; i++) x1 = Math.max(x1, rs[i].right);
        }
        blocks.push({ x0: r.left - GAP, x1: x1 + GAP, y0: r.top - GAP, y1: r.bottom + GAP });
      });
    }

    function over(x, y) {
      for (var i = 0; i < blocks.length; i++) {
        var k = blocks[i];
        if (x > k.x0 && x < k.x1 && y > k.y0 && y < k.y1) return k;
      }
      return null;
    }

    function free(x, y) { return !over(x, y); }

    // somewhere a little way off: anywhere in the air, over the words or
    // not; once it's ready to settle, a spot on open paper
    function pickTarget(b) {
      var settle = b.mode === 'fly' && b.clock <= 0;
      for (var i = 0; i < 40; i++) {
        var a = rand(0, Math.PI * 2), d = rand(ROAM * 0.35, ROAM);
        var x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
        if (x < EDGE + 30 || x > vw - EDGE - 30 || y < 50 || y > vh - 50) continue;
        if (!settle || free(x, y)) return { x: x, y: y };
      }
      for (i = 0; i < 40; i++) {
        x = rand(EDGE + 30, vw - EDGE - 30); y = rand(60, vh - 60);
        if (!settle || free(x, y)) return { x: x, y: y };
      }
      return { x: b.x, y: b.y };
    }

    function make(sprite) {
      var size = rand(76, 104) * (vw < 700 ? 0.8 : 1);
      var el = document.createElement('canvas');
      el.className = 'flutter';
      el.setAttribute('aria-hidden', 'true');
      // room to the right and below for its shadow
      var bw = Math.ceil((size + SHADE[0]) / CW), bh = Math.ceil((size + SHADE[1]) / CH);
      el.width = Math.round(bw * CW * DPR); el.height = Math.round(bh * CH * DPR);
      el.style.width = bw * CW + 'px'; el.style.height = bh * CH + 'px';
      var pen = el.getContext('2d');
      pen.setTransform(DPR, 0, 0, DPR, 0, 0);
      pen.font = FONT;
      pen.textBaseline = 'middle';
      pen.textAlign = 'center';
      // read at twice the grid, so each character is the mean of four
      var seen = document.createElement('canvas');
      seen.width = bw * 2; seen.height = bh * 2;
      document.body.appendChild(el);
      return {
        el: el, pen: pen, eye: seen.getContext('2d', { willReadFrequently: true }), sprite: sprite, bw: bw, bh: bh, size: size,
        x: 0, y: 0, vx: 0, vy: 0, z: 0.6,
        heading: rand(0, Math.PI * 2),
        stroke: rand(0, 1), beat: rand(BEAT[0], BEAT[1]), jit: 1, amp: 1,
        beats: Math.floor(rand(3, 8)), ang: 30, turnRate: 0,
        mode: 'fly', clock: rand(AIR[0], AIR[1]), glide: 0,
        speed: rand(SPEED[0], SPEED[1]), hurry: 0,
        seed: rand(0, 100), target: null
      };
    }

    // spread out: each new one as far as it can be from the others
    function place(b) {
      var best = null, score = -1;
      for (var i = 0; i < 30; i++) {
        var x = rand(EDGE + 40, vw - EDGE - 40), y = rand(70, vh - 70);
        if (!free(x, y)) continue;
        var near = Infinity;
        flock.forEach(function (o) { if (o !== b) near = Math.min(near, Math.hypot(o.x - x, o.y - y)); });
        if (near > score) { score = near; best = { x: x, y: y }; }
      }
      best = best || { x: EDGE + 40, y: vh / 2 };
      b.x = best.x; b.y = best.y;
    }

    function populate() {
      flock.forEach(function (b) { b.el.remove(); });
      flock = [];
      measure();
      var n = Math.max(2, Math.min(5, Math.round(vw * vh / 260000)));
      for (var i = 0; i < n; i++) {
        var b = make(sprites[deal++ % sprites.length]);
        flock.push(b);
        place(b);
        b.target = pickTarget(b);
      }
      if (still.matches) {
        flock.forEach(function (b) { land(b); b.z = 0; b.heading = rand(-0.4, 0.4); draw(b, 0); });
      }
    }

    // wholly inside the window, so one pinned to the page never widens it
    function inside(b) {
      var half = b.size / 2;
      return b.x > half + 2 && b.x < vw - half - 2 && b.y > half + 2 && b.y < vh - half - 2;
    }

    function land(b) {
      b.mode = 'rest';
      b.clock = rand(REST[0], REST[1]);
      b.vx = b.vy = 0;
      // Landed, it is on the paper: pinned to the page itself (see draw),
      // so the browser carries it with the words as they scroll. Moving it
      // from script each frame lagged behind a phone's fast scrolling.
      b.docY = b.y + window.scrollY;
    }

    function takeOff(b, away) {
      b.mode = 'fly';
      b.clock = rand(AIR[0], AIR[1]);
      b.target = pickTarget(b);
      if (away) {
        b.hurry = 1.4;
        var dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy) || 1;
        var t = { x: b.x + dx / d * rand(140, 220), y: b.y + dy / d * rand(140, 220) };
        t.x = Math.min(Math.max(t.x, EDGE + 30), vw - EDGE - 30);
        t.y = Math.min(Math.max(t.y, 50), vh - 50);
        b.target = t;
        b.vx += dx / d * 90;
        b.vy += dy / d * 90;
      }
    }

    function step(b, dt, t) {
      // startled by the cursor
      if (Math.hypot(b.x - mouse.x, b.y - mouse.y) < SHY && b.hurry < 0.3) takeOff(b, true);

      if (b.mode === 'rest') {
        b.clock -= dt;
        b.z += (0 - b.z) * Math.min(1, dt * 4);
        // the page scrolled words under it, or it off the window: up it goes
        if (!free(b.x, b.y) || b.y < -b.size || b.y > vh + b.size) {
          // from just past the window's edge, so it flies back in rather than appearing
          b.y = Math.min(Math.max(b.y, -b.size * 0.6), vh + b.size * 0.6);
          takeOff(b, false);
        } else if (b.clock <= 0) takeOff(b, false);
        return;
      }

      b.hurry = Math.max(0, b.hurry - dt);
      b.clock -= dt;
      var tx = b.target.x - b.x, ty = b.target.y - b.y, td = Math.hypot(tx, ty) || 1;
      if (td < 24 || (b.clock <= 0 && !free(b.target.x, b.target.y))) {
        if (td < 24 && b.clock <= 0 && free(b.x, b.y) && inside(b)) { land(b); return; }
        b.target = pickTarget(b);
        tx = b.target.x - b.x; ty = b.target.y - b.y; td = Math.hypot(tx, ty) || 1;
      }
      var sp = b.speed * (1 + b.hurry * 0.9) * Math.min(1, td / 60 + 0.35);
      // a butterfly never flies straight: two slow swings across its path
      var wob = Math.sin(t * 1.3 + b.seed) * 0.75 + Math.sin(t * 2.9 + b.seed * 2) * 0.45;
      var nx = tx / td, ny = ty / td;
      var dx = (nx - ny * wob) * sp, dy = (ny + nx * wob) * sp;
      var k = Math.min(1, dt * 2.6);
      b.vx += (dx - b.vx) * k;
      b.vy += (dy - b.vy) * k;

      // a few strokes, then a glide on wings held in a shallow V
      if (b.glide > 0) {
        b.glide -= dt;
        if (b.glide <= 0) { b.beats = Math.floor(rand(3, 8)); b.stroke = 0.25; }
      } else {
        b.stroke += dt * b.beat * b.jit * (1 + b.hurry * 0.5);
        if (b.stroke >= 1) {
          // each stroke lifts it a little, kicks it a little, and is a little different
          b.stroke -= 1;
          b.jit = rand(0.88, 1.12);
          b.amp = rand(0.8, 1);
          b.vx += rand(-10, 10);
          b.vy += rand(-10, 10);
          b.z = Math.min(1, b.z + 0.04);
          if (--b.beats <= 0 && b.hurry < 0.3) b.glide = rand(0.3, 0.9);
        }
      }
      b.z += (0.65 + Math.sin(t * 0.7 + b.seed) * 0.2 - b.z) * Math.min(1, dt * 1.5);

      // kept in the window; one coming back in from past its edge may finish coming in
      var y0 = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = Math.min(Math.max(b.x, EDGE), vw - EDGE);
      b.y = Math.min(Math.max(b.y, Math.min(20, y0)), Math.max(vh - 20, y0));

      var want = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      var d = Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading));
      var turn = Math.max(-TURN * dt, Math.min(TURN * dt, d));
      b.heading += turn;
      b.turnRate += (turn / Math.max(dt, 1e-3) / TURN - b.turnRate) * Math.min(1, dt * 6);
    }

    // a wingbeat: a quick downstroke (about two fifths of it) and a slower lift
    function wing(p, amp) {
      var e, raw;
      if (p < 0.42) { e = p / 0.42; e = e * e * (3 - 2 * e); raw = UP + (DOWN - UP) * e; }
      else { e = (p - 0.42) / 0.58; e = e * e * (3 - 2 * e); raw = DOWN + (UP - DOWN) * e; }
      return 30 + (raw - 30) * amp;
    }

    function draw(b, t) {
      var target;
      if (b.mode === 'rest') {
        // on the paper: wings open to the sun, folding up now and then
        var c = Math.sin(t * 0.45 + b.seed);
        var k = Math.min(1, Math.max(0, (c - 0.35) / 0.6));
        target = 80 * k * k * (3 - 2 * k);
        b.ang += (target - b.ang) * 0.12;
      } else if (b.glide > 0) {
        b.ang += (16 - b.ang) * 0.14;
      } else {
        b.ang = wing(b.stroke, b.amp);
      }
      var flap = b.ang;
      // in a turn the outer wing works a little harder
      var bank = b.mode === 'rest' ? 0 : Math.max(-1, Math.min(1, b.turnRate)) * 7;
      var lift = b.z;
      var scale = (0.86 + lift * 0.22) * (b.mode === 'fly' && b.glide <= 0 ? 1 + 0.02 * Math.sin(b.stroke * Math.PI * 2) : 1);
      var half = b.size / 2;
      // in the air it holds its place in the window; landed, its place on the page
      var pinned = b.mode === 'rest';
      if (b.pinned !== pinned) {
        b.pinned = pinned;
        b.el.style.position = pinned ? 'absolute' : 'fixed';
      }
      var y = pinned ? b.docY : b.y;
      b.el.style.transform = 'translate3d(' + (b.x - half).toFixed(1) + 'px,' + (y - half).toFixed(1) + 'px,0)';

      // The butterfly as it is this instant (turned to its heading, each
      // wing folded about the body), drawn small and read back a
      // character's worth at a time.
      var eye = b.eye, ew = b.bw * 2, eh = b.bh * 2;
      eye.setTransform(1, 0, 0, 1, 0, 0);
      eye.clearRect(0, 0, ew, eh);
      eye.setTransform(2 / CW, 0, 0, 2 / CH, 0, 0);
      eye.translate(half, half);
      eye.rotate(b.heading);
      eye.scale(scale, scale);
      var sw = b.sprite.naturalWidth, sh = b.sprite.naturalHeight;
      var lw = half * Math.max(0.1, Math.cos((flap + bank) * Math.PI / 180));
      var rw = half * Math.max(0.1, Math.cos((flap - bank) * Math.PI / 180));
      eye.drawImage(b.sprite, 0, 0, sw / 2, sh, -lw, -half, lw, b.size);
      eye.drawImage(b.sprite, sw / 2, 0, sw / 2, sh, 0, -half, rw, b.size);
      var px = eye.getImageData(0, 0, ew, eh).data;

      var pen = b.pen, bw = b.bw, bh = b.bh, cx, cy, i, j, p;
      var body = b.body || (b.body = new Float32Array(bw * bh * 4));
      for (cy = 0; cy < bh; cy++) for (cx = 0; cx < bw; cx++) {
        var r = 0, g = 0, bl = 0, a = 0;
        for (j = 0; j < 2; j++) for (i = 0; i < 2; i++) {
          p = ((cy * 2 + j) * ew + cx * 2 + i) * 4;
          var al = px[p + 3] / 255;
          r += px[p] * al; g += px[p + 1] * al; bl += px[p + 2] * al; a += al;
        }
        p = (cy * bw + cx) * 4;
        body[p] = a ? r / a : 0; body[p + 1] = a ? g / a : 0; body[p + 2] = a ? bl / a : 0; body[p + 3] = a / 4;
      }
      pen.clearRect(0, 0, bw * CW, bh * CH);
      // its shadow on the paper, in faint dots: farther off the higher it flies
      var sx = Math.round((3 + lift * (SHADE[0] - 3)) / CW), sy = Math.round((4 + lift * (SHADE[1] - 4)) / CH);
      pen.fillStyle = SHADOW;
      for (cy = 0; cy < bh - sy; cy++) for (cx = 0; cx < bw - sx; cx++) {
        if (body[(cy * bw + cx) * 4 + 3] < 0.45) continue;
        if (body[((cy + sy) * bw + cx + sx) * 4 + 3] >= 0.3) continue;
        pen.fillText((cx + cy) % 2 ? ':' : '.', (cx + sx + 0.5) * CW, (cy + sy + 0.5) * CH);
      }
      for (cy = 0; cy < bh; cy++) for (cx = 0; cx < bw; cx++) {
        p = (cy * bw + cx) * 4;
        var cover = body[p + 3];
        if (cover < 0.3) continue;
        // it is paper itself, and hides what it flies over
        pen.fillStyle = PAPER;
        pen.fillRect(cx * CW - 0.5, cy * CH - 0.5, CW + 1, CH + 1);
        var R = body[p], G = body[p + 1], B = body[p + 2];
        var dark = 1 - (R * 0.3 + G * 0.59 + B * 0.11) / 255;
        // pale wings in light characters, their markings and the body in heavy ones
        var w = Math.min(WING.length - 1, Math.max(2, Math.round((0.34 + dark * 1.3) * cover * (WING.length - 1))));
        // deeper than drawn, and richer, to hold on the paper
        var mid = (R + G + B) / 3, deep = 0.7;
        R = (mid + (R - mid) * 2.2) * deep; G = (mid + (G - mid) * 2.2) * deep; B = (mid + (B - mid) * 2.2) * deep;
        pen.fillStyle = 'rgb(' + (R < 0 ? 0 : R > 255 ? 255 : R | 0) + ',' + (G < 0 ? 0 : G > 255 ? 255 : G | 0) + ',' + (B < 0 ? 0 : B > 255 ? 255 : B | 0) + ')';
        pen.fillText(WING[w], (cx + 0.5) * CW, (cy + 0.5) * CH);
      }
    }

    var last = 0, running = false;
    function frame(now) {
      if (!running) return;
      var t = now / 1000;
      var dt = Math.min(0.05, last ? t - last : 0.016);
      last = t;
      measure();
      var sy = window.scrollY;
      flock.forEach(function (b) {
        // landed, it sits on the paper and goes along with the page
        if (b.mode === 'rest') b.y = b.docY - sy;
        step(b, dt, t);
        draw(b, t);
      });
      requestAnimationFrame(frame);
    }

    function start() {
      if (running || still.matches) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.x = mouse.y = -9999; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) running = false; else start();
    });
    // A phone reports a resize each time its address bar slides in or out
    // as you scroll; starting a new flock then made them all vanish and
    // reappear elsewhere mid-scroll. Only a new width starts a new flock;
    // a new height is taken up by measure() on the next frame.
    var resizeTimer = 0, flockWidth = root.clientWidth;
    window.addEventListener('resize', function () {
      if (root.clientWidth === flockWidth) return;
      flockWidth = root.clientWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(populate, 250);
    });

    populate();
    start();
  }
})();
