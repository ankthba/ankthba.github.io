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
    // theme: 'auto' | 'light' | 'dark'
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
      const t = e.target.value;
      setTheme(t);
    });
  }

  mql.addEventListener && mql.addEventListener('change', () => {
    if (getTheme() === 'auto') setTheme('auto');
  });
  // Safari fallback
  mql.addListener && mql.addListener(() => {
    if (getTheme() === 'auto') setTheme('auto');
  });

  window.addEventListener('DOMContentLoaded', () => {
    const initial = getTheme();
    setTheme(initial);
    syncThemeUI(initial);
  });
  
  // Contact form handler
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    status.textContent = "Sending…";
    // Simulate async submission (replace with backend as needed)
    setTimeout(() => {
      status.textContent = "Thank you for contacting us!";
      form.reset();
    }, 1100);
  });
  
  // Accessibility: keyboard navigation for theme toggle
  themeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      themeToggle.click();
    }
  });

  // View Transitions API support check
  function supportsViewTransitions() {
    return 'startViewTransition' in document;
  }

  // Navbar physics animations
  const navbar = document.querySelector('.navbar');
  const navLinks = document.querySelectorAll('.navbar-links a');

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Entrance animation on page load
  if (!prefersReducedMotion) {
    navbar.classList.add('entrance');
    setTimeout(() => {
      navbar.classList.remove('entrance');
    }, 800);
  }

  // Mouse tracking physics for navbar tilt
  let mouseX = 0;
  let mouseY = 0;
  let navbarX = 0;
  let navbarY = 0;
  let isHovering = false;

  navbar.addEventListener('mouseenter', () => {
    isHovering = true;
    navbar.classList.remove('floating');
  });

  navbar.addEventListener('mouseleave', () => {
    isHovering = false;
    // Reset tilt smoothly
    navbar.style.transform = 'translateX(-50%)';
    // Resume floating after a delay
    setTimeout(() => {
      if (!isHovering) {
        navbar.classList.add('floating');
      }
    }, 500);
  });

  navbar.addEventListener('mousemove', (e) => {
    const rect = navbar.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate mouse position relative to navbar center
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;

    mouseX = deltaX;
    mouseY = deltaY;
  });

  // Smooth physics animation loop (only if motion is allowed)
  if (!prefersReducedMotion) {
    function animateNavbarPhysics() {
      if (isHovering) {
        // Smooth interpolation for tilt
        navbarX += (mouseX - navbarX) * 0.15;
        navbarY += (mouseY - navbarY) * 0.15;

        // Apply 3D tilt effect
        const rotateX = navbarY * -8; // Max 8deg rotation
        const rotateY = navbarX * 12;  // Max 12deg rotation
        const translateZ = Math.abs(navbarX) * 2 + Math.abs(navbarY) * 2;

        navbar.style.transform = `
          translateX(-50%)
          perspective(1000px)
          rotateX(${rotateX}deg)
          rotateY(${rotateY}deg)
          translateZ(${translateZ}px)
          scale(${1 + Math.abs(navbarX) * 0.02})
        `;
      }

      requestAnimationFrame(animateNavbarPhysics);
    }

    animateNavbarPhysics();
  }

  // Add bounce physics to navbar when any nav item is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');

      // Check if this is a navigation link (not anchor, external, etc.)
      const isNavigationLink = href &&
        !href.startsWith('#') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:') &&
        link.origin === window.location.origin &&
        !link.hasAttribute('target');

      if (isNavigationLink) {
        // Prevent immediate navigation to show animation
        e.preventDefault();

        // Trigger navbar bounce
        navbar.classList.remove('bounce', 'floating');
        void navbar.offsetWidth; // Force reflow
        navbar.classList.add('bounce');

        // Trigger individual link bounce and pulse
        link.classList.remove('bounce-item', 'pulse-item');
        void link.offsetWidth; // Force reflow
        link.classList.add('bounce-item', 'pulse-item');

        // Navigate after animation has played
        setTimeout(() => {
          if (supportsViewTransitions()) {
            document.startViewTransition(() => {
              window.location.href = href;
            });
          } else {
            window.location.href = href;
          }
        }, 400); // 400ms allows the bounce to be seen
      } else {
        // For non-navigation links, just trigger the animations
        navbar.classList.remove('bounce', 'floating');
        void navbar.offsetWidth;
        navbar.classList.add('bounce');

        link.classList.remove('bounce-item', 'pulse-item');
        void link.offsetWidth;
        link.classList.add('bounce-item', 'pulse-item');

        setTimeout(() => {
          navbar.classList.remove('bounce');
          link.classList.remove('bounce-item', 'pulse-item');
          if (!isHovering) {
            navbar.classList.add('floating');
          }
        }, 700);
      }
    });

    // Add subtle hover effect
    link.addEventListener('mouseenter', () => {
      if (!link.classList.contains('bounce-item')) {
        link.style.transform = 'scale(1.05) translateY(-2px)';
      }
    });

    link.addEventListener('mouseleave', () => {
      if (!link.classList.contains('bounce-item')) {
        link.style.transform = '';
      }
    });
  });

  // Scroll-based physics
  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    scrollVelocity = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    // Add slight bounce when scrolling fast
    if (Math.abs(scrollVelocity) > 5 && !navbar.classList.contains('bounce')) {
      const bounceIntensity = Math.min(Math.abs(scrollVelocity) / 20, 1);
      navbar.style.transform = `translateX(-50%) scale(${1 + bounceIntensity * 0.02})`;

      setTimeout(() => {
        if (!isHovering) {
          navbar.style.transform = 'translateX(-50%)';
        }
      }, 100);
    }
  });

