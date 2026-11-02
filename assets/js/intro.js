/* The home page's opening, as it was on the site before.

   On arriving, the name is set large in the middle of the page as a
   jumble of letters, each changing until, one by one, they settle into
   the name. It then shrinks back to its place at the head of the page
   while the rest comes in round it. The script in the page's head
   decides before the first paint whether to play it (once a visit, when
   the site is entered here rather than from another of its pages, and
   when motion is allowed; ?intro plays it again) and holds the page back
   with .intro. It moves the name itself, not a copy, so it always lands
   exactly where the page has set it. Any key, click, touch or scroll
   hurries it along. */

'use strict';

(function () {
  var root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  var name = document.querySelector('.masthead__name');
  var TEXT = name ? name.textContent : '';
  // the jumble: letters of the same case as the one they stand for, none
  // that drop below the line, so the name keeps its outline
  var LOWER = 'abcdefhiklmnorstuvwxz';
  var UPPER = 'ABCDEFGHIKLMNOPRSTUVWXYZ';
  var EASE = 'cubic-bezier(0.65, 0, 0.25, 1)';

  // when things happen, in ms from the start
  var TYPE = 120, TYPE_EACH = 35;     // each letter comes up
  var SET = 650, SET_EACH = 45;       // and each settles into its own
  var MOVE = 1750, MOVE_FOR = 900;    // then the name goes to its place
  var REST = 2350;                    // and the rest comes in round it

  var HURRY = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
  var anims = [];
  var slots = null;

  function hurry() {
    anims.forEach(function (a) {
      if (a.updatePlaybackRate) a.updatePlaybackRate(5);
      else a.playbackRate = 5;
    });
  }

  // the name back as plain text, exactly as the page set it
  function settle() {
    if (!slots) return;
    slots = null;
    name.textContent = TEXT;
    name.removeAttribute('aria-hidden');
  }

  function finish() {
    settle();
    root.classList.remove('intro', 'intro-play');
    // the page has come in already, so it doesn't come in again
    root.classList.add('intro-done');
    if (name) name.style.transformOrigin = '';
    HURRY.forEach(function (t) { window.removeEventListener(t, hurry, true); });
  }

  if (!name || !name.animate || !TEXT) { finish(); return; }

  /* Each letter in a box exactly as wide as its own advance, so the
     jumble never moves the name, and a letter that has settled stands
     just where it will in the plain text. Each jumbles only through the
     letters nearest its own width, so it reads as type. */
  function jumble() {
    var node = name.firstChild;
    var range = document.createRange();
    var box = name.getBoundingClientRect();
    var lefts = TEXT.split('').map(function (ch, i) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      return range.getBoundingClientRect().left;
    });
    range.setStart(node, TEXT.length - 1);
    range.setEnd(node, TEXT.length);
    lefts.push(range.getBoundingClientRect().right || box.right);
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
      el.className = 'intro__ch';
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
        s.el.className = 'intro__ch is-set';
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
    if (performance.now() > 3000 || document.hidden) { finish(); return; }
    try {
      window.scrollTo(0, 0);
      var box = name.getBoundingClientRect();
      // as large as fits, about the middle of the window
      var k = Math.min(2, (root.clientWidth * 0.84) / box.width);
      var dx = root.clientWidth / 2 - (box.left + box.width / 2);
      var dy = window.innerHeight * 0.46 - (box.top + box.height / 2);
      var away = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')';
      name.style.transformOrigin = '50% 50%';
      jumble();

      // holds in the middle while it is typed, then goes to its place;
      // its clock is the one the jumble keeps to
      var end = MOVE + MOVE_FOR;
      var move = name.animate([
        { transform: away },
        { transform: away, offset: MOVE / end, easing: EASE },
        { transform: 'none' }
      ], { duration: end, fill: 'backwards' });
      anims.push(move);

      // the rest comes in as it arrives: the pages under the name,
      // then the page, then the colophon, each a beat after the one before
      var page = Array.prototype.slice.call(document.querySelectorAll('.page > *'));
      var navs = Array.prototype.slice.call(document.querySelectorAll('.masthead__nav'));
      [navs, page, [document.querySelector('.colophon')]].forEach(function (group, i) {
        group.forEach(function (el, j) {
          if (!el) return;
          anims.push(el.animate([
            { opacity: 0, transform: 'translateY(0.5rem)' },
            { opacity: 1, transform: 'none' }
          ], { duration: 800, delay: REST + i * 120 + j * 50, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'backwards' }));
        });
      });

      root.classList.add('intro-play');
      root.classList.remove('intro');
      scramble(move);
      HURRY.forEach(function (t) { window.addEventListener(t, hurry, { capture: true, passive: true }); });
      Promise.all(anims.map(function (a) { return a.finished; })).then(finish, finish);
    } catch (e) {
      anims.forEach(function (a) { a.cancel(); });
      finish();
    }
  }

  // once its face is in, so it is measured where it will stay
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })])
    .then(function () { requestAnimationFrame(play); });
})();
