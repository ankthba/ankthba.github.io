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
// 3. Navigation Scroll Effect
// ---------------------------------------------------------

const nav = document.getElementById('nav');

function updateNav() {
  if (!nav) return;
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateNav, { passive: true });
updateNav();


// ---------------------------------------------------------
// 4. Active Navigation Links
// ---------------------------------------------------------

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav__link');

function updateActiveLink() {
  let current = '';

  sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    const sectionHeight = section.clientHeight;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
}

window.addEventListener('scroll', updateActiveLink, { passive: true });
updateActiveLink();


// ---------------------------------------------------------
// 5. Elastic Name Effect (Reactive to mouse anywhere)
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const heroTitle = document.getElementById('hero-title');
  if (!heroTitle) return;

  const text = heroTitle.textContent;
  heroTitle.textContent = '';
  heroTitle.style.display = 'inline-flex';
  heroTitle.style.gap = '0';

  // Create spans for each letter
  const letters = text.split('').map(char => {
    const span = document.createElement('span');
    span.textContent = char;
    span.style.display = 'inline-block';
    span.style.transition = 'transform 0.15s ease-out';
    span.style.transformOrigin = 'center';
    heroTitle.appendChild(span);
    return span;
  });

  // Track mouse movement anywhere on screen
  document.addEventListener('mousemove', (e) => {
    letters.forEach((letter) => {
      const letterRect = letter.getBoundingClientRect();
      const letterCenterX = letterRect.left + letterRect.width / 2;
      const letterCenterY = letterRect.top + letterRect.height / 2;

      const distanceX = e.clientX - letterCenterX;
      const distanceY = e.clientY - letterCenterY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      // Larger range for effect
      const maxDistance = 500;
      const proximity = Math.max(0, 1 - Math.min(distance / maxDistance, 1));
      const proximityCurve = proximity * proximity; // Exponential falloff for snappier feel

      // Natural push/pull effect based on mouse position relative to letter
      const angle = Math.atan2(distanceY, distanceX);

      // Compression when mouse is close, stretch away from mouse
      const squeeze = proximityCurve * 0.5;
      const stretch = proximityCurve * 0.35;

      // Push letters away from cursor
      const pushX = -Math.cos(angle) * proximityCurve * 25;
      const pushY = -Math.sin(angle) * proximityCurve * 15;

      // Scale based on angle - compress toward mouse, stretch perpendicular
      const scaleX = 1 - squeeze * Math.abs(Math.cos(angle));
      const scaleY = 1 + stretch * Math.abs(Math.sin(angle));

      letter.style.transform = `translate(${pushX}px, ${pushY}px) scale(${scaleX}, ${scaleY})`;
    });
  });

  // Reset when mouse leaves window
  document.addEventListener('mouseleave', () => {
    letters.forEach(letter => {
      letter.style.transform = 'translate(0, 0) scale(1)';
    });
  });
});


// ---------------------------------------------------------
// 6. Photo Marquee
// ---------------------------------------------------------

window.addEventListener('load', () => {
  const photoTrack = document.getElementById('photo-track');
  if (!photoTrack) return;

  const originalWidth = Math.round(photoTrack.scrollWidth);

  // Clone items for seamless loop
  Array.from(photoTrack.children).forEach(n => {
    photoTrack.appendChild(n.cloneNode(true));
  });

  // Set CSS variables for animation
  photoTrack.style.setProperty('--photo-distance', `${originalWidth}px`);
  const duration = originalWidth / 50; // pixels per second
  photoTrack.style.setProperty('--photo-duration', `${duration}s`);
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
  const duration = originalWidth / 40; // pixels per second
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
