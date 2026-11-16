/* =========================================================
   pencil.js (home page)

   Sets the home page inside its picture, plays the opening (the name
   large in the middle, then rising into its place as the picture and
   the page slide up), and lets butterflies loose. The picture is line
   art in type, drawn here rather than loaded: a ridge and three
   rolling hills as single lines of characters, oaks, the Dish and
   clouds set by hand, grass as sparse ticks. It moves: the wind leans
   the grass and stirs the oaks, the clouds drift, an aeroplane crosses
   now and then, and the grass parts round the cursor.

   The butterflies are a few characters each, wings opening and
   closing. They fly anywhere, over the words too, but settle only
   on open paper, never on a line of text. In the air they
   hold their place in the window; landed, they sit on the paper and
   scroll with it. Come near one and it lifts off and away. For anyone
   who has asked for less motion the picture is set once and holds
   still, and the butterflies rest, wings open, and stay put.
   ========================================================= */

(function () {
  'use strict';

  var root = document.documentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- The scene the page is set in ----------
     The home page's first screen is the picture: the name sits in its
     sky, and the meadow thins out into the paper at its foot, where the
     rest of the page carries on. */

  var MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';

  // a fixed scatter: the same number for the same cell, every time
  function hash(x, y) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function ramp(t, a, b) {
    t = (t - a) / (b - a);
    return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  }

  // The lines of the land, back to front: how far down the scene each
  // runs, how much it rolls, and the waves it is made of.
  var LAND = [
    { at: 0.40, roll: 0.030, waves: [[1.3, 0.4, 0.55], [2.9, 1.9, 0.3], [6.3, 4.0, 0.15]], line: '#5672ad', fill: '#a9b9d8' },
    { at: 0.535, roll: 0.030, waves: [[1.1, 2.0, 0.65], [2.6, 0.5, 0.35]], line: '#a98a3a', fill: '#c9ab58' },
    { at: 0.625, roll: 0.042, waves: [[0.9, 4.4, 0.65], [2.1, 1.2, 0.35]], line: '#a07f2c', fill: '#bd9c43' },
    { at: 0.745, roll: 0.030, waves: [[0.7, 1.0, 0.7], [1.7, 3.3, 0.3]], line: '#96741f', fill: '#ad8a2c' }
  ];
  var LEAF = '#58763a', BARK = '#7a5c3c', STEEL = '#4a463f', CLOUD = '#8798b6';
  var OAK = { trunk: 2, art: [
    '     _.-~~-._',
    '  .-\'  ~   ~ `-.',
    ' (  ~    ~   ~  )',
    '(   ~  ~   ~    ~)',
    ' `-.  ~   ~  _.-\'',
    '    `-._\\|/_.-\'',
    '        |||',
    '        |||'] };
  var OAKLET = { trunk: 1, art: [
    '  .-~~-.',
    ' ( ~  ~ )',
    '(  ~ ~  ~)',
    ' `-.||.-\'',
    '    ||'] };
  var SHRUB = { trunk: 0, art: [
    ' .-~-.',
    '(~ ~ ~)'] };
  var DISH = { trunk: 3, ink: STEEL, art: [
    '\\_____/',
    ' `-.-\'',
    ' /_|_\\'] };
  var CLOUDS = [
    ['   .-~~-.', '.-(      )-.', '(__________)'],
    ['  .--.', ' (    )_', '(_______)'],
    ['    .-~-.', ' .-(     )--.', '(____________)']
  ];
  // what stands where: across the scene, and on which line of the land
  var STAND = [
    [OAK, 0.13, 2], [OAKLET, 0.60, 1], [DISH, 0.83, 1],
    [SHRUB, 0.30, 1], [SHRUB, 0.345, 1], [SHRUB, 0.44, 2], [OAKLET, 0.75, 2], [SHRUB, 0.92, 2], [SHRUB, 0.69, 1]
  ];
  // on a phone there is room for fewer
  var STAND_NARROW = [[OAK, 0.2, 2], [OAKLET, 0.6, 1], [DISH, 0.86, 1], [SHRUB, 0.62, 2]];
  var FPS = 12;

  var scene = null, headBox = null, paint = null;
  var home = document.querySelector('.sheet--home');
  var sceneReady = home ? Promise.resolve().then(function () {
    scene = document.createElement('div');
    scene.className = 'pencil-scene';
    scene.setAttribute('aria-hidden', 'true');
    var canvas = document.createElement('canvas');
    scene.appendChild(canvas);
    document.body.insertBefore(scene, document.body.firstChild);
    root.classList.add('has-scene');
    var ctx = canvas.getContext('2d');

    var cols = 0, rows = 0, cw = 0, ch = 0, fs = 0, W = 0, H = 0;
    var base, tone, live, was;   // a cell each: its character, its colour, whether it moves
    var skyRows = 0;
    var head = null;             // the words in the sky: a box clouds pass behind
    var mouse = { x: -9999, y: -9999 };
    var plane = { x: 0, y: 0, wait: 5 };
    var clouds = [];

    function lay() {
      W = scene.clientWidth; H = scene.clientHeight;
      if (!W || !H) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      fs = W < 700 ? 11 : 13;
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

      var n = cols * rows, x, y, i, k;
      base = new Array(n); tone = new Array(n); live = new Uint8Array(n); was = new Array(n);
      for (i = 0; i < n; i++) { base[i] = ' '; tone[i] = ''; was[i] = ''; }

      // each line of the land, a height for every column; the same
      // country on every screen, a wide one just sees more of it
      var span = H * 1.9;
      var high = LAND.map(function (l) {
        var ys = [];
        for (x = -1; x <= cols; x++) {
          var u = (x + 0.5) * cw / span, v = 0;
          l.waves.forEach(function (w) { v += Math.sin(u * w[0] * 6.2832 + w[1]) * w[2]; });
          ys.push(H * (l.at + l.roll * v));
        }
        return ys;   // ys[x + 1]
      });
      skyRows = rows;
      for (x = 0; x < cols; x++) {
        // which line each cell of this column lies under: the nearest one above it
        var top = LAND.map(function (l, j) { return Math.floor(high[j][x + 1] / ch); });
        skyRows = Math.min(skyRows, top[0]);
        for (y = 0; y < rows; y++) {
          var own = -1;
          for (k = 0; k < LAND.length; k++) if (top[k] <= y) own = k;
          if (own < 0) continue;
          i = y * cols + x;
          var l = LAND[own];
          if (y === top[own]) {
            // the line itself: a slope where it climbs or falls a row, else
            // a stroke at the height it crosses the cell
            var yy = high[own][x + 1], f = yy / ch - top[own];
            var before = Math.floor(high[own][x] / ch), after = Math.floor(high[own][x + 2] / ch);
            base[i] = after < top[own] && f < 0.5 ? '/' : before < top[own] && f < 0.5 ? '\\' :
                      f > 0.66 ? '_' : f > 0.33 ? '-' : '"';
            tone[i] = l.line;
            continue;
          }
          var q = hash(x, y), foot = ramp(H - (y + 0.5) * ch, ch * 0.5, H * 0.2);
          if (own === 0) {
            // the far ridge: hatched, thinning with its depth
            var deep = y - top[0];
            if (deep < 6 && (x + y * 2) % 4 === 0 && q < 1 - deep * 0.14) { base[i] = deep < 3 ? ':' : '.'; tone[i] = l.fill; }
          } else {
            // grass: a tick here and there, never two side by side
            var thin = (own === 3 ? 0.17 : own === 2 ? 0.11 : 0.08) * foot;
            if (q < thin && hash(x - 1, y) >= thin) {
              base[i] = own === 1 ? '.' : own === 2 ? ',' : '|';
              tone[i] = l.fill;
              live[i] = own === 3 ? 1 : 0;
            }
          }
        }
      }

      // the oaks, the shrubs and the Dish, each standing on its line
      (cols < 90 ? STAND_NARROW : STAND).forEach(function (st) {
        var what = st[0], art = what.art, wide = 0;
        art.forEach(function (ln) { wide = Math.max(wide, ln.length); });
        var cx = Math.round(st[1] * cols), x0 = cx - (wide >> 1);
        if (cx < 0 || cx >= cols) return;
        var y1 = Math.floor(high[st[2]][cx + 1] / ch);
        art.forEach(function (ln, j) {
          var yy = y1 - (art.length - 1 - j), first = ln.search(/\S/);
          if (yy < 0 || yy >= rows) return;
          for (var c = first; c < ln.length; c++) {
            var xx = x0 + c;
            if (xx < 0 || xx >= cols) continue;
            var at = yy * cols + xx, chr = ln[c];
            // the paper inside its outline hides the hills behind
            base[at] = chr;
            tone[at] = what.ink || (j >= art.length - what.trunk || '|/\\'.indexOf(chr) >= 0 && j >= art.length - what.trunk - 1 ? BARK : LEAF);
            live[at] = chr === '~' && !what.ink ? 2 : 0;
          }
        });
      });

      // clouds, spread across the sky above the ridge
      clouds = [];
      var count = Math.max(3, Math.round(cols / 30)), room = Math.max(3, skyRows - 5);
      for (k = 0; k < count; k++) {
        clouds.push({
          x: (k + hash(k, 7) * 0.7) * (cols + 16) / count,
          y: 1 + Math.floor(hash(k, 19) * room),
          art: CLOUDS[k % CLOUDS.length],
          speed: 0.22 + hash(k, 31) * 0.18
        });
      }
      ctx.clearRect(0, 0, W, H);
    }

    // behind the words, the sky is left as paper
    function clear(x, y) {
      if (!head) return true;
      var px = (x + 0.5) * cw, py = (y + 0.5) * ch;
      return px < head.x0 || px > head.x1 || py < head.y0 || py > head.y1;
    }

    var then = 0, sheet = null, inks = null;
    paint = function (t) {
      if (!cols) return;
      var dt = then ? Math.min(0.2, t - then) : 0;
      then = t;
      var n = cols * rows, x, y, i, c, key;
      if (!sheet || sheet.length !== n) { sheet = new Array(n); inks = new Array(n); }

      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        i = y * cols + x;
        c = base[i];
        if (live[i]) {
          // the wind: gusts crossing from the west, and a ripple round the cursor
          var gust = Math.sin(x * cw * 0.011 - t * 1.3 + Math.sin(y * ch * 0.02 + t * 0.4) * 1.5) + (hash(x, y) - 0.5) * 0.5;
          var mx = x * cw - mouse.x, my = y * ch - mouse.y, md = mx * mx + my * my;
          if (md < 16900) gust += (mx > 0 ? 1.8 : -1.8) * (1 - md / 16900);
          if (live[i] === 1) c = gust > 0.55 ? '/' : gust < -0.75 ? '\\' : '|';
          else c = gust > 0.8 ? '-' : '~';
        }
        sheet[i] = c; inks[i] = tone[i];
      }

      // the clouds drift east, a character at a time, and come round again
      clouds.forEach(function (cl) {
        cl.x += cl.speed * dt;
        if (cl.x > cols + 2) cl.x -= cols + 18;
        var x0 = Math.floor(cl.x);
        cl.art.forEach(function (ln, j) {
          var yy = cl.y + j;
          if (yy >= skyRows - 1) return;
          for (var k = 0; k < ln.length; k++) {
            var xx = x0 + k;
            if (ln[k] === ' ' || xx < 0 || xx >= cols || !clear(xx, yy)) continue;
            sheet[yy * cols + xx] = ln[k]; inks[yy * cols + xx] = CLOUD;
          }
        });
      });

      // the aeroplane, now and then, climbing east with its trail behind it
      if (plane.wait > 0) {
        plane.wait -= dt;
        if (plane.wait <= 0) { plane.x = -2; plane.y = skyRows * (0.45 + Math.random() * 0.35); }
      } else {
        plane.x += dt * 3;
        plane.y -= dt * 0.2;
        if (plane.x > cols + 30) plane.wait = 25 + Math.random() * 35;
        var px = Math.floor(plane.x);
        for (var back = 0; back < 28; back++) {
          x = px - back; y = Math.round(plane.y + back * 0.07);
          if (x < 0 || x >= cols || y < 0 || y >= skyRows || !clear(x, y)) continue;
          c = back === 0 ? '>' : back === 1 ? '=' : back < 4 ? '-' : back < 7 ? ' ' : back < 16 ? (back % 2 ? '-' : ' ') : (back % 3 ? ' ' : '.');
          if (c === ' ' || sheet[y * cols + x] !== ' ') continue;
          sheet[y * cols + x] = c; inks[y * cols + x] = back < 4 ? STEEL : CLOUD;
        }
      }

      // only what changed is set again
      var last = '';
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        i = y * cols + x;
        c = sheet[i];
        key = c === ' ' ? '' : c + inks[i];
        if (key === was[i]) continue;
        was[i] = key;
        ctx.clearRect(x * cw, y * ch, cw, ch);
        if (c === ' ') continue;
        if (inks[i] !== last) { last = inks[i]; ctx.fillStyle = last; }
        ctx.fillText(c, x * cw + cw / 2, y * ch + ch / 2);
      }
    };

    // where the words in the sky are, as they will rest
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
      var top = window.scrollY;
      head = { x0: x0 - 22, x1: x1 + 22, y0: y0 + top - 12, y1: y1 + top + 12 };
      if (!running) once();
    };

    // a dozen settings a second while it's in view; set once and left for less motion
    var running = false, due = 0;
    function once() { then = 0; paint(performance.now() / 1000); }
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

  // one colour each: a swallowtail, a blue, a fritillary, a white
  var KINDS = ['#b98a12', '#4f7dc4', '#d0702a', '#8b8fa3'];
  // wings flat, half raised, and closed over the back
  var WINGS = ['(\\ /)\n(/ \\)', ' \\|/ \n /|\\ ', '  |  \n  |  '];

  sceneReady.then(function () { fly(KINDS); });

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
      var size = vw < 700 ? 38 : 46;
      var el = document.createElement('pre');
      el.className = 'flutter';
      el.setAttribute('aria-hidden', 'true');
      el.style.width = el.style.height = size + 'px';
      el.style.fontSize = (size * 0.3).toFixed(1) + 'px';
      el.style.color = sprite;
      document.body.appendChild(el);
      return {
        el: el, size: size, shown: -1,
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
      var half = b.size / 2;
      // in the air it holds its place in the window; landed, its place on the page
      var pinned = b.mode === 'rest';
      if (b.pinned !== pinned) {
        b.pinned = pinned;
        b.el.style.position = pinned ? 'absolute' : 'fixed';
      }
      var y = pinned ? b.docY : b.y;
      b.el.style.transform = 'translate3d(' + (b.x - half).toFixed(1) + 'px,' + (y - half).toFixed(1) + 'px,0)';

      // its wings, as far open as they are this instant
      var open = Math.abs(flap) + Math.abs(bank) * 0.5;
      var shown = open < 30 ? 0 : open < 62 ? 1 : 2;
      if (shown !== b.shown) { b.shown = shown; b.el.textContent = WINGS[shown]; }
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
