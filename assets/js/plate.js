/* The portrait.

   A photograph sampled down to a grid of tones and redrawn, cell by
   cell, in the same face the rest of the page is set in. Three things
   happen to it.

   It develops. The darkest cells are laid down first and the lighter
   ones follow, so the picture comes up out of the page the way a print
   comes up in a tray rather than simply being there.

   It is raked by a light. The tones are read as a height field, the
   slope of that field is measured once, and a light source walks slowly
   around it. Cells on a slope facing the light thicken by a step of the
   ramp and cells facing away thin by one, so the brow, the nose and the
   jaw keep catching and losing it. The picture never moves; only which
   characters are standing in it does.

   It keeps a trail. The cursor lays a stroke into a buffer held at cell
   resolution, and that stroke fades a little every frame. The
   photograph it was made from, backdrop already removed, shows through
   only where the stroke is, cell by cell along a grainy edge, so the
   characters step aside as you pass and close again behind you.

   The plate itself is one character per cell on the canvas element,
   each a tone from 0 to 63. No image is fetched. */

(function () {
  var canvas = document.getElementById('plate');
  if (!canvas || !canvas.getContext) return;

  // Light to dark. Index 0 is an empty cell.
  var RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  var ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";

  // A cell is a little over half as wide as it is tall. The plate was
  // sampled at this proportion, so changing it here stretches the face.
  var CELL_ASPECT = 0.60;

  var DEVELOP = 900;    // ms from the first cell laid down to the last
  var FADE = 260;       // ms for one cell to come up
  var BRUSH = 0.17;     // width of the trail, as a fraction of the plate
  var DECAY = 0.955;    // what is left of the trail after a frame
  var GRAIN = 0.5;      // how far the per-cell noise breaks up the edge
  var SOFT = 0.35;      // width of the front between type and photograph
  var RELIEF = 0.17;    // how hard the raking light bites
  var ORBIT = 27000;    // ms for the light to walk once around
  var FRAME = 42;       // ms between frames while only the light is moving

  var ctx = canvas.getContext('2d');
  var COLS = +canvas.dataset.cols;
  var ROWS = +canvas.dataset.rows;
  var raw = canvas.dataset.plate;
  var N = COLS * ROWS;
  var tone;

  var full = new Float32Array(N);   // 0 = empty, 1 = solid ink
  var index = {};
  for (var a = 0; a < ALPHA.length; a++) index[ALPHA[a]] = a;
  for (var i = 0; i < N; i++) {
    // Stored bright-to-dark; the renderer wants ink coverage.
    full[i] = 1 - (index[raw[i]] || 0) / 63;
  }

  /* ---- trim to the face ----------------------------------------- */

  // The plate was cut from a photograph, so it carries the blank sky
  // the photographer left around the head. Centring the canvas box
  // would then centre that blank rather than the face, which reads as
  // the picture sitting too low. Rows and columns carrying almost no
  // ink are dropped, so the box that gets centred is the head itself.
  (function () {
    var rowSum = new Float32Array(ROWS), colSum = new Float32Array(COLS);
    var r, c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var v = full[r * COLS + c];
        rowSum[r] += v;
        colSum[c] += v;
      }
    }
    function bounds(sums, n) {
      var peak = 0, k;
      for (k = 0; k < n; k++) if (sums[k] > peak) peak = sums[k];
      var floor = peak * 0.035;
      var lo = 0, hi = n - 1;
      while (lo < hi && sums[lo] <= floor) lo++;
      while (hi > lo && sums[hi] <= floor) hi--;
      return [lo, hi];
    }
    var rb = bounds(rowSum, ROWS), cb = bounds(colSum, COLS);
    var r0 = rb[0], r1 = rb[1], c0 = cb[0], c1 = cb[1];
    var w = c1 - c0 + 1, h = r1 - r0 + 1;
    var cut = new Float32Array(w * h);
    for (r = 0; r < h; r++) {
      for (c = 0; c < w; c++) {
        cut[r * w + c] = full[(r + r0) * COLS + (c + c0)];
      }
    }
    COLS = w;
    ROWS = h;
    N = w * h;
    tone = cut;
  })();

  /* ---- let the shoulders go ------------------------------------- */

  // The photograph was cropped below the collar, so the plate ends on a
  // straight cut through the shoulders. Rather than move the crop and
  // drag the whole suit in with it, the last few rows are faded out, so
  // the picture dissolves into the page the way the bottom of a plate
  // does instead of stopping dead.
  (function () {
    var band = Math.max(3, Math.round(ROWS * 0.22));
    var first = ROWS - band;
    for (var r = first; r < ROWS; r++) {
      var d = (r - first + 1) / band;         // 0 at the top of the band, 1 at the foot
      var k = 1 - d * d;                       // eased, so the fade starts gently
      for (var c = 0; c < COLS; c++) tone[r * COLS + c] *= k;
    }
  })();

  /* ---- the slope of the face ----------------------------------- */

  // Differencing the plate raw gives a jumpy, speckled normal, because
  // the tones are already quantised to 64 steps. One box blur first
  // costs nothing and leaves slopes that follow the features.
  var smooth = new Float32Array(N);
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var sum = 0, n = 0;
      for (var dr = -1; dr <= 1; dr++) {
        var rr = r + dr;
        if (rr < 0 || rr >= ROWS) continue;
        for (var dc = -1; dc <= 1; dc++) {
          var cc = c + dc;
          if (cc < 0 || cc >= COLS) continue;
          sum += tone[rr * COLS + cc];
          n++;
        }
      }
      smooth[r * COLS + c] = sum / n;
    }
  }

  var gx = new Float32Array(N);
  var gy = new Float32Array(N);
  var peak = 0;
  for (r = 0; r < ROWS; r++) {
    for (c = 0; c < COLS; c++) {
      var l = smooth[r * COLS + Math.max(0, c - 1)];
      var rt = smooth[r * COLS + Math.min(COLS - 1, c + 1)];
      var up = smooth[Math.max(0, r - 1) * COLS + c];
      var dn = smooth[Math.min(ROWS - 1, r + 1) * COLS + c];
      var ex = (rt - l) * 0.5;
      // A cell is taller than it is wide, so a step down the plate
      // covers more ground than a step across it. Without this the
      // light reads as though the face were stretched.
      var ey = (dn - up) * 0.5 * CELL_ASPECT;
      gx[r * COLS + c] = ex;
      gy[r * COLS + c] = ey;
      var m = Math.sqrt(ex * ex + ey * ey);
      if (m > peak) peak = m;
    }
  }
  if (peak > 0) {
    for (i = 0; i < N; i++) { gx[i] /= peak; gy[i] /= peak; }
  }

  /* ---- drawing -------------------------------------------------- */

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = window.matchMedia('(min-width: 1041px)');

  var cellW = 0, cellH = 0, fontPx = 16, font = '16px';
  var advance = null;
  var start = null;
  var trail = new Float32Array(N);   // how lately the cursor passed each cell
  var alive = false;                 // is there any trail left to fade
  var lastPt = null;                 // previous pointer position, for joining up
  var stage = null, stageCtx = null; // the photograph, cut to the trail

  // A fixed hash rather than Math.random, so the edge of the trail
  // breaks up the same way on every visit instead of reshuffling.
  var order = new Float32Array(N);
  (function () {
    var seed = 0x2f6e2b1;
    for (var i = 0; i < N; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed |= 0;
      order[i] = ((seed >>> 0) % 1000) / 1000;
    }
  })();

  /* ---- the photograph behind the type ---------------------------- */

  // The plate is a picture of a photograph and the photograph is still
  // there behind it, with the studio backdrop already taken off. It only
  // shows where the cursor has just been. Fetched on the first approach
  // of the pointer, because a reader who never touches it never needs it.

  var photo = null, photoReady = false, photoAsked = false;

  function wantPhoto() {
    if (photoAsked || !canvas.dataset.src) return;
    photoAsked = true;
    load(1);
  }

  function load(tries) {
    var img = new Image();

    function ready() {
      photo = img;
      photoReady = true;
      schedule();
    }

    // load fires as soon as the bytes are in, which is not the same as
    // the bitmap being decoded and drawable. Painting it before then
    // gets skipped, which shows up as the photograph appearing for a
    // frame here and there instead of whenever the trail is over it.
    // decode() waits for the thing we actually need.
    img.onload = function () {
      if (img.decode) {
        img.decode().then(ready, ready);
      } else {
        ready();
      }
    };

    img.onerror = function () {
      if (tries > 0) setTimeout(function () { load(tries - 1); }, 400);
    };

    img.src = canvas.dataset.src;
  }

  // How far a cell has given way to the photograph: nothing until the
  // cursor has been near it, then its own grain decides exactly when it
  // turns, so the trail has a ragged edge rather than a rim.
  function reveal(i) {
    var u = (trail[i] * (1 + SOFT) - order[i] * GRAIN) / SOFT;
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return u * u * (3 - 2 * u);
  }

  // Lay the brush down at a point, keeping whatever was already there:
  // the trail is the high-water mark of where the cursor has been, and
  // the decay below is what pulls it back down again.
  function stamp(x, y) {
    var radius = BRUSH * Math.max(COLS * cellW, ROWS * cellH);
    if (!(radius > 0)) return;
    for (var r = 0; r < ROWS; r++) {
      var dy = (r + 0.5) * cellH - y;
      if (dy < -radius || dy > radius) continue;
      for (var c = 0; c < COLS; c++) {
        var dx = (c + 0.5) * cellW - x;
        if (dx < -radius || dx > radius) continue;
        var d = Math.sqrt(dx * dx + dy * dy) / radius;
        if (d >= 1) continue;
        var f = 1 - d;
        f = f * f * (3 - 2 * f);
        var i = r * COLS + c;
        if (f > trail[i]) trail[i] = f;
      }
    }
    alive = true;
  }

  // A pointer that moves quickly reports in long jumps, which would lay
  // the brush down as separate blots. Join them up.
  function drag(x, y) {
    if (lastPt) {
      var dx = x - lastPt.x, dy = y - lastPt.y;
      var span = Math.sqrt(dx * dx + dy * dy);
      var step = Math.max(cellW, cellH) * 0.6;
      var n = Math.min(24, Math.floor(span / step));
      for (var j = 1; j <= n; j++) {
        stamp(lastPt.x + dx * (j / (n + 1)), lastPt.y + dy * (j / (n + 1)));
      }
    }
    stamp(x, y);
    lastPt = { x: x, y: y };
  }
  var raf = null, last = 0, visible = true;

  // EB Garamond is not a monospace, so the heavy end of the ramp draws
  // wider than its cell and the columns mush together. Each glyph's
  // advance is measured once, and anything too wide for a cell is
  // squeezed horizontally to fit it.
  function measure() {
    ctx.font = '100px "EB Garamond", Garamond, Georgia, serif';
    advance = new Float32Array(RAMP.length);
    for (var k = 0; k < RAMP.length; k++) {
      advance[k] = ctx.measureText(RAMP[k]).width / 100;
    }
  }

  // The plate's own proportions: COLS cells across, ROWS down, each
  // cell CELL_ASPECT as wide as it is tall.
  var ASPECT = (COLS * CELL_ASPECT) / ROWS;

  function layout() {
    var host = canvas.parentElement;
    var availW = host.clientWidth;
    if (!availW) return false;

    // On a wide screen the picture is laid over a column as tall as the
    // text beside it, so it is fitted to whichever of the two runs out
    // first. Narrow, it is in the flow and only the width binds.
    var availH = 0;
    if (wide.matches) {
      // clientHeight counts the padding, and that padding is standing
      // in for the space above the name and below the prose. What the
      // face has to fit inside is the content box.
      var pad = getComputedStyle(host);
      availH = host.clientHeight
             - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
      // Just short of the full height of the text. Run flush to both
      // ends and the face crowds the column; a little short of them and
      // it still reads as standing the height of the page.
      availH *= 0.88;
    }

    var w = availW;
    var h = w / ASPECT;
    if (availH > 0 && h > availH) { h = availH; w = h * ASPECT; }

    w = Math.round(w);
    h = Math.round(h);
    if (w === layout.w && h === layout.h) return false;
    layout.w = w;
    layout.h = h;

    cellW = w / COLS;
    cellH = cellW / CELL_ASPECT;

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Deliberately larger than the cell. A Garamond lowercase fills well
    // under half its em box, so a glyph set to the cell height leaves a
    // pale gap between every row and the plate reads as ruled text
    // rather than as tone. Oversetting closes the rows up; the
    // horizontal fit below keeps the columns honest.
    fontPx = cellH * 1.12;
    font = fontPx.toFixed(2) + 'px "EB Garamond", Garamond, Georgia, serif';
    return true;
  }

  var drew = false;

  function draw(now) {
    drew = true;
    // Read off the canvas itself rather than out of the custom property:
    // a token holding light-dark() comes back from getPropertyValue() as
    // the literal function text, which canvas silently rejects, and the
    // plate would then draw in the default black. That happens to look
    // right on the ivory and disappears entirely on the dark page.
    var ink = getComputedStyle(canvas).color || '#262624';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;

    var elapsed = still ? Infinity : now - start;
    var lastGlyph = RAMP.length - 1;
    var w = parseFloat(canvas.style.width);
    var h = parseFloat(canvas.style.height);

    // The photograph, cut to the trail. Cell by cell rather than as one
    // soft disc, so the two pictures meet on a broken edge of characters
    // instead of a circle.
    if (alive && photoReady) {
      if (!stage) {
        stage = document.createElement('canvas');
        stageCtx = stage.getContext('2d');
      }
      if (stage.width !== canvas.width || stage.height !== canvas.height) {
        stage.width = canvas.width;
        stage.height = canvas.height;
      }
      var dpr = canvas.width / w;
      stageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stageCtx.clearRect(0, 0, w, h);
      stageCtx.drawImage(photo, 0, 0, w, h);
      stageCtx.globalCompositeOperation = 'destination-in';
      for (var mr = 0; mr < ROWS; mr++) {
        for (var mc = 0; mc < COLS; mc++) {
          var mv = reveal(mr * COLS + mc);
          if (mv <= 0.004) continue;
          stageCtx.fillStyle = 'rgba(0,0,0,' + mv.toFixed(3) + ')';
          // Overlapping by half a pixel keeps the grid from showing as
          // a mesh of hairlines.
          stageCtx.fillRect(mc * cellW - 0.5, mr * cellH - 0.5, cellW + 1, cellH + 1);
        }
      }
      stageCtx.globalCompositeOperation = 'source-over';
      ctx.drawImage(stage, 0, 0, w, h);
      ctx.fillStyle = ink;
    }

    // Where the light is standing this frame.
    var ang = still ? -2.4 : (now / ORBIT) * Math.PI * 2;
    var lx = Math.cos(ang), ly = Math.sin(ang);

    for (var r = 0; r < ROWS; r++) {
      var y = (r + 0.5) * cellH;
      for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c;
        var t = tone[i];
        if (t <= 0) continue;

        // Darkest first: a cell's turn comes sooner the more ink it has.
        var k = elapsed === Infinity ? 1 : (elapsed - (1 - t) * DEVELOP) / FADE;
        if (k <= 0) continue;
        if (k > 1) k = 1;

        var x = (c + 0.5) * cellW;

        // Slope facing the light thickens, slope facing away thins.
        var v = t + (gx[i] * lx + gy[i] * ly) * RELIEF;

        if (v < 0) v = 0; else if (v > 1) v = 1;
        var gi = Math.round(v * lastGlyph);
        var ch = RAMP[gi];
        if (ch === ' ') continue;

        // A character stands aside where the cursor has just passed,
        // and comes back as the trail fades.
        var a = alive ? k * (1 - reveal(i)) : k;
        if (a < 0.01) continue;
        ctx.globalAlpha = a;

        var gw = advance[gi] * fontPx;
        if (gw > cellW) {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(cellW / gw, 1);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(ch, x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    raf = null;
    if (start === null) start = now;

    // Pull the whole trail down a little each frame. When there is
    // nothing left of it the plate is back to plain type and the loop
    // can stop.
    if (alive) {
      var left = 0;
      for (var ti = 0; ti < N; ti++) {
        var tv = trail[ti] * DECAY;
        trail[ti] = tv < 0.004 ? 0 : tv;
        if (trail[ti] > left) left = trail[ti];
      }
      if (left <= 0) alive = false;
    }

    var developing = !still && now - start < DEVELOP + FADE + 40;
    var busy = developing || alive;

    // While the light is the only thing moving there is no reason to
    // redraw sixty times a second.
    if (busy || now - last >= FRAME) {
      draw(now);
      last = now;
    }

    if (!still && visible) schedule();
    else if (busy) schedule();
  }

  function schedule() {
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  function refit() {
    if (layout()) schedule();
  }

  canvas.addEventListener('pointerenter', wantPhoto);

  canvas.addEventListener('pointermove', function (e) {
    wantPhoto();
    var box = canvas.getBoundingClientRect();
    drag(e.clientX - box.left, e.clientY - box.top);
    schedule();
  });

  // Break the line on the way out, so re-entering somewhere else does
  // not draw a stroke across the face from where the cursor left.
  function lift() {
    lastPt = null;
    schedule();
  }

  canvas.addEventListener('pointerleave', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener('pointerup', lift);

  window.addEventListener('resize', refit);
  if (wide.addEventListener) wide.addEventListener('change', refit);

  // The column's height follows the text beside it, which the window
  // size alone does not tell us about.
  if (window.ResizeObserver) {
    new ResizeObserver(refit).observe(canvas.parentElement);
  }

  // Nothing to animate for a reader who has left the tab, or scrolled
  // the face off the screen.
  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    if (visible) { last = 0; schedule(); }
  });

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting && !document.hidden;
      if (visible) { last = 0; schedule(); }
    }, { rootMargin: '80px' }).observe(canvas);
  }

  // The theme toggle swaps the ink under us, so redraw when it does.
  new MutationObserver(function () { last = 0; schedule(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function () { last = 0; schedule(); });

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function boot() {
    measure();
    layout();
    start = null;
    wantPhoto();
    schedule();

    // Belt and braces. The plate is the content; the develop is only a
    // flourish. If no animation frame has arrived shortly after load,
    // whatever the reason, stop waiting and put a finished plate down.
    // A hidden document never gets frames at all, and relying on them
    // in a visible one has already cost this page its portrait twice.
    setTimeout(function () {
      if (drew) return;
      var t = now();
      start = t - (DEVELOP + FADE + 100);
      draw(t);
    }, 180);
  }

  // Drawing before the face arrives would lay the whole plate out in
  // Georgia and then never redraw it.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('16px "EB Garamond"').then(boot, boot);
  } else {
    boot();
  }
})();
