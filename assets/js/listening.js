/* The home page's listening note: what's playing now, from the Worker
   in .github/worker/now.js, or failing that the last play in
   music.json, which the Action writes every fifteen minutes. Links must
   go to Spotify and pictures must be https, whatever either says. */

'use strict';

(function () {
  var box = document.querySelector('[data-listening]');
  if (!box || !window.fetch) return;

  var $ = function (sel) { return box.querySelector(sel); };
  var spotify = function (url) { return /^https:\/\/open\.spotify\.com\//.test(url || '') ? url : null; };
  var https = function (url) { return /^https:\/\//.test(url || '') ? url : null; };
  var shown = null; // where the song on show came from: 'live' or 'file'
  // a link the page gave its own address (the home page's goes to /music/)
  // keeps it; otherwise it goes to the song on Spotify
  var own = $('[data-listening-link]').hasAttribute('href');

  function show(item, playing, from) {
    if (!item || (from === 'file' && shown === 'live')) return;
    shown = from;
    $('[data-listening-heading]').textContent = playing ? 'Listening now' : 'Last listened to';
    $('[data-listening-name]').textContent = item.name;
    $('[data-listening-by]').textContent = item.artists || '';
    var link = $('[data-listening-link]');
    if (!own) {
      if (spotify(item.url)) link.href = item.url; else link.removeAttribute('href');
    }
    var art = $('[data-listening-art]');
    if (https(item.image)) art.src = item.image; else art.removeAttribute('src');
    box.hidden = false;
  }

  /* The last play the Action saw, in case the Worker can't answer. The
     file is the whole listening log, some hundred times the size of the
     Worker's answer, and the Worker's has the last plays in it too; so
     the file is only asked for, once, while there is still nothing to
     show: the Worker failed, answered with no song, or is taking long
     enough over it that the row would be left empty. */
  var asked = false;
  function file() {
    if (asked || shown) return;
    asked = true;
    fetch(box.getAttribute('data-src'), { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) { show(data && data.recent && data.recent[0], false, 'file'); })
      .catch(function () {});
  }

  /* The Worker only asks Spotify every fifteen seconds, whoever asks it. */
  function ask() {
    if (document.hidden) return;
    var slow = shown ? 0 : setTimeout(file, 5000);
    fetch(box.getAttribute('data-live'), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (now) {
        if (now.track && now.playing) show(now.track, true, 'live');
        else show(now.track || (now.recent && now.recent[0]), false, 'live');
      })
      .catch(function () {})
      .then(function () {
        clearTimeout(slow);
        file();
      });
  }
  ask();
  setInterval(ask, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
})();
