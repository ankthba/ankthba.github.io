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