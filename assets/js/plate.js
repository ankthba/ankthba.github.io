/* The portrait.

   A photograph sampled down to a grid of tones and redrawn, cell by
   cell, in the same face the rest of the page is set in. Two things
   happen to it:

   It develops. The darkest cells are laid down first and the lighter
   ones follow, so the picture comes up out of the page the way a print
   comes up in a tray rather than simply being there.

   It takes a loupe. Cells near the pointer thicken by a step or two of
   the ramp, so the picture darkens under the cursor and settles back
   when it leaves.

   The plate itself is 3024 characters on the canvas element: one per
   cell, each a tone from 0 to 63. No image is fetched. */

(function () {
  var canvas = document.getElementById('plate');
  if (!canvas || !canvas.getContext) return;

  // Light to dark. Index 0 is an empty cell.
  var RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  var ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";

  // A cell is a little over half as wide as it is tall. The plate was
  // sampled at this proportion, so changing it here stretches the face.
  var CELL_ASPECT = 0.60;

  var DEVELOP = 900;   // ms from the first cell laid down to the last
  var FADE = 260;      // ms for one cell to come up
  var LOUPE = 0.34;    // radius, as a fraction of the plate's width
  var LIFT = 0.34;     // how far up the ramp the loupe pushes a cell

  var ctx = canvas.getContext('2d');

  // EB Garamond is not a monospace, so the heavy end of the ramp draws
  // wider than its cell and the columns mush together. Each glyph's
  // advance is measured once, and anything too wide for a cell is
  // squeezed horizontally to fit it. The grid holds; a handful of the
  // densest characters just sit a little narrow, which at this size
  // reads as tone rather than as type.
  var advance = null;

  function measure() {
    ctx.font = '100px "EB Garamond", Garamond, Georgia, serif';
    advance = new Float32Array(RAMP.length);
    for (var i = 0; i < RAMP.length; i++) {
      advance[i] = ctx.measureText(RAMP[i]).width / 100;
    }
  }
  var COLS = +canvas.dataset.cols;
  var ROWS = +canvas.dataset.rows;
  var raw = canvas.dataset.plate;

  var tone = new Float32Array(COLS * ROWS);   // 0 = empty, 1 = solid ink
  var index = {};
  for (var a = 0; a < ALPHA.length; a++) index[ALPHA[a]] = a;
  for (var i = 0; i < tone.length; i++) {
    // Stored bright-to-dark; the renderer wants ink coverage.
    tone[i] = 1 - (index[raw[i]] || 0) / 63;
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cellW = 0, cellH = 0, fontPx = 16, font = '16px';
  var start = null;
  var pointer = null;      // {x, y} in CSS pixels within the canvas
  var loupe = 0;           // eased 0..1, so the loupe fades rather than snaps
  var raf = null;

  function layout() {
    var w = canvas.parentElement.clientWidth;
    if (!w) return;
    cellW = w / COLS;
    cellH = cellW / CELL_ASPECT;
    var h = cellH * ROWS;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Deliberately larger than the cell. A Garamond lowercase fills
    // well under half its em box, so a glyph set to the cell height
    // leaves a pale gap between every row and the plate reads as
    // ruled text rather than as tone. Oversetting closes the rows up;
    // the horizontal fit below keeps the columns honest.
    fontPx = cellH * 1.12;
    font = fontPx.toFixed(2) + 'px "EB Garamond", Garamond, Georgia, serif';
  }

  function draw(now) {
    // Read off the canvas itself rather than out of the custom
    // property: a token holding light-dark() comes back from
    // getPropertyValue() as the literal function text, which canvas
    // silently rejects, and the plate would then draw in the default
    // black. That happens to look right on the ivory and disappears
    // entirely on the dark page. This resolves to a real colour.
    var ink = getComputedStyle(canvas).color || '#262624';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var elapsed = still ? Infinity : now - start;
    var radius = LOUPE * COLS * cellW;
    var last = RAMP.length - 1;

    for (var r = 0; r < ROWS; r++) {
      var y = (r + 0.5) * cellH;
      for (var c = 0; c < COLS; c++) {
        var t = tone[r * COLS + c];
        if (t <= 0) continue;

        // Darkest first: a cell's turn comes sooner the more ink it has.
        var k = elapsed === Infinity ? 1 : (elapsed - (1 - t) * DEVELOP) / FADE;
        if (k <= 0) continue;
        if (k > 1) k = 1;

        var x = (c + 0.5) * cellW;
        var lift = 0;
        if (loupe > 0.002 && pointer) {
          var dx = x - pointer.x, dy = y - pointer.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < radius) {
            var f = 1 - d / radius;
            lift = f * f * loupe;
          }
        }

        var gi = Math.round(Math.min(1, t + lift * LIFT) * last);
        var ch = RAMP[gi];
        if (ch === ' ') continue;

        ctx.globalAlpha = k;
        ctx.fillStyle = ink;

        var w = advance[gi] * fontPx;
        if (w > cellW) {
          var sx = cellW / w;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(sx, 1);
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

    var want = pointer ? 1 : 0;
    loupe += (want - loupe) * 0.22;
    if (Math.abs(want - loupe) < 0.004) loupe = want;

    draw(now);

    var developing = !still && now - start < DEVELOP + FADE + 40;
    if (developing || loupe > 0.002) schedule();
  }

  function schedule() {
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  canvas.addEventListener('pointermove', function (e) {
    var box = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
    schedule();
  });

  canvas.addEventListener('pointerleave', function () {
    pointer = null;
    schedule();
  });

  var resizeRaf = null;
  window.addEventListener('resize', function () {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      layout();
      schedule();
    });
  });

  // The theme toggle swaps the ink under us, so redraw when it does.
  new MutationObserver(function () { schedule(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function () { schedule(); });

  function boot() {
    measure();
    layout();
    start = null;
    schedule();
  }

  // Drawing before the face arrives would lay the whole plate out in
  // Georgia and then never redraw it.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('16px "EB Garamond"').then(boot, boot);
  } else {
    boot();
  }
})();
