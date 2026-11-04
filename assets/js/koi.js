/* =========================================================
   koi.js (home page)

   Koi in the margins either side of the column, seen from above as
   in a pond, drawn in plain ASCII on a monospaced grid: each koi's
   body in heavy characters along its back (@ # 8 %), lighter toward
   its sides (X S, then x s * +), and : . at its edge, so the shape
   and its roundness come from the characters alone; its markings in
   persimmon, vermilion and sumi ink, its fins and tail in : and .,
   a bold o for each eye. Each place on a koi keeps its character as
   the koi moves.

   They swim as bodies in water do: the tail's beat pushes a koi along,
   the water drags on it (lightly from ahead, hard from the side, so it
   carves its turns and coasts a long way when it stops beating), and
   it turns by bending, which takes time to build and to settle, each
   joint bending no further than a body can. It cruises, glides, now
   and then gives a few hard beats; it sees the others and keeps clear
   of them, drifts along with them or follows one for a while, and if
   two touch they push apart. A head never goes into another's body.

   The water is a damped wave equation on its own fine grid. A tail
   sweeping aside pushes water one way and pulls it the other, a
   moving head heaps it up ahead, and the ripples run out from there.
   It shows only along the line where each ripple catches the light,
   as faint strokes on the same grid.

   The cursor is in the water too: drawn through it, it leaves a wake;
   flicked past a koi, the koi darts off; held still nearby, they come
   to look; a click (or tap) is a raindrop: a ring runs out across
   the water, and any koi near where it lands darts away. Most ponds
   have a few young too, small fry that keep close behind a grown koi
   and startle more easily. And every so often something else comes
   by: a turtle paddling slowly across, the koi giving it room, or a
   dragonfly that darts, hovers, and dips to touch the water.

   Where the margins are too narrow (phones, narrow windows) the koi
   swim in a shallow pond at the foot of the page, above the copyright.
   For anyone who has asked for less motion, they are set once and
   left, and the water is still.
   ========================================================= */

