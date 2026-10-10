/* Diptyque-style labels.
   One oval label per page, built the way the bottle labels are:
   a heavy outer rule, lowercase lettering running round the band, a second
   heavy rule and a hairline, then a fine pen drawing filling the field with
   the name set over it in capitals that drift, stack and change size.
   The drawings are pen-and-ink traces of public-domain photographs,
   used as masks so they draw in the page's ink colour in both themes. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var path = location.pathname.replace(/index\.html$/, '');
  var section = path.split('/')[1] || '';

  /* How each word is broken across the label, like a word game. */
  var SETS = {
    '':          ['ANI', 'K', 'E', 'T', 'H'],
    work:        ['WO', 'RK'],
    education:   ['EDU', 'CA', 'TION'],
    projects:    ['PRO', 'JE', 'CTS'],
    research:    ['RE', 'SE', 'ARCH'],
    music:       ['MU', 'SIC'],
    fragrance:   ['FRA', 'GRAN', 'CE'],
    photos:      ['PHO', 'TO', 'GRA', 'PHY'],
    press:       ['PR', 'ESS'],
    contact:     ['CON', 'TA', 'CT'],
    resume:      ['RE', 'SU', 'ME']
  };

  /* Drawings with a face in them, where the capitals are set by hand:
     their size, each row's baseline and centre as fractions of the field,
     and the box (fractions of the field) they keep off. The portrait is set
     like Do Son: ANI across the top and K E T H stepping down beside the
     face, the surname left to the band. `dark` means the drawing has its
     own white-ink version for the dark label, since a face can't simply be
     printed in negative the way the other drawings are. */
  var PLACE = {
    '': {
      dark: true,
      size: 12.5,
      rows: [0.165, 0.37, 0.5, 0.63, 0.76],
      x: [0.34, 0.87, 0.9, 0.87, 0.84],
      clear: [0.25, 0.3, 0.76, 0.68]
    }
  };

  var RING = 'aniketh bandlamudi\u00a0\u00a0\u00a0computer science & applied mathematics\u00a0\u00a0\u00a0aniketh.net';
  var FOOT = 'charlottesville';

  function rng(seed) {
    var h = 1779033703 ^ seed.length;
    for (var i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function chunk(text) {
    var out = [];
    text.toUpperCase().split(/\s+/).forEach(function (w) {
      if (w.length <= 4) { out.push(w); return; }
      for (var i = 0; i < w.length; i += 3) out.push(w.slice(i, i + 3));
    });
    return out;
  }

  /* The label is a cushion oval measured off the real bottles: 1.27 times
     as tall as it is wide, between an ellipse and a rounded rectangle (a
     superellipse), and squaring up as it goes in, so the window round the
     drawing is nearly a rounded rectangle. viewBox is 100 x 128. */
  var VH = 128, CX = 50, CY = 64, A = 49.6, B = 63;
  var FIELD = 20.4;
  function nAt(inset) { return 2.55 + 0.25 * Math.min(1, inset / FIELD); }
  function pt(inset, t) {
    var c = Math.cos(t), s = Math.sin(t), n = nAt(inset);
    return [CX + (A - inset) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
            CY + (B - inset) * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
  }
  /* The angle t at which the curve at `inset` passes nearest (x, y). */
  function angleOf(inset, x, y) {
    var n = nAt(inset), dx = (x - CX) / (A - inset), dy = (y - CY) / (B - inset);
    return Math.atan2(Math.sign(dy) * Math.pow(Math.abs(dy), n / 2),
                      Math.sign(dx) * Math.pow(Math.abs(dx), n / 2));
  }
  function shape(inset) {
    var d = '';
    for (var i = 0; i <= 180; i++) {
      var p = pt(inset, i / 180 * Math.PI * 2);
      d += (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }
    return d + 'Z';
  }
  /* An open arc from angle a to b (radians, y down, increasing = clockwise). */
  function arc(inset, a, b) {
    var d = '', steps = 120;
    for (var i = 0; i <= steps; i++) {
      var p = pt(inset, a + (b - a) * i / steps);
      d += (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }
    return d;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var deg = Math.PI / 180;

  function build(words, drawing, seed, isHome, place) {
    var svg = el('svg', { viewBox: '0 0 100 ' + VH, class: 'lbl__svg', 'aria-hidden': 'true' });
    var defs = el('defs', {}, svg);
    var id = 'l' + Math.floor(Math.random() * 1e6);

    el('path', { d: shape(FIELD) }, el('clipPath', { id: id + 'clip' }, defs));
    var mask = el('mask', { id: id + 'ink', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: VH, style: 'mask-type:alpha' }, defs);
    var art = { href: drawing, x: FIELD, y: FIELD, width: 100 - 2 * FIELD, height: VH - 2 * FIELD, preserveAspectRatio: 'xMidYMid slice' };
    if (place && place.dark) {
      art['class'] = 'lbl__art--light';
      el('image', art, mask);
      art = Object.assign({}, art, { href: drawing.replace(/\.webp$/, '-dark.webp'), 'class': 'lbl__art--dark' });
    }
    el('image', art, mask);

    // paper
    el('path', { d: shape(0.15), class: 'lbl__paper' }, svg);
    // the drawing, inside the field
    el('rect', { x: 0, y: 0, width: 100, height: VH, class: 'lbl__ink', mask: 'url(#' + id + 'ink)', 'clip-path': 'url(#' + id + 'clip)' }, svg);
    // The four rules of the real labels: a fine line at the very edge, a
    // heavy rule set in from it, a heavy inner rule, and a hairline round
    // the picture. On the dark label (the eau de parfum) the first two give
    // way to a single fine line a little in from the edge.
    el('path', { d: shape(0.35), class: 'lbl__rule lbl__rule--edge' }, svg);
    el('path', { d: shape(5), class: 'lbl__rule lbl__rule--outer' }, svg);
    el('path', { d: shape(2.75), class: 'lbl__rule lbl__rule--thin' }, svg);
    el('path', { d: shape(18.55), class: 'lbl__rule lbl__rule--inner' }, svg);
    el('path', { d: shape(FIELD), class: 'lbl__rule lbl__rule--hair' }, svg);

    // lettering round the band: up the left, over the top, down the right,
    // and upright along the bottom. The paths are laid in layout(), once
    // the type can be measured.
    var ringPath = el('path', { id: id + 'ring' }, defs);
    var ring = el('text', { class: 'lbl__band' }, svg);
    el('textPath', { href: '#' + id + 'ring' }, ring).textContent = RING;
    var footPath = el('path', { id: id + 'foot' }, defs);
    var foot = el('text', { class: 'lbl__band' }, svg);
    el('textPath', { href: '#' + id + 'foot', startOffset: '50%', 'text-anchor': 'middle' }, foot).textContent = FOOT;

    var letters = el('g', { class: 'lbl__word' }, svg);

    // Where the drawing has ink, sampled once from the image itself, so the
    // capitals can be set in its open paper rather than across the subject.
    var density = null, DW = Math.round(100 - 2 * FIELD), DH = Math.round(VH - 2 * FIELD);
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = DW; c.height = DH;
      var g = c.getContext('2d');
      // the part of the image the field shows (it is set to cover the field)
      var sw = Math.min(img.width, img.height * DW / DH), sh = sw * DH / DW;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, DW, DH);
      var px = g.getImageData(0, 0, DW, DH).data;
      density = new Float32Array(DW * DH);
      for (var i = 0; i < DW * DH; i++) density[i] = px[i * 4 + 3] / 255;
      layout();
    };
    img.src = drawing;

    function inkUnder(x, y, w, h) {
      if (!density) return 0;
      var fw = 100 - 2 * FIELD, fh = VH - 2 * FIELD, sum = 0, n = 0;
      for (var yy = y; yy < y + h; yy += 1) {
        for (var xx = x; xx < x + w; xx += 1) {
          var ix = Math.floor((xx - FIELD) / fw * DW), iy = Math.floor((yy - FIELD) / fh * DH);
          if (ix >= 0 && iy >= 0 && ix < DW && iy < DH) { sum += density[iy * DW + ix]; n++; }
        }
      }
      return n ? sum / n : 0;
    }

    // how much of a box lies over the part of the drawing kept clear
    function overClear(x, y, w, h) {
      if (!place) return 0;
      var fw = 100 - 2 * FIELD, fh = VH - 2 * FIELD, c = place.clear;
      var ox = Math.min(x + w, FIELD + c[2] * fw) - Math.max(x, FIELD + c[0] * fw);
      var oy = Math.min(y + h, FIELD + c[3] * fh) - Math.max(y, FIELD + c[1] * fh);
      return ox > 0 && oy > 0 ? ox * oy / (w * h) : 0;
    }

    function inside(x, y) {
      var n = nAt(FIELD);
      return Math.pow(Math.abs(x - CX) / (A - FIELD - 2), n) + Math.pow(Math.abs(y - CY) / (B - FIELD - 2), n) <= 1;
    }

    /* The band lettering, set as on the bottles: its middle on the middle
       of the band between the heavy rules, the town upright at the bottom,
       and the long line filling the band from one side of the town round
       to the other, at whatever size makes it fit, as large as it can. */
    var BAND = 11.5, HALF = 0.24;   // (ascender - descender) / 2, in ems
    function band() {
      var f = 7.2;
      for (var pass = 0; pass < 5; pass++) {
        ring.style.fontSize = foot.style.fontSize = f + 'px';
        ring.removeAttribute('textLength');
        var fi = BAND - HALF * f, ri = BAND + HALF * f;
        footPath.setAttribute('d', arc(fi, 150 * deg, 30 * deg));
        var fl = footPath.getTotalLength(), tl = foot.getComputedTextLength(), gap = 0.9 * f;
        var p0 = footPath.getPointAtLength(Math.max(0, (fl - tl) / 2 - gap));
        var p1 = footPath.getPointAtLength(Math.min(fl, (fl + tl) / 2 + gap));
        var a0 = angleOf(fi, p0.x, p0.y), a1 = angleOf(fi, p1.x, p1.y);
        ringPath.setAttribute('d', arc(ri, a0, a1 + 2 * Math.PI));
        var room = ringPath.getTotalLength() * 0.99, need = ring.getComputedTextLength();
        var next = Math.min(8.6, f * room / need);
        if (Math.abs(next - f) < 0.03 || pass === 4) {
          ring.setAttribute('textLength', room.toFixed(1));
          ring.setAttribute('lengthAdjust', 'spacing');
          return;
        }
        f = next;
      }
    }

    function layout() {
      band();

      var r = rng(seed);
      while (letters.firstChild) letters.removeChild(letters.firstChild);
      var rows = words.length;
      var top = FIELD + 5.5, bottom = VH - FIELD - 4.5;
      var longest = Math.max.apply(null, words.map(function (w) { return w.length; }));
      var size = Math.min(place && place.size || (isHome ? 10 : 13), 43 / (longest * 0.78), (bottom - top) / (rows * 1.25));
      var placed = [];
      words.forEach(function (word, n) {
        var y = place ? FIELD + (VH - 2 * FIELD) * place.rows[n]
                      : top + (bottom - top) * (n + 0.78) / rows;
        var chars = word.split('').map(function (ch) {
          var t = el('text', { class: 'lbl__ch' }, letters);
          t.textContent = ch;
          var s = size * (0.78 + r() * 0.5);
          t.setAttribute('font-size', s.toFixed(2));
          return { t: t, s: s, w: t.getComputedTextLength(), dy: (r() - 0.5) * size * 0.32 };
        });
        var gap = size * 0.06;
        var width = chars.reduce(function (a, c) { c.o = a + gap; return c.o + c.w; }, -gap);
        // put the row where the drawing is emptiest, still drifting
        // left and right from row to row like the hand-set labels, or
        // held near the centre the label sets for it
        var lean = (n % 2 ? 1 : -1) * (5 + r() * 11);
        var aim = place && place.x ? FIELD + (100 - 2 * FIELD) * place.x[n] : CX + lean;
        var pull = place && place.x ? 0.05 : 0.004;
        // Rows set close together (as round the portrait's face) must
        // not run into each other: how much of this row, set at x, lands
        // on the capitals already placed, with a little air round each.
        function clash(x) {
          var hit = 0, area = 0;
          chars.forEach(function (c) {
            var x0 = x + c.o - 0.6, x1 = x0 + c.w + 1.2;
            var y1 = y + c.dy + 0.6, y0 = y1 - 0.66 * c.s - 1.2;
            area += (x1 - x0) * (y1 - y0);
            placed.forEach(function (b) {
              var ox = Math.min(x1, b[2]) - Math.max(x0, b[0]);
              var oy = Math.min(y1, b[3]) - Math.max(y0, b[1]);
              if (ox > 0 && oy > 0) hit += ox * oy;
            });
          });
          return hit / area;
        }
        // Every letter, at its own size and drift, has to clear the
        // window's edge, not just the row's nominal box: a large first
        // capital low in the row is the one that runs out over the rule.
        function fits(x) {
          return chars.every(function (c) {
            var x0 = x + c.o, x1 = x0 + c.w;
            var y1 = y + c.dy + 0.02 * c.s, y0 = y + c.dy - 0.68 * c.s;
            return inside(x0, y0) && inside(x1, y0) && inside(x0, y1) && inside(x1, y1);
          });
        }
        function search() {
          var best = null;
          for (var cx = FIELD + 3.5; cx <= 100 - FIELD - 3.5 - width; cx += 0.5) {
            if (!inside(cx, y - size * 0.7) || !inside(cx + width, y - size * 0.7) ||
                !inside(cx, y + size * 0.15) || !inside(cx + width, y + size * 0.15) ||
                !fits(cx)) continue;
            var cost = inkUnder(cx, y - size * 0.72, width, size * 0.9) +
                       10 * overClear(cx, y - size * 0.72, width, size * 0.9) +
                       10 * clash(cx) +
                       pull * Math.abs(cx + width / 2 - aim);
            if (!best || cost < best.cost) best = { x: cx, cost: cost };
          }
          return best;
        }
        // where the row can't fit at its height, walk it in towards the
        // middle of the label until it can
        var best = search();
        for (var walk = 0; !best && walk < 40; walk++) {
          y += y < CY ? 0.5 : -0.5;
          best = search();
        }
        var x = best ? best.x : Math.max(FIELD + 5, Math.min(CX - width / 2 + lean, 100 - FIELD - 5 - width));
        chars.forEach(function (c) {
          c.t.setAttribute('x', x.toFixed(2));
          c.t.setAttribute('y', (y + c.dy).toFixed(2));
          placed.push([x, y + c.dy - 0.66 * c.s, x + c.w, y + c.dy]);
          x += c.w + gap;
        });
      });
    }

    return { svg: svg, layout: layout };
  }

  /* ---------- Build ---------- */

  var masthead = document.querySelector('.masthead');
  if (!masthead) return;
  var title = document.querySelector('.page-title');
  var isHome = section === '';
  var known = section in SETS;
  var words = /^404/.test(document.title) ? ['40', '4'] : SETS[section] || chunk(title ? title.textContent : document.title);
  // the portrait is the homepage's own; any other page (the 404) gets the Lawn
  var drawing = '/assets/img/labels/' + (isHome ? 'home' : known ? section : 'lawn') + '.webp';

  var label = document.createElement('div');
  label.className = 'lbl' + (isHome ? ' lbl--home' : '');
  var holder = document.createElement(isHome ? 'div' : 'a');
  holder.className = 'lbl__oval';
  if (!isHome) { holder.href = '/'; holder.setAttribute('aria-label', 'Aniketh Bandlamudi, home'); }
  var built = build(words, drawing, section || 'home', isHome, known ? PLACE[section] : null);
  holder.appendChild(built.svg);
  label.appendChild(holder);

  var name = masthead.querySelector('.masthead__name');
  masthead.insertBefore(label, masthead.firstChild);
  // the h1 stays for screen readers; the oval is aria-hidden
  if (name) name.classList.add(name.tagName === 'H1' ? 'lbl-sr' : 'lbl-hidden');
  if (title) title.classList.add('lbl-sr');
  document.documentElement.classList.add('look-label');

  built.layout();
  // measure again once EB Garamond has arrived
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(built.layout);
})();
