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
  var FOOT = 'university of virginia';

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

  function build(words, drawing, seed) {
    var svg = el('svg', { viewBox: '0 0 100 ' + VH, class: 'lbl__svg', 'aria-hidden': 'true' });
    var defs = el('defs', {}, svg);
    var id = 'l' + Math.floor(Math.random() * 1e6);

    el('path', { d: shape(FIELD) }, el('clipPath', { id: id + 'clip' }, defs));
    var mask = el('mask', { id: id + 'ink', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: VH, style: 'mask-type:alpha' }, defs);
    el('image', { href: drawing, x: FIELD, y: FIELD, width: 100 - 2 * FIELD, height: VH - 2 * FIELD, preserveAspectRatio: 'xMidYMid slice' }, mask);

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

    function inside(x, y) {
      var n = nAt(FIELD);
      return Math.pow(Math.abs(x - CX) / (A - FIELD - 2), n) + Math.pow(Math.abs(y - CY) / (B - FIELD - 2), n) <= 1;
    }

    /* The band lettering, set as on the bottles: its middle on the middle
       of the band between the heavy rules, the university upright at the
       bottom, and the long line filling the band from one side of it round
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

    /* EB Garamond's cap height, and how far the tails of J and Q drop
       below the line, in ems. */
    var CAP = 0.7, TAIL = { J: 0.21, Q: 0.26 };

    function layout() {
      band();

      var r = rng(seed);
      while (letters.firstChild) letters.removeChild(letters.firstChild);
      var rows = words.length;
      var range = VH - 2 * FIELD - 6;
      var longest = Math.max.apply(null, words.map(function (w) { return w.length; }));
      // As large as the window allows, with the rows stacked close but
      // not touching, and centred on the window so they use its wide middle.
      // A single row (the 404) starts larger still and is fitted below.
      var size = rows === 1 ? 34 : Math.min(19, 62 / (longest * 0.78), range / (rows * 1.25));
      var pitch = Math.min(range / rows, size * 1.45);
      words.forEach(function (word, n) {
        var mid = CY + (n - (rows - 1) / 2) * pitch;
        var chars = word.split('').map(function (ch) {
          var t = el('text', { class: 'lbl__ch' }, letters);
          t.textContent = ch;
          var fs = size * (0.78 + r() * 0.5);
          t.setAttribute('font-size', fs.toFixed(2));
          return { t: t, ch: ch, fs: fs, w: t.getComputedTextLength(), dy: (r() - 0.5) * size * 0.32 };
        });
        // put the row where the drawing is emptiest, still drifting
        // left and right from row to row like the hand-set labels; if no
        // place keeps every letter inside the window, set the row smaller
        var lean = (n % 2 ? 1 : -1) * (5 + r() * 11);
        var best = null;
        for (var k = 1; k > 0.3 && !best; k *= 0.95) {
          var y = mid + size * k * CAP / 2, gap = size * k * 0.06;
          var width = chars.reduce(function (a, c) { return a + c.w * k + gap; }, -gap);
          var y0 = Infinity, y1 = -Infinity;
          chars.forEach(function (c) {
            y0 = Math.min(y0, y + c.dy * k - c.fs * k * CAP);
            y1 = Math.max(y1, y + c.dy * k + c.fs * k * (TAIL[c.ch] || 0.03));
          });
          for (var cx = FIELD; cx <= 100 - FIELD - width; cx += 0.5) {
            if (!inside(cx, y0) || !inside(cx + width, y0) ||
                !inside(cx, y1) || !inside(cx + width, y1)) continue;
            var cost = inkUnder(cx, y0, width, y1 - y0) +
                       0.004 * Math.abs(cx + width / 2 - (CX + lean));
            if (!best || cost < best.cost) best = { x: cx, y: y, k: k, gap: gap, cost: cost };
          }
        }
        if (!best) best = { x: CX - width / 2, y: y, k: k, gap: gap };
        var x = best.x;
        chars.forEach(function (c) {
          c.t.setAttribute('font-size', (c.fs * best.k).toFixed(2));
          c.t.setAttribute('x', x.toFixed(2));
          c.t.setAttribute('y', (best.y + c.dy * best.k).toFixed(2));
          x += c.w * best.k + best.gap;
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
  var words = /^404/.test(document.title) ? ['404'] : SETS[section] || chunk(title ? title.textContent : document.title);
  var drawing = '/assets/img/labels/' + (known && section ? section : 'home') + '.webp';

  var label = document.createElement('div');
  label.className = 'lbl' + (isHome ? ' lbl--home' : '');
  var holder = document.createElement(isHome ? 'div' : 'a');
  holder.className = 'lbl__oval';
  if (!isHome) { holder.href = '/'; holder.setAttribute('aria-label', 'Aniketh Bandlamudi, home'); }
  var built = build(words, drawing, section || 'home');
  holder.appendChild(built.svg);
  label.appendChild(holder);

  var name = masthead.querySelector('.masthead__name');
  masthead.insertBefore(label, masthead.firstChild);
  // the h1 stays for screen readers; the oval is aria-hidden
  if (name) name.classList.add(name.tagName === 'H1' ? 'lbl-sr' : 'lbl-hidden');
  if (title) title.classList.add('lbl-sr');

  // On a wide screen the copyright closes the label column, under the
  // nav; label.css shows either this copy or the footer, never both.
  var meta = document.querySelector('.colophon__meta');
  if (meta) {
    var sign = document.createElement('div');
    sign.className = 'lbl__colophon';
    Array.prototype.forEach.call(meta.children, function (n) {
      if (/colophon__rights/.test(n.className)) sign.appendChild(n.cloneNode(true));
    });
    masthead.appendChild(sign);
  }
  document.documentElement.classList.add('look-label');

  built.layout();
  // measure again once EB Garamond has arrived
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(built.layout);

  /* Blocks below the first screen fade up into place as they come into
     view, as on the Pragmatic pages; neighbours that arrive together
     follow one another by a beat. */
  if ('IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var blocks = document.querySelectorAll(
      '.about__text > p, .home__row > *, .project-item, .music__sec, .photo-item, .plays--scents > li');
    var seen = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (n++ % 4) * 70 + 'ms';
        e.target.classList.add('on');
        seen.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(blocks, function (b) {
      if (b.getBoundingClientRect().top < window.innerHeight) return;
      b.classList.add('reveal');
      seen.observe(b);
    });
  }
})();
