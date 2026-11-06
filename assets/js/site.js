/* The details: the highlight that slides between rows, the stack of
   photographs you can throw, links to any entry, search, and the copy
   key beside an address.
   The theme control is theme.js; picking the photographs, shuffle.js. */

'use strict';

(function () {
  var root = document.documentElement;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- The pages ----------
     On a phone the sidebar's pages are one row you swipe along; start
     it with the page you are on in view. */
  var here = document.querySelector('.side__nav [aria-current="page"]');
  if (here) {
    var row = here.parentNode;
    if (row.scrollWidth > row.clientWidth) {
      var at = here.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
      row.scrollLeft = at - (row.clientWidth - here.offsetWidth) / 2;
    }
  }

  /* ---------- Rows ----------
     One highlight per list. It jumps to the first row it lights (no
     slide in from nowhere), then slides from row to row, and fades out
     when the pointer leaves the list. */
  document.querySelectorAll('.rows, .reach').forEach(function (list) {
    var hl = document.createElement('span');
    hl.className = 'rows__hl';
    hl.setAttribute('aria-hidden', 'true');
    list.insertBefore(hl, list.firstChild);
    var lit = false;

    function light(row) {
      if (!fine.matches || !row) return;
      var top = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
      if (!lit) {
        hl.style.transition = 'none';
        hl.getBoundingClientRect();
      }
      hl.style.transform = 'translateY(' + top + 'px)';
      hl.style.height = row.offsetHeight + 'px';
      if (!lit) {
        hl.getBoundingClientRect();
        hl.style.transition = '';
      }
      lit = true;
      list.classList.add('is-lit');
    }

    list.addEventListener('pointerover', function (event) {
      light(event.target.closest('.row, .reach__row'));
    });
    list.addEventListener('focusin', function (event) {
      light(event.target.closest('.row, .reach__row'));
    });
    list.addEventListener('pointerleave', function () {
      lit = false;
      list.classList.remove('is-lit');
    });
    list.addEventListener('focusout', function (event) {
      if (!list.contains(event.relatedTarget)) {
        lit = false;
        list.classList.remove('is-lit');
      }
    });
  });

  /* ---------- The stack ----------
     shuffle.js fills it and says so. Each print is its photograph's own
     shape, sized to fit the pile, and lies at its own small angle. The
     top one can be dragged; let go far enough or fast enough it is
     thrown, then slides in again at the back. A press that didn't move
     is a click, and opens the photographs. The arrow keys, or Next, do
     the same as a throw. */
  var stack = document.querySelector('[data-stack]');
  if (stack) {
    stack.addEventListener('shuffled', function () {
      var cards = Array.prototype.slice.call(stack.querySelectorAll('a'));
      if (!cards.length) return;
      var MAT = 10; // the print's white border, both sides together

      function size() {
        // the prints fill the pile's box, less a little for their tilt
        var w = stack.clientWidth - 12;
        var h = stack.clientHeight - 12;
        cards.forEach(function (card) {
          var img = card.querySelector('img');
          var iw = Number(img.getAttribute('width')) || 4;
          var ih = Number(img.getAttribute('height')) || 5;
          var k = Math.min((w - MAT) / iw, (h - MAT) / ih);
          card.style.width = Math.round(iw * k + MAT) + 'px';
          card.style.height = Math.round(ih * k + MAT) + 'px';
        });
      }

      function lay() {
        cards.forEach(function (card, i) {
          var depth = cards.length - 1 - i; // 0 is the top print
          card.style.zIndex = String(i + 1);
          card.style.setProperty('--x', (depth * 3) + 'px');
          card.style.setProperty('--y', (depth * -2) + 'px');
          card.style.setProperty('--r', card.dataset.tilt + 'deg');
          card.classList.toggle('is-top', depth === 0);
          card.tabIndex = depth === 0 ? 0 : -1;
          card.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
        });
      }

      cards.forEach(function (card) {
        card.dataset.tilt = (Math.random() * 8 - 4).toFixed(1);
      });
      size();
      lay();
      window.addEventListener('resize', size);

      function next(direction) {
        var top = cards[cards.length - 1];
        var focused = document.activeElement === top;
        top.style.setProperty('--x', direction * stack.clientWidth * 0.7 + 'px');
        top.style.setProperty('--r', direction * 14 + 'deg');
        setTimeout(function () {
          cards.unshift(cards.pop());
          lay();
          if (focused) cards[cards.length - 1].focus();
        }, still.matches ? 0 : 200);
      }

      var button = document.querySelector('[data-stack-next]');
      if (button) {
        button.hidden = false;
        button.addEventListener('click', function () { next(1); });
      }

      stack.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          next(event.key === 'ArrowRight' ? 1 : -1);
        }
      });

      var drag = null;
      var dragged = false; // the click that ends a drag is not a click

      stack.addEventListener('pointerdown', function (event) {
        var top = cards[cards.length - 1];
        if (event.target.closest('a') !== top || event.button !== 0) return;
        drag = { card: top, x: event.clientX, y: event.clientY, t: performance.now(), dx: 0, dy: 0, moved: false };
        top.setPointerCapture(event.pointerId);
      });

      stack.addEventListener('pointermove', function (event) {
        if (!drag) return;
        drag.dx = event.clientX - drag.x;
        drag.dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(drag.dx, drag.dy) < 4) return;
        drag.moved = true;
        drag.card.classList.add('is-dragging');
        drag.card.style.setProperty('--x', drag.dx + 'px');
        drag.card.style.setProperty('--y', drag.dy + 'px');
        drag.card.style.setProperty('--r', (Number(drag.card.dataset.tilt) + drag.dx * 0.06) + 'deg');
      });

      function release() {
        if (!drag) return;
        var d = drag;
        drag = null;
        d.card.classList.remove('is-dragging');
        if (!d.moved) return;
        dragged = true;
        var speed = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
        if (Math.abs(d.dx) > d.card.offsetWidth * 0.5 || speed > 0.6) next(d.dx < 0 ? -1 : 1);
        else lay();
      }

      stack.addEventListener('pointerup', release);
      stack.addEventListener('pointercancel', release);
      stack.addEventListener('click', function (event) {
        if (dragged) event.preventDefault();
        dragged = false;
      }, true);

      /* On its own, the top print goes to the back every few seconds.
         It waits while the pile is pointed at, held or has focus, while
         it is out of view or the page is hidden, and for a full beat
         after any print is thrown by hand; where motion is unwelcome,
         it stays still. */
      var EVERY = 3600;
      var last = performance.now();
      var resting = false;
      var seen = true;
      var moved = next;
      next = function (direction) {
        last = performance.now();
        moved(direction);
      };
      stack.addEventListener('pointerenter', function () { resting = true; });
      stack.addEventListener('pointerleave', function () { resting = false; last = performance.now(); });
      stack.addEventListener('focusin', function () { resting = true; });
      stack.addEventListener('focusout', function () { resting = false; last = performance.now(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          seen = entries[0].isIntersecting;
          if (seen) last = performance.now();
        }).observe(stack);
      }
      setInterval(function () {
        if (still.matches || document.hidden || resting || drag || !seen) return;
        if (performance.now() - last >= EVERY) next(1);
      }, 250);
    });
  }

  /* ---------- Copy ----------
     Any [data-copy] button puts its text on the clipboard and says so
     for a moment (the contact page's own copy key is contact.js). */
  document.querySelectorAll('.copy[data-copy]').forEach(function (button) {
    if (!navigator.clipboard || !window.isSecureContext) return;
    button.hidden = false;
    var timer;
    button.addEventListener('click', function () {
      navigator.clipboard.writeText(button.getAttribute('data-copy')).then(function () {
        button.textContent = 'Copied';
        button.classList.add('is-done');
        clearTimeout(timer);
        timer = setTimeout(function () {
          button.textContent = 'Copy';
          button.classList.remove('is-done');
        }, 1600);
      });
    });
  });

  /* ---------- Anchors ----------
     Every entry on a page gets an id from its name, so search (and
     anyone) can link straight to it; arriving at one marks it for a
     moment. A photograph is reached as /photos/#photo=landscape13, and
     opens in the viewer. */
  function slug(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  document.querySelectorAll('.project-item').forEach(function (item) {
    var title = item.querySelector('.project-item__title');
    if (title && !item.id) item.id = slug(title.textContent);
  });
  document.querySelectorAll('.scent').forEach(function (item) {
    var name = item.querySelector('.play__name');
    if (name && !item.id) item.id = slug(name.textContent);
  });

  function arrive() {
    var hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    var photo = /^photo=(.+)$/.exec(hash);
    if (photo) {
      var img = Array.prototype.find.call(document.querySelectorAll('.photo-item img'), function (el) {
        return el.getAttribute('src').split('/').pop().split(/[-.]/)[0] === photo[1];
      });
      if (img) {
        img.scrollIntoView({ block: 'center' });
        img.click();
      }
      return;
    }
    var target = document.getElementById(hash);
    if (!target) return;
    var details = target.querySelector('details');
    if (details) details.open = true;
    target.scrollIntoView({ block: 'center' });
    target.classList.remove('is-target');
    target.getBoundingClientRect();
    target.classList.add('is-target');
  }
  arrive();
  window.addEventListener('hashchange', arrive);

  /* ---------- Search ----------
     ⌘K, Ctrl+K or / opens it, from any page. The first time, it reads
     every page of the site (and keeps what it read for the rest of the
     visit), so it finds any project, job, piece of press, photograph or
     scent by anything written about it. Results are ranked: a match in
     a name counts most, then in the line under it, then in the text;
     every word typed must match somewhere. Arrows move, Return opens,
     Escape closes. */
  var SOURCES = [
    ['/', 'Pages'], ['/work/', 'Work'], ['/education/', 'Education'],
    ['/projects/', 'Projects'], ['/research/', 'Research'], ['/research/agentical/', 'Research'], ['/writing/', 'Writing'], ['/press/', 'Press'],
    ['/photos/', 'Photos'], ['/fragrance/', 'Fragrance'], ['/contact/', 'Pages'],
    ['/resume/', 'Pages'], ['/music/', 'Pages']
  ];

  var FIXED = [
    { group: 'Elsewhere', title: 'GitHub', sub: 'github.com/ankthba', url: 'https://github.com/ankthba' },
    { group: 'Elsewhere', title: 'X', sub: '@ankthba', url: 'https://x.com/ankthba' },
    { group: 'Elsewhere', title: 'LinkedIn', sub: 'in/anikethb', url: 'https://www.linkedin.com/in/anikethb/' },
    { group: 'Elsewhere', title: 'Instagram', sub: '@ankthba, and @aniketh.png for photographs', url: 'https://www.instagram.com/ankthba/' },
    { group: 'Elsewhere', title: 'Substack', sub: 'ankthba.substack.com', url: 'https://ankthba.substack.com/' },
    { group: 'Elsewhere', title: 'Spotify', sub: 'What I listen to', url: 'https://open.spotify.com/user/9boft0x75s9wyfvm6qqppyb6t' },
    { group: 'Elsewhere', title: 'Pragmatic', sub: 'The system of record for AI agents', url: '/pragmatic/' },
    { group: 'Elsewhere', title: 'OCRadar', sub: 'AI that helps catch oral cancer early', url: 'https://ocradar.com/' },
    { group: 'Elsewhere', title: 'Haze', sub: 'Weather for iPhone, iPad, Mac and Apple Watch', url: '/haze/' },
    { group: 'Do', title: 'Copy email address', sub: 'me@aniketh.net', url: 'copy:me@aniketh.net' },
    { group: 'Do', title: 'Email me', sub: 'me@aniketh.net', url: 'mailto:me@aniketh.net' },
    { group: 'Do', title: 'Download resume', sub: 'PDF', url: '/assets/media/Aniketh-Bandlamudi-Resume.pdf' },
    { group: 'Do', title: 'Light theme', sub: '', url: 'theme:light' },
    { group: 'Do', title: 'Dark theme', sub: '', url: 'theme:dark' },
    { group: 'Do', title: 'Follow the system theme', sub: '', url: 'theme:system' }
  ];

  var STORE = 'search-index-v1';
  var index = null;
  var building = null;

  function clean(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function read(path, group, html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var items = [];
    var name = clean((doc.querySelector('title') || {}).textContent).replace(/\s*\|\s*Aniketh Bandlamudi$/, '');
    var about = (doc.querySelector('meta[name="description"]') || { content: '' }).content;
    items.push({ group: 'Pages', title: path === '/' ? 'About' : name, sub: clean(about), text: '', url: path });

    doc.querySelectorAll('.project-item').forEach(function (item) {
      var title = clean((item.querySelector('.project-item__title') || {}).textContent);
      if (!title) return;
      items.push({
        group: group,
        title: title,
        sub: clean((item.querySelector('.project-item__role') || {}).textContent),
        text: clean(Array.prototype.map.call(item.querySelectorAll('.project-item__description'), function (p) { return p.textContent; }).join(' ')),
        url: path + '#' + slug(title)
      });
    });

    doc.querySelectorAll('.essay').forEach(function (item) {
      items.push({
        group: group,
        title: clean((item.querySelector('.essay__title') || {}).textContent),
        sub: clean((item.querySelector('.essay__sub') || {}).textContent),
        text: clean((item.querySelector('.essay__body') || {}).textContent),
        url: path + '#' + item.id
      });
    });

    doc.querySelectorAll('.photo-item img').forEach(function (img) {
      var src = img.getAttribute('src');
      items.push({
        group: 'Photos',
        title: clean(img.getAttribute('alt')),
        sub: (img.closest('.photo-item').getAttribute('data-kind') === 'plane' ? 'Aviation' : 'Landscape'),
        text: '',
        thumb: src,
        url: '/photos/#photo=' + src.split('/').pop().split(/[-.]/)[0]
      });
    });

    doc.querySelectorAll('.scent').forEach(function (item) {
      var title = clean((item.querySelector('.play__name') || {}).textContent);
      items.push({
        group: 'Fragrance',
        title: title,
        sub: clean((item.querySelector('.play__by') || {}).textContent),
        text: clean(Array.prototype.map.call(item.querySelectorAll('dd'), function (d) { return d.textContent; }).join(' · ')),
        url: '/fragrance/#' + slug(title)
      });
    });
    return items;
  }

  function build() {
    if (index) return Promise.resolve(index);
    if (building) return building;
    try {
      var kept = JSON.parse(sessionStorage.getItem(STORE));
      if (kept && kept.length) {
        index = kept.concat(FIXED).map(prepare);
        return Promise.resolve(index);
      }
    } catch (e) {}
    building = Promise.all(SOURCES.map(function (source) {
      return fetch(source[0])
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) { return html ? read(source[0], source[1], html) : []; })
        .catch(function () { return []; });
    })).then(function (lists) {
      var all = [].concat.apply([], lists);
      try { sessionStorage.setItem(STORE, JSON.stringify(all)); } catch (e) {}
      index = all.concat(FIXED).map(prepare);
      return index;
    });
    return building;
  }

  function fold(text) {
    return (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function prepare(item) {
    item.f = { title: fold(item.title), sub: fold(item.sub), text: fold(item.text), group: fold(item.group) };
    return item;
  }

  // where `word` starts a word in `hay` (-1 if nowhere), else where it is at all
  function find(hay, word) {
    var at = hay.indexOf(word);
    while (at > 0 && /[a-z0-9]/.test(hay[at - 1])) {
      var next = hay.indexOf(word, at + 1);
      if (next < 0) break;
      at = next;
    }
    return at;
  }

  function score(item, words) {
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i], best = 0, at;
      if ((at = find(item.f.title, w)) > -1) best = item.f.title === w ? 40 : at === 0 ? 24 : /[a-z0-9]/.test(item.f.title[at - 1] || '') ? 10 : 18;
      else if ((at = find(item.f.sub, w)) > -1) best = /[a-z0-9]/.test(item.f.sub[at - 1] || '') ? 5 : 9;
      else if ((at = find(item.f.text, w)) > -1) best = /[a-z0-9]/.test(item.f.text[at - 1] || '') ? 2 : 4;
      else if (item.f.group.indexOf(w) === 0) best = 3;
      else return 0;
      total += best;
    }
    if (item.group === 'Pages') total += 4;
    if (item.group === 'Photos') total -= 2;
    return total;
  }

  // the text, with each word typed set in <mark>
  function marked(text, words) {
    var frag = document.createDocumentFragment();
    var low = fold(text);
    var spans = [];
    words.forEach(function (w) {
      var at = low.indexOf(w);
      while (at > -1) {
        spans.push([at, at + w.length]);
        at = low.indexOf(w, at + w.length);
      }
    });
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var from = 0;
    spans.forEach(function (span) {
      if (span[0] < from) return;
      frag.appendChild(document.createTextNode(text.slice(from, span[0])));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(span[0], span[1]);
      frag.appendChild(mark);
      from = span[1];
    });
    frag.appendChild(document.createTextNode(text.slice(from)));
    return frag;
  }

  // under the name: when the name matched, the line that goes with it;
  // otherwise a few words either side of the first match in the text
  function snippet(item, words) {
    var inTitle = words.every(function (w) { return item.f.title.indexOf(w) > -1; });
    if (inTitle || !item.text) return item.sub || item.text.slice(0, 90);
    var at = -1;
    words.some(function (w) { at = item.f.text.indexOf(w); return at > -1; });
    if (at < 0) return item.sub;
    var start = Math.max(0, item.text.lastIndexOf(' ', Math.max(0, at - 36)));
    var end = item.text.indexOf(' ', Math.min(item.text.length, at + 70));
    return (start > 0 ? '\u2026' : '') + item.text.slice(start, end < 0 ? undefined : end).trim() + (end > 0 ? '\u2026' : '');
  }

  var opener = document.querySelector('.kbar-open');
  if (!opener || typeof HTMLDialogElement !== 'function') {
    if (opener) opener.hidden = true;
    return;
  }

  var dialog = document.createElement('dialog');
  dialog.className = 'kbar';
  dialog.setAttribute('aria-label', 'Search');
  dialog.innerHTML =
    '<div class="kbar__field">' +
    '<svg class="kbar__icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.75"/><path d="M10.5 10.5L14 14"/></svg>' +
    '<input class="kbar__input" type="text" placeholder="Search projects, work, press, photos…" autocomplete="off" spellcheck="false" ' +
    'role="combobox" aria-expanded="true" aria-controls="kbar-list" aria-autocomplete="list" aria-label="Search">' +
    '</div>' +
    '<div class="kbar__list" id="kbar-list" role="listbox" aria-label="Results"></div>' +
    '<div class="kbar__foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span><span class="kbar__count"></span></div>';
  document.body.appendChild(dialog);
  var input = dialog.querySelector('.kbar__input');
  var list = dialog.querySelector('.kbar__list');
  var count = dialog.querySelector('.kbar__count');
  var shown = [];
  var active = 0;

  var SUGGESTED = ['About', 'Work', 'Projects', 'Photography', 'Music', 'Press', 'Contact', 'Resume'];

  function results(q) {
    var words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) {
      var pages = (index || []).filter(function (item) { return item.group === 'Pages'; });
      var picks = SUGGESTED.map(function (t) {
        return pages.filter(function (p) { return p.title === t; })[0];
      }).filter(Boolean);
      if (!picks.length) picks = SUGGESTED.map(function (t) { return { group: 'Pages', title: t, sub: '', url: '/' + (t === 'About' ? '' : t === 'Photography' ? 'photos/' : t.toLowerCase() + '/') }; });
      return { words: words, items: picks.concat(FIXED.filter(function (f) { return f.group === 'Do'; }).slice(0, 3)) };
    }
    var ranked = [];
    (index || FIXED.map(prepare)).forEach(function (item) {
      var s = score(item, words);
      if (s > 0) ranked.push([s, item]);
    });
    ranked.sort(function (a, b) { return b[0] - a[0]; });
    return { words: words, items: ranked.slice(0, 40).map(function (r) { return r[1]; }) };
  }

  function render() {
    var q = input.value.trim();
    var found = results(q);
    shown = found.items;
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.textContent = '';
    count.textContent = q ? shown.length + (shown.length === 40 ? '+' : '') + ' found' : '';

    if (!shown.length) {
      var empty = document.createElement('p');
      empty.className = 'kbar__empty';
      empty.textContent = index ? 'Nothing for “' + q + '”' : 'Reading the site…';
      list.appendChild(empty);
      return;
    }

    if (!q) {
      var heading = document.createElement('div');
      heading.className = 'kbar__group';
      heading.setAttribute('role', 'presentation');
      heading.textContent = 'Go to';
      list.appendChild(heading);
    }

    shown.forEach(function (item, i) {
      if (!q && i > 0 && item.group !== shown[i - 1].group) {
        var h = document.createElement('div');
        h.className = 'kbar__group';
        h.setAttribute('role', 'presentation');
        h.textContent = item.group === 'Do' ? 'Do' : item.group;
        list.appendChild(h);
      }
      var option = document.createElement('div');
      option.className = 'kbar__item';
      option.id = 'kbar-' + i;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', i === active ? 'true' : 'false');

      if (item.thumb) {
        var img = document.createElement('img');
        img.className = 'kbar__thumb';
        img.src = item.thumb;
        img.alt = '';
        img.loading = 'lazy';
        option.appendChild(img);
      }

      var body = document.createElement('span');
      body.className = 'kbar__body';
      var title = document.createElement('span');
      title.className = 'kbar__title';
      title.appendChild(marked(item.title, found.words));
      body.appendChild(title);
      var more = q ? snippet(item, found.words) : item.sub;
      if (more) {
        var line = document.createElement('span');
        line.className = 'kbar__snip';
        line.appendChild(marked(more, found.words));
        body.appendChild(line);
      }
      option.appendChild(body);

      var kind = document.createElement('span');
      kind.className = 'kbar__kind';
      kind.textContent = q ? item.group : (/^https?:/.test(item.url) ? '↗' : '');
      option.appendChild(kind);

      option.addEventListener('pointermove', function () { select(i); });
      option.addEventListener('click', function () { go(item); });
      list.appendChild(option);
    });
    input.setAttribute('aria-activedescendant', 'kbar-' + active);
  }

  function select(i) {
    if (i === active || !shown.length) return;
    active = i;
    list.querySelectorAll('.kbar__item').forEach(function (el) {
      el.setAttribute('aria-selected', el.id === 'kbar-' + i ? 'true' : 'false');
    });
    var el = document.getElementById('kbar-' + i);
    if (el) el.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', 'kbar-' + i);
  }

  function go(item) {
    var target = item.url;
    close();
    if (/^copy:/.test(target)) {
      if (navigator.clipboard) navigator.clipboard.writeText(target.slice(5));
      return;
    }
    if (/^theme:/.test(target)) {
      var choice = document.querySelector('[data-theme-choice="' + target.slice(6) + '"]');
      if (choice) choice.click();
      return;
    }
    if (/^https?:/.test(target)) {
      window.open(target, '_blank', 'noopener');
      return;
    }
    var url = new URL(target, location.href);
    if (url.pathname === location.pathname && url.hash) {
      if (location.hash === url.hash) arrive(); else location.hash = url.hash;
    } else {
      location.href = target;
    }
  }

  function open() {
    input.value = '';
    active = 0;
    render();
    dialog.showModal();
    input.focus();
    build().then(function () { if (dialog.open) render(); });
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  opener.addEventListener('click', open);

  document.addEventListener('keydown', function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) close(); else open();
    } else if (event.key === '/' && !typing && !dialog.open) {
      event.preventDefault();
      open();
    }
  });

  input.addEventListener('input', function () { active = 0; render(); });
  input.addEventListener('keydown', function (event) {
    if (!shown.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); select((active + 1) % shown.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); select((active - 1 + shown.length) % shown.length); }
    else if (event.key === 'Enter' && shown[active]) { event.preventDefault(); go(shown[active]); }
  });

  // a click on the dimmed page around it closes it
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) close();
  });

  // start reading the site once the page is quiet, so the first search is instant
  if ('requestIdleCallback' in window) requestIdleCallback(function () { build(); }, { timeout: 4000 });

  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    var key = opener.querySelector('kbd');
    if (key) key.textContent = 'Ctrl K';
  }
})();
