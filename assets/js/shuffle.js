/* Photographs on the home page, different ones on every visit (as many
   as the section's data-count asks for, four if it doesn't say), taken
   from the photographs page so the two never disagree. Where there is a
   [data-shuffle-caption], the first one's description goes in it. */

'use strict';

(function () {
  var section = document.querySelector('[data-shuffle]');
  var box = section && section.querySelector('[data-shuffle-grid]');
  if (!box || !window.fetch || !window.DOMParser) return;
  var count = parseInt(section.getAttribute('data-count'), 10) || 4;
  var caption = section.querySelector('[data-shuffle-caption]');

  fetch('/photos/')
    .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      // never one the photographs page keeps below (its grid's data-below)
      var grid = doc.querySelector('.photos__grid');
      var below = ((grid && grid.getAttribute('data-below')) || '').split(/\s+/).filter(Boolean);
      var photos = Array.prototype.slice.call(doc.querySelectorAll('.photos__grid img[src]'))
        .filter(function (img) {
          var src = img.getAttribute('src');
          return /^\/assets\/photos\//.test(src) && below.indexOf(src.split('/').pop().split(/[-.]/)[0]) < 0;
        });

      /* Shuffled, then a mix: half planes and half landscapes or phone
         tidbits, in a random order (whatever there is, if one runs short). */
      var shuffle = function (list) {
        for (var i = list.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = list[i]; list[i] = list[j]; list[j] = t;
        }
        return list;
      };
      shuffle(photos);
      var kindOf = function (img) { return (img.closest('.photo-item') || img).getAttribute('data-kind') || 'plane'; };
      var want = [], picked = [];
      for (var w = 0; w < count; w++) want.push(w % 2 ? 'landscape' : 'plane');
      shuffle(want);
      want.forEach(function (k) {
        for (var i = 0; i < photos.length; i++) {
          if (kindOf(photos[i]) === k && picked.indexOf(photos[i]) < 0) { picked.push(photos[i]); return; }
        }
      });
      photos.forEach(function (p) { if (picked.length < count && picked.indexOf(p) < 0) picked.push(p); });
      photos = picked;
      photos.slice(0, count).forEach(function (photo) {
        var a = document.createElement('a');
        a.href = '/photos/';
        var img = document.createElement('img');
        img.src = photo.getAttribute('src');
        if (photo.getAttribute('srcset')) {
          img.srcset = photo.getAttribute('srcset');
          img.sizes = section.getAttribute('data-sizes') || '(min-width: 48rem) 24vw, 46vw';
        }
        img.alt = photo.getAttribute('alt') || '';
        ['width', 'height'].forEach(function (k) {
          if (photo.getAttribute(k)) img.setAttribute(k, photo.getAttribute(k));
        });
        img.decoding = 'async';
        a.appendChild(img);
        box.appendChild(a);
      });
      if (!box.children.length) return;
      if (caption) caption.textContent = photos[0].getAttribute('alt') || '';
      section.hidden = false;
      // after it shows, so whatever lays the photographs out can measure
      box.dispatchEvent(new CustomEvent('shuffled', { bubbles: true }));
    })
    .catch(function () {});

})();
