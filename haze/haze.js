// The page's sky. Each section names the hour it belongs to (data-sky);
// as you scroll, the fixed sky layer moves between their colours, so the
// page goes from night, through dawn, noon and dusk, and back to night,
// the way the app's sky follows the clock. With Reduce Motion it doesn't
// glide: each section simply takes its own sky.

(function () {
  // Top, middle and bottom of each sky, from the app's palettes.
  var SKIES = {
    night: ['#2c3452', '#1f2740', '#131a2e'],
    dawn:  ['#c99f88', '#b0909f', '#7d89a0'],
    day:   ['#8a9ab0', '#6e8199', '#56677f'],
    dusk:  ['#6a5b8a', '#9c7081', '#c08856']
  };

  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  var sections = [];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ticking = false;

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }

  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return 'rgb(' + [0, 1, 2].map(function (i) {
      return Math.round(x[i] + (y[i] - x[i]) * t);
    }).join(',') + ')';
  }

  function paint(from, to, t) {
    var a = SKIES[from], b = SKIES[to];
    root.style.setProperty('--sky-top', mix(a[0], b[0], t));
    root.style.setProperty('--sky-mid', mix(a[1], b[1], t));
    root.style.setProperty('--sky-bottom', mix(a[2], b[2], t));
    if (meta) meta.setAttribute('content', mix(a[0], b[0], t));
  }

  // The section whose top has passed the middle of the screen owns the
  // sky; the next one takes over across the last stretch before it.
  function update() {
    ticking = false;
    var mid = window.innerHeight * 0.55;
    var current = 0;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= mid) current = i;
    }
    var here = sections[current];
    var next = sections[current + 1];
    if (!next || reduce.matches) {
      paint(here.dataset.sky, here.dataset.sky, 0);
      return;
    }
    var nextTop = next.getBoundingClientRect().top;
    var blend = window.innerHeight * 0.6;
    var t = Math.min(1, Math.max(0, (mid + blend - nextTop) / blend));
    // Eased, so the change gathers rather than starting on a line.
    t = t * t * (3 - 2 * t);
    paint(here.dataset.sky, next.dataset.sky, t);
  }

  function request() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  function start() {
    sections = Array.prototype.slice.call(document.querySelectorAll('[data-sky]'));
    if (!sections.length) return;
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    if (reduce.addEventListener) reduce.addEventListener('change', request);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
