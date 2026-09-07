/* =========================================================
   readability.js
   A quiet escape hatch in the footer: any reader who finds the
   handwriting hard going can drop back to the site's original
   EB Garamond, and the choice sticks on their next visit.

   It works by DISABLING the organic stylesheets rather than by
   writing CSS that unwinds them. So "easier to read" is exactly
   style.css with nothing layered on top, and it cannot drift out
   of sync as the variants change.

   Wiring: mark the experiment's sheets — <link> or inline <style>,
   both work — and load this at the end of the body.

     <link rel="stylesheet" href="/assets/css/style.css">
     <link rel="stylesheet" href="/assets/css/organic-fieldnotes.css" data-organic>
     <link rel="stylesheet" href="/assets/css/organic-toggle.css">
     <script src="/assets/js/readability.js" defer></script>

   organic-toggle.css is deliberately NOT marked data-organic —
   it styles the button, so it has to survive being switched off.
   ========================================================= */

(function () {
  "use strict";

  var KEY = "aniketh:typeface";
  var PLAIN = "plain";
  var HAND = "hand";

  var LABEL = {};
  LABEL[HAND] = "Make this easier to read";
  LABEL[PLAIN] = "Back to the handwriting";

  var sheets = function () {
    return document.querySelectorAll("link[data-organic], style[data-organic]");
  };

  if (!sheets().length) return;

  // Storage throws outright in some privacy modes, so every access is
  // guarded and the page still works with nothing remembered.
  function remembered() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function remember(mode) {
    try {
      window.localStorage.setItem(KEY, mode);
    } catch (e) {
      /* nothing to do — the choice just won't outlive this page */
    }
  }

  var mode = remembered() === PLAIN ? PLAIN : HAND;
  var button = null;

  function apply() {
    var off = mode === PLAIN;
    var list = sheets();

    for (var i = 0; i < list.length; i++) {
      var link = list[i];

      if (off) {
        link.disabled = true;
      } else if (link.disabled) {
        if (link.tagName === "LINK") {
          // Chromium drops the CSSOM sheet when a link's `disabled`
          // flips back to false and does not re-attach it, so the page
          // would stay in Garamond forever. Re-enabling therefore means
          // handing the browser a fresh element to load. cloneNode keeps
          // the id, replaceWith keeps its place in the cascade.
          var fresh = link.cloneNode(true);
          fresh.disabled = false;
          link.replaceWith(fresh);
        } else {
          // An inline <style> has nothing to fetch, so it re-attaches.
          link.disabled = false;
        }
      }
    }

    document.documentElement.setAttribute("data-typeface", mode);
    if (button) button.textContent = LABEL[mode];
  }

  function toggle() {
    mode = mode === PLAIN ? HAND : PLAIN;
    remember(mode);
    apply();
  }

  function mount() {
    var host = document.querySelector(".colophon");
    if (!host) return;

    button = document.createElement("button");
    button.type = "button";
    button.className = "readability";
    button.textContent = LABEL[mode];
    button.addEventListener("click", toggle);
    host.appendChild(button);
    apply();
  }

  // Applied as early as possible so a returning reader who chose plain
  // never sees a frame of handwriting; the button waits for the footer.
  apply();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  // The preview harness swaps stylesheets at runtime; it calls this so
  // newly inserted sheets pick up the current choice.
  window.readability = { refresh: apply };
})();
