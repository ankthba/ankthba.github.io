/* The Copy beside the address on the contact page: shown only where the
   address can be copied, it puts it on the clipboard and says so for a
   moment. Where the clipboard API is refused (some embedded and locked
   down browsers), it falls back to copying from a hidden field. */

'use strict';

(function () {
  var button = document.querySelector('[data-copy]');
  if (!button) return;
  var api = navigator.clipboard && window.isSecureContext;
  var legacy = document.queryCommandSupported && document.queryCommandSupported('copy');
  if (!api && !legacy) return;
  button.hidden = false;

  function fallback(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    field.remove();
    return ok;
  }

  var timer;
  function done() {
    button.textContent = 'Copied';
    button.classList.add('is-done');
    clearTimeout(timer);
    timer = setTimeout(function () {
      button.textContent = 'Copy';
      button.classList.remove('is-done');
    }, 2000);
  }

  button.addEventListener('click', function () {
    var text = button.getAttribute('data-copy');
    if (!api) { if (fallback(text)) done(); return; }
    navigator.clipboard.writeText(text).then(done, function () {
      if (fallback(text)) done();
    });
  });
})();
