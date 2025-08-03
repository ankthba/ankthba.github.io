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
  
  // Theme toggler (dark/light)
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  
  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
  
  function getTheme() {
    return localStorage.getItem('theme') || 'dark';
  }
  
  themeToggle.addEventListener('click', () => {
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
  
  window.addEventListener('DOMContentLoaded', () => {
    setTheme(getTheme());
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