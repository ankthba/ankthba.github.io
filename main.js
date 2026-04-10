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

  // Check if near bottom of page - if so, activate the last section
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;

  if (nearBottom) {
    // Find the last section that has a nav link
    for (let i = sections.length - 1; i >= 0; i--) {
      const id = sections[i].getAttribute('id');
      const hasLink = document.querySelector(`.nav__link[href="#${id}"]`);
      if (hasLink) {
        current = id;
        break;
      }
    }
  } else {
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 150;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });
  }

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    link.classList.remove('active');
    if (href === `#${current}`) {
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
      nameEl.appendChild(span);
      allLetters.push(span);
    });
  });

  // Track mouse movement anywhere on screen
  document.addEventListener('mousemove', (e) => {
    allLetters.forEach((letter) => {
      const letterRect = letter.getBoundingClientRect();
      const letterCenterX = letterRect.left + letterRect.width / 2;
      const letterCenterY = letterRect.top + letterRect.height / 2;

      const distanceX = e.clientX - letterCenterX;
      const distanceY = e.clientY - letterCenterY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      const maxDistance = 500;
      const proximity = Math.max(0, 1 - Math.min(distance / maxDistance, 1));
      const proximityCurve = proximity * proximity;

      const angle = Math.atan2(distanceY, distanceX);

      const squeeze = proximityCurve * 0.5;
      const stretch = proximityCurve * 0.35;

      const pushX = -Math.cos(angle) * proximityCurve * 25;
      const pushY = -Math.sin(angle) * proximityCurve * 15;

      const scaleX = 1 - squeeze * Math.abs(Math.cos(angle));
      const scaleY = 1 + stretch * Math.abs(Math.sin(angle));

      letter.style.transform = `translate(${pushX}px, ${pushY}px) scale(${scaleX}, ${scaleY})`;
    });
  });

  document.addEventListener('mouseleave', () => {
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


