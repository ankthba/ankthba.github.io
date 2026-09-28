/* The home page: the headline, the index of work, the photographs. */

'use strict';

(function () {
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Headline: wrap each word so it can rise out of its own line. */
  var title = document.querySelector('.hero__title');
  var n = 0;
  (function split(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          var inner = document.createElement('span');
          w.className = 'w';
          inner.textContent = p;
          inner.style.setProperty('--d', (0.15 + n++ * 0.028).toFixed(3) + 's');
          w.appendChild(inner);
          frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      } else if (child.classList && child.classList.contains('inl')) {
        child.style.setProperty('--d', (0.35 + n++ * 0.028).toFixed(3) + 's');
      } else if (child.nodeType === 1) {
        split(child);
      }
    });
  })(title);

  var started = false;
  function go() {
    if (started) return;
    started = true;
    /* Read layout first so the hidden starting state is committed and
       the change below transitions, rather than waiting on a frame a
       background tab may never draw. */
    void title.offsetWidth;
    root.classList.add('ready');
    setTimeout(function () { root.classList.add('settled'); }, 2600);
  }
  if (document.fonts) document.fonts.ready.then(go);
  setTimeout(go, 900);

  /* The photographs in the headline turn over, one at a time. */
  if (!still) {
    var cycles = document.querySelectorAll('[data-cycle]');
    var turn = 0;
    setInterval(function () {
      var imgs = cycles[turn++ % cycles.length].querySelectorAll('img');
      var i = Array.prototype.findIndex.call(imgs, function (im) { return im.classList.contains('on'); });
      imgs[i].classList.remove('on');
      imgs[(i + 1) % imgs.length].classList.add('on');
    }, 1400);
  }

  /* A picture trails the cursor through the index, lagging a little
     and leaning into the direction it is being pulled. */
  var box = document.querySelector('[data-peek-box]');
  var index = document.querySelector('[data-index]');
  if (hover && box && index) {
    var pic = box.querySelector('img');
    var mx = 0, my = 0, x = 0, y = 0, running = false;
    var frame = function () {
      var dx = mx - x;
      x += dx * 0.14;
      y += (my - y) * 0.14;
      var tilt = Math.max(-9, Math.min(9, dx * 0.06));
      /* Right of the cursor, so it never covers the name being read,
         unless that would push it off the page. */
      var left = x + 40 + box.offsetWidth > innerWidth ? x - 40 - box.offsetWidth : x + 40;
      box.style.transform = 'translate3d(' + left + 'px,' + (y - box.offsetHeight / 2) + 'px,0) rotate(' + tilt + 'deg)';
      if (running) requestAnimationFrame(frame);
    };
    addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
    index.querySelectorAll('.row').forEach(function (row) {
      row.addEventListener('mouseenter', function (e) {
        var src = row.getAttribute('data-peek');
        if (!src) { box.classList.remove('on'); return; }
        pic.src = src;
        pic.classList.toggle('contain', row.hasAttribute('data-contain'));
        if (!box.classList.contains('on')) { x = mx = e.clientX; y = my = e.clientY; }
        box.classList.add('on');
        if (!running) { running = true; frame(); }
      });
      row.addEventListener('mouseleave', function () { box.classList.remove('on'); });
    });
    index.addEventListener('mouseleave', function () {
      setTimeout(function () { if (!box.classList.contains('on')) running = false; }, 600);
    });
  }

  /* Photographs: pin the strip and turn vertical scroll into sideways
     travel. Below 900px, or with reduced motion, it is a swipe strip. */
  var gallery = document.querySelector('[data-gallery]');
  if (!gallery) return;
  var track = gallery.querySelector('[data-track]');
  var bar = gallery.querySelector('[data-bar]');
  var count = gallery.querySelector('[data-count]');
  var shots = track.querySelectorAll('figure.shot');
  var travel = 0;
  function pinned() { return !still && innerWidth > 900 && innerHeight > 520; }
  function scroll() {
    if (!pinned()) return;
    var p = Math.min(1, Math.max(0, -gallery.getBoundingClientRect().top / (travel || 1)));
    track.style.transform = 'translate3d(' + (-p * travel) + 'px,0,0)';
    bar.style.transform = 'scaleX(' + p + ')';
    var k = Math.min(shots.length, Math.floor(p * shots.length) + 1);
    count.textContent = (k < 10 ? '0' : '') + k + ' / ' + shots.length;
  }
  function measure() {
    if (!pinned()) {
      gallery.classList.add('static');
      gallery.style.height = '';
      track.style.transform = '';
      return;
    }
    gallery.classList.remove('static');
    travel = Math.max(0, track.scrollWidth - innerWidth);
    gallery.style.height = (innerHeight + travel) + 'px';
    scroll();
  }
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', measure);
  track.querySelectorAll('img').forEach(function (img) { img.addEventListener('load', measure); });
  measure();
})();
