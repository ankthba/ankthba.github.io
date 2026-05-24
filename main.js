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

if (themeToggle) {
  themeToggle.addEventListener('change', (e) => {
    setTheme(e.target.value);
  });
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
  if (themeToggle) themeToggle.value = initial;
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


// ---------------------------------------------------------
// 6. Photo Grid Distance Effect
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const photosGrid = document.querySelector('.photos__grid');
  if (!photosGrid) return;

  const photos = photosGrid.querySelectorAll('.photo-item');
  let hoveredPhoto = null;

  photos.forEach(photo => {
    photo.addEventListener('mouseenter', () => {
      hoveredPhoto = photo;
    });
    photo.addEventListener('mouseleave', () => {
      if (hoveredPhoto === photo) hoveredPhoto = null;
    });
  });

  photosGrid.addEventListener('mousemove', (e) => {
    photos.forEach(photo => {
      const rect = photo.getBoundingClientRect();
      const photoCenterX = rect.left + rect.width / 2;
      const photoCenterY = rect.top + rect.height / 2;

      const distanceX = e.clientX - photoCenterX;
      const distanceY = e.clientY - photoCenterY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      // Hovered photo gets extra big and on top
      if (photo === hoveredPhoto) {
        photo.style.transform = 'scale(1.8)';
        photo.style.zIndex = '20';
      } else {
        // Scale based on distance - closer = slightly bigger, farther = much smaller
        const maxDistance = 350;
        const minScale = 0.4;
        const maxScale = 0.85;

        const normalizedDist = Math.min(distance / maxDistance, 1);
        const scale = maxScale - (normalizedDist * (maxScale - minScale));

        photo.style.transform = `scale(${scale})`;
        photo.style.zIndex = '1';
      }
    });
  });

  photosGrid.addEventListener('mouseleave', () => {
    photos.forEach(photo => {
      photo.style.transform = 'scale(1)';
      photo.style.zIndex = '1';
    });
  });
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


// ---------------------------------------------------------
// 10. Animated Grain / Static Effect
// ---------------------------------------------------------

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9997;opacity:0.055;image-rendering:pixelated;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;

  function resize() {
    // Half resolution — CSS scaling gives a subtle pixel grain
    w = canvas.width = Math.ceil(window.innerWidth / 2);
    h = canvas.height = Math.ceil(window.innerHeight / 2);
  }

  let last = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    if (reduced) return;
    if (now - last < 60) return; // ~16 fps
    last = now;

    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);
})();


