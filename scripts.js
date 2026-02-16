'use strict';

// Navigation smooth scroll and active link highlighting
document.querySelectorAll('.navbar-links a[href^="#"]').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      window.scrollTo({
        top: target.offsetTop - 60,
        behavior: 'smooth'
      });
      document.querySelectorAll('.navbar-links a').forEach(a => a.classList.remove('active'));
      this.classList.add('active');
    }
  });
});

// Theme toggler (auto/light/dark)
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

function syncThemeUI(theme) {
  if (themeToggle) themeToggle.value = theme;
}

if (themeToggle) {
  themeToggle.addEventListener('change', (e) => {
    setTheme(e.target.value);
  });

  themeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      themeToggle.click();
    }
  });
}

if (mql.addEventListener) {
  mql.addEventListener('change', () => {
    if (getTheme() === 'auto') setTheme('auto');
  });
} else if (mql.addListener) {
  // Safari fallback
  mql.addListener(() => {
    if (getTheme() === 'auto') setTheme('auto');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const initial = getTheme();
  setTheme(initial);
  syncThemeUI(initial);
});

// Contact form handler
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');

if (form) {
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    status.textContent = 'Sending\u2026';
    setTimeout(() => {
      status.textContent = 'Thank you for contacting us!';
      form.reset();
    }, 1100);
  });
}

// View Transitions API support check
function supportsViewTransitions() {
  return 'startViewTransition' in document;
}

// Nav link click — view transition navigation
const navLinks = document.querySelectorAll('.navbar-links a');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    const isNavigationLink = href &&
      !href.startsWith('#') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:') &&
      link.origin === window.location.origin &&
      !link.hasAttribute('target');

    if (isNavigationLink) {
      e.preventDefault();
      if (supportsViewTransitions()) {
        document.startViewTransition(() => {
          window.location.href = href;
        });
      } else {
        window.location.href = href;
      }
    }
  });
});

// Marquee: seamless pixel-accurate loop
window.addEventListener('load', () => {
  const track = document.querySelector('.logo-track');
  if (!track) return;

  // Measure original set width before duplicating
  const originalWidth = Math.round(track.scrollWidth);

  // Duplicate logos once for seamless loop
  Array.from(track.children).forEach(n => track.appendChild(n.cloneNode(true)));

  // Set CSS variables for exact pixel distance and speed
  track.style.setProperty('--marquee-distance', `${originalWidth}px`);
  const duration = originalWidth / 80; // 80px/s
  track.style.setProperty('--marquee-duration', `${duration}s`);
});