(function () {
  'use strict';

  var page = document.querySelector('.sheet__page');
  var foot = document.querySelector('.colophon');
  if (!page || !foot || !window.requestAnimationFrame) return;

  var root = document.documentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Tuning ----------
     Distances in CSS pixels, times in seconds. */

  var FACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  var SIZE = 9.5;             // the characters
  var CH = 10;                // a row of them; a column is a character's width
  var GAP = 44;               // open water kept between the column and the koi
  var EDGE = 14;              // and at the window's edge
  var ROOM = 150;             // margin a side needs to hold a pond
  var STEP = 1 / 60;          // the fixed step
  var MAX_STEPS = 4;          // steps one frame may catch up

  // how a koi swims
  var THRUST = 34;            // px/s², at a full beat of the tail
  var DRAG = 0.22;            // the water's drag from ahead, 1/s
  var DRAG2 = 0.01;           // and its part that grows with speed, 1/px
  var SLIP = 5;               // its drag from the side, 1/s
  var TURN = 2.4;             // rad/s², at a full bend of the body
  var SPIN = 2.4;             // drag on turning, 1/s
  var BEND = 0.065;           // the most each joint of the body bends, rad
  var SOFT = 40;              // px/s² of push for each px two koi overlap
  var SHOVE = 40;             // and never more than this, px/s²
  var FASTEST = 90;           // no koi goes faster than this, px/s

  // the water
  var CELL = 5;               // its grid
  var WAVE = 72;              // how fast a ripple runs
  var DAMP = 1.3;             // drag on the water, 1/s
  var VISC = 22;              // more on its fine ripples, px²/s
  var SPONGE = 7;             // and toward the pond's edges, 1/s
  var RIM = 36;               // over this much of them
  var LX = -0.6, LY = -0.8;   // the light, from above left
  var SHOW = 0.009;           // a tilt toward it under this shows nothing
  var FULL = 0.04;            // and this much shows at full strength

  // what stirs it
  var FLICK = 0.009;          // a tail's sweep, per px/s of it
  var BOW = 0.004;            // a head's push, per px/s of it
  var CURSOR = 0.9;           // the cursor drawn through it, at full speed
  var CURSOR_SPEED = 1200;    // the speed that counts as full
  var DROP = 2.4;             // a raindrop landing
  var STARTLE = 700;          // a flick this fast startles a koi

  // now and then a visitor: a turtle, or a dragonfly
  var VISIT_FIRST = [20, 40];   // s before the first
  var VISIT_EVERY = [45, 110];  // and between the rest
  var NEAR = 90;              // within this of one
  var LINGER = 0.8;           // held this still this long, they come to look
  var LOOK = 320;             // from as far as this

  var VARIETIES = ['kohaku', 'kohaku', 'kohaku', 'sanke', 'showa', 'tancho', 'ogon', 'shiro'];
  var RAYS = ['~', '\\', '|', '/'];

  // the characters' colours, for the ivory paper and for the dark:
  // warm grey for the body, persimmon and vermilion markings, sumi in
  // the site's own ink; each in four steps, from its back to its edge
  var PALETTES = {
    light: {
      body: ['#8c867a', '#9d978b', '#afa99c', '#c2bcaf'],
      mark: ['#e0702f', '#d8692c', '#c9632f', '#b85c31'],
      red: ['#cf452c', '#c4412b', '#b43c2a', '#a23828'],
      sumi: ['#2a2725', '#302d2a', '#37342f', '#3e3b36'],
      fin: ['#b9b3a6', '#c8c3b7', '#d6d2c8'],
      eye: '#1c1a18', water: '#bdb8ab',
      shell: ['#6c704c', '#4f5238', '#9a9b78'], skin: '#86865e',
      fly: '#2f7f8a', wing: '#a9c3c6'
    },
    dark: {
      body: ['#e2ddd0', '#cdc7b9', '#b3ad9f', '#958f82'],
      mark: ['#ec8140', '#e0763a', '#cc6a35', '#b35e31'],
      red: ['#e05a3c', '#d05136', '#bb4831', '#a3402c'],
      sumi: ['#7a756c', '#6e6961', '#635e57', '#57534d'],
      fin: ['#6a665e', '#5a5650', '#4b4843'],
      eye: '#f1efe7', water: '#5c5952',
      shell: ['#a3a676', '#d3d5a6', '#7c7e5b'], skin: '#adad84',
      fly: '#63b6c2', wing: '#4d6b6f'
    }
  };

  /* ---------- Where they swim ---------- */

  var side = document.createElement('canvas');
  side.className = 'koi koi--side';
  side.setAttribute('aria-hidden', 'true');
  side.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none';
  side.hidden = true;
  document.body.appendChild(side);

  var pond = document.createElement('div');
  pond.className = 'koi koi--pond';
  pond.setAttribute('aria-hidden', 'true');
  pond.hidden = true;
  var pondCanvas = document.createElement('canvas');
  pondCanvas.style.cssText = 'display:block';
  pond.appendChild(pondCanvas);
  foot.parentNode.insertBefore(pond, foot);

  var mode = '';
  var canvas = null, ctx = null, dpr = 1;
  var ponds = [];
  var visible = true;
  var clock = 0;
  var CW = 5.7;               // a character's width, measured

  function fit(c, w, h) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    var x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.font = '700 ' + SIZE + 'px ' + FACE;
    CW = x.measureText('M').width || 5.7;
    atlas = null;
    return x;
  }

  function layout() {
    var vw = root.clientWidth, vh = window.innerHeight;
    var r = page.getBoundingClientRect();
    if (!r.width) return;
    var room = Math.min(r.left, vw - r.right) - GAP - EDGE;
    var next = room >= ROOM ? 'side' : 'pond';
    var rects;
    if (next === 'side') {
      side.hidden = false;
      pond.hidden = true;
      canvas = side;
      ctx = fit(side, vw, vh);
      rects = [
        { x: EDGE, y: 0, w: r.left - GAP - EDGE, h: vh, axis: 'v' },
        { x: r.right + GAP, y: 0, w: vw - EDGE - r.right - GAP, h: vh, axis: 'v' }
      ];
    } else {
      side.hidden = true;
      pond.hidden = false;
      canvas = pondCanvas;
      var w = pond.clientWidth, h = pond.clientHeight;
      if (!w || !h) return;
      ctx = fit(pondCanvas, w, h);
      rects = [{ x: 0, y: 0, w: w, h: h, axis: 'h' }];
    }
    var fresh = next !== mode || rects.length !== ponds.length;
    mode = next;
    rects.forEach(function (p, i) {
      p.cols = Math.floor(p.w / CW);
      p.rows = Math.floor(p.h / CH);
      // the characters' grid sits centred in the pond
      p.gx = p.x + (p.w - p.cols * CW) / 2;
      p.gy = p.y + (p.h - p.rows * CH) / 2;
      var n = p.cols * p.rows;
      p.tone = new Uint8Array(n);
      p.mark = new Uint8Array(n);
      p.alpha = new Float32Array(n);
      water(p);
      var old = fresh ? null : ponds[i];
      p.koi = old ? old.koi : spawn(p);
      p.visitors = old ? old.visitors : [];
      p.koi.forEach(function (k) { keep(k, p); });
    });
    ponds = rects;
    if (still.matches) start();
  }

  /* ---------- The water ---------- */

  var C2 = (WAVE / CELL) * (WAVE / CELL);
  var NU = VISC / (CELL * CELL);

  function water(p) {
    var gw = Math.ceil(p.w / CELL) + 2, gh = Math.ceil(p.h / CELL) + 2, n = gw * gh;
    p.ww = gw; p.wh = gh;
    p.z = new Float32Array(n);      // the surface's height
    p.zv = new Float32Array(n);     // and how fast it moves
    p.zn = new Float32Array(n);
    p.damp = new Float32Array(n);
    for (var j = 0; j < gh; j++) {
      for (var i = 0; i < gw; i++) {
        var x = (i - 0.5) * CELL, y = (j - 0.5) * CELL;
        var e = Math.min(x, y, p.w - x, p.h - y);
        var s = e < RIM ? 1 - Math.max(0, e) / RIM : 0;
        p.damp[j * gw + i] = DAMP + SPONGE * s * s;
      }
    }
  }

  // push the surface down (or, for less than nothing, draw it up)
  // around (x, y), spread as a bell
  function push(p, x, y, spread, amount) {
    var gw = p.ww, gh = p.wh, zv = p.zv;
    var cx = x / CELL + 0.5, cy = y / CELL + 0.5;
    var s = Math.max(0.6, spread / CELL), r = Math.ceil(s * 2.5), k = 1 / (2 * s * s);
    var i0 = Math.max(1, Math.floor(cx - r)), i1 = Math.min(gw - 2, Math.ceil(cx + r));
    var j0 = Math.max(1, Math.floor(cy - r)), j1 = Math.min(gh - 2, Math.ceil(cy + r));
    for (var j = j0; j <= j1; j++) {
      var dy = j - cy, wy = Math.exp(-dy * dy * k) * amount;
      for (var i = i0; i <= i1; i++) {
        var dx = i - cx;
        zv[j * gw + i] -= wy * Math.exp(-dx * dx * k);
      }
    }
  }

  // the wave: each point pulled toward its neighbours' level, the
  // water's drag on all of it, and a viscous drag on its finest ripples
  function flow(p) {
    var gw = p.ww, gh = p.wh, z = p.z, v = p.zv, vn = p.zn, d = p.damp, dt = STEP;
    for (var j = 1; j < gh - 1; j++) {
      var i = j * gw + 1;
      for (var x = 1; x < gw - 1; x++, i++) {
        vn[i] = v[i] + (C2 * (z[i - 1] + z[i + 1] + z[i - gw] + z[i + gw] - 4 * z[i]) +
          NU * (v[i - 1] + v[i + 1] + v[i - gw] + v[i + gw] - 4 * v[i]) - d[i] * v[i]) * dt;
      }
    }
    for (var k = 0; k < z.length; k++) z[k] += vn[k] * dt;
    p.zv = vn; p.zn = v;
  }

  // how much light the surface at water point a catches
  function light(z, a, gw) {
    if (a - gw < 0 || a + gw >= z.length) return 0;
    return -((z[a + 1] - z[a - 1]) * LX + (z[a + gw] - z[a - gw]) * LY) / (2 * CELL);
  }

  /* ---------- A koi ---------- */

  function koi(L) {
    var N = 30;
    var k = {
      L: L, W: L * 0.17, N: N, seg: L / (N - 1),
      x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, cx: 0, cy: 0,
      beat: 0.3, steer: 0,
      mood: 'cruise', moodFor: range(1, 4), pace: range(0.4, 0.62),
      phase: Math.random() * 6.3,
      n1: Math.random() * 100, n2: Math.random() * 100,
      curious: range(0.4, 1),
      depth: range(0.82, 1),
      seed: Math.floor(Math.random() * 1e6),
      fright: 0, awayX: 0, awayY: 0,
      follow: null,
      tipX: 0, tipY: 0, tipOn: false,
      sx: new Float32Array(N), sy: new Float32Array(N),   // the line it has swum
      px: new Float32Array(N), py: new Float32Array(N),   // the body on it, swimming
      tx: new Float32Array(N), ty: new Float32Array(N)    // which way the body runs
    };
    k.name = VARIETIES[Math.floor(Math.random() * VARIETIES.length)];
    k.marks = markings(k.name);
    return k;
  }

  // the body's half-width along it (0 the nose, 1 the tail), as a
  // share of W: a round head, broad shoulders, a long taper
  function girth(u) {
    if (u < 0.15) { var t = (0.15 - u) / 0.15; return 0.86 * Math.sqrt(1 - t * t); }
    if (u < 0.3) return 0.86 + 0.14 * ease((u - 0.15) / 0.15);
    if (u < 0.48) return 1;
    if (u < 0.88) return 1 - 0.8 * ease((u - 0.48) / 0.4);
    return 0.2;
  }

  // a koi's markings, as patches in its own terms: u along it, v across
  function markings(kind) {
    var list = [], all = 0, i, n;
    function patch(u0, u1, v0, v1, ru0, ru1, rv0, rv1, tone) {
      list.push({ u: range(u0, u1), v: range(v0, v1), ru: range(ru0, ru1), rv: range(rv0, rv1), tone: tone, seed: Math.random() * 50 });
    }
    var red = function () { return Math.random() < 0.4 ? 3 : 2; };   // 2 orange, 3 red, 4 slate
    if (kind === 'ogon') all = 2;
    if (kind === 'tancho') patch(0.06, 0.08, -0.05, 0.05, 0.045, 0.055, 0.4, 0.5, 3);
    if (kind === 'kohaku' || kind === 'sanke' || kind === 'showa') {
      n = 2 + Math.floor(Math.random() * 3);
      for (i = 0; i < n; i++) patch(0.08, 0.72, -0.45, 0.45, 0.06, 0.14, 0.5, 1.1, red());
    }
    if (kind === 'sanke') {
      n = 2 + Math.floor(Math.random() * 3);
      for (i = 0; i < n; i++) patch(0.2, 0.75, -0.8, 0.8, 0.03, 0.05, 0.2, 0.35, 4);
    }
    if (kind === 'showa') {
      n = 2 + Math.floor(Math.random() * 2);
      for (i = 0; i < n; i++) patch(0.1, 0.75, -0.7, 0.7, 0.05, 0.09, 0.3, 0.6, 4);
    }
    return { all: all, list: list };
  }

  function tint(m, u, v) {
    var tone = m.all || 1;
    for (var i = 0; i < m.list.length; i++) {
      var p = m.list[i];
      var du = (u - p.u) / p.ru, dv = (v - p.v) / p.rv;
      if (du * du + dv * dv < 1 + 0.22 * Math.sin(u * 41 + v * 7 + p.seed)) tone = p.tone;
    }
    return tone;
  }

  /* ---------- Placing them ---------- */

  function spawn(p) {
    var area = p.w * p.h;
    var max = clamp(Math.floor(area / 150000), 1, 3);
    var n = 1 + Math.floor(Math.random() * max);
    var base = p.axis === 'v' ? clamp(p.w * 0.72, 100, 190) : clamp(p.h * 0.8, 90, 135);
    var out = [];
    for (var i = 0; i < n; i++) {
      var k = koi(base * range(0.75, 1.12));
      // somewhere its whole body fits, clear of the others, facing
      // any way at all; if there is no such place, it isn't added
      var placed = false;
      for (var tries = 0; tries < 200 && !placed; tries++) {
        k.x = range(0, p.w); k.y = range(0, p.h);
        k.a = Math.random() * Math.PI * 2;
        placed = fits(k, p, out);
      }
      if (!placed) continue;
      var sp = range(0, 10);
      k.vx = Math.cos(k.a) * sp; k.vy = Math.sin(k.a) * sp;
      settle(k);
      out.push(k);
    }
    // and, often, a few young, each keeping close behind a grown one
    var grown = out.slice();
    var young = grown.length && Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 3) : 0;
    for (var y = 0; y < young; y++) {
      var m = grown[Math.floor(Math.random() * grown.length)];
      var kid = koi(m.L * range(0.32, 0.42));
      kid.parent = m;
      kid.curious = 1;
      var ok = false;
      for (var t2 = 0; t2 < 200 && !ok; t2++) {
        kid.x = m.sx[m.N - 1] + range(-90, 90);
        kid.y = m.sy[m.N - 1] + range(-90, 90);
        kid.a = m.a + range(-0.6, 0.6);
        ok = fits(kid, p, out);
      }
      if (!ok) continue;
      kid.vx = m.vx; kid.vy = m.vy;
      settle(kid);
      out.push(kid);
    }
    return out;
  }

  // lay a koi's body straight back from its head
  function settle(k) {
    for (var s = 0; s < k.N; s++) {
      k.sx[s] = k.x - Math.cos(k.a) * k.seg * s;
      k.sy[s] = k.y - Math.sin(k.a) * k.seg * s;
    }
    pose(k);
  }

  // would a koi laid straight back from (k.x, k.y) fit in the pond,
  // clear of the others?
  function fits(k, p, others) {
    var m = k.W * 2 + 6, cx = Math.cos(k.a), cy = Math.sin(k.a);
    for (var s = 0; s < k.N; s += 2) {
      var x = k.x - cx * k.seg * s, y = k.y - cy * k.seg * s;
      if (x < m || y < m || x > p.w - m || y > p.h - m) return false;
      for (var j = 0; j < others.length; j++) {
        var o = others[j];
        for (var q = 0; q < o.N; q += 2) {
          if (Math.hypot(x - o.sx[q], y - o.sy[q]) < k.W + o.W + 30) return false;
        }
      }
    }
    return true;
  }

  function keep(k, p) {
    var m = k.W;
    if (k.x < m) { k.x = m; if (k.vx < 0) k.vx = 0; }
    if (k.y < m) { k.y = m; if (k.vy < 0) k.vy = 0; }
    if (k.x > p.w - m) { k.x = p.w - m; if (k.vx > 0) k.vx = 0; }
    if (k.y > p.h - m) { k.y = p.h - m; if (k.vy > 0) k.vy = 0; }
  }

  /* ---------- How they decide ---------- */

  function wall(d, R) { return d >= R ? 0 : Math.pow(1 - Math.max(d, -R) / R, 2); }

  function think(k, p, ptr, dt) {
    var fx = Math.cos(k.a), fy = Math.sin(k.a);
    var spd = Math.hypot(k.vx, k.vy);

    // its own rhythm: cruise, glide, now and then a few hard beats
    k.moodFor -= dt;
    if (k.moodFor <= 0) {
      if (k.mood === 'glide') k.mood = Math.random() < 0.12 ? 'burst' : 'cruise';
      else k.mood = 'glide';
      k.moodFor = k.mood === 'glide' ? range(2, 6.5) : k.mood === 'burst' ? range(0.7, 1.3) : range(2.5, 6);
      k.pace = range(0.4, 0.62);
      // sometimes it falls in behind another for a while
      k.follow = null;
      if (!k.parent && p.koi.length > 1 && Math.random() < 0.3) {
        var others = p.koi.filter(function (o) { return o !== k; });
        k.follow = others[Math.floor(Math.random() * others.length)];
      }
    }
    var want = k.mood === 'glide' ? 0.03 : k.mood === 'burst' ? 1 : k.pace;

    // where it would go: a slow wandering of its own
    var wa = k.a + 0.4 * Math.sin(clock * 0.08 + k.n1) + 0.25 * Math.sin(clock * 0.19 + k.n2);
    var dx = Math.cos(wa), dy = Math.sin(wa);

    // the pond's edges, felt a little ahead
    var look = k.L * 0.5 + spd * 1.2;
    var hx = k.x + fx * look, hy = k.y + fy * look;
    var pad = k.W * 2 + 6, R = Math.min(110, Math.min(p.w, p.h) * 0.45);
    dx += (wall(hx - pad, R) - wall(p.w - pad - hx, R)) * 3.2;
    dy += (wall(hy - pad, R) - wall(p.h - pad - hy, R)) * 3.2;

    // the others: keep clear of their bodies, drift with them
    var block = 0, near = 0, mx = 0, my = 0, ax = 0, ay = 0;
    var ahead = k.L * 0.35 + spd * 0.8;
    var qx = k.x + fx * ahead, qy = k.y + fy * ahead;
    p.koi.forEach(function (o) {
      if (o === k) return;
      for (var i = 0; i < o.N; i += 2) {
        var r = girth(i / (o.N - 1)) * o.W + k.W + 14, reach = r * 2.8;
        var ex = k.x - o.px[i], ey = k.y - o.py[i], d = Math.hypot(ex, ey) || 1;
        if (d < reach) { var f = 1 - d / reach; dx += ex / d * f * f * 3; dy += ey / d * f * f * 3; }
        ex = qx - o.px[i]; ey = qy - o.py[i]; d = Math.hypot(ex, ey) || 1;
        if (d < reach) {
          var g = 1 - d / reach;
          dx += ex / d * g * g * 2.2; dy += ey / d * g * g * 2.2;
          block = Math.max(block, g);
        }
      }
      var gd = Math.hypot(o.x - k.x, o.y - k.y);
      if (gd < 320) { near++; mx += o.x; my += o.y; ax += Math.cos(o.a); ay += Math.sin(o.a); }
    });
    if (near) {
      var cxo = mx / near - k.x, cyo = my / near - k.y, cd = Math.hypot(cxo, cyo) || 1;
      if (cd > k.L) { dx += cxo / cd * 0.25; dy += cyo / cd * 0.25; }
      var al = Math.hypot(ax, ay) || 1;
      dx += ax / al * 0.3; dy += ay / al * 0.3;
    }
    if (k.parent && p.koi.indexOf(k.parent) >= 0) {
      // the young keep close behind their own
      var m = k.parent, bx = m.px[m.N - 1], by = m.py[m.N - 1];
      var md = Math.hypot(bx - k.x, by - k.y) || 1;
      if (md > m.L * 0.25) {
        dx += (bx - k.x) / md * 1.4; dy += (by - k.y) / md * 1.4;
        want = Math.max(want, md > m.L ? 0.9 : 0.5);
      }
    } else if (k.follow && p.koi.indexOf(k.follow) >= 0) {
      var o = k.follow, tx = o.px[o.N - 1], ty = o.py[o.N - 1];
      var td = Math.hypot(tx - k.x, ty - k.y) || 1;
      if (td > k.L * 0.5) { dx += (tx - k.x) / td * 0.7; dy += (ty - k.y) / td * 0.7; }
    }

    if (k.fright > 0) {
      k.fright -= dt;
      dx += k.awayX * 4; dy += k.awayY * 4;
      want = 1.5;
    } else {
      if (ptr.in && ptr.rest > LINGER) {
        // the cursor held still nearby: come and look
        var px2 = clamp(ptr.x, pad, p.w - pad), py2 = clamp(ptr.y, pad, p.h - pad);
        var pd = Math.hypot(px2 - k.x, py2 - k.y) || 1;
        if (pd < LOOK) {
          var pull = k.curious * (pd > k.L * 0.45 ? 1.4 : 0.6);
          dx += (px2 - k.x) / pd * pull; dy += (py2 - k.y) / pd * pull;
          if (pd < k.L * 0.5) want = 0.05;
          else want = Math.max(want, 0.4);
        }
      }
    }

    // and the turtle, if one is passing: a wide berth
    p.visitors.forEach(function (t) {
      if (t.kind !== 'turtle') return;
      var r = t.L * 0.6 + k.W + 20, reach = r * 2.2;
      [[k.x, k.y, 3], [qx, qy, 2.2]].forEach(function (q) {
        var ex = q[0] - t.x, ey = q[1] - t.y, d = Math.hypot(ex, ey) || 1;
        if (d < reach) {
          var f = 1 - d / reach;
          dx += ex / d * f * f * q[2]; dy += ey / d * f * f * q[2];
          if (q[2] < 3) block = Math.max(block, f);
        }
      });
    });

    // slow for anything just ahead
    want *= 1 - 0.7 * block;
    k.beat += (want - k.beat) * (1 - Math.exp(-dt / (k.fright > 0 ? 0.12 : 0.6)));
    k.steer = clamp(angle(Math.atan2(dy, dx) - k.a) * 1.2, -1, 1);
  }

  // two koi touching push apart: wherever along their bodies they
  // meet, each is pushed away from the other, the push carried to the
  // head, which leads the body
  function touch(p) {
    var ks = p.koi;
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var a = ks[i], b = ks[j];
        for (var s = 0; s < a.N; s += 3) {
          var ua = s / (a.N - 1), ra = girth(ua) * a.W;
          for (var q = 0; q < b.N; q += 3) {
            var ub = q / (b.N - 1), rb = girth(ub) * b.W;
            var ex = a.px[s] - b.px[q], ey = a.py[s] - b.py[q], d = Math.hypot(ex, ey) || 0.001;
            var over = ra + rb + 12 - d;
            if (over > 0) {
              var f = over * SOFT;
              a.cx += ex / d * f * (1 - 0.5 * ua); a.cy += ey / d * f * (1 - 0.5 * ua);
              b.cx -= ex / d * f * (1 - 0.5 * ub); b.cy -= ey / d * f * (1 - 0.5 * ub);
            }
          }
        }
      }
    }
  }

  // and two bodies never overlap: where they would, both are slid
  // apart by half the overlap each, and their closing speed taken out,
  // as two bodies meeting in water part without a kick
  function apart(p) {
    // a turtle doesn't give way: a koi against its shell is moved off
    p.visitors.forEach(function (t) {
      if (t.kind !== 'turtle') return;
      p.koi.forEach(function (k) {
        var worst = 0, nx = 0, ny = 0;
        for (var s = 0; s < k.N; s += 2) {
          var ex = k.px[s] - t.x, ey = k.py[s] - t.y, d = Math.hypot(ex, ey) || 0.001;
          var over = t.L * 0.55 + girth(s / (k.N - 1)) * k.W + 4 - d;
          if (over > worst) { worst = over; nx = ex / d; ny = ey / d; }
        }
        if (worst > 0) {
          shift(k, nx * worst, ny * worst);
          var vn = k.vx * nx + k.vy * ny;
          if (vn < 0) { k.vx -= vn * nx; k.vy -= vn * ny; }
          keep(k, p);
        }
      });
    });
    var ks = p.koi;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < ks.length; i++) {
        for (var j = i + 1; j < ks.length; j++) {
          var a = ks[i], b = ks[j], worst = 0, nx = 0, ny = 0;
          for (var s = 0; s < a.N; s += 2) {
            var ra = girth(s / (a.N - 1)) * a.W;
            for (var q = 0; q < b.N; q += 2) {
              var rb = girth(q / (b.N - 1)) * b.W;
              var ex = a.px[s] - b.px[q], ey = a.py[s] - b.py[q], d = Math.hypot(ex, ey) || 0.001;
              var over = ra + rb + 6 - d;
              if (over > worst) { worst = over; nx = ex / d; ny = ey / d; }
            }
          }
          if (worst <= 0) continue;
          shift(a, nx * worst / 2, ny * worst / 2);
          shift(b, -nx * worst / 2, -ny * worst / 2);
          var rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rv < 0) { a.vx -= rv * nx / 2; a.vy -= rv * ny / 2; b.vx += rv * nx / 2; b.vy += rv * ny / 2; }
          keep(a, p); keep(b, p);
        }
      }
    }
  }

  function shift(k, dx, dy) {
    k.x += dx; k.y += dy;
    for (var i = 0; i < k.N; i++) { k.sx[i] += dx; k.sy[i] += dy; k.px[i] += dx; k.py[i] += dy; }
  }

  /* ---------- How they move ---------- */

  function move(k, p, dt) {
    var fx = Math.cos(k.a), fy = Math.sin(k.a);
    // the tail's beat pushes it on; the water holds it back, lightly
    // from ahead and hard from the side
    var vf = k.vx * fx + k.vy * fy, vl = -k.vx * fy + k.vy * fx;
    var af = THRUST * k.beat * k.beat - DRAG * vf - DRAG2 * vf * Math.abs(vf);
    var al = -SLIP * vl;
    var cl = Math.hypot(k.cx, k.cy);
    if (cl > SHOVE) { k.cx *= SHOVE / cl; k.cy *= SHOVE / cl; }
    k.vx += (af * fx - al * fy + k.cx) * dt;
    k.vy += (af * fy + al * fx + k.cy) * dt;
    k.cx = k.cy = 0;
    var sp = Math.hypot(k.vx, k.vy);
    if (sp > FASTEST) { k.vx *= FASTEST / sp; k.vy *= FASTEST / sp; }
    // it turns by bending, which builds and settles
    k.w += (TURN * k.steer * (0.3 + Math.abs(vf) / 22) - SPIN * k.w) * dt;
    k.a += k.w * dt;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    keep(k, p);
    k.phase += 2 * Math.PI * (0.45 + 1.05 * Math.min(1.5, k.beat)) * dt;
  }

  // the body follows the line the head has swum, each joint bending
  // no further than a body can
  function follow(k) {
    var sx = k.sx, sy = k.sy;
    sx[0] = k.x; sy[0] = k.y;
    var bx = -Math.cos(k.a), by = -Math.sin(k.a), cb = Math.cos(BEND), sb = Math.sin(BEND);
    for (var i = 1; i < k.N; i++) {
      var ex = sx[i] - sx[i - 1], ey = sy[i] - sy[i - 1];
      var d = Math.sqrt(ex * ex + ey * ey) || 1;
      var ux = ex / d, uy = ey / d;
      if (bx * ux + by * uy < cb) {
        var sg = bx * uy - by * ux < 0 ? -1 : 1;
        ux = bx * cb - by * sb * sg;
        uy = by * cb + bx * sb * sg;
      }
      sx[i] = sx[i - 1] + ux * k.seg;
      sy[i] = sy[i - 1] + uy * k.seg;
      bx = ux; by = uy;
    }
    pose(k);
  }

  // what a koi does to the water: heaped ahead of the head, drawn in
  // behind it, and swept aside by the tail, one side up, one down
  function wake(k, p, dt) {
    var fx = Math.cos(k.a), fy = Math.sin(k.a);
    var sp = Math.max(0, k.vx * fx + k.vy * fy);
    push(p, k.x + fx * k.W * 0.6, k.y + fy * k.W * 0.6, k.W * 0.7, -BOW * sp);
    at(k, 0.5);
    push(p, AX, AY, k.W * 0.9, BOW * sp * 0.7);
    at(k, 1);
    var tx = AX, ty = AY, nx = -ATY, ny = ATX;
    if (k.tipOn) {
      var lat = ((tx - k.tipX) / dt - k.vx) * nx + ((ty - k.tipY) / dt - k.vy) * ny;
      var f = FLICK * lat * dt * 60;
      if (Math.abs(f) > 1e-4) {
        push(p, tx + nx * k.W * 0.4, ty + ny * k.W * 0.4, k.W * 0.45, f);
        push(p, tx - nx * k.W * 0.4, ty - ny * k.W * 0.4, k.W * 0.45, -f);
      }
    }
    k.tipX = tx; k.tipY = ty; k.tipOn = true;
  }

  // the body on the line it has swum, with the wave of its swimming
  // running down it from the head, strongest at the tail
  function pose(k) {
    var N = k.N, sx = k.sx, sy = k.sy, px = k.px, py = k.py;
    var sway = 0.12 + 0.88 * Math.min(1, k.beat);
    for (var i = 0; i < N; i++) {
      var a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
      var tx = sx[b] - sx[a], ty = sy[b] - sy[a], tl = Math.sqrt(tx * tx + ty * ty) || 1;
      var u = i / (N - 1);
      var amp = k.W * (0.05 + 0.85 * u * u) * sway * Math.sin(k.phase - u * 5.3);
      px[i] = sx[i] - ty / tl * amp;
      py[i] = sy[i] + tx / tl * amp;
    }
    for (var j = 0; j < N; j++) {
      var c = Math.max(0, j - 1), e = Math.min(N - 1, j + 1);
      var qx = px[e] - px[c], qy = py[e] - py[c], ql = Math.sqrt(qx * qx + qy * qy) || 1;
      k.tx[j] = qx / ql; k.ty[j] = qy / ql;
    }
  }

  // a place on the body: where it is, and which way the body runs
  var AX = 0, AY = 0, ATX = 1, ATY = 0;
  function at(k, u) {
    var f = clamp(u, 0, 1) * (k.N - 1);
    var i = Math.min(k.N - 2, Math.floor(f)), t = f - i;
    AX = k.px[i] + (k.px[i + 1] - k.px[i]) * t;
    AY = k.py[i] + (k.py[i + 1] - k.py[i]) * t;
    var tx = k.tx[i] + (k.tx[i + 1] - k.tx[i]) * t, ty = k.ty[i] + (k.ty[i + 1] - k.ty[i]) * t;
    var l = Math.sqrt(tx * tx + ty * ty) || 1;
    ATX = tx / l; ATY = ty / l;
  }

  /* ---------- The cursor ---------- */

  var pointer = { x: 0, y: 0, on: false, lx: 0, ly: 0, speed: 0, rest: 0, fresh: true };

  function origin() {
    if (mode === 'pond') {
      var r = pondCanvas.getBoundingClientRect();
      return { x: r.left, y: r.top };
    }
    return { x: 0, y: 0 };
  }

  function feel(dt) {
    var o = origin();
    var dx = pointer.x - pointer.lx, dy = pointer.y - pointer.ly;
    if (pointer.fresh) { dx = dy = 0; pointer.fresh = false; }
    pointer.lx = pointer.x; pointer.ly = pointer.y;
    var sp = pointer.on ? Math.sqrt(dx * dx + dy * dy) / dt : 0;
    pointer.speed += (sp - pointer.speed) * (1 - Math.exp(-dt / 0.05));
    pointer.rest = pointer.on && pointer.speed < 40 ? pointer.rest + dt : 0;
    return ponds.map(function (p) {
      var x = pointer.x - o.x - p.x, y = pointer.y - o.y - p.y;
      return {
        x: x, y: y, dx: dx, dy: dy, rest: pointer.rest, speed: pointer.speed,
        inside: pointer.on && x >= 0 && y >= 0 && x <= p.w && y <= p.h,
        in: pointer.on && x >= -140 && y >= -140 && x <= p.w + 140 && y <= p.h + 140
      };
    });
  }

  function stir(p, ptr) {
    // like a finger drawn through water: it pushes only while it moves
    if (ptr.inside && ptr.speed > 2) {
      var s = CURSOR * Math.min(1, ptr.speed / CURSOR_SPEED) * 0.05;
      var l = Math.hypot(ptr.dx, ptr.dy) || 1, ux = ptr.dx / l, uy = ptr.dy / l;
      push(p, ptr.x - ux * 7, ptr.y - uy * 7, 10, s);
      push(p, ptr.x + ux * 7, ptr.y + uy * 7, 10, -s * 0.7);
    }
    // a flick past a koi sends it off
    if (ptr.in && ptr.speed > STARTLE * 0.6) {
      p.koi.forEach(function (k) {
        var shy = k.parent ? 1.6 : 1;
        if (ptr.speed < STARTLE / shy) return;
        at(k, 0.4);
        var d = Math.min(Math.hypot(ptr.x - k.x, ptr.y - k.y), Math.hypot(ptr.x - AX, ptr.y - AY));
        if (d < NEAR * shy) scare(k, ptr.x, ptr.y);
      });
    }
  }

  function scare(k, x, y) {
    var ex = k.x - x, ey = k.y - y, d = Math.hypot(ex, ey) || 1;
    k.awayX = ex / d; k.awayY = ey / d;
    k.fright = range(0.8, 1.2);
  }

  function drop(cx, cy) {
    var o = origin();
    ponds.forEach(function (p) {
      var x = cx - o.x - p.x, y = cy - o.y - p.y;
      if (x < 0 || y < 0 || x > p.w || y > p.h) return;
      push(p, x, y, 7, DROP);
      // the koi near where it lands dart away, the young from further
      p.koi.forEach(function (k) {
        if (Math.hypot(x - k.x, y - k.y) < (k.parent ? 110 : 70)) scare(k, x, y);
      });
    });
  }

  /* ---------- Visitors ---------- */

  var nextVisit = range(VISIT_FIRST[0], VISIT_FIRST[1]);

  // something comes by one of the ponds, in from one edge
  function visit() {
    if (!ponds.length) return;
    var p = ponds[Math.floor(Math.random() * ponds.length)];
    if (p.visitors.length) return;
    var v = { kind: Math.random() < 0.6 ? 'turtle' : 'fly', phase: 0, n1: Math.random() * 100, life: 0, gone: false };
    var m = 50;
    if (p.axis === 'v') {
      var top = Math.random() < 0.5;
      v.x = range(p.w * 0.25, p.w * 0.75); v.y = top ? -m : p.h + m;
      v.a = (top ? 1 : -1) * Math.PI / 2 + range(-0.25, 0.25);
    } else {
      var left = Math.random() < 0.5;
      v.x = left ? -m : p.w + m; v.y = range(p.h * 0.3, p.h * 0.7);
      v.a = (left ? 0 : Math.PI) + range(-0.15, 0.15);
    }
    if (v.kind === 'turtle') {
      v.L = range(56, 78);
      v.v = range(16, 22);
    } else {
      v.v = range(90, 130);
      v.mode = 'dash';
      v.timer = range(0.5, 1);
      v.stay = range(8, 16);
    }
    p.visitors.push(v);
  }

  function outside(v, p, m) {
    return v.x < -m || v.y < -m || v.x > p.w + m || v.y > p.h + m;
  }

  // a turtle paddles across, each stroke of its front flippers pushing
  // it on and stirring the water either side
  function paddle(t, p, dt) {
    t.life += dt;
    t.phase += 2 * Math.PI * 0.55 * dt;
    t.a += 0.12 * Math.sin(clock * 0.3 + t.n1) * dt;
    var surge = 0.7 + 0.5 * Math.max(0, Math.sin(t.phase));
    var fx = Math.cos(t.a), fy = Math.sin(t.a), nx = -fy, ny = fx;
    t.x += fx * t.v * surge * dt;
    t.y += fy * t.v * surge * dt;
    var stroke = Math.cos(t.phase) * 0.012 * dt * 60;
    var A = t.L / 2, B = t.L * 0.4;
    [1, -1].forEach(function (sd) {
      var bx = t.x + fx * A * 0.42 + nx * sd * B * 1.2, by = t.y + fy * A * 0.42 + ny * sd * B * 1.2;
      push(p, bx, by, 5, stroke);
    });
    push(p, t.x + fx * (A + 8), t.y + fy * (A + 8), 8, -0.004 * t.v * dt * 60 * 0.02);
    if (t.life > 4 && outside(t, p, t.L)) t.gone = true;
  }

  // a dragonfly darts, hovers, darts again, now and then dipping to
  // touch the water, and in a while flies off
  function flit(f, p, dt) {
    f.life += dt;
    f.timer -= dt;
    f.phase += dt * 40;
    if (f.mode === 'dash') {
      f.x += Math.cos(f.a) * f.v * dt;
      f.y += Math.sin(f.a) * f.v * dt;
      if (f.timer <= 0) {
        f.mode = 'hover';
        f.timer = range(0.8, 2.2);
        if (Math.random() < 0.35 && !outside(f, p, 0)) push(p, f.x, f.y, 4, 1.4);
      }
    } else {
      f.x += Math.sin(clock * 7 + f.n1) * 4 * dt;
      f.y += Math.cos(clock * 5 + f.n1) * 4 * dt;
      if (f.timer <= 0) {
        f.mode = 'dash';
        f.timer = range(0.35, 0.8);
        f.v = range(90, 140);
        if (f.life > f.stay) {
          // off, toward the nearest edge
          var ex = f.x < p.w / 2 ? -1 : 1, ey = f.y < p.h / 2 ? -1 : 1;
          f.a = Math.min(f.x, p.w - f.x) < Math.min(f.y, p.h - f.y) ? (ex < 0 ? Math.PI : 0) : (ey < 0 ? -Math.PI / 2 : Math.PI / 2);
          f.timer = 3;
        } else {
          var tx = range(p.w * 0.15, p.w * 0.85), ty = range(p.h * 0.15, p.h * 0.85);
          f.a = Math.atan2(ty - f.y, tx - f.x);
        }
      }
    }
    if (f.life > f.stay && outside(f, p, 40)) f.gone = true;
  }

  // the character for a line running (dx, dy)
  function seam(dx, dy) {
    var a = Math.atan2(dy, dx);
    if (a < 0) a += Math.PI;
    return SEAMS[Math.round(a / (Math.PI / 4)) % 4];
  }

  function within(fx, fy, bx, by, ax, ay, len, wide) {
    var ex = fx - bx, ey = fy - by;
    var along = ex * ax + ey * ay;
    if (along <= 0 || along >= len) return false;
    // broad at the root, where it meets the body, narrowing to a tip
    return Math.abs(-ex * ay + ey * ax) < wide * Math.pow(Math.sin(Math.PI * (0.25 + 0.75 * along / len)), 0.6);
  }

  // a turtle from above: its shell, rimmed, with the seams between its
  // plates; its head; four flippers
  function setTurtle(p, t) {
    var A = t.L / 2, B = t.L * 0.4, R = t.L * 0.9;
    var fx = Math.cos(t.a), fy = Math.sin(t.a);
    var across = seam(-fy, fx), along = seam(fx, fy);
    var dx0 = p.gx - p.x, dy0 = p.gy - p.y;
    var c0 = Math.max(0, Math.floor((t.x - R - dx0) / CW)), c1 = Math.min(p.cols - 1, Math.ceil((t.x + R - dx0) / CW));
    var r0 = Math.max(0, Math.floor((t.y - R - dy0) / CH)), r1 = Math.min(p.rows - 1, Math.ceil((t.y + R - dy0) / CH));
    var sw = Math.sin(t.phase);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var cell = r * p.cols + c;
        if (p.tone[cell] && p.tone[cell] < WATER) continue;
        var qx = dx0 + (c + 0.5) * CW - t.x, qy = dy0 + (r + 0.5) * CH - t.y;
        var lx = qx * fx + qy * fy, ly = -qx * fy + qy * fx;
        var tone = 0, glyph = 0;
        var e = (lx / A) * (lx / A) + (ly / B) * (ly / B);
        if (e < 1) {
          if (e > 0.74) { tone = RIM2; glyph = COLON; }
          else {
            var sx = Math.min(Math.abs(lx - A * 0.3), Math.abs(lx + A * 0.3)) < CH * 0.45;
            var sy = Math.abs(Math.abs(ly) - B * 0.36) < CW * 0.55;
            if (sx && sy) { tone = SEAM; glyph = G('+'); }
            else if (sx) { tone = SEAM; glyph = across; }
            else if (sy) { tone = SEAM; glyph = along; }
            else { tone = SHELL; glyph = G('#'); }
          }
        } else {
          var hx = lx - (A + t.L * 0.1);
          if (hx * hx / (t.L * t.L * 0.0121) + ly * ly / (t.L * t.L * 0.0064) < 1) { tone = SKIN; glyph = G('@'); }
          else {
            // flippers: the front pair sweeping, the back pair steering
            var sd = ly > 0 ? 1 : -1;
            var fa = sd * (1.05 + 0.45 * sw), ba = sd * (2.35 + 0.25 * sw);
            if (within(lx, ly, A * 0.42, sd * B * 0.75, Math.cos(fa), Math.sin(fa), t.L * 0.45, t.L * 0.11) ||
                within(lx, ly, -A * 0.62, sd * B * 0.65, Math.cos(ba), Math.sin(ba), t.L * 0.27, t.L * 0.08)) {
              tone = SKIN; glyph = G('=');
            } else if (lx < -A && lx > -A - 7 && Math.abs(ly) < 2.5) { tone = SKIN; glyph = DOT; }
          }
        }
        if (!tone) continue;
        p.tone[cell] = tone;
        p.mark[cell] = glyph;
        p.alpha[cell] = 1;
      }
    }
  }

  // a dragonfly from above, drawn square to the grid in whichever of
  // its eight directions it is nearest heading: a head, a thorax, a
  // long thin body, and two pairs of wings shimmering between swept
  // back and spread
  var COMPASS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  function setFly(p, f) {
    var q = Math.round(f.a / (Math.PI / 4));
    var d = COMPASS[((q % 8) + 8) % 8], n = COMPASS[(((q + 2) % 8) + 8) % 8];
    var dx0 = p.gx - p.x, dy0 = p.gy - p.y;
    var c0 = Math.floor((f.x - dx0) / CW), r0 = Math.floor((f.y - dy0) / CH);
    function put(c, r, tone, glyph) {
      if (c < 0 || r < 0 || c >= p.cols || r >= p.rows) return;
      var cell = r * p.cols + c;
      p.tone[cell] = tone; p.mark[cell] = glyph; p.alpha[cell] = 1;
    }
    var spread = Math.sin(f.phase) > 0;
    [[1, 1], [1, -1], [2, 1], [2, -1]].forEach(function (w) {
      var back = w[0], sd = w[1];
      // a front wing sweeps forward, a back one back, or both stand out
      var wx = n[0] * sd + (spread ? 0 : (back === 1 ? d[0] : -d[0]));
      var wy = n[1] * sd + (spread ? 0 : (back === 1 ? d[1] : -d[1]));
      var ch = seam(wx * CW, wy * CH);
      for (var i = 1; i <= 2; i++) put(c0 - d[0] * back + wx * i, r0 - d[1] * back + wy * i, WING, ch);
    });
    var body = seam(d[0] * CW, d[1] * CH);
    for (var i = 2; i <= 6; i++) put(c0 - d[0] * i, r0 - d[1] * i, FLY, i === 2 ? G('+') : body);
    put(c0 - d[0], r0 - d[1], FLY, G('+'));
    put(c0, r0, FLY, EYE_G);
  }

  /* ---------- Setting them in characters ---------- */

  // tones (each a colour): 0 nothing; 1-16 body (pale, orange, red,
  // sumi, each in four steps from its back to its edge); 17-19 fin;
  // 20 eye; 21 water
  var FIN = 17, EYE = 20, WATER = 21;

  // the characters, and those a body is set in at each step out from
  // its back: heaviest along the spine, lightest at the edge
  var GLYPHS = ' .:*+xsXS%8#@o~\\|/-=';
  function G(ch) { return GLYPHS.indexOf(ch); }
  var STEPS = ['@#8%', 'XS%8', 'xs*+', ':.'].map(function (set) { return set.split('').map(G); });
  var DOT = G('.'), COLON = G(':'), EYE_G = G('o');
  var STROKES = [G('~'), G('\\'), G('|'), G('/')];
  var SEAMS = [G('-'), G('\\'), G('|'), G('/')];
  var SHELL = 22, SEAM = 23, RIM2 = 24, SKIN = 25, FLY = 26, WING = 27;

  // the fans of fin and tail, worked out once a frame per koi
  var fans = [];

  function fanOf(k) {
    fans.length = 0;
    var open = 1 - Math.min(1, k.beat);   // fins spread in a glide
    [[0.25, 1.6, 0.6, 0.45], [0.56, 0.9, 0.5, 0.32]].forEach(function (f, j) {
      at(k, f[0]);
      var hw = girth(f[0]) * k.W;
      [1, -1].forEach(function (sd) {
        var ang = f[2] + 0.45 * open + 0.12 * Math.sin(k.phase * 0.5 + sd * 1.3 + j);
        fans.push({
          x: AX - ATY * sd * hw * 0.8, y: AY + ATX * sd * hw * 0.8,
          dx: ATX * Math.cos(ang) - ATY * sd * Math.sin(ang),
          dy: ATY * Math.cos(ang) + ATX * sd * Math.sin(ang),
          half: f[3], len: k.W * f[1], fork: false, bend: 0
        });
      });
    });
    at(k, 0.97);
    var tdx = ATX, tdy = ATY;
    at(k, 0.86);
    var sway = 0.12 + 0.88 * Math.min(1, k.beat);
    fans.push({ x: AX, y: AY, dx: tdx, dy: tdy, half: 0.55, len: k.L * 0.26, fork: true, bend: 0.45 * sway * Math.cos(k.phase - 5.3) });
  }

  // how far out a fan reaches at (x, y), from 0 at its root to 1 at its
  // edge, or -1 outside it
  function inFan(f, x, y) {
    var ex = x - f.x, ey = y - f.y, r = Math.hypot(ex, ey);
    if (r < 1 || r > f.len) return -1;
    var o = Math.atan2(f.dx * ey - f.dy * ex, f.dx * ex + f.dy * ey) - f.bend * (r / f.len);
    if (Math.abs(o) > f.half) return -1;
    var t = Math.abs(o) / f.half;
    var reach = f.fork ? 0.5 + 0.5 * Math.pow(t, 1.2) : Math.sqrt(Math.max(0, 1 - t * t));
    return r <= f.len * reach ? r / f.len : -1;
  }

  // a cheap, steady hash, so each place on a koi keeps its character
  function hash(a, b, c) {
    var h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // set a koi into the pond's grid of characters
  function set(p, k) {
    var N = k.N, W = k.W, px = k.px, py = k.py;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var s = 0; s < N; s++) {
      if (px[s] < minx) minx = px[s]; if (px[s] > maxx) maxx = px[s];
      if (py[s] < miny) miny = py[s]; if (py[s] > maxy) maxy = py[s];
    }
    var reach = Math.max(W * 2, k.L * 0.27);
    var dx0 = p.gx - p.x, dy0 = p.gy - p.y;    // the grid within the pond
    var c0 = Math.max(0, Math.floor((minx - reach - dx0) / CW)), c1 = Math.min(p.cols - 1, Math.ceil((maxx + reach - dx0) / CW));
    var r0 = Math.max(0, Math.floor((miny - reach - dy0) / CH)), r1 = Math.min(p.rows - 1, Math.ceil((maxy + reach - dy0) / CH));
    fanOf(k);

    // the eyes
    at(k, 0.1);
    var eo = girth(0.1) * W * 0.55;
    var e1x = AX - ATY * eo, e1y = AY + ATX * eo, e2x = AX + ATY * eo, e2y = AY - ATX * eo;

    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var cell = r * p.cols + c;
        if (p.tone[cell] && p.tone[cell] < WATER) continue;   // never over another koi
        var qx = dx0 + (c + 0.5) * CW, qy = dy0 + (r + 0.5) * CH;
        // the nearest place on the spine
        var best = Infinity, bk = 0, bu = 0, side = 1;
        for (var i = 0; i < N - 1; i++) {
          var ax = px[i], ay = py[i], abx = px[i + 1] - ax, aby = py[i + 1] - ay;
          var l2 = abx * abx + aby * aby || 1;
          var u = ((qx - ax) * abx + (qy - ay) * aby) / l2;
          u = u < 0 ? 0 : u > 1 ? 1 : u;
          var ex = qx - (ax + abx * u), ey = qy - (ay + aby * u);
          var d2 = ex * ex + ey * ey;
          if (d2 < best) { best = d2; bk = i; bu = u; side = abx * (qy - ay) - aby * (qx - ax) > 0 ? 1 : -1; }
        }
        var d = Math.sqrt(best), t = (bk + bu) / (N - 1);
        var hw = girth(t) * W;
        var tone = 0, glyph = 0, alpha = k.depth;
        if (hw > 0 && d < hw && t < 0.88) {
          var v = side * d / hw, av = Math.abs(v);
          var step = av < 0.4 ? 0 : av < 0.68 ? 1 : av < 0.88 ? 2 : 3;
          if (t < 0.04) step = Math.max(step, 2);
          tone = (tint(k.marks, t, v) - 1) * 4 + 1 + step;
          // the character, fixed to this place on the body
          var pick = STEPS[step];
          glyph = pick[Math.floor(hash(Math.round(t * k.L / CH), Math.round(v * hw / CW), k.seed) * pick.length)];
          var a1x = (qx - e1x) / CW, a1y = (qy - e1y) / CH, a2x = (qx - e2x) / CW, a2y = (qy - e2y) / CH;
          if (a1x * a1x + a1y * a1y < 0.5 || a2x * a2x + a2y * a2y < 0.5) { tone = EYE; glyph = EYE_G; }
        } else {
          for (var j = 0; j < fans.length; j++) {
            var fr = inFan(fans[j], qx, qy);
            if (fr >= 0) {
              tone = FIN + Math.min(2, Math.floor(fr * 3));
              glyph = fr < 0.45 ? COLON : DOT;
              if (j === fans.length - 1) alpha *= 1 - 0.4 * fr;
              break;
            }
          }
        }
        if (!tone) continue;
        p.tone[cell] = tone;
        p.mark[cell] = glyph;
        p.alpha[cell] = alpha;
      }
    }
  }

  // the water's strokes, along the line where each ripple catches the
  // light, under everything else
  function ripples(p) {
    var z = p.z, gw = p.ww, gh = p.wh;
    var dx0 = p.gx - p.x, dy0 = p.gy - p.y;
    for (var r = 0; r < p.rows; r++) {
      var y = dy0 + (r + 0.5) * CH;
      var j = Math.round(y / CELL + 0.5);
      if (j < 2 || j > gh - 3) continue;
      for (var c = 0; c < p.cols; c++) {
        var x = dx0 + (c + 0.5) * CW;
        var i = Math.round(x / CELL + 0.5);
        if (i < 2 || i > gw - 3) continue;
        var a = j * gw + i;
        var gx = z[a + 1] - z[a - 1], gy = z[a + gw] - z[a - gw];
        var s1 = Math.abs(gx) > Math.abs(gy) ? 1 : gw;
        var lit = light(z, a, gw);
        if (lit < SHOW || lit < light(z, a - s1, gw) || lit < light(z, a + s1, gw)) continue;
        var cell = r * p.cols + c;
        var dir = Math.atan2(gx, -gy);
        if (dir < 0) dir += Math.PI;
        p.tone[cell] = WATER;
        p.mark[cell] = STROKES[Math.round(dir / (Math.PI / 4)) % 4];
        p.alpha[cell] = 0.25 + 0.75 * Math.min(1, (lit - SHOW) / (FULL - SHOW));
      }
    }
  }

  /* ---------- Drawing ----------
     Every character, in every colour, is drawn once into an atlas;
     the ponds are stamped from it. */

  var atlas = null, sw = 0, sh = 0, theme = '', themeAt = 0;

  function themeNow() {
    var bg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bg);
    if (!m) return 'light';
    var l = (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000;
    return l < 110 ? 'dark' : 'light';
  }

  function build() {
    var P = PALETTES[theme];
    var colours = [null].concat(P.body, P.mark, P.red, P.sumi, P.fin, [P.eye, P.water], P.shell, [P.skin, P.fly, P.wing]);
    sw = Math.ceil(CW * dpr);
    sh = Math.ceil(CH * dpr);
    atlas = document.createElement('canvas');
    atlas.width = sw * GLYPHS.length;
    atlas.height = sh * colours.length;
    var a = atlas.getContext('2d');
    a.textAlign = 'center';
    a.textBaseline = 'alphabetic';
    for (var t = 1; t < colours.length; t++) {
      a.fillStyle = colours[t];
      a.font = (t < FIN || t === EYE || t === SHELL || t === SEAM || t === SKIN || t === FLY ? '700 ' : '400 ') + (SIZE * dpr) + 'px ' + FACE;
      for (var g = 1; g < GLYPHS.length; g++) {
        a.fillText(GLYPHS[g], g * sw + sw / 2, t * sh + sh * 0.78);
      }
    }
  }

  function stamp(t, g, x, y, alpha) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(atlas, g * sw, t * sh, sw, sh, x, y, CW, CH);
  }

  function draw(now) {
    if (!ctx) return;
    now = now || performance.now();
    if (!theme || now - themeAt > 500) {
      themeAt = now;
      var next = themeNow();
      if (next !== theme) { theme = next; atlas = null; }
    }
    if (!atlas) build();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ponds.forEach(function (p) {
      p.tone.fill(0);
      if (!still.matches) ripples(p);
      p.koi.forEach(function (k) { set(p, k); });
      p.visitors.forEach(function (v) { if (v.kind === 'turtle') setTurtle(p, v); });
      p.visitors.forEach(function (v) { if (v.kind === 'fly') setFly(p, v); });
      for (var r = 0; r < p.rows; r++) {
        for (var c = 0; c < p.cols; c++) {
          var i = r * p.cols + c, t = p.tone[i];
          if (t) stamp(t, p.mark[i], p.gx + c * CW, p.gy + r * CH, p.alpha[i]);
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- Running ---------- */

  function simulate(dt) {
    var feelings = feel(dt);
    ponds.forEach(function (p, i) {
      var ptr = feelings[i];
      if (!still.matches) stir(p, ptr);
      p.koi.forEach(function (k) { think(k, p, ptr, dt); });
      touch(p);
      p.koi.forEach(function (k) { move(k, p, dt); });
      if (!still.matches) {
        p.visitors.forEach(function (v) { if (v.kind === 'turtle') paddle(v, p, dt); else flit(v, p, dt); });
        p.visitors = p.visitors.filter(function (v) { return !v.gone; });
      }
      apart(p);
      p.koi.forEach(function (k) { follow(k); if (!still.matches) wake(k, p, dt); });
      if (!still.matches) flow(p);
    });
    if (!still.matches && clock > nextVisit) {
      visit();
      nextVisit = clock + range(VISIT_EVERY[0], VISIT_EVERY[1]);
    }
  }

  var raf = 0, last = 0, acc = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (mode === 'pond' && !visible) { last = now; return; }
    var elapsed = last ? Math.min(MAX_STEPS * STEP, (now - last) / 1000) : STEP;
    last = now;
    acc += elapsed;
    while (acc >= STEP) {
      acc -= STEP;
      clock += STEP;
      simulate(STEP);
    }
    draw(now);
  }

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (still.matches) {
      // a still pond: the koi settled into a pose, and left there
      for (var i = 0; i < 150; i++) { clock += STEP; simulate(STEP); }
      draw();
      return;
    }
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!pointer.on) pointer.fresh = true;
    pointer.on = true;
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!pointer.on) pointer.fresh = true;
    pointer.on = true;
    if (!still.matches) drop(e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget) { pointer.on = false; pointer.rest = 0; }
  });
  window.addEventListener('blur', function () { pointer.on = false; pointer.rest = 0; });

  // the CSS may land after this runs (WebKit), so lay out again as the
  // column takes its width, and whenever the window changes
  var queued = false;
  function relayout() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; layout(); });
  }
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(relayout);
    ro.observe(page);
    ro.observe(pond);
  }
  window.addEventListener('resize', relayout);
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting;
    }).observe(pond);
  }
  if (still.addEventListener) still.addEventListener('change', start);

  layout();
  start();

  /* ---------- Small things ---------- */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function range(a, b) { return a + Math.random() * (b - a); }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function angle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }
})();
