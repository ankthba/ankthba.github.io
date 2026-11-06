/* =========================================================
   pencil.js (home page)

   Sets the home page inside the pencil drawing, plays its opening (the
   name large in the middle, then rising into its place as the picture
   and the page slide up), and lets butterflies loose. The art is in
   /assets/img/pencil/:

   - home-1800.webp / home-3600.webp: the scene the page is set in,
     the larger one for big, sharp screens.
   - edge.webp: the drawing's own ragged foot, turned over, which the
     scene's top dissolves through.
   - butterfly-<kind>.webp: a butterfly seen from above, wings flat,
     body down the middle, on a clear ground. Each is split down its
     body into two wings that flap.

   The butterflies go anywhere but over the words. In the air they
   hold their place in the window; landed, they sit on the paper and
   scroll with it. Come near one and it lifts off and away. For anyone
   who has asked for less motion they rest, wings open, and stay put.
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
     The home page's first screen is the drawing: the name sits in its
     sky and the meadow runs off the edges and fades into the paper,
     where the rest of the page carries on. */

  var scene = null, headBox = null;
  var home = document.querySelector('.sheet--home');
  // the smaller drawing unless the screen needs the larger to stay sharp
  var need = Math.max(root.clientWidth, window.innerHeight * 1.5) * (window.devicePixelRatio || 1);
  var sceneReady = home ? load(ART + (need > 2000 ? 'home-3600.webp' : 'home-1800.webp')).then(function (wide) {
    if (!wide) return null;
    scene = document.createElement('div');
    scene.className = 'pencil-scene pencil-scene--standin';
    scene.setAttribute('aria-hidden', 'true');
    var pic = document.createElement('picture');
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'sync';
    img.src = wide.src;
    pic.appendChild(img);
    scene.appendChild(pic);
    document.body.insertBefore(scene, document.body.firstChild);
    root.classList.add('has-scene');
    // the paper behind the words is sized to the head as it will rest
    headBox = function () {
      var bits = document.querySelectorAll('.masthead--home .masthead__name, .masthead--home .masthead__role, .masthead--home .social');
      if (!bits.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      Array.prototype.forEach.call(bits, function (el) {
        // the line's own text, not its full box
        var rg = document.createRange();
        rg.selectNodeContents(el);
        // while the opening holds them a window's height down, count them where they'll rest
        var held = root.classList.contains('pencil-intro') && !el.matches('.masthead__name') ? window.innerHeight : 0;
        Array.prototype.forEach.call(rg.getClientRects(), function (r) {
          x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right);
          y0 = Math.min(y0, r.top - held); y1 = Math.max(y1, r.bottom - held);
        });
      });
      var top = window.scrollY;
      scene.style.setProperty('--head-x', x0 + 'px');
      scene.style.setProperty('--head-y', (y0 + top) + 'px');
      scene.style.setProperty('--head-w', (x1 - x0) + 'px');
      scene.style.setProperty('--head-h', (y1 - y0) + 'px');
    };
    if (!root.classList.contains('pencil-intro')) {
      headBox();
      if (document.fonts) document.fonts.ready.then(headBox);
    }
    window.addEventListener('resize', headBox);
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
    // the chevron, drawn in graphite like the rest
    cue.innerHTML = '<img class="pencil-cue__drawn" src="' + ART + 'cue.webp" alt="" width="240" height="143">';
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

    // the nearest place off the words, for one that has strayed onto them
    function nearestFree(x, y) {
      var k = over(x, y);
      if (!k) return { x: x, y: y };
      var exits = [
        { x: k.x0 - 2, y: y }, { x: k.x1 + 2, y: y },
        { x: x, y: k.y0 - 2 }, { x: x, y: k.y1 + 2 }
      ].filter(function (p) { return free(p.x, p.y) && p.x > EDGE && p.x < vw - EDGE; });
      exits.sort(function (a, b) { return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y); });
      return exits[0] || { x: x < vw / 2 ? EDGE + 20 : vw - EDGE - 20, y: y };
    }

    function clear(ax, ay, bx, by) {
      for (var i = 1; i <= 10; i++) {
        var t = i / 10;
        if (!free(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
      }
      return true;
    }

    // somewhere a little way off, on open paper or picture, with no words in the way
    function pickTarget(b) {
      for (var i = 0; i < 40; i++) {
        var a = rand(0, Math.PI * 2), d = rand(ROAM * 0.35, ROAM);
        var x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
        if (x < EDGE + 30 || x > vw - EDGE - 30 || y < 50 || y > vh - 50) continue;
        if (free(x, y) && clear(b.x, b.y, x, y)) return { x: x, y: y };
      }
      for (i = 0; i < 40; i++) {
        x = rand(EDGE + 30, vw - EDGE - 30); y = rand(60, vh - 60);
        if (free(x, y)) return { x: x, y: y };
      }
      return { x: b.x, y: b.y };
    }

    function make(sprite) {
      var size = rand(54, 80) * (vw < 700 ? 0.78 : 1);
      var el = document.createElement('div');
      el.className = 'flutter';
      el.setAttribute('aria-hidden', 'true');
      el.style.width = el.style.height = size + 'px';
      var turn = document.createElement('div');
      turn.className = 'flutter__turn';
      var l = document.createElement('div');
      var r = document.createElement('div');
      l.className = 'flutter__wing flutter__wing--l';
      r.className = 'flutter__wing flutter__wing--r';
      l.style.backgroundImage = r.style.backgroundImage = 'url("' + sprite.src + '")';
      turn.appendChild(l);
      turn.appendChild(r);
      el.appendChild(turn);
      document.body.appendChild(el);
      return {
        el: el, turn: turn, l: l, r: r, size: size,
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
        b.target = free(t.x, t.y) ? t : nearestFree(t.x, t.y);
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
      if (td < 24 || !free(b.target.x, b.target.y)) {
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

      // off the words: pushed back to the nearest open place
      if (!free(b.x, b.y)) {
        var n = nearestFree(b.x, b.y);
        b.vx += (n.x - b.x) * dt * 16;
        b.vy += (n.y - b.y) * dt * 16;
      } else if (!free(b.x + b.vx * 0.3, b.y + b.vy * 0.3)) {
        // about to drift onto them: turn along the edge instead
        b.vx *= 0.5; b.vy *= 0.5;
        b.target = pickTarget(b);
      }

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
      // its shadow on the paper: farther and softer the higher it flies
      var sx = 4 + lift * 26, sy = 8 + lift * 40, blur = 1.5 + lift * 5;
      b.el.style.filter = 'drop-shadow(' + sx.toFixed(1) + 'px ' + sy.toFixed(1) + 'px ' + blur.toFixed(1) + 'px var(--pencil-shadow))';
      b.turn.style.transform = 'rotate(' + b.heading.toFixed(3) + 'rad) scale(' + scale.toFixed(3) + ')';
      b.l.style.transform = 'rotateY(' + (flap + bank).toFixed(1) + 'deg)';
      b.r.style.transform = 'rotateY(' + (-(flap - bank)).toFixed(1) + 'deg)';
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
