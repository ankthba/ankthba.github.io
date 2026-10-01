/* Four photographs on the home page, a different four on every visit,
   taken from the photographs page so the two never disagree. */

'use strict';

(function () {
  var box = document.querySelector('[data-shuffle]');
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
      if (box.children.length) box.hidden = false;
    })
    .catch(function () {});
})();
