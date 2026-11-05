/* =========================================================
   koi.js (home page)

   Koi on the paper, seen from above as in a pond, set as square tiles
   on a fine grid: warm white bodies ringed by a darker edge so each
   fish stands clear of the paper, and markings in pastel versions of
   the colours of whatever is playing now or was played last (taken
   from the album cover in the listening row, easing to the next
   song's as it changes; soft persimmon and coral when there is no
   cover to read), set out as breeders prize them (a cap on the head, a few steps of
   colour down the back, the tail end clean), paler fins and tail, two
   o's for eyes, and a faint character on every tile for texture, fixed
   to its place on the fish. They are large, and the whole window is
   their pond, the column of words a bank in the middle of it: each koi
   keeps to the open paper on its own side and never swims under the
   words. Every visit fills the pond afresh: enough koi for the window,
   big and smaller, spread evenly over both sides, never twice alike.

   They swim as bodies in water do: the tail's beat pushes a koi along,
   the water drags on it (lightly from ahead, hard from the side, so it
   carves its turns and coasts a long way when it stops beating), and
   it turns by bending, each joint no further than a body can. It
   cruises, glides, now and then gives a few hard beats; it keeps clear
   of the others, gives the grown ones room, drifts with them or
   follows one a while, and two that touch slide apart. Most visits
   have a young one or two, keeping close behind a grown koi and
   startling more easily. Every so often something else comes by: a
   turtle paddling slowly down one side, the koi giving it room, or a
   dragonfly that darts, hovers, and dips to touch the water.

   The water is a damped wave equation on its own fine grid: a tail
   sweeping aside pushes it one way and pulls it the other, a moving
   head heaps it up ahead, and the ripples run out from there, showing
   only along the line where each catches the light, as faint strokes.

   The cursor is in the water too, wherever it isn't over the words:
   drawn through it, it leaves a wake; flicked past a koi, the koi darts
   off; held still nearby, they come to look; a click is a raindrop, a
   ring running out and any koi near it darting away.

   Where the window is narrow (phones, or too little paper beside the
   words for a koi), the koi swim in a pond at the foot of the page,
   above the copyright. For anyone who has asked for less motion, they
   are set once and left, and the water is still.
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
  var GRID = 10;              // the tiles' pitch
  var TILE = 9;               // a tile, the rest a hairline of paper between
  var GLYPH = 7;              // the characters on them
  var WIDE = 900;             // a window this wide is all pond; narrower, a pond at the foot
  var ROOM = 230;             // and the paper beside the words at least this wide
  var EDGE = 0;               // kept clear at the window's edge
  var STEP = 1 / 60;          // the fixed step
  var MAX_STEPS = 4;          // steps one frame may catch up

  // how a koi swims
  var THRUST = 34;            // px/s², at a full beat of the tail
  var DRAG = 0.2;             // the water's drag from ahead, 1/s
  var DRAG2 = 0.008;          // and its part that grows with speed, 1/px
  var SLIP = 5;               // its drag from the side, 1/s
  var TURN = 2.2;             // rad/s², at a full bend of the body
  var SPIN = 2.4;             // drag on turning, 1/s
  var BEND = 0.065;           // the most each joint of the body bends, rad
  var SOFT = 40;              // px/s² of push for each px two koi overlap
  var SHOVE = 40;             // and never more than this, px/s²
  var FASTEST = 90;           // no koi goes faster than this, px/s
  var GIVE = 1.2;             // the most the words' bank slides a koi in one step, px
  var PART = 5;               // and two koi meeting, each, px (a swung tail is quick)

  // the water
  var CELL = 6;               // its grid
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
  var NEAR = 110;             // within this of one
  var LINGER = 0.8;           // held this still this long, they come to look
  var LOOK = 380;             // from as far as this

  // the words: where they are, koi are drawn this much lighter
  var UNDER = 0.42;

  // now and then a visitor: a turtle, or a dragonfly
  var VISIT_FIRST = [20, 40];   // s before the first
  var VISIT_EVERY = [45, 110];  // and between the rest

  // dealt out like cards, so every pond has a mix
  var VARIETIES = ['kohaku', 'kohaku', 'kohaku', 'sanke', 'sanke', 'tancho'];

  // the tiles' colours, for the paper and for the dark: bodies in four
  // steps from the back to a darker edge that rings each fish (the
  // markings' colours come from what's playing; see below)
  var PALETTES = {
    light: {
      body: ['#fdfbf6', '#f3efe5', '#e3ddd0', '#bab2a2'],
      sumi: ['#8a847d', '#8f8982', '#968f88', '#9d968e'],
      fin: ['#e1dccf', '#e8e4d9', '#eeebe3'],
      eye: '#1f1d1b', iris: '#f7f5ef', water: '#c9c4b6',
      shell: ['#7d8156', '#5d6040', '#a7a883'], skin: '#9a9a70',
      fly: '#2f7f8a', wing: '#a9c3c6',
      ink: 0.16
    },
    dark: {
      body: ['#d8d2c5', '#c4beb0', '#a49e91', '#77726a'],
      sumi: ['#5d5954', '#56524d', '#4f4b47', '#484541'],
      fin: ['#3e3c38', '#34322f', '#2b2a27'],
      eye: '#0a0908', iris: '#ece9e1', water: '#56534c',
      shell: ['#9ea171', '#c8caa0', '#75775a'], skin: '#a9a980',
      fly: '#63b6c2', wing: '#4d6b6f',
      ink: 0.3
    }
  };

  /* ---------- Where they swim ---------- */

  var whole = document.createElement('canvas');
  whole.className = 'koi koi--side';
  whole.setAttribute('aria-hidden', 'true');
  whole.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none';
  whole.hidden = true;
  document.body.appendChild(whole);

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

  function fit(c, w, h) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    var x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    atlas = null;
    return x;
  }

  function layout() {
    var vw = root.clientWidth, vh = window.innerHeight;
    var r = page.getBoundingClientRect();
    if (!r.width) return;
    // the paper either side of the words has to be wide enough for a
    // koi to swim in without going under them; if not, a pond at the foot
    var margin = Math.min(r.left, vw - r.right) - 16;
    var next = vw >= WIDE && margin >= ROOM ? 'page' : 'pond';
    var p;
    if (next === 'page') {
      whole.hidden = false;
      pond.hidden = true;
      canvas = whole;
      ctx = fit(whole, vw, vh);
      p = { x: 0, y: 0, w: vw, h: vh, wide: true };
      // the column of words, which they keep mostly clear of
      p.col = { x0: r.left - 16, x1: r.right + 16 };
    } else {
      whole.hidden = true;
      pond.hidden = false;
      canvas = pondCanvas;
      var w = pond.clientWidth, h = pond.clientHeight;
      if (!w || !h) return;
      ctx = fit(pondCanvas, w, h);
      p = { x: 0, y: 0, w: w, h: h, wide: false, col: null };
    }
    var fresh = next !== mode || !ponds.length;
    mode = next;
    p.cols = Math.floor(p.w / GRID);
    p.rows = Math.floor(p.h / GRID);
    p.gx = p.x + (p.w - p.cols * GRID) / 2;
    p.gy = p.y + (p.h - p.rows * GRID) / 2;
    var n = p.cols * p.rows;
    p.tone = new Uint8Array(n);
    p.mark = new Uint8Array(n);
    p.alpha = new Float32Array(n);
    water(p);
    var old = fresh ? null : ponds[0];
    p.koi = old ? old.koi : spawn(p);
    p.visitors = old ? old.visitors : [];
    p.koi.forEach(function (k) { keep(k, p); });
    ponds = [p];
    if (still.matches) start();
  }

  function underWords(p, x) {
    return p.col && x > p.col.x0 && x < p.col.x1;
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

  function koi(L, name, young) {
    var N = 32;
    var k = {
      L: L, W: L * 0.17, N: N, seg: L / (N - 1),
      x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, cx: 0, cy: 0,
      beat: 0.3, steer: 0,
      mood: 'cruise', moodFor: range(1, 4), pace: range(0.4, 0.62),
      phase: Math.random() * 6.3,
      n1: Math.random() * 100, n2: Math.random() * 100,
      curious: range(0.4, 1),
      depth: range(0.88, 1),
      seed: Math.floor(Math.random() * 1e6),
      fright: 0, awayX: 0, awayY: 0,
      follow: null, parent: null, home: 0,
      tipX: 0, tipY: 0, tipOn: false,
      sx: new Float32Array(N), sy: new Float32Array(N),   // the line it has swum
      px: new Float32Array(N), py: new Float32Array(N),   // the body on it, swimming
      tx: new Float32Array(N), ty: new Float32Array(N)    // which way the body runs
    };
    k.name = name || VARIETIES[Math.floor(Math.random() * VARIETIES.length)];
    k.marks = markings(k.name, young);
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

  // a koi's markings, as patches in its own terms: u along it (0 the
  // nose, 1 the tail), v across (-1 one edge, 1 the other). Set out as
  // the breeders prize them: a cap on the head, then a few steps of
  // colour down the back with white between, wrapping down a flank, the
  // tail end left clean. Each fish wears one of the cover's two colours;
  // a sanke has small spots of the other besides.
  function markings(kind, young) {
    var list = [], main = Math.random() < 0.65 ? 2 : 3, other = 5 - main;
    function patch(u, v, ru, rv, tone) {
      list.push({ u: u, v: v, ru: ru, rv: rv, tone: tone, seed: Math.random() * 50 });
    }
    if (kind === 'tancho') {
      patch(range(0.085, 0.1), range(-0.04, 0.04), range(0.045, 0.06), range(0.42, 0.52), main);
    } else {
      if (Math.random() < 0.8) patch(range(0.08, 0.105), range(-0.06, 0.06), range(0.05, 0.07), range(0.45, 0.6), main);
      var n = young ? 1 + (Math.random() < 0.4 ? 1 : 0) : 1 + Math.floor(Math.random() * 3);
      var from = range(0.19, 0.23), to = range(0.64, 0.75), gap = range(0.035, 0.06);
      var span = to - from - gap * (n - 1), parts = [], sum = 0, i;
      for (i = 0; i < n; i++) { parts.push(range(0.7, 1.3)); sum += parts[i]; }
      var u = from, side = Math.random() < 0.5 ? -1 : 1;
      for (i = 0; i < n; i++) {
        var len = span * parts[i] / sum;
        patch(u + len / 2, side * range(0, 0.22), len / 2 * range(1, 1.08), range(0.72, 0.95), main);
        side = -side;
        u += len + gap;
      }
      if (kind === 'sanke' && !young) {
        var spots = 2 + Math.floor(Math.random() * 3);
        for (i = 0; i < spots; i++) patch(range(0.26, 0.66), range(-0.5, 0.5), range(0.032, 0.045), range(0.3, 0.42), other);
      }
    }
    return { list: list };
  }

  // the colour at (u, v): the last patch that covers it, its edge a
  // little uneven, as a koi's are
  function tint(m, u, v) {
    var tone = 1;
    for (var i = 0; i < m.list.length; i++) {
      var p = m.list[i];
      var du = Math.abs(u - p.u) / p.ru, dv = Math.abs(v - p.v) / p.rv;
      var e = du * du * Math.sqrt(du) + dv * dv * Math.sqrt(dv);
      if (e < 1 + 0.16 * Math.sin(u * 37 + p.seed) + 0.1 * Math.sin(v * 6 + p.seed * 1.7)) tone = p.tone;
    }
    return tone;
  }

  /* ---------- Placing them ---------- */

  // how many, and how big: enough to fill the window every visit, a
  // little more or less each time, half of them on each side of the words
  function spawn(p) {
    var base, n, open = 0;
    if (p.wide) {
      // counted by the open paper either side of the words
      open = (p.w - (p.col ? p.col.x1 - p.col.x0 : 0)) * p.h;
      base = clamp(Math.min(p.w * 0.19, p.h * 0.36, open / p.h * 0.47), 170, 300);
      n = clamp(Math.round(open / (base * base * 2.6) + range(-0.5, 0.5)), 3, 7);
    } else {
      base = clamp(Math.min(p.h * 0.66, p.w * 0.42), 110, 170);
      n = clamp(Math.round(p.w * p.h / (base * base * 1.9) + range(-0.3, 0.7)), 2, 3);
    }
    // their sizes spread from smaller to big, a little different each
    // visit (less so in the small pond, where a small koi is too few
    // tiles across to read as a fish); the biggest placed first, and
    // dealt to the two sides in turn so each side has big and small
    var sizes = [], lo = p.wide ? 0.74 : 0.88, spread = p.wide ? 0.44 : 0.24;
    for (var z = 0; z < n; z++) sizes.push(base * (lo + spread * (z + range(0.2, 0.8)) / n));
    sizes.sort(function (a, b) { return b - a; });
    var out = [], deck = [], first = Math.random() < 0.5 ? -1 : 1;
    for (var i = 0; i < n; i++) {
      if (!deck.length) deck = shuffle(VARIETIES.slice());
      var name = deck.pop();
      var home = p.col ? (i % 2 ? -first : first) : 0;
      var L = sizes[i], k = null;
      // if it can't be fitted in on its side, a little smaller, rather
      // than under the words or left out
      for (var s = 0; s < (p.wide ? 4 : 2) && !k; s++) k = place(p, out, koi(L * Math.pow(0.92, s), name), home);
      if (k) out.push(k);
    }
    // and, often, a young one or two, each keeping close behind a grown
    // one, as many as there is room for: on the phone's narrow pond there
    // is no room for them to read as fish, so there they stay away
    var grown = out.slice();
    var room = open > 650000 ? 2 : open > 420000 ? 1 : 0;
    var young = Math.random() < 0.7 ? Math.min(room, 1 + (Math.random() < 0.4 ? 1 : 0)) : 0;
    for (var y = 0; y < young; y++) {
      var m = grown[Math.floor(Math.random() * grown.length)];
      var kid = koi(Math.max(140, m.L * range(0.48, 0.54)), Math.random() < 0.7 ? 'kohaku' : 'tancho', true);
      kid.parent = m;
      kid.home = m.home;
      kid.curious = 1;
      var ok = false;
      for (var t2 = 0; t2 < 200 && !ok; t2++) {
        kid.x = m.sx[m.N - 1] + range(-140, 140);
        kid.y = m.sy[m.N - 1] + range(-140, 140);
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

  // somewhere a koi's whole body fits, clear of the others, facing any
  // way at all, on its own side of the words; of a score of such
  // places, the one furthest from the others, so the pond fills evenly
  function place(p, out, k, home) {
    var best = null, score = -1, found = 0;
    k.home = home;
    for (var tries = 0; tries < 600 && found < 20; tries++) {
      k.x = range(0, p.w); k.y = range(0, p.h);
      k.a = Math.random() * Math.PI * 2;
      var cx = Math.cos(k.a), cy = Math.sin(k.a);
      if (p.col) {
        // clear of the words, the body's width and a little more
        var tail = k.x - cx * k.L, bank = k.W * 1.3;
        if (home < 0 ? Math.max(k.x, tail) > p.col.x0 - bank : Math.min(k.x, tail) < p.col.x1 + bank) continue;
      }
      if (!fits(k, p, out)) continue;
      found++;
      var mx = k.x - cx * k.L * 0.45, my = k.y - cy * k.L * 0.45, near = Infinity;
      for (var j = 0; j < out.length; j++) {
        var o = out[j], h = Math.floor(o.N * 0.45);
        near = Math.min(near, Math.hypot(mx - o.sx[h], my - o.sy[h]) - (k.L + o.L) * 0.2);
      }
      near = (near === Infinity ? 1e4 : near) * range(0.8, 1);
      if (near > score) { score = near; best = [k.x, k.y, k.a]; }
    }
    if (!best) return null;
    k.x = best[0]; k.y = best[1]; k.a = best[2];
    var sp = range(0, 10);
    k.vx = Math.cos(k.a) * sp; k.vy = Math.sin(k.a) * sp;
    settle(k);
    return k;
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = list[i];
      list[i] = list[j]; list[j] = t;
    }
    return list;
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
    var m = k.W * 1.2 + 4, cx = Math.cos(k.a), cy = Math.sin(k.a);
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
    // and never under the words: the body follows the head, so a head
    // kept out keeps the koi out
    if (p.col && k.home < 0 && k.x > p.col.x0 - m) { k.x = p.col.x0 - m; if (k.vx > 0) k.vx = 0; }
    if (p.col && k.home > 0 && k.x < p.col.x1 + m) { k.x = p.col.x1 + m; if (k.vx < 0) k.vx = 0; }
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
        var others = p.koi.filter(function (o) { return o !== k && !o.parent && o.home === k.home; });
        if (others.length) k.follow = others[Math.floor(Math.random() * others.length)];
      }
    }
    if (k.parent) k.home = k.parent.home;
    var want = k.mood === 'glide' ? 0.03 : k.mood === 'burst' ? 1 : k.pace;

    // where it would go: a slow wandering of its own
    var wa = k.a + 0.4 * Math.sin(clock * 0.08 + k.n1) + 0.25 * Math.sin(clock * 0.19 + k.n2);
    var dx = Math.cos(wa), dy = Math.sin(wa);

    // the pond's edges, felt a little ahead
    var look = k.L * 0.5 + spd * 1.2;
    var hx = k.x + fx * look, hy = k.y + fy * look;
    var pad = k.W * 2 + 6, R = Math.min(140, Math.min(p.w, p.h) * 0.45);
    dx += (wall(hx - pad, R) - wall(p.w - pad - hx, R)) * 3.2;
    dy += (wall(hy - pad, R) - wall(p.h - pad - hy, R)) * 3.2;

    // the words are a bank of the pond: each koi keeps to its own side
    // of them, feeling the bank ahead as it does the window's edges, and
    // if it ever finds itself under them, it turns straight back out
    if (p.col) {
      var mid = (p.col.x0 + p.col.x1) / 2, half = (p.col.x1 - p.col.x0) / 2;
      var into = 1 - Math.abs(hx - mid) / half;
      var way = k.home || (hx < mid ? -1 : 1);
      if (into > 0) dx += way * (1.2 + 2 * into);
      var shore = k.W * 2.5 + 6;
      if (way < 0) dx -= wall(p.col.x0 - shore - hx, R) * 3.2;
      else dx += wall(hx - p.col.x1 - shore, R) * 3.2;
    }

    // the others: keep clear of their bodies, drift with them
    var block = 0, near = 0, mx = 0, my = 0, ax = 0, ay = 0;
    var ahead = k.L * 0.35 + spd * 0.8;
    var qx = k.x + fx * ahead, qy = k.y + fy * ahead;
    p.koi.forEach(function (o) {
      if (o === k) return;
      for (var i = 0; i < o.N; i += 2) {
        var r = girth(i / (o.N - 1)) * o.W + k.W + 14, reach = r * 2.6;
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
      if (gd < 420) { near++; mx += o.x; my += o.y; ax += Math.cos(o.a); ay += Math.sin(o.a); }
      // and the grown ones give each other room, so they spread through
      // the pond rather than bunch in one corner of it; beside the words,
      // mostly up and down the paper, not out under them
      if (!k.parent && !o.parent) {
        var h = Math.floor(k.N / 2), ox = k.px[h] - o.px[h], oy = k.py[h] - o.py[h];
        var od = Math.hypot(ox, oy) || 1, room = (k.L + o.L) * 0.8;
        if (od < room) {
          var rf = 1 - od / room;
          dx += ox / od * rf * rf * (p.col ? 0.4 : 1.2);
          dy += oy / od * rf * rf * 1.2;
        }
      }
    });
    if (near) {
      var cxo = mx / near - k.x, cyo = my / near - k.y, cd = Math.hypot(cxo, cyo) || 1;
      if (cd > k.L * 1.6) { dx += cxo / cd * 0.12; dy += cyo / cd * 0.12; }
      var al = Math.hypot(ax, ay) || 1;
      dx += ax / al * 0.3; dy += ay / al * 0.3;
    }
    if (k.parent && p.koi.indexOf(k.parent) >= 0) {
      // the young keep close behind their own
      var m = k.parent, bx = m.px[m.N - 1], by = m.py[m.N - 1];
      var md = Math.hypot(bx - k.x, by - k.y) || 1;
      if (md > m.L * 0.4) {
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
      // away, but never off under the words
      var awx = k.awayX;
      if (p.col && k.home && awx * k.home < 0) awx *= -0.4;
      dx += awx * 4; dy += k.awayY * 4;
      want = 1.5;
    } else if (ptr.in && ptr.rest > LINGER) {
      // the cursor held still nearby: come and look, from its own side
      var px2 = clamp(ptr.x, pad, p.w - pad), py2 = clamp(ptr.y, pad, p.h - pad);
      if (p.col && k.home < 0) px2 = Math.min(px2, p.col.x0 - k.W * 2);
      if (p.col && k.home > 0) px2 = Math.max(px2, p.col.x1 + k.W * 2);
      var pd = Math.hypot(px2 - k.x, py2 - k.y) || 1;
      if (pd < LOOK) {
        var pull = k.curious * (pd > k.L * 0.45 ? 1.4 : 0.6);
        dx += (px2 - k.x) / pd * pull; dy += (py2 - k.y) / pd * pull;
        if (pd < k.L * 0.5) want = 0.05;
        else want = Math.max(want, 0.4);
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
          shift(k, nx * Math.min(worst, PART * 2), ny * Math.min(worst, PART * 2));
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
          // slid apart a little each step, never in one jump
          var half = Math.min(worst / 2, PART);
          shift(a, nx * half, ny * half);
          shift(b, -nx * half, -ny * half);
          var rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rv < 0) { a.vx -= rv * nx / 2; a.vy -= rv * ny / 2; b.vx += rv * nx / 2; b.vy += rv * ny / 2; }
          keep(a, p); keep(b, p);
        }
      }
    }
  }

  // the words are a bank for the whole body, not only the head: a koi
  // turning near it swings its body wide, and where the body would
  // reach under the words, the bank holds it off, as a wall would,
  // sliding the koi out from it
  function bank(k, p) {
    if (!p.col || !k.home) return;
    var worst = 0;
    for (var s = 0; s < k.N; s++) {
      var e = girth(s / (k.N - 1)) * k.W * 0.9;
      var over = k.home < 0 ? k.px[s] + e - p.col.x0 : p.col.x1 - k.px[s] + e;
      if (over > worst) worst = over;
    }
    if (worst <= 0) return;
    // a slide, not a jump: a little each step, and its push carried on
    k.cx += k.home * Math.min(SHOVE, worst * SOFT);
    shift(k, k.home * Math.min(worst, GIVE), 0);
    if (k.vx * k.home < 0) k.vx *= 0.6;
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
    k.phase += 2 * Math.PI * (0.4 + 0.95 * Math.min(1.5, k.beat)) * dt;
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
      var amp = k.W * (0.05 + 0.75 * u * u) * sway * Math.sin(k.phase - u * 5.3);
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
      // over the words the cursor is reading, not stirring
      var open = pointer.on && !underWords(p, x);
      return {
        x: x, y: y, dx: dx, dy: dy, rest: pointer.rest, speed: pointer.speed,
        inside: open && x >= 0 && y >= 0 && x <= p.w && y <= p.h,
        in: open && x >= -140 && y >= -140 && x <= p.w + 140 && y <= p.h + 140
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
    // a flick past a koi sends it off, the young more easily
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

  // a click is a raindrop: a ring runs out, and the koi near where it
  // lands dart away, the young from further
  function drop(cx, cy) {
    var o = origin();
    ponds.forEach(function (p) {
      var x = cx - o.x - p.x, y = cy - o.y - p.y;
      if (x < 0 || y < 0 || x > p.w || y > p.h || underWords(p, x)) return;
      push(p, x, y, 7, DROP);
      p.koi.forEach(function (k) {
        if (Math.hypot(x - k.x, y - k.y) < (k.parent ? 130 : 90)) scare(k, x, y);
      });
    });
  }

  /* ---------- Visitors ---------- */

  var nextVisit = range(VISIT_FIRST[0], VISIT_FIRST[1]);

  // something comes by the pond, in from one edge
  function visit() {
    var p = ponds[0];
    if (!p || p.visitors.length) return;
    var v = { kind: Math.random() < 0.6 ? 'turtle' : 'fly', phase: 0, n1: Math.random() * 100, life: 0, gone: false };
    var m = 70;
    if (p.wide) {
      // down or up one side of the column, on the open paper
      var top = Math.random() < 0.5;
      var left = Math.random() < 0.5;
      v.x = left ? range(p.w * 0.05, (p.col ? p.col.x0 : p.w / 2) - 110) : range((p.col ? p.col.x1 : p.w / 2) + 110, p.w * 0.95);
      v.y = top ? -m : p.h + m;
      v.a = (top ? 1 : -1) * Math.PI / 2 + range(-0.2, 0.2);
    } else {
      var fromLeft = Math.random() < 0.5;
      v.x = fromLeft ? -m : p.w + m; v.y = range(p.h * 0.3, p.h * 0.7);
      v.a = (fromLeft ? 0 : Math.PI) + range(-0.15, 0.15);
    }
    if (v.kind === 'turtle') {
      v.L = p.wide ? range(95, 125) : range(60, 80);
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
    // it too keeps out from under the words
    if (p.col) {
      var gap = t.x < (p.col.x0 + p.col.x1) / 2 ? p.col.x0 - t.L * 0.7 - t.x : t.x - p.col.x1 - t.L * 0.7;
      if (gap < 0) t.a += (t.x < (p.col.x0 + p.col.x1) / 2 ? 1 : -1) * Math.sign(Math.sin(t.a)) * 0.5 * dt;
    }
    var surge = 0.7 + 0.5 * Math.max(0, Math.sin(t.phase));
    var fx = Math.cos(t.a), fy = Math.sin(t.a), nx = -fy, ny = fx;
    t.x += fx * t.v * surge * dt;
    t.y += fy * t.v * surge * dt;
    var stroke = Math.cos(t.phase) * 0.012 * dt * 60;
    var A = t.L / 2, B = t.L * 0.4;
    [1, -1].forEach(function (sd) {
      push(p, t.x + fx * A * 0.42 + nx * sd * B * 1.2, t.y + fy * A * 0.42 + ny * sd * B * 1.2, 6, stroke);
    });
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
        if (Math.random() < 0.35 && !outside(f, p, 0) && !underWords(p, f.x)) push(p, f.x, f.y, 4, 1.4);
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
          f.a = Math.min(f.x, p.w - f.x) < Math.min(f.y, p.h - f.y) ? (f.x < p.w / 2 ? Math.PI : 0) : (f.y < p.h / 2 ? -Math.PI / 2 : Math.PI / 2);
          f.timer = 3;
        } else {
          // somewhere else on its own side of the words
          var tx = range(p.w * 0.1, p.w * 0.9), ty = range(p.h * 0.15, p.h * 0.85);
          if (p.col) tx = f.x < (p.col.x0 + p.col.x1) / 2 ? range(p.w * 0.04, p.col.x0 - 50) : range(p.col.x1 + 50, p.w * 0.96);
          f.a = Math.atan2(ty - f.y, tx - f.x);
        }
      }
    }
    if (f.life > f.stay && outside(f, p, 40)) f.gone = true;
  }

  /* ---------- Setting them in tiles ---------- */

  // tones (each a colour): 0 nothing; 1-16 body (pale, orange, red,
  // sumi, each in four steps from its back to its edge); 17-19 fin;
  // 20 eye; 21 water; 22-25 turtle (shell, seam, rim, skin); 26-27
  // dragonfly (body, wings). Water and the dragonfly are characters
  // alone; everything else is a tile with a character on it.
  var FIN = 17, EYE = 20, WATER = 21, SHELL = 22, SEAM = 23, RIM2 = 24, SKIN = 25, FLY = 26, WING = 27;
  function tiled(t) { return t && t !== WATER && t !== FLY && t !== WING; }

  var GLYPHS = ' .:*+xsXS%8#@o~\\|/-=';
  function G(ch) { return GLYPHS.indexOf(ch); }
  // the characters on a body's tiles at each step out from its back
  var STEPS = ['XS%8', 'XS%8', 'xs%8', '.:'].map(function (set) { return set.split('').map(G); });
  var DOT = G('.'), COLON = G(':'), EYE_G = G('o');
  var STROKES = [G('~'), G('\\'), G('|'), G('/')];
  var SEAMS = [G('-'), G('\\'), G('|'), G('/')];

  // the fans of fin and tail, worked out once a frame per koi
  var fans = [];

  function fanOf(k) {
    fans.length = 0;
    var open = 1 - Math.min(1, k.beat);   // fins spread in a glide
    [[0.25, 1.5, 0.6, 0.45], [0.56, 0.85, 0.5, 0.32]].forEach(function (f, j) {
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

  // set a koi into the pond's tiles
  function set(p, k) {
    var N = k.N, W = k.W, px = k.px, py = k.py;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var s = 0; s < N; s++) {
      if (px[s] < minx) minx = px[s]; if (px[s] > maxx) maxx = px[s];
      if (py[s] < miny) miny = py[s]; if (py[s] > maxy) maxy = py[s];
    }
    var reach = Math.max(W * 2, k.L * 0.27);
    var dx0 = p.gx - p.x, dy0 = p.gy - p.y;    // the grid within the pond
    var c0 = Math.max(0, Math.floor((minx - reach - dx0) / GRID)), c1 = Math.min(p.cols - 1, Math.ceil((maxx + reach - dx0) / GRID));
    var r0 = Math.max(0, Math.floor((miny - reach - dy0) / GRID)), r1 = Math.min(p.rows - 1, Math.ceil((maxy + reach - dy0) / GRID));
    fanOf(k);

    // the eyes
    at(k, 0.1);
    var eo = girth(0.1) * W * 0.55;
    // each eye is the one tile it falls in
    var e1c = Math.floor((AX - ATY * eo - dx0) / GRID), e1r = Math.floor((AY + ATX * eo - dy0) / GRID);
    var e2c = Math.floor((AX + ATY * eo - dx0) / GRID), e2r = Math.floor((AY - ATX * eo - dy0) / GRID);

    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var cell = r * p.cols + c;
        if (p.tone[cell] && p.tone[cell] !== WATER) continue;   // never over another
        var qx = dx0 + (c + 0.5) * GRID, qy = dy0 + (r + 0.5) * GRID;
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
          // the back, then the flanks, then the edge that rings the fish
          var step = av < 0.42 ? 0 : av < 0.7 ? 1 : av < 0.86 ? 2 : 3;
          if (t < 0.03) step = 3;
          tone = (tint(k.marks, t, v) - 1) * 4 + 1 + step;
          var pick = STEPS[step];
          glyph = pick[Math.floor(hash(Math.round(t * k.L / GRID), Math.round(v * hw / GRID), k.seed) * pick.length)];
          if ((c === e1c && r === e1r) || (c === e2c && r === e2r)) { tone = EYE; glyph = EYE_G; }
        } else {
          for (var j = 0; j < fans.length; j++) {
            var fr = inFan(fans[j], qx, qy);
            if (fr >= 0) {
              tone = FIN + Math.min(2, Math.floor(fr * 3));
              glyph = hash(c, r, k.seed) < 0.5 ? DOT : 0;
              if (j === fans.length - 1) alpha *= 1 - 0.35 * fr;
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
    var c0 = Math.max(0, Math.floor((t.x - R - dx0) / GRID)), c1 = Math.min(p.cols - 1, Math.ceil((t.x + R - dx0) / GRID));
    var r0 = Math.max(0, Math.floor((t.y - R - dy0) / GRID)), r1 = Math.min(p.rows - 1, Math.ceil((t.y + R - dy0) / GRID));
    var sw = Math.sin(t.phase);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var cell = r * p.cols + c;
        if (p.tone[cell] && p.tone[cell] !== WATER) continue;
        var qx = dx0 + (c + 0.5) * GRID - t.x, qy = dy0 + (r + 0.5) * GRID - t.y;
        var lx = qx * fx + qy * fy, ly = -qx * fy + qy * fx;
        var tone = 0, glyph = 0;
        var e = (lx / A) * (lx / A) + (ly / B) * (ly / B);
        if (e < 1) {
          if (e > 0.74) { tone = RIM2; glyph = COLON; }
          else {
            var onX = Math.min(Math.abs(lx - A * 0.3), Math.abs(lx + A * 0.3)) < GRID * 0.5;
            var onY = Math.abs(Math.abs(ly) - B * 0.36) < GRID * 0.5;
            if (onX && onY) { tone = SEAM; glyph = G('+'); }
            else if (onX) { tone = SEAM; glyph = across; }
            else if (onY) { tone = SEAM; glyph = along; }
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
            } else if (lx < -A && lx > -A - 9 && Math.abs(ly) < 3) { tone = SKIN; glyph = DOT; }
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
    var c0 = Math.floor((f.x - dx0) / GRID), r0 = Math.floor((f.y - dy0) / GRID);
    function put(c, r, tone, glyph) {
      if (c < 0 || r < 0 || c >= p.cols || r >= p.rows) return;
      var cell = r * p.cols + c;
      p.tone[cell] = tone; p.mark[cell] = glyph; p.alpha[cell] = 1;
    }
    var spread = Math.sin(f.phase) > 0;
    [[1, 1], [1, -1], [2, 1], [2, -1]].forEach(function (w) {
      var back = w[0], sd = w[1];
      var wx = n[0] * sd + (spread ? 0 : (back === 1 ? d[0] : -d[0]));
      var wy = n[1] * sd + (spread ? 0 : (back === 1 ? d[1] : -d[1]));
      var ch = seam(wx, wy);
      for (var i = 1; i <= 2; i++) put(c0 - d[0] * back + wx * i, r0 - d[1] * back + wy * i, WING, ch);
    });
    var body = seam(d[0], d[1]);
    for (var i = 2; i <= 6; i++) put(c0 - d[0] * i, r0 - d[1] * i, FLY, i === 2 ? G('+') : body);
    put(c0 - d[0], r0 - d[1], FLY, G('+'));
    put(c0, r0, FLY, EYE_G);
  }

  // the water's strokes, along the line where each ripple catches the
  // light, under everything else, and never under the words
  function ripples(p) {
    var z = p.z, gw = p.ww, gh = p.wh;
    var dx0 = p.gx - p.x, dy0 = p.gy - p.y;
    for (var r = 0; r < p.rows; r++) {
      var y = dy0 + (r + 0.5) * GRID;
      var j = Math.round(y / CELL + 0.5);
      if (j < 2 || j > gh - 3) continue;
      for (var c = 0; c < p.cols; c++) {
        var x = dx0 + (c + 0.5) * GRID;
        if (underWords(p, x)) continue;
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

  /* ---------- What's playing ----------
     The koi wear what's being listened to: the album cover in the
     listening row (listening.js keeps it current) is read small, its
     two most telling colours become the koi's markings, set light or
     dark enough to read on the paper, and the pond eases from one
     song's colours to the next. A cover with no colour to speak of,
     or none at all, leaves them in persimmon and vermilion. */

  var cover = document.querySelector('[data-listening-art]');
  var CHANGE = 2.4;           // s to ease from one song's colours to the next
  var DEFAULT = { a: hsl('#e86f26'), b: hsl('#d43f26') };
  var wornFrom = DEFAULT, wornTo = DEFAULT, wornT = 1, wornStep = -1, coverSrc = '';

  function hsl(hex) {
    var n = parseInt(hex.slice(1), 16);
    return toHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }

  function toHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  function hex(c) {
    var h = c[0], s = c[1], l = c[2];
    function f(n) {
      var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return '#' + [f(0), f(8), f(4)].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  // the two colours a cover is most of, among those with colour to them:
  // the strongest, and the strongest of a clearly different hue
  function telling(d) {
    var bins = [];
    for (var i = 0; i < 24; i++) bins.push({ w: 0, x: 0, y: 0, s: 0, l: 0 });
    for (var p = 0; p < d.length; p += 4) {
      if (d[p + 3] < 200) continue;
      var c = toHsl(d[p], d[p + 1], d[p + 2]);
      var chroma = c[1] * (1 - Math.abs(2 * c[2] - 1));
      if (c[2] < 0.1 || c[2] > 0.94 || chroma < 0.12) continue;
      var w = chroma * chroma, b = bins[Math.floor(c[0] * 24) % 24];
      b.w += w; b.x += Math.cos(c[0] * 2 * Math.PI) * w; b.y += Math.sin(c[0] * 2 * Math.PI) * w;
      b.s += c[1] * w; b.l += c[2] * w;
    }
    var order = bins.map(function (b, i) { return { b: b, i: i }; }).sort(function (m, n) { return n.b.w - m.b.w; });
    var first = order[0];
    if (!first || first.b.w < 1.5) return null;
    var second = null;
    for (var j = 1; j < order.length; j++) {
      var gap = Math.abs(order[j].i - first.i);
      if (Math.min(gap, 24 - gap) >= 2 && order[j].b.w > first.b.w * 0.12) { second = order[j]; break; }
    }
    function mean(b) {
      var h = Math.atan2(b.y, b.x) / (2 * Math.PI);
      return [h < 0 ? h + 1 : h, b.s / b.w, b.l / b.w];
    }
    var a = mean(first.b);
    var bb = second ? mean(second.b) : [(a[0] + 0.97) % 1, a[1], a[2] - 0.1];
    return { a: a, b: bb };
  }

  function readCover(src) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var picked = null;
      try {
        var c = document.createElement('canvas');
        c.width = c.height = 32;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0, 32, 32);
        picked = telling(x.getImageData(0, 0, 32, 32).data);
      } catch (e) {}
      if (src === coverSrc) wear(picked || DEFAULT);
    };
    img.onerror = function () { if (src === coverSrc) wear(DEFAULT); };
    img.src = src;
  }

  function wear(next) {
    wornFrom = worn();
    wornTo = next;
    wornT = still.matches ? 1 : 0;
    wornStep = -1;
    if (still.matches) { atlas = null; draw(); }
  }

  // the colours worn this moment, part way from one song's to the next
  function worn() {
    var t = ease(wornT);
    function mix(a, b) {
      var dh = ((b[0] - a[0] + 1.5) % 1) - 0.5;
      return [(a[0] + dh * t + 1) % 1, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    return { a: mix(wornFrom.a, wornTo.a), b: mix(wornFrom.b, wornTo.b) };
  }

  // a marking colour in its four steps from the back to the edge, made
  // pastel: the cover's hue, softened and lifted, a little deeper toward
  // the edge so each patch keeps its shape
  function steps(c) {
    var light = theme !== 'dark';
    var s = clamp(c[1] * 0.8, 0.34, light ? 0.66 : 0.58);
    var l = light ? 0.74 + (c[2] - 0.5) * 0.12 : 0.68 + (c[2] - 0.5) * 0.1;
    var drops = light ? [-0.03, 0, 0.05, 0.12] : [0, 0.04, 0.1, 0.17];
    return drops.map(function (dl) { return hex([c[0], s, clamp(l - dl, 0.3, 0.9)]); });
  }

  function listen() {
    var src = cover && cover.getAttribute('src');
    if (!src) { if (coverSrc) { coverSrc = ''; wear(DEFAULT); } return; }
    if (src === coverSrc) return;
    coverSrc = src;
    readCover(src);
  }
  if (cover && window.MutationObserver) {
    new MutationObserver(listen).observe(cover, { attributes: true, attributeFilter: ['src'] });
  }

  /* ---------- Drawing ----------
     Every tile, in every colour, with every character it can carry, is
     drawn once into an atlas; the pond is stamped from it. */

  var atlas = null, slot = 0, theme = '', themeAt = 0;

  function themeNow() {
    var bg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bg);
    if (!m) return 'light';
    var l = (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000;
    return l < 110 ? 'dark' : 'light';
  }

  // a character's colour on a tile: a shade darker on a light tile, a
  // shade lighter on a dark one
  function inkOf(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var dark = (r * 299 + g * 587 + b * 114) / 1000 < 90;
    var f = function (c) { return Math.round(dark ? c + (255 - c) * k * 1.3 : c * (1 - k)); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  function build() {
    var P = PALETTES[theme];
    var w = worn();
    var colours = [null].concat(P.body, steps(w.a), steps(w.b), P.sumi, P.fin, [P.eye, P.water], P.shell, [P.skin, P.fly, P.wing]);
    slot = Math.ceil(GRID * dpr);
    var tile = TILE * dpr, inset = (slot - tile) / 2, rad = 1.3 * dpr;
    atlas = document.createElement('canvas');
    atlas.width = slot * GLYPHS.length;
    atlas.height = slot * colours.length;
    var a = atlas.getContext('2d');
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    for (var t = 1; t < colours.length; t++) {
      for (var g = 0; g < GLYPHS.length; g++) {
        var x = g * slot, y = t * slot;
        if (tiled(t)) {
          a.fillStyle = colours[t];
          roundRect(a, x + inset, y + inset, tile, tile, rad);
          if (t === EYE) {
            a.font = '700 ' + (GLYPH * dpr) + 'px ' + FACE;
            a.fillStyle = P.iris;
            a.fillText('o', x + slot / 2, y + slot / 2 + 0.4 * dpr);
          } else if (g) {
            a.font = '700 ' + (GLYPH * dpr) + 'px ' + FACE;
            a.fillStyle = inkOf(colours[t], P.ink);
            a.fillText(GLYPHS[g], x + slot / 2, y + slot / 2 + 0.4 * dpr);
          }
        } else if (g) {
          a.font = (t === FLY ? '700 ' : '400 ') + ((GLYPH + 2) * dpr) + 'px ' + FACE;
          a.fillStyle = colours[t];
          a.fillText(GLYPHS[g], x + slot / 2, y + slot / 2 + 0.4 * dpr);
        }
      }
    }
  }

  function roundRect(a, x, y, w, h, r) {
    a.beginPath();
    a.moveTo(x + r, y);
    a.arcTo(x + w, y, x + w, y + h, r);
    a.arcTo(x + w, y + h, x, y + h, r);
    a.arcTo(x, y + h, x, y, r);
    a.arcTo(x, y, x + w, y, r);
    a.closePath();
    a.fill();
  }

  function stamp(t, g, x, y, alpha) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(atlas, g * slot, t * slot, slot, slot, x, y, GRID, GRID);
  }

  function draw(now) {
    if (!ctx) return;
    now = now || performance.now();
    if (!theme || now - themeAt > 500) {
      themeAt = now;
      var next = themeNow();
      if (next !== theme) { theme = next; atlas = null; }
    }
    if (wornT < 1) {
      wornT = Math.min(1, wornT + (now - (draw.last || now)) / 1000 / CHANGE);
      var stepNow = Math.round(wornT * 24);
      if (stepNow !== wornStep) { wornStep = stepNow; atlas = null; }
    }
    draw.last = now;
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
      for (var c = 0; c < p.cols; c++) {
        var x = p.gx + c * GRID;
        // under the words, lighter
        var dim = underWords(p, x - p.x + GRID / 2) ? UNDER : 1;
        for (var r = 0; r < p.rows; r++) {
          var i = r * p.cols + c, t = p.tone[i];
          if (t) stamp(t, p.mark[i], x, p.gy + r * GRID, p.alpha[i] * dim);
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
      p.koi.forEach(function (k) { follow(k); bank(k, p); if (!still.matches) wake(k, p, dt); });
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
    // a click on something to click is just that, not a raindrop
    if (e.target && e.target.closest && e.target.closest('a, button, input, textarea, select, label, [role="button"]')) return;
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
  listen();

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
