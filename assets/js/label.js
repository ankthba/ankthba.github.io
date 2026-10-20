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

  /* What runs round the band, from the bottom left, over the top and down
     to the bottom right: each page's own, in phrases set apart by wide
     spaces. Only the name upright along the bottom is the same on every
     label. Each ring is kept near one length so the lettering is the
     same size on every page. */
  var RINGS = {
    '':          ['studying computer science & applied mathematics', 'university of virginia', 'aniketh.net'],
    work:        ['pragmatic & ocradar, founder', 'alarm.com, engineering intern', 'robotics, software lead'],
    education:   ['university of virginia, class of 2030', 'y combinator startup school', 'oakton high school'],
    projects:    ['meridian, aperta, hypnagogia, haze, sentry, graphite, ocradar, splatify, ejector & edgefabric'],
    research:    ['a convolutional neural network that detects oral cancer', 'published on arxiv, october 2025'],
    music:       ['live from spotify', 'now playing', 'listening calendar', 'most listened to', 'today\u2019s listening log'],
    fragrance:   ['diptyque, herm\u00e8s, le labo, chanel, clive christian, maison margiela, kurkdjian & versace'],
    photos:      ['aviation & landscape photography', 'lufthansa, united & korean air', 'mountains & sea'],
    press:       ['wtop news radio, 2025', 'korean air & blackpink', 'star alliance & united airlines, 2024'],
    contact:     ['say hello at me@aniketh.net', 'ankthba on github, x & instagram', 'anikethb on linkedin'],
    resume:      ['curriculum vitae', 'education', 'experience', 'projects', 'technical skills', 'download as a pdf'],
    404:         ['error 404', 'page not found', 'the page you\u2019re looking for can\u2019t be found', 'try aniketh.net']
  };
  /* The capitals in the window are set in a face of their own on every
     label, as each Diptyque scent's name is lettered its own way; the
     lettering round the band is always EB Garamond. */
  var FACES = {
    work:        ['Playfair Display', 700],
    education:   ['Cinzel', 600],
    projects:    ['Bodoni Moda', 600],
    research:    ['IM Fell English', 400],
    music:       ['Fraunces', 600],
    fragrance:   ['Cormorant Garamond', 700],
    photos:      ['Gloock', 400],
    press:       ['Old Standard TT', 700],
    contact:     ['Marcellus', 400],
    resume:      ['Libre Baskerville', 700]
  };
  var faces = {};
  function face(sec) {
    var f = FACES[sec];
    if (!f) return Promise.resolve();
    if (!faces[f[0]]) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + f[0].replace(/ /g, '+') + ':wght@' + f[1] + '&display=block';
      document.head.appendChild(link);
      faces[f[0]] = new Promise(function (done) { link.onload = done; link.onerror = done; })
        .then(function () { return document.fonts && document.fonts.load(f[1] + ' 40px "' + f[0] + '"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'); })
        .catch(function () {});
    }
    return faces[f[0]];
  }

  var is404 = /^404/.test(document.title);
  var FOOT = 'aniketh';
  var ringOf = function (sec) { return RINGS[sec in RINGS ? sec : ''].join('\u00a0\u00a0\u00a0'); };

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

  function build(words, drawing, seed, RING, FACE) {
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
    if (FACE) {
      letters.style.fontFamily = '"' + FACE[0] + '", "EB Garamond", serif';
      letters.style.fontWeight = FACE[1];
    }

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
       to the other. Every page sets it at the homepage's size, SIZE, and
       spaces it out to fill; only a line too long to close up a little
       is set smaller. */
    var BAND = 11.5, HALF = 0.24;   // (ascender - descender) / 2, in ems
    var SIZE = 7.1, SQUEEZE = 1.04;
    function band() {
      var f = SIZE;
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
        var next = Math.min(SIZE, f * room * SQUEEZE / need);
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

  /* The label for any page of the site, by its section ('' is home). Its
     capitals are hidden until their face has arrived, then set. */
  function labelFor(sec) {
    var known = sec in SETS;
    var made = build(SETS[sec] || ['404'], '/assets/img/labels/' + (known && sec ? sec : 'home') + '.webp',
                     sec || 'home', ringOf(sec), FACES[sec]);
    if (FACES[sec]) {
      var word = made.svg.querySelector('.lbl__word');
      word.style.opacity = 0;
      face(sec).then(function () { made.layout(); word.style.opacity = ''; });
    }
    return made;
  }
  window.Label = { build: labelFor, sections: Object.keys(SETS) };

  var masthead = document.querySelector('.masthead');
  if (!masthead) return;
  var html = document.documentElement;
  var title = document.querySelector('.page-title');
  /* The label is set aside for now (2026-10-18): nothing builds it, and
     the index has no shelf. To bring it back, restore these lines and
     the shelf in sheet() below.
  var built = is404 ? build(['404'], '/assets/img/labels/home.webp', '404', ringOf('404'))
    : section in SETS ? labelFor(section)
    : build(chunk(title ? title.textContent : document.title), '/assets/img/labels/home.webp', section, ringOf(''));
  */
  var built = null;

  var name = masthead.querySelector('.masthead__name');
  if (name) name.classList.add(name.tagName === 'H1' ? 'lbl-sr' : 'lbl-hidden');
  if (title) title.classList.add('lbl-sr');
  html.classList.add('look-label');

  /* ---------- The head of every page ----------
     The same on every page: the line of hello and the profiles along the
     top, then the main nav, every page of the site as one large sentence
     of names set in lines that each run the full width of their columns,
     with the page you are on in full ink, so the sentence is the page's
     title too. Its label stands beside it, exactly as tall as the names.
     Pointing at another name (or tabbing to it) brings that one up and
     stands its label there instead. */
  var wide = window.matchMedia('(min-width: 48rem)');
  var HELLO = 'Hey, I’m Aniketh, <em>studying CS and Applied Math at the University of Virginia.</em>';

  function lines(list, items) {
    list.textContent = '';
    var BUDGET = 23, line = null, used = 0;
    items.forEach(function (it, i) {
      var len = it.text.length + 2;
      if (!line || used + len > BUDGET + 1) {
        if (line) list.appendChild(document.createTextNode(' '));
        line = document.createElement('span');
        line.className = 'index__line';
        list.appendChild(line);
        used = 0;
      } else {
        line.appendChild(document.createTextNode(' '));
      }
      var a = document.createElement('a');
      a.href = it.href;
      a.textContent = it.text;
      a.setAttribute('data-page', it.page);
      if (it.current) a.setAttribute('aria-current', 'page');
      var sep = document.createElement('span');
      sep.className = 'index__sep';
      sep.textContent = i === items.length - 1 ? '.' : ',';
      line.appendChild(a);
      line.appendChild(sep);
      used += len;
    });
  }

  /* The names as large as lets the longest line just fill the columns,
     and the label beside them exactly as tall as the lines. */
  function fit(list, shelf) {
    if (!list.offsetWidth) return;
    if (!wide.matches) {
      list.style.fontSize = '';
      if (shelf) shelf.style.width = '';
      if (list.parentNode.parentNode) list.parentNode.parentNode.style.removeProperty('--names');
      return;
    }
    list.style.fontSize = '100px';
    var widest = 0;
    Array.prototype.forEach.call(list.querySelectorAll('.index__line'), function (l) {
      widest = Math.max(widest, l.getBoundingClientRect().width);
    });
    if (!widest) return;
    var size = Math.min(100 * list.clientWidth / widest, 150);
    list.style.fontSize = size + 'px';
    if (list.parentNode.parentNode) list.parentNode.parentNode.style.setProperty('--names', size + 'px');
    if (shelf) {
      // from the top of the first line's capitals to the last baseline
      var tall = list.getBoundingClientRect().height - size * 0.3;
      shelf.style.width = Math.min(shelf.parentNode.clientWidth, tall / 1.28) + 'px';
      shelf.style.marginTop = size * 0.13 + 'px';
    }
  }

  var navItems = Array.prototype.map.call(masthead.querySelectorAll('.masthead__nav-link'), function (a) {
    var href = a.getAttribute('href');
    return { href: href, text: a.textContent.trim(), page: href.split('/')[1] || '', current: a.classList.contains('active') };
  });
  var here = is404 ? '404' : section in SETS ? section : '';

  function sheet() {
    var box = document.createElement('section');
    box.className = 'index';
    box.setAttribute('aria-label', 'Pages');
    var list = document.createElement('nav');
    list.className = 'index__list';
    var shelf = null;
    /* the label's shelf, set aside for now
    shelf = document.createElement('div');
    shelf.className = 'index__shelf';
    shelf.setAttribute('aria-hidden', 'true');
    */
    box.appendChild(list);
    if (shelf) box.appendChild(shelf);
    lines(list, navItems);
    return { box: box, list: list, shelf: shelf };
  }

  function index(list, shelf, base, baseLabel) {
    var links = Array.prototype.slice.call(list.querySelectorAll('a[data-page]'));
    var labels = {};
    function add(sec, made) {
      made.box = document.createElement('div');
      made.box.className = 'index__label';
      made.box.appendChild(made.svg);
      shelf.appendChild(made.box);
      labels[sec] = made;
      made.layout();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(made.layout);
    }
    function show(sec) {
      links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('data-page') === sec); });
      if (!shelf) return;
      if (!labels[sec]) {
        if (sec === base && baseLabel) add(sec, baseLabel);
        else if (wide.matches) add(sec, labelFor(sec));
        else return;
      }
      Object.keys(labels).forEach(function (k) { labels[k].box.classList.toggle('is-on', k === sec); });
    }
    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () { show(a.getAttribute('data-page')); });
      a.addEventListener('focus', function () { show(a.getAttribute('data-page')); });
    });
    list.addEventListener('mouseleave', function () { show(base); });
    show(base);
    var refit = function () { fit(list, shelf); };
    refit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    window.addEventListener('resize', refit);
    wide.addEventListener('change', function () { refit(); show(base); });
    return refit;
  }

  /* On the home page the hello is one sentence at one display size,
     set like the index: the name in ink, the rest faint. Its capitals
     stand level with the index's first line and the profiles on its
     last. */
  var home = masthead.classList.contains('masthead--home');
  var HELLO_HOME = '<span class="head__soft">Hey, I’m</span> ' +
    '<span class="head__name"><span class="head__me">Aniketh Bandlamudi</span><span class="head__comma">,</span></span> ' +
    '<em class="head__soft">studying CS and Applied Math at the University of Virginia.</em>';

  // the baseline of the first line inside el, in page pixels
  function baseline(el) {
    var mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    el.insertBefore(mark, el.firstChild);
    var y = mark.getBoundingClientRect().bottom;
    el.removeChild(mark);
    return y;
  }

  function alignHead(hello, list, logos) {
    var icon = logos && logos.querySelector('svg');
    hello.style.marginTop = '';
    if (logos) logos.style.marginBottom = '';
    if (!wide.matches) return;
    var lines = Array.prototype.map.call(list.querySelectorAll('.index__line'), baseline);
    if (!lines.length) return;
    var c = document.createElement('canvas').getContext('2d');
    c.font = '100px "EB Garamond"';
    var cap = c.measureText('H').actualBoundingBoxAscent / 100;
    var names = parseFloat(getComputedStyle(list).fontSize);
    var size = parseFloat(getComputedStyle(hello).fontSize);
    hello.style.marginTop = (lines[0] - cap * names) - (baseline(hello) - cap * size) + 'px';
    if (icon) {
      // the marks' ink stands 21.5 of 24 down their box
      var r = icon.getBoundingClientRect();
      var off = r.top + r.height * 21.5 / 24 - lines[lines.length - 1];
      logos.style.marginBottom = parseFloat(getComputedStyle(logos).marginBottom) + off + 'px';
    }
  }

  if (navItems.length) {
    var hello = document.createElement('p');
    hello.className = 'head__hello';
    hello.innerHTML = home ? HELLO_HOME : HELLO;
    masthead.insertBefore(hello, masthead.firstChild);
    var head = sheet();
    masthead.appendChild(head.box);
    index(head.list, head.shelf, here, built);
    if (home) {
      var realign = function () { alignHead(hello, head.list, masthead.querySelector('.masthead__elsewhere')); };
      realign();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(realign);
      window.addEventListener('resize', realign);
    }
  }

  /* ---------- The Index button ----------
     Once the head has scrolled away, one word in the top corner brings
     the same sentence of names back over the page. Set aside for now
     (2026-10-18): set INDEX_BUTTON to true to bring it back. */
  var INDEX_BUTTON = false;
  if (INDEX_BUTTON && navItems.length) {
    var jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'jump';
    jump.textContent = 'Index';
    jump.setAttribute('aria-expanded', 'false');
    jump.setAttribute('aria-controls', 'jump-panel');

    var panel = document.createElement('div');
    panel.className = 'jump__panel';
    panel.id = 'jump-panel';
    panel.hidden = true;
    var logos = masthead.querySelector('.masthead__elsewhere');
    if (logos) {
      var more = logos.cloneNode(true);
      more.className = 'masthead__elsewhere jump__elsewhere';
      panel.appendChild(more);
    }
    var again = sheet();
    panel.appendChild(again.box);
    document.body.appendChild(panel);
    document.body.appendChild(jump);

    var refitPanel = null;
    var setOpen = function (open) {
      panel.hidden = !open;
      html.classList.toggle('jump-open', open);
      jump.setAttribute('aria-expanded', String(open));
      jump.textContent = open ? 'Close' : 'Index';
      if (open && !refitPanel) refitPanel = index(again.list, again.shelf, here);
      else if (open) refitPanel();
    };
    jump.addEventListener('click', function () { setOpen(panel.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        html.classList.toggle('show-jump', !e[0].isIntersecting);
      }).observe(head.list);
    } else {
      html.classList.add('show-jump');
    }
  }

  /* ---------- Projects, across ----------
     The grid's rows are a pixel tall and each entry spans its own height,
     so the grid places each one, in order, at the top of whichever column
     is shortest: it reads along the rows and packs like the columns did. */
  var across = document.querySelector('.projects__list--across');
  if (across) {
    var pack = function () {
      var items = across.children, spans = [], i;
      across.classList.remove('is-packed');
      for (i = 0; i < items.length; i++) items[i].style.gridRowEnd = '';
      if (getComputedStyle(across).display !== 'grid') return;
      for (i = 0; i < items.length; i++) {
        spans.push(Math.ceil(items[i].getBoundingClientRect().height +
          parseFloat(getComputedStyle(items[i]).marginBottom)));
      }
      for (i = 0; i < items.length; i++) items[i].style.gridRowEnd = 'span ' + spans[i];
      across.classList.add('is-packed');
    };
    var packing = 0;
    var repack = function () {
      cancelAnimationFrame(packing);
      packing = requestAnimationFrame(pack);
    };
    pack();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pack);
    window.addEventListener('resize', repack);
  }
})();
