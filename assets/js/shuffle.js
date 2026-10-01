/* Four photographs on the home page, a different four on every visit,
   taken from the photographs page so the two never disagree. */

'use strict';

(function () {
  var section = document.querySelector('[data-shuffle]');
  var box = section && section.querySelector('[data-shuffle-grid]');
  if (!box || !window.fetch || !window.DOMParser) return;

  fetch('/photos/')
    .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var photos = Array.prototype.slice.call(doc.querySelectorAll('.photos__grid img[src]'))
        .filter(function (img) { return /^\/assets\/photos\//.test(img.getAttribute('src')); });

      /* Fisher-Yates, then the first four. */
      for (var i = photos.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = photos[i]; photos[i] = photos[j]; photos[j] = t;
      }
      photos.slice(0, 4).forEach(function (photo) {
        var a = document.createElement('a');
        a.href = '/photos/';
        var img = document.createElement('img');
        img.src = photo.getAttribute('src');
        img.alt = photo.getAttribute('alt') || '';
        img.decoding = 'async';
        a.appendChild(img);
        box.appendChild(a);
      });
      if (!box.children.length) return;
      section.hidden = false;
      even();
    })
    .catch(function () {});

  /* Squares sized so the photographs' column is exactly as tall as the
     writing and listening beside it, "More photos" level with "More
     music". The headings and links match on both sides, so only the
     squares need to give. Re-measured whenever the left side changes,
     as it does when the song arrives. Side by side only. */
  var left = document.querySelector('.home__col');
  var wide = matchMedia('(min-width: 481px)');
  function even() {
    if (section.hidden || !left) return;
    if (!wide.matches) { box.style.removeProperty('--tile'); return; }
    var tile = box.firstElementChild.getBoundingClientRect().width;
    var gap = left.getBoundingClientRect().height - section.getBoundingClientRect().height;
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    box.style.setProperty('--tile', Math.max(4 * rem, Math.min(9 * rem, tile + gap / 2)) + 'px');
  }
  if (window.ResizeObserver && left) new ResizeObserver(function () { even(); }).observe(left);
  wide.addEventListener('change', even);
})();
