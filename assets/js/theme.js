'use strict';

/* The colophon theme control.
 *
 * Three settings, "system" being the default and the absence of a
 * choice rather than a choice of its own. The preference lives in
 * localStorage; the resolved theme lives in data-theme on the root, and
 * is absent for "system" so the CSS falls through to color-scheme:
 * light dark and the operating system decides.
 *
 * The attribute is applied by a small inline script in each page's head
 * so it lands before first paint. This file only handles the buttons. */

(function () {
  var STORAGE_KEY = 'theme';
  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;

  var buttons = toggle.querySelectorAll('[data-theme-choice]');
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  /* The two theme-color metas are written with media attributes so they
     work without scripting. Once a theme is chosen explicitly those
     queries are answering the wrong question, so both get set to the
     colour actually on screen; "system" hands them back. */
  var chrome = {};
  metas.forEach(function (meta) {
    chrome[meta.media.indexOf('dark') > -1 ? 'dark' : 'light'] = meta.content;
  });

  function read() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function apply(choice) {
    if (choice === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }

    var resolved = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    metas.forEach(function (meta) {
      var own = meta.media.indexOf('dark') > -1 ? 'dark' : 'light';
      meta.content = choice === 'system' ? chrome[own] : chrome[resolved];
    });

    buttons.forEach(function (button) {
      button.setAttribute(
        'aria-pressed',
        button.dataset.themeChoice === choice ? 'true' : 'false'
      );
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var choice = button.dataset.themeChoice;
      try {
        if (choice === 'system') {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, choice);
        }
      } catch (e) {}
      apply(choice);
    });
  });

  /* On "system", follow the system when it changes underneath us. */
  media.addEventListener('change', function () {
    if (read() === 'system') apply('system');
  });

  /* Another tab changing the setting changes this one too. */
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) apply(read());
  });

  apply(read());
})();
