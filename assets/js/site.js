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

  var top = document.querySelector('[data-top]');
  if (top) {
    top.addEventListener('click', function (e) {
      e.preventDefault();
      scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    });
  }
})();
