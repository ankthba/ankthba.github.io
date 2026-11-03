/* A picture beside whatever row of a list you point at: on the home
   page, the best picture from each page (and for Music, whatever is
   playing); on the others, each entry's own. A row with no picture
   just takes the wash.

   Each picture keeps its own shape, wide, tall or square, at about the
   same size whatever the shape. It trails the cursor a little, and
   three small things give it weight: it sits a touch larger than its frame and drifts against
   the frame's movement, so there is depth in it; the frame grows in
   when it appears with the picture held at its own size, so it opens
   like a window rather than swelling; and it tips back and forth with
   how fast it is moving up or down.

   A touch screen has no hover, and a tint left on whatever was last
   tapped is worse than none. There the picture keeps instead to the
   row crossing the reading line as the list scrolls past, in the room
   the row keeps for it. */

'use strict';

(function () {
  var ITEMS = '.project-item, .index__row';
  var LISTS = '.projects__list, .index';

  var root = document.documentElement;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  var items = Array.prototype.slice.call(document.querySelectorAll(ITEMS))
    .filter(function (el) { return el.parentNode.closest(LISTS); });
  if (!items.length) return;

  var ZOOM = 1.08;      // how much larger than its frame the picture is
  var FOLLOW = 0.17;    // how much of the way to its mark it goes each frame
  var GAP = 22;         // between the cursor and the picture
  var LINE = 0.58;      // the reading line on touch, down the screen
  var TIP = 0.5;        // degrees of tilt per pixel a frame of speed
  var TIP_MAX = 9;
  // a row with no picture says so, and on touch keeps no room for one
  items.forEach(function (el) {
    if (!el.hasAttribute('data-img') && !el.hasAttribute('data-img-from')) el.setAttribute('data-img', 'none');
  });

  // data-img-from names another picture on the page, its own or not
  function picture(el) {
    var from = el.getAttribute('data-img-from');
    if (from) {
      var img = el.querySelector(from) || document.querySelector(from);
      return img && img.getAttribute('src');
    }
    var src = el.getAttribute('data-img');
    return src && src !== 'none' ? src : null;
  }

  var peek = document.createElement('div');
  peek.className = 'peek';
  peek.setAttribute('aria-hidden', 'true');
  var img = document.createElement('img');
  img.className = 'peek__img';
  img.alt = '';
  img.draggable = false;
  peek.appendChild(img);
  document.body.appendChild(peek);

  var ratios = {};  // each picture's width over its height, once known

  // the pictures are small; have them in hand before they are wanted
  function learn(src, then) {
    var probe = new Image();
    probe.onload = function () {
      if (probe.naturalWidth) ratios[src] = probe.naturalWidth / probe.naturalHeight;
      if (then) then();
    };
    probe.src = src;
  }
  (window.requestIdleCallback || setTimeout)(function () {
    items.forEach(function (el) {
      var src = el.getAttribute('data-img');
      if (src && src !== 'none' && !(src in ratios)) { ratios[src] = 0; learn(src); }
    });
  });

  var cur = null, on = false, zoom = ZOOM, snap = false;
  var tx = 0, ty = 0, x = 0, y = 0, vy = 0, s = 0.86, tilt = 0;
  var unit = 0;                    // --peek-w, in pixels
  var ww = 0, wh = 0, cw = 0, ch = 0;  // the size it wants, and has
  var px = -1, py = -1;  // where the cursor was last
  var raf = 0, last = 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function measure() {
    peek.style.width = '';
    peek.style.height = '';
    unit = peek.offsetWidth;
  }
  measure();

  /* Its size for a picture this shape. Beside the cursor, about the
     same area whatever the shape, so a tall one is no bigger than a
     wide one; on touch, as large as fits the place the row keeps,
     which is as wide as --peek-w and three quarters as tall. */
  function fit(r) {
    if (!r) r = 4 / 3;
    var w, h;
    if (fine.matches) {
      w = Math.sqrt(unit * unit * 0.72 * r);
      h = w / r;
      if (h > unit * 1.05) { h = unit * 1.05; w = h * r; }
      if (w > unit * 1.3) { w = unit * 1.3; h = w / r; }
    } else {
      w = Math.min(unit, unit * 0.75 * r);
      h = w / r;
    }
    ww = w;
    wh = h;
  }

  function sizeFor(src) {
    fit(ratios[src]);
    if (ratios[src]) return;
    learn(src, function () {
      if (cur && picture(cur) === src) { fit(ratios[src]); kick(); }
    });
  }

  function show(el) {
    var src = el && picture(el);
    if (el && !src) el = null;
    if (el === cur) return;
    if (cur) cur.classList.remove('is-on');
    cur = el;
    var was = on;
    on = !!el;
    if (el) {
      el.classList.add('is-on');
      img.src = src;
      sizeFor(src);
      img.style.objectPosition = el.getAttribute('data-focus') || '';
      img.style.transformOrigin = el.getAttribute('data-focus') || '';
      zoom = parseFloat(el.getAttribute('data-zoom')) || ZOOM;
    }
    peek.classList.toggle('is-on', on);
    // appearing, it starts where it belongs, at its own size, rather
    // than flying in (once its mark is set, in the next frame)
    if (on && !was) snap = true;
    kick();
  }

  // beside the cursor, a little below it, on whichever side has room
  function nearCursor(cx, cy) {
    var w = ww, h = wh;
    tx = cx + GAP;
    if (tx + w > window.innerWidth - 12) tx = cx - GAP - w;
    ty = clamp(cy - h * 0.3, 12, window.innerHeight - h - 12);
  }

  // in the place the row keeps for it, at its top right
  function inRow(el) {
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var rem = parseFloat(getComputedStyle(root).fontSize) || 16;
    tx = r.right - parseFloat(cs.paddingRight) - ww;
    ty = r.top + parseFloat(cs.paddingTop) + 0.2 * rem;
  }

  function frame(now) {
    raf = 0;
    var f = last ? Math.min(4, (now - last) / 16.667) : 1;
    last = now;
    var calm = still.matches;
    if (snap) { snap = false; x = tx; y = ty; cw = ww; ch = wh; vy = 0; s = 0.86; }
    var k = calm ? 1 : 1 - Math.pow(1 - FOLLOW, f);
    // from one shape to the next a little quicker than it moves
    var kz = calm ? 1 : 1 - Math.pow(1 - 0.24, f);
    cw += (ww - cw) * kz;
    ch += (wh - ch) * kz;
    var oy = y;
    x += (tx - x) * k;
    y += (ty - y) * k;
    vy += ((y - oy) / f - vy) * (1 - Math.pow(0.7, f));
    var target = on ? 1 : 0.86;
    s += (target - s) * (calm ? 1 : 1 - Math.pow(1 - 0.2, f));
    tilt = calm ? 0 : clamp(-vy * TIP, -TIP_MAX, TIP_MAX);

    var w = cw, h = ch;
    peek.style.width = w.toFixed(2) + 'px';
    peek.style.height = h.toFixed(2) + 'px';
    var room = (ZOOM - 1) / 2 * 0.85;
    var dx = calm ? 0 : clamp((x - tx) * 0.12, -w * room, w * room);
    var dy = calm ? 0 : clamp((y - ty) * 0.12, -h * room, h * room);

    peek.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) perspective(700px) rotateX(' + tilt.toFixed(3) + 'deg) scale(' + s.toFixed(4) + ')';
    img.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) scale(' + (zoom / s).toFixed(4) + ')';

    var moving = Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05 || Math.abs(vy) > 0.01 || Math.abs(target - s) > 0.0005 ||
      Math.abs(ww - cw) > 0.05 || Math.abs(wh - ch) > 0.05;
    if (moving) kick();
    else last = 0;
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function under(cx, cy) {
    var el = document.elementFromPoint(cx, cy);
    el = el && el.closest(ITEMS);
    return el && items.indexOf(el) > -1 ? el : null;
  }

  // pointing
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    px = e.clientX;
    py = e.clientY;
    var el = e.target.closest && e.target.closest(ITEMS);
    show(el && items.indexOf(el) > -1 ? el : null);
    nearCursor(px, py);
    kick();
  }, { passive: true });
  root.addEventListener('pointerleave', function () {
    px = py = -1;
    show(null);
  });

  // the list scrolling under a cursor held still, or past the reading line
  function onScroll() {
    if (fine.matches) {
      if (px >= 0) show(under(px, py));
      return;
    }
    var line = window.innerHeight * LINE;
    var hit = null;
    items.forEach(function (el) {
      var b = el.getBoundingClientRect();
      if (b.top <= line && b.bottom > line) hit = el;
    });
    show(hit);
    if (hit) inRow(hit);
    kick();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    measure();
    if (cur) fit(ratios[picture(cur)]);
    onScroll();
  });
  if (!fine.matches) onScroll();

  // and from the keyboard, the row in focus
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest(ITEMS);
    if (!el || items.indexOf(el) < 0 || !e.target.matches(':focus-visible')) return;
    show(el);
    inRow(el);
  });
  document.addEventListener('focusout', function () {
    if (fine.matches && px < 0) show(null);
  });
})();
