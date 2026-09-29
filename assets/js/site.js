/* Every page: the clock in the bar, things rising into view, the
   address in the footer set to the width of the page, and the way
   back to the top. */

'use strict';

(function () {
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Local time where I am. */
  var clock = document.querySelector('[data-clock]');
  if (clock) {
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZoneName: 'short'
    });
    var tick = function () { clock.textContent = ' ' + fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  }

  /* "At a glance": the switch in the bar turns the home page into a
     one-page brief. The choice is remembered; the inline script in the
     head applies it before paint, and ?brief in the address turns it on
     for anyone the link is sent to. From any other page, turning it on
     goes to the brief. */
  var root = document.documentElement;
  var modeToggle = document.querySelector('[data-mode-toggle]');
  var home = location.pathname === '/' || location.pathname === '/index.html';
  var brief = function () { return root.getAttribute('data-mode') === 'brief'; };
  if (modeToggle) {
    modeToggle.setAttribute('aria-checked', brief() ? 'true' : 'false');
    modeToggle.addEventListener('click', function () {
      var on = !brief();
      try {
        if (on) localStorage.setItem('mode', 'brief');
        else localStorage.removeItem('mode');
      } catch (e) {}
      /* A ?brief left in the address would turn it back on at the next
         load, so it goes once the switch has been used. */
      if (/[?&]brief/.test(location.search)) {
        history.replaceState(null, '', location.pathname + location.hash);
      }
      if (on && !home) { location.href = '/'; return; }
      if (on) root.setAttribute('data-mode', 'brief');
      else root.removeAttribute('data-mode');
      modeToggle.setAttribute('aria-checked', on ? 'true' : 'false');
      scrollTo(0, 0);
      /* The pinned photographs measure themselves on resize. */
      dispatchEvent(new Event('resize'));
    });
  }

  /* The menu on small screens. While it is open the page behind it is
     inert and doesn't scroll; Escape, the button or a link closes it. */
  var bar = document.querySelector('.bar');
  var menu = document.querySelector('[data-menu]');
  var toggle = document.querySelector('[data-menu-toggle]');
  var behind = document.querySelectorAll('main, footer');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? 'Close' : 'Menu';
    behind.forEach(function (el) { el.inert = open; });
    if (open) {
      bar.classList.remove('away');
      menu.querySelector('a').focus({ preventScroll: true });
    }
  }
  if (menu && toggle) {
    toggle.addEventListener('click', function () {
      setMenu(!menu.classList.contains('open'));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); }
    });
    /* Widening the window past the menu's breakpoint closes it. */
    matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* The bar steps aside while scrolling down and returns on the way
     up. */
  if (bar) {
    var last = scrollY;
    addEventListener('scroll', function () {
      var y = scrollY;
      if (Math.abs(y - last) < 6 || document.body.classList.contains('menu-open')) return;
      bar.classList.toggle('away', y > last && y > 120);
      last = y;
    }, { passive: true });
  }

  /* Things rise into view once. Entries on the inner pages are marked
     here rather than in the markup, so without scripting they are
     simply there. */
  document.querySelectorAll('.project-item').forEach(function (el) {
    el.classList.add('rise');
  });
  var risers = document.querySelectorAll('.rise');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    risers.forEach(function (el) {
      var list = el.parentElement;
      var i = Array.prototype.indexOf.call(list.children, el);
      if (list.matches('.index, .projects__list')) el.style.transitionDelay = (i % 6) * 0.05 + 's';
      io.observe(el);
    });
  } else {
    risers.forEach(function (el) { el.classList.add('in'); });
  }

  /* The address is set to exactly the width of the page. */
  var mail = document.querySelector('[data-fit]');
  if (mail) {
    var fit = function () {
      mail.style.fontSize = '100px';
      var gutter = parseFloat(getComputedStyle(mail).paddingLeft) * 2;
      var w = mail.firstElementChild.getBoundingClientRect().width;
      mail.style.fontSize = (100 * (document.documentElement.clientWidth - gutter) / w * 0.99) + 'px';
    };
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
    addEventListener('resize', fit);
  }

  /* The pointer, everywhere: a small marigold dot that trails the real
     position a little. Over a link it flows into that link's shape: a
     highlight fitted to the words, or, where a link carries a control
     of its own (the "At a glance" switch), the control itself. Over
     anything marked data-cursor (a project's picture) it becomes a disc
     that says what a click will do: "Visit" and an arrow out for another
     site, "Open" and an arrow on for a page here.

     Position, size and roundness all ease towards their goal together,
     at the same rate whatever the screen's refresh rate, so every
     change of shape is one movement. Only where there's a mouse. */
  (function () {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<span class="cursor__shape"></span>' +
      '<span class="cursor__tag"><span class="cursor__label"></span><span class="cursor__arr arr"></span></span>';
    document.body.appendChild(cur);
    root.classList.add('has-cursor');
    var shape = cur.querySelector('.cursor__shape');
    var label = cur.querySelector('.cursor__label');
    var arrow = cur.querySelector('.cursor__arr');

    var DOT = 10, DISC = 108;
    var px = -100, py = -100;
    /* What's drawn: centre, width, height, corner radius. */
    var d = { x: -100, y: -100, w: DOT, h: DOT, r: DOT / 2 };
    var mode = 'dot', snap = null, lean = 0, padX = 0, padY = 0, fit = 0;
    var running = false, seen = false, last = 0;

    var goal = function () {
      if (mode === 'link' && snap && snap.isConnected) {
        var b = snap.getBoundingClientRect();
        var mx = b.left + b.width / 2, my = b.top + b.height / 2;
        var w = b.width + padX * 2, h = b.height + padY * 2;
        return {
          x: mx + (px - mx) * lean,
          y: my + (py - my) * lean,
          w: w, h: h,
          r: fit ? Math.min(h / 2, fit + padY) : Math.min(h / 2, 8)
        };
      }
      var size = mode === 'card' ? DISC : mode === 'big' ? 16 : DOT;
      return { x: px, y: py, w: size, h: size, r: size / 2 };
    };
    var frame = function (t) {
      var dt = last ? Math.min(64, Math.max(0, t - last)) : 16;
      last = t;
      var g = goal();
      /* Exponential easing by elapsed time: the same feel at 60 or 120
         frames a second. Where it goes and what shape it takes ease at
         one rate, so the dot visibly grows into the shape rather than
         arriving first and swelling after. */
      var kp = still ? 1 : 1 - Math.exp(-dt / 70);
      var ks = kp;
      d.x += (g.x - d.x) * kp;
      d.y += (g.y - d.y) * kp;
      d.w += (g.w - d.w) * ks;
      d.h += (g.h - d.h) * ks;
      d.r += (g.r - d.r) * ks;
      cur.style.transform = 'translate3d(' + d.x.toFixed(2) + 'px,' + d.y.toFixed(2) + 'px,0)';
      shape.style.width = d.w.toFixed(2) + 'px';
      shape.style.height = d.h.toFixed(2) + 'px';
      shape.style.borderRadius = d.r.toFixed(2) + 'px';
      var rest = Math.abs(g.x - d.x) + Math.abs(g.y - d.y) + Math.abs(g.w - d.w) + Math.abs(g.h - d.h);
      /* Wrapped round a link it keeps watching, so it stays on the link
         as the page scrolls beneath it. */
      if (rest > 0.1 || mode === 'link') requestAnimationFrame(frame);
      else { running = false; last = 0; }
    };
    var kick = function () { if (!running) { running = true; requestAnimationFrame(frame); } };

    var aim = function (target) {
      var el = target && target.closest ? target.closest('[data-cursor], a, button, [role="button"], label') : null;
      snap = null;
      if (el && el.hasAttribute('data-cursor')) {
        var href = el.getAttribute('href') || '';
        var out = el.target === '_blank' || (/^https?:/.test(href) && !/^https?:\/\/(www\.)?aniketh\.net/.test(href));
        label.textContent = el.getAttribute('data-cursor') || (out ? 'Visit' : 'Open');
        arrow.className = 'cursor__arr arr ' + (out ? 'arr--ne' : 'arr--r');
        mode = 'card';
      } else if (el) {
        /* A control inside the link is what it becomes; otherwise the
           link itself: a line of words, a button, a row in a list. Only
           something enormous (the address across the footer, the press
           marquee) keeps a dot. */
        var control = el.querySelector('.switch, [data-cursor-shape]');
        var b = (control || el).getBoundingClientRect();
        if (control) {
          mode = 'link'; snap = control; lean = 0; padX = padY = 3;
          fit = parseFloat(getComputedStyle(control).borderTopLeftRadius) || 0;
        } else if (b.height < 140 && b.width < innerWidth - 2) {
          /* Wide things lean less, or the shape would wander off them. */
          mode = 'link'; snap = el; lean = b.width > 320 ? 0.025 : 0.08;
          /* A link that already has a shape (a pill button) is what the
             cursor becomes, outline for outline; a line of words gets a
             little air around it. */
          fit = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
          if (fit) { padX = padY = 0; lean = 0.04; }
          else if (b.width > 320) { padX = 10; padY = 0; }
          else {
            padX = Math.max(8, Math.min(14, b.height * 0.5));
            padY = Math.max(3, Math.min(8, b.height * 0.2));
          }
        } else {
          mode = 'big';
        }
      } else {
        mode = 'dot';
      }
      cur.classList.toggle('is-card', mode === 'card');
      cur.classList.toggle('is-link', mode === 'link');
      cur.classList.toggle('is-control', !!(snap && (snap !== el || fit)));
      kick();
    };

    addEventListener('mousemove', function (e) {
      px = e.clientX; py = e.clientY;
      if (!seen) { seen = true; d.x = px; d.y = py; cur.classList.add('is-in'); }
      kick();
    }, { passive: true });
    document.addEventListener('mouseover', function (e) { aim(e.target); });
    /* Gone when the pointer leaves the window, back when it returns. */
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget) { seen = false; cur.classList.remove('is-in'); }
    });
    addEventListener('mousedown', function () { cur.classList.add('is-down'); });
    addEventListener('mouseup', function () { cur.classList.remove('is-down'); });
  })();

  var top = document.querySelector('[data-top]');
  if (top) {
    top.addEventListener('click', function (e) {
      e.preventDefault();
      scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    });
  }
})();
