'use strict';

// =========================================================
// PORTFOLIO INTERACTIONS
// =========================================================

// ---------------------------------------------------------
// 1. Theme System
// ---------------------------------------------------------

const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;
const mql = window.matchMedia('(prefers-color-scheme: dark)');

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  const effective = theme === 'auto' ? (mql.matches ? 'dark' : 'light') : theme;
  root.style.colorScheme = effective;
  localStorage.setItem('theme', theme);
}

function getTheme() {
  return localStorage.getItem('theme') || 'auto';
}

function effectiveTheme(theme) {
  return theme === 'auto' ? (mql.matches ? 'dark' : 'light') : theme;
}

if (themeToggle) {
  if (themeToggle.tagName === 'SELECT') {
    themeToggle.addEventListener('change', (e) => {
      setTheme(e.target.value);
    });
  } else {
    // Icon button: cycle light → dark → auto (system)
    themeToggle.addEventListener('click', () => {
      const current = getTheme();
      const next = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light';
      setTheme(next);
    });
  }
}

if (mql.addEventListener) {
  mql.addEventListener('change', () => {
    if (getTheme() === 'auto') setTheme('auto');
  });
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
  const initial = getTheme();
  setTheme(initial);
  if (themeToggle && themeToggle.tagName === 'SELECT') themeToggle.value = initial;
});


// ---------------------------------------------------------
// 2. Year in Footer
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});


// ---------------------------------------------------------
// 5. Elastic Name Effect (Reactive to mouse anywhere)
// ---------------------------------------------------------
// DISABLED: the name now stays still. Hover effect is a CRT flicker
// handled in CSS (.hero__title:hover .hero__name-*).
/*
document.addEventListener('DOMContentLoaded', () => {
  const nameFirst = document.querySelector('.hero__name-first');
  const nameLast = document.querySelector('.hero__name-last');
  if (!nameFirst || !nameLast) return;

  const allLetters = [];

  [nameFirst, nameLast].forEach(nameEl => {
    const text = nameEl.textContent;
    nameEl.textContent = '';
    nameEl.style.display = 'inline-flex';

    text.split('').forEach(char => {
      const span = document.createElement('span');
      span.textContent = char;
      span.style.display = 'inline-block';
      span.style.transition = 'transform 0.15s ease-out';
      span.style.transformOrigin = 'center';
      span.style.willChange = 'transform';
      nameEl.appendChild(span);
      allLetters.push(span);
    });
  });

  // Cache rects so getBoundingClientRect isn't called on every mousemove
  let letterRects = [];

  function cacheRects() {
    letterRects = allLetters.map(l => {
      const r = l.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
  }

  cacheRects();
  window.addEventListener('resize', cacheRects);
  window.addEventListener('scroll', cacheRects, { passive: true });

  let mouseX = 0, mouseY = 0, rafId = null;

  function updateLetters() {
    rafId = null;
    for (let i = 0; i < allLetters.length; i++) {
      const { cx, cy } = letterRects[i];
      const distanceX = mouseX - cx;
      const distanceY = mouseY - cy;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      const maxDistance = 500;
      const proximity = Math.max(0, 1 - Math.min(distance / maxDistance, 1));
      const proximityCurve = proximity * proximity;

      const angle = Math.atan2(distanceY, distanceX);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const pushX = -cosA * proximityCurve * 25;
      const pushY = -sinA * proximityCurve * 15;
      const scaleX = 1 - proximityCurve * 0.5 * Math.abs(cosA);
      const scaleY = 1 + proximityCurve * 0.35 * Math.abs(sinA);

      allLetters[i].style.transform = `translate(${pushX}px, ${pushY}px) scale(${scaleX}, ${scaleY})`;
    }
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!rafId) rafId = requestAnimationFrame(updateLetters);
  });

  document.addEventListener('mouseleave', () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    allLetters.forEach(letter => {
      letter.style.transform = 'translate(0, 0) scale(1)';
    });
  });
});
*/


// ---------------------------------------------------------
// 6. Photo Grid Distance Effect
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.photos__grid');
  if (!grid) return;

  const photos = Array.from(grid.querySelectorAll('.photo-item'));
  if (!photos.length) return;

  // Respect reduced-motion: leave the grid completely static.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Tunables
  const RADIUS = 320;    // influence distance in px
  const NEAR = 1;        // scale of the photo nearest the cursor
  const FAR = 0.82;      // scale of photos beyond the radius
  const HOVER = 1.5;     // scale of the photo directly under the cursor
  const EASE = 0.2;      // 0..1 easing toward the target each frame

  // Cache geometry so the per-frame work never touches layout.
  let centers = [];
  function cacheCenters() {
    centers = photos.map(p => {
      const r = p.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
  }
  cacheCenters();
  window.addEventListener('resize', cacheCenters);
  window.addEventListener('scroll', cacheCenters, { passive: true });

  const scales = photos.map(() => 1);
  let mouseX = 0, mouseY = 0, inside = false, hovered = -1, rafId = null;

  function start() { if (!rafId) rafId = requestAnimationFrame(tick); }

  photos.forEach((photo, i) => {
    photo.addEventListener('mouseenter', () => { hovered = i; start(); });
    photo.addEventListener('mouseleave', () => { if (hovered === i) hovered = -1; });
  });

  grid.addEventListener('mouseenter', () => { inside = true; cacheCenters(); start(); });
  grid.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    inside = true;
    start();
  });
  grid.addEventListener('mouseleave', () => { inside = false; hovered = -1; start(); });

  function tick() {
    rafId = null;
    let moving = false;

    for (let i = 0; i < photos.length; i++) {
      let target;
      if (!inside) {
        target = 1;
      } else if (i === hovered) {
        target = HOVER;
      } else {
        const { cx, cy } = centers[i];
        const dx = mouseX - cx, dy = mouseY - cy;
        const t = Math.min(Math.sqrt(dx * dx + dy * dy) / RADIUS, 1);
        target = NEAR + (FAR - NEAR) * t;
      }

      const next = scales[i] + (target - scales[i]) * EASE;
      if (Math.abs(target - next) > 0.001) {
        scales[i] = next;
        moving = true;
      } else {
        scales[i] = target;
      }

      photos[i].style.transform = `scale(${scales[i].toFixed(4)})`;
      photos[i].style.zIndex = i === hovered ? '20' : '1';
    }

    if (moving) rafId = requestAnimationFrame(tick);
  }
});


// ---------------------------------------------------------
// 7. Logo Marquee
// ---------------------------------------------------------

window.addEventListener('load', () => {
  const logoTrack = document.getElementById('logo-track');
  if (!logoTrack) return;

  const originalWidth = Math.round(logoTrack.scrollWidth);

  // Clone items for seamless loop
  Array.from(logoTrack.children).forEach(n => {
    logoTrack.appendChild(n.cloneNode(true));
  });

  // Set CSS variables for animation
  logoTrack.style.setProperty('--logo-distance', `${originalWidth}px`);
  const duration = originalWidth / 90; // pixels per second
  logoTrack.style.setProperty('--logo-duration', `${duration}s`);
});


// ---------------------------------------------------------
// 8. Smooth Scroll for Nav Links
// ---------------------------------------------------------

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    e.preventDefault();
    const target = document.querySelector(href);

    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});


// ---------------------------------------------------------
// 9. Hamburger Menu (sub-pages)
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.page-header__hamburger');
  const nav = document.querySelector('.page-header__nav');
  if (!hamburger || !nav) return;

  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close when a link is tapped
  nav.querySelectorAll('.page-header__nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
});




