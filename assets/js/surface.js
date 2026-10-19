/* The paper itself.

   The ground every page is set on hides a field of small characters,
   figures, letters and quiet marks, edge to edge. At rest the paper is
   bare. The cursor moves through it like a finger drawn through a bowl
   of water: only while it moves does it push, and only where the water
   is stirred does the type come up, scrambling in the wake and in the
   ripples that run out from it. When the cursor stops, the water
   settles of its own accord and the characters fade back into the
   paper, until it moves again.

   The stirring is a damped wave equation on a bed of springs, worked
   out on the character grid at a fixed step: the cursor presses it,
   its depth darkens the characters and its motion scrambles them.
   Each character is drawn once into an atlas, and only the cells that
   change are drawn again. It sleeps when nothing moves, and for anyone
   who has asked for less motion the field is printed once and left. */

'use strict';

(function () {
  /* ---------- Tuning ----------
     Distances are in CSS pixels, times in seconds. */

  var CELL = 16;             // the size of a character's cell
  var MAX_CELLS = 12000;     // past this many, the cells grow instead
  var SIZE = 0.7;            // the type's size, as a share of the cell
  var GLYPHS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ·:;+×=~*/\\|<>()[]§¶†&%#';
  var ITALIC = 0.2;          // the share of characters set in italic

  var REST = 0;              // the ink's strength at rest: none, the paper is bare
  var PEAK = 0.145;          // and at its strongest, right under the cursor
  var DRIFT = 0.03;          // the share of characters that change each second at rest
  var SCRAMBLE = 12;         // changes a second for a character the cursor is stirring hard

  var PAD = 3;               // cells worked out beyond each edge of the window
  var STEP = 1 / 60;         // the fixed step, whatever the screen's refresh rate
  var MAX_STEPS = 3;         // steps one frame may catch up before time is let go
  var SPEED = 260;           // how fast a ripple travels, px/s
  var SPRING = 3;            // the pull back to level, so nothing is left standing, rad/s
  var DAMPING = 5;           // drag on all motion, 1/s
  var VISCOSITY = 170;       // further drag on fine ripples, px²/s
  var SPONGE = 30;           // extra drag past the window's edges, so nothing echoes back

  var RADIUS = 44;           // the spread of the cursor's pressure (sigma)
  var WAKE = 2.4;            // how hard the cursor pushes the water at full speed
  var WAKE_SPEED = 1400;     // the speed that counts as full speed, px/s
  var PRESS = 1.6;           // how much harder a held button or a finger pushes
  var PUSH = 60;             // the push, as an acceleration of the surface
  var BOW = 0.7;             // the water heaped up ahead, against the hollow left behind
  var LEAD = 0.6;            // how far ahead and behind those sit, in spreads

  var GLOW = 1.6;            // how much the water's depth darkens the characters
  var SHEEN = 5;             // and how much its slope does, as light through a ripple
  var BEND = 10;             // how far a slope shifts a character, px per unit of slope
  var MAX_BEND = 0.12;       // at most, as a share of the cell
  var FAINT = 0.08;          // stirring under this shows nothing, so only the wake comes up
  var STIR = 0.6;            // how much its motion (per second) scrambles them
  var STILL = 0.004;         // under this speed everywhere, the field counts as still
  var STILL_STEPS = 12;      // for this many steps running, before it sleeps
  var IDLE = 0.25;           // seconds between the quiet changes while it sleeps

  var root = document.documentElement;
  /* A preview look can draw a field of its own instead. */
  if (window.surfaceOff) return;
  if (!window.requestAnimationFrame || !window.Float32Array) return;
  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var still = !!(calm && calm.matches);

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  var listen = function (mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  };
  var passive = { passive: true };

  /* ---------- Type ----------
     Every character, upright and italic, drawn once in the ink at full
     strength into an atlas, one cell-sized slot each; a cell is then
     its patch of paper and one slot laid over it at its strength. */

  var KINDS = GLYPHS.length * 2;
  var atlas = document.createElement('canvas');
  var actx = atlas.getContext('2d');
  var dpr = 1, slot = 16, perRow = 16;
  var paper = '#f2efe6', ink = '#1a1712';

  function tint() {
    var ground = getComputedStyle(root).backgroundColor;
    if (/^transparent$|rgba\(.*,\s*0\)$/.test(ground)) ground = getComputedStyle(document.body).backgroundColor;
    paper = ground;
    ink = getComputedStyle(document.body).color;
  }

  function cast() {
    atlas.width = perRow * slot;
    atlas.height = Math.ceil(KINDS / perRow) * slot;
    actx.clearRect(0, 0, atlas.width, atlas.height);
    actx.fillStyle = ink;
    actx.textAlign = 'center';
    actx.textBaseline = 'middle';
    var px = Math.round(slot * SIZE);
    for (var k = 0; k < KINDS; k++) {
      var italic = k >= GLYPHS.length;
      actx.font = (italic ? 'italic ' : '') + '400 ' + px + 'px "EB Garamond", Garamond, Georgia, serif';
      var x = (k % perRow) * slot, y = Math.floor(k / perRow) * slot;
      actx.save();
      actx.beginPath();
      actx.rect(x, y, slot, slot);
      actx.clip();
      actx.fillText(GLYPHS.charAt(k % GLYPHS.length), x + slot / 2, y + slot * 0.54);
      actx.restore();
    }
  }

  var pick = function () {
    return Math.floor(Math.random() * GLYPHS.length) + (Math.random() < ITALIC ? GLYPHS.length : 0);
  };

  /* ---------- The grid ----------
     cols by rows cells cover the window; the field beneath them, W by
     H, has PAD more on every side, the outermost ring held at rest. */

  var LEVELS = 48;
  var cols = 0, rows = 0, W = 0, H = 0, N = 0, cellX = CELL, cellY = CELL, cell = CELL;
  var glyph, level, offX, offY, xs, ys;
  var h, v, vn, drag;
  var subs = 1, dt = STEP, C2 = 0, K = SPRING * SPRING, NU = 0;
  var spread = 1, reach = 1, weights = null;
  var alphas = new Float32Array(LEVELS);
  for (var a = 0; a < LEVELS; a++) alphas[a] = REST + (PEAK - REST) * a / (LEVELS - 1);

  function measure() {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 3);
    var size = Math.max(CELL, Math.sqrt(r.width * r.height / MAX_CELLS));
    var c = Math.max(4, Math.round(r.width / size));
    var n = Math.max(4, Math.round(r.height / size));
    var bw = Math.round(r.width * ratio), bh = Math.round(r.height * ratio);
    if (c === cols && n === rows && ratio === dpr && bw === canvas.width && bh === canvas.height) return;
    dpr = ratio;
    cellX = r.width / c; cellY = r.height / n; cell = (cellX + cellY) / 2;
    slot = Math.floor(Math.min(cellX, cellY) * dpr);
    canvas.width = bw; canvas.height = bh;
    build(c, n);
    cast();
    print();
  }

  function build(c, n) {
    cols = c; rows = n;
    W = cols + 2 * PAD; H = rows + 2 * PAD; N = W * H;
    glyph = new Uint8Array(cols * rows);
    level = new Uint8Array(cols * rows);
    offX = new Int8Array(cols * rows); offY = new Int8Array(cols * rows);
    for (var i = 0; i < glyph.length; i++) glyph[i] = pick();

    /* Each cell's patch in device pixels, edge to edge with no gaps. */
    xs = new Int32Array(cols + 1); ys = new Int32Array(rows + 1);
    for (var x = 0; x <= cols; x++) xs[x] = Math.round(x * cellX * dpr);
    for (var y = 0; y <= rows; y++) ys[y] = Math.round(y * cellY * dpr);

    h = new Float32Array(N); v = new Float32Array(N); vn = new Float32Array(N);
    drag = new Float32Array(N);
    for (y = 0; y < H; y++) {
      var ey = y < PAD ? (PAD - y) / PAD : y >= H - PAD ? (y - (H - PAD - 1)) / PAD : 0;
      for (x = 0; x < W; x++) {
        var ex = x < PAD ? (PAD - x) / PAD : x >= W - PAD ? (x - (W - PAD - 1)) / PAD : 0;
        var e = Math.max(ex, ey);
        drag[y * W + x] = DAMPING + SPONGE * e * e;
      }
    }

    /* The constants in cells, and as many substeps a step as it takes
       to keep the fastest ripple the grid can hold stable. */
    C2 = (SPEED / cell) * (SPEED / cell);
    NU = VISCOSITY / (cell * cell);
    var omega2 = 8 * C2 + K, beta = DAMPING + SPONGE + 8 * NU;
    for (subs = 1; subs < 8; subs++) {
      dt = STEP / subs;
      if (beta * dt < 1 && omega2 * dt * dt < 0.7 * (4 - 2 * beta * dt)) break;
    }
    spread = RADIUS / cell;
    reach = Math.ceil(spread * 3);
    weights = new Float32Array(2 * reach + 3);
    quiet = 0;
  }

  /* ---------- Printing ---------- */

  function put(i) {
    var x = i % cols, y = (i - x) / cols;
    var x0 = xs[x], y0 = ys[y], w = xs[x + 1] - x0, hh = ys[y + 1] - y0;
    ctx.globalAlpha = 1;
    ctx.fillRect(x0, y0, w, hh);
    var k = glyph[i];
    ctx.globalAlpha = alphas[level[i]];
    ctx.drawImage(atlas, (k % perRow) * slot, Math.floor(k / perRow) * slot, slot, slot,
      x0 + ((w - slot) >> 1) + offX[i], y0 + ((hh - slot) >> 1) + offY[i], slot, slot);
  }

  function print() {
    if (!N) return;
    ctx.globalAlpha = 1;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < glyph.length; i++) put(i);
    canvas.style.visibility = '';
    root.classList.add('surface-on');
  }

  /* ---------- The cursor ---------- */

  var pointer = { x: 0, y: 0, on: false, down: false };
  var was = false, fromX = 0, fromY = 0, lastX = 0, lastY = 0;
  var speed = 0, force = 0, dirX = 1, dirY = 0;
  var SMOOTH = 1 - Math.exp(-STEP / 0.06);

  /* Press the field at (cx, cy), in cells, with a Gaussian of pressure. */
  function press(cx, cy, amount) {
    var x0 = Math.max(1, Math.ceil(cx - reach)), x1 = Math.min(W - 2, Math.floor(cx + reach));
    var y0 = Math.max(1, Math.ceil(cy - reach)), y1 = Math.min(H - 2, Math.floor(cy + reach));
    var k = 1 / (2 * spread * spread), x, y, d;
    for (x = x0; x <= x1; x++) { d = x - cx; weights[x - x0] = Math.exp(-d * d * k); }
    for (y = y0; y <= y1; y++) {
      d = y - cy;
      var wy = Math.exp(-d * d * k) * amount;
      if (wy < 1e-6) continue;
      var i = y * W + x0;
      for (x = x0; x <= x1; x++, i++) vn[i] -= wy * weights[x - x0];
    }
  }

  /* ---------- The step ---------- */

  var quiet = 0;

  function step() {
    /* Like a finger drawn through water, the cursor only pushes while
       it moves, as hard as it is fast (harder held down); stopped, it
       leaves the water to settle. */
    var aim = 0, toX = fromX, toY = fromY;
    if (pointer.on) {
      toX = PAD + pointer.x / cellX - 0.5;
      toY = PAD + pointer.y / cellY - 0.5;
      if (!was) { lastX = pointer.x; lastY = pointer.y; fromX = toX; fromY = toY; speed = 0; }
      var dx = pointer.x - lastX, dy = pointer.y - lastY;
      lastX = pointer.x; lastY = pointer.y;
      speed += (Math.sqrt(dx * dx + dy * dy) / STEP - speed) * SMOOTH;
      if (speed < 1) speed = 0;
      aim = WAKE * Math.min(1, speed / WAKE_SPEED) * (pointer.down ? PRESS : 1);
    } else {
      speed = 0;
    }
    /* Which way it is heading, smoothed, for the water it heaps ahead. */
    var mx = toX - fromX, my = toY - fromY, ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1e-3) {
      dirX += (mx / ml - dirX) * 0.4; dirY += (my / ml - dirY) * 0.4;
      var dl = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      dirX /= dl; dirY /= dl;
    }
    var moving = was !== pointer.on || toX !== fromX || toY !== fromY;
    was = pointer.on;
    var before = force;
    force = aim;
    if (force !== before) moving = true;

    var y, x, i, a, hc, vc, peak = 0;
    for (var s = 1; s <= subs; s++) {
      /* Each cell's acceleration: the pull of its neighbours (the
         wave), the spring back to rest, drag, and a viscous drag that
         smooths away the finest ripples. */
      for (y = 1; y < H - 1; y++) {
        i = y * W + 1;
        for (x = 1; x < W - 1; x++, i++) {
          hc = h[i]; vc = v[i];
          a = C2 * (h[i - 1] + h[i + 1] + h[i - W] + h[i + W] - 4 * hc) +
              NU * (v[i - 1] + v[i + 1] + v[i - W] + v[i + W] - 4 * vc) -
              K * hc - drag[i] * vc;
          vn[i] = vc + a * dt;
        }
      }
      /* A finger drawn through water leaves a hollow behind it and
         heaps the water up ahead. */
      if (force > 0 || before > 0) {
        var f = s / subs;
        var p = (before + (force - before) * f) * PUSH * dt;
        if (p > 0) {
          var px = fromX + (toX - fromX) * f, py = fromY + (toY - fromY) * f, lead = spread * LEAD;
          press(px - dirX * lead, py - dirY * lead, p);
          press(px + dirX * lead, py + dirY * lead, -p * BOW);
        }
      }
      var last = s === subs;
      for (y = 1; y < H - 1; y++) {
        i = y * W + 1;
        for (x = 1; x < W - 1; x++, i++) {
          vc = vn[i];
          h[i] += vc * dt;
          if (last) { if (vc > peak) peak = vc; else if (-vc > peak) peak = -vc; }
        }
      }
      var t = v; v = vn; vn = t;
    }
    fromX = toX; fromY = toY;
    quiet = !moving && peak < STILL ? quiet + 1 : 0;
  }

  /* ---------- Drawing ----------
     Each cell's strength follows the field's depth and motion beneath
     it; the motion also decides how often it changes character. */

  function draw(time) {
    var top = LEVELS - 1, bend = BEND * dpr, most = Math.floor(slot * MAX_BEND);
    ctx.fillStyle = paper;
    for (var y = 0; y < rows; y++) {
      var i = (y + PAD) * W + PAD, j = y * cols;
      for (var x = 0; x < cols; x++, i++, j++) {
        /* Seen through the water: the characters come up where the
           surface slopes, and lean with it. */
        var gx = (h[i + 1] - h[i - 1]) * 0.5, gy = (h[i + W] - h[i - W]) * 0.5;
        var hc = h[i], vc = v[i];
        if (hc < 0) hc = -hc;
        if (vc < 0) vc = -vc;
        var e = Math.sqrt(gx * gx + gy * gy) * SHEEN + hc * GLOW - FAINT;
        var l = e > 0.002 ? Math.round(top * (1 - Math.exp(-e))) : 0;
        var ox = 0, oy = 0;
        if (l) {
          ox = Math.round(-gx * bend); oy = Math.round(-gy * bend);
          ox = ox > most ? most : ox < -most ? -most : ox;
          oy = oy > most ? most : oy < -most ? -most : oy;
        }
        var dirty = l !== level[j] || ox !== offX[j] || oy !== offY[j];
        offX[j] = ox; offY[j] = oy;
        var stir = vc * STIR;
        if (Math.random() < (DRIFT + SCRAMBLE * (stir > 1 ? 1 : stir)) * time) { glyph[j] = pick(); dirty = true; }
        if (dirty) { level[j] = l; put(j); }
      }
    }
  }

  /* While it sleeps, a few characters still change now and then. */
  function drift() {
    if (!N) return;
    ctx.fillStyle = paper;
    var n = glyph.length * DRIFT * IDLE, whole = Math.floor(n);
    if (Math.random() < n - whole) whole++;
    for (var c = 0; c < whole; c++) {
      var j = Math.floor(Math.random() * glyph.length);
      glyph[j] = pick();
      put(j);
    }
  }

  /* ---------- The loop ----------
     Steps are a fixed sixtieth of a second, as many as the time since
     the last frame calls for. Asleep, a slow timer keeps the drift. */

  var raf = 0, then = 0, spare = 0, idle = 0;

  function doze() {
    clearTimeout(idle);
    if (!still && !document.hidden && !raf) idle = setTimeout(function () { drift(); doze(); }, IDLE * 1000);
  }

  function wake() {
    if (still || raf || document.hidden || !N) return;
    clearTimeout(idle);
    quiet = 0;
    then = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    var t = (now - then) / 1000;
    then = now;
    t = t < 0 ? 0 : t > 0.1 ? 0.1 : t;
    spare += t;
    if (spare > MAX_STEPS * STEP) spare = MAX_STEPS * STEP;
    while (spare >= STEP) { step(); spare -= STEP; }
    draw(t);
    if (quiet >= STILL_STEPS) { doze(); return; }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Listening ---------- */

  function release() { pointer.on = false; pointer.down = false; wake(); }
  var open = function () { return root.classList.contains('jump-open'); };

  document.addEventListener('pointermove', function (e) {
    if (!e.isPrimary || (e.pointerType === 'touch' && !pointer.down)) return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.on = !open();
    wake();
  }, passive);

  /* A finger is always a press; a mouse presses with its main button. */
  document.addEventListener('pointerdown', function (e) {
    if (!e.isPrimary) return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.down = e.pointerType === 'touch' || e.button === 0;
    pointer.on = !open();
    wake();
  }, passive);

  var lift = function (e) {
    if (!e.isPrimary) return;
    if (e.pointerType === 'touch') release();
    else { pointer.down = false; wake(); }
  };
  document.addEventListener('pointerup', lift, passive);
  document.addEventListener('pointercancel', lift, passive);

  /* Off the edge of the window, the field is let go. */
  document.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget && e.pointerType !== 'touch') release();
  }, passive);
  window.addEventListener('blur', release);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { wake(); doze(); return; }
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(idle);
  });

  var sizing = 0;
  window.addEventListener('resize', function () {
    if (!sizing) sizing = requestAnimationFrame(function () { sizing = 0; measure(); });
  }, passive);

  /* The theme can change by the colophon's buttons (data-theme on the
     root) or by the system; either way the ink and paper are read
     again and the field printed afresh. */
  var retint = function () { tint(); if (N) { cast(); print(); } };
  listen(window.matchMedia('(prefers-color-scheme: dark)'), retint);
  new MutationObserver(function (list) {
    for (var n = 0; n < list.length; n++) {
      if (list[n].attributeName === 'data-theme') { retint(); break; }
    }
    if (open() && pointer.on) release();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  /* Asking for less motion part way through leaves the field as it is. */
  if (calm) listen(calm, function () {
    still = calm.matches;
    if (still) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(idle);
      pointer.on = false;
    } else {
      doze();
    }
  });

  /* ---------- Start ----------
     Printed straight away in whatever face is ready, and again once
     EB Garamond has arrived. */

  canvas.className = 'surface';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.visibility = 'hidden';
  document.body.appendChild(canvas);
  tint();
  measure();
  doze();
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('400 12px "EB Garamond"'),
      document.fonts.load('italic 400 12px "EB Garamond"')
    ]).then(function () { if (N) { cast(); print(); } }, function () {});
  }
})();
