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
    '':          ['ANI', 'KETH', 'BAND', 'LA', 'MUDI'],
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

  /* The label is a cushion oval, between an ellipse and a rounded
     rectangle: a superellipse. viewBox is 100 x 130. */
  var CX = 50, CY = 65, A = 49, B = 64, N = 2.5;
  function pt(inset, t) {
    var c = Math.cos(t), s = Math.sin(t);
    return [CX + (A - inset) * Math.sign(c) * Math.pow(Math.abs(c), 2 / N),
            CY + (B - inset) * Math.sign(s) * Math.pow(Math.abs(s), 2 / N)];
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
  var FIELD = 15.5;

  function build(words, drawing, seed, isHome) {
    var svg = el('svg', { viewBox: '0 0 100 130', class: 'lbl__svg', 'aria-hidden': 'true' });
    var defs = el('defs', {}, svg);
    var id = 'l' + Math.floor(Math.random() * 1e6);

    el('path', { d: shape(FIELD) }, el('clipPath', { id: id + 'clip' }, defs));
    var mask = el('mask', { id: id + 'ink', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: 130, style: 'mask-type:alpha' }, defs);
    el('image', { href: drawing, x: FIELD, y: FIELD, width: 100 - 2 * FIELD, height: 130 - 2 * FIELD, preserveAspectRatio: 'xMidYMid slice' }, mask);

    // paper
    el('path', { d: shape(0.4), class: 'lbl__paper' }, svg);
    // the drawing, inside the field
    el('rect', { x: 0, y: 0, width: 100, height: 130, class: 'lbl__ink', mask: 'url(#' + id + 'ink)', 'clip-path': 'url(#' + id + 'clip)' }, svg);
    // rules: heavy outer, heavy inner, hairline
    el('path', { d: shape(1.6), class: 'lbl__rule lbl__rule--outer' }, svg);
    el('path', { d: shape(12.6), class: 'lbl__rule lbl__rule--inner' }, svg);
    el('path', { d: shape(FIELD), class: 'lbl__rule lbl__rule--hair' }, svg);

    // lettering round the band: up the left, over the top, down the right
    el('path', { id: id + 'ring', d: arc(10.3, 118 * deg, 422 * deg) }, defs);
    var ring = el('text', { class: 'lbl__band' }, svg);
    el('textPath', { href: '#' + id + 'ring' }, ring).textContent = RING;
    // and upright along the bottom
    el('path', { id: id + 'foot', d: arc(4.6, 112 * deg, 68 * deg) }, defs);
    var foot = el('text', { class: 'lbl__band' }, svg);
    el('textPath', { href: '#' + id + 'foot', startOffset: '50%', 'text-anchor': 'middle' }, foot).textContent = FOOT;

    var letters = el('g', { class: 'lbl__word' }, svg);

    // Where the drawing has ink, sampled once from the image itself, so the
    // capitals can be set in its open paper rather than across the subject.
    var density = null, DW = 69, DH = 99;
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = DW; c.height = DH;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, DW, DH);
      var px = g.getImageData(0, 0, DW, DH).data;
      density = new Float32Array(DW * DH);
      for (var i = 0; i < DW * DH; i++) density[i] = px[i * 4 + 3] / 255;
      layout();
    };
    img.src = drawing;

    function inkUnder(x, y, w, h) {
      if (!density) return 0;
      var fw = 100 - 2 * FIELD, fh = 130 - 2 * FIELD, sum = 0, n = 0;
      for (var yy = y; yy < y + h; yy += 1) {
        for (var xx = x; xx < x + w; xx += 1) {
          var ix = Math.floor((xx - FIELD) / fw * DW), iy = Math.floor((yy - FIELD) / fh * DH);
          if (ix >= 0 && iy >= 0 && ix < DW && iy < DH) { sum += density[iy * DW + ix]; n++; }
        }
      }
      return n ? sum / n : 0;
    }

    function inside(x, y) {
      return Math.pow(Math.abs(x - CX) / (A - FIELD - 2), N) + Math.pow(Math.abs(y - CY) / (B - FIELD - 2), N) <= 1;
    }

    function layout() {
      // fill the band exactly, the way the label's address meets itself
      var len = svg.querySelector('#' + id + 'ring').getTotalLength();
      ring.setAttribute('textLength', (len * 0.985).toFixed(1));
      ring.setAttribute('lengthAdjust', 'spacing');

      var r = rng(seed);
      while (letters.firstChild) letters.removeChild(letters.firstChild);
      var rows = words.length;
      var top = 24, bottom = 108;
      var longest = Math.max.apply(null, words.map(function (w) { return w.length; }));
      var size = Math.min(isHome ? 11.5 : 15, 50 / (longest * 0.78), (bottom - top) / (rows * 1.25));
      words.forEach(function (word, n) {
        var y = top + (bottom - top) * (n + 0.78) / rows;
        var chars = word.split('').map(function (ch) {
          var t = el('text', { class: 'lbl__ch' }, letters);
          t.textContent = ch;
          t.setAttribute('font-size', (size * (0.78 + r() * 0.5)).toFixed(2));
          return { t: t, w: t.getComputedTextLength(), dy: (r() - 0.5) * size * 0.32 };
        });
        var gap = size * 0.06;
        var width = chars.reduce(function (a, c) { return a + c.w + gap; }, -gap);
        // put the row where the drawing is emptiest, still drifting
        // left and right from row to row like the hand-set labels
        var lean = (n % 2 ? 1 : -1) * (5 + r() * 11);
        var best = null;
        for (var cx = FIELD + 4; cx <= 100 - FIELD - 4 - width; cx += 0.5) {
          if (!inside(cx, y - size * 0.7) || !inside(cx + width, y - size * 0.7) ||
              !inside(cx, y + size * 0.15) || !inside(cx + width, y + size * 0.15)) continue;
          var cost = inkUnder(cx, y - size * 0.72, width, size * 0.9) +
                     0.004 * Math.abs(cx + width / 2 - (CX + lean));
          if (!best || cost < best.cost) best = { x: cx, cost: cost };
        }
        var x = best ? best.x : Math.max(FIELD + 6, Math.min(CX - width / 2 + lean, 100 - FIELD - 6 - width));
        chars.forEach(function (c) {
          c.t.setAttribute('x', x.toFixed(2));
          c.t.setAttribute('y', (y + c.dy).toFixed(2));
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
  var drawing = '/assets/img/labels/' + (known && section ? section : 'home') + '.webp';

  var label = document.createElement('div');
  label.className = 'lbl' + (isHome ? ' lbl--home' : '');
  var holder = document.createElement(isHome ? 'div' : 'a');
  holder.className = 'lbl__oval';
  if (!isHome) { holder.href = '/'; holder.setAttribute('aria-label', 'Aniketh Bandlamudi, home'); }
  var built = build(words, drawing, section || 'home', isHome);
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
