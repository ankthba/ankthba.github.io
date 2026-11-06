/* lagunita/specimen.js

   The specimen's moving parts: the name fitted to the page, the tester,
   the optical-size scrubber, the feature switches and the characters.
   Nothing moves on its own; the letters change only when you move a
   control. Loaded plain (not deferred) at the end of the body, so it
   re-measures once the fonts land and whenever the window changes. */

'use strict';

(function () {
  var root = document.querySelector('.specimen');
  if (!root) return;

  /* Where the Display cut's zones sit, as a share of the em
     (x-height, cap height, ascender, descender). The big character's
     guides are drawn from these; change them if the font's do. */
  var ZONES = { x: 0.405, cap: 0.653, asc: 0.705, desc: -0.285 };

  var GLYPHS = [[33,"Exclamation mark"],[34,"Quotation mark"],[35,"Number sign"],[36,"Dollar sign"],[37,"Percent sign"],[38,"Ampersand"],[39,"Apostrophe"],[40,"Left parenthesis"],[41,"Right parenthesis"],[42,"Asterisk"],[43,"Plus sign"],[44,"Comma"],[45,"Hyphen-minus"],[46,"Full stop"],[47,"Solidus"],[48,"Digit zero"],[49,"Digit one"],[50,"Digit two"],[51,"Digit three"],[52,"Digit four"],[53,"Digit five"],[54,"Digit six"],[55,"Digit seven"],[56,"Digit eight"],[57,"Digit nine"],[58,"Colon"],[59,"Semicolon"],[60,"Less-than sign"],[61,"Equals sign"],[62,"Greater-than sign"],[63,"Question mark"],[64,"Commercial at"],[65,"Capital A"],[66,"Capital B"],[67,"Capital C"],[68,"Capital D"],[69,"Capital E"],[70,"Capital F"],[71,"Capital G"],[72,"Capital H"],[73,"Capital I"],[74,"Capital J"],[75,"Capital K"],[76,"Capital L"],[77,"Capital M"],[78,"Capital N"],[79,"Capital O"],[80,"Capital P"],[81,"Capital Q"],[82,"Capital R"],[83,"Capital S"],[84,"Capital T"],[85,"Capital U"],[86,"Capital V"],[87,"Capital W"],[88,"Capital X"],[89,"Capital Y"],[90,"Capital Z"],[91,"Left square bracket"],[92,"Reverse solidus"],[93,"Right square bracket"],[94,"Circumflex accent"],[95,"Low line"],[96,"Grave accent"],[97,"Small a"],[98,"Small b"],[99,"Small c"],[100,"Small d"],[101,"Small e"],[102,"Small f"],[103,"Small g"],[104,"Small h"],[105,"Small i"],[106,"Small j"],[107,"Small k"],[108,"Small l"],[109,"Small m"],[110,"Small n"],[111,"Small o"],[112,"Small p"],[113,"Small q"],[114,"Small r"],[115,"Small s"],[116,"Small t"],[117,"Small u"],[118,"Small v"],[119,"Small w"],[120,"Small x"],[121,"Small y"],[122,"Small z"],[123,"Left curly bracket"],[124,"Vertical line"],[125,"Right curly bracket"],[126,"Tilde"],[161,"Inverted exclamation mark"],[162,"Cent sign"],[163,"Pound sign"],[164,"Currency sign"],[165,"Yen sign"],[166,"Broken bar"],[167,"Section sign"],[168,"Diaeresis"],[169,"Copyright sign"],[170,"Feminine ordinal indicator"],[171,"Left-pointing double angle quotation mark"],[172,"Not sign"],[174,"Registered sign"],[175,"Macron"],[176,"Degree sign"],[177,"Plus-minus sign"],[178,"Superscript two"],[179,"Superscript three"],[180,"Acute accent"],[181,"Micro sign"],[182,"Pilcrow sign"],[183,"Middle dot"],[184,"Cedilla"],[185,"Superscript one"],[186,"Masculine ordinal indicator"],[187,"Right-pointing double angle quotation mark"],[188,"Vulgar fraction one quarter"],[189,"Vulgar fraction one half"],[190,"Vulgar fraction three quarters"],[191,"Inverted question mark"],[192,"Capital A with grave"],[193,"Capital A with acute"],[194,"Capital A with circumflex"],[195,"Capital A with tilde"],[196,"Capital A with diaeresis"],[197,"Capital A with ring above"],[198,"Capital ae"],[199,"Capital C with cedilla"],[200,"Capital E with grave"],[201,"Capital E with acute"],[202,"Capital E with circumflex"],[203,"Capital E with diaeresis"],[204,"Capital I with grave"],[205,"Capital I with acute"],[206,"Capital I with circumflex"],[207,"Capital I with diaeresis"],[208,"Capital eth"],[209,"Capital N with tilde"],[210,"Capital O with grave"],[211,"Capital O with acute"],[212,"Capital O with circumflex"],[213,"Capital O with tilde"],[214,"Capital O with diaeresis"],[215,"Multiplication sign"],[216,"Capital O with stroke"],[217,"Capital U with grave"],[218,"Capital U with acute"],[219,"Capital U with circumflex"],[220,"Capital U with diaeresis"],[221,"Capital Y with acute"],[222,"Capital thorn"],[223,"Small sharp s"],[224,"Small a with grave"],[225,"Small a with acute"],[226,"Small a with circumflex"],[227,"Small a with tilde"],[228,"Small a with diaeresis"],[229,"Small a with ring above"],[230,"Small ae"],[231,"Small c with cedilla"],[232,"Small e with grave"],[233,"Small e with acute"],[234,"Small e with circumflex"],[235,"Small e with diaeresis"],[236,"Small i with grave"],[237,"Small i with acute"],[238,"Small i with circumflex"],[239,"Small i with diaeresis"],[240,"Small eth"],[241,"Small n with tilde"],[242,"Small o with grave"],[243,"Small o with acute"],[244,"Small o with circumflex"],[245,"Small o with tilde"],[246,"Small o with diaeresis"],[247,"Division sign"],[248,"Small o with stroke"],[249,"Small u with grave"],[250,"Small u with acute"],[251,"Small u with circumflex"],[252,"Small u with diaeresis"],[253,"Small y with acute"],[254,"Small thorn"],[255,"Small y with diaeresis"],[8211,"En dash"],[8212,"Em dash"],[8216,"Left single quotation mark"],[8217,"Right single quotation mark"],[8220,"Left double quotation mark"],[8221,"Right double quotation mark"],[8230,"Horizontal ellipsis"],[8226,"Bullet"],[8364,"Euro sign"]];

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Holding an optical size ----------
     font-optical-sizing: none plus font-variation-settings: "opsz" N.
     Safari needs both: while optical sizing is auto it follows the
     font size and ignores the "opsz" setting. */
  function pin(el, opsz, size) {
    el.style.fontSize = size ? size + 'px' : '';
    el.style.fontOpticalSizing = 'none';
    el.style.fontVariationSettings = '"opsz" ' + opsz;
  }

  var cuts = Array.prototype.map.call(document.querySelectorAll('.sp-cut'), function (fig) {
    return { o: parseFloat(getComputedStyle(fig).getPropertyValue('--o')) || 10,
             els: fig.querySelectorAll('.sp-cut__big, .sp-cut__body') };
  });
  function pinCuts() {
    cuts.forEach(function (c) {
      Array.prototype.forEach.call(c.els, function (el) { pin(el, c.o); });
    });
  }

  /* ---------- The name, as wide as the page ----------
     Set at a known size, measured, scaled to the page's width; then
     once more, because the optical size (and with it the fit) follows
     the size. */
  var name = document.querySelector('.sp-hero__name');
  var fitEl = name && name.querySelector('.sp-fit');
  function fit() {
    if (!fitEl) return;
    var avail = name.parentNode.clientWidth;
    if (!avail) return;
    var size = 100;
    for (var i = 0; i < 3; i++) {
      name.style.fontSize = size + 'px';
      var w = fitEl.getBoundingClientRect().width;
      if (!w) return;
      size = size * avail / w;
    }
    name.style.fontSize = (Math.floor(size * 10) / 10) + 'px';
  }

  /* ---------- Try it ---------- */
  var sample = $('t-sample');
  var size = $('t-size'), wght = $('t-wght'), opsz = $('t-opsz'), auto = $('t-auto');
  var state = { size: 132, wght: 400, opsz: 72, auto: true, style: 'normal', align: 'left' };

  // a phone starts smaller, so the sample isn't a tower of single words
  state.size = Math.round(clamp(window.innerWidth * 0.12, 44, 132));
  size.value = state.size;

  function paint() {
    var s = sample.style;
    s.fontWeight = state.wght;
    s.fontStyle = state.style;
    s.textAlign = state.align;
    var eff = state.auto ? clamp(Math.round(state.size), 10, 72) : state.opsz;
    if (state.auto) {
      s.fontSize = state.size + 'px';
      s.fontOpticalSizing = 'auto';
      s.fontVariationSettings = 'normal';
    } else {
      pin(sample, state.opsz, state.size);
    }
    opsz.value = eff;
    opsz.classList.toggle('is-auto', state.auto);
    auto.setAttribute('aria-pressed', String(state.auto));
    $('t-size-v').textContent = state.size;
    $('t-wght-v').textContent = state.wght;
    $('t-opsz-v').textContent = eff;
  }

  size.addEventListener('input', function () { state.size = +size.value; paint(); });
  wght.addEventListener('input', function () { state.wght = +wght.value; paint(); });
  opsz.addEventListener('input', function () { state.auto = false; state.opsz = +opsz.value; paint(); });
  auto.addEventListener('click', function () {
    state.auto = !state.auto;
    if (!state.auto) state.opsz = clamp(Math.round(state.size), 10, 72);
    paint();
  });

  function group(attr, key) {
    var buttons = document.querySelectorAll('.sp-tester [' + attr + ']');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        state[key] = b.getAttribute(attr);
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        paint();
      });
    });
  }
  group('data-style', 'style');
  group('data-align', 'align');

  // type "stanford" and the sample takes on the wordmark's cardinal
  function cardinal() { sample.classList.toggle('is-cardinal', /stanford/i.test(sample.textContent)); }
  sample.addEventListener('input', cardinal);

  // paste as plain text, so the sample keeps the face it's set in
  sample.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (text == null) return;
    e.preventDefault();
    document.execCommand('insertText', false, text);
  });

  /* ---------- Between Text and Display ---------- */
  var morph = $('m-opsz'), morphWord = $('m-word');
  function paintMorph() {
    pin(morphWord, +morph.value);
    $('m-opsz-v').textContent = morph.value;
  }
  morph.addEventListener('input', paintMorph);

  /* ---------- OpenType features ---------- */
  document.querySelectorAll('.sp-feat').forEach(function (row) {
    var tag = row.getAttribute('data-feat');
    var offTag = row.getAttribute('data-off-feat');
    var btn = row.querySelector('.sp-feat__t');
    var s = row.querySelector('.sp-feat__s');
    var labels = (btn.getAttribute('data-labels') || 'On|Off').split('|');
    function set(on) {
      row.setAttribute('data-on', String(on));
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? labels[0] : labels[1];
      var ff;
      if (offTag) ff = on ? '"' + tag + '" 1' : '"' + offTag + '" 1';
      else ff = '"' + tag + '" ' + (on ? 1 : 0);
      s.style.setProperty('--ff', ff);
      // standard ligatures are on by default: switching them off needs both
      if (tag === 'liga') s.style.setProperty('--fl', on ? 'normal' : 'no-common-ligatures');
    }
    set(row.getAttribute('data-on') === 'true');
    btn.addEventListener('click', function () { set(row.getAttribute('data-on') !== 'true'); });
  });

  /* ---------- Characters ---------- */
  var grid = $('g-grid'), big = $('g-char'), gname = $('g-name'), gcode = $('g-code');
  var stage = $('g-stage'), mark = $('g-base'), sec = document.querySelector('.sp-glyphs');
  var current = null;

  function hex(c) { var h = c.toString(16).toUpperCase(); while (h.length < 4) h = '0' + h; return 'U+' + h; }

  function show(cell) {
    if (current) current.removeAttribute('aria-current');
    current = cell;
    cell.setAttribute('aria-current', 'true');
    var cp = +cell.getAttribute('data-cp');
    big.textContent = String.fromCodePoint(cp);
    gname.textContent = cell.getAttribute('aria-label');
    gcode.textContent = hex(cp);
  }

  var frag = document.createDocumentFragment();
  GLYPHS.forEach(function (g) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sp-cell';
    b.setAttribute('role', 'listitem');
    b.setAttribute('data-cp', g[0]);
    b.setAttribute('aria-label', g[1]);
    b.textContent = String.fromCodePoint(g[0]);
    frag.appendChild(b);
  });
  grid.appendChild(frag);

  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');
  grid.addEventListener('mouseover', function (e) {
    var c = e.target.closest('.sp-cell');
    if (c && hoverable.matches) show(c);
  });
  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.sp-cell');
    if (c) show(c);
  });
  grid.addEventListener('focusin', function (e) {
    var c = e.target.closest('.sp-cell');
    if (c) show(c);
  });
  show(grid.querySelector('[data-cp="97"]') || grid.firstChild);

  document.querySelectorAll('[data-gstyle]').forEach(function (b, _, all) {
    b.addEventListener('click', function () {
      sec.classList.toggle('is-italic', b.getAttribute('data-gstyle') === 'italic');
      all.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    });
  });

  // the guides: measured from where the baseline actually falls
  function guides() {
    var fs = parseFloat(getComputedStyle(big).fontSize);
    if (!fs || !stage.clientHeight) return;
    var sr = stage.getBoundingClientRect(), mr = mark.getBoundingClientRect();
    var base = mr.bottom - sr.top;
    stage.querySelectorAll('[data-g]').forEach(function (g) {
      var k = g.getAttribute('data-g');
      var at = k === 'base' ? 0 : ZONES[k];
      g.style.top = (base - at * fs) + 'px';
    });
  }

  /* ---------- Measure now, when the fonts land, and on resize ---------- */
  function measure() { fit(); guides(); pinCuts(); paintMorph(); paint(); }
  paint();
  measure();
  function settle() { measure(); }
  if (document.fonts) {
    document.fonts.load('100px "Lagunita"').then(settle, settle);
    document.fonts.ready.then(measure);
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', measure);
  }
  window.addEventListener('load', measure);
  if ('ResizeObserver' in window) {
    // only a change of width re-fits (the fit itself changes the height)
    var lastW = 0;
    var ro = new ResizeObserver(function () {
      var w = root.clientWidth;
      if (w !== lastW) { lastW = w; measure(); } else { guides(); }
    });
    ro.observe(root);
    ro.observe(stage);
  } else {
    window.addEventListener('resize', measure);
  }
})();
