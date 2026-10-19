'use strict';

/* The home page's opening.
 *
 * On arriving at the site, the name is typed into the middle of the
 * paper, at the size of the names in the head, as a jumble of letters,
 * each changing until, one by one, they settle into the name. It then goes up to its place in the
 * hello while the rest of the page comes in round it. The small script
 * in the page's head decides before first paint whether to play it, and
 * holds the page back with .opening; this file plays it.
 *
 * It moves the name itself, not a copy, so it always lands exactly where
 * the head has set it. Any key, click, touch, scroll or resize hurries it
 * along. */

(function () {
  var root = document.documentElement;
  if (!root.classList.contains('opening')) return;

  var name = document.querySelector('.head__me');
  var TEXT = name ? name.textContent : '';
  // the jumble: letters of the same case as the one they stand for, and
  // none that drop below the line, so it keeps the name's outline
  var LOWER = 'abcdefhiklmnorstuvwxz';
  var UPPER = 'ABCDEFGHIKLMNOPRSTUVWXYZ';
  var CRISP = 'cubic-bezier(0.25, 1, 0.5, 1)';

  // when things happen, in ms from the start (all of it hurried together)
  var TYPE = 120, TYPE_EACH = 35;      // each character comes up
  var SET = 600, SET_EACH = 45;        // and each settles into its letter
  var MOVE = 1700, MOVE_FOR = 850;     // then the name goes to its place
  var REST = 2300, REST_EACH = 120;    // and the rest comes in round it

  var HURRY = ['keydown', 'pointerdown', 'wheel', 'touchstart', 'resize'];
  var anims = [];
  var slots = null;

  function hurry() {
    anims.forEach(function (a) {
      if (a.updatePlaybackRate) a.updatePlaybackRate(5);
      else a.playbackRate = 5;
    });
  }
  // the name back as plain text, exactly as the head set it
  function settle() {
    if (!slots) return;
    slots = null;
    name.textContent = TEXT;
    name.removeAttribute('aria-hidden');
  }
  function finish() {
    settle();
    root.classList.remove('opening', 'opening-play');
    if (name) name.style.transformOrigin = '';
    HURRY.forEach(function (t) { window.removeEventListener(t, hurry, true); });
  }

  if (!name || !name.animate || !TEXT) { finish(); return; }

  // the baseline of the first line inside el, in viewport pixels
  function baseline(el) {
    var mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    el.insertBefore(mark, el.firstChild);
    var y = mark.getBoundingClientRect().bottom;
    el.removeChild(mark);
    return y;
  }

  /* Each letter in a box exactly as wide as its own advance, so the
     jumble never moves the name or anything round it, and a letter that
     has settled stands just where it will in the plain text. */
  function jumble(box) {
    var node = name.firstChild;
    var range = document.createRange();
    var lefts = TEXT.split('').map(function (ch, i) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      return range.getBoundingClientRect().left;
    });
    lefts.push(box.right);
    // and each jumbles only through the characters nearest its letter's
    // width, so the jumble reads as type and not a pile of it
    var cs = getComputedStyle(name);
    var c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var measure = function (set) { return set.split('').map(function (g) { return [g, c.measureText(g).width]; }); };
    var lower = measure(LOWER), upper = measure(UPPER);
    name.setAttribute('aria-hidden', 'true');
    name.textContent = '';
    slots = TEXT.split('').map(function (ch, i) {
      var w = lefts[i + 1] - lefts[i];
      var el = document.createElement('span');
      el.className = 'opening__ch';
      el.style.width = w + 'px';
      name.appendChild(el);
      var near = (ch === ch.toLowerCase() ? lower : upper).slice()
        .sort(function (a, b) { return Math.abs(a[1] - w) - Math.abs(b[1] - w); })
        .slice(0, 8).map(function (g) { return g[0]; }).join('');
      return { el: el, ch: ch, near: near, on: TYPE + i * TYPE_EACH, set: SET + i * SET_EACH, next: 0, done: ch === ' ' };
    });
  }

  function scramble(clock) {
    if (!slots) return;
    var t = clock.currentTime;
    var now = performance.now();
    var left = 0;
    slots.forEach(function (s) {
      if (s.done) return;
      if (t >= s.set) {
        s.done = true;
        s.el.textContent = s.ch;
        s.el.className = 'opening__ch is-set';
        return;
      }
      left++;
      if (t < s.on || now < s.next) return;
      s.el.textContent = s.near.charAt(Math.floor(Math.random() * s.near.length));
      s.el.classList.add('is-on');
      s.next = now + 70 + Math.random() * 50;
    });
    if (left) requestAnimationFrame(function () { scramble(clock); });
    else settle();
  }

  function play() {
    // too late to begin, the page having come in on its own, or opened
    // in a tab behind, where no one would see it
    if (performance.now() > 2800 || document.hidden) { finish(); return; }
    try {
      var box = name.getBoundingClientRect();
      var size = parseFloat(getComputedStyle(name).fontSize);
      var c = document.createElement('canvas').getContext('2d');
      c.font = '100px "EB Garamond"';
      var cap = c.measureText('H').actualBoundingBoxAscent / 100 || 0.65;
      // grown about the middle of its capitals, so they are what sits in
      // the middle of the paper; as large as the names (the hello is 0.56
      // of them), or as fits a narrow screen
      var oy = baseline(name) - box.top - cap * size / 2;
      var k = Math.min(1 / 0.56, root.clientWidth * 0.82 / box.width);
      var dx = root.clientWidth / 2 - (box.left + box.width / 2);
      var dy = window.innerHeight * 0.48 - (box.top + oy);
      var away = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')';
      name.style.transformOrigin = '50% ' + oy + 'px';
      jumble(box);

      // holds in the middle while it is typed, then goes to its place;
      // its clock is the one the jumble keeps to
      var end = MOVE + MOVE_FOR;
      var move = name.animate([
        { transform: away },
        { transform: away, offset: MOVE / end, easing: 'cubic-bezier(0.65, 0, 0.25, 1)' },
        { transform: 'none' }
      ], { duration: end, fill: 'backwards' });
      anims.push(move);

      // the rest comes in as it arrives: the head round it, then the
      // page, then the colophon, each a beat after the one before
      var head = Array.prototype.slice.call(document.querySelectorAll(
        '.masthead > :not(.head__hello), .head__soft, .head__comma'));
      var groups = [
        [head, false],
        [[document.querySelector('.page')], true],
        [[document.querySelector('.colophon')], true]
      ];
      groups.forEach(function (g, i) {
        g[0].forEach(function (el) {
          if (!el) return;
          anims.push(el.animate(g[1]
            ? [{ opacity: 0, transform: 'translateY(0.5rem)' }, { opacity: 1, transform: 'none' }]
            : [{ opacity: 0 }, { opacity: 1 }],
            { duration: 800, delay: REST + i * REST_EACH, easing: CRISP, fill: 'backwards' }));
        });
      });

      root.classList.add('opening-play');
      root.classList.remove('opening');
      scramble(move);
      HURRY.forEach(function (t) { window.addEventListener(t, hurry, { capture: true, passive: true }); });
      Promise.all(anims.map(function (a) { return a.finished; })).then(finish, finish);
    } catch (e) {
      anims.forEach(function (a) { a.cancel(); });
      finish();
    }
  }

  // set once its face is in, so it is measured where it will stay
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })])
    .then(function () { requestAnimationFrame(play); });
})();
